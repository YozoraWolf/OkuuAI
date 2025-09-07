import { WhisperWorker } from './whisperWorker';

export class Whisperer {
  private worker: WhisperWorker;

  constructor(modelPath: string) {
    this.worker = new WhisperWorker(modelPath);
  }

  async init() {
    await this.worker.start();
  }

  // Accept audio chunks from Socket.IO
  feedAudio(chunk: Buffer) {
    this.worker.feedAudio(chunk);
  }

  // Event listener for partial transcription
  onTranscription(callback: (text: string) => void) {
    this.worker.onTranscription(callback);
  }

  async stop() {
    await this.worker.stop();
  }
}