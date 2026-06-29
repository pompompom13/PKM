import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Presentation, Key, User, ArrowLeft, LogIn } from 'lucide-react';
import { getSessionByKey, joinSession } from '../api';

export function JoinSessionPage() {
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'key' | 'name'>('key');
  const [session, setSession] = useState<{ id: string; title: string; description: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeySubmit = async () => {
    if (!key.trim()) return;
    setLoading(true); setError('');
    try {
      const s = await getSessionByKey(key.trim().toUpperCase());
      setSession(s);
      setStep('name');
    } catch {
      setError('Сессия с таким ключом не найдена. Проверьте ключ и попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !session) return;
    setLoading(true);
    try {
      const { participantId } = await joinSession(session.id, name.trim());
      localStorage.setItem(`participant_${session.id}`, participantId);
      localStorage.setItem(`participant_name_${session.id}`, name.trim());
      navigate(`/session/${session.id}`);
    } catch {
      setError('Ошибка при входе. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <div className="nav-logo-icon"><Presentation size={18} color="#fff" /></div>
            AsyncMeet
          </Link>
          <Link to="/" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> На главную</Link>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div className="container-sm">
          <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 56, height: 56, background: 'var(--primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <LogIn size={24} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                {step === 'key' ? 'Войти в сессию' : 'Как вас называть?'}
              </h2>
              <p className="text-muted text-sm">
                {step === 'key'
                  ? 'Введите ключ доступа, который предоставил организатор'
                  : `Вы подключаетесь к "${session?.title}"`}
              </p>
            </div>

            {step === 'key' ? (
              <div className="gap-16">
                <div className="form-group">
                  <label className="form-label">Ключ доступа</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      className="form-input"
                      style={{ paddingLeft: 38, textTransform: 'uppercase', fontSize: 18, fontWeight: 700, letterSpacing: '0.15em', textAlign: 'center' }}
                      placeholder="XXXXXX"
                      value={key}
                      onChange={e => setKey(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleKeySubmit()}
                      maxLength={8}
                      autoFocus
                    />
                  </div>
                </div>
                {error && <div style={{ color: 'var(--danger)', fontSize: 13, background: 'var(--danger-light)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
                <button className="btn btn-primary w-full" onClick={handleKeySubmit} disabled={loading || !key.trim()}>
                  {loading ? 'Поиск...' : 'Найти сессию'}
                </button>
              </div>
            ) : (
              <div className="gap-16">
                {session && (
                  <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{session.title}</p>
                    {session.description && <p className="text-muted text-sm" style={{ marginTop: 4 }}>{session.description}</p>}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Ваше имя</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      className="form-input"
                      style={{ paddingLeft: 38 }}
                      placeholder="Иван Иванов"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleJoin()}
                      autoFocus
                    />
                  </div>
                </div>
                {error && <div style={{ color: 'var(--danger)', fontSize: 13, background: 'var(--danger-light)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
                <div className="row">
                  <button className="btn btn-secondary" onClick={() => { setStep('key'); setError(''); }}>
                    <ArrowLeft size={14} /> Назад
                  </button>
                  <button className="btn btn-primary w-full" onClick={handleJoin} disabled={loading || !name.trim()}>
                    {loading ? 'Вход...' : 'Войти в сессию'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
