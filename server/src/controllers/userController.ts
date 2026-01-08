import { Request, Response } from 'express';
import { prisma } from '../db';
import bcrypt from 'bcryptjs';

export const register = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        const existingUser = await prisma.user.findUnique({
            where: { username },
        });

        if (existingUser) {
            res.status(400).json({ error: 'Username already exists' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                passwordHash,
            },
        });

        // Don't return the hash
        const { passwordHash: _, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { username },
        });

        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);

        if (!isMatch) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true
            }
        });
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const enterWorld = async (req: Request, res: Response) => {
    // Find or Create user without explicit password (use default)
    try {
        const { username } = req.body;
        if (!username) {
            res.status(400).json({ error: "Name is required" });
            return;
        }

        let user = await prisma.user.findUnique({ where: { username } });

        if (!user) {
            // Create
            const passwordHash = await bcrypt.hash('password123', 10);
            user = await prisma.user.create({
                data: { username, passwordHash }
            });
        }

        // Return user
        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);

    } catch (error) {
        console.error('Enter world error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
