// This will be in charge of making sure redis is up and running.

import { exec } from "child_process";
import { ConsoleColor, Logger } from "@src/logger";
import Redis from "ioredis";

const REDIS_PORT: number = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PWD = process.env.REDIS_PWD;
export const REDIS_URL = `redis://default:${REDIS_PWD}@localhost:${REDIS_PORT}/0`;

export let redisClientMemory: Redis;
export let redisClientRAG: Redis;

const hanldeRedisError = (error: any) => {
    if(error === null) return;
    if(error.code === "ECONNREFUSED") {
        Logger.ERROR("Redis Memory Client error: Redis is not running!");
    } else if (error.code.includes("EPIPE")) {
        Logger.ERROR("Redis Memory Client error: Check credentials");
    }
};

export const initRedis = async () => {
    // Pull redis docker image
    Logger.INFO('Pulling redis image...');
    await pullRedisDocker();
    Logger.INFO('Checking redis container status...');
    const res = await runRedisDocker();
    if (res === 2) {
        //Logger.INFO('Redis docker container already exists, restarting container...');
        //await restartRedisDocker();
    } else if (res === 1) {
        Logger.ERROR('Error occurred while starting redis docker container!');
        process.exit(1);
    }
    Logger.INFO(`${ConsoleColor.FgGreen}Redis initialized successfully!`);
    Logger.INFO(`${ConsoleColor.FgYellow}-------------------------------`);
    
    // create and connect redis client to db
    Logger.DEBUG(`Connecting Redis Client to: ${REDIS_URL}`);
    redisClientMemory = await new Redis({
        port: REDIS_PORT, // Redis port
        host: "localhost", // Redis host
        username: "default", // needs Redis >= 6
        password: REDIS_PWD,
        db: 0
      });    
      
 /*      redisClientRAG = await new Redis({
        port: REDIS_PORT, // Redis port
        host: "localhost", // Redis host
        username: "default", // needs Redis >= 6
        password: REDIS_PWD,
        db: 1
      }); */

      Logger.DEBUG(`Redis client connected successfully!`);

    redisClientMemory.on('error', (error: any) => {
        Logger.ERROR(`Redis Memory Client error: ${error}`);
        hanldeRedisError(error);
    });
    
/*     redisClientRAG.on('error', (error: any) => {
        Logger.ERROR(`Redis RAG Client error: ${error}`);
        hanldeRedisError(error);
    }); */
};

const restartRedisDocker = async () => {
    // Restart redis docker container
    return new Promise<boolean>((resolve, reject) => {
        exec('docker restart okuu_redis', (error, stdout, stderr) => {
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