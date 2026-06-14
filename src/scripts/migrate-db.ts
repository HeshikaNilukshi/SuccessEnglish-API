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

    console.log("🛠️  Adding column 'isCorrect' if not exists...");
    await client.query(`ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "isCorrect" BOOLEAN DEFAULT NULL;`);

    console.log("🚀 Migrating data: mapping 'awardedMarks' to 'isCorrect'...");
    // If awardedMarks > 0, set isCorrect = true. If awardedMarks == 0, set isCorrect = false. Else null.
    // We check if awardedMarks column exists first.
    const checkCol = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='Answer' AND column_name='awardedMarks';
    `);

    if (checkCol.rows.length > 0) {
      await client.query(`
        UPDATE "Answer" 
        SET "isCorrect" = CASE 
          WHEN "awardedMarks" > 0 THEN TRUE 
          WHEN "awardedMarks" = 0 THEN FALSE 
          ELSE NULL 
        END;
      `);
      
      console.log("🗑️  Dropping old column 'awardedMarks'...");
      await client.query(`ALTER TABLE "Answer" DROP COLUMN IF EXISTS "awardedMarks";`);
    } else {
      console.log("⚠️  'awardedMarks' column does not exist. Skipping migration of data.");
    }

    console.log("✅ Database schema migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
