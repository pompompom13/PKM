const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
// Support persistent disk on Render (/data) or local fallback
process.env.DB_PATH = process.env.DB_PATH || (process.env.RENDER ? '/data/sessions.db' : './sessions.db');
const db = require('./db');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  process.env.FRONTEND_URL,  // set on Render: https://your-app.vercel.app
].filter(Boolean);

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// === SESSIONS ===

app.post('/api/sessions', (req, res) => {
  const { title, description, creator_name, deadline, expected_participants } = req.body;
  const key = Math.random().toString(36).substring(2, 8).toUpperCase();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO sessions (id, title, description, creator_name, access_key, deadline, expected_participants, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, title, description, creator_name, key, deadline || null, expected_participants || 0);
  res.json({ id, key });
});

app.post('/api/sessions/:id/upload', upload.single('presentation'), (req, res) => {
  const filePath = req.file.filename;
  db.prepare('UPDATE sessions SET pdf_path = ? WHERE id = ?').run(filePath, req.params.id);
  res.json({ success: true, path: filePath });
});

app.post('/api/sessions/:id/questions', (req, res) => {
  const { questions } = req.body;
  db.prepare('DELETE FROM questions WHERE session_id = ?').run(req.params.id);
  questions.forEach((q, i) => {
    const qId = uuidv4();
    db.prepare(`INSERT INTO questions (id, session_id, text, type, order_index) VALUES (?, ?, ?, ?, ?)`)
      .run(qId, req.params.id, q.text, q.type, i);
    if (q.options) {
      q.options.forEach(opt => {
        db.prepare('INSERT INTO question_options (id, question_id, text) VALUES (?, ?, ?)')
          .run(uuidv4(), qId, opt);
      });
    }
  });
  res.json({ success: true });
});

app.get('/api/sessions/key/:key', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE access_key = ? AND closed = 0').get(req.params.key);
  if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
  res.json(session);
});

app.get('/api/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  const questions = db.prepare('SELECT * FROM questions WHERE session_id = ? ORDER BY order_index').all(req.params.id);
  const questionsWithOptions = questions.map(q => ({
    ...q,
    options: db.prepare('SELECT * FROM question_options WHERE question_id = ?').all(q.id)
  }));
  res.json({ ...session, questions: questionsWithOptions });
});

// Close session — mark as closed and delete all user data
app.delete('/api/sessions/:id', (req, res) => {
  const { id } = req.params;

  // Get pdf path to delete file
  const session = db.prepare('SELECT pdf_path FROM sessions WHERE id = ?').get(id);
  if (session?.pdf_path) {
    const filePath = path.join(__dirname, 'uploads', session.pdf_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  // Delete all related data
  const participants = db.prepare('SELECT id FROM participants WHERE session_id = ?').all(id);
  participants.forEach(p => {
    db.prepare('DELETE FROM responses WHERE participant_id = ?').run(p.id);
    db.prepare('DELETE FROM slide_reactions WHERE participant_id = ?').run(p.id);
    db.prepare('DELETE FROM slide_comments WHERE participant_id = ?').run(p.id);
    db.prepare('DELETE FROM bookmarks WHERE participant_id = ?').run(p.id);
    db.prepare('DELETE FROM slide_time WHERE participant_id = ?').run(p.id);
  });
  db.prepare('DELETE FROM participants WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(id);

  const questions = db.prepare('SELECT id FROM questions WHERE session_id = ?').all(id);
  questions.forEach(q => db.prepare('DELETE FROM question_options WHERE question_id = ?').run(q.id));
  db.prepare('DELETE FROM questions WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);

  res.json({ success: true });
});

// === PARTICIPANTS ===

app.post('/api/sessions/:id/join', (req, res) => {
  const { name } = req.body;
  const participantId = uuidv4();
  db.prepare(`
    INSERT INTO participants (id, session_id, name, joined_at, current_slide, completed)
    VALUES (?, ?, ?, datetime('now'), 1, 0)
  `).run(participantId, req.params.id, name);
  res.json({ participantId });
});

app.put('/api/participants/:id/progress', (req, res) => {
  const { current_slide } = req.body;
  db.prepare('UPDATE participants SET current_slide = ? WHERE id = ?').run(current_slide, req.params.id);
  res.json({ success: true });
});

// === SLIDE TIME TRACKING ===

app.post('/api/participants/:pid/slide-time', (req, res) => {
  const { session_id, slide_number, seconds } = req.body;
  db.prepare(`
    INSERT INTO slide_time (id, participant_id, session_id, slide_number, seconds)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(participant_id, slide_number) DO UPDATE SET seconds = seconds + excluded.seconds
  `).run(uuidv4(), req.params.pid, session_id, slide_number, seconds);
  res.json({ success: true });
});

// === RESPONSES ===

app.post('/api/participants/:id/responses', (req, res) => {
  const { responses } = req.body;
  responses.forEach(r => {
    db.prepare(`INSERT OR REPLACE INTO responses (id, participant_id, question_id, answer_text) VALUES (?, ?, ?, ?)`)
      .run(uuidv4(), req.params.id, r.question_id, r.answer);
  });
  db.prepare("UPDATE participants SET completed = 1, completed_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  res.json({ success: true });
});

app.get('/api/participants/:id/responses', (req, res) => {
  const responses = db.prepare('SELECT * FROM responses WHERE participant_id = ?').all(req.params.id);
  res.json(responses);
});

// === REACTIONS ===

app.post('/api/participants/:pid/reactions', (req, res) => {
  const { session_id, slide_number, reaction } = req.body;
  db.prepare(`
    INSERT INTO slide_reactions (id, participant_id, session_id, slide_number, reaction)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(participant_id, slide_number) DO UPDATE SET reaction = excluded.reaction
  `).run(uuidv4(), req.params.pid, session_id, slide_number, reaction);
  res.json({ success: true });
});

app.get('/api/participants/:pid/reactions/:sid', (req, res) => {
  const reactions = db.prepare('SELECT * FROM slide_reactions WHERE participant_id = ? AND session_id = ?')
    .all(req.params.pid, req.params.sid);
  res.json(reactions);
});

// === SLIDE COMMENTS ===

app.post('/api/sessions/:id/slide-comments', (req, res) => {
  const { participant_id, participant_name, slide_number, text } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO slide_comments (id, session_id, participant_id, participant_name, slide_number, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, req.params.id, participant_id, participant_name, slide_number, text);
  const comment = db.prepare('SELECT * FROM slide_comments WHERE id = ?').get(id);
  io.to(req.params.id).emit('slide_comment', comment);
  res.json(comment);
});

app.get('/api/sessions/:id/slide-comments/:slide', (req, res) => {
  const comments = db.prepare(
    'SELECT * FROM slide_comments WHERE session_id = ? AND slide_number = ? ORDER BY created_at'
  ).all(req.params.id, parseInt(req.params.slide));
  res.json(comments);
});

// === BOOKMARKS ===

app.post('/api/participants/:pid/bookmarks', (req, res) => {
  const { session_id, slide_number, note } = req.body;
  db.prepare(`
    INSERT INTO bookmarks (id, participant_id, session_id, slide_number, note)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(participant_id, slide_number) DO UPDATE SET note = excluded.note
  `).run(uuidv4(), req.params.pid, session_id, slide_number, note || '');
  res.json({ success: true });
});

app.delete('/api/participants/:pid/bookmarks/:slide', (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE participant_id = ? AND slide_number = ?')
    .run(req.params.pid, parseInt(req.params.slide));
  res.json({ success: true });
});

app.get('/api/participants/:pid/bookmarks/:sid', (req, res) => {
  const bookmarks = db.prepare('SELECT * FROM bookmarks WHERE participant_id = ? AND session_id = ?')
    .all(req.params.pid, req.params.sid);
  res.json(bookmarks);
});

// === CHAT ===

app.get('/api/sessions/:id/chat', (req, res) => {
  const messages = db.prepare(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at LIMIT 200'
  ).all(req.params.id);
  res.json(messages);
});

// === ANALYTICS ===

app.get('/api/sessions/:id/analytics', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });

  const participants = db.prepare('SELECT * FROM participants WHERE session_id = ?').all(req.params.id);
  const questions = db.prepare('SELECT * FROM questions WHERE session_id = ? ORDER BY order_index').all(req.params.id);

  const questionStats = questions.map(q => {
    const options = db.prepare('SELECT * FROM question_options WHERE question_id = ?').all(q.id);
    const responses = db.prepare(
      'SELECT answer_text, COUNT(*) as count FROM responses WHERE question_id = ? GROUP BY answer_text'
    ).all(q.id);
    return { ...q, options, responses };
  });

  // Slide time stats: average seconds per slide across all participants
  const slideTimeRaw = db.prepare(
    'SELECT slide_number, AVG(seconds) as avg_seconds, SUM(seconds) as total_seconds, COUNT(*) as viewer_count FROM slide_time WHERE session_id = ? GROUP BY slide_number ORDER BY slide_number'
  ).all(req.params.id);

  // Reaction stats per slide
  const reactionStats = db.prepare(
    'SELECT slide_number, reaction, COUNT(*) as count FROM slide_reactions WHERE session_id = ? GROUP BY slide_number, reaction'
  ).all(req.params.id);

  // Total time spent across all participants (seconds)
  const totalTimeRow = db.prepare(
    'SELECT SUM(seconds) as total FROM slide_time WHERE session_id = ?'
  ).get(req.params.id);

  res.json({
    session,
    participants,
    totalParticipants: participants.length,
    completed: participants.filter(p => p.completed).length,
    questions: questionStats,
    slideTime: slideTimeRaw,
    reactionStats,
    totalSeconds: totalTimeRow?.total || 0,
  });
});

// === SOCKET.IO ===

io.on('connection', (socket) => {
  socket.on('join_session', (sessionId) => socket.join(sessionId));

  socket.on('chat_message', ({ sessionId, participantName, text }) => {
    const id = uuidv4();
    db.prepare(`INSERT INTO chat_messages (id, session_id, participant_name, text, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      .run(id, sessionId, participantName, text);
    const msg = { id, session_id: sessionId, participant_name: participantName, text, created_at: new Date().toISOString() };
    io.to(sessionId).emit('chat_message', msg);
  });
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
