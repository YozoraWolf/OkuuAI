import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { Core } from "./core";
import { SESSION_ID, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";
import { handleUserInput } from "./console";

import { Whisperer } from './whisperer';
import { sendChat } from "./chat";
import prism from 'prism-media';

let io: Server;
const TMP_DIR = "/tmp";

// whisper related

let whisper: Whisperer;
const opusDecoder = new prism.opus.Decoder({ frameSize: 960, channels: 1, rate: 16000 });

// Attach error handler to opusDecoder
opusDecoder.on('error', (err) => {
    Logger.ERROR('Opus decoder error: ' + err.message);
});

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
            whisper.onTranscription('en', (text: string) => {
                Logger.DEBUG('Transcription: ' + text);

                // Clean up text for incremental display
                const cleaned = text
                    .replace(/\[BLANK_AUDIO\]/g, '')
                    .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3} --> [^\]]+\]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                // Buffer non-blank transcriptions and emit only if not blank
                if (!text.includes('[BLANK_AUDIO]') && cleaned) {
                    transcriptionBuffer += ' ' + cleaned;
                    socket.emit('transcription', { text: transcriptionBuffer.trim() });
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

        // Store decoder per socket
        let socketOpusDecoder: prism.opus.Decoder | null = null;
        let socketDemuxer: any = null;
        let decoderShuttingDown = false;
        let demuxerType: string | null = null;

        socket.on('mic', (payload: any) => {
            //Logger.DEBUG('Received audio data');
            let data: Buffer;
            let mimeType: string | undefined;
            if (payload && payload.data && payload.mimeType) {
                data = Buffer.isBuffer(payload.data) ? payload.data : Buffer.from(payload.data);
                mimeType = payload.mimeType;
            } else {
                data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
                mimeType = undefined;
            }
            //Logger.DEBUG(`Audio data size: ${data.length} bytes, mimeType: ${mimeType}`);

            const whisper = Whisperer.getInstance();
            if (!socketOpusDecoder) {
                decoderShuttingDown = false;
                // Pick demuxer based on mimeType
                if (mimeType && mimeType.includes('webm')) {
                    socketDemuxer = new prism.opus.WebmDemuxer();
                    demuxerType = 'webm';
                } else {
                    socketDemuxer = new prism.opus.OggDemuxer();
                    demuxerType = 'ogg';
                }
                socketOpusDecoder = new prism.opus.Decoder({ frameSize: 960, channels: 1, rate: 16000 });
                socketOpusDecoder.on('error', (err) => {
                    if (!decoderShuttingDown) {
                        Logger.ERROR('Opus decoder error: ' + err.message);
                    }
                });
                socketOpusDecoder.on('data', (pcmChunk: Buffer) => {
                    if (whisper) {
                        //Logger.DEBUG(`[sockets] Calling whisper.feedAudio, chunk size: ${pcmChunk.length}`);
                        whisper.feedAudio(pcmChunk);
                    }
                });
                socketDemuxer.pipe(socketOpusDecoder);
            }
            try {
                socketDemuxer.write(data);
            } catch (err) {
                Logger.ERROR('Error decoding audio data: ' + err);
            }
            lastMicEndManual = false; // reset manual flag when recording starts
        });

        // Handle end of mic stream
        socket.on('mic_end', async (payload: any = {}) => {
            if (socketOpusDecoder) {
                decoderShuttingDown = true;
                socketOpusDecoder.removeAllListeners();
                socketOpusDecoder.destroy();
                socketOpusDecoder = null;
            }
            if (socketDemuxer) {
                socketDemuxer.unpipe();
                socketDemuxer.destroy();
                socketDemuxer = null;
            }
            const whisper = Whisperer.getInstance();
            whisper.stop();

            lastMicEndManual = payload && payload.manual === true;
            // Do NOT call sendBufferedTranscription here, only clear buffer
            transcriptionBuffer = '';
            if (blankTimer) {
                clearTimeout(blankTimer);
                blankTimer = null;
            }
        });

    });



    Logger.INFO('Socket server initialized');

    return io;
};