import { Logger } from '@src/logger';
import express from 'express';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const getOkuuStatus = (_: any, res: any) => {
    res.status(200).json({});
};

// Rate limiter middleware
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
    handler: (req, res, next) => {
        Logger.WARN(`Rate limit exceeded for IP: ${req.ip}`);
        Logger.LogRateAlertToFile("warn", req);
        res.status(429).json({ message: 'Too many requests from this IP, please try again after 15 minutes' });
    }
});

export const apiKeyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 60 minutes
    max: 10, // Limit each IP to 100 requests per windowMs
    message: 'Too many attempts to validate API key, please try again later.',
    handler: (req, res, next) => {
        Logger.WARN(`Rate limit exceeded for IP: ${req.ip}`);
        Logger.LogRateAlertToFile("warn", req);
        res.status(429).json({ message: 'Too many requests from this IP, please try again after 15 minutes' });
    }
});

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
router.post("/apiKey", apiKeyLimiter, checkApiKey);

export default router;