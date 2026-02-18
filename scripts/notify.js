#!/usr/bin/env node
/**
 * notify.js — Post Discord notification for morning/afternoon briefings
 *
 * Usage:
 *   node scripts/notify.js
 *
 * Reads Discord webhook URL from ~/.claude/discord-webhook.txt
 * Reads story count from data/daily.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const PROJECT_DIR = path.join(__dirname, '..');
const WEBHOOK_FILE = path.join(os.homedir(), '.claude', 'discord-webhook.txt');
const DATA_FILE = path.join(PROJECT_DIR, 'public', 'data', 'daily.json');
const SITE_URL = 'https://nemily.github.io/dude-were-so-cooked/';

// Read webhook URL
if (!fs.existsSync(WEBHOOK_FILE)) {
  console.error(`ERROR: No Discord webhook found at ${WEBHOOK_FILE}`);
  console.error('Create the file with your webhook URL to enable notifications.');
  process.exit(1);
}

const webhookUrl = fs.readFileSync(WEBHOOK_FILE, 'utf8').trim();
if (!webhookUrl) {
  console.error(`ERROR: Discord webhook file is empty: ${WEBHOOK_FILE}`);
  process.exit(1);
}

// Read story data
let storyCount = 0;
let hnCount = 0;
let rssCount = 0;

if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    storyCount = data.storyCount || 0;
    hnCount = data.hnCount || 0;
    rssCount = data.rssCount || 0;
  } catch (e) {
    console.warn('Could not read daily.json:', e.message);
  }
}

// Build message
const hour = new Date().getHours();
const timeLabel = hour < 12 ? 'Morning' : 'Afternoon';
const summary = `${storyCount} AI stories today · ${hnCount} from Hacker News · ${rssCount} from RSS`;

const message = `**dude we're so cooked** — ${timeLabel} Briefing\n\n${summary}\n\n${SITE_URL}`;

// Post to Discord
const payload = JSON.stringify({ content: message });

let url;
try {
  url = new URL(webhookUrl);
} catch (e) {
  console.error('ERROR: Discord webhook URL is invalid:', webhookUrl);
  console.error('Check the contents of', WEBHOOK_FILE);
  process.exit(1);
}
const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    if (res.statusCode === 204 || res.statusCode === 200) {
      console.log(`Discord notification sent (HTTP ${res.statusCode})`);
      console.log(`Message: ${message}`);
    } else {
      console.error(`ERROR: Discord notification failed (HTTP ${res.statusCode}): ${body}`);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('ERROR sending Discord notification:', e.message);
  process.exit(1);
});

req.write(payload);
req.end();
