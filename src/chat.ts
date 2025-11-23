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
    metadata?: {
        web_search?: { sources: { title: string; url: string }[] };
        weather?: any;
        [key: string]: any;
    };
    memoryUser?: string;
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
    let memories = await searchMemoryWithEmbedding(memoryQuery, msg.sessionId);
    if (memories && memories.length > MAX_RELEVANT_MEMORIES) {
        memories = memories.slice(0, MAX_RELEVANT_MEMORIES);
    }
    const memoryContext = memories?.map((doc: any) => `- ${doc.message}`).join('\n');

    // 2. Get recent chat history, clamp by length
    const lastMsgs = await getLatestMsgsFromSession(msg.sessionId, 50);

    // Filter out the current message if it's already in the history (to avoid duplication in prompt)
    if (lastMsgs.messages.length > 0) {
        const lastMsg = lastMsgs.messages[lastMsgs.messages.length - 1];
        if (lastMsg.message === msg.message && (lastMsg.user === msg.user || lastMsg.user === msg.memoryUser)) {
            lastMsgs.messages.pop();
        }
    }

    let historyLines = lastMsgs.messages.map((m: any) => `${m.user}: ${m.message}`);
    let history = historyLines.join('\n');
    if (history.length > MAX_HISTORY_CHARS) {
        history = history.slice(history.length - MAX_HISTORY_CHARS);
    }

    // 3. Include tools only if we didn't already use tools proactively
    // AND if auto-detect is NOT enabled (if it is, we trust the proactive check and don't show tools to the main model)
    let toolsSection = '';
    const toolsConfig = enhancedToolSystem.getConfig();
    if (includeTools && toolsConfig.enabled && !toolsWereUsed && !toolsConfig.auto_detect) {
        toolsSection = enhancedToolSystem.getEnabledToolsForPrompt();
        if (toolsSection) {
            Logger.DEBUG(`Tools included in prompt (Auto-detect disabled)`);
        }
    }

    // 4. Build structured prompt
    let systemPrompt = Core.model_settings.system;

    // Replace templates
    systemPrompt = systemPrompt.replace(/{{user}}/g, msg.user || 'User');

    if (msg.metadata?.discord_mention) {
        systemPrompt = systemPrompt.replace(/{{mention}}/g, `When replying, you MUST mention the user using this exact string: ${msg.metadata.discord_mention}`);
    } else {
        systemPrompt = systemPrompt.replace(/{{mention}}/g, '');
    }

    const prompt = `
System:
${systemPrompt}${toolsSection}

Relevant Memories (from user):
${memoryContext || 'None'}

Conversation so far:
${history}

User (${msg.user}): ${msg.message}
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
            memoryUser: msg.memoryUser || 'okuu',
        };

        // Step 1: Save user input in memory
        const messageType = isQuestion(msg.message as string) ? 'question' : 'statement';
        const memoryUser = msg.memoryUser || 'user';
        const memory = await saveMemoryWithEmbedding(msg.sessionId, msg.message as string, memoryUser, messageType, '', undefined, msg.metadata, msg.timestamp);
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
        let toolMetadata: any = {};
        let toolWasUsed = false;
        if (enhancedToolSystem.getConfig().enabled) {
            // Get recent history for context
            const recentHistory = await getLatestMsgsFromSession(msg.sessionId, 5);
            const proactiveToolCall = await enhancedToolSystem.detectProactiveToolUsage(msg.message || '', recentHistory.messages);
            if (proactiveToolCall) {
                Logger.INFO(`Proactive tool call detected: ${proactiveToolCall.name}`);
                try {
                    const result = await enhancedToolSystem.executeTool(proactiveToolCall);
                    toolResult = result.output;
                    toolMetadata = result.metadata;
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
            // Tool results already contain natural language guidance
            prompt += `\n\n${toolResult}\n\nOkuu:`;
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
            reply.metadata = toolMetadata; // Add metadata to the initial reply object

            // Let client know AI reply started with the memoryKey
            io.to(msg.sessionId).emit('chat', reply);

            let aiReply = '';

            try {
                // Notify that AI generation is starting (not just processing)
                io.to(msg.sessionId).emit('generationStarted');

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
                // Check for reactive tool call (fallback if proactive failed)
                const reactiveToolCall = enhancedToolSystem.parsePotentialToolCall(aiReply);
                if (reactiveToolCall) {
                    Logger.INFO(`Reactive tool call detected: ${reactiveToolCall.name}`);

                    // Notify user we are executing the tool
                    reply.message = `${aiReply}\n\n*Executing tool: ${reactiveToolCall.name}...*`;
                    io.to(msg.sessionId).emit('chat', reply);

                    try {
                        const toolResult = await enhancedToolSystem.executeTool(reactiveToolCall);
                        const toolOutput = toolResult.output;
                        const toolMetadata = toolResult.metadata;

                        Logger.INFO(`Reactive tool executed: ${toolOutput.substring(0, 50)}...`);

                        // Generate final response with tool result
                        const followUpPrompt = `${prompt}\n${aiReply}\n\nTool Result: ${toolOutput}\n\nUser: Please use this information to answer my request. Do not hallucinate. Only use the provided information.\n\nOkuu:`;

                        let finalReply = '';
                        io.to(msg.sessionId).emit('generationStarted');

                        const followUpStream = await Core.ollama_instance.generate({
                            prompt: followUpPrompt,
                            model: Core.model_name,
                            stream: true,
                            system: Core.model_settings.system,
                            think: Core.model_settings.think,
                        });

                        for await (const part of followUpStream) {
                            if (Core.shouldStopGeneration) break;
                            finalReply += part.response;
                            // Emit with metadata if available
                            reply.message = finalReply;
                            reply.metadata = toolMetadata; // Add metadata to the reply object
                            io.to(msg.sessionId).emit('chat', reply);
                        }

                        aiReply = finalReply; // Update aiReply for memory saving

                    } catch (error) {
                        Logger.ERROR(`Reactive tool execution failed: ${error}`);
                        reply.message += `\n\n*Error executing tool.*`;
                        io.to(msg.sessionId).emit('chat', reply);
                    } finally {
                        io.to(msg.sessionId).emit('generationEnded');
                    }
                }

                try {
                    const messageTypeAI = isQuestion(aiReply) ? 'question' : 'statement';
                    await saveMemoryWithEmbedding(
                        reply.sessionId,
                        aiReply,
                        msg.memoryUser || "okuu",
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

        // Check for reactive tool call in non-stream mode
        const reactiveToolCall = enhancedToolSystem.parsePotentialToolCall(reply.message);
        if (reactiveToolCall) {
            Logger.INFO(`Reactive tool call detected (non-stream): ${reactiveToolCall.name}`);
            try {
                const toolResult = await enhancedToolSystem.executeTool(reactiveToolCall);
                const followUpPrompt = `${prompt}\n${reply.message}\n\nTool Result: ${toolResult}\n\nUser: Please use this information to answer my request.\n\nOkuu:`;

                const followUpResp = await Core.ollama_instance.generate({
                    prompt: followUpPrompt,
                    model: Core.model_name,
                    stream: false,
                    system: Core.model_settings.system,
                });

                reply.message = followUpResp.response;
            } catch (error) {
                Logger.ERROR(`Reactive tool execution failed: ${error}`);
            }
        }

        reply.done = true;
        reply.lang = langMappings[franc(msg.message || '')] || 'en-US';
        reply.thinking = resp.thinking || '';

        const messageTypeAI = isQuestion(reply.message) ? 'question' : 'statement';
        const aiMemory = await saveMemoryWithEmbedding(reply.sessionId, reply.message, msg.memoryUser || "okuu", messageTypeAI, reply.thinking);
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
