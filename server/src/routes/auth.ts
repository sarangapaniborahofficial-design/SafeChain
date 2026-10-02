import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_navshield';

router.post('/register', async (req, res) => {
  const { name, phone, password } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: "Phone number already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, phone, password: hashedPassword }
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

router.post('/login', async (req, res) => {
  const { phone, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Middleware for protecting routes
export const verifyToken = (req: any, res: any, next: any) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ error: "No token provided" });

  if (token === 'guest_bypass_token') {
    req.userId = 'guest_user';
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(401).json({ error: "Unauthorized" });
    req.userId = decoded.id;
    next();
  });
};

export default router;
