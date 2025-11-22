import { ChatMessage } from '@src/chat';
import { Core } from '@src/core';
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
  //await deleteMemoryIndex(); // DEBUG. Do not uncomment unless you want to lose your memories.
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
            thinking: { type: SchemaFieldTypes.TEXT, SORTABLE: true },
            timestamp: { type: SchemaFieldTypes.NUMERIC },
            user: { type: SchemaFieldTypes.TEXT },
            memoryKey: { type: SchemaFieldTypes.TEXT },
            sessionId: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
            type: { type: SchemaFieldTypes.TAG },
            recall_count: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
            __vector_score: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
            embedding: {
              type: SchemaFieldTypes.VECTOR,
              ALGORITHM: VectorAlgorithms.HNSW,
              TYPE: 'FLOAT32',
              DIM: 768,
              DISTANCE_METRIC: 'COSINE',
              AS: 'embedding',
            },
            file: { type: SchemaFieldTypes.TEXT },
            attachment: { type: SchemaFieldTypes.TEXT },
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

export async function saveMemoryWithEmbedding(
  sessionId: string,
  message: string,
  user: string,
  type: string = 'statement',
  thinking: string = '',
  existingMemoryKey?: string,
  metadata?: any
) {
  try {
    // Generate embedding for the statement (e.g., "I live in Tokyo")
    const embeddingResponse = await Core.ollama_instance.embed({ input: message, model: "nomic-embed-text" });

    const embedding = embeddingResponse.embeddings.length === 1
      ? embeddingResponse.embeddings[0]
      : averageEmbeddings(embeddingResponse.embeddings);

    // Ensure embedding dimension matches Redis index configuration
    if (embedding.length !== 768) {
      throw new Error(`Embedding dimensionality mismatch: Expected 768, got ${embedding.length}`);
    }

    const timestamp = Date.now();
    const memoryKey = existingMemoryKey || `okuuMemory:${sessionId}:${timestamp}`;
    // Save the answer or relevant statement (not the question)
    const data: any = {
      message,
      thinking,
      timestamp: timestamp,
      memoryKey,
      sessionId: sessionId ? Number(sessionId) : -1,
      type,
      user,
      recall_count: 0,
      embedding: Buffer.from(new Float32Array(embedding).buffer)
    };

    if (metadata) {
      data.metadata = JSON.stringify(metadata);
    }

    await redisClientMemory.hSet(memoryKey, data);

    //Logger.DEBUG('Memory with embedding saved. Key: ' + memoryKey);
    return {
      memoryKey,
      message,
      thinking,
      timestamp,
      user,
      sessionId,
      type,
      recall_count: 0,
      embedding
    };
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

// If memory is called more frequently increse its recall count
async function updateRecallCount(memories: any[]) {
  for (const memory of memories) {
    const memoryKey = memory.memoryKey;
    if (memoryKey) {
      await redisClientMemory.hIncrBy(memoryKey, "recall_count", 1);
    }
  }
}

export async function searchMemoryWithEmbedding(query: string, sessionId: number = -1, topK: number = 5) {
  try {
    // Generate query embedding
    const queryEmbeddingResponse = await Core.ollama_instance.embed({ input: query, model: "nomic-embed-text" });

    const queryEmbedding = queryEmbeddingResponse.embeddings.length === 1
      ? queryEmbeddingResponse.embeddings[0]
      : averageEmbeddings(queryEmbeddingResponse.embeddings);

    // Ensure correct embedding format (raw binary)
    const blobEmbedding = Buffer.from(new Float32Array(queryEmbedding).buffer)

    Logger.DEBUG(`Searching memory: ${sessionId === -1 ? 'all sessions' : `session ${sessionId}`}`);

    const search_query = sessionId !== -1 && !Core.global_memory
      ? `(@sessionId:[${sessionId} ${sessionId}] -@type:question)`
      : `(-@type:question)`;

    //Logger.DEBUG(`Search query: ${search_query}`);

    const result = await redisClientMemory.ft.search(
      'idx:memories',
      `${search_query}=>[KNN ${topK} @embedding $BLOB AS score]`,
      {
        PARAMS: { BLOB: blobEmbedding },
        SORTBY: 'score',
        DIALECT: 2,
        RETURN: ['message', 'timestamp', 'user', 'sessionId', 'type', 'score', 'recall_count'],
      }
    );
    console.log("Result: ", result);

    // Sort results manually based on priority logic
    let memories = result.documents.map(doc => ({
      message: doc.value.message,
      thinking: doc.value.thinking || '', // Include thinking if available
      timestamp: Number(doc.value.timestamp),
      user: doc.value.user,
      sessionId: doc.value.sessionId,
      type: doc.value.type,
      vectorScore: Number(doc.value.__vector_score),
      recallCount: Number(doc.value.recall_count || 0), // Include recall count
      priority: Number(doc.value.priority || 0),
    }));

    // Custom scoring: Mix vector similarity with priority & recall count
    memories.sort((a, b) => {
      const scoreA = 0.5 * a.vectorScore + 0.3 * -a.timestamp + 0.2 * -a.recallCount + 0.2 * -a.priority;
      const scoreB = 0.5 * b.vectorScore + 0.3 * -b.timestamp + 0.2 * -b.recallCount + 0.2 * -b.priority;
      return scoreA - scoreB;
    });

    // Update recall count for retrieved memories
    await updateRecallCount(memories);

    return memories;
  } catch (error: any) {
    Logger.ERROR('Error searching memories with embedding: ' + error.message);
    throw error;
  }
}



export function isQuestion(input: string): boolean {
  const questionWords = ["who", "what", "where", "when", "why", "how", "is", "are", "do", "does", "can"];
  return (
    input.endsWith("?") ||
    questionWords.some(word => input.toLowerCase().startsWith(word))
  );
}

export async function deleteMemorySession(sessionId: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const keys = await redisClientMemory.keys(`okuuMemory:${sessionId}:*`);
      if (keys.length === 0) {
        resolve(false);
      } else {
        const count = await redisClientMemory.del(keys);
        resolve(true);
      }
    } catch (err) {
      Logger.ERROR('Error deleting memory keys: ' + err);
      reject(err);
    }
  });
}

export async function deleteMemoryKey(key: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const count = await redisClientMemory.del(key);
      resolve(count);
    } catch (err) {
      Logger.ERROR('Error deleting chat message: ' + err);
      reject(err);
    }
  });
}

export async function updateAttachmentForMemory(memoryKey: string, attachment: string, fileName: string) {
  try {
    await redisClientMemory.hSet(memoryKey, { attachment, file: fileName });
    return true;
  } catch (error: any) {
    Logger.ERROR('Error updating attachment for memory: ' + error.message);
    throw error;
  }
};
export async function updateMemory(message: ChatMessage) {
  try {
    // discern memory key from message
    const memoryKey = message.memoryKey;
    // if not present construct from session id and timestamp
    if (!memoryKey) {
      message.memoryKey = `okuuMemory:${message.sessionId}:${message.timestamp}`;
    }
    // update memory
    if (memoryKey) {
      const existingMemory = await redisClientMemory.hGetAll(memoryKey);
      const { done, stream, metadata, ...otherFields } = { ...existingMemory, ...message };

      const updatedMemory: any = { ...otherFields };

      // Serialize metadata if present
      if (metadata) {
        updatedMemory.metadata = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
      }

      await redisClientMemory.hSet(memoryKey, updatedMemory);
      return true;
    } else {
      return false;
    }
  } catch (error: any) {
    Logger.ERROR('Error updating memory: ' + error.message);
    throw error;
  }
}

// Debug, usually not necessary
// Delete Memory Index off DB
const deleteMemoryIndex = async () => {
  try {
    await redisClientMemory.ft.dropIndex('idx:memories');
    Logger.DEBUG('Memory index dropped.');
  } catch (error) {
    Logger.ERROR('Error dropping memory index: ' + error);
  }
};