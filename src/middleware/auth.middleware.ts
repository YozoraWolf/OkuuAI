import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayloadCustom {
  sub: number;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Should be enforced at startup; if missing, reject.
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    // If browser expecting HTML, redirect to login page
    if (req.headers.accept && (req.headers.accept as string).includes('text/html')) {
      return res.redirect('/okuu-control-center/login');
    }
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const parts = (authHeader as string).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    if (req.headers.accept && (req.headers.accept as string).includes('text/html')) {
      return res.redirect('/okuu-control-center/login');
    }
    return res.status(401).json({ error: 'Malformed Authorization header' });
  }
  const token = parts[1];
  try {
    const payload = jwt.verify(token, jwtSecret) as unknown as JwtPayloadCustom;
    (req as any).user = { id: payload.sub, username: payload.username, role: payload.role };
    next();
  } catch (err) {
    if (req.headers.accept && (req.headers.accept as string).includes('text/html')) {
      return res.redirect('/okuu-control-center/login');
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

export default requireAuth;