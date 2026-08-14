"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import NewReservaModal from "@/components/crm/NewReservaModal";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Mismos 4 colores que ya usan en el Excel (AM/AD/DD/DM) para que se sienta
// familiar a quien ya conoce el RACK.
const COLOR = {
  "airbnb-mes":   { bg: "#F4B084", text: "#7c3400" },
  "airbnb-dia":   { bg: "#F8CBAD", text: "#7c3400" },
  "directo-dia":  { bg: "#C6E0B4", text: "#2d5016" },
  "directo-mes":  { bg: "#92D050", text: "#2d5016" },
};

function codigoColor(reserva) {
  return `${reserva.origen}-${reserva.tipo_renta}`;
}

function ymd(year, month0, day) {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function DisponibilidadPanel({ leads }) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [lofts, setLofts] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedReserva, setSelectedReserva] = useState(null);

  const mesParam = `${year}-${String(month + 1).padStart(2, "0")}`;
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reservas?mes=${mesParam}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error cargando disponibilidad");
      setLofts(json.lofts || []);
      setReservas(json.reservas || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mesParam]);

  useEffect(() => { cargar(); }, [cargar]);

  const reservasPorLoft = useMemo(() => {
    const map = {};
    reservas.forEach((r) => {
      if (!r.loft_id) return;
      if (!map[r.loft_id]) map[r.loft_id] = [];
      map[r.loft_id].push(r);
    });
    return map;
  }, [reservas]);

  const goPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const reservaEnDia = (loftId, day) => {
    const k = ymd(year, month, day);
    const enEsteLoft = reservasPorLoft[loftId] || [];
    // noche ocupada: checkin <= dia < checkout
    return enEsteLoft.filter((r) => r.fecha_checkin <= k && r.fecha_checkout > k);
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      display: "flex", flexDirection: "column",
      flex: 1, minHeight: 0, overflow: "hidden",
      fontFamily: "'DM Mono', monospace",
    }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #e5e7eb", flexShrink: 0, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: "#2C4A8C", color: "#fff", border: "none", borderRadius: 20,
            padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            letterSpacing: 0.5, whiteSpace: "nowrap", fontFamily: "inherit",
          }}
        >
          + Nueva reserva
        </button>

        <button
          onClick={goToday}
          style={{ padding: "5px 14px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", fontSize: 12, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}
        >
          Hoy
        </button>

        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={goPrevMonth} style={{ padding: "5px 10px", border: "1px solid #e5e7eb", borderRadius: "6px 0 0 6px", background: "#fff", fontSize: 16, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>‹</button>
          <button onClick={goNextMonth} style={{ padding: "5px 10px", border: "1px solid #e5e7eb", borderLeft: "none", borderRadius: "0 6px 6px 0", background: "#fff", fontSize: 16, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>›</button>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", flex: 1 }}>
          {MONTH_NAMES[month]} {year}
        </div>

        {/* Leyenda */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { k: "airbnb-dia", l: "Airbnb día" },
            { k: "airbnb-mes", l: "Airbnb mes" },
            { k: "directo-dia", l: "Directo día" },
            { k: "directo-mes", l: "Directo mes" },
          ].map(({ k, l }) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: COLOR[k].bg, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "#6b7280" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 16px", background: "#fef2f2", color: "#991b1b", fontSize: 12 }}>{error}</div>
      )}

      {/* Grilla: filas = lofts, columnas = días del mes */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 24, color: "#9ca3af", fontSize: 13 }}>Cargando disponibilidad…</div>
        ) : (
          <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: "#fff", borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", padding: "6px 10px", textAlign: "left", minWidth: 90 }}>
                  Loft
                </th>
                {days.map((d) => {
                  const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                  return (
                    <th key={d} style={{
                      position: "sticky", top: 0, zIndex: 2, background: isToday ? "#eff6ff" : "#fff",
                      borderBottom: "1px solid #e5e7eb", padding: "6px 4px", fontWeight: isToday ? 700 : 400,
                      color: isToday ? "#2C4A8C" : "#6b7280", minWidth: 28, textAlign: "center",
                    }}>
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {lofts.map((loft) => (
                <tr key={loft.id}>
                  <td style={{ position: "sticky", left: 0, background: "#fff", borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #f3f4f6", padding: "6px 10px", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>
                    {loft.nombre}
                  </td>
                  {days.map((d) => {
                    const ocupaciones = reservaEnDia(loft.id, d);
                    const r = ocupaciones[0];
                    const traslape = ocupaciones.length > 1;
                    const colores = r ? COLOR[codigoColor(r)] : null;
                    return (
                      <td
                        key={d}
                        onClick={() => r && setSelectedReserva(r)}
                        title={r ? `${r.nombre_huesped} (${r.fecha_checkin} → ${r.fecha_checkout})` : ""}
                        style={{
                          borderBottom: "1px solid #f3f4f6", height: 24,
                          background: colores ? colores.bg : "transparent",
                          cursor: r ? "pointer" : "default",
                          position: "relative",
                        }}
                      >
                        {traslape && (
                          <span style={{ position: "absolute", top: 1, right: 1, width: 5, height: 5, borderRadius: "50%", background: "#dc2626" }} title="Traslape de reservas" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detalle de reserva seleccionada */}
      {selectedReserva && (
        <div onClick={() => setSelectedReserva(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 360, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", fontFamily: "'DM Mono', monospace" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 10 }}>{selectedReserva.nombre_huesped}</div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#374151" }}>Origen: {selectedReserva.origen} · {selectedReserva.tipo_renta}</div>
              <div style={{ fontSize: 12, color: "#374151" }}>Check-in: {selectedReserva.fecha_checkin}</div>
              <div style={{ fontSize: 12, color: "#374151" }}>Check-out: {selectedReserva.fecha_checkout}</div>
              {selectedReserva.telefono && <div style={{ fontSize: 12, color: "#374151" }}>Tel: {selectedReserva.telefono}</div>}
              {selectedReserva.notas && <div style={{ fontSize: 11, color: "#991b1b" }}>{selectedReserva.notas}</div>}
            </div>
            <button onClick={() => setSelectedReserva(null)} style={{ marginTop: 16, width: "100%", padding: "7px 0", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer" }}>Cerrar</button>
          </div>
        </div>
      )}

      <NewReservaModal
        show={showForm}
        onClose={() => setShowForm(false)}
        lofts={lofts}
        leads={leads}
        onSaved={() => { setShowForm(false); cargar(); }}
      />
    </div>
  );
}
