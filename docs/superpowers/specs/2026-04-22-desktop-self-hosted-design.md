# Desktop DMG Self-Hosted (Build-Time Fetch) — Design

**Date:** 2026-04-22
**Status:** Approved (design)
**Scope:** Move the user-facing desktop download URL from `github.com` to `zip.1kko.com`, by having the Coolify Docker build pull the latest DMG from GitHub Releases and embed it into the image at build time.

## Goals

1. **Public download URL on our own domain** — `https://zip.1kko.com/desktop/Zip_VERSION_universal.dmg` instead of `github.com/.../releases/download/...`. Branding + control + GH-outage isolation for end users.
2. **No SSH from CI to host** — write access to the production server stays out of CI's surface area.
3. **No binary in source repo** — keep the repo clean; no Git LFS quota dependency.
4. **No new infrastructure** — uses standard Docker build + existing Coolify deploy hook.

## Non-goals

- Multi-region CDN (single-host fine for current scale)
- Per-version pretty URLs like `/desktop/v0.1.1/...` (flat dir is enough)
- DMG mirroring across multiple hosts
- Removing GitHub Releases entirely (kept as canonical archive + changelog source)

## Architecture

End-to-end flow on a desktop release:

1. **macOS GitHub Actions runner** builds the universal DMG (existing).
2. **CI uploads DMG to GitHub Releases** (existing — `softprops/action-gh-release@v2`).
3. **CI updates `public/desktop-latest.json`** with the new version + a `downloadUrl` pointing at `https://zip.1kko.com/desktop/...`. Commits + pushes to main using `GITHUB_TOKEN` (no SSH).
4. **Web deploy auto-triggers on push** (existing).
5. **Coolify rebuilds the Docker image**. The Dockerfile's runtime stage now reads `public/desktop-latest.json`, parses the version, constructs the GitHub Release URL by convention (`https://github.com/1kko/ikkonezip/releases/download/v${VERSION}-desktop/Zip_${VERSION}_universal.dmg`), and `curl`s the DMG into `/usr/share/nginx/html/desktop/`.
6. **nginx serves the DMG** from the image filesystem at `https://zip.1kko.com/desktop/Zip_VERSION_universal.dmg`.

The DMG never lives in the repo. It lives in two places: GitHub Releases (canonical archive) and inside each Coolify image build (served).

### Docker layer caching

The `RUN` step that fetches the DMG depends on `public/desktop-latest.json` (copied into the build context just before). Docker invalidates the layer iff that file's content changed. Practical effect:

- **Web-only push** (no version change): JSON unchanged → layer cached → no fetch → fast deploy.
- **Desktop release push**: JSON changed → layer invalidated → fetch new DMG → embed.

This is automatic Docker behavior — no special cache key needed.

### Fail-soft on fetch error

The `curl` step uses `|| echo "WARN: ..."` so a transient GitHub outage during build does not fail the whole deploy. The new image just lacks `/desktop/...` — already-running containers continue serving the previous image with the previous DMG. Next successful build recovers.

### Bootstrap

The current `public/desktop-latest.json` has `version: "0.0.0"` (placeholder from the manual fix earlier today, then v0.1.1 from PR-59 merge). The Dockerfile skips fetch if version is `"0.0.0"`. After this PR merges, the next desktop release tag will populate the manifest with v0.1.2 and the next deploy will embed the v0.1.2 DMG.

For v0.1.1 to be available immediately at the new URL after this PR lands, the PR also needs to set `desktop-latest.json` to v0.1.1 (it already is from PR-59) so the first Coolify rebuild fetches v0.1.1.

## Backward compatibility

- **Legacy `https://zip.1kko.com/desktop-latest.json`** — already served by Vite copying `public/desktop-latest.json` to `dist/`. No change. v0.1.0 and v0.1.1 desktop apps continue to ping this URL and discover updates. The change is just the `downloadUrl` *value* (now points to our domain, not github).
- **Legacy GitHub Release download URLs** — keep working forever. GH Releases is permanent. The website install page (`public/desktop-install.html`) currently links to `releases/latest`; we update its href to use our new `zip.1kko.com/desktop/...` URL but the old GH URLs still resolve.
- **Existing v0.1.0 / v0.1.1 desktop apps**: their launch ping reads `desktop-latest.json` from `zip.1kko.com`, sees the new `downloadUrl` value, and the toast points users to download from our domain. Smooth migration.

## Files to change

| File | Change |
|------|--------|
| `Dockerfile` | Add a runtime-stage `RUN` that reads `public/desktop-latest.json`, fetches the matching DMG from GH Release, copies into nginx's html dir |
| `public/desktop-latest.json` | Update `downloadUrl` to `https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg` (was `github.com`). Version stays `0.1.1`. |
| `.github/workflows/desktop-release.yml` | Update the manifest-construction step so future releases use the `zip.1kko.com/desktop/...` URL pattern |
| `public/desktop-install.html` | Update the "최신 버전 다운로드" button href from `github.com/.../releases/latest` to read the manifest dynamically (one inline `<script>`) OR hardcode `https://zip.1kko.com/desktop/Zip_LATEST_universal.dmg` (then bump it on each release — manual but simple) |
| `nginx.conf` | Optional: add `location ~ ^/desktop/.*\.dmg$ { ... }` with `Cache-Control: public, max-age=31536000, immutable` since each version URL is unique |

## CI workflow change

The current "Update desktop-latest.json" step constructs `DOWNLOAD_URL` from the GH Release asset name. Change one line:

```bash
# Before:
DOWNLOAD_URL="https://github.com/${{ github.repository }}/releases/download/${{ steps.version.outputs.tag }}/$ASSET_NAME"

# After:
DOWNLOAD_URL="https://zip.1kko.com/desktop/$ASSET_NAME"
```

The "Commit and push" step stays — we still need this commit to trigger Coolify rebuild + give the Dockerfile something to read.

## Acceptance

- [ ] After PR merge: `curl -I https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg` returns `200 OK` (DMG embedded in current image)
- [ ] `curl https://zip.1kko.com/desktop-latest.json` shows `downloadUrl` pointing at `zip.1kko.com/desktop/...`
- [ ] Tagging v0.1.2-desktop: CI builds DMG → uploads to GH → commits new manifest → Coolify rebuilds → new DMG served at `zip.1kko.com/desktop/Zip_0.1.2_universal.dmg`
- [ ] Existing v0.1.1 desktop app launch ping sees a v0.1.2 toast pointing to our domain
- [ ] Coolify deploys for non-desktop changes (web SPA edits) skip the DMG fetch via Docker cache (deploy time stays under 1 min)

## Risks / Mitigations

| Risk | Mitigation |
|------|-----------|
| GitHub Release down during Coolify rebuild | `\|\| echo` fallback — image builds without DMG, previous image keeps serving, next rebuild recovers |
| Image size grows from ~30 MB → ~40 MB | Acceptable; only one DMG per image at a time |
| Asset-name pattern assumed (`Zip_${VERSION}_universal.dmg`) | Pattern is stable per Tauri 2 convention. If Tauri ever changes its DMG naming, the Dockerfile fetch will 404 and we'd see it on the next deploy. Easy fix at that point. |
| Manifest version `0.0.0` leaves `/desktop/` empty | Skip fetch when version is `0.0.0`. Bootstrap requires manual seed (already done — manifest is at v0.1.1). |
| `public/desktop-install.html` hardcoded version drift | Either dynamically read from manifest via JS, or accept manual bump on each release. Either way, GH releases/latest fallback link can be added as backup. |

## Open questions

None — design locked.
