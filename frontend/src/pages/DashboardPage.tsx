import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Presentation, Users, CheckCircle, Clock, ArrowLeft, Copy, Check,
  BarChart3, Download, Trash2, AlertTriangle, Target, Timer
} from 'lucide-react';
import { getAnalytics, deleteSession } from '../api';

interface Participant {
  id: string; name: string; joined_at: string;
  current_slide: number; completed: number; completed_at: string | null;
}
interface QuestionStat {
  id: string; text: string; type: string;
  responses: { answer_text: string; count: number }[];
  options: { id: string; text: string }[];
}
interface SlideTimeStat {
  slide_number: number; avg_seconds: number; total_seconds: number; viewer_count: number;
}
interface ReactionStat {
  slide_number: number; reaction: string; count: number;
}
interface Analytics {
  session: {
    title: string; access_key: string; creator_name: string;
    created_at: string; deadline: string | null;
    expected_participants: number;
  };
  participants: Participant[];
  totalParticipants: number;
  completed: number;
  questions: QuestionStat[];
  slideTime: SlideTimeStat[];
  reactionStats: ReactionStat[];
  totalSeconds: number;
}

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}с`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}м ${s}с` : `${m}м`;
}

export function DashboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const load = () => getAnalytics(sessionId).then(setData).catch(() => {}).finally(() => setLoading(false));
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const copyKey = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.session.access_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = async () => {
    if (!sessionId) return;
    setClosing(true);
    try {
      await deleteSession(sessionId);
      navigate('/');
    } catch {
      alert('Ошибка при закрытии сессии');
      setClosing(false);
    }
  };

  const exportPDF = () => {
    if (!data) return;
    const completionRate = data.totalParticipants > 0 ? Math.round((data.completed / data.totalParticipants) * 100) : 0;
    const coverageRate = data.session.expected_participants > 0
      ? Math.round((data.totalParticipants / data.session.expected_participants) * 100) : null;
    const reactionLabels: Record<string, string> = { like: 'Понятно', question: 'Вопрос', confused: 'Непонятно' };

    const groupedReactions: Record<string, Record<string, number>> = {};
    data.reactionStats.forEach(r => {
      if (!groupedReactions[r.slide_number]) groupedReactions[r.slide_number] = {};
      groupedReactions[r.slide_number][r.reaction] = r.count;
    });

    const maxAvg = data.slideTime.length > 0 ? Math.max(...data.slideTime.map(s => s.avg_seconds)) : 1;

    const slideTimeBars = data.slideTime.map(st => {
      const pct = maxAvg > 0 ? (st.avg_seconds / maxAvg) * 100 : 0;
      return `<tr>
        <td style="padding:4px 8px;color:#6b7280;width:70px">Слайд ${st.slide_number}</td>
        <td style="padding:4px 8px">
          <div style="background:#e5e7eb;border-radius:4px;height:10px;overflow:hidden">
            <div style="background:#7C3AED;width:${pct}%;height:100%"></div>
          </div>
        </td>
        <td style="padding:4px 8px;color:#374151;white-space:nowrap;width:60px">${fmtTime(st.avg_seconds)}</td>
      </tr>`;
    }).join('');

    const participantRows = data.participants.map(p => {
      const status = p.completed ? '<span style="color:#059669;font-weight:700">Завершил(а)</span>' : `Слайд ${p.current_slide}`;
      return `<tr>
        <td style="padding:5px 8px;font-weight:600">${p.name}</td>
        <td style="padding:5px 8px;color:#6b7280">${new Date(p.joined_at).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'})}</td>
        <td style="padding:5px 8px">${status}</td>
      </tr>`;
    }).join('');

    const questionBlocks = data.questions.map((q, qi) => {
      const total = q.responses.reduce((s, r) => s + r.count, 0);
      let answersHtml = '';
      if (q.type === 'text') {
        answersHtml = q.responses.length === 0 ? '<p style="color:#9ca3af;font-size:13px">Нет ответов</p>' :
          q.responses.map(r => `<div style="background:#f9fafb;padding:6px 10px;border-radius:6px;margin:4px 0;font-size:13px">${r.answer_text}</div>`).join('');
      } else {
        const items = (q.options.length > 0
          ? q.options.map(o => ({ label: o.text, count: q.responses.find(r => r.answer_text === o.text)?.count || 0 }))
          : q.responses.map(r => ({ label: r.answer_text, count: r.count })));
        answersHtml = items.map(item => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return `<div style="margin:5px 0">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
              <span>${item.label}</span><span style="color:#6b7280">${item.count} (${pct}%)</span>
            </div>
            <div style="background:#e5e7eb;border-radius:4px;height:8px">
              <div style="background:#7C3AED;width:${pct}%;height:100%;border-radius:4px"></div>
            </div>
          </div>`;
        }).join('');
        if (total === 0) answersHtml = '<p style="color:#9ca3af;font-size:13px">Нет ответов</p>';
      }
      return `<div style="margin-bottom:16px;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
        <p style="font-weight:700;margin-bottom:8px">${qi + 1}. ${q.text}</p>
        ${answersHtml}
      </div>`;
    }).join('');

    const reactionBlock = Object.entries(groupedReactions).map(([slide, reactions]) => {
      const parts = Object.entries(reactions).map(([k, v]) => `${reactionLabels[k] || k}: <b>${v}</b>`).join(' &nbsp;|&nbsp; ');
      return `<div style="padding:4px 0;font-size:13px"><b>Слайд ${slide}:</b> ${parts}</div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Отчёт — ${data.session.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; font-size: 14px; }
    .header { background: #7C3AED; color: white; padding: 20px 32px; }
    .header h1 { font-size: 20px; margin-bottom: 4px; }
    .header p { font-size: 12px; opacity: 0.8; }
    .content { padding: 24px 32px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 15px; font-weight: 700; border-bottom: 2px solid #7C3AED; padding-bottom: 6px; margin-bottom: 12px; color: #374151; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .stat-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
    .stat-value { font-size: 24px; font-weight: 800; color: #7C3AED; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 6px 8px; background: #f3f4f6; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; }
    tr:nth-child(even) { background: #f9fafb; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>AsyncMeet — Отчёт по сессии</h1>
    <p>Сгенерировано: ${new Date().toLocaleString('ru')}</p>
  </div>
  <div class="content">
    <div class="section">
      <div style="margin-bottom:8px">
        <h2 style="font-size:18px;font-weight:800">${data.session.title}</h2>
        <p style="color:#6b7280;font-size:13px;margin-top:4px">
          Организатор: ${data.session.creator_name} &nbsp;·&nbsp;
          Создана: ${new Date(data.session.created_at).toLocaleString('ru')}
          ${data.session.deadline ? ` &nbsp;·&nbsp; Дедлайн: ${new Date(data.session.deadline).toLocaleString('ru')}` : ''}
        </p>
      </div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value" style="color:#9ca3af">${data.session.expected_participants || '—'}</div>
          <div class="stat-label">Ожидалось участников</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${data.totalParticipants}</div>
          <div class="stat-label">Присоединились</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#059669">${data.completed} (${completionRate}%)</div>
          <div class="stat-label">Завершили опрос</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#f59e0b">${coverageRate !== null ? coverageRate + '%' : completionRate + '%'}</div>
          <div class="stat-label">${coverageRate !== null ? 'Охват аудитории' : 'Процент завершения'}</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#2563eb;font-size:18px">${fmtTime(data.totalSeconds)}</div>
          <div class="stat-label">Суммарно потрачено</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#2563eb;font-size:18px">${data.totalParticipants > 0 ? fmtTime(data.totalSeconds / data.totalParticipants) : '—'}</div>
          <div class="stat-label">Среднее на участника</div>
        </div>
      </div>
    </div>

    ${data.slideTime.length > 0 ? `
    <div class="section">
      <div class="section-title">Время на слайдах (среднее)</div>
      <table>${slideTimeBars}</table>
    </div>` : ''}

    ${reactionBlock ? `
    <div class="section">
      <div class="section-title">Реакции на слайды</div>
      ${reactionBlock}
    </div>` : ''}

    <div class="section">
      <div class="section-title">Участники (${data.participants.length})</div>
      ${data.participants.length === 0 ? '<p style="color:#9ca3af">Нет участников</p>' : `
      <table>
        <thead><tr><th>Имя</th><th>Вошёл</th><th>Статус</th></tr></thead>
        <tbody>${participantRows}</tbody>
      </table>`}
    </div>

    ${data.questions.length > 0 ? `
    <div class="section">
      <div class="section-title">Результаты опроса</div>
      ${questionBlocks}
    </div>` : ''}
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Разрешите всплывающие окна для этого сайта'); return; }
    win.document.write(html);
    win.document.close();
  };

  const completionRate = data ? Math.round((data.completed / Math.max(data.totalParticipants, 1)) * 100) : 0;
  const coverageRate = data?.session.expected_participants
    ? Math.round((data.totalParticipants / data.session.expected_participants) * 100)
    : null;

  if (loading) return <div className="page"><div className="loading-screen"><div className="spinner" /></div></div>;
  if (!data) return <div className="page"><div className="loading-screen"><p>Данные не найдены</p></div></div>;

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <div className="nav-logo-icon"><Presentation size={18} color="#fff" /></div>
            AsyncMeet
          </Link>
          <div className="nav-actions">
            <button className="btn btn-secondary btn-sm" onClick={exportPDF}>
              <Download size={14} /> Выгрузить статистику
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setShowCloseConfirm(true)}>
              <Trash2 size={14} /> Закрыть сессию
            </button>
            <Link to="/" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /></Link>
          </div>
        </div>
      </nav>

      {/* Close confirm modal */}
      {showCloseConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card" style={{ maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="row" style={{ gap: 12 }}>
              <div style={{ width: 44, height: 44, background: 'var(--danger-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} color="var(--danger)" />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16 }}>Закрыть сессию?</p>
                <p className="text-muted text-sm" style={{ marginTop: 4 }}>Все данные участников, ответы, чат и файл презентации будут удалены без возможности восстановления.</p>
              </div>
            </div>
            <p className="text-muted text-sm" style={{ background: 'var(--accent-light)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', color: 'var(--accent)' }}>
              Совет: сначала выгрузите статистику в PDF, чтобы сохранить результаты.
            </p>
            <div className="row">
              <button className="btn btn-secondary w-full" onClick={() => setShowCloseConfirm(false)}>Отмена</button>
              <button className="btn btn-danger w-full" onClick={handleClose} disabled={closing}>
                {closing ? 'Удаление...' : <><Trash2 size={14} /> Удалить всё</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '32px 24px', flex: 1 }}>
        <div className="container">
          {/* Header */}
          <div className="row-between" style={{ marginBottom: 28 }}>
            <div>
              <div className="row" style={{ marginBottom: 6, gap: 10 }}>
                <BarChart3 size={20} color="var(--primary)" />
                <h1 style={{ fontSize: 22, fontWeight: 800 }}>Дашборд сессии</h1>
                <span className="badge badge-primary" style={{ fontSize: 11 }}>обновляется каждые 15с</span>
              </div>
              <p style={{ fontSize: 17, fontWeight: 700 }}>{data.session.title}</p>
              <p className="text-muted text-sm">Организатор: {data.session.creator_name} · {new Date(data.session.created_at).toLocaleDateString('ru')}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <div className="key-box" style={{ padding: '8px 20px' }}>
                <div className="key-text" style={{ fontSize: 22 }}>{data.session.access_key}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={copyKey}>
                {copied ? <><Check size={12} /> Скопировано</> : <><Copy size={12} /> Копировать ключ</>}
              </button>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
            <div className="stat-card">
              <Target size={16} color="var(--text-muted)" style={{ marginBottom: 8 }} />
              <div className="stat-value" style={{ fontSize: 26, color: 'var(--text-muted)' }}>{data.session.expected_participants || '—'}</div>
              <div className="stat-label">Ожидалось</div>
            </div>
            <div className="stat-card">
              <Users size={16} color="var(--primary)" style={{ marginBottom: 8 }} />
              <div className="stat-value" style={{ fontSize: 26, color: 'var(--primary)' }}>{data.totalParticipants}</div>
              <div className="stat-label">Присоединились</div>
            </div>
            <div className="stat-card">
              <CheckCircle size={16} color="var(--success)" style={{ marginBottom: 8 }} />
              <div className="stat-value" style={{ fontSize: 26, color: 'var(--success)' }}>{data.completed}</div>
              <div className="stat-label">Завершили опрос</div>
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
            <div className="stat-card">
              <Clock size={16} color="var(--accent)" style={{ marginBottom: 8 }} />
              <div className="stat-value" style={{ fontSize: 26, color: 'var(--accent)' }}>
                {coverageRate !== null ? `${Math.min(coverageRate, 999)}%` : `${completionRate}%`}
              </div>
              <div className="stat-label">{coverageRate !== null ? 'Охват аудитории' : 'Завершили'}</div>
            </div>
            <div className="stat-card">
              <Timer size={16} color="var(--secondary)" style={{ marginBottom: 8 }} />
              <div className="stat-value" style={{ fontSize: 22, color: 'var(--secondary)' }}>{fmtTime(data.totalSeconds)}</div>
              <div className="stat-label">Суммарно потрачено</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Participants */}
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Участники</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.participants.length === 0 ? (
                    <p className="text-muted text-sm">Пока никто не присоединился</p>
                  ) : data.participants.map(p => (
                    <div key={p.id} className="participant-row">
                      <div className="participant-avatar">{p.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</p>
                        <p className="text-muted text-xs">
                          Слайд {p.current_slide} · {new Date(p.joined_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {p.completed
                        ? <span className="badge badge-success"><CheckCircle size={11} /> Готово</span>
                        : <span className="badge badge-muted">Просматривает</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Slide time */}
              {data.slideTime.length > 0 && (
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Время на слайдах (среднее)</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(() => {
                      const maxAvg = Math.max(...data.slideTime.map(s => s.avg_seconds));
                      return data.slideTime.map(st => (
                        <div key={st.slide_number} className="response-bar-row">
                          <span className="response-bar-label" style={{ width: 60 }}>Слайд {st.slide_number}</span>
                          <div className="response-bar-track">
                            <div className="response-bar-fill" style={{ width: maxAvg > 0 ? `${(st.avg_seconds / maxAvg) * 100}%` : '0%', background: 'var(--secondary)' }} />
                          </div>
                          <span className="response-bar-count" style={{ width: 50, textAlign: 'right' }}>{fmtTime(st.avg_seconds)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Right column — Poll results */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Результаты опроса</h2>
              {data.questions.length === 0 ? (
                <p className="text-muted text-sm">Вопросов не добавлено</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {data.questions.map((q, qi) => {
                    const total = q.responses.reduce((sum, r) => sum + r.count, 0);
                    return (
                      <div key={q.id} className="card card-sm">
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{qi + 1}. {q.text}</p>
                        {q.type === 'text' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {q.responses.length === 0 ? <p className="text-muted text-xs">Нет ответов</p> :
                              q.responses.map((r, i) => (
                                <div key={i} style={{ background: 'var(--surface2)', padding: '7px 10px', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                                  {r.answer_text}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="response-bar-wrap">
                            {(q.options.length > 0
                              ? q.options.map(o => ({ label: o.text, count: q.responses.find(r => r.answer_text === o.text)?.count || 0 }))
                              : q.responses.map(r => ({ label: r.answer_text, count: r.count }))
                            ).map((item, i) => (
                              <div key={i} className="response-bar-row">
                                <span className="response-bar-label" title={item.label}>{item.label}</span>
                                <div className="response-bar-track">
                                  <div className="response-bar-fill" style={{ width: total ? `${(item.count / total) * 100}%` : '0%' }} />
                                </div>
                                <span className="response-bar-count">{item.count}</span>
                              </div>
                            ))}
                            {total === 0 && <p className="text-muted text-xs">Нет ответов</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
