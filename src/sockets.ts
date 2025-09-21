import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { Core } from "./core";
import { SESSION_ID, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";
import { handleUserInput } from "./console";

import { Whisperer } from './whisperer';
import { sendChat } from "./chat";

let io: Server;
const TMP_DIR = "/tmp";

// whisper related
let whisper: Whisperer;

export const setupSockets = async (server: HTTPServer) => {
    io = new Server(server, {
        pingInterval: 10000,
        pingTimeout: 5000,
    });

    whisper = null as any;
    await Whisperer.initWhisper();
    
    // init whisperer instance
    if (!Whisperer.getInstance()) {
        try {        
            whisper = Whisperer.getInstance();
        } catch (error) {
            Logger.ERROR('Error initializing Whisperer: ' + error);
        }
    }

    io.on('connection', (socket) => {
        Logger.INFO('A client connected: ' + socket.id);

        // Per-socket transcription buffer and timer
        let transcriptionBuffer = '';
        let lastTranscription = '';
        // Remove auto-send logic - let user control when to stop
        // let blankTimer: NodeJS.Timeout | null = null;
        // const BLANK_TIMEOUT_MS = 2000; // Removed auto-timeout
        let lastMicEndManual = false;

        // Helper to send buffered transcription to chat (removed auto-send)
        function sendBufferedTranscription(triggeredByBlank = false) {
            if (transcriptionBuffer.trim() && transcriptionBuffer !== lastTranscription) {
                const cleaned = transcriptionBuffer
                    .replace(/\[BLANK_AUDIO\]/g, '')
                    .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3} --> [^\]]+\]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                if (cleaned && cleaned.length > 3) { // Only send if meaningful content
                    Logger.DEBUG('Sending final transcription: ' + cleaned);
                    // Don't send transcription_final automatically - let user control
                    // socket.emit('transcription_final', { text: cleaned });
                    lastTranscription = cleaned;
                }
                // Don't clear buffer - keep accumulating until manual stop
                // transcriptionBuffer = '';
            }
        }

        // Register transcription callback for incremental updates
        let transcriptionCallback: ((text: string) => void) | null = null;
        
        try {
            const whisper = Whisperer.getInstance();
            
            // Create a callback specific to this socket
            transcriptionCallback = (text: string) => {
                Logger.DEBUG('Raw transcription: ' + text);

                // Clean up text for display
                const cleaned = text
                    .replace(/\[BLANK_AUDIO\]/g, '')
                    .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3} --> [^\]]+\]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                // Only process non-blank transcriptions
                if (cleaned && !text.includes('[BLANK_AUDIO]') && cleaned.length > 0) {
                    // Skip if this is identical to the last transcription (avoid duplicates)
                    if (cleaned === lastTranscription) {
                        Logger.DEBUG('Skipping duplicate transcription: ' + cleaned);
                        return;
                    }
                    
                    // Always send new transcriptions - each chunk may contain new speech
                    transcriptionBuffer = cleaned;
                    lastTranscription = cleaned;
                    
                    // Send incremental update to frontend
                    socket.emit('transcription', { text: transcriptionBuffer });
                    Logger.DEBUG('Sent incremental transcription: ' + transcriptionBuffer);
                }
            };
            
            whisper.onTranscription(transcriptionCallback);
        } catch (err) {
            Logger.ERROR('Failed to register transcription callback: ' + err);
        }

        // Handle joining a chat session
        socket.on('joinChat', (sessionId: string) => {
            Logger.DEBUG('Joining chat: ' + sessionId);
            socket.join(sessionId);
        });

        // Handle chat messages
        socket.on('chat', async (data: any) => {
            try {
                if (!data || !data.sessionId || !data.message) {
                    Logger.ERROR('Invalid chat data received: ' + data);
                    socket.emit('error', { message: 'Invalid data format' });
                    return;
                }

                Logger.DEBUG(`Received chat message: ${JSON.stringify(data)}`);
                Core.chat_session = await startSession(data.sessionId);
                Logger.DEBUG(`Session started: ${SESSION_ID}`);
                await handleUserInput(data.message, data);

                //socket.emit('chat', { success: true });
            } catch (err) {
                Logger.ERROR('Error processing chat message: ' + err);
                socket.emit('error', { message: 'Internal server error' });
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            Logger.INFO('Client disconnected: ' + socket.id);
            
            // Clean up any transcription callbacks for this socket
            if (transcriptionCallback) {
                try {
                    const whisper = Whisperer.getInstance();
                    whisper.removeTranscriptionCallback(transcriptionCallback);
                    transcriptionCallback = null;
                } catch (err) {
                    Logger.ERROR('Error cleaning up transcription callback: ' + err);
                }
            }
        });

        // Store decoder per socket - removed since using whisper-stream now

        socket.on('mic', async (payload: any) => {
            Logger.DEBUG('Received mic start signal');
            const whisper = Whisperer.getInstance();
            
            // Only start if not already transcribing
            if (!whisper || whisper.getTranscribingState()) {
                Logger.DEBUG('Whisper is already transcribing, ignoring start request');
                return;
            }
            
            try {
                // Reset transcription state for new session
                lastTranscription = '';
                transcriptionBuffer = '';
                
                await whisper.start();
                Logger.DEBUG('Whisper transcription started');
            } catch (error) {
                Logger.ERROR('Error starting whisper transcription: ' + error);
            }
            
            lastMicEndManual = false; // reset manual flag when recording starts
        });

        // Handle audio data streaming from browser
        socket.on('audio_data', async (payload: any) => {
            const whisper = Whisperer.getInstance();
            
            if (!whisper || !whisper.getTranscribingState()) {
                Logger.DEBUG('Whisper not transcribing, ignoring audio data');
                return;
            }
            
            try {
                // Convert received data to Buffer
                let audioBuffer: Buffer;
                
                if (typeof payload.data === 'string') {
                    // Base64 encoded audio data
                    audioBuffer = Buffer.from(payload.data, 'base64');
                } else if (payload.data instanceof ArrayBuffer) {
                    // ArrayBuffer from browser
                    audioBuffer = Buffer.from(payload.data);
                } else if (Array.isArray(payload.data)) {
                    // Array of numbers (Int16Array converted to array)
                    // Convert back to Buffer containing 16-bit samples
                    const int16Array = new Int16Array(payload.data);
                    audioBuffer = Buffer.from(int16Array.buffer);
                } else {
                    Logger.ERROR('Unknown audio data format received');
                    return;
                }
                
                // Log periodically for debugging
                if (Math.random() < 0.01) { // Log ~1% of chunks
                    Logger.DEBUG(`Received audio chunk: ${audioBuffer.length} bytes, sample rate: ${payload.sampleRate || 'unknown'}`);
                }
                
                // Send audio data to whisper for processing
                whisper.addAudioData(audioBuffer);
                
            } catch (error) {
                Logger.ERROR('Error processing audio data: ' + error);
            }
        });

        // Handle end of mic stream
        socket.on('mic_end', async (payload: any = {}) => {
            const whisper = Whisperer.getInstance();
            await whisper.stop();
            Logger.DEBUG('Whisper transcription stopped');

            lastMicEndManual = payload && payload.manual === true;
            
            // Don't send transcription_final - frontend already has accumulated transcription
            // The incremental transcription events have already built up the full text
            Logger.DEBUG('Manual stop - not sending transcription_final as frontend has accumulated text');
            
            // Clear buffer for next session
            transcriptionBuffer = '';
        });

        // Force stop all whisper processes (emergency cleanup)
        socket.on('force_stop_whisper', async () => {
            Logger.DEBUG('Force stopping all whisper processes');
            await Whisperer.cleanup();
        });

        // Debug: Check running whisper processes
        socket.on('check_whisper_processes', async () => {
            const { WhisperWorker } = await import('./whisperer/whisper.worker');
            const processes = await WhisperWorker.checkRunningProcesses();
            socket.emit('whisper_processes_status', { processes });
            Logger.DEBUG('Whisper processes status: ' + processes);
        });

    });



    Logger.INFO('Socket server initialized');

    return io;
};