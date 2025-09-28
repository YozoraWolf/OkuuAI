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
                let textChunks: string[] = [];
                
                // Initialize TTS service for streaming
                const ttsService = TTSService.getInstance();
                Logger.DEBUG(`TTS: Service initialized, ready: ${ttsService.isReady()}`);
                
                // Process text stream and collect chunks for TTS
                for await (const part of stream) {
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
                    
                    // Collect text chunks for TTS processing
                    textChunks.push(part.response);
                }
                
                streamFinished = true;
                
                // After streaming is complete, process TTS if enabled
                Logger.DEBUG(`TTS: Checking if should process - Ready: ${ttsService.isReady()}, Text chunks: ${textChunks.length}`);
                if (ttsService.isReady() && textChunks.length > 0) {
                    (async () => {
                        try {
                            const fullText = textChunks.join('');
                            Logger.DEBUG(`TTS: Processing ${fullText.length} chars in ${fullText.split(/[.!?]+/).length} sentences`);
                            
                            // Split text into sentences for better TTS processing
                            // Use a more flexible sentence splitting approach
                            let sentences = fullText.match(/[^\.!?]+[\.!?]+/g);
                            
                            // If no sentences found with punctuation, use the full text
                            if (!sentences || sentences.length === 0) {
                                sentences = [fullText];
                            }
                            

                            
                            for (let i = 0; i < sentences.length; i++) {
                                const sentence = sentences[i].trim();
                                if (sentence) {
                                    const audioBuffer = await ttsService.generateAudio(sentence);
                                    if (audioBuffer) {
                                        Logger.DEBUG(`TTS: Generated ${audioBuffer.length} bytes for sentence ${i + 1}/${sentences.length}`);
                                        emitTTSAudio(msg.sessionId, {
                                            text: sentence,
                                            audio: audioBuffer,
                                            index: i
                                        });
                                    } else {
                                        Logger.WARN(`TTS: No audio buffer generated for sentence ${i}`);
                                    }
                                }
                            }
                            
                            // Send completion signal
                            emitTTSAudio(msg.sessionId, {
                                text: '',
                                audio: Buffer.alloc(0),
                                index: -1,
                                isComplete: true
                            });
                        } catch (ttsError) {
                            Logger.ERROR(`TTS processing error: ${ttsError}`);
                        }
                    })();
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
