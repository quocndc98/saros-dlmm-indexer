# saros-dlmm-indexer-service

A Node.js/TypeScript service for indexing Solana DLMM (Dynamic Liquidity Market Maker) transactions using NestJS, MongoDB, and BullMQ.

## Features

- **Scanner**: Monitors Solana blockchain for DLMM program transactions
- **Consumer**: Processes transactions through specialized workers
- **Queue System**: BullMQ for reliable job processing
- **Database**: MongoDB for data persistence
- **Real-time Processing**: Supports swap events, position management, and composition fees
- **Error Handling**: Dead Letter Queue (DLQ) for failed transactions
- **API Endpoints**: RESTful API for status monitoring

## Architecture

### Scanner (Producer)
- Monitors Solana blockchain for new transactions
- Filters transactions related to DLMM program
- Stores transaction events in MongoDB
- Queues transactions for processing

### Consumer (Worker)
- Processes queued transactions through specialized workers:
  - **Transaction Processor**: Parses raw transactions
  - **Swap Processor**: Handles swap events
  - **Position Processor**: Manages position lifecycle (create/increase/decrease/close)
  - **Composition Fees Processor**: Processes fee collection events
  - **Quote Asset Processor**: Manages token metadata
  - **DLQ Processor**: Handles failed processing attempts

## API Documentation

* [Swagger](http://localhost:3000/api/docs)
* [Health check](http://localhost:3000/api/v1/health)
* [Indexer status](http://localhost:3000/api/v1/indexer/status)

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/saros-dlmm-indexer

# Redis (for BullMQ)
REDIS_URL=redis://127.0.0.1:6379

# Solana RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Indexer Settings
ENABLE_SCANNER=true
GECKO_TERMINAL_API_KEY=your_api_key_here
```

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

## Queue Management

The service uses BullMQ with Redis for job processing:

- **Transaction Scanner Queue**: Scans for new transactions
- **Transaction Processor Queue**: Parses transaction data
- **Instruction Processor Queues**: Handles specific instruction types
- **DLQ Queue**: Processes failed jobs

## Database Schema

### Collections:
- `transaction_events`: Raw transaction signatures and metadata
- `swap_events`: Parsed swap transaction data
- `bin_swap_events`: Bin-level swap events
- `positions`: Position account states
- `position_update_events`: Position lifecycle events
- `composition_fees_events`: Fee collection events
- `quote_assets`: Token metadata and pricing
- `dlq_events`: Failed processing attempts

## Monitoring

Access real-time status via API endpoints:
- `/api/v1/indexer/status` - Overall indexer status
- `/api/v1/indexer/scanner/status` - Scanner status
- `/api/v1/indexer/consumer/status` - Consumer worker status
