# ProtocolPulse — 60-second hackathon demo

Watch `final_demo.mp4`: exactly 60.000 seconds, 1920×1080, 30 fps, H.264 video and AAC narration. English captions are burned in and included as a selectable track and `subtitles.srt`.

The film uses actual Gemini protocol extraction, human rule approval, a new 30-patient screening, externally confirmed participation, a synthetic medication event processed by the real monitoring backend, a successful Gemini investigation, and an evidence-cited Clinical Lead acknowledgement. Processing waits are edited. Fictional clinical dates belong to the fixture scenario.

## Deliverables and verification

- `storyboard.md`, `narration.md`, `subtitles.srt`: final creative plan, script and captions.
- `recordings/`: original 1080p WebM footage, markers, screenshots and sanitized API mutation responses.
- `assets/qa/technical.json`: exact container timing, 1,800 decoded frames, codecs and resolution.
- `assets/qa/browser-playback.json`: complete Edge playback without a media error.
- `assets/qa/contact-sheet.jpg`: visual review frames.
- `assets/provenance.json`: successful extraction and monitoring AI executions, eight approved rules, completed screening and an acknowledged high-priority case with a cited human decision.

Screening produced 18 potential matches, six needing review and six protocol conflicts. The shared database still has thirty patients; its original case IDs, statuses and revisions are unchanged. No production application code changed.

Capture used a fresh isolated database at `assets/runtime/capture.db`. The existing frontend was used unchanged. Playwright forwarded actual requests from configured API port 8000 to the real isolated API at port 8002; it supplied no mocked responses. Runtime databases, logs and downloaded binaries are local dependencies, not submission material.

## Re-render this exact edit

From the repository root on this Windows workstation:

```powershell
python -m pip install --target demo/assets/production-python imageio-ffmpeg==0.8.1 Pillow==13.0.0
python demo/scripts/produce.py
python demo/scripts/qa.py
node demo/scripts/playback.cjs
```

Production uses Python 3.11 and workspace-local rendering packages. The application uses its existing Python 3.12 environment at `backend/var/venv312/Scripts/python.exe`. The renderer loads FFmpeg from imageio-ffmpeg and uses Windows Segoe UI fonts. Existing recordings and narration are sufficient to render without inference or additional spending.

## Record a fresh take

Keep a copy of the delivered `demo/` folder first: recording writes to the same phase paths. Keep the normal frontend on `http://localhost:3000` and the shared API on port 8000. Apply shared migrations and run the idempotent `tools.add_demo_patients` importer before starting/reusing that app, as required by the repository; never reset the shared database.

Use an unused capture port. The helper creates a uniquely named empty database, migrates and seeds that database only, imports thirty profiles and starts a hidden API process. It inherits server-side Gemini configuration from root `.env`; never record keys.

```powershell
. ./demo/scripts/start_capture.ps1 -Port 8002
Invoke-RestMethod "$env:CAPTURE_API/api/v1/health"
node frontend/node_modules/playwright/cli.js install ffmpeg
node demo/scripts/record.cjs protocol
node demo/scripts/record.cjs screening
node demo/scripts/record.cjs monitor
python demo/scripts/produce.py --fresh
python demo/scripts/qa.py
node demo/scripts/playback.cjs
```

Use the same PowerShell session so capture variables persist. Provider network access is required. Stop on an extraction failure; do not substitute curated results and describe them as AI output. Use one worker per database. The helper prints its PID for cleanup; leave shared app processes running. `provenance.py` checks the delivered capture at port 8002 against the delivered discovery snapshot.

During original production, restricted provider access caused failed extraction attempts; locator mistakes later interrupted capture after successful operations. The edit uses successful extraction/event footage plus resumed review takes (`protocol-review`, `monitor-review`), independently checked against the API. The repaired recorder supports all three complete phases; `--fresh` selects those instead of the original resumed takes.

## Narration and spending

Authorization: maximum USD 10 in fal credits. Two paid jobs ran: MiniMax Speech 2.8 HD narration at USD 0.10 per 1,000 characters, and Scribe V2 word timestamps at USD 0.008 per minute. Estimated combined usage is approximately USD 0.09, subject to actual billing rules; this is not an invoice total. See `assets/spending.json`. No cinematic generation or paid retries were needed. Configured Gemini application usage is separate from fal billing.

The original narration is 62.424 seconds. The edit uses pitch-preserving `atempo=1.08`, a 0.4-second initial delay, loudness normalization and a closing hold. Captions use actual word timestamps transformed by the same speed and delay, with non-overlapping intervals.

## Accuracy boundaries

The AI coordinator has logical responsibilities, not three independently deployed agent services. Approved backend rules own screening and monitoring outcomes; AI interprets clauses and investigates evidence. High priority means review priority. Notifications shown are in-app cases. Roles are simulated. Participation records external human confirmation. AI does not enroll patients, choose treatment or approve medicines. The closing describes potential benefit, without claiming clinical validation or guaranteed faster regulatory approval.
