"use client";
import { useState } from "react";

export default function NewLeadModal({ showForm, setShowForm, newLead, setNewLead, vendedores, lofts = [], addLead }) {
  const [saving, setSaving] = useState(false);
  if (!showForm) return null;

  const handleAdd = async () => {
    if (saving) return;
    setSaving(true);
    await addLead();
    setSaving(false);
  };

  const field = (label, key, placeholder, type = "text") => (
    <div key={key}>
      <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <input
        className="input"
        type={type}
        placeholder={placeholder}
        value={newLead[key]}
        onChange={(e) => setNewLead((p) => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="modal-overlay" onClick={() => setShowForm(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 24 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: "#E8A838", letterSpacing: 2, marginBottom: 20 }}>NUEVO PROSPECTO</div>
          <div style={{ display: "grid", gap: 14 }}>

            {/* Datos básicos */}
            {field("NOMBRE *", "nombre", "Nombre completo")}
            {field("WHATSAPP", "whatsapp", "+52 747 XXX XXXX")}
            {field("EMAIL", "email", "correo@email.com")}

            {/* Tipo de renta */}
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>TIPO DE RENTA</div>
              <select className="select" value={newLead.tipo_renta} onChange={(e) => setNewLead((p) => ({ ...p, tipo_renta: e.target.value }))}>
                <option value="noche">Por noche</option>
                <option value="mes">Por mes</option>
              </select>
            </div>

            {/* Fechas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>CHECK-IN</div>
                <input className="input" type="date" value={newLead.fecha_checkin} onChange={(e) => setNewLead((p) => ({ ...p, fecha_checkin: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>CHECK-OUT</div>
                <input className="input" type="date" value={newLead.fecha_checkout} onChange={(e) => setNewLead((p) => ({ ...p, fecha_checkout: e.target.value }))} />
              </div>
            </div>

            {/* Personas y loft */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>NO. PERSONAS</div>
                <input className="input" type="number" min={1} max={10} value={newLead.num_personas} onChange={(e) => setNewLead((p) => ({ ...p, num_personas: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>LOFT</div>
                <select className="select" value={newLead.loft_id} onChange={(e) => setNewLead((p) => ({ ...p, loft_id: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {lofts.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre} ({l.tipo})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Valor y presupuesto */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {field("RENTA ESTIMADA ($)", "valor", "0")}
              {field("PRESUPUESTO DEL CLIENTE ($)", "presupuesto", "Ej. 15000")}
            </div>

            {/* Asesor */}
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>ASIGNAR A ASESOR</div>
              <select className="select" value={newLead.asignado_a} onChange={(e) => setNewLead((p) => ({ ...p, asignado_a: e.target.value }))}>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.nombre || v.email} {v.rol === "admin" ? "(admin)" : ""}</option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>NOTAS</div>
              <textarea className="input" placeholder="¿De dónde llegó? ¿Qué necesita?" value={newLead.notas}
                onChange={(e) => setNewLead((p) => ({ ...p, notas: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleAdd} disabled={saving}>{saving ? "GUARDANDO..." : "AGREGAR PROSPECTO →"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
