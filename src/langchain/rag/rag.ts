import { PromptTemplate } from '@langchain/core/prompts';

import { HttpResponseOutputParser } from 'langchain/output_parsers';
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HtmlToTextTransformer } from "@langchain/community/document_transformers/html_to_text";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { JSONLoader } from "langchain/document_loaders/fs/json";
import { RunnableSequence } from '@langchain/core/runnables'
import {
    RunnableConfig,
    RunnableWithMessageHistory,
  } from "@langchain/core/runnables"; 
import { formatDocumentsAsString } from 'langchain/util/document';
import { DocxLoader } from "langchain/document_loaders/fs/docx";


import { ChatMessage, incrementMessagesCount, model } from '@src/chat';
import { io } from '@src/index';
import { Logger } from '@src/logger';
import { getFileExtFromPath } from '@src/o_utils';
import { Core } from '@src/core';
import { SESSION_SETTINGS, currentMemory, session } from '../memory/memory';

import { RedisChatMessageHistory } from "@langchain/community/stores/message/ioredis";

export const dynamic = 'force-dynamic'

const TEMPLATE = `
Chat History:
{history}

Answer the user's questions based only on the following context. If the answer is not in the context, reply with what you know, if now, reply politely that you don't know. (DO NOT make up information, only answer based on the context provided, if you know factual information, provide it):
==============================
Context: {context}
==============================
system prompt: {system}

user: {question}
assistant:`;


export async function sendChatRAG(chatMessage: ChatMessage, ctxFile: string = '', callback?: (data: string) => void) {
    try {
        // Extract the `messages` from the body of the request
        const message = chatMessage.content;

        let loader: any;
        let docs: any;
        switch (getFileExtFromPath(ctxFile)) {
            case 'json':
                Logger.DEBUG(`Loading JSON file: ${ctxFile}`);
                loader = new JSONLoader(ctxFile);
                docs = await loader.load();
                break;
            case "txt":
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

        if(formatDocumentsAsString(docs).length === 0) {
            Logger.ERROR(`Context is empty`);
            return null;
        }

        // load a JSON object
        // const textSplitter = new CharacterTextSplitter();
        // const docs = await textSplitter.createDocuments([JSON.stringify({
        //     "state": "Kansas",
        //     "slug": "kansas",
        //     "code": "KS",
        //     "nickname": "Sunflower State",
        //     "website": "https://www.kansas.gov",
        //     "admission_date": "1861-01-29",
        //     "admission_number": 34,
        //     "capital_city": "Topeka",
        //     "capital_url": "http://www.topeka.org",
        //     "population": 2893957,
        //     "population_rank": 34,
        //     "constitution_url": "https://kslib.info/405/Kansas-Constitution",
        //     "twitter_url": "http://www.twitter.com/ksgovernment",
        // })]);

        const prompt = PromptTemplate.fromTemplate(TEMPLATE);

        Logger.DEBUG(`Template: ${TEMPLATE}`);
/* 
        if (Core.chat_session.memory === undefined) return;

        const memory = (await currentMemory.getMessages()).map((msg: any) => {
            return `${msg.type}: ${msg.content}`;
        }).join('\n');

        Logger.DEBUG(`Memory: ${JSON.stringify((await currentMemory.getMessages())[1])}`);
 */


        /**
       * Chat models stream message chunks rather than bytes, so this
       * output parser handles serialization and encoding.
       */
        const parser = new HttpResponseOutputParser();

        Logger.DEBUG(`Creating chain...`);

        
        const chain = RunnableSequence.from([
            {
                question: (input) => input.question,
                context: () => formatDocumentsAsString(docs),
                system: () => Core.model_settings.system,
                history: async () => await session.loadMemoryVariables({ type: RedisChatMessageHistory, key: SESSION_SETTINGS })
            },
            prompt,
            model,
            new StringOutputParser(),
        ]);

        Logger.DEBUG(`Sending chat: ${chatMessage.id}`);

        Logger.DEBUG(`Context: ${formatDocumentsAsString(docs).length}`);

        const reply: ChatMessage = {
            id: incrementMessagesCount(),
            type: 'ai',
            content: '',
            done: false
        };



        // Convert the response into a friendly text-stream
/*         Core.chat_session.prompt = prompt;
        Core.chat_session.pipe(parser); */

        const stream = await chain.stream({
            question: message,
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

        session.saveContext({
            input: chatMessage.content,
        },{
            answer
        });

        return answer;
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: e.status ?? 500 });
    }
}