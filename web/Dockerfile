# Production image for the Next.js site.
# The API is reached same-origin at /backend/* and proxied to the api container, so the
# browser never needs the API's address (rewrites are fixed at build time).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_BASE=/backend \
    API_PROXY_TARGET=http://api:7860 \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npx next build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 API_PROXY_TARGET=http://api:7860
COPY --from=build /app ./
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
