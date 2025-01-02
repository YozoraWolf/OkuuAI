import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { Logger } from '@src/logger';

export const getAllUsers = async (_: Request, res: Response) => {
    try {
        const users = await userService.getAllUsers();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
}

export const getUserById = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.params.id);
        const user = await userService.getUserById(userId);
        if (user) {
            res.status(200).json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
}

export const createUser = async (req: Request, res: Response) => {
    try {
        const userData = req.body;
        const newUser = await userService.createUser(userData);
        res.status(201).json(newUser);
    } catch (error: any) {
        Logger.ERROR(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.params.id);
        const updateData = req.body;
        const updatedUser = await userService.updateUser(userId, updateData);
        if (updatedUser) {
            res.status(200).json(updatedUser);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.params.id);
        const deleted = await userService.deleteUser(userId);
        if (deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};