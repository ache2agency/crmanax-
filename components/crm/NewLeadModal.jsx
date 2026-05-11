"use client";
import { useState } from "react";

export default function NewLeadModal({
  showForm,
  setShowForm,
  newLead,
  setNewLead,
  vendedores,
  addLead,
}) {
  const [saving, setSaving] = useState(false);
  if (!showForm) return null;

  const handleAdd = async () => {
    if (saving) return;
    setSaving(true);
    await addLead();
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={() => setShowForm(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 24 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: "#E8A838", letterSpacing: 2, marginBottom: 20 }}>NUEVO PROSPECTO</div>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { label: "NOMBRE *", key: "nombre", placeholder: "Nombre completo" },
              { label: "EMAIL", key: "email", placeholder: "correo@email.com" },
              { label: "WHATSAPP", key: "whatsapp", placeholder: "+52 55 XXXX XXXX" },
              { label: "ZONA DE INTERÉS", key: "zona", placeholder: "Ej. Polanco, Roma, Condesa..." },
              { label: "PRESUPUESTO MENSUAL ($)", key: "presupuesto", placeholder: "Ej. 12000" },
              { label: "VALOR ESTIMADO / RENTA ($)", key: "valor", placeholder: "0" },
            ].map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>{f.label}</div>
                <input
                  className="input"
                  placeholder={f.placeholder}
                  value={newLead[f.key]}
                  onChange={(e) => setNewLead((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>CUARTOS</div>
              <select className="select" value={newLead.cuartos} onChange={(e) => setNewLead((p) => ({ ...p, cuartos: e.target.value }))}>
                <option value="">Sin especificar</option>
                <option value="1">1 cuarto (estudio)</option>
                <option value="2">2 cuartos</option>
                <option value="3">3 cuartos</option>
                <option value="4+">4 cuartos o más</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>FECHA DE ENTRADA ESTIMADA</div>
              <input
                className="input"
                type="date"
                value={newLead.fecha_entrada}
                onChange={(e) => setNewLead((p) => ({ ...p, fecha_entrada: e.target.value }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>ASIGNAR A ASESOR</div>
              <select className="select" value={newLead.asignado_a} onChange={(e) => setNewLead((p) => ({ ...p, asignado_a: e.target.value }))}>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.nombre || v.email} {v.rol === "admin" ? "(admin)" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>NOTAS INICIALES</div>
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
