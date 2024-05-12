import { Logger } from '@src/logger';
import path from 'path';
import { nodewhisper } from 'nodejs-whisper'

const voicesPath = path.resolve(__dirname, 'test');

export const initVoice = async (): Promise<void> => {
    Logger.DEBUG(`Voices path: ${voicesPath}`);
    const transcript = await nodewhisper(`${voicesPath}/1.wav`, {
        modelName: "small",
        withCuda: true,
        verbose: true
    });
    
    Logger.INFO(`Transcript: ${transcript}`); // output: [ {start,end,speech} ]

};