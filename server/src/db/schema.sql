CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- etat persiste des joueurs connectes (une ligne par compte)
CREATE TABLE IF NOT EXISTS players (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 5,
  z REAL NOT NULL DEFAULT 0,
  color INTEGER,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- un bureau par emplacement de la map, occupe par au plus un compte
-- slot_index correspond a l'index dans SALON_LAYOUT.deskSlots cote client
CREATE TABLE IF NOT EXISTS desks (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL,
  occupant_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  UNIQUE (room_id, slot_index)
);

-- un compte ne tient qu'un bureau a la fois dans une salle
CREATE UNIQUE INDEX IF NOT EXISTS idx_desks_occupant
  ON desks (room_id, occupant_user_id)
  WHERE occupant_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

INSERT INTO rooms (slug, name) VALUES ('lobby', 'Lobby')
ON CONFLICT (slug) DO NOTHING;
