FROM node:20-alpine

WORKDIR /app

# Copy only the manifest — source arrives at runtime via GWS file sync (PVC mount)
COPY package.json package-lock.json* ./

RUN npm install

EXPOSE 3000

ENV NODE_ENV=development
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# The GWS workspace PVC is mounted over /app at runtime, which shadows the
# node_modules installed above (node_modules is excluded from file sync). Install
# deps into the mounted workspace on first start; the PVC persists across
# restarts, so this only runs once.
CMD ["sh", "-c", "if [ ! -x node_modules/.bin/next ]; then echo 'Installing dependencies into workspace...'; npm install; fi; exec npm run dev"]
