import express from 'express';
const router = express.Router();

const getOkuuStatus = (_: any, res: any) => {
    res.status(200).json({});
};

// Route to close app from GUI
router.get('/status', getOkuuStatus);

export default router;