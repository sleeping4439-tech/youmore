# ESSAY publishing backend (not yet deployed)

The `essay-publish-worker.js` is an initial, **unconnected** secure publishing API. It creates a standalone essay HTML file in the GitHub repository. It does NOT yet update the ESSAY listing, upload MV/images, or provide an authenticated editor UI.

Before deployment:
1. Create a dedicated Cloudflare Worker and put it behind a Cloudflare Access application with an allow policy for the owner's verified email only.
2. Configure `ACCESS_TEAM_DOMAIN` (full issuer URL), `ACCESS_AUD` (Access application audience), `OWNER_EMAIL`, and `EDITOR_ORIGIN` as Worker variables.
3. Store a fine-grained GitHub token with **Contents: Read and write** on **only** `sleeping4439-tech/youmore` as the `GITHUB_TOKEN` Worker secret. Never put it in a public page or GitHub source.
4. Keep the editor private on an Access-protected origin; do not treat `essay-editor.html` on public GitHub Pages as a private editor.
5. Implement authenticated image upload, the ESSAY index update, proper rich-text block serialization, and integrate editor POST to /publish.
6. Test owner access, unauthorized access, publishing, and mobile use before enabling the public button.

No credentials or access settings have been provisioned by this commit.