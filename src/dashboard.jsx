import { useState } from "react";
import { useAuth } from "./AuthContext";
import Sidebar from "./components/Sidebar";
import Home from "./components/Home";
import Committees from "./components/Committees";
import ComingSoon from "./components/ComingSoon";
import MotionGenerator from "./components/MotionGenerator";
import DebateTrainer from "./components/DebateTrainer";

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("home");

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "var(--font-ui)", background: "var(--bg-base)" }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "home" && <Home isAdmin={isAdmin} setActiveTab={setActiveTab} />}
        {activeTab === "comites" && <Committees />}
        {activeTab === "motion" && <MotionGenerator />}
        {activeTab === "debate" && <DebateTrainer />}
        {activeTab === "pending" && <ComingSoon title="Revisão Pendente" />}
      </main>
    </div>
  );
}
