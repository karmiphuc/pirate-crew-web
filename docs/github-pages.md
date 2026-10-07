# GitHub Pages hosting

The playable game is a client-only SPA. GitHub Pages serves the production HTML, CSS, JavaScript, and third-party notices. Simulation and rendering run in the browser; checkpoints use IndexedDB. Hosting adds no API, database, ongoing game server, or runtime framework.

## Deployment

1. Source is uploaded to `main` in the user-created public repository [karmiphuc/pirate-crew-web](https://github.com/karmiphuc/pirate-crew-web).
2. In repository **Settings → Pages**, select **GitHub Actions** as the source.
3. Push to `main`, or run **Deploy game to GitHub Pages** manually from Actions. Its build job installs locked dependencies, checks formatting, runs simulation/storage tests, builds, and runs production browser hosting checks before uploading only `dist/`. The deployment job receives `pages: write` and `id-token: write`, configures Pages, and publishes through the `github-pages` environment.
4. Open the URL reported by the deployment job. For the intended repository it would normally be `https://karmiphuc.github.io/pirate-crew-web/`; this is an expected address, not a verified live site.

The user created a public repository, which supports Pages on GitHub Free. Pages from a private repository requires an eligible paid plan. A private source repository does not inherently make the default Pages website private.

## Routing and portability

Vite uses `base: "./"`. All emitted bundle URLs are relative to the entry document, so the same artifact supports a repository path, account Pages root, or custom domain. In-game screens are modal panels rather than URL paths. Do not add history-based routes without revisiting Pages' lack of server rewrites. Open a project site using its trailing slash.

`npm run test:hosting` serves the built artifact using a strict static server, with no fallback to `index.html`. It exercises both root and repository-path entry points, asset fetches, WebGL startup, recruitment, a persisted checkpoint after reload, ten map nodes, third-party notices, and absence of the development diagnostic hook. Local execution uses `/usr/bin/chromium` or `CHROMIUM_PATH`; CI installs Playwright Chromium and sets `PLAYWRIGHT_BUNDLED_CHROMIUM=1`.

## Saves and operational limits

Pages supplies HTTPS for browser storage and Web Locks. Saves remain on that browser/device, with no cloud sync. Clearing site data removes saves. A domain change changes the storage origin; export/import a backup when moving domains. Project Pages sites under the same account share an origin; this game currently uses its own named database/lock, but a second copy of this game on another path of that origin will share its saves and writable-tab lock.

No service worker or offline install has been introduced. Normal HTTP cache behavior and hashed JavaScript/CSS filenames apply. The Phaser engine has a separate bundle, avoiding a fresh engine download when only game code changes. Hosting does not alter simulation timing, capped collections, scene disposal, or checkpoint ownership. Existing frame-time/GC evidence remains scoped to the measurements in the implementation report.

## Verification status

Production build and all 92 simulation/storage/lifetime tests pass. Live Pages behavior and repository environment rules remain unverified while Pages is disabled. GitHub Actions execution is tracked below. The hosting smoke test is a local production check, not a claim that Pages has deployed.

The production browser smoke passes at both `/` and `/pirate-crew-web/`, with no browser errors. During each run the server exposes only the tested mount, so absolute root asset references fail the repository-path check.

Sources: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Vite static deployment](https://vite.dev/guide/static-deploy.html#github-pages).

## Repository creation diagnosis (2026-10-06)

Both the GitHub connector and CLI authenticate as `karmiphuc` (user ID 3367376). The installed app is `chatgpt-codex-connector`, installation 67460831, with repository selection `all`. The installation's permissions reported by `GET /user/installations` are `actions: write`, `checks: read`, `contents: write`, `issues: write`, `metadata: read`, `pull_requests: write`, `statuses: read`, and `workflows: write`.

Direct `POST https://api.github.com/user/repos` requests for the intended private repository return HTTP 403, `Resource not accessible by integration`, using both API versions `2022-11-28` and `2026-03-10`. The response header `X-Accepted-Github-Permissions` reports `administration=write; repository_creation=write`; neither permission is present in the app installation. This is a confirmed permission mismatch, not a wrong owner, endpoint, API version, or restricted repository selection. GitHub's [authenticated-user repository creation endpoint](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user) documents either of these permission sets as sufficient.

The user subsequently created the repository. The complete source was uploaded through GitHub's contents and Git data APIs after Git transport authentication failed. Pages activation via `POST /repos/karmiphuc/pirate-crew-web/pages` returns HTTP 403, `Resource not accessible by integration`; enabling Pages in repository settings remains a required owner action. No credential values are stored here.

## Version 0.2 publication

[CI run 37464965027](https://github.com/karmiphuc/pirate-crew-web/actions/runs/37464965027) passed formatting, all 51 tests, the production build, and hosting checks. The Pages configuration step failed; deployment did not run. The owner must select GitHub Actions as the Pages source, then rerun the workflow or push a game update.

## Version 0.3 workflow separation

The validated build uploads its static Pages artifact independently of Pages configuration. Configuration now runs in the deployment job, which has the required Pages permissions. This makes a successful build artifact available even when the repository owner has not enabled hosting; an unavailable Pages site blocks deployment rather than discarding build validation. Runtime assets use relative paths, so no Pages metadata is needed during the Vite build.

[Version 0.3 CI run 37472166471](https://github.com/karmiphuc/pirate-crew-web/actions/runs/37472166471) confirms the build job succeeds and uploads the Pages artifact. Deployment configuration still returns HTTP 404 because a Pages site has not been enabled. Select Settings → Pages → GitHub Actions, then rerun the deployment workflow.
