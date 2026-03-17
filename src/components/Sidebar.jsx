import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../AuthContext";

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

const adminTabs = [
  {
    id: "pending",
    label: "Revisão pendente",
    adminOnly: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Sidebar({ activeTab, setActiveTab, isAdmin }) {
  const { user } = useAuth();

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
              <span style={{ fontSize: 10, background: "#e8e6e0", color: "#888", padding: "1px 6px", borderRadius: 8 }}>
                em breve
              </span>
            )}
          </button>
        );
      })}

      {isAdmin && (
        <>
          <div style={{ margin: "12px 16px 6px", fontSize: 10, color: "#aaa", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Admin
          </div>
          {adminTabs.map((tab) => {
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
                  color: isActive ? "#cc6600" : "#886633",
                  fontWeight: isActive ? 500 : 400,
                  border: "none",
                  borderRight: isActive ? "2px solid #cc6600" : "2px solid transparent",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span style={{ display: "flex", alignItems: "center" }}>{tab.icon}</span>
                <span style={{ flex: 1 }}>{tab.label}</span>
              </button>
            );
          })}
        </>
      )}

      {/* Usuário logado + logout */}
      <div style={{ marginTop: "auto", padding: "12px 16px", borderTop: "0.5px solid #e0ddd6" }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user?.email}
        </div>
        {isAdmin && (
          <span style={{ fontSize: 10, background: "#E1F5EE", color: "#0F6E56", padding: "1px 7px", borderRadius: 8, display: "inline-block", marginBottom: 8 }}>
            admin
          </span>
        )}
        <button
          onClick={() => signOut(auth)}
          style={{
            width: "100%",
            padding: "6px 0",
            fontSize: 12,
            border: "0.5px solid #ddd",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
            color: "#888",
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
