const { clientQuery } = require('../../db/transaction');

async function insertProcessedEvent({ eventId, stripeSessionId }, client = null) {
  if (!eventId) {
    throw new Error('Stripe event id is required');
  }

  const result = await clientQuery(
    client,
    `
    INSERT INTO processed_stripe_events (
      event_id,
      stripe_session_id,
      processed_at
    )
    VALUES ($1, $2, NOW())
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id
    `,
    [eventId, stripeSessionId || null]
  );

  return result.rowCount > 0;
}

async function findProcessedEventByEventId(eventId, client = null) {
  if (!eventId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT id, event_id, stripe_session_id, processed_at, created_at, updated_at
    FROM processed_stripe_events
    WHERE event_id = $1
    LIMIT 1
    `,
    [eventId]
  );

  return result.rows[0] || null;
}

module.exports = {
  insertProcessedEvent,
  findProcessedEventByEventId,
};
