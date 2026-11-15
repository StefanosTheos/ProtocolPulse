# Running ProtocolPulse

Run commands from the repository root. Use Python **3.12**, Node.js **24** and npm. The Python and npm lockfiles pin dependencies. The documented deployment is one FastAPI process, one SQLite-backed worker and a Next.js frontend.

## First setup: PowerShell

Copy configuration only when no local configuration exists. Seed only a new, empty database.

```powershell
Copy-Item .env.example .env
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.lock
npm ci --prefix frontend
Set-Content frontend/.env.local 'NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1'
New-Item -ItemType Directory -Force backend/var/protocols | Out-Null
.venv/Scripts/python.exe -m alembic -c backend/alembic.ini upgrade head
.venv/Scripts/python.exe -m backend.app.seed --dataset px104-15
.venv/Scripts/python.exe -m tools.add_demo_patients
.venv/Scripts/python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

If the Windows Python launcher is unavailable, use your installed Python 3.12 executable to create the environment. In a second terminal at the repository root:

```powershell
npm --prefix frontend run build
npm --prefix frontend run start -- --hostname localhost --port 3000
```

Use the production frontend for inspection: development mode compiles routes on first access. For frontend development instead, run `npm --prefix frontend run dev -- --hostname localhost --port 3000`.

## First setup: POSIX

```sh
cp .env.example .env
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.lock
npm ci --prefix frontend
printf 'NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1\n' > frontend/.env.local
mkdir -p backend/var/protocols
python -m alembic -c backend/alembic.ini upgrade head
python -m backend.app.seed --dataset px104-15
python -m tools.add_demo_patients
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

In a second terminal:

```sh
npm --prefix frontend run build
npm --prefix frontend run start -- --hostname localhost --port 3000
```

POSIX commands are provided for portability; the retained historical execution evidence was collected on Windows.

## Open and resume

- Application: **http://localhost:3000**
- Health: **http://127.0.0.1:8000/api/v1/health**
- OpenAPI UI: **http://127.0.0.1:8000/docs**
- Browser origin must match `FRONTEND_ORIGIN=http://localhost:3000`.

For an existing installation, preserve `.env` and `backend/var/`, install locked dependencies after pulling, apply migrations and run the additional-patient importer before starting the services. Do not reseed or reset an existing database to launch the application. Ordinary API startup does not migrate or seed data. Use one Uvicorn worker.

Expected healthy services include database `ok`, migrations `current` and worker `running`. AI can be disabled while deterministic operations remain available.

## Cohort and new studies

The initial `px104-15` seed contains fifteen fixed acceptance archetypes. The idempotent `python -m tools.add_demo_patients` import adds P-301 through P-315 to PX-104, producing a thirty-patient cohort without replacing approvals, events or cases.

Historical screening runs keep their original patients and evidence snapshots. Start a new screening to include imported patients.

A study created through the UI starts empty. Import fifteen synthetic profiles into that study using its ID from the URL:

```powershell
.venv/Scripts/python.exe -m tools.add_demo_patients --trial TR-<study-id>
```

Patient IDs are globally unique; additional studies receive study-specific IDs. Repeating the import skips patients already present.

## Enable AI

Edit root `.env` on the server:

```dotenv
LLM_ENABLED=true
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.8-flash
LLM_API_KEY=<your-authorized-provider-key>
```

Restart the API after configuration changes. Do not substitute another model silently. Provider account access, quota and latency depend on the configured account.

The credential-free default is `LLM_ENABLED=false`. Extraction then uses the labeled curated fixture; explicit investigations report unavailable and deterministic monitoring continues. An enabled provider failure is not replaced with curated success.

Never place a key in browser configuration, source files, model input or recorded evidence. `frontend/.env.local` contains only `NEXT_PUBLIC_API_BASE_URL`; root `.env`, runtime databases and logs are ignored.

## Troubleshooting

| Symptom | Check |
|---|---|
| Browser cannot reach API | API process, `NEXT_PUBLIC_API_BASE_URL` and exact CORS origin. Rebuild the production frontend after changing its public API URL. |
| Health reports migration/worker problems | Apply Alembic migrations; use a single API process; inspect local server logs. |
| No patients to screen | Select PX-104 or import profiles into the selected study. Protocol approval does not populate a study. |
| Screening is blocked | Clinical Lead must approve all eight rules and all twelve coverage sections. |
| Protocol upload is rejected | Use the bundled fictional PDF. The current synthetic source policy does not accept arbitrary PDFs. |
| Another protocol version cannot activate | Only the first active version is supported; amendment activation requires a contract extension. |
| AI is unavailable or fails | Check server configuration, provider access and job/execution error codes. Deterministic findings remain independent. |
| First screen is slow in development | Build and serve the production frontend for inspection. |

## Deliberately resetting an isolated test database

Only on a disposable synthetic installation, stop the API and run:

```powershell
.venv/Scripts/python.exe -m backend.app.seed --dataset px104-15 --reset-demo
.venv/Scripts/python.exe -m tools.add_demo_patients
```

Reset replaces approvals, screening runs, events, reviews and other local data. It is unnecessary for ordinary launches. See [verification](verification/README.md) before running mutating integration tests.
