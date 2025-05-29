require('dotenv').config();

const { Pool } = require('pg')

module.exports = {
  pool: new Pool({
    connectionString: process.env.DB_URL,
  })
}