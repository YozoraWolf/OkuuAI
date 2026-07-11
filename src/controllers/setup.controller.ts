import { Request, Response } from 'express';
import axios from 'axios';
import { completeSetup, getSetupState } from '../setup';
import { setupEvents } from '../setup-events';

export const getSetupStatus = (_req: Request, res: Response) => {
    res.status(200).json(getSetupState());
};

export const postSetupComplete = async (req: Request, res: Response) => {
    const state = getSetupState();
    if (!state.setupRequired) {
        return res.status(409).json({ error: 'Setup has already been completed' });
    }

    try {
        const result = await completeSetup(req.body);
        res.status(201).json({
            ...result,
            restartRequired: false,
            message: 'Setup complete. OkuuAI is applying the new runtime configuration.'
        });
        setupEvents.emit('completed');
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
};

export const postTestEndpoint = async (req: Request, res: Response) => {
    const { baseUrl, apiKey, model } = req.body;
    if (!baseUrl) {
        return res.status(400).json({ error: 'Base URL is required' });
    }

    const normalizedBaseUrl = String(baseUrl).replace(/\/$/, '');

    try {
        const response = await axios.get(`${normalizedBaseUrl}/models`, {
            timeout: 10000,
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        });

        const models = Array.isArray(response.data?.data) ? response.data.data : [];
        const modelIds = models.map((item: any) => item.id).filter(Boolean);
        const modelFound = !model || modelIds.length === 0 || modelIds.includes(model);

        res.status(200).json({
            ok: true,
            models: modelIds,
            warning: modelFound ? undefined : `Connected, but model "${model}" was not listed by the endpoint. OkuuAI will keep your custom model value.`
        });
    } catch (error: any) {
        res.status(400).json({
            error: error.response?.data?.error?.message || error.message || 'Endpoint test failed'
        });
    }
};
