import { useState, useEffect } from 'react';
import { CheckCircle, Star } from 'lucide-react';
import { Question, submitResponses, getMyResponses } from '../api';

interface Props {
  sessionId: string;
  participantId: string;
  questions: Question[];
  onComplete: () => void;
}

export function Poll({ sessionId: _sessionId, participantId, questions, onComplete }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMyResponses(participantId).then(res => {
      if (res.length > 0) {
        const map: Record<string, string> = {};
        res.forEach(r => { map[r.question_id] = r.answer_text; });
        setAnswers(map);
        setSubmitted(true);
      }
    });
  }, [participantId]);

  const setAnswer = (qId: string, val: string) => setAnswers(a => ({ ...a, [qId]: val }));

  const toggleMultiple = (qId: string, opt: string) => {
    const current = answers[qId] ? answers[qId].split('||') : [];
    const next = current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt];
    setAnswer(qId, next.join('||'));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const responses = questions.map(q => ({ question_id: q.id, answer: answers[q.id] || '' }));
      await submitResponses(participantId, responses);
      setSubmitted(true);
      onComplete();
    } catch {
      alert('Ошибка при отправке ответов');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 56, height: 56, background: 'var(--success-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={28} color="var(--success)" />
        </div>
        <p style={{ fontWeight: 700 }}>Ответы отправлены</p>
        <p className="text-muted text-sm">Спасибо за участие!</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="empty-state">
        <p>В этой сессии нет вопросов для опроса</p>
      </div>
    );
  }

  return (
    <div className="poll-wrap">
      {questions.map((q, qi) => (
        <div key={q.id} className="poll-question">
          <p className="poll-question-text">{qi + 1}. {q.text}</p>

          {q.type === 'text' && (
            <textarea
              className="form-textarea"
              placeholder="Ваш ответ..."
              value={answers[q.id] || ''}
              onChange={e => setAnswer(q.id, e.target.value)}
              rows={3}
            />
          )}

          {q.type === 'rating' && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  onClick={() => setAnswer(q.id, String(n))}
                  style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-sm)',
                    background: answers[q.id] === String(n) ? 'var(--accent-light)' : 'var(--surface2)',
                    border: `1px solid ${answers[q.id] === String(n) ? 'var(--accent)' : 'var(--border2)'}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 2, transition: 'all 0.15s'
                  }}
                >
                  <Star size={14} color={answers[q.id] === String(n) ? 'var(--accent)' : 'var(--text-muted)'} fill={answers[q.id] === String(n) ? 'var(--accent)' : 'none'} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: answers[q.id] === String(n) ? 'var(--accent)' : 'var(--text-muted)' }}>{n}</span>
                </button>
              ))}
            </div>
          )}

          {(q.type === 'single' || q.type === 'multiple') && (
            <div className="poll-options">
              {(q.options || []).map(opt => {
                const isSelected = q.type === 'single'
                  ? answers[q.id] === opt.text
                  : (answers[q.id] || '').split('||').includes(opt.text);
                return (
                  <label key={opt.id} className={`poll-option ${isSelected ? 'selected' : ''}`}>
                    <input
                      type={q.type === 'single' ? 'radio' : 'checkbox'}
                      checked={isSelected}
                      onChange={() => q.type === 'single' ? setAnswer(q.id, opt.text) : toggleMultiple(q.id, opt.text)}
                    />
                    <span className="poll-option-label">{opt.text}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Отправка...' : 'Отправить ответы'}
      </button>
    </div>
  );
}
