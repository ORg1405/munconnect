import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Calendar from "./components/Calendar";
import ComingSoon from "./components/ComingSoon";

export default function App() {
  const [activeTab, setActiveTab] = useState("calendar");

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f9f9f8" }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "calendar" && <Calendar />}
        {activeTab === "motion" && <ComingSoon title="Gerador de Moção" />}
        {activeTab === "debate" && <ComingSoon title="IA de Debate" />}
      </main>
    </div>
  );
}
