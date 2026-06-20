import { Core } from './core';
import { Logger } from './logger';

type GenerateOptions = {
    prompt: string;
    model?: string;
    stream?: boolean;
    system?: string;
    think?: boolean;
    images?: string[];
    format?: string;
};

type GenerateChunk = { response: string };
type GenerateResponse = { response: string; thinking?: string };

const getProvider = () => (process.env.LLM_PROVIDER || 'ollama').toLowerCase();

const getBaseUrl = () => {
    if (process.env.LLM_BASE_URL) return process.env.LLM_BASE_URL.replace(/\/$/, '');
    if (getProvider() === 'ollama') return `http://127.0.0.1:${process.env.OLLAMA_PORT || 11434}`;
    return 'http://127.0.0.1:8080/v1';
};

export const isOllamaProvider = () => getProvider() === 'ollama';

export const generateCompletion = async (options: GenerateOptions): Promise<GenerateResponse> => {
    if (isOllamaProvider()) {
        return Core.ollama_instance.generate(options as any) as Promise<GenerateResponse>;
    }

    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}),
        },
        body: JSON.stringify({
            model: options.model || Core.model_name,
            stream: false,
            messages: [
                ...(options.system ? [{ role: 'system', content: options.system }] : []),
                { role: 'user', content: options.prompt },
            ],
            temperature: Core.model_settings.temperature,
        }),
    });

    if (!response.ok) {
        throw new Error(`LLM endpoint returned ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    return { response: data.choices?.[0]?.message?.content || '' };
};

export const streamCompletion = async function* (options: GenerateOptions): AsyncIterable<GenerateChunk> {
    if (isOllamaProvider()) {
        const stream = await Core.ollama_instance.generate({ ...options, stream: true } as any);
        for await (const part of stream) {
            yield { response: part.response };
        }
        return;
    }

    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}),
        },
        body: JSON.stringify({
            model: options.model || Core.model_name,
            stream: true,
            messages: [
                ...(options.system ? [{ role: 'system', content: options.system }] : []),
                { role: 'user', content: options.prompt },
            ],
            temperature: Core.model_settings.temperature,
        }),
    });

    if (!response.ok) {
        throw new Error(`LLM endpoint returned ${response.status}: ${await response.text()}`);
    }

    if (!response.body) {
        Logger.WARN('LLM endpoint returned no stream body.');
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            try {
                const data = JSON.parse(payload);
                const content = data.choices?.[0]?.delta?.content || data.choices?.[0]?.text || '';
                if (content) yield { response: content };
            } catch (error) {
                Logger.WARN(`Failed to parse LLM stream chunk: ${error}`);
            }
        }
    }
};
