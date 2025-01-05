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
    if (indexInfo) {
      console.log('Memory index already exists.');
      //await redisClientMemory.ft.dropIndex('idx:memories');
      //Logger.DEBUG('Memory index deleted.');
      return;
    }
  } catch (error: any) {
    Logger.ERROR('Error checking memory index: ' + error);
    if (error.message.includes("Unknown index name")) {
      try {
        Logger.DEBUG('Creating memory index...');

        const options = { PREFIX: 'okuuMemory:' }; // Correctly structured options

        // Now using the correct order and structure for arguments
        await redisClientMemory.ft.create(
          'idx:memories',  // Index name (string)
          {                 // Schema definition (object)
            message: { type: SchemaFieldTypes.TEXT, SORTABLE: true },
            timestamp: { type: SchemaFieldTypes.NUMERIC },
            sessionId: { type: SchemaFieldTypes.TEXT },
            __vector_score: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
            embedding: {
              type: SchemaFieldTypes.VECTOR,
              ALGORITHM: VectorAlgorithms.HNSW,
              TYPE: 'FLOAT32',
              DIM: 4096,  // Update the dimension here to match the output of the model
              DISTANCE_METRIC: 'COSINE',
              AS: 'embedding',
            },
          },
          options           // Indexing options (object)
        );

        Logger.DEBUG('Memory index created.');
      } catch (createError) {
        Logger.ERROR('Error creating memory index: ' + createError);
      }
    } else {
      Logger.ERROR('Error creating memory index: ' + error);
    }
  }
}

export async function saveMemoryWithEmbedding(sessionId: number, message: string) {
  const memoryKey = `okuuMemory:${sessionId}:${Date.now()}`;

  try {
    // Generate embeddings using Ollama
    const ollama = new Ollama({ host: `http://127.0.0.1:${process.env.OLLAMA_PORT}` });
    const embeddingResponse = await ollama.embed({ input: message, model: "nomic-embed-text" });
    
    // Use the first embedding or average all embeddings
    const embedding = embeddingResponse.embeddings.length === 1
      ? embeddingResponse.embeddings[0]
      : averageEmbeddings(embeddingResponse.embeddings);

    // Store memory in Redis as base64 encoded embedding
    // Ensure you're saving embeddings of the correct dimension
    await redisClientMemory.hSet(memoryKey, {
      message,
      timestamp: Date.now(),
      sessionId,
      embedding: Buffer.from(new Float32Array(embedding).buffer).toString('base64'), // Correctly encode as base64
    });

    Logger.DEBUG('Memory with embedding saved. Key: ' + memoryKey);
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
  
    // Correctly encode query embedding as base64
    const result = await redisClientMemory.ft.search('idx:memories', '*=>[KNN 3 @embedding $BLOB]', {
      PARAMS: { BLOB: Buffer.from(new Float32Array(queryEmbedding).buffer).toString('base64') },
      SORTBY: '__vector_score',
      DIALECT: 2,
    });
    

    Logger.DEBUG('Search result: ' + JSON.stringify(result));
    return result;
  } catch (error: any) {
    Logger.ERROR('Error searching memories with embedding: ' + error.message);
    throw error;
  }
}