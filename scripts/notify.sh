#!/usr/bin/env bash
# notify.sh — Post Discord notification for morning/afternoon briefings
#
# Usage:
#   bash scripts/notify.sh
#
# Reads Discord webhook URL from ~/.claude/discord-webhook.txt
# Reads story count from data/daily.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WEBHOOK_FILE="$HOME/.claude/discord-webhook.txt"
DATA_FILE="$PROJECT_DIR/data/daily.json"
SITE_URL="https://nemily.github.io/dude-were-so-cooked/"

# Check webhook file exists
if [ ! -f "$WEBHOOK_FILE" ]; then
  echo "ERROR: No Discord webhook found at $WEBHOOK_FILE"
  echo "Create the file with your webhook URL to enable notifications."
  exit 1
fi

WEBHOOK_URL="$(cat "$WEBHOOK_FILE" | tr -d '[:space:]')"

if [ -z "$WEBHOOK_URL" ]; then
  echo "ERROR: Discord webhook file is empty: $WEBHOOK_FILE"
  exit 1
fi

# Read story counts from daily.json
if [ -f "$DATA_FILE" ]; then
  STORY_COUNT=$(node -e "const d=JSON.parse(require('fs').readFileSync('$DATA_FILE','utf8')); console.log(d.storyCount||0);" 2>/dev/null || echo "0")
  HN_COUNT=$(node -e "const d=JSON.parse(require('fs').readFileSync('$DATA_FILE','utf8')); console.log(d.hnCount||0);" 2>/dev/null || echo "0")
  RSS_COUNT=$(node -e "const d=JSON.parse(require('fs').readFileSync('$DATA_FILE','utf8')); console.log(d.rssCount||0);" 2>/dev/null || echo "0")
  GEN_DATE=$(node -e "const d=JSON.parse(require('fs').readFileSync('$DATA_FILE','utf8')); console.log(d.generatedAt||'');" 2>/dev/null || echo "")
else
  STORY_COUNT="0"
  HN_COUNT="0"
  RSS_COUNT="0"
  GEN_DATE=""
fi

HOUR=$(date +%H)
if [ "$HOUR" -lt 12 ]; then
  TIME_LABEL="Morning"
else
  TIME_LABEL="Afternoon"
fi

SUMMARY="${STORY_COUNT} AI stories today · ${HN_COUNT} from Hacker News · ${RSS_COUNT} from RSS"

MESSAGE="**dude we're so cooked** — ${TIME_LABEL} Briefing

${SUMMARY}

${SITE_URL}"

# Post to Discord
PAYLOAD=$(node -e "console.log(JSON.stringify({content: $(node -e "process.stdout.write(JSON.stringify('$MESSAGE'))")}))")

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL")

if [ "$RESPONSE" = "204" ] || [ "$RESPONSE" = "200" ]; then
  echo "Discord notification sent successfully (HTTP $RESPONSE)"
  echo "Message: $MESSAGE"
else
  echo "ERROR: Discord notification failed (HTTP $RESPONSE)"
  exit 1
fi
