import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { Core } from "./core";
import { SESSION_ID, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";
import { handleUserInput } from "./console";
import prism from 'prism-media';

let io: Server;
const TMP_DIR = "/tmp";

// whisper related

import { Whisperer } from './whisperer';
import { sendChat } from "./chat";

let whisper: Whisperer;
const opusDecoder = new prism.opus.Decoder({ frameSize: 960, channels: 1, rate: 16000 });

// Initialize Whisperer once (e.g., when server starts)
export const initWhisper = async () => {
    whisper = new Whisperer('/path/to/whisper_cpp/models/ggml-base.en.bin');
    await whisper.init();

    // Listen for partial transcripts
    whisper.onTranscription(async (text: string) => {
        Logger.DEBUG('Whisper transcription: ' + text);

        // You can now send this text to OllamaJS
        //const reply = await sendChat(text);
        // Broadcast back to clients if needed
        //io.emit('chat:reply', { transcript: text, reply });
    });
};

export const setupSockets = (server: HTTPServer) => {
    io = new Server(server, {
        pingInterval: 10000,
        pingTimeout: 5000,
    }
    );

    io.on('connection', (socket) => {
        Logger.INFO('A client connected: ' + socket.id);

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

        // Will handle user audio input to whisper.cpp (nodejs-whisper) to sendChat
        socket.on('mic', (data: any) => {
            Logger.DEBUG('Received audio data');
            if (data && data.length) {
                Logger.DEBUG(`Audio data size: ${data.length} bytes`);

                // Forward audio to Whisperer
                if (whisper) {
                    // Write the Opus data to the decoder stream
                    opusDecoder.write(data);

                    // Listen for decoded PCM data
                    opusDecoder.once('data', (pcmChunk: Buffer) => {
                        whisper.feedAudio(pcmChunk);
                    });
                }
            } else {
                Logger.ERROR('Received empty audio data');
            }
        });

        socket.on('mic_end', () => {
            whisper.stop(); // or finalize current transcription batch
        });


    });



    Logger.INFO('Socket server initialized');

    return io;
};
