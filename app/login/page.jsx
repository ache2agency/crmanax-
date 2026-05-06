"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleLogin = async () => {
    if (!email.trim() || !isValidEmail(email.trim())) {
      return setError("Ingresa un email válido");
    }
    if (!password || password.length < 6) {
      return setError("La contraseña debe tener al menos 6 caracteres");
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      localStorage.setItem('windsor_login_at', Date.now().toString());
      router.push("/");
    }
    setLoading(false);
  };

  const inputStyle = {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    color: "#1a1a1a",
    fontFamily: "inherit",
    fontSize: 13,
    padding: "10px 12px",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 10,
    color: "#64748b",
    letterSpacing: 1.5,
    marginBottom: 6,
    fontWeight: 600,
  };

  return (
    <div style={{ fontFamily: "'DM Mono', monospace", background: "#f5f7fa", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');`}</style>
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 40, width: "100%", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: "#2C4A8C", letterSpacing: 3, marginBottom: 4 }}>WINDSOR CRM</div>
          <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 1 }}>Iniciar sesión</div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 20 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>EMAIL</div>
          <input
            style={inputStyle}
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={labelStyle}>CONTRASEÑA</div>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              style={{ ...inputStyle, paddingRight: 40 }}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: 0, lineHeight: 1 }}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ background: "#2C4A8C", color: "#ffffff", border: "none", borderRadius: 6, padding: "12px 0", width: "100%", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: 1, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "ENTRANDO..." : "ENTRAR →"}
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#94a3b8" }}>
          ¿No tienes cuenta?{" "}
          <a href="/registro" style={{ color: "#2C4A8C", textDecoration: "none", fontWeight: 600 }}>Regístrate</a>
        </div>
      </div>
    </div>
  );
}
