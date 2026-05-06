"use client";

export default function NewAppointmentModal({
  showCitaForm,
  setShowCitaForm,
  nuevaCita,
  setNuevaCita,
  leads,
  guardarCita,
}) {
  if (!showCitaForm) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowCitaForm(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 24 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: "#E8A838", letterSpacing: 2, marginBottom: 20 }}>NUEVA CITA</div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>LEAD</div>
              <select
                className="select"
                value={nuevaCita.lead_id}
                onChange={(e) => setNuevaCita((prev) => ({ ...prev, lead_id: e.target.value }))}
              >
                <option value="">Selecciona un lead</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre} — {l.email}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>FECHA</div>
                <input
                  type="date"
                  className="input"
                  value={nuevaCita.fecha}
                  onChange={(e) => setNuevaCita((prev) => ({ ...prev, fecha: e.target.value }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>HORA</div>
                <input
                  type="time"
                  className="input"
                  value={nuevaCita.hora}
                  onChange={(e) => setNuevaCita((prev) => ({ ...prev, hora: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>TIPO</div>
              <select
                className="select"
                value={nuevaCita.tipo}
                onChange={(e) => setNuevaCita((prev) => ({ ...prev, tipo: e.target.value }))}
              >
                <option value="clase_prueba">Clase muestra</option>
                <option value="asesoria">Asesoría</option>
                <option value="examen_ubicacion">Examen de ubicación</option>
                <option value="inscripcion">Inscripción</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>DURACIÓN</div>
              <select
                className="select"
                value={nuevaCita.duracion}
                onChange={(e) => setNuevaCita((prev) => ({ ...prev, duracion: Number(e.target.value) }))}
              >
                <option value={30}>30 minutos</option>
                <option value={60}>60 minutos</option>
                <option value={90}>90 minutos</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 6 }}>NOTAS</div>
              <textarea
                className="input"
                placeholder="Detalles de la cita..."
                value={nuevaCita.notas}
                onChange={(e) => setNuevaCita((prev) => ({ ...prev, notas: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCitaForm(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={guardarCita}>GUARDAR CITA →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
