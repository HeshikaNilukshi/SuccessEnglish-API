import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/db';

async function testApi() {
  console.log('Testing AI Evaluation Endpoint...');

  // 1. We will use Attempt ID 3
  const attemptId = 3;

  console.log(`Evaluating all answers for Attempt ID: ${attemptId}`);

  // 2. Login as admin/teacher to get token
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dave@gmail.com', password: '652423' })
  });

  if (!loginRes.ok) {
    const err = await loginRes.text();
    console.error('Login failed:', err);
    process.exit(1);
  }

  const { token } = (await loginRes.json()) as { token: string };
  console.log('Successfully logged in as Teacher!');

  // 3. Call batch evaluate endpoint
  console.log(`Calling POST /api/exams/attempt/${attemptId}/evaluate-ai...`);
  const evalRes = await fetch(`http://localhost:5000/api/exams/attempt/${attemptId}/evaluate-ai`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!evalRes.ok) {
    const err = await evalRes.text();
    console.error('Evaluation failed:', evalRes.status, err);
    process.exit(1);
  }

  const result = await evalRes.json();
  console.log('\n--- AI Evaluation Result ---');
  console.log(JSON.stringify(result, null, 2));
  console.log('----------------------------\n');

  console.log('API Test completed successfully!');
}

testApi()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
