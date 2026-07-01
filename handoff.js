#!/usr/bin/env node
/**
 * HANDOFF SCRIPT
 * Run this to hand off work to Claude CLI when context limit is near.
 * Usage: node handoff.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const handoffFile = path.join(__dirname, 'HANDOFF.md');
const handoffContent = fs.readFileSync(handoffFile, 'utf-8');

const prompt = `
You are an AI coding assistant continuing a project for a user named Vansh.
Read the following HANDOFF document carefully — it contains everything you need to know.
After reading it, start executing the "WHAT NEEDS TO BE DONE NEXT" section from the top.

Begin by creating the folder structure and then build each file one by one.
Ask Vansh for clarification ONLY if something is genuinely ambiguous.
Do NOT ask about things that are already documented in the handoff.

IMPORTANT RULES:
- Never push code to GitHub without asking Vansh first.
- For Diggaj Realty repo: only commit, never push (Vansh pushes manually).
- The old bot at "d:\\whatsapp chatbot\\" must NOT be modified.
- New code goes in "d:\\whatsapp chatbot multi\\"
- No voice/TTS (ElevenLabs removed by design)
- Dashboard must look premium — dark mode, glassmorphism

---HANDOFF DOCUMENT START---
${handoffContent}
---HANDOFF DOCUMENT END---

Start with Step 1: Create the folder structure and package.json for the AI server.
`;

console.log('🤖 Handing off to Claude CLI...\n');

try {
    // Write prompt to temp file to avoid shell escaping issues
    const tmpFile = path.join(__dirname, '.handoff_prompt.txt');
    fs.writeFileSync(tmpFile, prompt, 'utf-8');
    
    // Call Claude CLI
    execSync(`claude --print < "${tmpFile}"`, { 
        stdio: 'inherit',
        shell: true 
    });
    
    // Cleanup
    fs.unlinkSync(tmpFile);
} catch (e) {
    console.error('Claude CLI not found or error:', e.message);
    console.log('\nAlternative: Copy and paste the content of HANDOFF.md into a new Claude conversation.');
}
