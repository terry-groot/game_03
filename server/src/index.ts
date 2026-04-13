import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { registerHandlers } from './socketHandlers';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = express();
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: [CORS_ORIGIN, 'http://localhost:5173', 'http://localhost:4173'],
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

app.use(cors({ origin: [CORS_ORIGIN, 'http://localhost:5173'] }));
app.use(express.json());

// Serve built client in production
// In production (after `npm run build`), client is copied to server/dist/public
// In development, Vite runs separately on port 5173
const isProd = process.env.NODE_ENV === 'production';
const clientDist = isProd
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../../client/dist');

app.use(express.static(clientDist));
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

registerHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`🀄 Mahjong server running on http://localhost:${PORT}`);
});
