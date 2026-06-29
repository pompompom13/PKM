const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH || './sessions.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    creator_name TEXT,
    access_key TEXT UNIQUE NOT NULL,
    pdf_path TEXT,
    created_at TEXT,
    deadline TEXT,
    expected_participants INTEGER DEFAULT 0,
    closed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS question_options (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    text TEXT NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    joined_at TEXT,
    current_slide INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answer_text TEXT,
    FOREIGN KEY (participant_id) REFERENCES participants(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS slide_reactions (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    slide_number INTEGER NOT NULL,
    reaction TEXT NOT NULL,
    UNIQUE(participant_id, slide_number)
  );

  CREATE TABLE IF NOT EXISTS slide_comments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    participant_name TEXT NOT NULL,
    slide_number INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    participant_name TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    slide_number INTEGER NOT NULL,
    note TEXT,
    UNIQUE(participant_id, slide_number)
  );

  CREATE TABLE IF NOT EXISTS slide_time (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    slide_number INTEGER NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    UNIQUE(participant_id, slide_number)
  );
`);

module.exports = db;
