# Toolchains stay in the build stage; production serves immutable static files.
ARG NODE_IMAGE=node:26.13.1-alpine3.24@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5
ARG NGINX_IMAGE=nginx:1.30.6-alpine3.24-slim@sha256:e2355aa95529a7999dad94ddcb45a8768abf6fb0b204c93b1a3ffce477d7b893
FROM ${NODE_IMAGE} AS build
WORKDIR /site
ENV ASTRO_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY astro.config.mjs tsconfig.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN npm run check

FROM ${NGINX_IMAGE} AS runtime
ARG SINGVERSE_VERSION=0.0.0
ARG SOURCE_REVISION=unknown
ARG SOURCE_URL=https://github.com/mynora-dot/singverse-website
LABEL org.opencontainers.image.title="SingVerse Website" \
      org.opencontainers.image.description="SingVerse product website and documentation" \
      org.opencontainers.image.version="${SINGVERSE_VERSION}" \
      org.opencontainers.image.revision="${SOURCE_REVISION}" \
      org.opencontainers.image.source="${SOURCE_URL}"
RUN rm -f /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /site/dist/ /usr/share/nginx/html/
COPY --from=build /site/.build/security-headers.conf /etc/nginx/security-headers.conf
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
