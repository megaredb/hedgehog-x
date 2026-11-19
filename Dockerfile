# Production image for Hedgehog X (SvelteKit + adapter-node).
# Build: docker build -t hedgehog-x:prod .
# Runtime contains only production dependencies and the built server.

FROM node:24-bookworm-slim AS base
RUN npm install -g pnpm@11.7.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN node ./node_modules/@sveltejs/kit/svelte-kit.js sync \
 && node ./node_modules/vite/bin/vite.js build

FROM node:24-bookworm-slim AS runtime
RUN npm install -g pnpm@11.7.0
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV SHUTDOWN_TIMEOUT=30
# SvelteKit/adapter-node form body limit (default 512K).
ENV BODY_SIZE_LIMIT=550M

# Runtime-only dependencies. The root prepare script is harmless here; sharp
# installs its platform binary during this step.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY scripts ./scripts
RUN chmod +x /app/scripts/docker-entrypoint.sh \
 && chown -R node:node /app

USER node
EXPOSE 3000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "build/index.js"]
