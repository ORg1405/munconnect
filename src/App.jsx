import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Landing from "./Landing";
import LoginPage from "./components/LoginPage";
import AppLayout from "./components/AppLayout";
import Home from "./components/Home";
import Committees from "./components/Committees";
import ComingSoon from "./components/ComingSoon";
import MotionGenerator from "./components/MotionGenerator";
import DebateTrainer from "./components/DebateTrainer";
import ConferencePage from "./components/conference/ConferencePage";
import CommitteePage from "./components/conference/CommitteePage";
import ImportMembers from "./components/admin/ImportMembers";
import Sessions from "./components/admin/Sessions";
import CheckinPage from "./pages/CheckinPage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Check-in por QR — página pública, SEM login (o delegado só escaneou
              o QR do próprio crachá). Ver src/pages/CheckinPage.jsx. */}
          <Route path="/checkin" element={<CheckinPage />} />

          {/* App logado — sidebar persistente (AppLayout) em torno de TODAS as
              telas internas, inclusive as páginas de simulação/comitê. */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/app" element={<Home />} />
            <Route path="/app/comites" element={<Committees />} />
            <Route path="/app/importar" element={<ImportMembers />} />
            <Route path="/app/sessoes" element={<Sessions />} />
            <Route path="/app/motion" element={<MotionGenerator />} />
            <Route path="/app/debate" element={<DebateTrainer />} />
            <Route path="/app/pending" element={<ComingSoon title="Revisão Pendente" />} />

            {/* Simulação (Firestore real-time). URLs preservadas. */}
            <Route path="/conference/:conferenceId" element={<ConferencePage />} />
            <Route
              path="/conference/:conferenceId/committee/:committeeId"
              element={<CommitteePage />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
