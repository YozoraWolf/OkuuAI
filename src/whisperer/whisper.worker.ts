import { spawn } from 'child_process';
import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';
import { getSystemTmpDir, WHISPER_BASE_DIR } from './whisper.config';
import { exec } from 'child_process';
import { Logger } from '../logger';
import { processAudioForWhisper } from './audio.utils';

export class WhisperWorker extends EventEmitter {
  private modelPath: string;
  private binaryPath: string;
  private isProcessing: boolean = false;
  private audioBuffers: Buffer[] = [];
  private currentAudioFile: string | null = null;
  private tempDir: string;
  private tempFiles: Set<string> = new Set(); // Track all temp files
  private processingQueue: Promise<void> = Promise.resolve(); // Serialize processing

  constructor(modelPath: string) {
    super();
    this.modelPath = modelPath;
    this.binaryPath = path.join(WHISPER_BASE_DIR, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli');
    if (!fs.existsSync(this.binaryPath)) {
      throw new Error(`Whisper binary not found at ${this.binaryPath}. Make sure it is built.`);
    }
    this.tempDir = getSystemTmpDir();
    
    // Setup cleanup on process exit
    process.on('exit', () => this.cleanupSync());
    process.on('SIGINT', () => this.cleanupSync());
    process.on('SIGTERM', () => this.cleanupSync());
  }

  async start() {
    if (this.isProcessing) {
      Logger.DEBUG('Whisper is already processing, skipping start', 'WHISPER');
      return;
    }

    // Initialize audio buffer collection
    this.audioBuffers = [];
    this.isProcessing = true;
    Logger.DEBUG('Whisper worker ready to receive audio data', 'WHISPER');
  }

  async stop() {
    if (!this.isProcessing) {
      Logger.DEBUG('Whisper worker not processing, nothing to stop', 'WHISPER');
      return;
    }

    Logger.DEBUG('Stopping whisper worker and processing final audio...', 'WHISPER');
    this.isProcessing = false;
    
    try {
      // Wait for any ongoing processing to complete
      await this.processingQueue;
      
      // Process any remaining audio buffers
      if (this.audioBuffers.length > 0) {
        await this.processAudioBuffers();
      }
      
    } catch (error) {
      Logger.ERROR('Error during whisper stop: ' + error);
    } finally {
      // Always cleanup, even on error
      await this.cleanup();
    }
  }

  onTranscription(callback: (text: string) => void) {
    this.on('transcription', callback);
  }

  // Add audio data to buffer for processing
  addAudioData(audioData: Buffer) {
    if (!this.isProcessing) {
      Logger.DEBUG('Whisper worker not processing, ignoring audio data', 'WHISPER');
      return;
    }
    this.audioBuffers.push(audioData);
    
    // Process in smaller chunks for more responsive real-time transcription
    // Assuming 16kHz 16-bit mono audio = ~32KB per second
    const CHUNK_SIZE_BYTES = 96000; // ~3 seconds of audio for better context while staying responsive
    const totalSize = this.audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
    
    if (totalSize >= CHUNK_SIZE_BYTES) {
      Logger.DEBUG(`Processing audio chunk: ${totalSize} bytes`, 'WHISPER');
      this.processAudioChunk();
    }
  }

  // Process current audio buffers as a chunk (non-blocking)
  private async processAudioChunk() {
    if (this.audioBuffers.length === 0) return;

    // Queue this processing to prevent overlapping operations
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        // Take current buffers but keep some overlap for context
        const buffersToProcess = [...this.audioBuffers];
        
        // Keep last 25% of buffers for context in next chunk
        const overlapSize = Math.floor(buffersToProcess.length * 0.25);
        this.audioBuffers = buffersToProcess.slice(-overlapSize);

        if (buffersToProcess.length === 0) return;

        // Combine audio buffers into a single file
        const combinedAudio = Buffer.concat(buffersToProcess as any);
        
        // Process audio for whisper (convert to proper WAV format)
        const wavAudio = processAudioForWhisper(combinedAudio);
        
        const tempAudioPath = path.join(this.tempDir, `whisper_chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`);
        
        // Track temp file
        this.tempFiles.add(tempAudioPath);
        
        // Write WAV audio to temp file
        fs.writeFileSync(tempAudioPath, wavAudio as any);

        // Run whisper-cli on the audio file
        await this.transcribeAudioFile(tempAudioPath);
        
        // Cleanup temp file after processing
        this.cleanupTempFile(tempAudioPath);
        
      } catch (error) {
        Logger.ERROR('Error processing audio chunk: ' + error);
      }
    }).catch(error => {
      Logger.ERROR('Error in processing queue: ' + error);
    });
  }

  // Process accumulated audio buffers through whisper-cli
  private async processAudioBuffers(): Promise<void> {
    if (this.audioBuffers.length === 0) return;

    try {
      // Combine all audio buffers into a single file
      const combinedAudio = Buffer.concat(this.audioBuffers as any);
      
      // Process audio for whisper (convert to proper WAV format)
      const wavAudio = processAudioForWhisper(combinedAudio);
      
      const tempAudioPath = path.join(this.tempDir, `whisper_final_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`);
      
      // Track temp file
      this.tempFiles.add(tempAudioPath);
      
      // Write WAV audio to temp file
      fs.writeFileSync(tempAudioPath, wavAudio as any);
      this.currentAudioFile = tempAudioPath;

      // Run whisper-cli on the audio file
      await this.transcribeAudioFile(tempAudioPath);
      
    } catch (error) {
      Logger.ERROR('Error processing final audio buffers: ' + error);
      throw error; // Re-throw to let caller handle
    }
  }

  // Transcribe a single audio file using whisper-cli
  private async transcribeAudioFile(audioPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Validate input file exists
      if (!fs.existsSync(audioPath)) {
        const error = new Error(`Audio file not found: ${audioPath}`);
        Logger.ERROR(error.message);
        reject(error);
        return;
      }

      const whisperProcess = spawn(this.binaryPath, [
        '-m', this.modelPath,
        '-f', audioPath,
        '--output-txt', // Output as plain text
        '--no-timestamps', // No timestamps in output
        '-t', '6', // threads
        '--language', 'en', // Force English for better performance
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let transcriptionOutput = '';
      let errorOutput = '';
      let timeoutHandle: NodeJS.Timeout;

      // Set timeout for whisper process (30 seconds max)
      const WHISPER_TIMEOUT = 30000;
      timeoutHandle = setTimeout(() => {
        Logger.ERROR('Whisper process timeout, killing process');
        whisperProcess.kill('SIGKILL');
        reject(new Error('Whisper process timeout'));
      }, WHISPER_TIMEOUT);

      whisperProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output) {
          transcriptionOutput += output;
        }
      });

      whisperProcess.stderr.on('data', (data: Buffer) => {
        const stderr = data.toString().trim();
        errorOutput += stderr;
        Logger.DEBUG('Whisper stderr: ' + stderr, 'WHISPER');
      });

      whisperProcess.on('close', (code: number) => {
        clearTimeout(timeoutHandle);
        
        if (code === 0) {
          if (transcriptionOutput.trim()) {
            const cleaned = this.cleanTranscriptionOutput(transcriptionOutput);
            if (cleaned) {
              this.emit('transcription', cleaned);
            }
          }
          resolve();
        } else {
          const error = new Error(`Whisper process failed with code ${code}: ${errorOutput}`);
          Logger.ERROR(error.message);
          reject(error);
        }
      });

      whisperProcess.on('error', (error: Error) => {
        clearTimeout(timeoutHandle);
        Logger.ERROR('Whisper process error: ' + error.message);
        reject(error);
      });
    });
  }

  // Cleanup temporary files
  private async cleanup(): Promise<void> {
    // Clean up all tracked temp files
    for (const tempFile of this.tempFiles) {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
          Logger.DEBUG('Cleaned up temp audio file: ' + tempFile, 'WHISPER');
        } catch (error) {
          Logger.ERROR('Error cleaning up temp file: ' + error);
        }
      }
    }
    
    // Clean up current audio file if set
    if (this.currentAudioFile && fs.existsSync(this.currentAudioFile)) {
      try {
        fs.unlinkSync(this.currentAudioFile);
        Logger.DEBUG('Cleaned up current audio file: ' + this.currentAudioFile, 'WHISPER');
      } catch (error) {
        Logger.ERROR('Error cleaning up current audio file: ' + error);
      }
    }
    
    this.tempFiles.clear();
    this.currentAudioFile = null;
    this.audioBuffers = [];
  }

  // Synchronous cleanup for process exit handlers
  private cleanupSync(): void {
    try {
      for (const tempFile of this.tempFiles) {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
      if (this.currentAudioFile && fs.existsSync(this.currentAudioFile)) {
        fs.unlinkSync(this.currentAudioFile);
      }
    } catch (error) {
      // Silently fail during cleanup on exit
    }
  }

  // Clean up a specific temp file and remove from tracking
  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        Logger.DEBUG('Cleaned up temp file: ' + filePath, 'WHISPER');
      }
      this.tempFiles.delete(filePath);
    } catch (error) {
      Logger.ERROR('Error cleaning up temp file: ' + error);
    }
  }

  static async checkRunningProcesses() {
    return new Promise<string>((resolve) => {
      const binaryName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
      const checkCommand = process.platform === 'win32' 
        ? `tasklist | findstr ${binaryName}` 
        : `ps aux | grep ${binaryName} | grep -v grep`;
        
      exec(checkCommand, (error, stdout) => {
        if (error) {
          resolve('No whisper processes found');
        } else {
          resolve(stdout || 'No whisper processes found');
        }
      });
    });
  }

  private cleanTranscriptionOutput(output: string): string {
    // Clean whisper-cli output (much simpler than whisper-stream)
    let cleaned = output
      // Remove leading/trailing whitespace
      .trim()
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Remove any remaining markers that might appear
      .replace(/\[.*?\]/g, '')
      .trim();

    // Only return if there's actual speech content
    if (cleaned.length > 0) {
      return cleaned;
    }
    
    return '';
  }
}