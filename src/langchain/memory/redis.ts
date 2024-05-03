// This will be in charge of making sure redis is up and running.

import { exec } from "child_process";
import { Logger } from "../../logger";

const REDIS_PORT = process.env.REDIS_PORT || '6379';
const REDIS_PWD = process.env.REDIS_PWD;

export const initRedis = async () => {
    // Pull redis docker image
    Logger.INFO('Pulling redis image...');
    await pullRedisDocker();
    Logger.INFO('Checking redis container status...');
    const res = await runRedisDocker();
    if (res === 2) {
        Logger.INFO('Redis docker container already exists, restarting container...');
        await restartRedisDocker();
    } else if (res === 1) {
        Logger.ERROR('Error occurred while starting redis docker container!');
        process.exit(1);
    }
    Logger.INFO(`Redis initialized successfully!`);
};

const restartRedisDocker = async () => {
    // Restart redis docker container
    return new Promise<boolean>((resolve, reject) => {
        exec('docker restart redis', (error, stdout, stderr) => {
            if (error) {
                Logger.ERROR(`Error occurred while restarting redis: ${error.message}`);
                reject(false);
            }
            if (stderr) {
                Logger.ERROR(`stderr: ${stderr}`);
                reject(false);
            }
            Logger.INFO(`redis container restarted successfully!`);
            resolve(true);
        });
    });
};

const runRedisDocker = async () => {
    // Run redis docker container
    return new Promise<number>((resolve, reject) => {
        exec(`docker run --name okuu_redis -d -e REDIS_PASSWORD=${REDIS_PWD} -p ${REDIS_PORT}:6379 redis`, (_, __, stderr) => {
            if (stderr.includes('Conflict. The container name "/okuu_redis" is already in use by container')) {
                resolve(2);
            } else if (stderr) {
                Logger.ERROR(`stderr: ${stderr}`);
                reject(1);
            }
            Logger.INFO(`Redis docker container started successfully!`);
            resolve(0);
        });
    });
};

const pullRedisDocker = async () => {
    // Pull redis docker image
    return new Promise<boolean>((resolve, reject) => {
        exec('docker pull redis', (error, _, stderr) => {
            if (error) {
                Logger.ERROR(`Error occurred while pulling redis image: ${error.message}`);
                reject(false);
            }
            if (stderr) {
                Logger.ERROR(`stderr: ${stderr}`);
                reject(false);
            }
            Logger.INFO(`redis image pulled successfully!`);
            resolve(true);
        });
    });
};