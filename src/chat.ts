import { io } from './index';
import { Core } from './core';
import { Logger } from './logger';
import { getLatestMsgsFromSession, SESSION_ID } from './langchain/memory/memory';
import { franc } from 'franc-ce';
import { Ollama } from 'ollama';
import { 
    isQuestion, 
    saveMemoryWithEmbedding, 
    searchMemoryWithEmbedding, 
    updateAttachmentForMemory, 
    updateMemory 
} from './langchain/redis';
import { loadFileContentFromStorage } from './langchain/memory/storage';
import { enhancedToolSystem } from './tools/enhancedToolSystem';
import { generateWithCustomEndpoint, OpenAIMessage } from './services/openai-compatible.service';

export interface ChatMessage {
    id?: number;
    type?: string;
    user?: string;
    message?: string;
    done?: boolean;
    sessionId: string;
    lang?: string;
    timestamp: number;
    stream?: boolean;
    thinking?: string;
    memoryKey?: string;
    file?: string;
    attachment?: string;
}

export const langMappings: { [key: string]: string } = {
    spa: 'es-ES',
    eng: 'en-US',
    jpn: 'ja-JP',
    fra: 'fr-FR',
};

let messagesCount = 0;

export const setMessagesCount = (cnt: number) => { messagesCount = cnt; };
export const getMessagesCount = () => messagesCount;
export const incrementMessagesCount = () => ++messagesCount;

const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

const MAX_RELEVANT_MEMORIES = 5;
const MAX_HISTORY_CHARS = 4000; // Ollama: use char proxy instead of tokens

async function buildPrompt(msg: ChatMessage, includeTools: boolean = true, toolsWereUsed: boolean = false) {
    // 1. Retrieve top-k relevant memories
    const memoryQuery = msg.message || '';
    let memories = await searchMemoryWithEmbedding(memoryQuery, Number(msg.sessionId));
    if (memories && memories.length > MAX_RELEVANT_MEMORIES) {
        memories = memories.slice(0, MAX_RELEVANT_MEMORIES);
    }
    const memoryContext = memories?.map((doc: any) => `- ${doc.message}`).join('\n');

    // 2. Get recent chat history, clamp by length
    const lastMsgs = await getLatestMsgsFromSession(msg.sessionId, 50);
    let historyLines = lastMsgs.messages.map((m: any) => `${m.user}: ${m.message}`);
    let history = historyLines.join('\n');
    if (history.length > MAX_HISTORY_CHARS) {
        history = history.slice(history.length - MAX_HISTORY_CHARS);
    }

    // 3. Include tools only if we didn't already use tools proactively
    let toolsSection = '';
    if (includeTools && enhancedToolSystem.getConfig().enabled && !toolsWereUsed) {
        toolsSection = enhancedToolSystem.getEnabledToolsForPrompt();
        if (toolsSection) {
            Logger.DEBUG(`Tools included in prompt`);
        }
    }

    // 4. Build structured prompt
    const prompt = `
System:
You are Okuu, a helpful AI assistant. Be consistent, concise, and relevant.${toolsSection}

Relevant Memories (from user):
${memoryContext || 'None'}

Conversation so far:
${history}

User: ${msg.message}
Okuu:
    `.trim();

    return prompt;
}

export const sendChat = async (msg: ChatMessage, callback?: (data: string) => void) => {
    try {
        msg = {
            ...msg,
            id: msg.id || incrementMessagesCount(),
        };
        Logger.DEBUG(`Sending chat: ${msg.id}`);

        const reply: ChatMessage = {
            id: incrementMessagesCount(),
            user: Core.ai_name || 'ai',
            message: '',
            done: false,
            lang: 'en-US',
            timestamp: Date.now(),
            sessionId: msg.sessionId || SESSION_ID || '',
            stream: msg.stream || false,
        };

        // Step 1: Save user input in memory
        const messageType = isQuestion(msg.message as string) ? 'question' : 'statement';
        const memory = await saveMemoryWithEmbedding(msg.sessionId, msg.message as string, "user", messageType);
        Logger.DEBUG(`Saved memory: ${memory.memoryKey}`);

        // Step 2: Update attachment in memory if file exists
        let sentImage: string[] | undefined = undefined;
        if (msg.file) {
            const fileContent = await loadFileContentFromStorage(msg.file);
            if (fileContent) {
                await updateAttachmentForMemory(memory.memoryKey, fileContent, msg.file);
                if (imageExts.includes(msg.file.split('.').pop() || '')) {
                    sentImage = [fileContent];
                }
                msg.attachment = fileContent;
                Logger.INFO(`Attachment updated for memory: ${memory.memoryKey}`);
            } else {
                Logger.ERROR(`Error loading file content: ${msg.file}`);
            }
        }

        // Step 3: Check if user message needs tools proactively
        let toolResult = '';
        let toolWasUsed = false;
        if (enhancedToolSystem.getConfig().enabled) {
            const proactiveToolCall = await enhancedToolSystem.detectProactiveToolUsage(msg.message || '');
            if (proactiveToolCall) {
                Logger.INFO(`Proactive tool call detected: ${proactiveToolCall.name}`);
                try {
                    toolResult = await enhancedToolSystem.executeTool(proactiveToolCall);
                    toolWasUsed = true;
                    Logger.INFO(`Proactive tool executed successfully: ${toolResult.substring(0, 100)}...`);
                } catch (toolError) {
                    Logger.ERROR(`Proactive tool execution failed: ${toolError}`);
                    toolResult = `[Tool execution failed: ${toolError}]`;
                    toolWasUsed = true;
                }
            }
        }

        // Step 4: Build prompt (memories + history + user msg + tool results if any)
        let prompt = await buildPrompt(msg, true, toolWasUsed);
        if (toolWasUsed && toolResult) {
            // When we used tools proactively, give AI the results without showing tool instructions
            prompt += `\n\nRelevant Information: ${toolResult}\n\nUser: ${msg.message}\n\nPlease respond naturally using this information.\n\nOkuu:`;
        }
        Logger.DEBUG(`Prompt built:\n${prompt}`);

        // Step 5: Notify client of user message
        io.to(msg.sessionId).emit('chat', { ...msg, memoryKey: memory.memoryKey, timestamp: memory.timestamp });

        // --- STREAMING MODE ---
        if (msg.stream) {
            const timestamp = Date.now();
            const streamMemoryKey = `okuuMemory:${msg.sessionId}:${timestamp}`;
            
            reply.done = false;
            reply.lang = langMappings[franc(msg.message || '')] || 'en-US';
            reply.sessionId = msg.sessionId;
            reply.timestamp = timestamp;
            reply.memoryKey = streamMemoryKey;

            // Let client know AI reply started with the memoryKey
            io.to(msg.sessionId).emit('chat', reply);

            let aiReply = '';

            try {
                // Notify that AI generation is starting (not just processing)
                io.to(msg.sessionId).emit('generationStarted');
                
                if (Core.use_custom_endpoint && Core.custom_endpoint_url) {
                    // Use custom OpenAI-compatible endpoint
                    Logger.INFO('Using custom endpoint for generation');
                    
                    const messages: OpenAIMessage[] = [
                        { role: 'system', content: Core.model_settings.system },
                        { role: 'user', content: prompt }
                    ];
                    
                    const stream = generateWithCustomEndpoint(
                        messages,
                        Core.model_name,
                        Core.model_settings.temperature
                    );
                    
                    for await (const part of stream) {
                        if (Core.shouldStopGeneration) {
                            Logger.INFO('Generation stopped via flag during streaming');
                            aiReply += ' ...';
                            break;
                        }
                        aiReply += part;
                        reply.message = aiReply;
                        reply.done = false;
                        io.to(msg.sessionId).emit('chat', reply);
                        if (callback) callback(part);
                    }
                } else {
                    // Use Ollama (default)
                    const stream = await Core.ollama_instance.generate({
                        prompt,
                        model: Core.model_name,
                        stream: true,
                        system: Core.model_settings.system,
                        think: Core.model_settings.think,
                        images: sentImage,
                    });

                    for await (const part of stream) {
                        // Check if generation should be stopped (additional safety check)
                        if (Core.shouldStopGeneration) {
                            Logger.INFO('Generation stopped via flag during streaming');
                            aiReply += ' ...';
                            break;
                        }
                        aiReply += part.response;
                        reply.message = aiReply;
                        reply.done = false;
                        io.to(msg.sessionId).emit('chat', reply);
                        if (callback) callback(part.response);
                    }
                }
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    Logger.INFO('Generation was aborted by user');
                    aiReply += ' ...';
                } else {
                    Logger.ERROR(`Error during generation: ${error.message}`);
                    throw error;
                }
            } finally {
                // Reset the stop flag
                Core.shouldStopGeneration = false;
                // Notify that generation has ended
                io.to(msg.sessionId).emit('generationEnded');
            }

            // Tools are handled proactively before AI response generation
            // No need for post-response tool parsing
            
            // Finalize AI reply
            reply.done = true;
            reply.message = aiReply || '...';

            // Save AI reply in memory only if there's actual content
            if (aiReply && aiReply.trim().length > 0) {
                try {
                    const messageTypeAI = isQuestion(aiReply) ? 'question' : 'statement';
                    await saveMemoryWithEmbedding(
                        reply.sessionId, 
                        aiReply, 
                        "okuu", 
                        messageTypeAI,
                        '', // thinking
                        reply.memoryKey // use our pre-generated key
                    );
                    await updateMemory(reply);
                } catch (memoryError: any) {
                    Logger.ERROR(`Error saving memory: ${memoryError.message}`);
                }
            }

            io.to(msg.sessionId).emit('chat', reply);
            return aiReply;
        }

        // --- NON-STREAM MODE ---
        Logger.DEBUG(`Loading full response...`);
        const resp = await Core.ollama_instance.generate({
            prompt,
            model: Core.model_name,
            system: Core.model_settings.system,
            think: Core.model_settings.think,
            images: sentImage,
        });

        // Tools are handled proactively before AI response generation
        reply.message = resp.response;
        
        reply.done = true;
        reply.lang = langMappings[franc(msg.message || '')] || 'en-US';
        reply.thinking = resp.thinking || '';

        const messageTypeAI = isQuestion(reply.message) ? 'question' : 'statement';
        const aiMemory = await saveMemoryWithEmbedding(reply.sessionId, reply.message, "okuu", messageTypeAI, reply.thinking);
        reply.memoryKey = aiMemory.memoryKey;
        reply.timestamp = aiMemory.timestamp;

        io.to(msg.sessionId).emit('chat', reply);

        callback && callback(reply.message);
        return reply.message;

    } catch (error: any) {
        Logger.ERROR(`Error sending chat: ${error.response ? error.response.data : error.message}`);
        return null;
    }
};

export const initOllamaInstance = async () => {
    try {
        Core.ollama_instance = new Ollama({ host: `http://127.0.0.1:${process.env.OLLAMA_PORT}` });
        Logger.INFO(`✅🦙 Ollama instance initialized.`);
    } catch (error: any) {
        Logger.ERROR(`❌🦙 Error initializing Ollama instance: ${error.message}`);
        throw error;
    }
};
