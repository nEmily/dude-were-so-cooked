#!/usr/bin/env node
/**
 * curate.js — Daily AI-impact news curator
 *
 * Fetches real stories from:
 *   - Hacker News (top stories, AI-keyword filtered)
 *   - OpenAI blog RSS
 *   - Google DeepMind blog RSS
 *
 * Outputs: public/data/daily.json + data/enriched.json (for synthesis)
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
// Date-keyed files for historical browsing: public/data/YYYY-MM-DD.json
// Legacy daily.json is kept in sync for backwards compat
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'daily.json');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const ENRICHED_FILE = path.join(__dirname, '..', 'data', 'enriched.json');

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
const MAX_HN_COMMENTS = 5;     // Top comments to fetch per story (for enriched output)
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

async function fetchHNComments(story) {
  if (!story.kids || story.kids.length === 0) return [];
  const commentIds = story.kids.slice(0, MAX_HN_COMMENTS);
  const commentPromises = commentIds.map(id =>
    fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, HN_FETCH_TIMEOUT)
      .then(data => JSON.parse(data))
      .catch(() => null)
  );
  const comments = (await Promise.all(commentPromises)).filter(Boolean);
  return comments
    .filter(c => c.text && !c.deleted && !c.dead)
    .map(c => stripHtml(c.text).slice(0, 500));
}

async function fetchHNStories() {
  console.log('[HN] Fetching top stories list...');
  let topIds;
  try {
    const data = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    topIds = JSON.parse(data).slice(0, MAX_HN_STORIES);
  } catch (e) {
    console.error('[HN] Failed to fetch top stories:', e.message);
    return { dashboard: [], enriched: [] };
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

  const selected = aiStories.slice(0, MAX_HN_RESULTS);

  // Fetch comments in parallel for enriched output
  console.log(`[HN] Fetching top comments for ${selected.length} stories...`);
  const commentsPerStory = await Promise.all(selected.map(s => fetchHNComments(s)));

  const dashboard = selected.map(s => ({
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

  const enriched = selected.map((s, i) => ({
    source: 'Hacker News',
    headline: s.title,
    url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
    hnUrl: `https://news.ycombinator.com/item?id=${s.id}`,
    score: s.score || 0,
    commentCount: s.descendants || 0,
    topComments: commentsPerStory[i],
    type: 'hn'
  }));

  return { dashboard, enriched };
}

// ── RSS feeds ─────────────────────────────────────────────────────────────────

async function fetchRSSFeed(feed) {
  console.log(`[RSS] Fetching ${feed.name}...`);
  try {
    const xml = await fetch(feed.url);
    const items = parseRSS(xml);
    const aiItems = items.filter(i => isAIRelated(i.title + ' ' + i.description));
    console.log(`[RSS] ${feed.name}: ${aiItems.length}/${items.length} AI-related`);

    const selected = aiItems.slice(0, 5);

    const dashboard = selected.map(i => ({
      source: feed.name,
      sourceColor: feed.sourceColor,
      time: fmtDate(i.pubDate),
      headline: i.title,
      summary: stripHtml(i.description || '').slice(0, 200) || null,
      url: i.link,
      type: 'rss'
    }));

    const enriched = selected.map(i => ({
      source: feed.name,
      headline: i.title,
      url: i.link,
      fullDescription: stripHtml(i.description || ''),
      type: 'rss'
    }));

    return { dashboard, enriched };
  } catch (e) {
    console.error(`[RSS] ${feed.name} failed:`, e.message);
    return { dashboard: [], enriched: [] };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== dude-were-so-cooked curator ===');
  console.log('Started:', new Date().toISOString());

  const [hnResult, ...rssResults] = await Promise.all([
    fetchHNStories(),
    ...RSS_FEEDS.map(fetchRSSFeed)
  ]);

  const hnDashboard = hnResult.dashboard;
  const rssDashboard = rssResults.flatMap(r => r.dashboard);

  // Interleave: alternate HN and RSS so the feed is varied
  const allStories = [];
  const hnQueue = [...hnDashboard];
  const rssQueue = [...rssDashboard];

  // Put top 3 HN first, then interleave
  for (let i = 0; i < 3 && hnQueue.length; i++) allStories.push(hnQueue.shift());
  while (rssQueue.length || hnQueue.length) {
    if (rssQueue.length) allStories.push(rssQueue.shift());
    if (hnQueue.length) allStories.push(hnQueue.shift());
  }

  const now = new Date();
  // Date key in local-ish format: use ISO date portion of UTC (cron runs during day, close enough)
  const dateKey = now.toISOString().slice(0, 10); // e.g. "2026-02-24"

  const output = {
    generatedAt: now.toISOString(),
    date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    dateKey,
    storyCount: allStories.length,
    hnCount: hnDashboard.length,
    rssCount: rssDashboard.length,
    stories: allStories
  };

  // Write legacy daily.json (backwards compat)
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');

  // Write date-keyed file: public/data/2026-02-24.json
  const dateFile = path.join(DATA_DIR, dateKey + '.json');
  fs.writeFileSync(dateFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Date file: ${dateFile}`);

  // Update index.json: list of available date keys, newest first
  let indexData = { dates: [] };
  if (fs.existsSync(INDEX_FILE)) {
    try { indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); } catch {}
  }
  // Add today if not already present, dedupe, sort newest first
  const dateSet = new Set(indexData.dates || []);
  dateSet.add(dateKey);
  indexData.dates = Array.from(dateSet).sort().reverse();
  indexData.updatedAt = now.toISOString();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf8');
  console.log(`Index updated: ${indexData.dates.length} dates available`);

  // Write enriched output for synthesis
  const enrichedOutput = {
    generatedAt: new Date().toISOString(),
    stories: [
      ...hnResult.enriched,
      ...rssResults.flatMap(r => r.enriched)
    ]
  };

  const enrichedDir = path.dirname(ENRICHED_FILE);
  if (!fs.existsSync(enrichedDir)) fs.mkdirSync(enrichedDir, { recursive: true });
  fs.writeFileSync(ENRICHED_FILE, JSON.stringify(enrichedOutput, null, 2), 'utf8');

  console.log('\n=== Done ===');
  console.log(`Stories: ${allStories.length} (${hnDashboard.length} HN + ${rssDashboard.length} RSS)`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Enriched: ${ENRICHED_FILE}`);
  console.log(`Generated: ${output.generatedAt}`);

  // Print summary for notification scripts
  console.log('\n--- SUMMARY ---');
  console.log(`${allStories.length} new AI stories today, ${hnDashboard.length} from HN, ${rssDashboard.length} from RSS feeds`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
