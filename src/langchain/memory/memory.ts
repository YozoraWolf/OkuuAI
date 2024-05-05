import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { RedisChatMessageHistory } from "@langchain/community/stores/message/ioredis";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { Core } from "@src/core";
import { ConversationChain } from "langchain/chains";
import { REDIS_URL, redisClient } from "./redis";
import { Logger } from "@src/logger";
import { Redis } from "ioredis";
let session: BufferMemory;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", Core.model_settings.system],
  new MessagesPlaceholder("history"),
  ["user", "{input}"],
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { system, ...settings } = Core.model_settings;
const model = new ChatOllama({
  model: Core.model_name,
  ...settings
});

export const startSession = async (sessionId: any) : Promise<ConversationChain> => {
  sessionId = sessionId !== null ? sessionId : new Date().toISOString();
  Logger.DEBUG(`Starting session with sessionId: ${sessionId}`);
  session = new BufferMemory({
    chatHistory: new RedisChatMessageHistory({
      sessionId, // Or some other unique identifier for the conversation
      url: `redis://localhost:${process.env.REDIS_PORT}`, // Default value, override with your own instance's URL
    }),
    returnMessages: true,
    memoryKey: "history",
    inputKey: "input",
    outputKey: "response"
  });


  return new ConversationChain({ llm: model, memory: session, prompt });
};

export const getLatestHistory = async (): Promise<string | null> => {
  Logger.DEBUG("Getting latest history");

  // Get all keys
  const keys = await redisClient.keys('*');

  if (keys.length === 0) {
      return null;
  }

  // Sort keys by descending order (latest first)
  keys.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Return the latest key
  return keys[0];
};