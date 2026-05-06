"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Registro() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleRegistro = async () => {
    if (!nombre.trim()) {
      return setError("El nombre es obligatorio");
    }
    if (!email.trim() || !isValidEmail(email.trim())) {
      return setError("Ingresa un email válido");
    }
    if (!password || password.length < 6) {
      return setError("La contraseña debe tener al menos 6 caracteres");
    }

    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { nombre } } });
    if (error) setError(error.message);
    else router.push("/");
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "'DM Mono', monospace", background: "#0e0e0e", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');`}</style>
      <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 12, padding: 40, width: "100%", maxWidth: 400 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: "#E8A838", letterSpacing: 3, marginBottom: 8 }}>WINDSOR CRM</div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 32, letterSpacing: 1 }}>CRM v1.0 — Crear cuenta</div>

        {error && <div style={{ background: "#2a0d0d", border: "1px solid #E85D3844", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#E85D38", marginBottom: 20 }}>{error}</div>}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>NOMBRE</div>
          <input
            style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, color: "#e0e0e0", fontFamily: "inherit", fontSize: 13, padding: "10px 12px", width: "100%", outline: "none", boxSizing: "border-box" }}
            placeholder="Tu nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>EMAIL</div>
          <input
            style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, color: "#e0e0e0", fontFamily: "inherit", fontSize: 13, padding: "10px 12px", width: "100%", outline: "none", boxSizing: "border-box" }}
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>CONTRASEÑA</div>
          <input
            type="password"
            style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, color: "#e0e0e0", fontFamily: "inherit", fontSize: 13, padding: "10px 12px", width: "100%", outline: "none", boxSizing: "border-box" }}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <button
          onClick={handleRegistro}
          disabled={loading}
          style={{ background: "#E8A838", color: "#0e0e0e", border: "none", borderRadius: 6, padding: "12px 0", width: "100%", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1 }}
        >
          {loading ? "CREANDO CUENTA..." : "CREAR CUENTA →"}
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#555" }}>
          ¿Ya tienes cuenta?{" "}
          <a href="/login" style={{ color: "#E8A838", textDecoration: "none" }}>Inicia sesión</a>
        </div>
      </div>
    </div>
  );
}
