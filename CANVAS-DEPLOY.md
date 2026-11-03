# CANVAS deployment / status

Published 2026-11-03. API: https://youmore-canvas.sleeping4439.workers.dev/canvas
Frontend: https://sleeping4439-tech.github.io/youmore/canvas.html
GitHub Actions deployment succeeded: https://github.com/sleeping4439-tech/youmore/actions/runs/41585220416
The manual deploy workflow currently checks out reviewed commit 46321632be2ebc31b937f81eb95f27de54159158; update its pinned checkout intentionally for subsequent backend changes. Secrets: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. Never commit token values.

## Deployment
1. Create a dedicated D1 database `youmore-canvas`. Replace `REPLACE_WITH_CREATED_D1_ID` in `wrangler.canvas.jsonc` with its actual ID.
2. Apply `canvas-schema.sql` using `wrangler d1 execute youmore-canvas --remote --file canvas-schema.sql --config wrangler.canvas.jsonc`.
3. Deploy `wrangler deploy --config wrangler.canvas.jsonc`. Requires Wrangler >=4.36. The READ_LIMITER and WRITE_LIMITER rate-limit bindings are required: missing bindings fail closed with 503.
4. Set the `canvas-api` meta content in `canvas.html` to the returned Worker URL plus `/canvas`. Publish `canvas.html` and `canvas.js` to GitHub Pages. Do not edit index.html, home.css, home.js or other sections.
5. Verify live CORS, anonymous sharing in two sessions, unshared drafts, retries, mobile pointer input, PC mouse input and reset using a separate staging D1. Never put test/reset endpoints in production.

## Data / limits
- Store only submitted strokes, sequence and random submission ID; never local drafts, IP addresses or accounts. No content review, text recognition or drawing filtering.
- Appends are atomic; `(sheet,id)` uniqueness makes uncertain network retries idempotent. Conflicting payload for the same ID returns 409.
- JSON bodies are bounded while streaming at 32,000 bytes. Max 40 strokes, 300 points/stroke, 1,600 points/save. Coordinates must be finite numbers from 0 to 1; three supported pen colors. SQL uses parameters.
- SQL trigger enforces weekly global caps: 150,000 points / 4,000,000 payload bytes / 3,000 submissions. Excess returns 507, not deletion of somebody else's marks.
- Read pagination: 50 submissions/response; live polling every 10 seconds only while visible. No shared-response caching.
- Rate-limit bindings: reads 120/min/IP, writes 10/min/IP. Cloudflare's binding limits are approximate per Cloudflare location, not a strict global anti-DDoS guarantee. Weekly DB caps remain authoritative globally. Many users behind one NAT share the rate budget. Distributed attacks can still fill the unmoderated paper or consume read/Worker quotas.
- No public SQL, delete, reset or admin endpoint. DB stays accessible only through the Worker binding. Observability is disabled; no payload logging in application code. Cloudflare platform operational records have their own retention.

## Weekly reset and retention
- Epoch keys are calculated from Monday 00:00 JST. The DB insert trigger independently checks the current week, rejecting requests queued across the boundary.
- GET returns only the current week. The open frontend schedules a reset from the server clock and rechecks on visibility changes; suspended/offline devices reset when resumed. Drafts are discarded on weekly reset, preventing old drawings from being silently carried into a new week.
- Cron `0 15 * * SUN` (Sunday 15:00 UTC) deletes prior weeks. An hourly `5 * * * *` retry cleans old rows if the weekly trigger is delayed. Scheduled execution timing is not a millisecond guarantee; old data is immediately inaccessible through GET even if the cleanup runs late.
- No application archives, exports or manual backups are created. Legacy prototype `strokes` rows are also cleaned by the scheduled handler.
- **Immediate irreversible physical erasure, including Cloudflare backups, is not achievable with the documented D1 configuration.** Time Travel is always enabled. Free: 7 days; Paid: 30 days. SQL DELETE removes live rows, but recovery history can retain them until expiration. Database deletion is not a workaround: Cloudflare documents a 7-day database undelete window. No claim is made about exact physical media erasure timing. Visitors can also retain their own screenshots/copies.
- Sources checked 2026-11-02:
  - https://developers.cloudflare.com/d1/reference/time-travel/
  - https://developers.cloudflare.com/d1/platform/limits/
  - https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/undelete/
  - https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## Verification so far
`node --test tests/canvas.test.mjs`: 7 passing tests (JST boundary, append/idempotency, invalid input/origin/rate/missing binding, bounded body, stale week and deletion, capacity, pagination).
Browser QA uses the actual Worker handler with a local SQLite D1 adapter, not Cloudflare D1. Mobile-width browser draft stayed private until Save; saved line appeared in a separate PC tab. Production deployment includes the rate bindings and successfully registered crons. Live GitHub Pages QA: unpublished draft stayed private, saving persisted to D1 and appeared in a second tab; 390px mobile-width zoom, drawing, saving and overdraw confirmed, along with PC display. Actual physical touch-device input and the next real Monday boundary have not been observed; reset tests use the production handler with local SQLite.
`tests/preview-server.mjs` is QA-only, in-memory, and must not be deployed. Its test endpoint only exists locally. `npm run dev` supports the managed Sites preview.
