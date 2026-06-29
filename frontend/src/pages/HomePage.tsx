import { Link } from 'react-router-dom';
import { Presentation, Users, MessageSquare, BarChart3, Zap, Clock, ArrowRight, CheckCircle } from 'lucide-react';

export function HomePage() {
  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <div className="nav-logo-icon">
              <Presentation size={18} color="#fff" />
            </div>
            AsyncMeet
          </Link>
          <div className="nav-actions">
            <Link to="/join" className="btn btn-secondary btn-sm">Войти в сессию</Link>
            <Link to="/create" className="btn btn-primary btn-sm">
              <Zap size={14} />
              Создать сессию
            </Link>
          </div>
        </div>
      </nav>

      <div className="hero">
        <div className="hero-tag">
          <Zap size={11} />
          Асинхронные встречи нового уровня
        </div>
        <h1>
          Встречи без<br />
          <span>потери времени</span>
        </h1>
        <p>
          Загружайте презентации, собирайте мнения команды и обсуждайте идеи — без синхронных созвонов. Каждый участник просматривает материалы в удобное время.
        </p>
        <div className="hero-actions">
          <Link to="/create" className="btn btn-primary btn-lg">
            <Presentation size={18} />
            Создать сессию
          </Link>
          <Link to="/join" className="btn btn-secondary btn-lg">
            <ArrowRight size={18} />
            Войти по ключу
          </Link>
        </div>

        <div className="hero-cards">
          <div className="hero-card">
            <div className="hero-card-icon" style={{ background: 'rgba(124,58,237,0.15)' }}>
              <Presentation size={22} color="#7C3AED" />
            </div>
            <h3>Презентация по расписанию</h3>
            <p>Загрузите PDF-презентацию и дайте команде ключ доступа. Каждый просматривает в своём темпе.</p>
          </div>
          <div className="hero-card">
            <div className="hero-card-icon" style={{ background: 'rgba(37,99,235,0.15)' }}>
              <BarChart3 size={22} color="#2563EB" />
            </div>
            <h3>Опрос и аналитика</h3>
            <p>Добавьте ключевые вопросы к сессии. Собирайте ответы и сразу видите статистику.</p>
          </div>
          <div className="hero-card">
            <div className="hero-card-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <MessageSquare size={22} color="#10B981" />
            </div>
            <h3>Живое обсуждение</h3>
            <p>Чат для каждой сессии в реальном времени. Комментарии прямо к слайдам.</p>
          </div>
        </div>

        <div style={{ marginTop: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p className="text-muted text-sm font-bold" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Дополнительные возможности</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { icon: Clock, text: 'Дедлайн для просмотра' },
              { icon: CheckCircle, text: 'Трекинг прогресса' },
              { icon: Users, text: 'Реакции на слайды' },
              { icon: Zap, text: 'Закладки и заметки' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="row" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', gap: 8 }}>
                <Icon size={15} color="var(--primary)" />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
