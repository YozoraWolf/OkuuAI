import { Core } from '@src/core';
import { Logger } from '@src/logger';

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OpenAIStreamChunk {
    choices: Array<{
        delta: {
            content?: string;
        };
        finish_reason: string | null;
    }>;
}

export async function* generateWithCustomEndpoint(
    messages: OpenAIMessage[],
    model: string = 'gpt-3.5-turbo',
    temperature: number = 0.3
): AsyncGenerator<string, void, unknown> {
    const url = `${Core.custom_endpoint_url}/v1/chat/completions`;
    
    const headers: any = {
        'Content-Type': 'application/json',
    };
    
    if (Core.custom_endpoint_api_key) {
        headers['Authorization'] = `Bearer ${Core.custom_endpoint_api_key}`;
    }
    
    const body = {
        model,
        messages,
        temperature,
        stream: true,
    };
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }
        
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
                
                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.slice(6)) as OpenAIStreamChunk;
                        const content = json.choices[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch (e) {
                        Logger.DEBUG(`Failed to parse SSE line: ${line}`);
                    }
                }
            }
        }
    } catch (error: any) {
        Logger.ERROR(`Error in custom endpoint generation: ${error.message}`);
        throw error;
    }
}

export async function generateWithCustomEndpointNonStreaming(
    messages: OpenAIMessage[],
    model: string = 'gpt-3.5-turbo',
    temperature: number = 0.3
): Promise<string> {
    const url = `${Core.custom_endpoint_url}/v1/chat/completions`;
    
    const headers: any = {
        'Content-Type': 'application/json',
    };
    
    if (Core.custom_endpoint_api_key) {
        headers['Authorization'] = `Bearer ${Core.custom_endpoint_api_key}`;
    }
    
    const body = {
        model,
        messages,
        temperature,
        stream: false,
    };
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    } catch (error: any) {
        Logger.ERROR(`Error in custom endpoint generation: ${error.message}`);
        throw error;
    }
}
