import { UploadedFile } from 'express-fileupload';
import path from 'path';
import fs from 'fs';
import { Logger } from '@src/logger';
import mammoth from 'mammoth';
import { PdfReader } from 'pdfreader';

const stroragePath = path.join(process.cwd(), 'storage');
const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];

const normalizeUploadFileName = (fileName: string) => {
    if ([...fileName].some(char => char.charCodeAt(0) > 255)) return fileName;
    const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? fileName : decoded;
};

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

export const saveFileToStorage = async (file: UploadedFile): Promise<string | false> => {
    const fileName = checkFileExists(normalizeUploadFileName(file.name));
    const filePath = path.join(stroragePath, fileName);
    if(!doesStorageFolderExist()) {
        createStorageFolder();
    }
    try {
        await file.mv(filePath);
        return fileName;
    } catch (error) {
        Logger.ERROR(`Error saving file to storage: ${error}`);
        return false;
    }
};

export const loadFileContentFromStorage = async (fileName: string): Promise<string | undefined> => {
    try {
        if (!fileName || path.basename(fileName) !== fileName) {
            Logger.WARN('Rejected file access outside managed storage.');
            return undefined;
        }
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
            attachment = await new Promise<string>((resolve, reject) => {
                const pdfReader = new PdfReader();
                let text = '';
                pdfReader.parseBuffer(file, (err: any, item: any) => {
                    if (err) {
                        reject(err);
                    } else if (!item) {
                        resolve(text);
                    } else if (item.text) {
                        text += item.text + '\n';
                    }
                });
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
