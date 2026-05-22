import { neonConfig, Client } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

// Configure WebSockets for Node.js
neonConfig.webSocketConstructor = ws;

async function run() {
  try {
    console.log("🛠️  Generating database DDL from schema.prisma...");
    const rawSql = execSync("npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script").toString();
    
    // Reset schema to avoid "duplicate object" or conflict errors on subsequent runs
    const sql = `DROP SCHEMA IF EXISTS "public" CASCADE;\nCREATE SCHEMA "public";\n${rawSql}`;
    
    console.log("🔌 Connecting to Neon DB via WebSockets (Bypassing Port 5432 Block)...");
    const client = new Client(process.env.DATABASE_URL);
    await client.connect();
    
    console.log("🚀 Executing migration SQL scripts on Neon DB...");
    await client.query(sql);
    console.log("✅ Database schema successfully updated! All tables and indexes synced.");
    
    await client.end();
  } catch (err) {
    console.error("❌ Failed to push database schema:", err);
    process.exit(1);
  }
}

run();
