import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
// Standard pattern: Initialize in index, export getter or singleton here.
// But better: Create a class or simple module.

let io: Server;

export const initSocket = (server: any) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
    return io;
};

export const getIO = () => {
    if (!io) {
        // Safe fallback for scripts
        return {
            to: (room: string) => ({ emit: (ev: string, data: any) => console.log(`[SOCKET MOCK] Emit ${ev} to ${room}`) })
        } as any;
    }
    return io;
};
