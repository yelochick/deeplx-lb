FROM node:20-alpine

COPY . /app
WORKDIR /app

RUN npm install -g pnpm
RUN pnpm install

EXPOSE 1188
CMD [ "pnpm", "start" ]