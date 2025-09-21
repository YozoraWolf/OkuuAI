import fs from 'fs';

/**
 * Audio format utilities for converting browser audio to whisper-compatible formats
 */

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

// Standard config for whisper (16kHz, mono, 16-bit)
export const WHISPER_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16
};

/**
 * Convert raw audio buffer to WAV format
 * @param audioBuffer Raw audio data (Float32Array or similar)
 * @param config Audio configuration
 * @returns WAV formatted buffer
 */
export function createWAVBuffer(audioBuffer: Buffer, config: AudioConfig = WHISPER_AUDIO_CONFIG): Buffer {
  const { sampleRate, channels, bitDepth } = config;
  const bytesPerSample = bitDepth / 8;
  const dataLength = audioBuffer.length;
  const bufferLength = 44 + dataLength; // WAV header is 44 bytes

  const wav = Buffer.alloc(bufferLength);
  let offset = 0;

  // WAV Header
  // RIFF chunk
  wav.write('RIFF', offset); offset += 4;
  wav.writeUInt32LE(bufferLength - 8, offset); offset += 4;
  wav.write('WAVE', offset); offset += 4;

  // fmt chunk
  wav.write('fmt ', offset); offset += 4;
  wav.writeUInt32LE(16, offset); offset += 4; // chunk size
  wav.writeUInt16LE(1, offset); offset += 2; // PCM format
  wav.writeUInt16LE(channels, offset); offset += 2;
  wav.writeUInt32LE(sampleRate, offset); offset += 4;
  wav.writeUInt32LE(sampleRate * channels * bytesPerSample, offset); offset += 4; // byte rate
  wav.writeUInt16LE(channels * bytesPerSample, offset); offset += 2; // block align
  wav.writeUInt16LE(bitDepth, offset); offset += 2;

  // data chunk
  wav.write('data', offset); offset += 4;
  wav.writeUInt32LE(dataLength, offset); offset += 4;

  // Copy audio data
  audioBuffer.copy(wav as any, offset);

  return wav;
}

/**
 * Convert Float32Array audio data to 16-bit PCM
 * @param float32Data Audio data as Float32Array
 * @returns Buffer with 16-bit PCM data
 */
export function float32ToPCM16(float32Data: Float32Array): Buffer {
  const pcm16 = Buffer.alloc(float32Data.length * 2);
  
  for (let i = 0; i < float32Data.length; i++) {
    // Clamp to [-1, 1] and convert to 16-bit signed integer
    const sample = Math.max(-1, Math.min(1, float32Data[i]));
    const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    pcm16.writeInt16LE(Math.round(pcmSample), i * 2);
  }
  
  return pcm16;
}

/**
 * Resample audio data to target sample rate (simple linear interpolation)
 * @param audioData Input audio buffer
 * @param fromRate Source sample rate
 * @param toRate Target sample rate
 * @returns Resampled audio buffer
 */
export function resampleAudio(audioData: Buffer, fromRate: number, toRate: number): Buffer {
  if (fromRate === toRate) return audioData;
  
  const ratio = fromRate / toRate;
  const inputSamples = audioData.length / 2; // Assuming 16-bit samples
  const outputSamples = Math.floor(inputSamples / ratio);
  const output = Buffer.alloc(outputSamples * 2);
  
  for (let i = 0; i < outputSamples; i++) {
    const sourceIndex = i * ratio;
    const sourceIndexFloor = Math.floor(sourceIndex);
    const sourceIndexCeil = Math.min(sourceIndexFloor + 1, inputSamples - 1);
    
    const sample1 = audioData.readInt16LE(sourceIndexFloor * 2);
    const sample2 = audioData.readInt16LE(sourceIndexCeil * 2);
    
    // Linear interpolation
    const fraction = sourceIndex - sourceIndexFloor;
    const interpolated = sample1 + (sample2 - sample1) * fraction;
    
    output.writeInt16LE(Math.round(interpolated), i * 2);
  }
  
  return output;
}

/**
 * Process raw browser audio data and convert to whisper-compatible WAV
 * @param rawData Raw audio data from browser
 * @param sourceConfig Source audio configuration
 * @returns WAV formatted buffer ready for whisper
 */
export function processAudioForWhisper(rawData: any, sourceConfig?: Partial<AudioConfig>): Buffer {
  let audioBuffer: Buffer;
  
  // Handle different input formats
  if (rawData instanceof Float32Array) {
    // Convert Float32Array to PCM16
    audioBuffer = float32ToPCM16(rawData);
  } else if (Buffer.isBuffer(rawData)) {
    // Already a buffer, use as-is
    audioBuffer = rawData;
  } else if (rawData instanceof ArrayBuffer) {
    // Convert ArrayBuffer to Buffer
    audioBuffer = Buffer.from(rawData);
  } else if (Array.isArray(rawData)) {
    // Array of numbers, convert to buffer
    audioBuffer = Buffer.from(rawData);
  } else {
    throw new Error('Unsupported audio data format');
  }
  
  // Apply resampling if needed
  if (sourceConfig?.sampleRate && sourceConfig.sampleRate !== WHISPER_AUDIO_CONFIG.sampleRate) {
    audioBuffer = resampleAudio(audioBuffer, sourceConfig.sampleRate, WHISPER_AUDIO_CONFIG.sampleRate);
  }
  
  // Create WAV format
  return createWAVBuffer(audioBuffer, WHISPER_AUDIO_CONFIG);
}