import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

// Cada aba da sidebar aponta para uma rota (navegação por URL, não por estado).
// Assim a sidebar continua visível e funcional em todas as telas internas —
// inclusive dentro de um comitê (/conference/...).
const TAB_PATH = {
  home: "/app",
  comites: "/app/comites",
  motion: "/app/motion",
  debate: "/app/debate",
  pending: "/app/pending",
};

// Deriva a aba ativa a partir da URL. Páginas de simulação/comitê
// (/conference/...) destacam "Comitês".
function activeTabFromPath(pathname) {
  if (pathname === "/app" || pathname === "/app/") return "home";
  if (pathname.startsWith("/app/comites") || pathname.startsWith("/conference"))
    return "comites";
  if (pathname.startsWith("/app/motion")) return "motion";
  if (pathname.startsWith("/app/debate")) return "debate";
  if (pathname.startsWith("/app/pending")) return "pending";
  return "home";
}

const tabs = [
  {
    id: "home",
    label: "Início",
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M2 6l5-4 5 4v6a1 1 0 01-1 1H3a1 1 0 01-1-1V6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M5.5 13V8.5h3V13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "comites",
    label: "Comitês",
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    id: "motion",
    label: "Gerador de Moção",
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

export default function Sidebar() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = activeTabFromPath(location.pathname);
  const setActiveTab = (id) => navigate(TAB_PATH[id] ?? "/app");

  return (
    <aside style={{
      width: 210,
      minWidth: 210,
      background: "var(--bg-overlay)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "20px 0",
    }}>
      <div style={{
        padding: "0 16px 18px",
        borderBottom: "1px solid var(--border)",
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          MUNConnect
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Belo Horizonte</div>
      </div>

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="sidebar-tab"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 16px",
              fontSize: 13,
              cursor: "pointer",
              background: isActive ? "hsl(205 68% 58% / 0.1)" : "transparent",
              color: isActive ? "var(--brand-400)" : "var(--text-secondary)",
              fontWeight: isActive ? 600 : 400,
              border: "none",
              borderRight: isActive ? "2px solid var(--brand-400)" : "2px solid transparent",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span style={{ display: "flex", alignItems: "center" }}>{tab.icon}</span>
            <span style={{ flex: 1 }}>{tab.label}</span>
            {tab.soon && (
              <span style={{
                fontSize: 10,
                background: "hsl(210 20% 18%)",
                color: "var(--text-muted)",
                padding: "1px 6px",
                borderRadius: 8,
              }}>
                em breve
              </span>
            )}
          </button>
        );
      })}

      {isAdmin && (
        <>
          <div style={{
            margin: "12px 16px 6px",
            fontSize: 10, color: "var(--text-muted)",
            fontWeight: 600, letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
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
                  background: isActive ? "hsl(38 92% 65% / 0.1)" : "transparent",
                  color: isActive ? "var(--accent-400)" : "hsl(38 60% 60%)",
                  fontWeight: isActive ? 600 : 400,
                  border: "none",
                  borderRight: isActive ? "2px solid var(--accent-400)" : "2px solid transparent",
                  textAlign: "left",
                  width: "100%",
                  transition: "background 0.12s, color 0.12s",
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
      <div style={{
        marginTop: "auto",
        padding: "12px 16px",
        borderTop: "1px solid var(--border)",
      }}>
        <div style={{
          fontSize: 11, color: "var(--text-muted)", marginBottom: 6,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {user?.email}
        </div>
        {isAdmin && (
          <span style={{
            fontSize: 10,
            background: "hsl(160 55% 24%)",
            color: "hsl(160 65% 60%)",
            padding: "1px 7px", borderRadius: 8,
            display: "inline-block", marginBottom: 8,
          }}>
            admin
          </span>
        )}
        <button
          onClick={() => signOut(auth).then(() => navigate("/"))}
          style={{
            width: "100%",
            padding: "6px 0",
            fontSize: 12,
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            background: "transparent",
            cursor: "pointer",
            color: "var(--text-muted)",
            transition: "color 0.12s, border-color 0.12s",
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
