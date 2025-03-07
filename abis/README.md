# Blockchain Data API Documentation

## Overview

This API provides access to blockchain transaction data indexed from the Sepolia network. It allows you to retrieve transaction information, search for specific transactions, and get statistics about blockchain activity.

## Base URL

```
https://your-api-domain.com
```

## Authentication

Currently, this API does not require authentication.

## Response Format

All responses are returned in JSON format.

## Endpoints

### Get Recent Transactions

Returns the most recent transactions in descending order by timestamp.

```
GET /api/transactions
```

#### Response

```json
[
  {
    "id": 1,
    "tx_hash": "0x123...",
    "block_number": 1234567,
    "from_address": "0xabc...",
    "to_address": "0xdef...",
    "value": "1000000000000000000",
    "timestamp": "2023-04-12T15:30:45.000Z",
    "method_name": "transfer",
    "tx_type": "Token Transfer",
    "status": "confirmed",
    "decoded_data": {"amount": "1000000000000000000"}
  },
  // ...more transactions
]
```

### Get Paginated Transactions

Returns transactions with pagination support.

```
GET /api/transactions/page/:page?limit=20
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| page | Integer | Page number (starts at 1) |
| limit | Integer | Number of results per page (default: 20) |

#### Response

```json
{
  "data": [
    {
      "id": 1,
      "tx_hash": "0x123...",
      // ...other transaction fields
    },
    // ...more transactions
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalCount": 195,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Get Transaction by Hash

Returns details for a specific transaction.

```
GET /api/transactions/:txHash
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| txHash | String | Transaction hash |

#### Response

```json
{
  "id": 1,
  "tx_hash": "0x123...",
  "block_number": 1234567,
  "from_address": "0xabc...",
  "to_address": "0xdef...",
  "value": "1000000000000000000",
  "timestamp": "2023-04-12T15:30:45.000Z",
  "method_name": "transfer",
  "tx_type": "Token Transfer",
  "status": "confirmed",
  "decoded_data": {"amount": "1000000000000000000"}
}
```

#### Error Responses

| Status Code | Description |
|-------------|-------------|
| 404 | Transaction not found |

### Get Address Transactions

Returns all transactions involving a specific address (as sender or receiver).

```
GET /api/address/:address/transactions?page=1&limit=20
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| address | String | Ethereum address |
| page | Integer | Page number (starts at 1) |
| limit | Integer | Number of results per page (default: 20) |

#### Response

```json
{
  "data": [
    {
      "id": 1,
      "tx_hash": "0x123...",
      // ...other transaction fields
    },
    // ...more transactions
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 87,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Get Transactions by Type

Returns transactions filtered by transaction type.

```
GET /api/transactions/type/:txType?page=1&limit=20
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| txType | String | Transaction type (e.g., "Token Transfer", "Quiz Stake") |
| page | Integer | Page number (starts at 1) |
| limit | Integer | Number of results per page (default: 20) |

#### Response

```json
{
  "data": [
    {
      "id": 1,
      "tx_hash": "0x123...",
      // ...other transaction fields
    },
    // ...more transactions
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 8,
    "totalCount": 150,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Get Statistics

Returns summary statistics about indexed blockchain data.

```
GET /api/stats
```

#### Response

```json
{
  "totalTransactions": 1500,
  "totalTransfers": 1200,
  "totalQuizStakes": 300,
  "latestBlock": 12345678,
  "uniqueAddresses": 450
}
```

### Search Transactions

Allows searching for transactions by hash or address.

```
GET /api/search?q=0x123
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| q | String | Search query (partial transaction hash or address) |

#### Response

```json
[
  {
    "id": 1,
    "tx_hash": "0x123...",
    // ...other transaction fields
  },
  // ...more matching transactions (up to 50)
]
```

## Error Handling

The API uses standard HTTP status codes to indicate the success or failure of requests.

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - The request was invalid |
| 404 | Not Found - The specified resource was not found |
| 500 | Internal Server Error - Something went wrong on the server |

### Error Response Format

```json
{
  "error": "Error message describing what went wrong"
}
```

## Rate Limiting

Currently, there are no rate limits implemented.

## Future Enhancements

- Authentication support
- WebSocket support for real-time updates
- Enhanced filtering options