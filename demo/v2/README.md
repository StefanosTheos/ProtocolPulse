# ProtocolPulse — Keep the trial moving

This is a new production built around a fresh, single end-to-end browser recording. Watch `final_demo.mp4` (60.000 seconds, 1920×1080, 30 fps, H.264/AAC). The primary delivered copy is also at `../final_demo.mp4`.

## Final creative choices

- A white and emerald identity replaces the initial dark direction, following user feedback. A real extruded 3D P, raised white pulse ribbon, moving protocol pages, orbital elements, camera movement and cast shadows form the opening and closing. These are original Three.js renders, not generated product interfaces.
- The application occupies 48.3 seconds of the film. One fresh 114-second browser take supplies every application frame, in chronological order. Retiming preserves the actions while compressing processing waits; a smooth camera move follows the actual reviewer into the evidence panel.
- A visible cursor follows real mouse events, with curved movement and click halos. The take contains 32 recorded clicks and four actual typed entries. The cursor overlay is noninteractive and changes no product data.
- The rejected rhythmic music was replaced by a very restrained instrumental ambient bed, normalized to -36 LUFS and ducked under speech. Narration targets -16 LUFS. Soft click sounds align to actual click times.
- Narration explicitly names inclusion and exclusion criteria. It says “the patient cohort,” without speaking a patient count or “synthetic patients.” A discreet on-screen synthetic-data label remains. The closing connects time saved with the potential for trials to progress more efficiently and medicines to reach patients sooner.

## Story and truthfulness

Real PDF upload → successful Gemini extraction → source-clause inspection → Clinical Lead approval → new cohort screening → P-083 uncertainty → P-042 participation confirmation → actual synthetic medication-event submission → resulting high-priority case → successful AI investigation → cited human acknowledgement.

The configured shared application remains unchanged: thirty synthetic patients and its original case IDs, statuses and revisions. A new isolated database at `assets/runtime/capture-02.db` supplies the final take through port 8005. The existing frontend at localhost:3000 remains unchanged; Playwright forwards its API requests to that real capture server. It never mocks responses. The first interrupted take is preserved outside `recordings/take02/` and contributes no frames to the final video.

AI proposes criteria and investigates evidence; approved backend rules compute screening and monitoring findings. Humans approve, confirm participation and record decisions. “High priority” is review priority. Notifications shown are in-app cases. The role selector simulates identities. The film makes no claim of autonomous enrollment, treatment, regulatory approval, general protocol support or validated time savings. The potential wider impact remains qualified.

## Files

- `final_demo.mp4`, `narration.md`, `storyboard.md`, `subtitles.srt`.
- `recordings/take02/`: continuous original WebM, UI checkpoints, real mutation receipts and action timestamps in `journey.json`.
- `assets/brand/`: SVG symbol and lockup, identity sheet, original 3D scene and frame sequences.
- `assets/voice-master.mp3`, `ambient.mp3`: final selected audio. Other takes are retained as production history.
- `assets/timeline.json`: exact chronological mapping from raw footage to final time.
- `assets/provenance.json`: actual provider executions, approved rules, completed screening and cited human decision.
- `assets/qa/`: full decode results, exact timing, browser playback, caption validation and review frames.
- `assets/spending.json`: all new fal requests, including superseded takes. Approximate published-rate total USD 1.55 against the user-authorized USD 10 cap; actual invoice total unavailable. Local 3D rendering incurs no fal charge. Configured Gemini app usage is separate.

## Re-render without new spending

From the repository root, with Windows Segoe UI and Bahnschrift fonts:

```powershell
python -m pip install --target demo/assets/production-python imageio-ffmpeg==0.8.1 Pillow==13.0.0
python demo/v2/scripts/produce.py
python demo/v2/scripts/verify.py
node demo/v2/scripts/playback.cjs
```

Production Python is the workstation's Python 3.11. Application checks use its existing Python 3.12 environment at `backend/var/venv312/Scripts/python.exe`. The renderer imports only workspace-local media packages. On a fresh checkout, rebuild the 3D frames using the next section before running `produce.py`; generated frames, downloaded tools and intermediate renders are excluded from Git. Selected audio and the successful browser take are committed, so no new generation or provider credentials are needed to re-render. `--mix-only` remasters existing picture; `--motion-only` reuses the already retimed browser footage.

## Re-render the 3D artwork

```powershell
npm.cmd install --prefix demo/v2/assets/render-tools --no-audit --no-fund three@0.180.0
python -m http.server 8006 --bind 127.0.0.1 --directory demo/v2/assets
```

With that local asset server running, in a second terminal:

```powershell
node demo/v2/scripts/render_3d.cjs
python demo/v2/scripts/produce.py --motion-only
```

The headless Edge renderer captures the actual WebGL scene at deterministic frame times and full 1080p. `--preview` renders two stills for inspection. UI footage is independent of this artwork server.

## Record a new application take

Preserve a copy of this production folder before recording over `take02`. Use a fresh isolated capture database and an unused API port; never reset the shared database. Apply normal shared migrations and run the idempotent shared-patient importer before starting or reusing the shared app. See the repository AGENTS.md and getting-started guide.

Use `start_capture.ps1` to create a new, uniquely named isolated database. It inherits existing server-side Gemini configuration, seeds only that empty database, imports all thirty profiles and starts one worker. The existing frontend remains on localhost:3000 with its usual port-8000 API configuration.

```powershell
. ./demo/v2/scripts/start_capture.ps1 -Port 8010
Invoke-RestMethod "$env:CAPTURE_API/api/v1/health"
node frontend/node_modules/playwright/cli.js install ffmpeg
node demo/v2/scripts/record.cjs
backend/var/venv312/Scripts/python.exe demo/v2/scripts/provenance.py
python demo/v2/scripts/produce.py
```

Use the same terminal so environment variables persist. Network access to the configured Gemini account is necessary. Stop on a provider failure; curated fixtures must never be presented as live AI success. Production-only services from this session use ports 8004 (unused first take), 8005 (selected take), and 8006 (artwork). The shared app uses ports 8000/3000. Capture runtime databases, logs and downloaded binaries are local dependencies, not materials to submit with the MP4.

## Verification performed

Exact MP4 container duration 60.000 seconds; 1,800 fully decoded frames; 1080p H.264/AAC; complete Edge playback with no media error; non-overlapping timestamped subtitles; successful genuine extraction and monitoring AI; real cited acknowledgement; thirty shared patients and unchanged shared case history; visual review of intro, page transitions, cursor, typing, evidence, final acknowledgement and 3D closing. Rendered 3D frame differences confirm movement independently of overlaid titles. Source scripts passed Python/Node syntax checks. Application source code was not modified.
