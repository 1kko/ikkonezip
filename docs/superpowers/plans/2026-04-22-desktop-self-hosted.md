# Desktop DMG Self-Hosted (Build-Time Fetch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the user-facing desktop DMG download URL from `github.com/.../releases/...` to `https://zip.1kko.com/desktop/...` by having the Coolify Docker build pull the DMG from GitHub Releases at image-build time and embed it into nginx's html dir.

**Architecture:** The Dockerfile's runtime stage gains one `RUN` step that reads `public/desktop-latest.json`, derives the GitHub Release URL by convention from the version field, and `curl`s the DMG into `/usr/share/nginx/html/desktop/`. Docker's layer cache invalidates automatically when `desktop-latest.json` changes, so non-desktop deploys skip the fetch. CI workflow stays simple — it still uploads to GH Releases and commits the manifest, but the manifest's `downloadUrl` now points at our domain.

**Tech Stack:** nginx:alpine, curl + jq (added to image), existing GitHub Actions desktop-release workflow.

**Spec:** `docs/superpowers/specs/2026-04-22-desktop-self-hosted-design.md`

---

## File Structure

| File | Status | Owner |
|------|--------|-------|
| `Dockerfile` | modify | Add runtime-stage `RUN` that fetches the current desktop DMG from GH Releases into nginx html dir |
| `public/desktop-latest.json` | modify | Change `downloadUrl` from `github.com/.../releases/...` to `https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg` |
| `.github/workflows/desktop-release.yml` | modify | Update `DOWNLOAD_URL` construction to use `https://zip.1kko.com/desktop/${ASSET_NAME}` instead of the GitHub Release URL |
| `public/desktop-install.html` | modify | Replace static `href="github.com/.../releases/latest"` with dynamic JS that reads `desktop-latest.json` and rewrites the button href + adds the version to button text. GitHub URL becomes the fallback when fetch fails. |
| `nginx.conf` | modify | Add `location ~ ^/desktop/.*\.dmg$` block with `Cache-Control: public, max-age=31536000, immutable` (DMG URLs are version-pinned so safe to cache forever) |

Branch: `feat/desktop-self-hosted-dmg` from `main`.

---

## Task 1: Dockerfile — fetch DMG into runtime image

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Read the current Dockerfile to identify the runtime stage**

```bash
cat Dockerfile
```

You'll see two stages: a `node:22-alpine AS build` stage that runs `npm run build`, and an `nginx:alpine` runtime stage that copies `/app/dist` into `/usr/share/nginx/html`.

- [ ] **Step 2: Add the DMG-fetch step in the runtime stage**

Replace the entire runtime stage section. Find:

```dockerfile
# Runtime stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-snippets/security_headers.conf /etc/nginx/snippets/security_headers.conf
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/healthz || exit 1
```

Replace with:

```dockerfile
# Runtime stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-snippets/security_headers.conf /etc/nginx/snippets/security_headers.conf

# Fetch the current desktop DMG from GitHub Releases at build time and embed
# it into nginx's html dir. This is what enables the user-facing download URL
# to live on our own domain (https://zip.1kko.com/desktop/...) without
# requiring SSH from CI to the host. The fetch is fail-soft: a transient GH
# outage during build leaves the new image without /desktop/, but the
# previously-running container keeps serving with the previous image.
COPY public/desktop-latest.json /tmp/manifest.json
RUN apk add --no-cache curl jq ca-certificates && \
    VERSION=$(jq -r '.version' /tmp/manifest.json) && \
    if [ "$VERSION" != "null" ] && [ "$VERSION" != "0.0.0" ]; then \
      DMG="Zip_${VERSION}_universal.dmg"; \
      mkdir -p /usr/share/nginx/html/desktop; \
      curl -fsSL --retry 3 -o "/usr/share/nginx/html/desktop/${DMG}" \
        "https://github.com/1kko/ikkonezip/releases/download/v${VERSION}-desktop/${DMG}" \
        || echo "WARN: DMG fetch failed for v${VERSION}; /desktop/${DMG} will 404"; \
    fi && \
    rm -f /tmp/manifest.json && \
    apk del curl jq

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/healthz || exit 1
```

Notes:
- `apk add` + `apk del` keeps the final image lean (curl/jq only present during the RUN).
- The `--retry 3` covers brief network hiccups.
- `|| echo` prevents the build from failing on transient GH errors.
- `ca-certificates` ensures HTTPS to GitHub works (alpine doesn't ship them by default in some base versions).

- [ ] **Step 3: Local sanity check that the syntax is valid**

```bash
docker build --no-cache -t ikkonezip-test . 2>&1 | tail -20
```

Expected: build succeeds. The DMG fetch will reach out to GH Releases for v0.1.1 (assuming `desktop-latest.json` has version `0.1.1`). Final stage should print "Successfully tagged ikkonezip-test".

If you get a `command not found: docker`, skip this — Coolify will catch it. If you get a network error fetching the DMG, that's also OK — the `|| echo` handles it.

- [ ] **Step 4: Verify the DMG actually got embedded**

```bash
docker run --rm ikkonezip-test ls -la /usr/share/nginx/html/desktop/
```

Expected: `Zip_0.1.1_universal.dmg` listed, ~10 MB.

If the file is missing, check the WARN message in the build log — likely a wrong tag name or asset name.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/desktop-self-hosted-dmg
git add Dockerfile
git commit -m "Embed current desktop DMG into nginx image at build time"
```

---

## Task 2: Update `public/desktop-latest.json` downloadUrl

**Files:**
- Modify: `public/desktop-latest.json`

- [ ] **Step 1: Read current manifest**

```bash
cat public/desktop-latest.json
```

You'll see something like:

```json
{
  "version": "0.1.1",
  "downloadUrl": "https://github.com/1kko/ikkonezip/releases/download/v0.1.1-desktop/Zip_0.1.1_universal.dmg",
  "notes": "...",
  "releasedAt": "2026-04-22"
}
```

- [ ] **Step 2: Change `downloadUrl` to point at our domain**

Edit `public/desktop-latest.json`. Change the `downloadUrl` value from `https://github.com/...` to:

```
https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg
```

The full file should now be:

```json
{
  "version": "0.1.1",
  "downloadUrl": "https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg",
  "notes": "DMG에 실행방법.txt 포함, Tauri 다크모드 시스템 추적, 검색바 여백/스크롤바 가시성 개선, 창 크기 680x900",
  "releasedAt": "2026-04-22"
}
```

(Keep the existing `notes` and `releasedAt` values — only change `downloadUrl`.)

- [ ] **Step 3: Validate JSON**

```bash
python3 -c "import json; json.load(open('public/desktop-latest.json'))" && echo "JSON OK"
```

Expected: `JSON OK`.

- [ ] **Step 4: Commit**

```bash
git add public/desktop-latest.json
git commit -m "Point desktop manifest at zip.1kko.com instead of github.com"
```

---

## Task 3: Update CI workflow URL pattern for future releases

**Files:**
- Modify: `.github/workflows/desktop-release.yml`

- [ ] **Step 1: Find the manifest-construction step**

```bash
grep -n "DOWNLOAD_URL\|jq -n" .github/workflows/desktop-release.yml | head -5
```

You'll see something like (around line 100–110):

```yaml
- name: Update desktop-latest.json
  run: |
    ASSET_NAME=$(gh release view "${{ steps.version.outputs.tag }}" --json assets --jq '.assets[0].name')
    DOWNLOAD_URL="https://github.com/${{ github.repository }}/releases/download/${{ steps.version.outputs.tag }}/$ASSET_NAME"
    NOTES=$(gh release view "${{ steps.version.outputs.tag }}" --json body --jq '.body // "" | .[0:280]')
    jq -n \
      --arg version "${{ steps.version.outputs.version }}" \
      --arg url "$DOWNLOAD_URL" \
      ...
```

- [ ] **Step 2: Change the DOWNLOAD_URL line**

Find the line:

```bash
DOWNLOAD_URL="https://github.com/${{ github.repository }}/releases/download/${{ steps.version.outputs.tag }}/$ASSET_NAME"
```

Replace with:

```bash
# Manifest URL points at our own domain — the DMG is mirrored into the
# Coolify nginx image at build time (see Dockerfile). GitHub Releases
# remains the source-of-truth archive for the Dockerfile to fetch from.
DOWNLOAD_URL="https://zip.1kko.com/desktop/$ASSET_NAME"
```

(Only that one line changes — the surrounding `gh release view` calls and `jq -n` block stay the same.)

- [ ] **Step 3: Validate YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/desktop-release.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/desktop-release.yml
git commit -m "desktop-release: emit manifest URL pointing at zip.1kko.com"
```

---

## Task 4: Make the install page download button read the manifest dynamically

**Files:**
- Modify: `public/desktop-install.html`

Why dynamic: the install page's "최신 버전 다운로드" button currently hardcodes `github.com/.../releases/latest`. After this PR, we want it to point at `zip.1kko.com/desktop/Zip_VERSION_universal.dmg`. Hardcoding requires bumping the file on every release. Dynamic reads `desktop-latest.json` at page load and uses its `downloadUrl` — single source of truth, never goes stale.

- [ ] **Step 1: Find the current button markup**

```bash
grep -n -A1 'class="download-button"' public/desktop-install.html
```

You'll see (around line 33):

```html
<a class="download-button" href="https://github.com/1kko/ikkonezip/releases/latest" id="dl-link">
  최신 버전 다운로드 (DMG)
</a>
```

- [ ] **Step 2: Replace the button + add a small inline script**

Replace the `<a>` tag with:

```html
<a class="download-button" href="https://github.com/1kko/ikkonezip/releases/latest" id="dl-link">
  최신 버전 다운로드 (DMG)
</a>
<script>
  // Read the manifest and rewrite the download button to point at our
  // self-hosted DMG. Falls back to the hardcoded GitHub Releases URL
  // (default href above) if the manifest is unreachable.
  fetch('/desktop-latest.json', { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : null)
    .then(m => {
      if (!m || !m.downloadUrl || m.version === '0.0.0') return;
      const a = document.getElementById('dl-link');
      a.href = m.downloadUrl;
      a.textContent = '최신 버전 다운로드 (v' + m.version + ', DMG)';
    })
    .catch(() => {});
</script>
```

The default `href` (the GitHub URL) becomes the fallback for the rare case where the JSON fetch fails — users still get a working link.

- [ ] **Step 3: Open the file in a browser to verify**

```bash
open public/desktop-install.html
```

(or load it via `npm run dev` if `open` doesn't work for HTML in your environment.)

The button text on the local file (no fetch) stays `최신 버전 다운로드 (DMG)` — fetch fails on `file://` and the fallback is in effect, which is the right behavior. To verify the dynamic path works, you'd serve via `npx serve public/` or wait for the deploy.

- [ ] **Step 4: Commit**

```bash
git add public/desktop-install.html
git commit -m "Make install page button read manifest dynamically (single source of truth)"
```

---

## Task 5: nginx Cache-Control for /desktop/*.dmg

**Files:**
- Modify: `nginx.conf`

- [ ] **Step 1: Read current nginx.conf**

```bash
cat nginx.conf
```

Note the existing structure: there are likely `location` blocks for `/healthz`, the SPA fallback, and (from PR-58) `/desktop-latest.json`.

- [ ] **Step 2: Add a location block for DMG files**

Add this block near the other `location` directives, BEFORE the SPA-fallback `location /` block (nginx evaluates location blocks in a specific order — exact and prefix matches with `=` and `^~` win over regex matches over plain prefix):

```nginx
location ~ ^/desktop/.*\.dmg$ {
    include /etc/nginx/snippets/security_headers.conf;
    # DMG URLs are version-pinned (Zip_VERSION_universal.dmg) and the
    # contents never change for a given version, so safe to cache aggressively.
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    default_type application/x-apple-diskimage;
}
```

If you're unsure where exactly to place it, search for the line `location / {` (the SPA fallback) and put the new block immediately before it.

- [ ] **Step 3: Validate the conf syntax**

If you have nginx installed locally:
```bash
nginx -t -c "$(pwd)/nginx.conf" 2>&1 | head -5
```

If not, skip — the deploy will fail-fast on syntax errors.

- [ ] **Step 4: Commit**

```bash
git add nginx.conf
git commit -m "nginx: cache /desktop/*.dmg as immutable (version-pinned URLs)"
```

---

## Task 6: Push branch + open PR

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin feat/desktop-self-hosted-dmg
gh pr create --title "Self-host desktop DMG via Dockerfile build-time fetch" --body "$(cat <<'EOF'
## Summary
Moves the user-facing desktop download URL from `github.com/.../releases/...` to `https://zip.1kko.com/desktop/...`. The DMG is fetched from GitHub Releases at Coolify Docker build time and embedded into the nginx image. No SSH from CI, no source repo binary, no Coolify volume mount.

## Architecture
- **Dockerfile** runtime stage adds a `RUN` that reads `public/desktop-latest.json`, derives the GH Release URL by convention from the version field, and `curl`s the DMG into `/usr/share/nginx/html/desktop/`. Fail-soft via `|| echo`.
- **Manifest** `downloadUrl` flips from `github.com` to `zip.1kko.com/desktop/...`.
- **CI workflow** updates the manifest URL pattern for future releases.
- **Install page** fetches the manifest at page load and rewrites the download button — single source of truth, never goes stale.
- **nginx** adds `Cache-Control: immutable` for `/desktop/*.dmg` (version-pinned URLs).

## Test plan
- [x] Dockerfile builds locally, embedded DMG present
- [x] Manifest valid JSON
- [x] Workflow YAML valid
- [ ] After merge: \`curl -I https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg\` returns 200
- [ ] \`curl https://zip.1kko.com/desktop-latest.json\` shows the new URL
- [ ] \`curl https://zip.1kko.com/desktop-install.html\` button anchor stays as fallback in static HTML; live page after JS loads shows \`v0.1.1\` and \`zip.1kko.com\` href
- [ ] Tagging \`v0.1.2-desktop\`: CI builds + uploads to GH Releases + commits new manifest with \`zip.1kko.com\` URL → Coolify rebuilds → new DMG embedded

## Related
- Spec: \`docs/superpowers/specs/2026-04-22-desktop-self-hosted-design.md\`
EOF
)"
```

---

## Task 7: Post-merge verification (manual)

After CI passes and you merge the PR + Coolify rebuilds:

- [ ] **Step 1: Wait for the web deploy bundle hash to flip**

```bash
prev=$(curl -fsS https://zip.1kko.com/ | grep -oE 'index-[A-Za-z0-9]+\.js' | head -1)
echo "Pre-deploy bundle: $prev"
# Wait 30-60s, then re-check until different
until h=$(curl -fsS https://zip.1kko.com/ | grep -oE 'index-[A-Za-z0-9]+\.js' | head -1) && [ -n "$h" ] && [ "$h" != "$prev" ]; do sleep 10; done
echo "Post-deploy bundle: $h"
```

- [ ] **Step 2: Verify the DMG is served from our domain**

```bash
curl -sI https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg | head -10
```

Expected:
- `HTTP/2 200`
- `content-type: application/x-apple-diskimage`
- `cache-control: public, max-age=31536000, immutable`
- `content-length: ~10000000` (around 10 MB)

If you see 404, check the Coolify build logs for the WARN message — likely the GH Release URL was wrong (asset rename, version mismatch).

- [ ] **Step 3: Verify the manifest reports the new URL**

```bash
curl -s https://zip.1kko.com/desktop-latest.json | jq .
```

Expected: `downloadUrl` value starts with `https://zip.1kko.com/desktop/`.

- [ ] **Step 4: Verify the install page button updates dynamically**

Open `https://zip.1kko.com/desktop-install.html` in a browser. The button should:
- Show text like `최신 버전 다운로드 (v0.1.1, DMG)` (note the version inline)
- Have `href="https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg"` (inspect via DevTools)

- [ ] **Step 5: Smoke test the actual download**

Click the button. The DMG should download from `zip.1kko.com` (visible in the browser's downloads list). Open it — the .app should mount as before.

- [ ] **Step 6: Verify already-installed v0.1.1 desktop app still works**

Quit and re-open the v0.1.1 desktop app installed from PR-58/PR-59. Its launch ping fetches `zip.1kko.com/desktop-latest.json` and finds the same v0.1.1 (no toast — current). When the next release v0.1.2 ships, the toast should appear with a download link pointing at our domain.

If you don't have the v0.1.1 app installed, this step is a no-op — verified by the next release cycle.

---

## Spec coverage checklist (self-review)

| Spec acceptance | Plan task |
|------------------|-----------|
| `curl -I https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg` returns 200 | Task 7 Step 2 |
| Manifest's `downloadUrl` points at our domain | Task 2 + Task 7 Step 3 |
| Tagging `v0.1.2-desktop` produces correctly-URL'd manifest | Task 3 |
| Existing v0.1.1 launch ping sees v0.1.2 toast pointing to our domain | Task 7 Step 6 |
| Web-only Coolify deploys skip DMG fetch via Docker layer cache | Implicit in Task 1 (Docker behavior — no test) |
| Legacy `https://zip.1kko.com/desktop-latest.json` URL keeps working | Implicit — Vite copies `public/` → `dist/`; no change |
| nginx caches DMGs as immutable | Task 5 + Task 7 Step 2 (cache-control header check) |

| Spec architecture requirement | Plan task |
|--------------------------------|-----------|
| Dockerfile fetches DMG at build time | Task 1 |
| Fetch is fail-soft on GH outage | Task 1 (`\|\| echo`) |
| Skip fetch when version is `0.0.0` | Task 1 (the `if` guard) |
| GH Releases stays as canonical archive | No code change — already true |
| Install page reads manifest dynamically | Task 4 |
| User-visible URL on `zip.1kko.com` | Tasks 2 + 3 + 4 + 5 collectively |

All spec criteria mapped.

## Risks (from spec, repeated for visibility)

| Risk | Status |
|------|--------|
| GH Release down during Coolify rebuild | Handled by Task 1's `\|\| echo` |
| Image size +10 MB | Acceptable, single DMG only |
| Asset-name pattern assumption | Stable per Tauri 2 convention; Task 1's URL construction matches |
| `version: "0.0.0"` placeholder in bootstrap | Task 1 skips fetch, Task 2 already sets to v0.1.1 |
| Install page version drift | Task 4's dynamic fetch eliminates this |
