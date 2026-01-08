import { io, Socket } from 'socket.io-client';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const socket: Socket = io(SOCKET_URL, {
    autoConnect: false // Connect manually when needed
});

export const api = {
    // Auth
    getUsers: async () => {
        const res = await fetch(`${API_URL}/users`);
        if (!res.ok) throw await res.json();
        return res.json();
    },
    register: async (username: string, password: string) => {
        const res = await fetch(`${API_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    login: async (username: string, password: string) => {
        const res = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    // Campaign
    createCampaign: async (name: string, config: any, participantsNames: string[], initialEnemy?: { name: string, description: string }) => {
        const res = await fetch(`${API_URL}/campaigns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, config, participantsNames, initialEnemy })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    joinCampaign: async (campaignId: string, userId: string, characterName: string) => {
        const res = await fetch(`${API_URL}/campaigns/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId, userId, characterName })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    enterWorld: async (username: string) => {
        const res = await fetch(`${API_URL}/users/enter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    getAllCampaigns: async () => {
        const res = await fetch(`${API_URL}/campaigns`);
        if (!res.ok) throw await res.json();
        return res.json();
    },



    getCampaign: async (id: string) => {
        const res = await fetch(`${API_URL}/campaigns/${id}`);
        if (!res.ok) throw await res.json();
        return res.json();
    },

    deleteCampaign: async (id: string) => {
        const res = await fetch(`${API_URL}/campaigns/${id}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    getDefaultCampaign: async () => {
        const res = await fetch(`${API_URL}/campaigns/default`);
        if (!res.ok) throw await res.json();
        return res.json();
    },

    // Game Actions
    logWorkout: async (campaignId: string, participantId: string) => {
        const res = await fetch(`${API_URL}/campaigns/workout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId, participantId })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    performAction: async (campaignId: string, participantId: string, type: 'attack') => {
        const res = await fetch(`${API_URL}/campaigns/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId, participantId, type })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    enlistHero: async (campaignId: string, name: string) => {
        const res = await fetch(`${API_URL}/campaigns/${campaignId}/enlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    forgeAhead: async (campaignId: string) => {
        const res = await fetch(`${API_URL}/campaigns/${campaignId}/forge-ahead`, {
            method: 'POST'
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    retireHero: async (campaignId: string, participantId: string) => {
        const res = await fetch(`${API_URL}/campaigns/${campaignId}/participant/${participantId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    undoLastAction: async (campaignId: string, participantId: string) => {
        const res = await fetch(`${API_URL}/campaigns/undo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId, participantId })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    renameEnemy: async (campaignId: string, order: number, name: string, description: string) => {
        const res = await fetch(`${API_URL}/campaigns/${campaignId}/rename-enemy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order, name, description })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    }
};
