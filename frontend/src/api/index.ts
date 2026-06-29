import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';
const api = axios.create({ baseURL: BASE_URL });

export interface Session {
  id: string; title: string; description: string;
  creator_name: string; access_key: string;
  pdf_path: string | null; created_at: string; deadline: string | null;
  expected_participants: number; closed: number;
  questions?: Question[];
}

export interface Question {
  id: string; session_id: string; text: string;
  type: 'text' | 'single' | 'multiple' | 'rating';
  order_index: number; options?: { id: string; text: string }[];
}

export interface Participant {
  id: string; session_id: string; name: string;
  joined_at: string; current_slide: number;
  completed: number; completed_at: string | null;
}

export interface ChatMessage {
  id: string; session_id: string;
  participant_name: string; text: string; created_at: string;
}

export interface SlideComment {
  id: string; session_id: string; participant_id: string;
  participant_name: string; slide_number: number; text: string; created_at: string;
}

// Sessions
export const createSession = (data: {
  title: string; description: string; creator_name: string;
  deadline?: string; expected_participants?: number;
}) => api.post<{ id: string; key: string }>('/api/sessions', data).then(r => r.data);

export const uploadPresentation = (sessionId: string, file: File) => {
  const form = new FormData();
  form.append('presentation', file);
  return api.post(`/api/sessions/${sessionId}/upload`, form).then(r => r.data);
};

export const saveQuestions = (sessionId: string, questions: Omit<Question, 'id' | 'session_id' | 'order_index'>[]) =>
  api.post(`/api/sessions/${sessionId}/questions`, { questions }).then(r => r.data);

export const getSessionByKey = (key: string) =>
  api.get<Session>(`/api/sessions/key/${key}`).then(r => r.data);

export const getSession = (id: string) =>
  api.get<Session>(`/api/sessions/${id}`).then(r => r.data);

export const deleteSession = (id: string) =>
  api.delete(`/api/sessions/${id}`).then(r => r.data);

// Participants
export const joinSession = (sessionId: string, name: string) =>
  api.post<{ participantId: string }>(`/api/sessions/${sessionId}/join`, { name }).then(r => r.data);

export const updateProgress = (participantId: string, slide: number) =>
  api.put(`/api/participants/${participantId}/progress`, { current_slide: slide });

export const submitResponses = (participantId: string, responses: { question_id: string; answer: string }[]) =>
  api.post(`/api/participants/${participantId}/responses`, { responses });

export const getMyResponses = (participantId: string) =>
  api.get<{ question_id: string; answer_text: string }[]>(`/api/participants/${participantId}/responses`).then(r => r.data);

// Slide time
export const recordSlideTime = (participantId: string, sessionId: string, slide: number, seconds: number) =>
  api.post(`/api/participants/${participantId}/slide-time`, { session_id: sessionId, slide_number: slide, seconds });

// Reactions
export const setReaction = (participantId: string, sessionId: string, slide: number, reaction: string) =>
  api.post(`/api/participants/${participantId}/reactions`, { session_id: sessionId, slide_number: slide, reaction });

export const getReactions = (participantId: string, sessionId: string) =>
  api.get<{ slide_number: number; reaction: string }[]>(`/api/participants/${participantId}/reactions/${sessionId}`).then(r => r.data);

// Slide comments
export const addSlideComment = (sessionId: string, data: { participant_id: string; participant_name: string; slide_number: number; text: string }) =>
  api.post<SlideComment>(`/api/sessions/${sessionId}/slide-comments`, data).then(r => r.data);

export const getSlideComments = (sessionId: string, slide: number) =>
  api.get<SlideComment[]>(`/api/sessions/${sessionId}/slide-comments/${slide}`).then(r => r.data);

// Bookmarks
export const addBookmark = (participantId: string, sessionId: string, slide: number) =>
  api.post(`/api/participants/${participantId}/bookmarks`, { session_id: sessionId, slide_number: slide });

export const removeBookmark = (participantId: string, slide: number) =>
  api.delete(`/api/participants/${participantId}/bookmarks/${slide}`);

export const getBookmarks = (participantId: string, sessionId: string) =>
  api.get<{ slide_number: number }[]>(`/api/participants/${participantId}/bookmarks/${sessionId}`).then(r => r.data);

// Chat
export const getChatMessages = (sessionId: string) =>
  api.get<ChatMessage[]>(`/api/sessions/${sessionId}/chat`).then(r => r.data);

// Analytics
export const getAnalytics = (sessionId: string) =>
  api.get(`/api/sessions/${sessionId}/analytics`).then(r => r.data);

export { BASE_URL };
export default api;
