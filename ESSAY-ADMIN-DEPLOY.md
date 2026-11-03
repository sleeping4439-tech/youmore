# ESSAY publishing backend (not yet deployed)

The `essay-publish-worker.js` is an initial, **unconnected** secure publishing API. It creates a standalone essay HTML file in the GitHub repository. It does NOT yet update the ESSAY listing or provide an authenticated editor UI. It now includes a protected `POST /upload` endpoint for JPEG, PNG, and WebP images (up to 4 MB), but it is not deployed or connected to the editor.

Before deployment:
1. Create a dedicated Cloudflare Worker and put it behind a Cloudflare Access application with an allow policy for the owner's verified email only.
2. Configure `ACCESS_TEAM_DOMAIN` (full issuer URL), `ACCESS_AUD` (Access application audience), `OWNER_EMAIL`, and `EDITOR_ORIGIN` as Worker variables.
3. Store a fine-grained GitHub token with **Contents: Read and write** on **only** `sleeping4439-tech/youmore` as the `GITHUB_TOKEN` Worker secret. Never put it in a public page or GitHub source.
4. Keep the editor private on an Access-protected origin; do not treat `essay-editor.html` on public GitHub Pages as a private editor.
5. Connect the authenticated editor to `POST /upload` (JSON `{data: "data:image/...;base64,..."}`) and `POST /publish`, then implement ESSAY index and homepage thumbnail updates, editing/deletion, and proper rich-text block serialization. Image upload and article publishing are separate operations; failed publishing can leave an unused image in the repository.
6. Test owner access, unauthorized access, publishing, and mobile use before enabling the public button.

No credentials or access settings have been provisioned by this commit.
## Current editor progress

- `essay-editor.html`: mobile-friendly title, rich-text draft, MV/body image selection, local draft autosave, JSON export **and import**, and full-width article preview.
- The public editor is **not** a secure private admin interface. The publish button remains disabled until the editor is hosted behind Cloudflare Access and the Worker is configured and verified.
- The public article listings are currently static HTML. Newest-first automatic updates are not yet implemented.
- Never commit the GitHub token or any Cloudflare Access secret into the public repository.
