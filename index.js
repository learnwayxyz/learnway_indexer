const express = require("express");
const cors = require("cors");
const pool = require("./db");
const { JsonRpcProvider } = require("ethers");
const { ethers } = require("ethers");

const app = express();

/// Middleware
app.use(cors());
app.use(express.json());

/// Import ABIs
const tokenAbi = require("./abis/learnwaytoken.json");
const quizAbi = require("./abis/learnwaypoc.json");

// Contract addresses
const tokenAddress = "0x8D6Eb13387fef993414378d8304754B93B2B9857";
const quizAddress = "0x02cbE607b9E0C19543f672718ca997692840FdBd";

// Connect to blockchain
const provider = new JsonRpcProvider("https://rpc.sepolia-api.lisk.com");

const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
const quizContract = new ethers.Contract(quizAddress, quizAbi, provider);

// Keep track of the last processed block
let lastProcessedBlock = 0;

/**
 * Inserts a transaction into the database
 */
const insertTransaction = async (
  txHash,
  blockNumber,
  from,
  to,
  value,
  timestamp,
  method,
  type,
  decodedData
) => {
  try {
    // Prevent duplicate entries
    const checkQuery = "SELECT 1 FROM transactions WHERE tx_hash = $1";
    const checkResult = await pool.query(checkQuery, [txHash]);

    if (checkResult.rowCount === 0) {
      const insertQuery = `
        INSERT INTO transactions (tx_hash, block_number, from_address, to_address, value, timestamp, method_name, tx_type, status, decoded_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9)
      `;

      await pool.query(insertQuery, [
        txHash,
        blockNumber,
        from,
        to,
        value.toString(),
        timestamp,
        method,
        type,
        JSON.stringify(decodedData),
      ]);

      console.log(`✅ Transaction inserted: ${txHash}`);
    } else {
      console.log(`⚠️ Duplicate transaction detected: ${txHash}`);
    }
  } catch (error) {
    console.error("❌ Error inserting transaction:", error.message);
  }
};

// Initialize last processed block
async function initializeLastBlock() {
  try {
    // Try to get the last processed block from database
    const query = "SELECT MAX(block_number) as last_block FROM transactions";
    const result = await pool.query(query);

    if (result.rows[0].last_block) {
      lastProcessedBlock = parseInt(result.rows[0].last_block);
      console.log(`📊 Resuming from block ${lastProcessedBlock}`);
    } else {
      // If no transactions in DB, start from current block
      const currentBlock = await provider.getBlockNumber();
      lastProcessedBlock = currentBlock - 100; // Start 100 blocks back
      console.log(`📊 Starting from block ${lastProcessedBlock}`);
    }
  } catch (error) {
    console.error("❌ Error initializing last block:", error.message);
    // Default to current block - 100 if there's an error
    const currentBlock = await provider.getBlockNumber();
    lastProcessedBlock = currentBlock - 100;
  }
}

// Process Transfer events
async function processTransferEvents(fromBlock, toBlock) {
  try {
    const filter = tokenContract.filters.Transfer();
    const events = await tokenContract.queryFilter(filter, fromBlock, toBlock);

    console.log(
      `🔍 Found ${events.length} Transfer events between blocks ${fromBlock} and ${toBlock}`
    );

    for (const event of events) {
      const block = await event.getBlock();
      const timestamp = new Date(block.timestamp * 1000);

      await insertTransaction(
        event.transactionHash,
        event.blockNumber,
        event.args[0], // from
        event.args[1], // to
        event.args[2], // amount
        timestamp,
        "transfer",
        "Token Transfer",
        { amount: event.args[2].toString() }
      );
    }
  } catch (error) {
    console.error(
      `❌ Error processing Transfer events for blocks ${fromBlock}-${toBlock}:`,
      error.message
    );
  }
}

// Process Quiz events
async function processQuizEvents(fromBlock, toBlock) {
  try {
    const filter = quizContract.filters.QuizOpened();
    const events = await quizContract.queryFilter(filter, fromBlock, toBlock);

    console.log(
      `🧩 Found ${events.length} QuizOpened events between blocks ${fromBlock} and ${toBlock}`
    );

    for (const event of events) {
      const block = await event.getBlock();
      const timestamp = new Date(block.timestamp * 1000);

      await insertTransaction(
        event.transactionHash,
        event.blockNumber,
        event.args[0], // user
        quizAddress,
        event.args[2], // amount
        timestamp,
        "stakeForQuiz",
        "Quiz Stake",
        {
          quizId: event.args[1].toString(),
          amount: event.args[2].toString(),
        }
      );
    }
  } catch (error) {
    console.error(
      `❌ Error processing QuizOpened events for blocks ${fromBlock}-${toBlock}:`,
      error.message
    );
  }
}

// async function process

// Poll for new events
async function pollEvents() {
  try {
    const currentBlock = await provider.getBlockNumber();

    // If no new blocks, skip processing
    if (currentBlock <= lastProcessedBlock) {
      return;
    }

    // Process in chunks of 1000 blocks to avoid timeout
    const CHUNK_SIZE = 1000;
    let fromBlock = lastProcessedBlock + 1;

    while (fromBlock <= currentBlock) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);

      console.log(`🔄 Processing blocks ${fromBlock} to ${toBlock}`);

      // Process events in parallel
      await Promise.all([
        processTransferEvents(fromBlock, toBlock),
        processQuizEvents(fromBlock, toBlock),
      ]);

      // Update last processed block
      lastProcessedBlock = toBlock;
      fromBlock = toBlock + 1;
    }

    console.log(`✅ Processed up to block ${lastProcessedBlock}`);
  } catch (error) {
    console.error("❌ Error in polling events:", error.message);
  }
}

async function ensureTablesExist() {
  try {
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log("📊 Creating transactions table...");
      await pool.query(`
        CREATE TABLE transactions (
          id SERIAL PRIMARY KEY,
          tx_hash VARCHAR(66) UNIQUE NOT NULL,
          block_number BIGINT NOT NULL,
          from_address VARCHAR(42) NOT NULL,
          to_address VARCHAR(42) NOT NULL,
          value TEXT NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          method_name VARCHAR(100),
          tx_type VARCHAR(100),
          status VARCHAR(20),
          decoded_data JSONB
        );
      `);
      console.log("✅ Transactions table created successfully");
    } else {
      console.log("✅ Transactions table already exists");
    }
  } catch (error) {
    console.error("❌ Error creating table:", error.message);
  }
}

app.get("/api/transactions", async (req, res) => {
  try {
    const query =
      "SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 100";
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Get transactions with pagination
app.get("/api/transactions/page/:page", async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query =
      "SELECT * FROM transactions ORDER BY timestamp DESC LIMIT $1 OFFSET $2";
    const countQuery = "SELECT COUNT(*) FROM transactions";

    const [result, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery),
    ]);

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Get transaction by hash
app.get("/api/transactions/:txHash", async (req, res) => {
  try {
    const query = "SELECT * FROM transactions WHERE tx_hash = $1";
    const result = await pool.query(query, [req.params.txHash]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching transaction:", error.message);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

// Get transactions by address (as sender or receiver)
app.get("/api/address/:address/transactions", async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query = `
      SELECT * FROM transactions 
      WHERE LOWER(from_address) = $1 OR LOWER(to_address) = $1 
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) FROM transactions
      WHERE LOWER(from_address) = $1 OR LOWER(to_address) = $1
    `;

    const [result, countResult] = await Promise.all([
      pool.query(query, [address, limit, offset]),
      pool.query(countQuery, [address]),
    ]);

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching address transactions:", error.message);
    res.status(500).json({ error: "Failed to fetch address transactions" });
  }
});

// Get transactions by type
app.get("/api/transactions/type/:txType", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query =
      "SELECT * FROM transactions WHERE tx_type = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3";
    const countQuery = "SELECT COUNT(*) FROM transactions WHERE tx_type = $1";

    const [result, countResult] = await Promise.all([
      pool.query(query, [req.params.txType, limit, offset]),
      pool.query(countQuery, [req.params.txType]),
    ]);

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions by type:", error.message);
    res.status(500).json({ error: "Failed to fetch transactions by type" });
  }
});

// Get transactions summary stats
app.get("/api/stats", async (req, res) => {
  try {
    const queries = {
      totalTransactions: "SELECT COUNT(*) FROM transactions",
      totalTransfers:
        "SELECT COUNT(*) FROM transactions WHERE tx_type = 'Token Transfer'",
      totalQuizStakes:
        "SELECT COUNT(*) FROM transactions WHERE tx_type = 'Quiz Stake'",
      latestBlock: "SELECT MAX(block_number) FROM transactions",
      uniqueAddresses: "SELECT COUNT(DISTINCT from_address) FROM transactions",
    };

    const results = {};

    for (const [key, query] of Object.entries(queries)) {
      const result = await pool.query(query);
      results[key] = parseInt(result.rows[0].count || result.rows[0].max || 0);
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching stats:", error.message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Search transactions
app.get("/api/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const query = `
      SELECT * FROM transactions 
      WHERE 
        tx_hash ILIKE $1 OR 
        from_address ILIKE $1 OR 
        to_address ILIKE $1
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [`%${q}%`]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error searching transactions:", error.message);
    res.status(500).json({ error: "Failed to search transactions" });
  }
});
// Start server and initialize indexer
app.listen(6000, async () => {
  console.log("🚀 Server is running on port 6000");

  try {
    await ensureTablesExist();
    await initializeLastBlock();

    // Immediately poll once
    await pollEvents();

    // Then set up regular polling interval (every 30 seconds)
    setInterval(pollEvents, 30000);

    console.log("📈 Indexer started successfully");
  } catch (error) {
    console.error("❌ Failed to start indexer:", error.message);
  }
});
