import 'dotenv/config'; // Load env before anything else

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initSocket } from './socket';
import { prisma } from './db';

import userRoutes from './routes/userRoutes';
import campaignRoutes from './routes/campaignRoutes';

const app = express();
const httpServer = createServer(app);
const io = initSocket(httpServer);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`, req.body);
    next();
});

app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);

// Routes will go here
app.get('/', (req, res) => {
    res.send('Forge & Fury API is running');
});

// Socket.io integration
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinCampaign', (campaignId) => {
        socket.join(campaignId);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001; // Frontend is usually 3000 or 5173

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
