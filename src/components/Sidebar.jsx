const tabs = [
  {
    id: "calendar",
    label: "Calendário",
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "motion",
    label: "Gerador de Moção",
    soon: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M2 4h10M2 7h7M2 10h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "debate",
    label: "IA de Debate",
    soon: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M2 2h7a1 1 0 011 1v4a1 1 0 01-1 1H5l-2 2V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M12 5h-1v4H7l-1 1h5a1 1 0 001-1V6a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
];

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside style={{
      width: 210,
      minWidth: 210,
      background: "#f3f2ef",
      borderRight: "0.5px solid #e0ddd6",
      display: "flex",
      flexDirection: "column",
      padding: "20px 0",
    }}>
      <div style={{ padding: "0 16px 20px", borderBottom: "0.5px solid #e0ddd6", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>MUNConnect</div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Belo Horizonte</div>
      </div>

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 16px",
              fontSize: 13,
              cursor: "pointer",
              background: isActive ? "#ffffff" : "transparent",
              color: isActive ? "#1a1a1a" : "#555",
              fontWeight: isActive ? 500 : 400,
              border: "none",
              borderRight: isActive ? "2px solid #1D9E75" : "2px solid transparent",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span style={{ display: "flex", alignItems: "center" }}>{tab.icon}</span>
            <span style={{ flex: 1 }}>{tab.label}</span>
            {tab.soon && (
              <span style={{
                fontSize: 10,
                background: "#e8e6e0",
                color: "#888",
                padding: "1px 6px",
                borderRadius: 8,
              }}>
                em breve
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
