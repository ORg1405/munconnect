import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" ou "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(translateError(err.code));
    }
    setLoading(false);
  }

  function translateError(code) {
    const map = {
      "auth/user-not-found": "Usuário não encontrado.",
      "auth/wrong-password": "Senha incorreta.",
      "auth/email-already-in-use": "Este email já está cadastrado.",
      "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
      "auth/invalid-email": "Email inválido.",
      "auth/invalid-credential": "Email ou senha incorretos.",
    };
    return map[code] || "Erro ao entrar. Tente novamente.";
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f9f9f8",
    }}>
      <div style={{
        background: "#fff",
        border: "0.5px solid #e0ddd6",
        borderRadius: 16,
        padding: 32,
        width: 360,
        maxWidth: "90vw",
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a" }}>MUNConnect</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Belo Horizonte</div>
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px", color: "#1a1a1a" }}>
          {mode === "login" ? "Entrar na sua conta" : "Criar conta"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "#cc0000", marginTop: 8 }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          style={{
            ...submitBtnStyle,
            opacity: loading || !email || !password ? 0.6 : 1,
            marginTop: 16,
          }}
        >
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>

        <p style={{ fontSize: 12, color: "#888", textAlign: "center", marginTop: 14 }}>
          {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: "#1D9E75", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
          >
            {mode === "login" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "8px 12px",
  fontSize: 13,
  border: "0.5px solid #ddd",
  borderRadius: 8,
  outline: "none",
  width: "100%",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};

const submitBtnStyle = {
  width: "100%",
  padding: "9px 0",
  fontSize: 13,
  fontWeight: 500,
  background: "#1D9E75",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
