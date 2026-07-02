const fs = require('fs');

const content = fs.readFileSync('src/controllers/exam.controller.ts', 'utf-8');

const functions = [
  'createExam', 'getExamsByCourse', 'getExam', 'updateExam', 'deleteExam',
  'startExam', 'submitExam', 'getExamResults', 'getMyResult', 'getAllResultsByCourse',
  'getStudentResultsByCourse', 'getMyResultsByCourse', 'getAttemptWithAnswers',
  'updateAttemptMarks', 'evaluateAnswerWithAI', 'evaluateAttemptWithAI'
];

const parsedFunctions = {};

for (let i = 0; i < functions.length; i++) {
  const func = functions[i];
  const startStr = `export const ${func} = async`;
  const startIndex = content.indexOf(startStr);
  
  if (startIndex === -1) {
    console.error(`Could not find function ${func}`);
    continue;
  }
  
  let endIndex;
  if (i < functions.length - 1) {
    const nextFunc = functions[i + 1];
    const nextStartStr = `export const ${nextFunc} = async`;
    endIndex = content.indexOf(nextStartStr);
  } else {
    endIndex = content.length;
  }
  
  parsedFunctions[func] = content.slice(startIndex, endIndex);
}

const headerCommon = `import { Request, Response } from 'express';\nimport { validationResult } from 'express-validator';\nimport prisma from '../config/db';\n\n`;
const headerGrading = `import { Request, Response } from 'express';\nimport { validationResult } from 'express-validator';\nimport { spawn } from 'child_process';\nimport path from 'path';\nimport prisma from '../config/db';\n\n`;

const examContent = headerCommon + 
  parsedFunctions['createExam'] +
  parsedFunctions['getExamsByCourse'] +
  parsedFunctions['getExam'] +
  parsedFunctions['updateExam'] +
  parsedFunctions['deleteExam'];

const attemptContent = headerCommon +
  parsedFunctions['startExam'] +
  parsedFunctions['submitExam'] +
  parsedFunctions['getExamResults'] +
  parsedFunctions['getMyResult'] +
  parsedFunctions['getAllResultsByCourse'] +
  parsedFunctions['getStudentResultsByCourse'] +
  parsedFunctions['getMyResultsByCourse'] +
  parsedFunctions['getAttemptWithAnswers'];

const gradingContent = headerGrading +
  parsedFunctions['updateAttemptMarks'] +
  parsedFunctions['evaluateAnswerWithAI'] +
  parsedFunctions['evaluateAttemptWithAI'];

fs.writeFileSync('src/controllers/exam.controller.ts', examContent);
fs.writeFileSync('src/controllers/attempt.controller.ts', attemptContent);
fs.writeFileSync('src/controllers/grading.controller.ts', gradingContent);

console.log('Controllers refactored successfully.');
