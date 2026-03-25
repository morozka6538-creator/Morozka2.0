import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, getDb } from './db.js';
import { loginUser, registerUser, verifyToken } from './auth.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // In production, restrict this to your frontend URL
    methods: ['GET', 'POST']
  }
});

const users = new Map<number, string>(); // userId -> socketId

app.use(cors());
app.use(express.json());

// Serves static files from the React app
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// API Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    const newUser = await registerUser(email, password, username);
    
    // Notify all clients about new user
    io.emit('user-registered', { id: newUser.id, username: newUser.username });

    res.json({ message: 'User registered successfully', user: newUser });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const db = getDb();
    const users = await db.all('SELECT id, username, avatar, is_blocked FROM users ORDER BY username ASC');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/user/avatar', async (req, res) => {
  try {
    const { userId, avatar } = req.body;
    const db = getDb();
    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId]);
    
    // Notify all clients about avatar update
    io.emit('user-updated', { id: userId, avatar });
    
    res.json({ message: 'Avatar updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

// Admin Routes
app.post('/api/admin/block', async (req, res) => {
  try {
    const { adminId, targetId } = req.body;
    const db = getDb();
    
    // Safety: Verify requester is admin
    const admin = await db.get('SELECT is_admin FROM users WHERE id = ?', [adminId]);
    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    await db.run('UPDATE users SET is_blocked = 1 WHERE id = ?', [targetId]);
    
    // Notify target user via socket to force log out
    const targetSocketId = users.get(Number(targetId));
    if (targetSocketId) {
      io.to(targetSocketId).emit('account-blocked');
      io.sockets.sockets.get(targetSocketId)?.disconnect();
    }
    
    // Broadcast status update to all so UI updates
    io.emit('user-updated', { id: targetId, is_blocked: 1 });
    
    res.json({ message: 'User blocked successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/unblock', async (req, res) => {
  try {
    const { adminId, targetId } = req.body;
    const db = getDb();
    
    const admin = await db.get('SELECT is_admin FROM users WHERE id = ?', [adminId]);
    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    await db.run('UPDATE users SET is_blocked = 0 WHERE id = ?', [targetId]);
    io.emit('user-updated', { id: targetId, is_blocked: 0 });
    
    res.json({ message: 'User unblocked successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Route for History
app.get('/api/messages/:userId/:otherId', async (req, res) => {
  try {
    const { userId, otherId } = req.params;
    const db = getDb();
    const messages = await db.all(
      `SELECT * FROM messages 
       WHERE (sender_id = ? AND receiver_id = ?) 
       OR (sender_id = ? AND receiver_id = ?) 
       ORDER BY timestamp ASC`,
      [userId, otherId, otherId, userId]
    );
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO Logic

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('identify', (userId: number) => {
    users.set(userId, socket.id);
    console.log(`User ${userId} identified with socket ${socket.id}`);
  });

  socket.on('send-message', async (data: { senderId: number; receiverId: number; content: string; replyToId?: number; tempId?: string }) => {
    const db = getDb();
    
    // Check if sender is blocked
    const sender = await db.get('SELECT is_blocked FROM users WHERE id = ?', [data.senderId]);
    if (sender?.is_blocked) {
      socket.emit('error', { message: 'Your account is blocked.' });
      socket.disconnect();
      return;
    }

    const result = await db.run(
      'INSERT INTO messages (sender_id, receiver_id, content, reply_to_id) VALUES (?, ?, ?, ?)',
      [data.senderId, data.receiverId, data.content, data.replyToId || null]
    );

    const fullMessage = { ...data, id: result.lastID, sender_id: data.senderId, timestamp: new Date().toISOString() };
    const receiverSocketId = users.get(data.receiverId);
    if (receiverSocketId && receiverSocketId !== socket.id) {
      io.to(receiverSocketId).emit('new-message', fullMessage);
    }
    // Acknowledge back to sender with the ID and original tempId
    socket.emit('message-sent-ack', { ...fullMessage, tempId: data.tempId });
  });

  socket.on('delete-message', async (data: { messageId: number; userId: number }) => {
    console.log(`[Delete] Attempt to delete ${data.messageId} by user ${data.userId}`);
    const db = getDb();
    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [data.messageId]);
    
    if (msg) {
      console.log(`[Delete] Message found. Sender: ${msg.sender_id}, Requester: ${data.userId}`);
      if (Number(msg.sender_id) === Number(data.userId)) {
        await db.run('DELETE FROM messages WHERE id = ?', [data.messageId]);
        console.log(`[Delete] Success: ${data.messageId} deleted`);
        io.emit('message-deleted', data.messageId);
      } else {
        console.log(`[Delete] Denied: Unauthorized`);
      }
    } else {
      console.log(`[Delete] Denied: Message not found`);
    }
  });

  // Signaling for WebRTC
  socket.on('call-user', (data: { userToCall: number; signalData: any; from: number }) => {
    const receiverSocketId = users.get(data.userToCall);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call-incoming', { signal: data.signalData, from: data.from });
    }
  });

  socket.on('answer-call', (data: { to: number; signal: any }) => {
    const callerSocketId = users.get(data.to);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call-accepted', data.signal);
    }
  });

  socket.on('reject-call', (data: { to: number }) => {
    const callerSocketId = users.get(data.to);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call-rejected');
    }
  });

  socket.on('end-call', (data: { to: number }) => {
    const receiverSocketId = users.get(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call-ended');
    }
  });

  socket.on('call-signal', (data: { to: number; signal: any }) => {
    const receiverSocketId = users.get(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call-signal', { signal: data.signal, from: socket.id });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [userId, socketId] of users.entries()) {
      if (socketId === socket.id) {
        users.delete(userId);
        break;
      }
    }
  });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3001;

initDb().then(() => {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
});
