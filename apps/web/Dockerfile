FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@10

COPY . .
RUN pnpm install

WORKDIR /app/apps/web
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
