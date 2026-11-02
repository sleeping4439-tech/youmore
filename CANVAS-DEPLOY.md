# CANVAS shared drawing backend

Deploy `canvas-worker.js` as a Cloudflare Worker with a D1 binding named `DB`. Execute `canvas-schema.sql` against the database. Set `ALLOWED_ORIGIN=https://sleeping4439-tech.github.io` as a Worker variable. Add cron trigger `0 15 * * 0` (Sunday 15:00 UTC = Monday 00:00 JST). The frontend needs the actual Worker URL configured before live shared drawing works.

Configure a Cloudflare WAF rate limiting rule for POST /canvas: e.g. 10 requests per minute per IP, block for 60 seconds. This protects infrastructure but does not moderate drawings. Configure Worker routes so the endpoint is not exposed with credentials; D1 is only bound to this Worker.

The sheet key is computed server-side in JST; clients cannot save to previous weeks. The scheduled job deletes all prior sheets; exact physical deletion and backup retention follow Cloudflare D1 policies. For strict deletion including backups, confirm D1 Time Travel retention and disable/expire backups as supported. The code does not retain an archive. Content is unmoderated, but infrastructure abuse protection is required.

Note: CORS restricts browser origins, not direct HTTP clients. WAF and server validation are the actual protection. Large canvases may need pagination or periodic rasterization before 12,000 strokes.
