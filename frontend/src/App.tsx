import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CreateSessionPage } from './pages/CreateSessionPage';
import { JoinSessionPage } from './pages/JoinSessionPage';
import { SessionViewPage } from './pages/SessionViewPage';
import { DashboardPage } from './pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateSessionPage />} />
        <Route path="/join" element={<JoinSessionPage />} />
        <Route path="/session/:sessionId" element={<SessionViewPage />} />
        <Route path="/dashboard/:sessionId" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}
