"use client";

import { fuenteVieja } from "@/lib/reservas/conflictos";

function hace(fecha, now) {
  if (!fecha) return "sin éxito conocido";
  return `hace ${Math.max(0, Math.floor((now.getTime() - new Date(fecha).getTime()) / 60000))} min`;
}

export default function EstadoDisponibilidad({ monitor, now }) {
  const lofts = monitor?.lofts || [];
  const estados = monitor?.estados || [];
  const excel = estados.find(s => s.origen === "excel");
  const feeds = lofts.map(l => ({ ...l, estado: estados.find(s => s.loft_id === l.id && s.origen === "airbnb_ical") }));
  const fallidos = feeds.filter(f => !f.estado?.ultimo_intento_ok);
  const viejos = feeds.filter(f => fuenteVieja(f.estado?.ultimo_exito_at, now));
  const vieja = !monitor || fuenteVieja(excel?.ultimo_exito_at, now) || viejos.length > 0;
  const fechas = feeds.map(f => f.estado?.ultimo_exito_at).filter(Boolean).sort();
  const rojos = (monitor?.conflictos || []).filter(c => c.tipo !== "solo_airbnb");
  const amarillos = (monitor?.conflictos || []).filter(c => c.tipo === "solo_airbnb");
  const nombre = id => lofts.find(l => l.id === id)?.nombre || "Loft";
  const lista = rows => <ul>{rows.map(c => <li key={c.id}>{nombre(c.loft_id)}: {c.fecha_inicio} → {c.fecha_fin} · {c.detalle}</li>)}</ul>;
  return <div style={{ padding: "10px 16px", fontSize: 12, borderBottom: "1px solid #e5e7eb", maxHeight: 250, overflowY: "auto", flexShrink: 0 }}>
    <div style={{ color: vieja ? "#991b1b" : "#374151", background: vieja ? "#fef2f2" : "transparent", padding: 6 }} role={vieja ? "alert" : undefined}>
      Excel actualizado {hace(excel?.ultimo_exito_at, now)} · Airbnb {hace(fechas.length === feeds.length ? fechas[0] : null, now)}
      <div>{feeds.length - fallidos.length}/{feeds.length} feeds OK{fallidos.length > 0 ? ` · Falló/sin configurar: ${fallidos.map(f => f.nombre).join(", ")}` : ""}</div>
      {vieja && <strong>⚠️ Datos sin actualizar en más de 2 h o sin éxito conocido. Confirmar con el asesor.{viejos.length > 0 ? ` Airbnb: ${viejos.map(f => f.nombre).join(", ")}.` : ""}</strong>}
    </div>
    {rojos.length > 0 && <div style={{ color: "#991b1b" }}><strong>⚠️ {rojos.length} conflictos</strong>{lista(rojos)}<div>Fechas de salida exclusivas. Los bordes rojos marcan días afectados.</div></div>}
    {amarillos.length > 0 && <details style={{ color: "#92400e", marginTop: 8 }}><summary>{amarillos.length} bloqueos solo en Airbnb (informativo)</summary>{lista(amarillos)}</details>}
  </div>;
}
