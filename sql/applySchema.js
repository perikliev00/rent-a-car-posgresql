#!/usr/bin/env node
/**
 * Прилага всички SQL schema файлове от sql/schema/ в азбучен ред.
 * Usage: node sql/applySchema.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

const SCHEMA_DIR = path.join(__dirname, 'schema');

async function applySchema() {
  const files = fs
    .readdirSync(SCHEMA_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (!files.length) {
    throw new Error(`No schema files found in ${SCHEMA_DIR}`);
  }

  const client = await pool.connect();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8');
      console.log(`→ ${file}`);
      await client.query(sql);
    }
    console.log('✓ Schema applied successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

applySchema().catch((err) => {
  console.error('Schema apply failed:', err.message);
  process.exit(1);
});
