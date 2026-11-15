# ProtocolPulse — final 60-second demo

Status: produced and verified. User authorized up to USD 10 in fal credits; two media jobs ran, with approximately USD 0.09 combined estimated usage. Actual invoice total is unavailable.

## Creative direction

Promising treatments still need rigorous clinical trials. Show one connected workflow that addresses preparation, recruitment and oversight, then return to the potential benefit for patients. Use authentic 1920×1080 browser footage, restrained teal titles, readable crops and captions. Label synthetic data and compressed processing time. No generated application screens.

| Time | Real footage and editorial treatment | Message |
|---|---|---|
| 00–09.5 | Animated editorial opening: promising treatments, rigorous trials, avoidable delays. | Recruitment and oversight can delay progress. |
| 09.5–12.5 | Real uploaded PDF and extraction trigger; waiting time cut. | A protocol becomes actionable proposals. |
| 12.5–16 | Actual AI-generated rules, followed by expanded source clause. | Evidence remains attached. |
| 16–19.5 | Real Clinical Lead approval, including attestation and rationale. | People authorize operational rules. |
| 19.5–25.5 | New screening: 18 potential matches, six needing review, six conflicts. | Focus recruitment review. |
| 25.5–29.5 | P-083 uncertainty: medication order does not prove use. | Missing evidence stays visible. |
| 29.5–32.5 | Human confirmation of P-042 external participation. | Screening does not enroll. |
| 32.5–37 | Actual synthetic medication-record submission. | Oversight continues after recruitment. |
| 37–44.5 | Actual finding and high-priority case with cited AI summary. | Connect new evidence to review. |
| 44.5–48.5 | Clinical Lead rationale, assignment and evidence citation. | People decide the next step. |
| 48.5–54 | Successful acknowledgement; connected-workflow recap. | Less repetitive work, more focused oversight. |
| 54–60 | Branded closing: “Streamline trials. Bring tomorrow’s medicines closer.” | Potential benefit, without promising faster approval. |

## Workflow and scope

The simulator uses fixed patient IDs, so capture used a newly seeded isolated database with the same real application and thirty synthetic profiles. The shared database, its thirty patients and original case history remain unchanged. Browser requests were forwarded unchanged to the real capture API on port 8002, without response mocks. See `assets/provenance.json` for successful extraction, completed screening, successful monitoring AI execution and cited human acknowledgement.

AI uses one bounded coordinator with logical responsibilities. Approved backend rules compute screening results and monitoring findings. AI interprets the protocol and may investigate evidence or draft a cited summary. Do not describe three independently deployed AI agents. Show actual successful execution only; provider errors and curated extraction must remain explicit.

The role selector simulates Sponsor and Clinical Lead identities. Do not claim multi-hospital integration, external notifications, general PDF support, clinical validation or autonomous enrollment. Notifications demonstrated here are in-app cases.

## Production tools and cost

- Playwright with installed Microsoft Edge: real interactions and browser video at 1920×1080.
- Workspace-local FFmpeg: editing, titles, subtitles and H.264/AAC export. MP4 header inspection verifies 60.000 seconds; full decoding verifies 1,800 frames. Edge playback reached the end without a media error.
- fal.ai narration used `fal-ai/minimax/speech-2.8-hd` at a published USD 0.10 per 1,000 characters; Scribe V2 supplied word timestamps at USD 0.008 per minute. Two paid jobs completed, approximately USD 0.09 combined estimated usage, within the authorized USD 10 maximum. No generated cinematic footage was needed; actual invoice total is unavailable.
- Existing configured Gemini performs genuine application AI work; usage is separate from fal credits and depends on the configured provider account. No new credentials required by discovery.
- Paid submissions occurred after explicit authorization. Original narration duration was 62.424 seconds; pitch-preserving speed adjustment and precisely timed captions fit the sixty-second edit.

## Discovery evidence

Applied current migrations and ran the idempotent shared-patient importer: zero added, thirty present. API reports database healthy, migrations current, worker running, AI enabled and synthetic-only mode. Reused healthy running services. Real Playwright navigation returned HTTP 200 for six pages without page errors. See `assets/discovery/app.json`, `browser.json` and screenshots. These are discovery captures, not newly executed protocol extraction or newly created monitoring findings.

## Delivery checks

Delivered `final_demo.mp4`, storyboard/narration, synchronized SRT, raw browser recordings, assets and scripts. Full decode, exact duration, frame count, browser playback, valid caption intervals and API provenance checks passed. Visual review covered opening, each workflow stage and closing. Only synthetic data appears in the film. The wider-impact language remains qualified. See README for reproduction and retained failed takes.
