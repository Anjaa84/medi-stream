FROM node:20-alpine

WORKDIR /workspace

COPY package*.json ./
COPY patient-api/package*.json ./patient-api/
COPY event-producer/package*.json ./event-producer/
RUN npm install --workspaces --include-workspace-root=false

COPY patient-api ./patient-api
COPY event-producer ./event-producer

WORKDIR /workspace/patient-api

CMD ["npm", "run", "dev"]
