#!/usr/bin/env node
/**
 * curate.js — Daily AI-impact news curator
 *
 * Fetches real stories from:
 *   - Hacker News (top stories, AI-keyword filtered)
 *   - OpenAI blog RSS
 *   - Google DeepMind blog RSS
 *
 * Outputs: data/daily.json
 *
 * Usage:
 *   node scripts/curate.js
 *
 * No auth required. All APIs are free and public.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

// Output goes inside public/data/ so GitHub Pages can serve it
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'daily.json');

const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'gemini',
  'machine learning', 'automation', 'layoff', 'hiring', 'robot',
  'openai', 'anthropic', 'deepmind', 'mistral', 'cohere', 'stability',
  'midjourney', 'copilot', 'cursor', 'devin', 'software engineer',
  'developer', 'programmer', 'coding', 'job', 'employment', 'workforce',
  'agent', 'agentic', 'model', 'foundation model', 'chatgpt', 'bard',
  'generative', 'neural', 'transformer', 'benchmark', 'autonomous'
];

const MAX_HN_STORIES = 30;     // How many HN top stories to fetch details for
const MAX_HN_RESULTS = 8;      // How many HN stories to include in output
const RSS_TIMEOUT_MS = 10000;  // RSS fetch timeout
const HN_FETCH_TIMEOUT = 5000; // Per-story HN fetch timeout

const RSS_FEEDS = [
  {
    name: 'OpenAI News',
    url: 'https://openai.com/news/rss.xml',
    sourceColor: '#4caf50'
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    sourceColor: '#e86533'
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    sourceColor: '#4a9eff'
  }
];

// ── HTTP fetch ────────────────────────────────────────────────────────────────

function fetch(url, timeoutMs = RSS_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'dude-were-so-cooked/1.0 (https://nemily.github.io/dude-were-so-cooked)'
      },
      timeout: timeoutMs
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', reject);
  });
}

// ── XML parser (minimal, no deps) ────────────────────────────────────────────

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description');
    if (title && link) {
      items.push({ title, link, pubDate, description });
    }
  }
  return items;
}

function extractTag(str, tag) {
  // Handles <tag>content</tag> and CDATA
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, 'is');
  const m = str.match(re);
  return m ? m[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') : '';
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── AI keyword filter ─────────────────────────────────────────────────────────

function isAIRelated(text) {
  const lower = (text || '').toLowerCase();
  return AI_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Format date for display ───────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ── Hacker News ───────────────────────────────────────────────────────────────

async function fetchHNStories() {
  console.log('[HN] Fetching top stories list...');
  let topIds;
  try {
    const data = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    topIds = JSON.parse(data).slice(0, MAX_HN_STORIES);
  } catch (e) {
    console.error('[HN] Failed to fetch top stories:', e.message);
    return [];
  }

  console.log(`[HN] Got ${topIds.length} story IDs, fetching details...`);
  const storyPromises = topIds.map(id =>
    fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, HN_FETCH_TIMEOUT)
      .then(data => JSON.parse(data))
      .catch(() => null)
  );

  const stories = (await Promise.all(storyPromises)).filter(Boolean);
  const aiStories = stories.filter(s => s && s.title && isAIRelated(s.title + ' ' + (s.url || '')));

  console.log(`[HN] Found ${aiStories.length} AI-related stories out of ${stories.length} fetched`);

  return aiStories.slice(0, MAX_HN_RESULTS).map(s => ({
    source: 'Hacker News',
    sourceColor: '#ff6600',
    time: fmtDate(new Date(s.time * 1000).toISOString()),
    headline: s.title,
    summary: `${s.score || 0} points · ${s.descendants || 0} comments on HN`,
    url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
    hnUrl: `https://news.ycombinator.com/item?id=${s.id}`,
    score: s.score || 0,
    type: 'hn'
  }));
}

// ── RSS feeds ─────────────────────────────────────────────────────────────────

async function fetchRSSFeed(feed) {
  console.log(`[RSS] Fetching ${feed.name}...`);
  try {
    const xml = await fetch(feed.url);
    const items = parseRSS(xml);
    const aiItems = items.filter(i => isAIRelated(i.title + ' ' + i.description));
    console.log(`[RSS] ${feed.name}: ${aiItems.length}/${items.length} AI-related`);

    return aiItems.slice(0, 5).map(i => ({
      source: feed.name,
      sourceColor: feed.sourceColor,
      time: fmtDate(i.pubDate),
      headline: i.title,
      summary: stripHtml(i.description || '').slice(0, 200) || null,
      url: i.link,
      type: 'rss'
    }));
  } catch (e) {
    console.error(`[RSS] ${feed.name} failed:`, e.message);
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== dude-were-so-cooked curator ===');
  console.log('Started:', new Date().toISOString());

  const [hnStories, ...rssResults] = await Promise.all([
    fetchHNStories(),
    ...RSS_FEEDS.map(fetchRSSFeed)
  ]);

  const rssStories = rssResults.flat();

  // Interleave: alternate HN and RSS so the feed is varied
  const allStories = [];
  const hnQueue = [...hnStories];
  const rssQueue = [...rssStories];

  // Put top 3 HN first, then interleave
  for (let i = 0; i < 3 && hnQueue.length; i++) allStories.push(hnQueue.shift());
  while (rssQueue.length || hnQueue.length) {
    if (rssQueue.length) allStories.push(rssQueue.shift());
    if (hnQueue.length) allStories.push(hnQueue.shift());
  }

  const output = {
    generatedAt: new Date().toISOString(),
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    storyCount: allStories.length,
    hnCount: hnStories.length,
    rssCount: rssStories.length,
    stories: allStories
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');

  console.log('\n=== Done ===');
  console.log(`Stories: ${allStories.length} (${hnStories.length} HN + ${rssStories.length} RSS)`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Generated: ${output.generatedAt}`);

  // Print summary for notification scripts
  console.log('\n--- SUMMARY ---');
  console.log(`${allStories.length} new AI stories today, ${hnStories.length} from HN, ${rssStories.length} from RSS feeds`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
