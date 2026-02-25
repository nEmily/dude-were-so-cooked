@echo off
REM daily-run.bat - Called by Windows Task Scheduler
REM Curates AI news, commits to git, sends Discord notification

cd /d "C:\Users\emily\projects\dude-were-so-cooked"
if errorlevel 1 (
    echo ERROR: Could not cd to project directory
    exit /b 1
)

echo Starting daily run...

REM Step 1: Curate fresh stories
node scripts\curate.js
if errorlevel 1 (
    echo ERROR: curate.js failed
    exit /b 1
)

REM Step 2: Synthesize AI digest (non-blocking — if it fails, continue)
node scripts\synthesize.js
if errorlevel 1 (
    echo WARNING: synthesize.js failed, continuing without digest
)

REM Step 3: Stage the data files
git add -f public\data\daily.json
git add -f public\data\digest.md 2>NUL

REM Step 4: Commit if there are staged changes
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "chore: daily data refresh"
)

REM Step 5: Send to GitHub
git push origin main
if errorlevel 1 (
    echo WARNING: send to remote failed, continuing to notify anyway
)

REM Step 6: Send Discord notification
node scripts\notify.js
if errorlevel 1 (
    echo ERROR: notify.js failed
    exit /b 1
)

echo Daily run complete.