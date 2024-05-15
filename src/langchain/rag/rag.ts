import { PromptTemplate } from '@langchain/core/prompts';

import { HttpResponseOutputParser } from 'langchain/output_parsers';
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HtmlToTextTransformer } from "@langchain/community/document_transformers/html_to_text";

import { JSONLoader } from "langchain/document_loaders/fs/json";
import { RunnableSequence } from '@langchain/core/runnables'
import { formatDocumentsAsString } from 'langchain/util/document';

import { ChatMessage, incrementMessagesCount, model } from '@src/chat';
import { io } from '@src/index';
import { Logger } from '@src/logger';
import { getFileExtFromPath } from '@src/o_utils';
import { Core } from '@src/core';
import { currentMemory } from '../memory/memory';

export const dynamic = 'force-dynamic'

const TEMPLATE = `
Current conversation: {chat_history}

Answer the user's questions based only on the following context. If the answer is not in the context, reply with what you know, if now, reply politely that you don't know:
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
            default:
                Logger.ERROR(`Invalid context file format: ${ctxFile}`);
                return null;
        };

        if (!loader) {
            Logger.ERROR(`Invalid loader for: ${ctxFile}`);
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
        /**
       * Chat models stream message chunks rather than bytes, so this
       * output parser handles serialization and encoding.
       */
        const parser = new HttpResponseOutputParser();

        const chain = RunnableSequence.from([
            {
                question: (input) => input.question,
                chat_history: (input) => input.chat_history,
                context: () => formatDocumentsAsString(docs),
                system: () => Core.model_settings.system,
            },
            prompt,
            model,
            parser,
        ]);

        Logger.DEBUG(`Sending chat: ${chatMessage.id}`);

        const reply: ChatMessage = {
            id: incrementMessagesCount(),
            type: 'ai',
            content: '',
            done: false

        };

        if (Core.chat_session.memory === undefined) return;

        const memory = (await currentMemory.getMessages()).map((msg: any) => {
            return `${msg.type}: ${msg.content}`;
        }).join('\n');

        // Convert the response into a friendly text-stream
        const stream = await chain.invoke({
            chat_history: memory,
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

        return stream;
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: e.status ?? 500 });
    }
}