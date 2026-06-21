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

const getEmbeddingProvider = () => (process.env.EMBEDDING_PROVIDER || 'none').toLowerCase();

const getEmbeddingBaseUrl = () => {
    if (process.env.EMBEDDING_BASE_URL) return process.env.EMBEDDING_BASE_URL.replace(/\/$/, '');
    if (getEmbeddingProvider() === 'ollama') return process.env.OLLAMA_HOST || `http://127.0.0.1:${process.env.OLLAMA_PORT || 11434}`;
    return 'http://127.0.0.1:8081/v1';
};

export const isOllamaProvider = () => getProvider() === 'ollama';

export const embedText = async (input: string): Promise<number[]> => {
    const provider = getEmbeddingProvider();
    const model = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

    if (provider === 'none') {
        return [];
    }

    if (provider === 'ollama') {
        const embeddingResponse = await Core.ollama_instance.embed({ input, model });
        return embeddingResponse.embeddings.length === 1
            ? embeddingResponse.embeddings[0]
            : averageEmbeddings(embeddingResponse.embeddings);
    }

    if (provider !== 'openai-compatible') {
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }

    const response = await fetch(`${getEmbeddingBaseUrl()}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(process.env.EMBEDDING_API_KEY ? { Authorization: `Bearer ${process.env.EMBEDDING_API_KEY}` } : {}),
        },
        body: JSON.stringify({ model, input }),
    });

    if (!response.ok) {
        throw new Error(`Embedding endpoint returned ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    const embedding = data.data?.[0]?.embedding || data.embedding;
    if (!Array.isArray(embedding)) {
        throw new Error('Embedding endpoint returned no embedding array.');
    }

    return embedding;
};

function averageEmbeddings(embeddings: number[][]): number[] {
    const dimension = embeddings[0].length;
    const summed = new Array(dimension).fill(0);

    embeddings.forEach(vector => {
        vector.forEach((val, index) => {
            summed[index] += val;
        });
    });

    return summed.map(val => val / embeddings.length);
}

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
