import { ConsoleColor, Logger } from '@src/logger';
import { spawn } from 'child_process';
import { Ollama } from 'ollama';
import { exit } from 'process';
import cliProgress from 'cli-progress';

// Containers to monitor
const containers = { "ollama": "okuuai_ollama", "redis": "okuuai_redis" };

/**
 * Starts containers using `docker-compose` and monitors their status.
 */
export async function startAndMonitorContainers() {
  Logger.INFO('Starting containers with docker-compose...');
  let dockerCompose;
  try {
    // Run `docker-compose up` command
    dockerCompose = spawn('docker', ['compose', 'up', "-d"], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error: any) {
    if(error.code === 'ENOENT') {
        Logger.ERROR('Error: Docker is not installed.');
    } else {
        Logger.ERROR('Error starting containers: '+ error);
    }
    exit(1);
  }

  let output = '';
  let loadingIntervals: { [key: string]: NodeJS.Timeout } = {};

  // Collect output from stdout
  dockerCompose.stdout.on('data', data => {
    output += data.toString();
  });

  // Collect output from stderr
  dockerCompose.stderr.on('data', data => {
    output += data.toString();
  });

  // Start loading animation for each container
  Object.keys(containers).forEach(container => {
    loadingIntervals[container] = startLoadingAnimation(container);
  });

  // Promisify the dockerCompose process
  await new Promise<void>((resolve, reject) => {
    dockerCompose.on('close', code => {
      clearAllLoadingAnimations(loadingIntervals);  // Stop all loading animations
      if (code === 0) {
        Logger.INFO(`${ConsoleColor.FgGreen}Docker Compose executed successfully.`);
        parseDockerComposeOutput(output);
        resolve();
      } else {
        Logger.ERROR(`Docker Compose failed with exit code ${code}.`);
        reject(new Error(`Docker Compose failed with exit code ${code}.`));
      }
    });
  });
}

export const runModel = async (model_name: string) => {

  const ollama = new Ollama({ host: `http://127.0.0.1:${process.env.OLLAMA_PORT}` });

  const list = await ollama.list();
  const models = list.models;
  if (models.some(model => model.name.includes(model_name))) {
    Logger.INFO(`Model ${ConsoleColor.FgBlue}${model_name}${ConsoleColor.Reset} already exists.`);
    return;
  }

  Logger.INFO(`Pulling model: ${model_name} ...`);
  const ps = await ollama.list();
  console.log(ps);
  const stream = await ollama.pull({ model: model_name, stream: true });
  const bar1 = new cliProgress.SingleBar({
    format: `Progress [${ConsoleColor.FgYellow} {bar} ] ${ConsoleColor.Reset}{percentage}% | ETA: {eta}s`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });
  
  bar1.start(100, 0); // Assuming 100 as the total progress value

  try {
    for await (const data of stream) {
      // Update progress bar based on data received from the stream
      const progress = parseProgress(data);
      bar1.update(progress);
    }
    bar1.stop();
    Logger.INFO(`Model ${model_name} ran successfully.`);
  } catch (error: any) {
    bar1.stop();
    Logger.ERROR(`Error running model: ${error.message}`);
  }
}

/**
 * Parses the progress value from the stream data.
 * @param {any} data - The data received from the stream.
 * @returns {number} The progress value.
 */
function parseProgress(data: any): number {
  if (data.total && data.completed) {
    return Math.floor((data.completed / data.total) * 100);
  }
  return 0;
}

/**
 * Starts a loading animation (rotating line) for a specific container.
 * @param {string} container - The container name.
 * @returns {NodeJS.Timeout} The interval ID for clearing the animation later.
 */
function startLoadingAnimation(container: string) {
  const spinnerChars = ['|', '/', '-', '\\'];
  let currentCharIndex = 0;

  // Display container-specific loading message
  return setInterval(() => {
    process.stdout.write(`\r${container} loading ${spinnerChars[currentCharIndex]}  `);
    currentCharIndex = (currentCharIndex + 1) % spinnerChars.length;
  }, 100);
}

/**
 * Clears all active loading animations.
 */
function clearAllLoadingAnimations(loadingIntervals: { [key: string]: NodeJS.Timeout }) {
  Object.values(loadingIntervals).forEach(clearInterval);
  process.stdout.write('\n');  // Move to the next line
}

/**
 * Parses the output from `docker-compose` and checks for container statuses.
 * @param {string} output - The output from `docker-compose up`.
 */
function parseDockerComposeOutput(output: string) {
  Logger.DEBUG('Parsing Docker Compose output...');
  const successMessages = Object.values(containers).map(container =>
    new RegExp(`${container}\\s+(Running|Started)`, 'i')
  );

  successMessages.forEach((regex, index) => {
    if (regex.test(output)) {
      Logger.INFO(`${ConsoleColor.FgGreen}✅ Container "${Object.keys(containers)[index]}" started successfully.`);
    } else {
      Logger.WARN(`${ConsoleColor.FgYellow}⚠️  Container "${Object.keys(containers)[index]}" may not have started.`);
    }
  });
}
