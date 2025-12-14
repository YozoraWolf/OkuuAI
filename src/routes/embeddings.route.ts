import express from 'express';
import { Core } from '../core';
import { Logger } from '../logger';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { input, model } = req.body;
        // User requested to use embeddinggemma:latest, allow override but default to it
        const targetModel = 'embeddinggemma:latest';

        if (!input) {
            res.status(400).json({ error: { message: "Missing 'input' in request body", type: "invalid_request_error" } });
            return;
        }

        const inputs = Array.isArray(input) ? input : [input];
        const embeddings = [];

        for (const text of inputs) {
            const response = await Core.ollama_instance.embeddings({
                model: targetModel,
                prompt: text,
            });
            embeddings.push(response.embedding);
        }

        const data = embeddings.map((emb, index) => ({
            object: "embedding",
            embedding: emb,
            index: index
        }));

        res.json({
            object: "list",
            data: data,
            model: targetModel,
            usage: {
                prompt_tokens: 0,
                total_tokens: 0
            }
        });

    } catch (error: any) {
        Logger.ERROR(`Error generating embeddings: ${error.message}`);
        res.status(500).json({ error: { message: error.message, type: "internal_server_error" } });
    }
});

export default router;
