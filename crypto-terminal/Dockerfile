# Alpha Terminal — zero-dependency, so the image is tiny and builds in seconds.
FROM node:22-alpine

WORKDIR /app
COPY . /app

ENV PORT=8787 \
    ALPHA_BAR=5m \
    ALPHA_TOP=60

EXPOSE 8787

# Lightweight healthcheck against the web server.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:8787/healthz || exit 1

CMD ["node", "server.js"]
