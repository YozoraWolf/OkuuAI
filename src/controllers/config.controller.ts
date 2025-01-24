import { Request, Response } from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';

const assetsFolder = path.join(__dirname, '..', 'assets');
const okuuPfpPath = path.join(assetsFolder, 'okuu_pfp');

export const setOkuuPfp = (req: Request, res: Response) => {
    if (!req.files || !req.files.file) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.files.file as fileUpload.UploadedFile;
    const filePath = path.join(assetsFolder, `okuu_pfp${path.extname(file.name)}`);
    file.mv(filePath, (err) => {
        if (err) {
            return res.status(500).send('Error saving file.');
        }
        res.status(200).send('File uploaded successfully.');
    });
};

export const getOkuuPfp = (req: Request, res: Response) => {
    fs.readdir(assetsFolder, (err, files) => {
        if (err) {
            return res.status(500).send('Error reading directory.');
        }

        const okuuPfpFile = files.find(file => file.startsWith('okuu_pfp'));
        if (!okuuPfpFile) {
            return res.status(404).send('File not found.');
        }

        const filePath = path.join(assetsFolder, okuuPfpFile);
        res.setHeader('Content-Type', 'image/jpeg'); // Set the correct content type
        res.sendFile(filePath);
    });
};

export const deleteOkuuPfp = (req: Request, res: Response) => {
    fs.readdir(assetsFolder, (err, files) => {
        if (err) {
            return res.status(500).send('Error reading directory.');
        }

        const okuuPfpFile = files.find(file => file.startsWith('okuu_pfp'));
        if (!okuuPfpFile) {
            return res.status(404).send('File not found.');
        }

        const filePath = path.join(assetsFolder, okuuPfpFile);
        fs.unlink(filePath, (err) => {
            if (err) {
                return res.status(500).send('Error deleting file.');
            }
            res.status(200).send('File deleted successfully.');
        });
    });
};
