import { PromptTemplate, ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';

import { HttpResponseOutputParser } from 'langchain/output_parsers';
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HtmlToTextTransformer } from "@langchain/community/document_transformers/html_to_text";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { JSONLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RunnableSequence } from '@langchain/core/runnables'
import {
    RunnableConfig,
    RunnablePassthrough,
    RunnableWithMessageHistory,
} from "@langchain/core/runnables";
import { formatDocumentsAsString } from 'langchain/util/document';
import { DocxLoader } from "langchain/document_loaders/fs/docx";


import { ChatMessage, incrementMessagesCount, model } from '@src/chat';
import { io } from '@src/index';
import { Logger } from '@src/logger';
import { getFileExtFromPath } from '@src/o_utils';
import { Core } from '@src/core';
import { SESSION_SETTINGS, currentMemory, getRedisChatMsgHist, getSessionMemory, session } from '../memory/memory';

export const dynamic = 'force-dynamic'

let currentContext: string = '';

export const resetContext = () => {
    currentContext = '';
};

let TEMPLATE_noctx = `system prompt: {system}
Chat History: {history}

user: {input}
assitant:`;

let TEMPLATE_ctx = `system prompt: {system}
Answer the user's questions based only on the following context. If the answer is not in the context, reply with what you know, if now, reply politely that you don't know. (DO NOT make up information, only answer based on the context provided, if you know factual information, provide it):
---
Context: {context}
---
user: {input}
assistant:`;

const cprompt = ChatPromptTemplate.fromMessages([
    ["system", Core.model_settings.system],
    new MessagesPlaceholder("history"),
    ["user", "{input}"]
]);

const formatRedisMessages = (msgs: any[]) => {
    return msgs.map(msg => 
        { return `${msg.type}: ${msg.content}` })
}


// TODO: Work on memory with RunnableSequence.
export async function sendChatRAG(chatMessage: ChatMessage, ctxFile: string = '', callback?: (data: string) => void) {
    try {
        // Extract the `messages` from the body of the request
        const message = chatMessage.content;

        if (ctxFile.length !== 0) {
            let loader: any;
            let docs: any;
            switch (getFileExtFromPath(ctxFile)) {
                case 'json':
                    Logger.DEBUG(`Loading JSON file: ${ctxFile}`);
                    loader = new JSONLoader(ctxFile);
                    docs = await loader.load();
                    break;
                case "txt":
                    Logger.DEBUG(`Loading TXT file: ${ctxFile}`);
                    loader = new TextLoader(ctxFile);
                    docs = await loader.load();
                    break;
                case "html":
                    Logger.DEBUG(`Loading HTML file: ${ctxFile}`);
                    loader = new CheerioWebBaseLoader(ctxFile);
                    docs = await loader.load();
                    const splitter = RecursiveCharacterTextSplitter.fromLanguage("html");
                    const transformer = new HtmlToTextTransformer();

                    const sequence = splitter.pipe(transformer);

                    docs = await sequence.invoke(docs);
                    break;
                case "docx":
                case "doc":
                case "odf":
                    Logger.DEBUG(`Loading DOCX file: ${ctxFile}`);
                    loader = new DocxLoader(ctxFile);
                    docs = await loader.load();
                    break;
                default:
                    Logger.ERROR(`Invalid context file format: ${ctxFile}`);
                    return null;
            };

            if (!loader) {
                Logger.ERROR(`Invalid loader for: ${ctxFile}`);
                return null;
            }

            if (formatDocumentsAsString(docs).length === 0) {
                Logger.ERROR(`Loaded context is empty or invalid`);
                return null;
            }

            // set current context to current rag until it gets replaced by a new one
            currentContext = formatDocumentsAsString(docs);
        }

        let prompt = PromptTemplate.fromTemplate(TEMPLATE_ctx);
        if (currentContext.length === 0) {
            Logger.WARN(`Current context is empty, setting no context template`);
            prompt = PromptTemplate.fromTemplate(TEMPLATE_noctx);
        }



        //Logger.DEBUG(`Template: ${JSON.stringify(prompt)}`);
        //Logger.DEBUG(`CTemplate: ${JSON.stringify(cprompt)}`);

        Logger.DEBUG(`Creating chain...`);

        const msgs = await getRedisChatMsgHist(SESSION_SETTINGS.sessionId).getMessages();
        //const memory = getSessionMemory(SESSION_SETTINGS.sessionId);
        //Logger.DEBUG(`MEMORY: ${JSON.stringify(await memory.loadMemoryVariables({}))}`);
        //Logger.DEBUG(`MEMORY: ${JSON.stringify(formatRedisMessages(msgs))}`);
        const parser = new StringOutputParser();

        const chain = RunnableSequence.from([
            {
                system: () => Core.model_settings.system,
                context: () => currentContext,
                input: (initialInput) => initialInput.input,
                memory: () => formatRedisMessages(msgs)
            },
            {
                system: () => Core.model_settings.system,
                context: () => currentContext,
                input: (previousOutput) => previousOutput.input,
                history: (previousOutput) => previousOutput.memory.history,
            },
            prompt,
            model,
            parser
        ]);

        Logger.DEBUG(`Sending chat: ${chatMessage.id}`);

        Logger.DEBUG(`Context: ${currentContext}`);

        //Logger.DEBUG(`Chat Hist: ${JSON.stringify(await memory.loadMemoryVariables({}))}`);

        const reply: ChatMessage = {
            id: incrementMessagesCount(),
            type: 'ai',
            content: '',
            done: false
        };
        io.emit('chat', chatMessage); // send back user input (for GUI to display)
        io.emit('chat', reply); // send back AI response (for GUI to display and await)



        // Convert the response into a friendly text-stream
        /*         Core.chat_session.prompt = prompt;
                Core.chat_session.pipe(parser); */

        const stream = await chain.invoke({
            input: message,
        }, {
            callbacks: [
                {
                    async handleLLMNewToken(token: string) {
                        if (callback) callback(token);
                        reply.content += token;
                        io.emit('chat', reply);
                    }
                }
            ]
        });
        let answer = '';
        for await (const chunk of stream) {
            //Logger.DEBUG(`Chunk: ${chunk}`);
            answer += chunk;
        }

        await session.saveContext({
            input: message
        }, {
            answer
        });

        reply.done = true;
        io.emit('chat', reply);
        return answer;
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: e.status ?? 500 });
    }
}