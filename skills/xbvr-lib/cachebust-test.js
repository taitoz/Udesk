const Database = require('better-sqlite3');

const DB_PATH = 'G:\\$XBVR\\xbvr\\main.db';
const db = new Database(DB_PATH);

// Test: append a cache-bust query to ONE scene's cover_url.
const id = db.prepare('SELECT id, cover_url FROM scenes WHERE cover_url LIKE ?').get('%badoinkvr-327587.jpg%');
console.log('Before:', id);

if (id) {
  // Revert: strip any query string to restore clean cover_url
  const base = id.cover_url.split('?')[0];
  db.prepare('UPDATE scenes SET cover_url = ? WHERE id = ?').run(base, id.id);
  console.log('After: ', db.prepare('SELECT cover_url FROM scenes WHERE id = ?').get(id.id));
}

db.close();
console.log('Done. Reverted cache-bust query.');
