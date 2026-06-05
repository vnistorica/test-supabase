FROM node:20-alpine

WORKDIR /app

# Copy only the manifest — source arrives at runtime via GWS file sync (PVC mount)
COPY package.json package-lock.json* ./

RUN npm install

EXPOSE 3000

ENV NODE_ENV=development
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["npm", "run", "dev"]
