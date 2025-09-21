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
  private runningProcesses: Set<any> = new Set(); // Track running whisper processes
  private pendingChunks = 0; // Track number of queued chunks
  private maxConcurrentProcesses = 1; // Limit concurrent processes to prevent model loading overhead
  private lastSentText: string = ''; // Track what text we've already sent to avoid duplicates

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

    Logger.DEBUG('Stopping whisper worker immediately...', 'WHISPER');
    this.isProcessing = false;
    this.pendingChunks = 0; // Reset pending chunks counter
    this.lastSentText = ''; // Reset text tracking for fresh start
    
    try {
      // Kill any running whisper processes immediately
      for (const process of this.runningProcesses) {
        try {
          process.kill('SIGTERM');
          Logger.DEBUG('Killed running whisper process', 'WHISPER');
        } catch (err) {
          Logger.DEBUG('Error killing whisper process: ' + err, 'WHISPER');
        }
      }
      this.runningProcesses.clear();
      
      // Wait for any ongoing processing to complete, but don't process remaining buffers
      await this.processingQueue;
      
      // Clear any remaining audio buffers without processing them
      this.audioBuffers = [];
      Logger.DEBUG('Cleared remaining audio buffers without processing', 'WHISPER');
      
    } catch (error) {
      Logger.DEBUG('Error during whisper stop: ' + error, 'WHISPER');
    } finally {
      // Always cleanup, even on error
      await this.cleanup();
    }
  }

  // Extract only the new text portion from a transcription result
  private extractNewText(fullText: string): string {
    const current = fullText.trim();
    
    if (!this.lastSentText) {
      // First transcription, send everything
      this.lastSentText = current;
      return current;
    }

    const lastSent = this.lastSentText.trim();
    
    // Skip if it's exactly the same
    if (current === lastSent) {
      return '';
    }

    // Method 1: Check if new text is simply appended (most common case)
    if (current.startsWith(lastSent)) {
      const newText = current.substring(lastSent.length).trim();
      if (newText) {
        this.lastSentText = current;
        Logger.DEBUG(`Found appended text: "${newText}"`, 'WHISPER');
        return newText;
      }
    }

    // Method 2: Find the longest common substring and extract what's after it
    // This handles cases where whisper might reformat or slightly change previous text
    const words1 = lastSent.split(/\s+/);
    const words2 = current.split(/\s+/);
    
    // Find the longest suffix of words1 that appears as a prefix in words2
    let maxOverlap = 0;
    let overlapStart = 0;
    
    for (let i = 0; i < words1.length; i++) {
      const suffix = words1.slice(i);
      if (words2.length >= suffix.length) {
        const prefix = words2.slice(0, suffix.length);
        if (suffix.join(' ') === prefix.join(' ') && suffix.length > maxOverlap) {
          maxOverlap = suffix.length;
          overlapStart = i;
        }
      }
    }
    
    if (maxOverlap > 0) {
      // Found overlap, extract words after the overlap
      const newWords = words2.slice(maxOverlap);
      if (newWords.length > 0) {
        const newText = newWords.join(' ');
        this.lastSentText = current;
        Logger.DEBUG(`Found overlapping text, extracting: "${newText}"`, 'WHISPER');
        return newText;
      }
    }

    // Method 3: If no clear overlap, but current is much longer, it might be new content
    if (current.length > lastSent.length * 1.3) {
      // Likely new content, send it but be cautious
      this.lastSentText = current;
      Logger.DEBUG(`Significantly longer text, treating as new: "${current}"`, 'WHISPER');
      return current;
    }

    // Method 4: Check if current contains most of lastSent (handle minor changes)
    const lastWords = lastSent.split(/\s+/);
    const currentWords = current.split(/\s+/);
    let matchingWords = 0;
    
    for (const word of lastWords) {
      if (currentWords.includes(word)) {
        matchingWords++;
      }
    }
    
    // If 70% of words match, consider it mostly the same content
    if (matchingWords / lastWords.length > 0.7) {
      // Look for new words not in the previous text
      const newWords = currentWords.filter(word => !lastWords.includes(word));
      if (newWords.length > 0) {
        const newText = newWords.join(' ');
        this.lastSentText = current;
        Logger.DEBUG(`Found new words in similar text: "${newText}"`, 'WHISPER');
        return newText;
      }
    }

    // No clear new content found
    Logger.DEBUG(`No new text detected. Last: "${lastSent}" | Current: "${current}"`, 'WHISPER');
    return '';
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
    
    // Process in larger chunks to reduce model loading overhead
    // Assuming 16kHz 16-bit mono audio = ~32KB per second
    const CHUNK_SIZE_BYTES = 192000; // ~6 seconds of audio to reduce model loading frequency
    const totalSize = this.audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
    
    if (totalSize >= CHUNK_SIZE_BYTES) {
      Logger.DEBUG(`Processing audio chunk: ${totalSize} bytes`, 'WHISPER');
      this.processAudioChunk();
    }
  }

  // Process current audio buffers as a chunk (non-blocking)
  private async processAudioChunk() {
    if (this.audioBuffers.length === 0) return;

    // Check if we have too many pending chunks - drop this one to prevent overload
    if (this.pendingChunks >= this.maxConcurrentProcesses) {
      Logger.DEBUG(`Dropping audio chunk - too many pending (${this.pendingChunks}/${this.maxConcurrentProcesses})`, 'WHISPER');
      return;
    }

    // Only process if we're not already processing and if we're still supposed to be processing
    if (!this.isProcessing) {
      Logger.DEBUG('Skipping audio chunk processing - worker stopped', 'WHISPER');
      return;
    }

    this.pendingChunks++;

    // Queue this processing to prevent overlapping operations
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        // Double-check we're still processing (might have stopped while waiting in queue)
        if (!this.isProcessing) {
          Logger.DEBUG('Skipping queued audio chunk - worker stopped', 'WHISPER');
          this.pendingChunks--;
          return;
        }

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

        // Final check before expensive whisper call
        if (!this.isProcessing) {
          Logger.DEBUG('Skipping whisper call - worker stopped', 'WHISPER');
          this.cleanupTempFile(tempAudioPath);
          return;
        }

        // Run whisper-cli on the audio file
        await this.transcribeAudioFile(tempAudioPath);
        
        // Cleanup temp file after processing
        this.cleanupTempFile(tempAudioPath);
        this.pendingChunks--;
        
      } catch (error) {
        this.pendingChunks--;
        Logger.DEBUG('Error processing audio chunk: ' + error, 'WHISPER');
      }
    }).catch(error => {
      this.pendingChunks--;
      Logger.DEBUG('Error in processing queue: ' + error, 'WHISPER');
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
      Logger.DEBUG('Error processing final audio buffers: ' + error, 'WHISPER');
      throw error; // Re-throw to let caller handle
    }
  }

  // Transcribe a single audio file using whisper-cli
  private async transcribeAudioFile(audioPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Validate input file exists
      if (!fs.existsSync(audioPath)) {
        const error = new Error(`Audio file not found: ${audioPath}`);
        Logger.DEBUG(error.message, 'WHISPER');
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

      // Track this process so we can kill it if needed
      this.runningProcesses.add(whisperProcess);

      let transcriptionOutput = '';
      let errorOutput = '';
      let timeoutHandle: NodeJS.Timeout;

      // Set timeout for whisper process (30 seconds max)
      const WHISPER_TIMEOUT = 30000;
      timeoutHandle = setTimeout(() => {
        Logger.DEBUG('Whisper process timeout, killing process', 'WHISPER');
        this.runningProcesses.delete(whisperProcess);
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
        // Remove from tracking when process completes
        this.runningProcesses.delete(whisperProcess);
        
        if (code === 0) {
          if (transcriptionOutput.trim()) {
            const cleaned = this.cleanTranscriptionOutput(transcriptionOutput);
            if (cleaned) {
              const newText = this.extractNewText(cleaned);
              if (newText) {
                Logger.DEBUG(`Emitting new text portion: "${newText}"`, 'WHISPER');
                this.emit('transcription', newText);
              } else {
                Logger.DEBUG(`No new text found, skipping emission`, 'WHISPER');
              }
            }
          }
          resolve();
        } else {
          const error = new Error(`Whisper process failed with code ${code}: ${errorOutput}`);
          Logger.DEBUG(error.message, 'WHISPER');
          reject(error);
        }
      });

      whisperProcess.on('error', (error: Error) => {
        clearTimeout(timeoutHandle);
        // Remove from tracking on error
        this.runningProcesses.delete(whisperProcess);
        Logger.DEBUG('Whisper process error: ' + error.message, 'WHISPER');
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
          Logger.DEBUG('Error cleaning up temp file: ' + error, 'WHISPER');
        }
      }
    }
    
    // Clean up current audio file if set
    if (this.currentAudioFile && fs.existsSync(this.currentAudioFile)) {
      try {
        fs.unlinkSync(this.currentAudioFile);
        Logger.DEBUG('Cleaned up current audio file: ' + this.currentAudioFile, 'WHISPER');
      } catch (error) {
        Logger.DEBUG('Error cleaning up current audio file: ' + error, 'WHISPER');
      }
    }
    
    this.tempFiles.clear();
    this.currentAudioFile = null;
    this.audioBuffers = [];
    this.lastSentText = ''; // Reset text tracking
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
      Logger.DEBUG('Error cleaning up temp file: ' + error, 'WHISPER');
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

  // Test method for verifying duplicate detection logic
  public testTextExtraction() {
    Logger.DEBUG('Testing text extraction logic...', 'WHISPER');
    
    // Reset state
    this.lastSentText = '';
    
    // Test 1: First text
    let result = this.extractNewText('Hello world');
    Logger.DEBUG(`Test 1 - First: "${result}" (expected: "Hello world")`, 'WHISPER');
    
    // Test 2: Appended text
    result = this.extractNewText('Hello world how are you');
    Logger.DEBUG(`Test 2 - Append: "${result}" (expected: "how are you")`, 'WHISPER');
    
    // Test 3: Same text (should be empty)
    result = this.extractNewText('Hello world how are you');
    Logger.DEBUG(`Test 3 - Same: "${result}" (expected: "")`, 'WHISPER');
    
    // Test 4: New sentence
    result = this.extractNewText('Hello world how are you today');
    Logger.DEBUG(`Test 4 - New word: "${result}" (expected: "today")`, 'WHISPER');
    
    // Test 5: Reset for new phrase
    this.lastSentText = '';
    result = this.extractNewText('Oregon! Oregon! Oregon!');
    Logger.DEBUG(`Test 5 - Chant: "${result}" (expected: "Oregon! Oregon! Oregon!")`, 'WHISPER');
    
    Logger.DEBUG('Text extraction test completed', 'WHISPER');
  }
}