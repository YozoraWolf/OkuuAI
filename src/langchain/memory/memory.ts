import { BufferMemory } from "langchain/memory";
import { RedisChatMessageHistory } from "@langchain/community/stores/message/ioredis";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { ConversationChain } from "langchain/chains";
import { Core } from "@src/core";

let session: BufferMemory, chain: ConversationChain;

const model = new ChatOllama({
  model: Core.model_name,
  temperature: 0,
});


const startSession = async () => {
  session = new BufferMemory({
    chatHistory: new RedisChatMessageHistory({
      sessionId: new Date().toISOString(), // Or some other unique identifier for the conversation
      url: "redis://localhost:6379", // Default value, override with your own instance's URL
    }),
  });

  chain = new ConversationChain({ llm: model, memory: session });
};

const chat = async (input: string) => {
  if (Core.ollama_settings.stream) {
    const response = await chain.stream({ input });
    console.log(response);
  } else {
    const response = await chain.invoke({ input });
    console.log(response);
  }
}