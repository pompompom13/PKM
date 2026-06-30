import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Presentation, Upload, Plus, Trash2, ArrowLeft, ArrowRight, Check, Copy, BarChart3 } from 'lucide-react';
import { createSession, uploadPresentation, saveQuestions } from '../api';

interface QuestionDraft {
  text: string;
  type: 'text' | 'single' | 'multiple' | 'rating';
  options: string[];
}

const STEPS = ['Основное', 'Презентация', 'Вопросы', 'Готово'];

export function CreateSessionPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [expectedParticipants, setExpectedParticipants] = useState('');

  // Step 1
  const [file, setFile] = useState<File | null>(null);

  // Step 2
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  // Step 3 — result
  const [sessionId, setSessionId] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [copied, setCopied] = useState(false);

  const addQuestion = () => setQuestions(q => [...q, { text: '', type: 'text', options: ['', ''] }]);

  const updateQuestion = (i: number, patch: Partial<QuestionDraft>) =>
    setQuestions(q => q.map((item, idx) => idx === i ? { ...item, ...patch } : item));

  const addOption = (qi: number) =>
    setQuestions(q => q.map((item, idx) => idx === qi ? { ...item, options: [...item.options, ''] } : item));

  const updateOption = (qi: number, oi: number, val: string) =>
    setQuestions(q => q.map((item, idx) => idx === qi ? { ...item, options: item.options.map((o, oidx) => oidx === oi ? val : o) } : item));

  const removeOption = (qi: number, oi: number) =>
    setQuestions(q => q.map((item, idx) => idx === qi ? { ...item, options: item.options.filter((_, oidx) => oidx !== oi) } : item));

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { id, key } = await createSession({ title, description, creator_name: creatorName, deadline, expected_participants: expectedParticipants ? parseInt(expectedParticipants) : 0 });
      localStorage.setItem(`organizer_${id}`, 'true');
      if (file) await uploadPresentation(id, file);
      if (questions.length > 0) {
        await saveQuestions(id, questions.filter(q => q.text.trim()).map(q => ({
          text: q.text,
          type: q.type,
          options: (q.type === 'single' || q.type === 'multiple')
            ? q.options.filter(o => o.trim()) as any
            : undefined
        })));
      }
      setSessionId(id);
      setAccessKey(key);
      setStep(3);
    } catch (e) {
      alert('Ошибка при создании сессии');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(accessKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canNext = [
    title.trim() && creatorName.trim(),
    true,
    true,
    true
  ][step];

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <div className="nav-logo-icon"><Presentation size={18} color="#fff" /></div>
            AsyncMeet
          </Link>
          <Link to="/" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Отмена</Link>
        </div>
      </nav>

      <div style={{ flex: 1, padding: '40px 24px' }}>
        <div className="container-sm">
          {step < 3 && (
            <>
              <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Новая сессия</h1>
              <p className="text-muted text-sm" style={{ marginBottom: 32 }}>Настройте сессию для вашей команды</p>
              <div className="steps" style={{ marginBottom: 40 }}>
                {STEPS.slice(0, 3).map((label, i) => (
                  <div key={label} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                    <div className="step-num">{i < step ? <Check size={14} /> : i + 1}</div>
                    <span className="step-label">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Step 0: Basic info */}
          {step === 0 && (
            <div className="card gap-24" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="form-group">
                <label className="form-label">Название сессии *</label>
                <input className="form-input" placeholder="Например: Итоги продаж за июнь 2026" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Описание</label>
                <textarea className="form-textarea" placeholder="Что обсуждаем в этой сессии?" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="form-group">
                <label className="form-label">Ваше имя (организатор) *</label>
                <input className="form-input" placeholder="Иван Иванов" value={creatorName} onChange={e => setCreatorName(e.target.value)} />
              </div>
              <div className="row" style={{ gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Дедлайн просмотра</label>
                  <input className="form-input" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
                  <span className="text-muted text-xs">Опционально — участники увидят срок</span>
                </div>
                <div className="form-group" style={{ width: 160 }}>
                  <label className="form-label">Участников (план)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={expectedParticipants} onChange={e => setExpectedParticipants(e.target.value)} />
                  <span className="text-muted text-xs">Для статистики</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="card">
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${file ? 'var(--success)' : 'var(--border2)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: file ? 'var(--success-light)' : 'var(--surface2)'
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') setFile(f); }}
              >
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
                {file ? (
                  <>
                    <Check size={40} color="var(--success)" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 700, color: 'var(--success)' }}>{file.name}</p>
                    <p className="text-muted text-sm" style={{ marginTop: 4 }}>{(file.size / 1024 / 1024).toFixed(1)} MB — нажмите чтобы заменить</p>
                  </>
                ) : (
                  <>
                    <Upload size={40} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 600 }}>Перетащите PDF или нажмите для выбора</p>
                    <p className="text-muted text-sm" style={{ marginTop: 4 }}>Максимум 50 МБ</p>
                  </>
                )}
              </div>
              {!file && (
                <p className="text-muted text-sm text-center" style={{ marginTop: 16 }}>
                  Вы можете пропустить этот шаг и загрузить презентацию позже
                </p>
              )}
            </div>
          )}

          {/* Step 2: Questions */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {questions.map((q, qi) => (
                <div key={qi} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="row-between">
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Вопрос {qi + 1}</span>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setQuestions(q => q.filter((_, i) => i !== qi))}>
                      <Trash2 size={15} color="var(--danger)" />
                    </button>
                  </div>
                  <input
                    className="form-input"
                    placeholder="Текст вопроса..."
                    value={q.text}
                    onChange={e => updateQuestion(qi, { text: e.target.value })}
                  />
                  <div className="form-group">
                    <label className="form-label">Тип ответа</label>
                    <select className="form-select" value={q.type} onChange={e => updateQuestion(qi, { type: e.target.value as QuestionDraft['type'] })}>
                      <option value="text">Свободный текст</option>
                      <option value="single">Один вариант</option>
                      <option value="multiple">Несколько вариантов</option>
                      <option value="rating">Оценка 1-5</option>
                    </select>
                  </div>
                  {(q.type === 'single' || q.type === 'multiple') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="row">
                          <input
                            className="form-input"
                            placeholder={`Вариант ${oi + 1}`}
                            value={opt}
                            onChange={e => updateOption(qi, oi, e.target.value)}
                          />
                          {q.options.length > 2 && (
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeOption(qi, oi)}>
                              <Trash2 size={13} color="var(--text-dim)" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => addOption(qi)}>
                        <Plus size={13} /> Добавить вариант
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary w-full" onClick={addQuestion}>
                <Plus size={16} /> Добавить вопрос
              </button>
              {questions.length === 0 && (
                <p className="text-muted text-sm text-center">
                  Вопросы необязательны — вы можете создать сессию без опроса
                </p>
              )}
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
              <div style={{ width: 72, height: 72, background: 'var(--success-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={32} color="var(--success)" />
              </div>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Сессия создана!</h2>
                <p className="text-muted">Поделитесь ключом с участниками</p>
              </div>
              <div className="key-box" style={{ width: '100%' }}>
                <p className="text-muted text-xs" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ключ доступа</p>
                <div className="key-text">{accessKey}</div>
              </div>
              <button className="btn btn-secondary w-full" onClick={copyKey}>
                {copied ? <><Check size={15} /> Скопировано!</> : <><Copy size={15} /> Скопировать ключ</>}
              </button>
              <div className="divider" style={{ width: '100%' }} />
              <div className="row" style={{ width: '100%' }}>
                <Link to={`/dashboard/${sessionId}`} className="btn btn-secondary w-full">
                  <BarChart3 size={15} /> Дашборд
                </Link>
                <Link to="/" className="btn btn-primary w-full">
                  На главную
                </Link>
              </div>
            </div>
          )}

          {step < 3 && (
            <div className="row-between" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
                <ArrowLeft size={14} /> Назад
              </button>
              {step < 2 ? (
                <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext}>
                  Далее <ArrowRight size={14} />
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                  {loading ? 'Создание...' : <><Check size={14} /> Создать сессию</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
