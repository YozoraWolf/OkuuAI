import { redisRAGclient } from '@/src/langchain/redis';
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { model } from "@src/chat";

import { pull } from "langchain/hub";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";


const initRag = async () => {

/*     // Define the tools the agent will have access to.
    const tools = [new DuckDuckGoSearch({ maxResults: 1 })];

    // Get the prompt to use - you can modify this!
    // If you want to see the prompt in full, you can at:
    // https://smith.langchain.com/hub/hwchase17/openai-functions-agent
    const prompt = await pull<ChatPromptTemplate>(
    "hwchase17/openai-functions-agent"
    );

    const agent = await createOllamaFunctionsAgent({
    model,
    tools,
    prompt,
    });
    const agentExecutor = new AgentExecutor({
    agent,
    tools,
    });
    const result = await agentExecutor.invoke({
    input: "What is Anthropic's estimated revenue for 2024?",
    }); */

};

