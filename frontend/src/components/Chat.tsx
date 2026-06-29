import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send } from 'lucide-react';
import { getChatMessages, ChatMessage } from '../api';

interface Props {
  sessionId: string;
  participantName: string;
}

let socket: Socket | null = null;

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';

function getSocket() {
  if (!socket) socket = io(SOCKET_URL);
  return socket;
}

export function Chat({ sessionId, participantName }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatMessages(sessionId).then(setMessages);
    const s = getSocket();
    s.emit('join_session', sessionId);
    s.on('chat_message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });
    return () => { s.off('chat_message'); };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!text.trim()) return;
    getSocket().emit('chat_message', { sessionId, participantName, text: text.trim() });
    setText('');
  };

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Пока нет сообщений.<br />Начните обсуждение!</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat-msg ${msg.participant_name === participantName ? 'own' : ''}`}>
            <div className="chat-msg-author">{msg.participant_name}</div>
            <div className="chat-msg-text">{msg.text}</div>
            <div className="chat-msg-time">{fmt(msg.created_at)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="form-input"
          style={{ flex: 1 }}
          placeholder="Написать сообщение..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button className="btn btn-primary btn-icon" onClick={send} disabled={!text.trim()}>
          <Send size={15} />
        </button>
      </div>
    </>
  );
}
