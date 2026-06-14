import { neonConfig, Client } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();

// Configure WebSockets for Node.js
neonConfig.webSocketConstructor = ws;

async function run() {
  const client = new Client(process.env.DATABASE_URL);
  try {
    console.log("🔌 Connecting to Neon DB...");
    await client.connect();

    console.log("🛠️  Adding column 'isGraded' if not exists...");
    await client.query(`ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "isGraded" BOOLEAN NOT NULL DEFAULT FALSE;`);

    console.log("🚀 Migrating data: setting 'isGraded' to true where 'score' is not null...");
    await client.query(`UPDATE "ExamAttempt" SET "isGraded" = TRUE WHERE "score" IS NOT NULL;`);

    console.log("✅ Database schema migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
