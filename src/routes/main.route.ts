import express from 'express';
const router = express.Router();

const getOkuuStatus = (_: any, res: any) => {
    res.status(200).json({});
};

const checkApiKey = (req: any, res: any) => {
    console.log('API key:', req.headers['x-api-key']);
    if (req.headers['x-api-key'] === process.env.API_KEY) {
        res.status(200).json({ valid: true });
    } else {
        res.status(401).json({ valid: false });
    }
};

// Route to close app from GUI
router.get('/status', getOkuuStatus);
router.post("/apiKey", checkApiKey);

export default router;