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
# AUTH: ikkonezip is a private repo, so unauthenticated curl returns 404
# (GitHub masks private-repo existence). Coolify is configured to pass a
# fine-grained PAT (read-only on contents) as the GITHUB_TOKEN_DESKTOP_FETCH
# build arg. If empty (e.g. local docker build without the arg), the curl
# 404s and the fail-soft fallback skips the DMG.
ARG GITHUB_TOKEN_DESKTOP_FETCH=""
COPY public/desktop-latest.json /tmp/manifest.json
RUN apk add --no-cache curl jq && \
    VERSION=$(jq -r '.version' /tmp/manifest.json) && \
    if [ -n "$VERSION" ] && [ "$VERSION" != "null" ] && [ "$VERSION" != "0.0.0" ]; then \
      DMG="Zip_${VERSION}_universal.dmg"; \
      mkdir -p /usr/share/nginx/html/desktop; \
      curl -fsSL --retry 3 \
        -H "Authorization: Bearer ${GITHUB_TOKEN_DESKTOP_FETCH}" \
        -o "/usr/share/nginx/html/desktop/${DMG}" \
        "https://github.com/1kko/ikkonezip/releases/download/v${VERSION}-desktop/${DMG}" \
        || echo "WARN: DMG fetch failed for v${VERSION}; /desktop/${DMG} will 404"; \
    fi && \
    rm -f /tmp/manifest.json && \
    apk del curl jq

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/healthz || exit 1
