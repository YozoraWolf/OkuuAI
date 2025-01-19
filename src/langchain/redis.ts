import { Logger } from '@src/logger';
import { Ollama } from 'ollama';
import { createClient, RedisClientType, SchemaFieldTypes, VectorAlgorithms } from 'redis';

const REDIS_PORT: number = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PWD = process.env.REDIS_PWD;
export const REDIS_URL = `redis://default:${REDIS_PWD}@localhost:${REDIS_PORT}/0`;

export let redisClientMemory: RedisClientType;

export const initRedis = async () => {
    console.log("URL: ", REDIS_URL);
    redisClientMemory = createClient({
        url: REDIS_URL
      });
    await redisClientMemory.connect();
    await createMemoryIndex();
}

async function createMemoryIndex() {
  try {
    const indexInfo = await redisClientMemory.ft.info('idx:memories');
    Logger.DEBUG('Memory index info: ' + JSON.stringify(indexInfo));

    // Check for dimension mismatch or other issues
    const embeddingAttr = indexInfo['attributes']?.find(attr => attr.name === 'embedding');
    if (embeddingAttr && Number(embeddingAttr.dim) !== 768) {
      Logger.WARN('Dimension mismatch detected. Dropping and recreating index...');
      await redisClientMemory.ft.dropIndex('idx:memories');
      throw new Error('Index dropped for re-creation.');
    }

    Logger.INFO('Memory index already exists.');
    return;
  } catch (error: any) {
    if (error.message.includes("Unknown index name") || error.message.includes("Index dropped for re-creation.")) {
      Logger.DEBUG('Creating memory index...');
      try {
        await redisClientMemory.ft.create(
          'idx:memories',
          {
            message: { type: SchemaFieldTypes.TEXT, SORTABLE: true },
            timestamp: { type: SchemaFieldTypes.NUMERIC },
            user: { type: SchemaFieldTypes.TEXT },
            sessionId: { type: SchemaFieldTypes.TEXT },
            type: { type: SchemaFieldTypes.TAG },
            __vector_score: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
            embedding: {
              type: SchemaFieldTypes.VECTOR,
              ALGORITHM: VectorAlgorithms.HNSW,
              TYPE: 'FLOAT32',
              DIM: 768,
              DISTANCE_METRIC: 'COSINE',
              AS: 'embedding',
            },
          },
          { PREFIX: 'okuuMemory:' }
        );
        Logger.DEBUG('Memory index created.');
      } catch (createError) {
        Logger.ERROR('Error creating memory index: ' + createError);
      }
    } else {
      Logger.ERROR('Error checking memory index: ' + error);
    }
  }
}

export async function saveMemoryWithEmbedding(memoryKey: string, message: string, user: string, type: string = 'statement') {

  try {
    // Generate embedding for the statement (e.g., "I live in Tokyo")
    const ollama = new Ollama({ host: `http://127.0.0.1:${process.env.OLLAMA_PORT}` });
    const embeddingResponse = await ollama.embed({ input: message, model: "nomic-embed-text" });

    const embedding = embeddingResponse.embeddings.length === 1
      ? embeddingResponse.embeddings[0]
      : averageEmbeddings(embeddingResponse.embeddings);

    // Ensure embedding dimension matches Redis index configuration
    if (embedding.length !== 768) {
      throw new Error(`Embedding dimensionality mismatch: Expected 768, got ${embedding.length}`);
    }

    // Save the answer or relevant statement (not the question)
    await redisClientMemory.hSet(memoryKey, {
      message,
      timestamp: Date.now(),
      memoryKey,
      type,
      user,
      embedding: Buffer.from(new Float32Array(embedding).buffer),  // Save as embedding, not base64
    });

    //Logger.DEBUG('Memory with embedding saved. Key: ' + memoryKey);
    return memoryKey;
  } catch (error: any) {
    Logger.ERROR('Error saving memory: ' + error.message);
    throw error;
  }
}

// Helper function to average multiple embeddings
function averageEmbeddings(embeddings: number[][]): number[] {
  const dimension = embeddings[0].length;
  const summed = new Array(dimension).fill(0);

  embeddings.forEach(vector => {
    vector.forEach((val, index) => {
      summed[index] += val;
    });
  });

  return summed.map(val => val / embeddings.length); // Divide by the number of embeddings
}

export async function searchMemoryWithEmbedding(query: string) {
  try {
    // Generate query embedding using Ollama
    const ollama = new Ollama({ host: `http://127.0.0.1:${process.env.OLLAMA_PORT}` });
    const queryEmbeddingResponse = await ollama.embed({ input: query, model: "nomic-embed-text" });

    const queryEmbedding = queryEmbeddingResponse.embeddings.length === 1
      ? queryEmbeddingResponse.embeddings[0]
      : averageEmbeddings(queryEmbeddingResponse.embeddings);

    // Search for the most semantically relevant memory
    const result = await redisClientMemory.ft.search('idx:memories', '*=>[KNN 3 @embedding $BLOB]', {
      PARAMS: { BLOB: Buffer.from(new Float32Array(queryEmbedding).buffer) }, // Use the query embedding to search
      SORTBY: '__vector_score', // Sort by similarity score
      DIALECT: 2,
      FILTER: '-@type:question', // Exclude documents where @type is 'question'
    } as any); // Cast to any to bypass type checking

    //Logger.DEBUG('Search result: ' + JSON.stringify(result));
    return result;
  } catch (error: any) {
    Logger.ERROR('Error searching memories with embedding: ' + error.message);
    throw error;
  }
}


// TODO: Find a way to detect questions efficiently
export function isQuestion(input: string): boolean {
  const questionWords = ["who", "what", "where", "when", "why", "how", "is", "are", "do", "does", "can"];
  return (
    input.endsWith("?") ||
    questionWords.some(word => input.toLowerCase().startsWith(word))
  );
}