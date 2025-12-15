import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
const authService = new AuthService();

// Rate limiters
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }); // 30 requests per 10 minutes per IP
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }); // 5 registrations per hour per IP

// Public auth endpoints
router.post('/register', registerLimiter, async (req, res) => {
	const { username, password, role } = req.body;
	try {
		await authService.register(username, password, role || 'User');
		const user = await authService.login(username, password);
		if (!user) return res.status(500).json({ error: 'Unable to create user' });
		const token = authService.generateToken(user);
		res.status(201).json({ token, user });
	} catch (err: any) {
		res.status(400).json({ error: err.message || 'Error registering' });
	}
});

router.post('/login', loginLimiter, async (req, res) => {
	const { username, password } = req.body;
	try {
		const user = await authService.login(username, password);
		if (!user) return res.status(401).json({ error: 'Invalid credentials' });
		const token = authService.generateToken(user);
		res.status(200).json({ token, user });
	} catch (err) {
		res.status(500).json({ error: 'Error logging in' });
	}
});

router.post('/change-password', requireAuth, async (req, res) => {
	const { currentPassword, newPassword } = req.body;
	const userId = (req as any).user?.id;
	
	if (!userId || !currentPassword || !newPassword) {
		return res.status(400).json({ error: 'Missing required fields' });
	}
	
	if (newPassword.length < 6) {
		return res.status(400).json({ error: 'New password must be at least 6 characters' });
	}
	
	try {
		const success = await authService.changePassword(userId, currentPassword, newPassword);
		if (!success) {
			return res.status(401).json({ error: 'Current password is incorrect' });
		}
		res.status(200).json({ message: 'Password changed successfully' });
	} catch (err) {
		res.status(500).json({ error: 'Error changing password' });
	}
});

// Protected CRUD endpoints
router.get('/', requireAuth, async (req, res) => {
	try {
		const users = await getAllUsers();
		res.json(users);
	} catch (err) {
		res.status(500).json({ error: 'Failed to get users' });
	}
});

router.get('/:id', requireAuth, async (req, res) => {
	try {
		const user = await getUserById(Number(req.params.id));
		res.json(user);
	} catch (err) {
		res.status(500).json({ error: 'Failed to get user' });
	}
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
	try {
		const created = await createUser(req.body as any);
		res.status(201).json(created);
	} catch (err: any) {
		res.status(400).json({ error: err.message || 'Failed to create user' });
	}
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
	try {
		const updated = await updateUser(Number(req.params.id), req.body as any);
		res.json(updated);
	} catch (err: any) {
		res.status(400).json({ error: err.message || 'Failed to update user' });
	}
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
	try {
		const ok = await deleteUser(Number(req.params.id));
		res.json({ success: ok });
	} catch (err) {
		res.status(500).json({ error: 'Failed to delete user' });
	}
});

export default router;