import { ChatOllama } from "@langchain/community/chat_models/ollama";

const ollamaLlm = new ChatOllama({
    model: "okuu",
});

export const invoke = async (prompt: string) => {
    const response = await ollamaLlm.invoke(prompt);
    console.log(response.content);
}