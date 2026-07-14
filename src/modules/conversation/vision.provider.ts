import { readFileSync } from 'fs';
import path from 'path';
import { generateCompletion } from '../../llm';
import type { ObservationCategory, ScreenFrame } from './conversation.events';

export type VisionAnalysis = {
    observation: string;
    category: ObservationCategory;
    importance: number;
    extractedText?: string;
    comment?: string;
};

export interface VisionProvider {
    analyze(frame: ScreenFrame, previousObservation?: string, signal?: AbortSignal): Promise<VisionAnalysis>;
}

const categories = new Set<ObservationCategory>(['info', 'suggestion', 'warning', 'error', 'success']);
let promptTemplate: string | undefined;

const getPromptTemplate = () => {
    promptTemplate ??= readFileSync(path.resolve(process.cwd(), 'prompts', 'vision-observation.md'), 'utf8');
    return promptTemplate;
};

export class LocalVisionProvider implements VisionProvider {
    async analyze(frame: ScreenFrame, previousObservation?: string, signal?: AbortSignal): Promise<VisionAnalysis> {
        const prompt = getPromptTemplate()
            .replace(/\{\{\s*visual_source\s*\}\}/g, frame.stream === 'camera' ? 'live camera view' : 'shared screen')
            .replace(/\{\{\s*previous_context\s*\}\}/g, previousObservation || 'None. This is the first analyzed frame.');
        const response = await this.complete(prompt, frame, signal);
        return this.parse(response);
    }

    private async complete(prompt: string, frame: ScreenFrame, signal?: AbortSignal) {
        const model = process.env.VISION_MODEL || 'redule26/huihui_ai_qwen2.5-vl-7b-abliterated:latest';
        const maxTokens = Number(process.env.VISION_MAX_TOKENS || 180);
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
                    extractedText: String(parsed.extractedText || '').trim().slice(0, 1200) || undefined,
                    comment: String(parsed.comment || '').trim().slice(0, 400) || undefined,
                };
            } catch {
                // Fall through to a text observation when a model adds prose around malformed JSON.
            }
        }
        return { observation: cleaned.slice(0, 600), category: 'info', importance: 0.5 };
    }
}
