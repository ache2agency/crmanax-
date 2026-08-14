"use client";

import { useState } from "react";

const initialState = {
  origen: "directo",
  nombre_huesped: "",
  telefono: "",
  email: "",
  loft_id: "",
  tipo_renta: "dia",
  fecha_checkin: "",
  fecha_checkout: "",
  num_adultos: 1,
  lead_id: "",
};

export default function NewReservaModal({ show, onClose, lofts, leads, onSaved }) {
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  if (!show) return null;

  const set = (field) => (e) => {
    const value = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const guardar = async () => {
    setError("");
    setAviso("");
    if (!form.nombre_huesped || !form.loft_id || !form.fecha_checkin || !form.fecha_checkout) {
      setError("Nombre, loft, check-in y check-out son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lead_id: form.lead_id || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error guardando la reserva");
      if (json.traslapes?.length) {
        setAviso(`Ojo: ese loft ya tiene ${json.traslapes.length} reserva(s) traslapada(s) en esas fechas.`);
      }
      setForm(initialState);
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 24 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: "#2C4A8C", letterSpacing: 2, marginBottom: 20 }}>NUEVA RESERVA</div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>ORIGEN</div>
                <select className="select" value={form.origen} onChange={set("origen")}>
                  <option value="directo">Directo</option>
                  <option value="airbnb">Airbnb</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>TIPO DE RENTA</div>
                <select className="select" value={form.tipo_renta} onChange={set("tipo_renta")}>
                  <option value="dia">Por día</option>
                  <option value="mes">Por mes</option>
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>NOMBRE DEL HUÉSPED</div>
              <input className="input" value={form.nombre_huesped} onChange={set("nombre_huesped")} placeholder="Nombre completo" />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>TELÉFONO</div>
                <input className="input" value={form.telefono} onChange={set("telefono")} placeholder="+52..." />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>ADULTOS</div>
                <input className="input" type="number" min={1} value={form.num_adultos} onChange={set("num_adultos")} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>LOFT</div>
              <select className="select" value={form.loft_id} onChange={set("loft_id")}>
                <option value="">Selecciona un loft</option>
                {lofts.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre} ({l.tipo})</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>CHECK-IN</div>
                <input className="input" type="date" value={form.fecha_checkin} onChange={set("fecha_checkin")} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>CHECK-OUT</div>
                <input className="input" type="date" value={form.fecha_checkout} onChange={set("fecha_checkout")} />
              </div>
            </div>

            {leads?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>LEAD RELACIONADO (opcional)</div>
                <select className="select" value={form.lead_id} onChange={set("lead_id")}>
                  <option value="">— Sin relacionar —</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre} — {l.email}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && <div style={{ marginTop: 14, fontSize: 12, color: "#991b1b" }}>{error}</div>}
          {aviso && <div style={{ marginTop: 14, fontSize: 12, color: "#92400e" }}>{aviso}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={guardar} disabled={saving}>
              {saving ? "Guardando..." : "GUARDAR RESERVA →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
