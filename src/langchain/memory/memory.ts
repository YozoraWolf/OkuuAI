import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { RedisChatMessageHistory } from "@langchain/community/stores/message/ioredis";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { Core } from "@src/core";
import { ConversationChain } from "langchain/chains";
//import Redis from "redis";

let session: BufferMemory;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", Core.model_settings.system],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { system, ...settings } = Core.model_settings;
const model = new ChatOllama({
  model: Core.model_name,
  ...settings
});

export const startSession = () => {
  session = new BufferMemory({
    chatHistory: new RedisChatMessageHistory({
      sessionId: new Date().toISOString(), // Or some other unique identifier for the conversation
      url: `redis://localhost:${process.env.REDIS_PORT}`, // Default value, override with your own instance's URL
    }),
    returnMessages: true,
    memoryKey: "history",
    inputKey: "input",
    outputKey: "response"
  });


  return new ConversationChain({ llm: model, memory: session, prompt });
};

/* const getLatestHistory = async () => {
  const historyKey = `history:${session.id}`;
  const history = await session.get(historyKey);
  return history;
} */

/* const getLatestHistory = async (sessionId: string): Promise<string[]> => {
  // Assuming you have a Redis client instance named "redisClient"
  const historyKey = `history:${sessionId}`;
  const history = await redisClient.lrange(historyKey, 0, -1);
  return history;
}; */

/* export const startSession = () => {
  return new RunnableWithMessageHistory({
    runnable: chain, // Your existing chain
    chatHistory: new RedisChatMessageHistory({
      sessionId: new Date().toISOString(), // Or some other unique identifier for the conversation
      url: `redis://localhost:${process.env.REDIS_PORT}`, // Default value, override with your own instance's URL
    }),
    inputMessagesKey: "human", // Key for storing user input
    historyMessagesKey: "chat_history", // Key for storing conversation history
  });
}; */

/* export const startSession = () => {
  return new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: () => new RedisChatMessageHistory({
      sessionId: new Date().toISOString(), // Or some other unique identifier for the conversation
      url: `redis://localhost:${process.env.REDIS_PORT}`, // Default value, override with your own instance's URL
    }),
    inputMessagesKey: "question",
    historyMessagesKey: "history",
  });
}; */