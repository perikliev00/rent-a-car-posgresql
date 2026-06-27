const { clientQuery, isUniqueViolation } = require('../../db/transaction');

const USER_SELECT = `
  u.id,
  u.email,
  u.password,
  u.role,
  u.created_at,
  u.updated_at
`;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function mapSqlUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    email: row.email,
    password: row.password,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findUserByEmail(email, client = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${USER_SELECT}
    FROM users u
    WHERE LOWER(u.email) = $1
    LIMIT 1
    `,
    [normalizedEmail]
  );

  return mapSqlUser(result.rows[0]) || null;
}

async function findUserById(userId, client = null) {
  const normalizedId = normalizeId(userId);
  if (!normalizedId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${USER_SELECT}
    FROM users u
    WHERE u.id = $1
    LIMIT 1
    `,
    [normalizedId]
  );

  return mapSqlUser(result.rows[0]) || null;
}

async function createUser({ email, password, role = 'user' }, client = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required');
  }

  try {
    const result = await clientQuery(
      client,
      `
      INSERT INTO users (email, password, role)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [normalizedEmail, password, role]
    );

    return mapSqlUser(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      const duplicateErr = new Error('Email is already in use');
      duplicateErr.code = 'EMAIL_IN_USE';
      throw duplicateErr;
    }
    throw err;
  }
}

async function listUsers(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT ${USER_SELECT}
    FROM users u
    ORDER BY u.email ASC
    `
  );

  return result.rows.map(mapSqlUser);
}

module.exports = {
  mapSqlUser,
  findUserByEmail,
  findUserById,
  createUser,
  listUsers,
};
