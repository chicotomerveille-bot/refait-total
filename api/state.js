import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM app_state WHERE id = ${1}`;
      return res.json(rows.length > 0 ? rows[0].data : {});
    }

    if (req.method === 'POST') {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const existing = await sql`SELECT id FROM app_state WHERE id = ${1}`;
      if (existing.length > 0) {
        await sql`UPDATE app_state SET data = ${data}, updated_at = NOW() WHERE id = ${1}`;
      } else {
        await sql`INSERT INTO app_state (id, data, updated_at) VALUES (${1}, ${data}, NOW())`;
      }
      return res.json({ ok: true });
    }
  } catch (e) {
    console.error('Neon error:', e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
