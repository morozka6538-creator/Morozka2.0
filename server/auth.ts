import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';
import { sendWelcomeEmail } from './emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'morozka-secret-key';

export async function registerUser(email: string, password: string, username: string) {
  const db = getDb();
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const result = await db.run(
      'INSERT INTO users (email, password, username) VALUES (?, ?, ?)',
      [email, hashedPassword, username]
    );
    
    // Send email in background
    sendWelcomeEmail(email, username).catch(err => console.error('Failed to send email:', err));

    return { id: result.lastID, email, username, is_admin: 0, is_blocked: 0 };
  } catch (error) {
    throw new Error('User already exists or database error');
  }
}

export async function loginUser(email: string, password: string) {
  const db = getDb();
  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  if (user.is_blocked === 1) {
    throw new Error('This account has been blocked by an administrator.');
  }

  const token = jwt.sign({ id: user.id, email: user.email, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '24h' });
  return { token, user: { id: user.id, email: user.email, username: user.username, is_admin: !!user.is_admin, is_blocked: !!user.is_blocked } };
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; email: string };
  } catch (error) {
    return null;
  }
}
