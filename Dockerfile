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

# Fetch the current desktop DMG from GitHub Releases at build time and embed
# it into nginx's html dir. This is what enables the user-facing download URL
# to live on our own domain (https://zip.1kko.com/desktop/...) without
# requiring SSH from CI to the host. The fetch is fail-soft: a transient GH
# outage during build leaves the new image without /desktop/, but the
# previously-running container keeps serving with the previous image.
#
# AUTH: ikkonezip is a private repo. GitHub's /releases/download/{tag}/{name}
# URL (browser_download_url) does NOT honor Bearer tokens for private repos —
# it uses session-cookie auth only and 404s for any programmatic Bearer call.
# The REST API endpoint /repos/{owner}/{repo}/releases/assets/{id} DOES honor
# Bearer + redirects to a presigned S3 URL. So we look up the asset ID from
# the tag, then download via the asset API.
#
# Coolify passes a fine-grained PAT (contents:read) as the
# GITHUB_TOKEN_DESKTOP_FETCH build arg. If empty (e.g. local docker build
# without the arg), the API call fails and the fail-soft fallback skips
# the DMG so the build still succeeds.
ARG GITHUB_TOKEN_DESKTOP_FETCH=""
COPY public/desktop-latest.json /tmp/manifest.json
RUN apk add --no-cache curl jq && \
    VERSION=$(jq -r '.version' /tmp/manifest.json) && \
    if [ -n "$VERSION" ] && [ "$VERSION" != "null" ] && [ "$VERSION" != "0.0.0" ]; then \
      DMG="Zip_${VERSION}_universal.dmg"; \
      mkdir -p /usr/share/nginx/html/desktop; \
      ASSET_ID=$(curl -fsSL \
        -H "Authorization: Bearer ${GITHUB_TOKEN_DESKTOP_FETCH}" \
        "https://api.github.com/repos/1kko/ikkonezip/releases/tags/v${VERSION}-desktop" \
        | jq -r --arg name "$DMG" '.assets[] | select(.name == $name) | .id' | head -1); \
      if [ -n "$ASSET_ID" ]; then \
        curl -fsSL --retry 3 \
          -H "Authorization: Bearer ${GITHUB_TOKEN_DESKTOP_FETCH}" \
          -H "Accept: application/octet-stream" \
          -o "/usr/share/nginx/html/desktop/${DMG}" \
          "https://api.github.com/repos/1kko/ikkonezip/releases/assets/${ASSET_ID}" \
          || echo "WARN: DMG fetch failed for v${VERSION}; /desktop/${DMG} will 404"; \
      else \
        echo "WARN: no asset matching ${DMG} found in release v${VERSION}-desktop"; \
      fi; \
    fi && \
    rm -f /tmp/manifest.json && \
    apk del curl jq

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/healthz || exit 1
