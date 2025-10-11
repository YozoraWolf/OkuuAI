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
import TTSService from './services/tts.service';
import { emitTTSAudio } from './sockets';
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

        // IMMEDIATELY emit user message for instant feedback
        // We'll update with memory details later
        io.to(msg.sessionId).emit('chat', { 
            ...msg, 
            timestamp: Date.now() 
        });

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

        // Step 5: User message already emitted immediately at the start
        // No need to emit again - user saw their message instantly

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
                
                const stream = await Core.ollama_instance.generate({
                    prompt,
                    model: Core.model_name,
                    stream: true,
                    system: Core.model_settings.system,
                    think: Core.model_settings.think,
                    images: sentImage,
                });

                let streamFinished = false;
                
                // Initialize TTS service for real-time streaming
                const ttsService = TTSService.getInstance();
                Logger.DEBUG(`TTS: Service initialized, ready: ${ttsService.isReady()}`);
                
                // Real-time TTS processing variables
                let textBuffer = '';
                
                // TTS processing variables for parallel generation
                const processedSentences = new Set<string>(); // Prevent duplicates
                let ttsChunkIndex = 0;
                
                // TTS processor - Fire-and-forget, no blocking whatsoever
                const processTTSChunk = (text: string, index: number) => {
                    // Skip if already processed
                    if (processedSentences.has(text) || !ttsService.isReady()) {
                        return;
                    }
                    
                    processedSentences.add(text);
                    Logger.DEBUG(`TTS: Dispatching chunk ${index} to Worker Thread (fire-and-forget)`);
                    
                    // Fire-and-forget: Send to Worker Thread without waiting
                    // The worker will handle audio generation and emission independently
                    ttsService.generateAudioAsync(text, index, msg.sessionId);
                };
                
                // Performance tracking for non-blocking verification
                let textChunkCount = 0;
                let lastChunkTime = Date.now();
                
                Logger.INFO(`TTS: 🚀 Starting text stream processing with ultra-parallel TTS`);
                
                // Process text stream with non-blocking real-time TTS
                for await (const part of stream) {
                    textChunkCount++;
                    const currentTime = Date.now();
                    const chunkDelay = currentTime - lastChunkTime;
                    lastChunkTime = currentTime;
                    
                    // Log if there's any unusual delay (indicating blocking)
                    if (chunkDelay > 50) {
                        Logger.WARN(`TTS: ⚠️ Text chunk ${textChunkCount} delayed by ${chunkDelay}ms - possible blocking`);
                    }
                    // Check if generation should be stopped (additional safety check)
                    if (Core.shouldStopGeneration) {
                        Logger.INFO('Generation stopped via flag during streaming');
                        aiReply += ' ...';
                        streamFinished = true;
                        break;
                    }
                    
                    aiReply += part.response;
                    reply.message = aiReply;
                    reply.done = false;
                    io.to(msg.sessionId).emit('chat', reply);
                    if (callback) callback(part.response);
                    
                    // TTS processing with Worker Thread - no blocking concerns
                    if (ttsService.isReady()) {
                        textBuffer += part.response;
                        
                        // Look for complete sentences and partial sentence chunks
                        const sentences = textBuffer.match(/[^.!?]*[.!?]+/g);
                        
                        if (sentences) {
                            // Process complete sentences immediately
                            for (const sentence of sentences) {
                                const cleanSentence = sentence.trim();
                                if (cleanSentence.length > 3 && !processedSentences.has(cleanSentence)) {
                                    // Process with Worker Thread - non-blocking
                                    processTTSChunk(cleanSentence, ttsChunkIndex++);
                                }
                            }
                            
                            // Remove processed sentences from buffer
                            const lastSentence = sentences[sentences.length - 1];
                            const lastIndex = textBuffer.lastIndexOf(lastSentence) + lastSentence.length;
                            textBuffer = textBuffer.slice(lastIndex);
                            
                        } else if (textBuffer.length > 30) {
                            // If we have a long phrase without sentence endings, process it anyway
                            // Look for natural breaks like commas, semicolons, or after certain words
                            const naturalBreaks = textBuffer.match(/[^,.;:]*[,.;:]+/g);
                            
                            if (naturalBreaks && naturalBreaks.length > 0) {
                                const phrase = naturalBreaks[0].trim();
                                if (phrase.length > 5 && !processedSentences.has(phrase)) {
                                    // Process with Worker Thread - non-blocking
                                    processTTSChunk(phrase, ttsChunkIndex++);
                                    
                                    // Remove processed phrase from buffer
                                    const phraseIndex = textBuffer.indexOf(phrase) + phrase.length;
                                    textBuffer = textBuffer.slice(phraseIndex);
                                }
                            }
                        }
                    }
                }
                
                streamFinished = true;
                
                // Process any remaining text in the buffer after streaming ends
                if (ttsService.isReady() && textBuffer.trim()) {
                    const remainingText = textBuffer.trim();
                    if (remainingText.length > 3 && !processedSentences.has(remainingText)) {
                        Logger.DEBUG(`TTS: Processing remaining text: "${remainingText}"`);
                        // Process remaining text with fire-and-forget Worker Thread
                        processTTSChunk(remainingText, ttsChunkIndex++);
                    }
                }
                
                // Send completion signal after a short delay to allow final TTS to process
                if (ttsService.isReady()) {
                    setTimeout(() => {
                        emitTTSAudio(msg.sessionId, {
                            text: '',
                            audio: Buffer.alloc(0),
                            index: -1,
                            isComplete: true
                        });
                    }, 100);
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
