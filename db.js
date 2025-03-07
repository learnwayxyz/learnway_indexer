const Pool = require("pg").Pool;
const pool = new Pool({
  user: "godwinekainu",
  password: "123456",
  host: "localhost",
  port: 5432,
  database: "learnwayindexer",
});
module.exports = pool;
