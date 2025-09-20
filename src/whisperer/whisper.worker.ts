import { spawn } from 'child_process';
import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';
import { getSystemTmpDir, WHISPER_BASE_DIR } from './whisper.config';
import { exec } from 'child_process';
import { Logger } from '../logger';

export class WhisperWorker extends EventEmitter {
  private modelPath: string;
  private binaryPath: string;
  private isRunning: boolean = false;
  private whisperProcess: any = null;

  constructor(modelPath: string) {
    super();
    this.modelPath = modelPath;
    this.binaryPath = path.join(WHISPER_BASE_DIR, process.platform === 'win32' ? 'whisper-stream.exe' : 'whisper-stream');
    if (!fs.existsSync(this.binaryPath)) {
      throw new Error(`Whisper binary not found at ${this.binaryPath}. Make sure it is built.`);
    }
  }

  async start() {
    if (this.isRunning) {
      Logger.DEBUG('Whisper is already running, skipping start', 'WHISPER');
      return;
    }

    // Kill any existing whisper-stream processes
    await this.killExistingProcesses();

    this.isRunning = true;

    // Start whisper-stream process for real-time transcription
    this.whisperProcess = spawn(this.binaryPath, [
      '-m', this.modelPath,
      '-t', '6', // threads
      '--step', '0', // sliding window mode with VAD
      '--length', '60000', // 60 seconds
      '-vth', '0.6', // VAD threshold
    ], {
      stdio: ['pipe', 'pipe', 'pipe'] // capture stderr to silence it
    });

    this.whisperProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        // Filter and clean the whisper-stream output
        const cleaned = this.cleanTranscriptionOutput(output);
        if (cleaned) {
          this.emit('transcription', cleaned);
        }
      }
    });

    this.whisperProcess.stderr.on('data', (data: Buffer) => {
      // Only show whisper stderr output in verbose mode
      Logger.DEBUG('Whisper stderr: ' + data.toString(), 'WHISPER');
    });

    this.whisperProcess.on('close', (code: number) => {
      Logger.DEBUG(`Whisper process exited with code ${code}`, 'WHISPER');
      this.isRunning = false;
    });

    this.whisperProcess.on('error', (error: Error) => {
      // Only log critical whisper process errors
      Logger.ERROR('Whisper process error: ' + error.message);
      this.isRunning = false;
    });
  }

  async stop() {
    if (this.whisperProcess && this.isRunning) {
      Logger.DEBUG('Stopping whisper process...', 'WHISPER');
      this.isRunning = false;
      
      // Try graceful shutdown first
      this.whisperProcess.kill('SIGTERM');
      
      // Force kill after 2 seconds if still running
      setTimeout(() => {
        if (this.whisperProcess && !this.whisperProcess.killed) {
          Logger.DEBUG('Force killing whisper process...', 'WHISPER');
          this.whisperProcess.kill('SIGKILL');
        }
        this.whisperProcess = null;
      }, 2000);
    }
  }

  onTranscription(callback: (text: string) => void) {
    this.on('transcription', callback);
  }

  private async killExistingProcesses() {
    return new Promise<void>((resolve) => {
      const binaryName = process.platform === 'win32' ? 'whisper-stream.exe' : 'whisper-stream';
      const killCommand = process.platform === 'win32' 
        ? `taskkill /f /im ${binaryName}` 
        : `pkill -f ${binaryName}`;
        
      exec(killCommand, (error) => {
        if (error) {
          Logger.DEBUG('No existing whisper processes found (or error killing them): ' + error.message, 'WHISPER');
        } else {
          Logger.DEBUG('Killed existing whisper processes', 'WHISPER');
        }
        resolve();
      });
    });
  }

  static async checkRunningProcesses() {
    return new Promise<string>((resolve) => {
      const binaryName = process.platform === 'win32' ? 'whisper-stream.exe' : 'whisper-stream';
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
    // Remove all the metadata and formatting from whisper-stream output
    let cleaned = output
      // Remove transcription markers and metadata
      .replace(/### Transcription \d+ START \| t\d+ = \d+ ms \| t\d+ = \d+ ms/g, '')
      .replace(/### Transcription \d+ END/g, '')
      // Remove timestamps in [HH:MM:SS.mmm --> HH:MM:SS.mmm] format
      .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]/g, '')
      // Remove sound/blank markers
      .replace(/\[SOUND\]/g, '')
      .replace(/\[BLANK_AUDIO\]/g, '')
      .replace(/\[Start speaking\]/g, '')
      // Remove parenthetical content like (crowd cheering)
      .replace(/\([^)]*\)/g, '')
      // Remove timestamps in other formats
      .replace(/\| t\d+ = \d+ ms/g, '')
      // Remove multiple spaces and clean up
      .replace(/\s+/g, ' ')
      .trim();

    // Only return if there's actual speech content (not just metadata)
    if (cleaned.length > 0 && !cleaned.match(/^[\s\[\]()]+$/)) {
      return cleaned;
    }
    
    return '';
  }
}