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
        let blankTimer: NodeJS.Timeout | null = null;
        const BLANK_TIMEOUT_MS = 1000; // X seconds of blank audio before auto-send
        let lastMicEndManual = false;
        let lastEmittedTranscription = '';

        // Helper to send buffered transcription to chat
        function sendBufferedTranscription(triggeredByBlank = false) {
            // Only emit if buffer is not empty, and:
            // - triggered by blank timeout and not manual stop
            // - or forced (e.g., not used here)
            if (
                transcriptionBuffer.trim() &&
                (
                    (triggeredByBlank && !lastMicEndManual)
                )
            ) {
                const cleaned = transcriptionBuffer
                    .replace(/\[BLANK_AUDIO\]/g, '')
                    .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3} --> [^\]]+\]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (cleaned) {
                    socket.emit('transcription_final', { text: cleaned });
                }
                transcriptionBuffer = '';
            } else {
                transcriptionBuffer = '';
            }
        }

        // Register transcription callback for English (or other langs i decide to support in the future)
        try {
            const whisper = Whisperer.getInstance();
            
            whisper.onTranscription((text: string) => {
                Logger.DEBUG('Transcription: ' + text);

                // Clean up text for incremental display
                const cleaned = text
                    .replace(/\[BLANK_AUDIO\]/g, '')
                    .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3} --> [^\]]+\]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                // Only process non-blank transcriptions that are different from the last emitted one
                if (!text.includes('[BLANK_AUDIO]') && cleaned && cleaned !== lastEmittedTranscription) {
                    transcriptionBuffer = cleaned;
                    lastEmittedTranscription = cleaned;
                    socket.emit('transcription', { text: transcriptionBuffer });
                    
                    if (blankTimer) {
                        clearTimeout(blankTimer);
                        blankTimer = null;
                    }
                }

                if (text.includes('[BLANK_AUDIO]') || !cleaned) {
                    if (blankTimer) clearTimeout(blankTimer);
                    blankTimer = setTimeout(() => {
                        sendBufferedTranscription(true); // only trigger on blank timeout
                        blankTimer = null;
                    }, BLANK_TIMEOUT_MS);
                }
            });
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
                lastEmittedTranscription = '';
                transcriptionBuffer = '';
                
                await whisper.start();
                Logger.DEBUG('Whisper transcription started');
            } catch (error) {
                Logger.ERROR('Error starting whisper transcription: ' + error);
            }
            
            lastMicEndManual = false; // reset manual flag when recording starts
        });

        // Handle end of mic stream
        socket.on('mic_end', async (payload: any = {}) => {
            const whisper = Whisperer.getInstance();
            await whisper.stop();
            Logger.DEBUG('Whisper transcription stopped');

            lastMicEndManual = payload && payload.manual === true;
            // Do NOT call sendBufferedTranscription here, only clear buffer
            transcriptionBuffer = '';
            if (blankTimer) {
                clearTimeout(blankTimer);
                blankTimer = null;
            }
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