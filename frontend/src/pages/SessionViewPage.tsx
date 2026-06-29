import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Presentation, ChevronLeft, ChevronRight, ThumbsUp, HelpCircle,
  Frown, Bookmark, MessageSquare, MessageCircle, ClipboardList,
  CheckCircle, Send, ArrowLeft, SkipForward
} from 'lucide-react';
import { PresentationViewer } from '../components/PresentationViewer';
import { Chat } from '../components/Chat';
import { Poll } from '../components/Poll';
import {
  getSession, updateProgress, setReaction, getReactions,
  getSlideComments, addSlideComment, addBookmark, removeBookmark,
  getBookmarks, recordSlideTime, Session
} from '../api';

const REACTIONS = [
  { key: 'like', icon: ThumbsUp, label: 'Понятно' },
  { key: 'question', icon: HelpCircle, label: 'Вопрос' },
  { key: 'confused', icon: Frown, label: 'Непонятно' },
];

type SidebarTab = 'chat' | 'comments' | 'poll';

interface SlideComment {
  id: string; participant_name: string; text: string; created_at: string; slide_number: number;
}

export function SessionViewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [activeTab, setActiveTab] = useState<SidebarTab>('chat');
  const [reactions, setReactions] = useState<Record<number, string>>({});
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [slideComments, setSlideComments] = useState<SlideComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [pollDone, setPollDone] = useState(false);
  const slideStartRef = useRef<number>(Date.now());

  const participantId = localStorage.getItem(`participant_${sessionId}`) || '';
  const participantName = localStorage.getItem(`participant_name_${sessionId}`) || 'Участник';

  useEffect(() => {
    if (!sessionId) return;
    if (!participantId) { navigate('/join'); return; }
    getSession(sessionId).then(s => { setSession(s); setLoading(false); }).catch(() => setLoading(false));
    getReactions(participantId, sessionId).then(rs => {
      const map: Record<number, string> = {};
      rs.forEach(r => { map[r.slide_number] = r.reaction; });
      setReactions(map);
    });
    getBookmarks(participantId, sessionId).then(bs => {
      setBookmarks(new Set(bs.map(b => b.slide_number)));
    });
  }, [sessionId, participantId]);

  useEffect(() => {
    if (!sessionId || currentPage === 0) return;
    updateProgress(participantId, currentPage);
    if (sessionId) {
      getSlideComments(sessionId, currentPage).then(cs => setSlideComments(cs as SlideComment[]));
    }
  }, [currentPage, sessionId, participantId]);

  const goTo = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    // Record time spent on current slide before navigating
    const elapsed = Math.round((Date.now() - slideStartRef.current) / 1000);
    if (elapsed > 0 && sessionId && participantId) {
      recordSlideTime(participantId, sessionId, currentPage, elapsed);
    }
    slideStartRef.current = Date.now();
    setCurrentPage(page);
  }, [totalPages, currentPage, sessionId, participantId]);

  const handleReaction = async (reaction: string) => {
    if (!sessionId) return;
    const current = reactions[currentPage];
    const newReaction = current === reaction ? '' : reaction;
    setReactions(r => ({ ...r, [currentPage]: newReaction }));
    await setReaction(participantId, sessionId, currentPage, newReaction);
  };

  const handleBookmark = async () => {
    if (!sessionId) return;
    if (bookmarks.has(currentPage)) {
      setBookmarks(b => { const n = new Set(b); n.delete(currentPage); return n; });
      await removeBookmark(participantId, currentPage);
    } else {
      setBookmarks(b => new Set([...b, currentPage]));
      await addBookmark(participantId, sessionId, currentPage);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !sessionId) return;
    const comment = await addSlideComment(sessionId, {
      participant_id: participantId,
      participant_name: participantName,
      slide_number: currentPage,
      text: newComment.trim()
    });
    setSlideComments(c => [...c, comment as SlideComment]);
    setNewComment('');
  };

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="page"><div className="loading-screen"><div className="spinner" /><p className="text-muted">Загрузка сессии...</p></div></div>;
  if (!session) return <div className="page"><div className="loading-screen"><p>Сессия не найдена</p><Link to="/" className="btn btn-primary">На главную</Link></div></div>;

  const pdfUrl = session.pdf_path ? `http://localhost:3001/uploads/${session.pdf_path}` : '';

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <div className="row" style={{ gap: 12 }}>
            <Link to="/" className="btn btn-ghost btn-icon btn-sm"><ArrowLeft size={16} /></Link>
            <div className="nav-logo-icon" style={{ width: 28, height: 28 }}><Presentation size={15} color="#fff" /></div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{session.title}</p>
              <p className="text-muted text-xs">Участник: {participantName}</p>
            </div>
          </div>
          <div className="row">
            {totalPages > 0 && (
              <span className="badge badge-primary">
                {currentPage} / {totalPages}
              </span>
            )}
            {session.deadline && (
              <span className="badge badge-accent">до {new Date(session.deadline).toLocaleDateString('ru')}</span>
            )}
            {pollDone && <span className="badge badge-success"><CheckCircle size={11} /> Завершено</span>}
          </div>
        </div>
      </nav>

      <div className="session-layout">
        {/* Main area */}
        <div className="session-main">
          <div className="slide-area">
            {/* Progress */}
            {totalPages > 0 && (
              <div className="slide-progress" style={{ width: '100%', maxWidth: 900 }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(currentPage / totalPages) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Slide viewer */}
            {pdfUrl ? (
              <PresentationViewer
                pdfUrl={pdfUrl}
                currentPage={currentPage}
                onTotalPages={setTotalPages}
              />
            ) : (
              <div className="slide-canvas-wrap" style={{ minHeight: 480, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                <Presentation size={48} color="var(--text-dim)" />
                <p className="text-muted">Презентация не загружена</p>
              </div>
            )}

            {/* Bookmarks strip */}
            {bookmarks.size > 0 && (
              <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-start', maxWidth: 900, width: '100%', flexWrap: 'wrap' }}>
                <span className="text-muted text-xs" style={{ paddingTop: 4 }}>Закладки:</span>
                {Array.from(bookmarks).sort((a,b)=>a-b).map(n => (
                  <button key={n} onClick={() => goTo(n)} className={`badge ${n === currentPage ? 'badge-accent' : 'badge-muted'}`} style={{ cursor: 'pointer', border: 'none' }}>
                    Слайд {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Slide navigation */}
          <div className="slide-nav">
            <button className="btn btn-secondary btn-icon" onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1}>
              <ChevronLeft size={18} />
            </button>
            <button className="btn btn-secondary btn-icon" onClick={() => goTo(currentPage + 1)} disabled={currentPage >= totalPages}>
              <ChevronRight size={18} />
            </button>
            <div className="slide-progress" style={{ flex: 1 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: totalPages ? `${(currentPage / totalPages) * 100}%` : '0%' }} />
              </div>
            </div>
            <span className="slide-counter">{currentPage}{totalPages > 0 ? ` / ${totalPages}` : ''}</span>

            {/* Reactions */}
            <div className="slide-reactions">
              {REACTIONS.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  className={`reaction-btn ${reactions[currentPage] === key ? 'active' : ''}`}
                  onClick={() => handleReaction(key)}
                  title={label}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
              <button
                className={`reaction-btn bookmark-btn ${bookmarks.has(currentPage) ? 'bookmarked' : ''}`}
                onClick={handleBookmark}
                title="Закладка"
              >
                <Bookmark size={14} fill={bookmarks.has(currentPage) ? 'var(--accent)' : 'none'} />
              </button>
            </div>

            {totalPages > 0 && currentPage === totalPages && (session.questions?.length ?? 0) > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => { setActiveTab('poll'); }}>
                <SkipForward size={14} /> К опросу
              </button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="session-sidebar">
          <div className="sidebar-tabs">
            <button className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
              <MessageSquare size={14} /> Чат
            </button>
            <button className={`sidebar-tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
              <MessageCircle size={14} /> Слайд
            </button>
            <button className={`sidebar-tab ${activeTab === 'poll' ? 'active' : ''}`} onClick={() => setActiveTab('poll')}>
              <ClipboardList size={14} /> Опрос
            </button>
          </div>

          {activeTab === 'chat' && (
            <Chat sessionId={session.id} participantName={participantName} />
          )}

          {activeTab === 'comments' && (
            <>
              <div className="sidebar-content" style={{ flex: 1, overflowY: 'auto' }}>
                <p className="text-muted text-xs" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Комментарии к слайду {currentPage}
                </p>
                {slideComments.length === 0 ? (
                  <div className="empty-state"><p>Нет комментариев к этому слайду</p></div>
                ) : (
                  slideComments.map(c => (
                    <div key={c.id} className="comment-item">
                      <div className="comment-author">{c.participant_name}</div>
                      <div className="comment-text">{c.text}</div>
                      <div className="comment-time">{fmt(c.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="chat-input-row">
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="Комментарий к слайду..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                />
                <button className="btn btn-primary btn-icon" onClick={handleAddComment} disabled={!newComment.trim()}>
                  <Send size={15} />
                </button>
              </div>
            </>
          )}

          {activeTab === 'poll' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Poll
                sessionId={session.id}
                participantId={participantId}
                questions={session.questions || []}
                onComplete={() => setPollDone(true)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
