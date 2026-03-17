import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { AuthProvider, useAuth } from "./AuthContext";
import Sidebar from "./components/Sidebar";
import Calendar from "./components/Calendar";
import ComingSoon from "./components/ComingSoon";
import LoginPage from "./components/LoginPage";

function AppContent() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("calendar");

  if (!user) return <LoginPage />;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f9f9f8" }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "calendar" && <Calendar isAdmin={isAdmin} />}
        {activeTab === "motion" && <ComingSoon title="Gerador de Moção" />}
        {activeTab === "debate" && <ComingSoon title="IA de Debate" />}
        {activeTab === "pending" && <ComingSoon title="Revisão Pendente" />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
