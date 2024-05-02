import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { join } from 'path';
import { exec } from 'child_process';
import { Logger } from "../logger";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import fs from 'fs';
import { Core } from "../core";

const projectRoot = process.cwd();

// ChromaDB Setup Related

const CHROMA_USER = process.env.CHROMA_USER;
const CHROMA_PWD = process.env.CHROMA_PWD;
const CHROMA_PORT = process.env.CHROMA_PORT || '3009';
const CHROMA_ENV = `
CHROMA_SERVER_AUTH_CREDENTIALS_FILE="/chromadb/server.htpasswd"
CHROMA_SERVER_AUTH_CREDENTIALS_PROVIDER="chromadb.auth.providers.HtpasswdFileServerAuthCredentialsProvider"
CHROMA_SERVER_AUTH_PROVIDER="chromadb.auth.basic.BasicAuthServerProvider"
`

const chromaDir = join(projectRoot, 'chromadb');


export const initDockerChromaDB = async () => {
    Logger.INFO('Pulling chromadb/chroma image...');
    await pullChromaImage();
    Logger.INFO('Checking server.htpasswd file...');
    await checkServerPWDFile()
    Logger.INFO('Initializing chromadb/chroma...');
    const res = await runDockerChromaDB();
    if (res === 2) {
        Logger.INFO('Chroma docker container already exists, restarting container...');
        await restartDockerChromaDB();
    } else if (res === 1) {
        Logger.ERROR('Error occurred while starting chromadb/chroma docker container!');
        process.exit(1);
    }
    Logger.INFO(`ChromaDB initialized successfully!
        Running on http://localhost:${CHROMA_PORT}`);
};

const restartDockerChromaDB = async () => {
    return new Promise<boolean>((resolve, reject) => {
        exec(`docker restart okuu_chromadb`, (error, stdout, stderr) => {
            if (error) {
                Logger.ERROR(`Error occurred while restarting chroma: ${error.message}`);
                reject(false);
            }
            if (stderr) {
                Logger.ERROR(`stderr: ${stderr}`);
                reject(false);
            }
            Logger.INFO(`Chroma docker container restarted successfully!`);
            resolve(true);
        });
    });
}

const runDockerChromaDB = async () => {
    return new Promise<number>((resolve, reject) => {
        exec(`docker run -d --env-file ${chromaDir}/.chroma_env -p ${CHROMA_PORT}:8000 --name okuu_chromadb chromadb/chroma`, (error, stdout, stderr) => {
            if (stderr.includes('Conflict. The container name "/okuu_chromadb" is already in use by container')) {
                resolve(2);
            } else if (stderr) {
                Logger.ERROR(`stderr: ${stderr}`);
                reject(1);
            }
            Logger.INFO(`Chroma docker container started successfully!`);
            resolve(0);
        });
    });
}

const checkServerPWDFile = async (): Promise<boolean> => {
    const htpasswdPath = join(chromaDir, 'server.htpasswd');
    if (!fs.existsSync(chromaDir)) {
        Logger.INFO('chromadb dir does not exist, creating dir...');
        fs.mkdirSync(chromaDir);
        fs.writeFileSync(join(chromaDir, '.chroma_env'), CHROMA_ENV);
    }
    if (!fs.existsSync(htpasswdPath)) {
        return new Promise<boolean>((resolve, reject) => {
            exec(`cd ${chromaDir} && docker run --rm --entrypoint htpasswd httpd:2 -Bbn ${CHROMA_USER} ${CHROMA_PWD} > server.htpasswd`, (error, stdout, stderr) => {
                if (error) {
                    Logger.ERROR(`Error occurred while initializing chroma: ${error.message}`);
                    reject(false);
                }
                if (stderr) {
                    Logger.ERROR(`stderr: ${stderr}`);
                    reject(false);
                }
                Logger.INFO(`ChromaDB server.htpasswd initialized!`);
                resolve(true);
            });
        });
    }
    return Promise.resolve(true);
}

const pullChromaImage = async () => {
    return new Promise<boolean>((resolve, reject) => {
        exec('docker pull chromadb/chroma', (error, stdout, stderr) => {
            if (error) {
                Logger.ERROR(`Error occurred while pulling chromadb/chroma image: ${error.message}`);
                reject(false);
            }
            if (stderr) {
                Logger.ERROR(`stderr: ${stderr}`);
                reject(false);
            }
            Logger.INFO(`Chromadb/chroma image pulled successfully!`);
            resolve(true);
        });
    });
};


// TODO: Develop more on this
export const initCollection = async () => {
    const embeddings = new OllamaEmbeddings({model: 'okuu'});
    const loader = new CSVLoader(`${projectRoot}/genshin.csv`);
    const docs = await loader.load();

    Logger.INFO('Documents loaded successfully!');

    const vectorStore = await Chroma.fromDocuments(docs, embeddings, {
        collectionName: "test",
        url: 'http://127.0.0.1:3010', // Optional, will default to this value
    });

    Logger.INFO('Collection initialized successfully!');

    // Search for the most similar document
    const response = await vectorStore.similaritySearch("Diluc", 1);

    console.log(response);


    // Persist the collection (optional)
    //await vectorStore
}