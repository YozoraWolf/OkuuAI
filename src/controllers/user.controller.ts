import express from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export const userController = express.Router();

userController.post('/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  try {
    await authService.register(username, password, role);
    // Auto-login after register
    const user = await authService.login(username, password);
    if (!user) {
      return res.status(500).json({ error: 'Registered but unable to login' });
    }
    const token = authService.generateToken(user);
    res.status(201).json({ token, user });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

userController.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  try {
    const user = await authService.login(username, password);
    if (user) {
      const token = authService.generateToken(user);
      res.status(200).json({ token, user });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
});