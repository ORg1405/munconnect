import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/app");
    } catch {
      setError("Email ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid hsl(210 20% 18%)",
    background: "hsl(210 42% 5%)",
    color: "hsl(220 15% 96%)",
    fontSize: "0.875rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "hsl(210 42% 5%)",
      padding: "24px",
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          width: "100%",
          maxWidth: 340,
          padding: "32px",
          background: "hsl(210 38% 8%)",
          border: "1px solid hsl(210 20% 18%)",
          borderRadius: 14,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "hsl(220 15% 96%)", letterSpacing: "-0.02em" }}>
            MUNConnect
          </div>
          <div style={{ fontSize: "0.8rem", color: "hsl(220 8% 50%)", marginTop: 4 }}>
            Entre na sua conta
          </div>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        {error && (
          <p style={{ margin: 0, fontSize: "0.75rem", color: "hsl(0 75% 60%)" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "11px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, hsl(209 78% 28%) 0%, hsl(207 72% 42%) 48%, hsl(199 85% 52%) 100%)",
            color: "white",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            marginTop: 2,
          }}
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <Link
          to="/"
          style={{
            textAlign: "center",
            fontSize: "0.75rem",
            color: "hsl(220 8% 50%)",
            textDecoration: "none",
            marginTop: 4,
          }}
        >
          ← Voltar ao início
        </Link>
      </form>
    </div>
  );
}
