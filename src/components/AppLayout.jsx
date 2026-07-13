import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

// Shell persistente do app logado: sidebar fixa à esquerda + área de conteúdo
// (Outlet) à direita. Envolve tanto as abas do dashboard (/app/*) quanto as
// páginas de simulação (/conference/*), para que a sidebar nunca suma ao entrar
// num comitê. A navegação da sidebar é por rota (ver Sidebar.jsx).
export default function AppLayout() {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "var(--font-ui)",
        background: "var(--bg-base)",
      }}
    >
      <Sidebar />
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
