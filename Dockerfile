# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-snippets/security_headers.conf /etc/nginx/snippets/security_headers.conf

# Fetch the current desktop installers (macOS DMG, Windows NSIS, Linux
# AppImage) from GitHub Releases at build time and embed each into nginx's
# html dir under /desktop/. The user-facing download URLs all live on our
# own domain (https://zip.1kko.com/desktop/...) — no SSH from CI to host
# required. Each fetch is fail-soft so a single missing/broken artifact
# doesn't block the image build.
#
# AUTH (private repo): GitHub's /releases/download/{tag}/{name} URL does
# NOT honor Bearer tokens for private repos. The REST API endpoint
# /repos/{owner}/{repo}/releases/assets/{id} DOES — it 302-redirects to a
# presigned S3 URL. So we look up each asset's ID from the tag, then
# download via the asset API.
#
# Coolify passes a fine-grained PAT (contents:read) as the
# GITHUB_TOKEN_DESKTOP_FETCH build arg. Empty token still builds (the API
# call fails and the fail-soft fallback skips the artifact).
ARG GITHUB_TOKEN_DESKTOP_FETCH=""
COPY public/desktop-latest.json /tmp/manifest.json
RUN apk add --no-cache curl jq && \
    VERSION=$(jq -r '.version' /tmp/manifest.json) && \
    if [ -n "$VERSION" ] && [ "$VERSION" != "null" ] && [ "$VERSION" != "0.0.0" ]; then \
      mkdir -p /usr/share/nginx/html/desktop; \
      RELEASE_JSON=$(curl -fsSL \
        -H "Authorization: Bearer ${GITHUB_TOKEN_DESKTOP_FETCH}" \
        "https://api.github.com/repos/1kko/ikkonezip/releases/tags/v${VERSION}-desktop" || echo ""); \
      if [ -n "$RELEASE_JSON" ]; then \
        for SUFFIX in ".dmg" "-setup.exe" ".AppImage"; do \
          ASSET_NAME=$(printf '%s' "$RELEASE_JSON" | jq -r --arg suf "$SUFFIX" '[.assets[] | select(.name | endswith($suf))][0].name'); \
          ASSET_ID=$(printf '%s' "$RELEASE_JSON" | jq -r --arg suf "$SUFFIX" '[.assets[] | select(.name | endswith($suf))][0].id'); \
          if [ -n "$ASSET_ID" ] && [ "$ASSET_ID" != "null" ]; then \
            curl -fsSL --retry 3 \
              -H "Authorization: Bearer ${GITHUB_TOKEN_DESKTOP_FETCH}" \
              -H "Accept: application/octet-stream" \
              -o "/usr/share/nginx/html/desktop/${ASSET_NAME}" \
              "https://api.github.com/repos/1kko/ikkonezip/releases/assets/${ASSET_ID}" \
              || echo "WARN: fetch failed for ${ASSET_NAME}; will 404"; \
          else \
            echo "WARN: no asset matching *${SUFFIX} found in release v${VERSION}-desktop"; \
          fi; \
        done; \
      else \
        echo "WARN: release v${VERSION}-desktop not reachable; /desktop/ will be empty"; \
      fi; \
    fi && \
    rm -f /tmp/manifest.json && \
    apk del curl jq

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/healthz || exit 1
