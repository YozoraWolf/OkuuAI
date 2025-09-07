import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import EventEmitter from 'events';

export class WhisperWorker extends EventEmitter {
  private process!: ChildProcessWithoutNullStreams;
  private modelPath: string;

  constructor(modelPath: string) {
    super();
    this.modelPath = modelPath;
  }

  start() {
    return new Promise<void>((resolve, reject) => {
      this.process = spawn('./whisper_cpp/main', [
        '-m', this.modelPath,
        '-otxt'
      ]);

      this.process.stdout.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) this.emit('transcription', text);
      });

      this.process.on('error', reject);
      this.process.on('spawn', resolve);
    });
  }

  feedAudio(chunk: Buffer) {
    // whisper.cpp streaming expects PCM 16-bit 16kHz
    this.process.stdin.write(chunk);
  }

  onTranscription(callback: (text: string) => void) {
    this.on('transcription', callback);
  }

  stop() {
    return new Promise<void>((resolve) => {
      this.process.stdin.end();
      this.process.on('close', () => resolve());
    });
  }
}