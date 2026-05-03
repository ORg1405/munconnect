import { useState } from "react";
import { useAuth } from "./AuthContext";
import Sidebar from "./components/Sidebar";
import Calendar from "./components/Calendar";
import ComingSoon from "./components/ComingSoon";
import MotionGenerator from "./components/MotionGenerator";

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("calendar");

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f9f9f8" }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "calendar" && <Calendar isAdmin={isAdmin} />}
        {activeTab === "motion" && <MotionGenerator />}
        {activeTab === "debate" && <ComingSoon title="IA de Debate" />}
        {activeTab === "pending" && <ComingSoon title="Revisão Pendente" />}
      </main>
    </div>
  );
}
