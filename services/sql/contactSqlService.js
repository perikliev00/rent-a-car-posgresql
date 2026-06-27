const { clientQuery } = require('../../db/transaction');

const CONTACT_SELECT = `
  c.id,
  c.name,
  c.email,
  c.phone,
  c.subject,
  c.message,
  c.status,
  c.created_at,
  c.updated_at
`;

const ALLOWED_STATUSES = ['new', 'ready', 'done'];

function normalizeId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function mapSqlContact(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createContact(
  { name, email, phone, subject, message, status = 'new' },
  client = null
) {
  const result = await clientQuery(
    client,
    `
    INSERT INTO contacts (name, email, phone, subject, message, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      name,
      email,
      phone || null,
      subject,
      message,
      ALLOWED_STATUSES.includes(status) ? status : 'new',
    ]
  );

  return mapSqlContact(result.rows[0]);
}

async function listContacts(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT ${CONTACT_SELECT}
    FROM contacts c
    ORDER BY c.created_at DESC
    `
  );

  return result.rows.map(mapSqlContact);
}

async function updateContactStatus(contactId, status, client = null) {
  const normalizedId = normalizeId(contactId);
  if (!normalizedId) {
    return null;
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error('Invalid contact status');
  }

  const result = await clientQuery(
    client,
    `
    UPDATE contacts
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [normalizedId, status]
  );

  return mapSqlContact(result.rows[0]) || null;
}

async function deleteContactById(contactId, client = null) {
  const normalizedId = normalizeId(contactId);
  if (!normalizedId) {
    return false;
  }

  const result = await clientQuery(
    client,
    `DELETE FROM contacts WHERE id = $1 RETURNING id`,
    [normalizedId]
  );

  return result.rowCount > 0;
}

module.exports = {
  ALLOWED_STATUSES,
  mapSqlContact,
  createContact,
  listContacts,
  updateContactStatus,
  deleteContactById,
};
