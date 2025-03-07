CREATE DATABASE learnwayindexer;

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  block_number BIGINT NOT NULL,
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42) NOT NULL,
  value TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  method_name VARCHAR(100),
  tx_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  decoded_data JSONB
);

CREATE INDEX idx_block_number ON transactions (block_number);
CREATE INDEX idx_from_address ON transactions (from_address);
CREATE INDEX idx_to_address ON transactions (to_address);
CREATE INDEX idx_timestamp ON transactions (timestamp);