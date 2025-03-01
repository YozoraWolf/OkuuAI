import { getAllSessions, getLatestMsgsFromSession, doesSessionExist, createSession, doesKeyExist } from "@src/langchain/memory/memory";
import { deleteMemoryKey, deleteMemorySession, saveMemoryWithEmbedding } from "@src/langchain/redis";
import { Logger } from "@src/logger";
import { spawn } from "child_process";
import { Request, Response } from 'express';
import fileUpload from 'express-fileupload';
import mammoth from "mammoth"; // docx to text
import { PdfReader } from "pdfreader";
import { saveFileToStorage } from "@src/langchain/memory/storage";

const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];

export const checkMemoryStatus = async (req: any, res: any) => {
    try {
        const dockerInspect = spawn('docker', ['inspect', 'okuuai_redis']);
        let output = '';

        dockerInspect.stdout.on('data', (data) => {
            output += data.toString();
        });

        dockerInspect.on('close', () => {
            try {
                const parsedOutput = JSON.parse(output);
                const status = parsedOutput[0]?.State?.Status;

                if (status === 'running') {
                    res.json({ status: 'OK' });
                } else {
                    res.json({ status: 'DOWN' });
                }
            } catch (err) {
                Logger.ERROR(`Error parsing Docker inspect output: ${err}`);
                res.status(500).json({ status: 'ERROR', error: 'Failed to parse Docker inspect output.' });
            }
        });

        dockerInspect.stderr.on('data', (error) => {
            Logger.ERROR(`Error from Docker inspect: ${error}`);
            res.status(500).json({ status: 'ERROR', error: 'Docker inspect command failed.' });
        });
    } catch (err) {
        Logger.ERROR(`Unexpected error: ${err}`);
        res.status(500).json({ status: 'ERROR', error: 'An unexpected error occurred.' });
    }
};

export const getSessionMsgs = async (req: any, res: any) => {
    const { sessionId } = req.params;
    const { msg_limit } = req.query;

    if(await doesSessionExist(sessionId)) {
        res.json(await getLatestMsgsFromSession(sessionId, msg_limit));
    } else {
        res.status(404).send('Session not found');
    }

    // Send the memory data as a response
}

export const createSess = async (req: any, res: any) => {
    // Create a new session
    const session = await createSession();
    if (session) {
        res.json(session);
    } else {
        res.status(500).send('Session already exists or error creating session');
    }
}

export const createMemoryRecord = async (req: Request, res: Response) => {
    // Read files from request
    if (!req.files || !req.files.file) {
        return res.status(400).send('No files were uploaded.');
    }
    //Logger.DEBUG(`Received file: ${JSON.stringify(req.files)}`);
    // Read the file contents
    // Allow for only json, docx, txt, pdf, and csv files
    const file = req.files.file as fileUpload.UploadedFile;
    const msg = JSON.parse(req.body.message);
    //Logger.DEBUG(`Received file: ${file.name}`);
    //Logger.DEBUG(`Raw buffer: ${file.data}`);
    //Logger.DEBUG(`Buffer as JSON: ${JSON.stringify(file.data)}`);
    Logger.DEBUG(`File Size: ${file.size}`);
    Logger.DEBUG(`File type: ${file.mimetype}`);
    //Logger.DEBUG('File data: '+file.data);
    const allowedExtensions = ['json', 'docx', 'txt', 'pdf', 'csv', ...imageExts];
    const extension = file.name.split('.').pop() || '';
    if (!allowedExtensions.includes(extension)) {
        res.status(400).send(`Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`);
        return;
    }
    // Read its contents
    let content: string = '';
    // Append user message to the file content
    if(msg.message) {
        content += msg.message + '\n----------------\n';
    }

    try {
        //const memoryKey = `okuuMemory:file:${file.name}`;
        //const result = await saveMemoryWithEmbedding(memoryKey, content, 'system', 'file');
        const result = saveFileToStorage(file);
        if (result) {
            res.status(200).json({ message: 'File uploaded sucessful!', fileName: result });
        } else {
            res.status(500).send('Error uploading file.');
        }
    } catch (err) {
        Logger.ERROR(`Error processing file: ${err}`);
        res.status(500).send('Error processing file.');
    }
};

export const deleteSession = async (req: any, res: any) => {
    const { sessionId } = req.params;
    if(await doesSessionExist(sessionId)) {
        // Delete the session
        const result = await deleteMemorySession(sessionId);
        res.status(200).json({ result });
    } else {
        res.status(404).json({ result: false });
    }
}

export const deleteChatMessage = async (req: any, res: any) => {
    const { memoryKey } = req.body;
    if(await doesKeyExist(memoryKey)) {
        const result = await deleteMemoryKey(memoryKey);
        res.status(200).json({ result });
    } else {
        res.status(404).json({ result: false });
    }
}

export const getAllSessionsJSON = async (req: any, res: any) => {
    res.json(await getAllSessions());
}