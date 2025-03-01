import fs from 'fs';
import axios, { AxiosResponse } from 'axios';
import { exec } from 'child_process';
import { Logger } from './logger';

// Assistant Configuration
const assistantConfigFile = 'assistant.json';

const defaultAssistantConfig = {
    name: "assistant",
    system_prompt: "You are an intelligent AI assistant.",
    model: "llama3",
    template: ""
};

export const loadAssistantConfig = () => {
    if (!fs.existsSync(assistantConfigFile)) {
        Logger.WARN(`Failed to load ${assistantConfigFile} file. Creating new one...`);
        fs.writeFileSync(assistantConfigFile, JSON.stringify(defaultAssistantConfig, null, 2));
        return defaultAssistantConfig;
    } else {
        Logger.INFO(`Loading assistant configuration from ${assistantConfigFile} file...`);
        return JSON.parse(fs.readFileSync(assistantConfigFile, 'utf8'));
    }
};

export const updateAssistantConfigJSON = (config: any) => {
    try {
        const existingConfig = JSON.parse(fs.readFileSync(assistantConfigFile, 'utf8'));
        const updatedConfig = { ...existingConfig, ...config };
        fs.writeFileSync(assistantConfigFile, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
        Logger.ERROR(`Failed to update assistant.json file\n${error}`);
    }
};

export const downloadFile = async (url: string, filePath: string): Promise<any> => {
  const response: AxiosResponse<ReadableStream> = await axios({
    method: 'get',
    url: url,
    responseType: 'arraybuffer',
    maxRedirects: 5, // up to 5 redirects
    onDownloadProgress: (progressEvent) => {
      const totalBytes: number = progressEvent.total ?? 0;
      const downloadedBytes: number = progressEvent.loaded;
      const progress: number = Math.floor((downloadedBytes / totalBytes) * 100);

      // Calculate minimum progress bar width based on desired length (adjust as needed)
      const minProgressBarWidth = 50; // You can change this value
      const availableSpace = process.stdout.columns - minProgressBarWidth - 45; // Account for other text and margins
      const maxFileNameLength = availableSpace > 0 ? availableSpace : 0;
      const truncatedFilePath = filePath.length > maxFileNameLength ? filePath.substring(0, maxFileNameLength) + "..." : filePath;
      const progressBarWidth = Math.max(minProgressBarWidth, process.stdout.columns - truncatedFilePath.length - 25);

      const progressBar = `[ ${'\x1b[32m|'.repeat(Math.floor(progress / (100 / progressBarWidth)))}${' '.repeat(progressBarWidth - Math.floor(progress / (100 / progressBarWidth)))} \x1b[0m]`;

      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`Downloading ${progressBar} ${progress}% - ${truncatedFilePath}`);
    },
  });

  const fileStream: fs.WriteStream = fs.createWriteStream(filePath);

  const readableStream: any = response.data;

  return new Promise<any>((resolve, reject) => {
    readableStream.on('error', (err: Error) => {
      reject(err);
    });

    fileStream.on('finish', () => {
      process.stdout.write('\n');
      resolve(true);
    });

    readableStream.pipe(fileStream);
  });
};

export const checkOllamaService = async () => {
  return new Promise<void>((resolve, reject) => {
    
    // define the service name
    const serviceName: string = 'ollama';

    // check if the service is active
    exec(`systemctl is-active ${serviceName}`, (error: any) => {
      if (!error) {
        Logger.DEBUG(`${serviceName} is already active`);
        resolve();
        return;
      }

      if (error.code !== 3 && error.code !== 0) {
        Logger.ERROR(`Error checking status of ${serviceName}: ${error}`);
        reject(error);
        return;
      }

      if (error.code === 3) {
        // if the service is not active, start it
        exec(`sudo systemctl enable ${serviceName} && sudo systemctl start ${serviceName}`, (startError) => {
          if (startError) {
            Logger.ERROR(`Error starting ${serviceName}: ${startError.message}`);
            reject(startError);
            return;
          }
          Logger.DEBUG(`Started ${serviceName}`);
          resolve();
        });
      }
    });
  });
};

export const doesModelExistInOllama = async (modelName: string) => {
  const response = await axios.get(
    `https://ollamadb.dev/api/v1/models?search=${encodeURIComponent(modelName)}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.length > 0;
};