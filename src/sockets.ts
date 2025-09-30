import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { Core } from "./core";
import { SESSION_ID, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";
import { handleUserInput } from "./console";
import TTSService from "./services/tts.service";

let io: Server;

export const setupSockets = (server: HTTPServer) => {
    io = new Server(server, {
        pingInterval: 10000,
        pingTimeout: 5000,
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        Logger.INFO('A client connected: '+socket.id);

        socket.on('joinChat', (sessionId: string) => {
            Logger.DEBUG(`Client ${socket.id} joining chat session: ${sessionId}`);
            socket.join(sessionId);
            Logger.DEBUG(`Client ${socket.id} successfully joined session ${sessionId}`);
            
            // Send confirmation back to client
            socket.emit('joinedChat', { sessionId, socketId: socket.id });
        });

        // Handle TTS configuration updates
        socket.on('updateTTSSettings', (data: { voice?: string; enabled?: boolean }) => {
            try {
                const ttsService = TTSService.getInstance();
                if (data.voice) {
                    ttsService.updateConfig({ voice: data.voice });
                }
                if (typeof data.enabled === 'boolean') {
                    ttsService.setEnabled(data.enabled);
                }
                socket.emit('ttsSettingsUpdated', ttsService.getConfig());
                Logger.DEBUG(`TTS settings updated: ${JSON.stringify(data)}`);
            } catch (err) {
                Logger.ERROR(`Error updating TTS settings: ${err}`);
                socket.emit('error', { message: 'Failed to update TTS settings' });
            }
        });

        // Get TTS settings
        socket.on('getTTSSettings', () => {
            try {
                const ttsService = TTSService.getInstance();
                socket.emit('ttsSettings', {
                    ...ttsService.getConfig(),
                    isReady: ttsService.isReady(),
                    availableVoices: ttsService.getAvailableVoices()
                });
            } catch (err) {
                Logger.ERROR(`Error getting TTS settings: ${err}`);
                socket.emit('error', { message: 'Failed to get TTS settings' });
            }
        });

                // Handle chat messages
        socket.on('chat', async (data: any) => {
            try {
                if (!data || !data.sessionId || !data.message) {
                    Logger.ERROR('Invalid chat data received: '+data);
                    socket.emit('error', { message: 'Invalid data format' });
                    return;
                }

                Logger.DEBUG(`Received chat message: ${JSON.stringify(data)}`);
                Core.chat_session = await startSession(data.sessionId);
                Logger.DEBUG(`Session started: ${SESSION_ID}`);
                await handleUserInput(data.message, data);

                //socket.emit('chat', { success: true });
            } catch (err) {
                Logger.ERROR('Error processing chat message: '+err);
                socket.emit('error', { message: 'Internal server error' });
            }
        });

        // Handle stop generation signal
        socket.on('stopGeneration', (data: { sessionId: string }) => {
            try {
                if (!data || !data.sessionId) {
                    Logger.ERROR('Invalid stop generation data received');
                    return;
                }
                Logger.DEBUG(`Received stop generation signal for session: ${data.sessionId}`);
                
                // Set flag to prevent generation from starting if it hasn't started yet
                Core.shouldStopGeneration = true;
                
                // Use Ollama's built-in abort method to stop all streaming generations
                Core.ollama_instance.abort();
                Logger.INFO('Generation aborted successfully');
            } catch (err) {
                Logger.ERROR('Error processing stop generation signal: '+err);
            }
        });

        // Handle stop generation signal
        socket.on('stopGeneration', (data: { sessionId: string }) => {
            try {
                if (!data || !data.sessionId) {
                    Logger.ERROR('Invalid stop generation data received');
                    return;
                }
                Logger.DEBUG(`Received stop generation signal for session: ${data.sessionId}`);
                //socket.emit('chat', { success: true });
            } catch (err) {
                Logger.ERROR('Error processing chat message: '+err);
                socket.emit('error', { message: 'Internal server error' });
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            Logger.INFO('Client disconnected: '+socket.id);
        });
    });

    Logger.INFO('Socket server initialized');

    return io;
};

/**
 * Emit TTS audio chunk to clients in a specific session
 */
export const emitTTSAudio = (sessionId: string, audioChunk: {
    text: string;
    audio: Buffer;
    index: number;
    isComplete?: boolean;
}) => {
    Logger.DEBUG(`TTS: Emitting audio chunk ${audioChunk.index} to session ${sessionId} (${audioChunk.audio.length} bytes)`);
    
    if (!io) {
        Logger.WARN('Socket.IO not initialized, cannot emit TTS audio');
        return;
    }

    try {
        // Get the list of clients in this session room
        const room = io.sockets.adapter.rooms.get(sessionId);
        const clientCount = room ? room.size : 0;
        
        if (clientCount === 0) {
            Logger.WARN(`TTS: No clients connected to session ${sessionId}, skipping audio emission`);
            return;
        }

        // Convert buffer to base64 for transmission
        const audioData = {
            ...audioChunk,
            audio: audioChunk.audio.toString('base64'),
            mimeType: 'audio/wav'
        };

        io.to(sessionId).emit('ttsAudio', audioData);
        Logger.INFO(`🔊 TTS: Emitted chunk ${audioChunk.index} to ${clientCount} clients in session ${sessionId} (${audioData.audio.length} chars)`);
        Logger.DEBUG(`✅ TTS chunk ${audioChunk.index} sent to ${clientCount} clients`);
    } catch (error) {
        Logger.ERROR(`Failed to emit TTS audio: ${error}`);
    }
};
