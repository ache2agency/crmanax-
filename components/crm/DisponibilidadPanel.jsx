"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const COLOR = {
  "airbnb-mes": { bg: "#F4B084", text: "#7c3400" },
  "airbnb-dia": { bg: "#F8CBAD", text: "#7c3400" },
  "directo-dia": { bg: "#C6E0B4", text: "#2d5016" },
  "directo-mes": { bg: "#92D050", text: "#2d5016" },
};

function ymd(year, month0, day) {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatSync(sync) {
  if (!sync?.finished_at) return "Sin sincronizar";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(sync.finished_at));
}

export default function DisponibilidadPanel() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [lofts, setLofts] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [selectedReserva, setSelectedReserva] = useState(null);

  const mesParam = `${year}-${String(month + 1).padStart(2, "0")}`;
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/reservas?mes=${mesParam}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Error cargando disponibilidad");
      setLofts(json.lofts || []);
      setReservas(json.reservas || []);
      setLastSync(json.lastSync || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mesParam]);

  useEffect(() => { cargar(); }, [cargar]);

  const reservasPorLoft = useMemo(() => {
    const map = {};
    reservas.forEach((reserva) => {
      if (!reserva.loft_id) return;
      if (!map[reserva.loft_id]) map[reserva.loft_id] = [];
      map[reserva.loft_id].push(reserva);
    });
    return map;
  }, [reservas]);

  const goPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear((value) => value - 1); } else setMonth((value) => value - 1);
  };

  const goNextMonth = () => {
    if (month === 11) { setMonth(0); setYear((value) => value + 1); } else setMonth((value) => value + 1);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const syncNow = async () => {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch("/api/reservas/sync", { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Error sincronizando reservas");
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const reservaEnDia = (loftId, day) => {
    const key = ymd(year, month, day);
    const enEsteLoft = reservasPorLoft[loftId] || [];
    return enEsteLoft.filter((reserva) => reserva.fecha_checkin <= key && reserva.fecha_checkout > key);
  };

  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
      display: "flex", flexDirection: "column", flex: 1, minHeight: 0,
      // En celular el panel crecía al ancho de la tabla (31 días) y se cortaba en
      // el día ~10 sin poder desplazarse: se limita al ancho de la pantalla para
      // que el scroll horizontal sea de la tabla.
      width: "100%", maxWidth: "100vw", minWidth: 0,
      overflow: "hidden", fontFamily: "'DM Mono', monospace",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #e5e7eb", flexShrink: 0, flexWrap: "wrap" }}>
        <button
          onClick={syncNow}
          disabled={syncing}
          style={{
            background: syncing ? "#94a3b8" : "#2C4A8C", color: "#fff", border: "none",
            borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600,
            cursor: syncing ? "wait" : "pointer", fontFamily: "inherit",
          }}
        >
          {syncing ? "Actualizando..." : "Actualizar ahora"}
        </button>

        <button onClick={goToday} style={{ padding: "6px 12px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", fontSize: 12, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
          Hoy
        </button>

        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={goPrevMonth} style={{ padding: "5px 10px", border: "1px solid #e5e7eb", borderRadius: "6px 0 0 6px", background: "#fff", fontSize: 16, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>‹</button>
          <button onClick={goNextMonth} style={{ padding: "5px 10px", border: "1px solid #e5e7eb", borderLeft: "none", borderRadius: "0 6px 6px 0", background: "#fff", fontSize: 16, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>›</button>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", flex: 1, minWidth: 160 }}>
          {MONTH_NAMES[month]} {year}
          <span style={{ display: "block", color: "#64748b", fontSize: 10, fontWeight: 400, marginTop: 2 }}>
            Actualizado: {formatSync(lastSync)}
          </span>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { key: "airbnb-dia", label: "Airbnb dia" },
            { key: "airbnb-mes", label: "Airbnb mes" },
            { key: "directo-dia", label: "Directo dia" },
            { key: "directo-mes", label: "Directo mes" },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: COLOR[key].bg, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "#6b7280" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 16px", background: "#fef2f2", color: "#991b1b", fontSize: 12 }}>{error}</div>
      )}

      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", minWidth: 0, maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
        {loading ? (
          <div style={{ padding: 24, color: "#9ca3af", fontSize: 13 }}>Cargando disponibilidad...</div>
        ) : (
          <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: "#fff", borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", padding: "6px 10px", textAlign: "left", minWidth: 90 }}>
                  Loft
                </th>
                {days.map((day) => {
                  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                  return (
                    <th key={day} style={{
                      position: "sticky", top: 0, zIndex: 2, background: isToday ? "#eff6ff" : "#fff",
                      borderBottom: "1px solid #e5e7eb", padding: "6px 4px", fontWeight: isToday ? 700 : 400,
                      color: isToday ? "#2C4A8C" : "#6b7280", minWidth: 28, textAlign: "center",
                    }}>
                      {day}
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
                  {days.map((day) => {
                    const ocupaciones = reservaEnDia(loft.id, day);
                    const reserva = ocupaciones[0];
                    const traslape = ocupaciones.length > 1;
                    const color = reserva ? COLOR[`${reserva.canal}-${reserva.tipo_renta}`] : null;
                    return (
                      <td
                        key={day}
                        onClick={() => reserva && setSelectedReserva(reserva)}
                        title={reserva ? `${reserva.nombre_huesped} (${reserva.fecha_checkin} -> ${reserva.fecha_checkout})` : ""}
                        style={{
                          borderBottom: "1px solid #f3f4f6", height: 24,
                          background: color ? color.bg : "transparent",
                          cursor: reserva ? "pointer" : "default",
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

      {selectedReserva && (
        <div onClick={() => setSelectedReserva(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ background: "#fff", borderRadius: 8, padding: 24, maxWidth: 360, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", fontFamily: "'DM Mono', monospace" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 10 }}>{selectedReserva.nombre_huesped}</div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#374151" }}>Canal: {selectedReserva.canal} · {selectedReserva.tipo_renta}</div>
              <div style={{ fontSize: 12, color: "#374151" }}>Check-in: {selectedReserva.fecha_checkin}</div>
              <div style={{ fontSize: 12, color: "#374151" }}>Check-out: {selectedReserva.fecha_checkout}</div>
              {selectedReserva.telefono && <div style={{ fontSize: 12, color: "#374151" }}>Tel: {selectedReserva.telefono}</div>}
              {selectedReserva.notas && <div style={{ fontSize: 11, color: "#991b1b" }}>{selectedReserva.notas}</div>}
            </div>
            <button onClick={() => setSelectedReserva(null)} style={{ marginTop: 16, width: "100%", padding: "7px 0", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer" }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
