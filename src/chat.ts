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

async function buildPrompt(msg: ChatMessage) {
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

    // 3. Build structured prompt
    const prompt = `
System:
You are Okuu, a helpful AI assistant. Be consistent, concise, and relevant.

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

        // Step 3: Build prompt (memories + history + user msg)
        const prompt = await buildPrompt(msg);
        Logger.DEBUG(`Prompt built:\n${prompt}`);

        // Step 4: Notify client of user message
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
                
                // TTS processor - completely decoupled from main stream
                const processTTSChunk = (text: string, index: number) => {
                    // Skip if already processed
                    if (processedSentences.has(text) || !ttsService.isReady()) {
                        return;
                    }
                    
                    processedSentences.add(text);
                    Logger.DEBUG(`TTS: Queuing chunk ${index} for background processing`);
                    
                    // Use process.nextTick for maximum non-blocking behavior
                    process.nextTick(() => {
                        // Further defer to ensure text generation continues
                        setTimeout(() => {
                            Logger.DEBUG(`TTS: Starting background generation for chunk ${index}`);
                            
                            ttsService.generateAudio(text).then(audioBuffer => {
                                if (audioBuffer) {
                                    Logger.INFO(`TTS: ✅ Generated chunk ${index} (${audioBuffer.length} bytes)`);
                                    emitTTSAudio(msg.sessionId, {
                                        text: text,
                                        audio: audioBuffer,
                                        index: index
                                    });
                                } else {
                                    Logger.WARN(`TTS: ❌ No audio buffer generated for chunk ${index}`);
                                }
                            }).catch(ttsError => {
                                Logger.ERROR(`TTS: ❌ Processing error for chunk ${index}: ${ttsError}`);
                            });
                        }, 0); // Minimal delay to ensure non-blocking
                    });
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
                    if (chunkDelay > 100) {
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
                    
                    // Non-blocking TTS processing as text streams
                    if (ttsService.isReady()) {
                        textBuffer += part.response;
                        
                        // Look for complete sentences and partial sentence chunks
                        const sentences = textBuffer.match(/[^.!?]*[.!?]+/g);
                        
                        if (sentences) {
                            // Process complete sentences immediately
                            for (const sentence of sentences) {
                                const cleanSentence = sentence.trim();
                                if (cleanSentence.length > 3 && !processedSentences.has(cleanSentence)) {
                                    // Process immediately with micro-delay to prevent blocking
                                    const delay = Math.random() * 10; // Very small random delay
                                    setTimeout(() => {
                                        processTTSChunk(cleanSentence, ttsChunkIndex++);
                                    }, delay);
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
                                    // Process with slight staggered delay to prevent overwhelming
                                    const delay = Math.random() * 50; // 0-50ms random delay
                                    setTimeout(() => {
                                        processTTSChunk(phrase, ttsChunkIndex++);
                                    }, delay);
                                    
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
                        // Process remaining text in parallel
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

        reply.done = true;
        reply.message = resp.response;
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
