
// Run with: npx tsx server/test-client.ts

async function testBackend() {
    const API_URL = 'http://127.0.0.1:3000/api';

    async function post(url: string, body: any) {
        const res = await fetch(`${API_URL}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed ${url}: ${res.status} ${txt}`);
        }
        return res.json();
    }

    try {
        console.log("1. Registering User A...");
        const userA = await post('/users/register', { username: 'hero1', password: 'password123' }).catch(() => post('/users/login', { username: 'hero1', password: 'password123' }));
        console.log("User A:", userA.id);

        console.log("2. Creating Campaign...");
        const campaign = await post('/campaigns', {
            name: 'Test Setup',
            config: { numParticipants: 1, workoutsPerWeek: 3, totalWeeks: 4 },
            userId: userA.id,
            participantsNames: ['Hero 1']
        });
        console.log("Campaign Created:", campaign.id, "First Enemy:", campaign.enemies[0].name);

        console.log("3. Logging Workout...");
        const p1 = campaign.participants[0];
        const updatedP1 = await post('/campaigns/workout', { campaignId: campaign.id, participantId: p1.id });
        console.log("Workout Logged. Total:", updatedP1.totalWorkouts);

        console.log("4. Attacking...");
        const attackRes = await post('/campaigns/action', { campaignId: campaign.id, participantId: p1.id, type: 'attack' });
        console.log("Attack Result:", attackRes);

        console.log("Verification Complete: Success!");
    } catch (e) {
        console.error("Verification Failed:", e);
        process.exit(1);
    }
}

testBackend();
