const { clientQuery } = require('../../db/transaction');

async function ensureSessionTable(client = null) {
  await clientQuery(
    client,
    `
    CREATE TABLE IF NOT EXISTS session (
      sid    VARCHAR     NOT NULL PRIMARY KEY,
      sess   JSON        NOT NULL,
      expire TIMESTAMPTZ NOT NULL
    )
    `
  );

  await clientQuery(
    client,
    `
    CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire)
    `
  );
}

async function listActiveSessionIds(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT sid
    FROM session
    WHERE expire > NOW()
    `
  );

  return result.rows.map((row) => String(row.sid));
}

module.exports = {
  ensureSessionTable,
  listActiveSessionIds,
};
