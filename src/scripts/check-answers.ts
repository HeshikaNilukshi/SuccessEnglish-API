import { neonConfig, Client } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();

// Configure WebSockets for Node.js
neonConfig.webSocketConstructor = ws;

async function run() {
  const client = new Client(process.env.DATABASE_URL);
  try {
    await client.connect();
    const res = await client.query('SELECT id, "studentAnswer", "isCorrect" FROM "Answer";');
    console.log("Answers in DB:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
