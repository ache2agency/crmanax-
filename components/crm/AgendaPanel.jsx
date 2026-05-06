"use client";

import { useState, useMemo } from "react";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LABELS_MX = ["L", "M", "M", "J", "V", "S", "D"]; // Mon-first mini cal
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TIPO_LABEL = {
  clase_prueba: "Clase de prueba",
  asesoria: "Asesoría",
  examen_ubicacion: "Examen de ubicación",
  inscripcion: "Inscripción",
};

const TIPO_COLOR = {
  clase_prueba:     { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" },
  asesoria:         { bg: "#dcfce7", border: "#16a34a", text: "#15803d" },
  examen_ubicacion: { bg: "#fef9c3", border: "#ca8a04", text: "#854d0e" },
  inscripcion:      { bg: "#fee2e2", border: "#dc2626", text: "#991b1b" },
};

const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_H = 60; // px per hour

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // always Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function AgendaPanel({ citas, setShowCitaForm, getCitaStatusStyle, updateCitaStatus }) {
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedCita, setSelectedCita] = useState(null);
  const [view, setView] = useState("semana");

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [weekStart]);

  const citasByDay = useMemo(() => {
    const map = {};
    citas.forEach((c) => {
      if (!c.fecha) return;
      const k = c.fecha.slice(0, 10);
      if (!map[k]) map[k] = [];
      map[k].push(c);
    });
    return map;
  }, [citas]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goToday = () => {
    const ws = getWeekStart(today);
    setWeekStart(ws);
    setCalMonth(today.getMonth());
    setCalYear(today.getFullYear());
  };

  const goPrevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
    setCalMonth(d.getMonth());
    setCalYear(d.getFullYear());
  };

  const goNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
    setCalMonth(d.getMonth());
    setCalYear(d.getFullYear());
  };

  const goPrevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };

  const goNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const weekLabel = () => {
    const end = weekDays[6];
    if (weekStart.getMonth() === end.getMonth())
      return `${weekStart.getDate()}–${end.getDate()} de ${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
    return `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()].slice(0,3)} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0,3)} ${end.getFullYear()}`;
  };

  // ── Mini calendar ───────────────────────────────────────────────────────────

  const daysInMonth = useMemo(() => new Date(calYear, calMonth + 1, 0).getDate(), [calYear, calMonth]);
  const firstDayMon = useMemo(() => {
    const d = new Date(calYear, calMonth, 1).getDay();
    return d === 0 ? 6 : d - 1; // Monday = 0
  }, [calYear, calMonth]);

  const renderMiniCal = () => {
    const cells = [];
    DAY_LABELS_MX.forEach((l, i) => cells.push(
      <div key={`h${i}`} style={{ textAlign: "center", fontSize: 10, color: "#9ca3af", fontWeight: 600, padding: "2px 0" }}>{l}</div>
    ));
    for (let i = 0; i < firstDayMon; i++) cells.push(<div key={`e${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const k = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
      const inWeek = weekDays.some(w => dateKey(w) === k);
      const hasCitas = !!citasByDay[k]?.length;
      cells.push(
        <button
          key={d}
          onClick={() => { const cl = new Date(calYear, calMonth, d); setWeekStart(getWeekStart(cl)); }}
          style={{
            width: 28, height: 28, borderRadius: "50%", border: "none", margin: "1px auto",
            background: isToday ? "#2C4A8C" : inWeek ? "#eff6ff" : "transparent",
            color: isToday ? "#fff" : inWeek ? "#2C4A8C" : "#374151",
            fontSize: 11, fontWeight: isToday ? 700 : 400,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}
        >
          {d}
          {hasCitas && !isToday && (
            <span style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: inWeek ? "#2C4A8C" : "#94a3b8" }} />
          )}
        </button>
      );
    }
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>{cells}</div>;
  };

  // ── Week view ───────────────────────────────────────────────────────────────

  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  const renderWeekView = () => (
    <div style={{ flex: 1, overflow: "auto", position: "relative", minWidth: 0 }}>
      {/* Day header row */}
      <div style={{
        display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)",
        borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, background: "#fff", zIndex: 10,
      }}>
        <div style={{ borderRight: "1px solid #f3f4f6" }} />
        {weekDays.map((d, i) => {
          const isToday = dateKey(d) === dateKey(today);
          return (
            <div key={i} style={{ textAlign: "center", padding: "6px 4px 8px", borderRight: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
                {DAY_LABELS[d.getDay()]}
              </div>
              <div style={{
                width: 34, height: 34, borderRadius: "50%", margin: "0 auto",
                background: isToday ? "#2C4A8C" : "transparent",
                color: isToday ? "#fff" : "#111827",
                fontSize: 17, fontWeight: isToday ? 700 : 400,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid body */}
      <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)" }}>
        {/* Hour labels */}
        <div style={{ borderRight: "1px solid #f3f4f6" }}>
          {hours.map(h => (
            <div key={h} style={{ height: HOUR_H, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 8, paddingTop: 4 }}>
              <span style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 0.5 }}>{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day, di) => {
          const k = dateKey(day);
          const dayCitas = citasByDay[k] || [];
          const isToday = k === dateKey(today);
          return (
            <div key={di} style={{ position: "relative", borderRight: "1px solid #f3f4f6" }}>
              {hours.map(h => (
                <div key={h} style={{
                  height: HOUR_H, borderBottom: "1px solid #f3f4f6",
                  background: isToday ? "#fafbff" : "transparent",
                }} />
              ))}
              {/* Current time line */}
              {isToday && (() => {
                const now = new Date();
                const top = (now.getHours() - HOUR_START + now.getMinutes() / 60) * HOUR_H;
                if (top < 0 || top > (HOUR_END - HOUR_START) * HOUR_H) return null;
                return (
                  <div style={{ position: "absolute", left: 0, right: 0, top, zIndex: 5, display: "flex", alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2C4A8C", flexShrink: 0, marginLeft: -1 }} />
                    <div style={{ flex: 1, height: 2, background: "#2C4A8C" }} />
                  </div>
                );
              })()}
              {/* Events */}
              {dayCitas.map((cita) => {
                if (!cita.hora) return null;
                const [hh, mm] = cita.hora.split(":").map(Number);
                const top = (hh - HOUR_START + mm / 60) * HOUR_H;
                if (top < 0) return null;
                const duration = cita.duracion || 60;
                const height = Math.max((duration / 60) * HOUR_H - 3, 22);
                const tipo = cita.tipo || "asesoria";
                const colors = TIPO_COLOR[tipo] || TIPO_COLOR.asesoria;
                return (
                  <button
                    key={cita.id}
                    onClick={() => setSelectedCita(cita)}
                    style={{
                      position: "absolute", top: top + 1, left: 2, right: 2, height,
                      background: colors.bg, border: `1px solid ${colors.border}`,
                      borderLeft: `3px solid ${colors.border}`, borderRadius: 4,
                      padding: "2px 5px", textAlign: "left", cursor: "pointer",
                      overflow: "hidden", zIndex: 2,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>
                      {cita.leads?.nombre || "Sin nombre"}
                    </div>
                    {height > 34 && (
                      <div style={{ fontSize: 10, color: colors.text, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cita.hora?.slice(0, 5)} · {TIPO_LABEL[cita.tipo] || cita.tipo}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Month view ──────────────────────────────────────────────────────────────

  const renderMonthView = () => {
    const year = weekStart.getFullYear();
    const month = weekStart.getMonth();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const totalCells = Math.ceil((startOffset + daysCount) / 7) * 7;

    return (
      <div style={{ flex: 1, overflow: "auto", padding: "0 0 16px" }}>
        {/* Weekday header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #e5e7eb" }}>
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(l => (
            <div key={l} style={{ textAlign: "center", fontSize: 10, color: "#9ca3af", letterSpacing: 1.5, padding: "8px 0", fontWeight: 600, textTransform: "uppercase" }}>{l}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {Array.from({ length: totalCells }, (_, idx) => {
            const dayNum = idx - startOffset + 1;
            if (dayNum < 1 || dayNum > daysCount) {
              return <div key={idx} style={{ minHeight: 90, borderRight: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }} />;
            }
            const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const isToday = dayNum === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayCitas = citasByDay[k] || [];
            return (
              <div key={idx} style={{ minHeight: 90, borderRight: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", padding: "4px 4px 6px", background: isToday ? "#fafbff" : "#fff" }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 26, height: 26, borderRadius: "50%",
                    background: isToday ? "#2C4A8C" : "transparent",
                    color: isToday ? "#fff" : "#374151",
                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                  }}>{dayNum}</span>
                </div>
                {dayCitas.slice(0, 3).map(cita => {
                  const tipo = cita.tipo || "asesoria";
                  const colors = TIPO_COLOR[tipo] || TIPO_COLOR.asesoria;
                  return (
                    <button
                      key={cita.id}
                      onClick={() => setSelectedCita(cita)}
                      style={{
                        display: "block", width: "100%", marginBottom: 2,
                        background: colors.bg, border: `none`, borderLeft: `3px solid ${colors.border}`,
                        borderRadius: 3, padding: "1px 5px", cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 10, color: colors.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                        {cita.hora?.slice(0, 5)} {cita.leads?.nombre || "—"}
                      </span>
                    </button>
                  );
                })}
                {dayCitas.length > 3 && (
                  <div style={{ fontSize: 10, color: "#94a3b8", paddingLeft: 4 }}>+{dayCitas.length - 3} más</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Month view navigation label ─────────────────────────────────────────────

  const monthViewLabel = () => `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  const goPrevMonth_main = () => {
    const d = new Date(weekStart);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    setWeekStart(d);
    setCalMonth(d.getMonth());
    setCalYear(d.getFullYear());
  };

  const goNextMonth_main = () => {
    const d = new Date(weekStart);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    setWeekStart(d);
    setCalMonth(d.getMonth());
    setCalYear(d.getFullYear());
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      display: "flex", flexDirection: "column",
      flex: 1, minHeight: 0, overflow: "hidden",
      fontFamily: "'DM Mono', monospace",
    }}>

      {/* ── Top toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        <button
          onClick={() => setShowCitaForm(true)}
          style={{
            background: "#2C4A8C", color: "#fff", border: "none", borderRadius: 20,
            padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            letterSpacing: 0.5, whiteSpace: "nowrap", fontFamily: "inherit",
          }}
        >
          + Nueva cita
        </button>

        <button
          onClick={view === "semana" ? goToday : () => { const ws = getWeekStart(today); setWeekStart(ws); setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); }}
          style={{
            padding: "5px 14px", border: "1px solid #e5e7eb", borderRadius: 6,
            background: "#fff", fontSize: 12, color: "#374151", cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Hoy
        </button>

        <div style={{ display: "flex", gap: 2 }}>
          <button
            onClick={view === "semana" ? goPrevWeek : goPrevMonth_main}
            style={{ padding: "5px 10px", border: "1px solid #e5e7eb", borderRadius: "6px 0 0 6px", background: "#fff", fontSize: 16, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}
          >‹</button>
          <button
            onClick={view === "semana" ? goNextWeek : goNextMonth_main}
            style={{ padding: "5px 10px", border: "1px solid #e5e7eb", borderLeft: "none", borderRadius: "0 6px 6px 0", background: "#fff", fontSize: 16, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}
          >›</button>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", flex: 1 }}>
          {view === "semana" ? weekLabel() : monthViewLabel()}
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
          {[{ v: "semana", l: "Semana" }, { v: "mes", l: "Mes" }].map(({ v, l }) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "5px 14px", border: "none", fontSize: 11, cursor: "pointer",
              background: view === v ? "#2C4A8C" : "#fff",
              color: view === v ? "#fff" : "#374151",
              fontFamily: "inherit",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left sidebar — mini calendar */}
        <div style={{ width: 216, borderRight: "1px solid #e5e7eb", padding: "14px 12px", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              {MONTH_NAMES[calMonth].slice(0, 3)} {calYear}
            </span>
            <div style={{ display: "flex" }}>
              <button onClick={goPrevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: "0 4px", lineHeight: 1 }}>‹</button>
              <button onClick={goNextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: "0 4px", lineHeight: 1 }}>›</button>
            </div>
          </div>
          {renderMiniCal()}

          {/* Legend */}
          <div style={{ marginTop: 20, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
            <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, marginBottom: 10, fontWeight: 600 }}>TIPOS DE CITA</div>
            {Object.entries(TIPO_LABEL).map(([k, label]) => {
              const c = TIPO_COLOR[k];
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c.border, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
                </div>
              );
            })}
          </div>

          {/* Upcoming appointments */}
          {(() => {
            const upcoming = citas
              .filter(c => c.fecha && c.fecha >= dateKey(today))
              .sort((a, b) => (a.fecha + a.hora) > (b.fecha + b.hora) ? 1 : -1)
              .slice(0, 4);
            if (!upcoming.length) return null;
            return (
              <div style={{ marginTop: 16, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, marginBottom: 10, fontWeight: 600 }}>PRÓXIMAS CITAS</div>
                {upcoming.map(cita => {
                  const c = TIPO_COLOR[cita.tipo] || TIPO_COLOR.asesoria;
                  return (
                    <button
                      key={cita.id}
                      onClick={() => setSelectedCita(cita)}
                      style={{
                        display: "block", width: "100%", textAlign: "left", marginBottom: 8,
                        background: c.bg, borderLeft: `3px solid ${c.border}`,
                        border: `1px solid ${c.border}`, borderRadius: 5,
                        padding: "5px 8px", cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cita.leads?.nombre || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: c.text, opacity: 0.7 }}>
                        {cita.fecha?.slice(5).replace("-", "/")} {cita.hora?.slice(0, 5)}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Main view */}
        {view === "semana" ? renderWeekView() : renderMonthView()}
      </div>

      {/* ── Cita detail modal ── */}
      {selectedCita && (
        <div
          onClick={() => setSelectedCita(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", fontFamily: "'DM Mono', monospace" }}
          >
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 3 }}>
                  {selectedCita.leads?.nombre || "Sin nombre"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {(() => {
                    const c = TIPO_COLOR[selectedCita.tipo] || TIPO_COLOR.asesoria;
                    return (
                      <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 999, padding: "2px 10px", fontSize: 10, fontWeight: 600 }}>
                        {TIPO_LABEL[selectedCita.tipo] || selectedCita.tipo}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button onClick={() => setSelectedCita(null)} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
            </div>

            {/* Info rows */}
            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              {[
                { label: "Programa", value: selectedCita.leads?.curso },
                { label: "Fecha", value: selectedCita.fecha ? (() => { const [y,m,d] = selectedCita.fecha.split("-"); return `${parseInt(d)} de ${MONTH_NAMES[parseInt(m)-1]} ${y}`; })() : null },
                { label: "Hora", value: selectedCita.hora?.slice(0, 5) },
                { label: "Duración", value: selectedCita.duracion ? `${selectedCita.duracion} min` : null },
                { label: "Email", value: selectedCita.leads?.email },
                { label: "WhatsApp", value: selectedCita.leads?.whatsapp },
              ].filter(r => r.value).map(row => (
                <div key={row.label} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <span style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, minWidth: 70, flexShrink: 0 }}>{row.label.toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: "#374151" }}>{row.value}</span>
                </div>
              ))}
              {selectedCita.notas && (
                <div>
                  <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, marginBottom: 4 }}>NOTAS</div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-line", background: "#f8fafc", padding: "8px 12px", borderRadius: 6 }}>
                    {selectedCita.notas}
                  </div>
                </div>
              )}
            </div>

            {/* Status selector */}
            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, marginBottom: 10 }}>ESTADO</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["pendiente", "confirmada", "completada", "cancelada"].map(status => {
                  const active = selectedCita.status === status;
                  const palette = {
                    pendiente:  { bg: "#fef9c3", border: "#ca8a04", text: "#854d0e" },
                    confirmada: { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" },
                    completada: { bg: "#dcfce7", border: "#16a34a", text: "#15803d" },
                    cancelada:  { bg: "#fee2e2", border: "#dc2626", text: "#991b1b" },
                  }[status];
                  return (
                    <button
                      key={status}
                      onClick={() => { updateCitaStatus(selectedCita.id, status); setSelectedCita({ ...selectedCita, status }); }}
                      style={{
                        padding: "4px 14px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                        fontFamily: "inherit", fontWeight: active ? 700 : 400,
                        background: active ? palette.bg : "#f8fafc",
                        border: `1px solid ${active ? palette.border : "#e5e7eb"}`,
                        color: active ? palette.text : "#6b7280",
                      }}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
