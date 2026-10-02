import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';

// Import Routes
import authRoutes from './routes/auth';
import sosRoutes from './routes/sos';
import reportRoutes from './routes/reports';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*', // In production, restrict to frontend domain
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Attach io to req for routes to use (e.g. SOS dispatch)
app.use((req: any, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/reports', reportRoutes);

// Health Check
app.get('/', (req, res) => {
  res.json({ status: 'SafeChain Core API is running securely.' });
});

import { prisma } from './db';

// WebSocket Connection Handling
io.on('connection', (socket) => {
  console.log(`[SOCKET] User connected: ${socket.id}`);

  // 1. Guardian joins a specific tracking room
  socket.on('join_tracking_room', (trackingId) => {
    socket.join(trackingId);
    console.log(`[SOCKET] Guardian joined tracking room: ${trackingId}`);
  });

  // 2. User's phone sends live GPS updates
  socket.on('update_location', async (data) => {
    const { trackingId, location, battery, speed } = data;
    
    // Broadcast the exact location to guardians
    io.to(trackingId).emit('location_update', {
      location,
      battery,
      speed,
      timestamp: new Date().toISOString()
    });
    
    console.log(`[SOCKET] Broadcast & Saved to DB: ${trackingId} -> Lat ${location.lat}, Lng ${location.lng}`);

    // Persist this breadcrumb in the database
    try {
      const session = await prisma.sOSSession.findUnique({ where: { trackingId } });
      if (session) {
        await prisma.locationUpdate.create({
          data: {
            sessionId: session.id,
            lat: location.lat,
            lng: location.lng,
            battery,
            speed
          }
        });
      }
    } catch (err) {
      console.error("Failed to save live location to DB", err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`\n🛡️  SafeChain Core Backend Online`);
  console.log(`📡 WebSockets Active`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'Development'}`);
  console.log(`🚀 Port: ${PORT}\n`);
});
