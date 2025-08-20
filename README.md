# saros-dlmm-indexer-service

A Node.js/TypeScript service for indexing Solana DLMM (Dynamic Liquidity Market Maker) transactions using NestJS, MongoDB, and BullMQ.

## Architecture

- **Scanner**: Monitors Solana blockchain for DLMM program transactions
- **Consumer**: Processes transactions through specialized workers
- **Queue System**: RabbitMQ for reliable job processing
- **Database**: MongoDB for data persistence
- **Real-time Processing**: Supports swap events, position management, and composition fees
- **Error Handling**: Dead Letter Queue (DLQ) for failed transactions

## API Documentation

- [Swagger](http://localhost:3000/api/docs)
- [Health check](http://localhost:3000/api/v1/health)

## Run service

```bash
# Development mode
yarn dev

# Production mode
yarn build
yarn start
```

## Docker build

```bash
docker build . -t saros-dlmm-indexer -f docker/Dockerfile
```
