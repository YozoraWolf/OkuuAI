import { createClient, RedisClientType } from 'redis';

const REDIS_PORT: number = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PWD = process.env.REDIS_PWD;
export const REDIS_URL = `redis://default:${REDIS_PWD}@localhost:${REDIS_PORT}/0`;

export let redisClientMemory: RedisClientType;

export const initRedis = () => {
    console.log("URL: ", REDIS_URL);
    redisClientMemory = createClient({
        url: REDIS_URL
      });
    redisClientMemory.connect();
}