# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /build

## Dependencies layer
COPY ["package.json", "yarn.lock", "tsconfig.json", "./"]
RUN yarn install --frozen-lockfile

## Code layer
COPY . .

## Build layer
RUN yarn build

# Stage 2: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app

## Copy only necessary files for runtime
COPY --from=builder /build/dist /app/dist/
COPY --from=builder /build/node_modules /app/node_modules

CMD ["node", "dist/main.js"]
