import { readFileSync } from 'fs';
import path from 'path';
import { generateCompletion } from '../../llm';
import type { ConversationResearchContext, ObservationCategory, ScreenFrame } from './conversation.events';

export type VisionAnalysis = {
    observation: string;
    category: ObservationCategory;
    importance: number;
    extractedText?: string;
    comment?: string;
    contextLabel?: string;
    contextConfidence?: number;
    researchFocus?: 'overview' | 'gameplay' | 'mechanics' | 'characters' | 'items' | 'builds' | 'quests' | 'troubleshooting';
    researchDepth?: 'simple' | 'concrete';
};

export interface VisionProvider {
    analyze(frame: ScreenFrame, previousObservation?: string, signal?: AbortSignal, researchContext?: ConversationResearchContext): Promise<VisionAnalysis>;
}

const categories = new Set<ObservationCategory>(['info', 'suggestion', 'warning', 'error', 'success']);
let promptTemplate: string | undefined;

const getPromptTemplate = () => {
    promptTemplate ??= readFileSync(path.resolve(process.cwd(), 'prompts', 'vision-observation.md'), 'utf8');
    return promptTemplate;
};

export class LocalVisionProvider implements VisionProvider {
    async analyze(frame: ScreenFrame, previousObservation?: string, signal?: AbortSignal, researchContext?: ConversationResearchContext): Promise<VisionAnalysis> {
        const researchedReference = researchContext
            ? `Topic: ${researchContext.topic}\n${researchContext.summary.slice(-4500)}`
            : 'None yet. Identify a specific stable context before proposing research.';
        const prompt = getPromptTemplate()
            .replace(/\{\{\s*visual_source\s*\}\}/g, frame.stream === 'camera' ? 'live camera view' : 'shared screen')
            .replace(/\{\{\s*previous_context\s*\}\}/g, previousObservation || 'None. This is the first analyzed frame.')
            .replace(/\{\{\s*user_question\s*\}\}/g, frame.query || 'None. This is a periodic observation.')
            .replace(/\{\{\s*research_context\s*\}\}/g, researchedReference);
        const response = await this.complete(prompt, frame, signal);
        return this.parse(response);
    }

    private async complete(prompt: string, frame: ScreenFrame, signal?: AbortSignal) {
        const model = process.env.VISION_MODEL || 'redule26/huihui_ai_qwen2.5-vl-7b-abliterated:latest';
        const maxTokens = Number(process.env.VISION_MAX_TOKENS || 220);
        if ((process.env.VISION_PROVIDER || 'openai-compatible').toLowerCase() === 'ollama') {
            const baseUrl = (process.env.VISION_BASE_URL || 'http://127.0.0.1:11434').replace(/\/v1\/?$/, '').replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    stream: false,
                    format: 'json',
                    keep_alive: process.env.VISION_KEEP_ALIVE || '30m',
                    messages: [{ role: 'user', content: prompt, images: [frame.base64] }],
                    options: { temperature: 0.1, num_predict: maxTokens, num_ctx: 4096 },
                }),
            });
            if (!response.ok) throw new Error(`Vision endpoint returned ${response.status}: ${await response.text()}`);
            const payload: any = await response.json();
            return String(payload.message?.content || '');
        }

        const result = await generateCompletion({
            prompt,
            model,
            images: [frame.base64],
            imageMimeType: frame.mimeType,
            maxTokens,
            temperature: 0.1,
            think: false,
            baseUrl: process.env.VISION_BASE_URL,
            signal,
        });
        return result.response;
    }

    private parse(response: string): VisionAnalysis {
        const cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?|```/gi, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                const parsed = JSON.parse(cleaned.slice(start, end + 1));
                const category = categories.has(parsed.category) ? parsed.category : 'info';
                return {
                    observation: String(parsed.observation || '').trim().slice(0, 600),
                    category,
                    importance: Math.max(0, Math.min(1, Number(parsed.importance) || 0.5)),
                    extractedText: this.cleanExtractedText(String(parsed.extractedText || '')),
                    comment: String(parsed.comment || '').trim().slice(0, 400) || undefined,
                    contextLabel: String(parsed.contextLabel || '').trim().slice(0, 120) || undefined,
                    contextConfidence: Math.max(0, Math.min(1, Number(parsed.contextConfidence) || 0)),
                    researchFocus: ['overview', 'gameplay', 'mechanics', 'characters', 'items', 'builds', 'quests', 'troubleshooting'].includes(parsed.researchFocus)
                        ? parsed.researchFocus
                        : 'overview',
                    researchDepth: parsed.researchDepth === 'concrete' ? 'concrete' : 'simple',
                };
            } catch {
                // Recover complete fields from truncated JSON (usually caused by runaway OCR).
            }
        }
        const recoveredObservation = this.extractStringField(cleaned, 'observation');
        if (recoveredObservation) {
            const recoveredCategory = this.extractStringField(cleaned, 'category') as ObservationCategory | undefined;
            const importance = Number(cleaned.match(/"importance"\s*:\s*([0-9.]+)/)?.[1]);
            return {
                observation: recoveredObservation.slice(0, 600),
                comment: this.extractStringField(cleaned, 'comment')?.slice(0, 400),
                category: recoveredCategory && categories.has(recoveredCategory) ? recoveredCategory : 'info',
                importance: Math.max(0, Math.min(1, importance || 0.5)),
                extractedText: this.cleanExtractedText(this.extractStringField(cleaned, 'extractedText') || ''),
                contextLabel: this.extractStringField(cleaned, 'contextLabel')?.slice(0, 120),
                contextConfidence: Math.max(0, Math.min(1, Number(cleaned.match(/"contextConfidence"\s*:\s*([0-9.]+)/)?.[1]) || 0)),
            };
        }
        return { observation: cleaned.slice(0, 600), category: 'info', importance: 0.5 };
    }

    private extractStringField(response: string, field: string) {
        const match = response.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
        if (!match?.[1]) return undefined;
        try {
            return JSON.parse(`"${match[1]}"`) as string;
        } catch {
            return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
    }

    private cleanExtractedText(value: string) {
        const seen = new Set<string>();
        const unique = value.split(/\r?\n/).map(line => line.trim()).filter(line => {
            const normalized = line.toLowerCase();
            if (!normalized || seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
        });
        return unique.join('\n').slice(0, 400) || undefined;
    }
}
