#!/usr/bin/env node
/**
 * synthesize.js — AI digest layer
 *
 * Reads data/enriched.json (from curate.js) and calls claude -p --model haiku
 * to produce public/data/digest.md — a narrative synthesis of today's AI landscape.
 *
 * Digest is consumed by twitter-agent for context-aware replies
 * and readable by Emily in Obsidian as a daily briefing.
 *
 * If synthesis fails, exits with code 0 — digest is additive, not blocking.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENRICHED_FILE = path.join(__dirname, '..', 'data', 'enriched.json');
const DIGEST_FILE = path.join(__dirname, '..', 'public', 'data', 'digest.md');

function buildPrompt(enrichedData) {
  const stories = enrichedData.stories;

  // Build story summaries for the prompt
  const storyBlocks = stories.map((s, i) => {
    let block = `${i + 1}. [${s.source}] "${s.headline}"`;
    block += `\n   URL: ${s.url}`;
    if (s.score) block += `\n   HN Score: ${s.score} | Comments: ${s.commentCount}`;
    if (s.topComments && s.topComments.length > 0) {
      block += '\n   Top HN comments:';
      s.topComments.forEach(c => {
        block += `\n   - "${c.slice(0, 300)}"`;
      });
    }
    if (s.fullDescription) {
      block += `\n   Description: ${s.fullDescription.slice(0, 500)}`;
    }
    return block;
  }).join('\n\n');

  return `You are a sharp AI industry analyst writing a daily digest for a software engineer who builds AI coding agents. She reads this to stay current and to reply intelligently to tweets about AI.

Today's curated stories (${stories.length} total, from HN and RSS feeds):

${storyBlocks}

Write a digest in this EXACT markdown format:

# AI Digest — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

## What's Happening Right Now
(2-3 paragraphs. Narrative synthesis — what's the story of TODAY in AI? Connect the dots across stories. Write like you're catching up a smart friend, not writing a press release. Be specific about what happened and why it matters.)

## Key Stories
(For each significant story:)
### [headline]
- **Source**: [source name + link]
- **Why it matters**: (1-2 sentences — not summary, but significance)
- **HN sentiment**: (what commenters think — skeptical? excited? mixed? Include specific takes if interesting)
- **Keywords**: (comma-separated terms people would actually tweet about this — informal, the way Twitter users would reference it)

## Themes & Tensions
(2-4 cross-cutting patterns you see. What are the big tensions playing out across these stories? e.g., "open vs closed source", "capability vs safety", "developer productivity vs job displacement")

## Context for Replies
(Pre-computed bridging context. For each major topic, write a sentence like: "If someone tweets about X, they're probably referencing Y — the key context is Z." This section should make it trivially easy to reply to tweets about today's news.)

IMPORTANT:
- Be concrete and specific, never vague
- Use real names, numbers, and details from the stories
- Keywords should be informal Twitter-speak, not formal tags
- The "Context for Replies" section is the most operationally important — make it rich
- Keep the whole digest under 2000 words`;
}

function main() {
  console.log('=== synthesize.js ===');

  if (!fs.existsSync(ENRICHED_FILE)) {
    console.log('No enriched.json found. Run curate.js first.');
    console.log('Skipping synthesis (non-blocking).');
    return;
  }

  const enrichedData = JSON.parse(fs.readFileSync(ENRICHED_FILE, 'utf8'));
  if (!enrichedData.stories || enrichedData.stories.length === 0) {
    console.log('Enriched data has no stories. Skipping synthesis.');
    return;
  }

  console.log(`Synthesizing digest from ${enrichedData.stories.length} stories...`);
  const prompt = buildPrompt(enrichedData);

  try {
    const result = execSync(
      'claude -p --output-format text --model haiku',
      {
        input: prompt,
        cwd: process.env.HOME || process.env.USERPROFILE || '.',
        timeout: 120000,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDECODE: '' },
      }
    );

    const digest = result.trim();
    if (!digest || digest.length < 100) {
      console.error('Synthesis returned empty or too-short result. Skipping.');
      return;
    }

    const digestDir = path.dirname(DIGEST_FILE);
    if (!fs.existsSync(digestDir)) fs.mkdirSync(digestDir, { recursive: true });
    fs.writeFileSync(DIGEST_FILE, digest, 'utf8');

    console.log(`Digest written to ${DIGEST_FILE} (${digest.length} chars)`);
  } catch (e) {
    console.error('Synthesis failed:', e.message);
    console.log('Continuing without digest (non-blocking).');
  }
}

main();
