import { spawn } from 'child_process';
import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';
import wav from 'wav';
import { TMP_DIR, WHISPER_BASE_DIR } from './whisper.config';

export class WhisperWorker extends EventEmitter {
  private modelPath: string;
  private binaryPath: string;
  private pcmBuffer: Uint8Array = new Uint8Array(0);
  private minBufferMs: number = 2000; // 2 seconds of audio before transcribing
  private sampleRate: number = 16000;
  private channels: number = 1;
  private bitDepth: number = 16;
  private isTranscribing: boolean = false;

  constructor(modelPath: string) {
    super();
    this.modelPath = modelPath;
    this.binaryPath = path.join(WHISPER_BASE_DIR, 'build', 'bin', 'whisper-cli');
    if (!fs.existsSync(this.binaryPath)) {
      throw new Error(`Whisper binary not found at ${this.binaryPath}. Make sure it is built.`);
    }
  }

  async start() {
    // nothing to do for file-based mode
  }

  feedAudio(chunk: Buffer) {
    // Convert incoming Buffer to Uint8Array
    const chunkArray = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);

    // Concatenate manually
    const combined = new Uint8Array(this.pcmBuffer.length + chunkArray.length);
    combined.set(this.pcmBuffer, 0);
    combined.set(chunkArray, this.pcmBuffer.length);
    this.pcmBuffer = combined;

    const bytesPerMs = this.sampleRate * this.channels * (this.bitDepth / 8) / 1000;
    if (this.pcmBuffer.length >= this.minBufferMs * bytesPerMs && !this.isTranscribing) {
      this.transcribeBuffer();
    }
  }

  private async transcribeBuffer() {
    this.isTranscribing = true;

    const wavFile = path.join(
      TMP_DIR,
      `stream_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
    );

    // Convert Uint8Array to Node Buffer for writing to wav
    const bufferToWrite = Buffer.from(this.pcmBuffer);

    await new Promise<void>((resolve, reject) => {
      const writer = new wav.FileWriter(wavFile, {
        channels: this.channels,
        sampleRate: this.sampleRate,
        bitDepth: this.bitDepth,
      });

      writer.write(bufferToWrite);
      writer.end();
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const proc = spawn(this.binaryPath, [
      '-m', this.modelPath,
      '-otxt',
      '-l', 'en',
      wavFile
    ]);

    let output = '';
    proc.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      // console.error('Whisper stderr:', data.toString());
    });

    proc.on('close', () => {
      if (output.trim()) {
        this.emit('transcription', output.trim());
      }

      fs.unlink(wavFile, () => { });

      // Reset the buffer as Uint8Array
      this.pcmBuffer = new Uint8Array(0);
      this.isTranscribing = false;
    });
  }


  onTranscription(callback: (text: string) => void) {
    this.on('transcription', callback);
  }

  async stop() {
    // nothing to do for file-based mode
  }
}