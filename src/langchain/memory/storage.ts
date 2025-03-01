import { UploadedFile } from 'express-fileupload';
import path from 'path';
import fs from 'fs';
import { Logger } from '@src/logger';
import mammoth from 'mammoth';
import { PdfReader } from 'pdfreader';

const stroragePath = path.join(process.cwd(), 'storage');
const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];

const createStorageFolder = () => {
    if (!fs.existsSync(stroragePath)) {
        fs.mkdirSync(stroragePath);
    }
}

const doesStorageFolderExist = (): boolean => {
    return fs.existsSync(stroragePath);
};

const checkFileExists = (fileName: string): string => {
    let filePath = path.join(stroragePath, fileName);
    let fileBaseName = path.basename(fileName, path.extname(fileName));
    let fileExt = path.extname(fileName);
    let index = 1;

    while (fs.existsSync(filePath)) {
        filePath = path.join(stroragePath, `${fileBaseName}_${index}${fileExt}`);
        index++;
    }

    return path.basename(filePath);
};

export const saveFileToStorage = (file: UploadedFile): string | boolean => {
    const fileName = checkFileExists(file.name);
    const filePath = path.join(stroragePath, fileName);
    if(!doesStorageFolderExist()) {
        createStorageFolder();
    }
    file.mv(filePath, (err) => {
        if (err) {
            Logger.ERROR(`Error saving file to storage.`);
            return false;
        }
    });
    return fileName;
};

export const loadFileContentFromStorage = async (fileName: string): Promise<string | undefined> => {
    try {
        const filePath = path.join(stroragePath, fileName);
        const file = fs.readFileSync(filePath);
        const extension = fileName.split('.').pop() || '';
        let attachment = '';
        if (extension === 'json') {
            attachment += JSON.stringify(JSON.parse(file.toString()), null, 2);
        } else if (extension === 'docx') {
            const result = await mammoth.extractRawText({ buffer: file });
            attachment += result.value;
        } else if (extension === 'txt') {
            attachment += file.toString();
            Logger.DEBUG(`Text content: ${file}`);
        } else if (extension === 'pdf') {
            const pdfReader = new PdfReader();
            pdfReader.parseBuffer(file, (err: any, item: any) => {
                if (err) {
                    Logger.ERROR(`Error parsing PDF file: ${err}`);
                    throw err;
                }
                if (item && item.text) {
                    attachment += item.text + '\n';
                }
                if (!item) {
                    // End of file
                    // Process the content as needed
                    console.log('File content:', attachment);
                    // Save the content to memory
                    // await memoryService.saveMemory(content);
                }
            });
        } else if (extension === 'csv') {
            attachment += file.toString();
        } else if (imageExts.includes(extension)) {
            attachment = file.toString('base64');
        } else {
            Logger.ERROR(`Unsupported file type: ${extension}`);
            return undefined;
        }
        return attachment;
    } catch (err) {
        Logger.ERROR(`Error loading file content: ${err}`);
        return undefined;
    }
};