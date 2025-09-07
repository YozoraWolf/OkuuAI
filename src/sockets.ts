import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { Core } from "./core";
import { SESSION_ID, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";
import { handleUserInput } from "./console";

import { Whisperer } from './whisperer';
import { sendChat } from "./chat";
import prism from 'prism-media';
import fs from 'fs';
import path from 'path';
import wav from 'wav';

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

        // Register transcription callback for English (or desired language)
        try {
            const whisper = Whisperer.getInstance();
            whisper.onTranscription('en', (text: string) => {
                Logger.DEBUG('Transcription: ' + text);
                socket.emit('transcription', { text });
            });
        } catch (err) {
            Logger.ERROR('Failed to register transcription callback: ' + err);
        }

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
        let decoderShuttingDown = false;
        let pcmChunks: Buffer[] = []; // accumulate PCM data

        // Will handle user audio input to whisper.cpp (nodejs-whisper) to sendChat
        socket.on('mic', (data: any) => {
            Logger.DEBUG('Received audio data');
            if (data && Buffer.isBuffer(data) && data.length > 0) {
                Logger.DEBUG(`Audio data type: ${typeof data}, size: ${data.length} bytes`);

                const whisper = Whisperer.getInstance();
                // Create decoder if not exists
                if (!socketOpusDecoder) {
                    decoderShuttingDown = false;
                    socketOpusDecoder = new prism.opus.Decoder({ frameSize: 960, channels: 1, rate: 16000 });
                    socketOpusDecoder.on('error', (err) => {
                        if (!decoderShuttingDown) {
                            Logger.ERROR('Opus decoder error: ' + err.message);
                        }
                    });
                    socketOpusDecoder.on('data', (pcmChunk: Buffer) => {
                        if (whisper) {
                            Logger.DEBUG(`[sockets] Calling whisper.feedAudio, chunk size: ${pcmChunk.length}`);
                            // Instead of feeding immediately, accumulate
                            pcmChunks.push(pcmChunk);
                        }
                    });
                }
                try {
                    socketOpusDecoder.write(data);
                } catch (err) {
                    Logger.ERROR('Error decoding audio data: ' + err);
                }
            } else {
                Logger.ERROR('Received invalid or empty audio data');
            }
        });

        socket.on('mic_end', async () => {
            if (socketOpusDecoder) {
                decoderShuttingDown = true;
                socketOpusDecoder.removeAllListeners();
                socketOpusDecoder.destroy();
                socketOpusDecoder = null;
            }
            // Write accumulated PCM to WAV file
            if (pcmChunks.length > 0) {
                const wavFile = path.join(TMP_DIR, `okuuai_${socket.id}.wav`);
                const fileWriter = new wav.FileWriter(wavFile, {
                    channels: 1,
                    sampleRate: 16000,
                    bitDepth: 16
                });
                for (const chunk of pcmChunks) {
                    fileWriter.write(chunk);
                }
                fileWriter.end();
                fileWriter.on('finish', () => {
                    Logger.DEBUG(`[sockets] WAV file written: ${wavFile}`);
                    // Now, feed the WAV file to Whisperer (you may need to adapt WhisperWorker to accept a file)
                    // For now, just log or implement as needed
                });
                pcmChunks = [];
            }
            const whisper = Whisperer.getInstance();
            whisper.stop(); // or finalize current transcription batch
        });


    });



    Logger.INFO('Socket server initialized');

    return io;
};
