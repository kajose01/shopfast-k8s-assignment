FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN mkdir -p /var/log/app && chown node:node /var/log/app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node server.js package.json ./
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:5000/healthz || exit 1
CMD ["node","server.js"]
