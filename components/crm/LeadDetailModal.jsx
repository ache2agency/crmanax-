"use client";
import { useState, useRef } from "react";


export default function LeadDetailModal({
  lead,
  stage,
  isAdmin,
  vendedores,
  lofts = [],
  getNombreVendedor,
  reasignarLead,
  STAGES,
  moveStage,
  setSelectedLead,
  updateNotas,
  updateLeadField,
  goToConversation,
  activeConversation,
  getLeadNextStep,
  leadTimelineLoading,
  leadTimeline,
  setShowCitaForm,
  setNuevaCita,
  deleteLead,
}) {
  const [editingInfo, setEditingInfo] = useState(false);
  const [localNotas, setLocalNotas] = useState(lead.notas || "");
  const [notasSaved, setNotasSaved] = useState(true);
  const notasSaveTimer = useRef(null);
  const [draft, setDraft] = useState({
    nombre: lead.nombre || "",
    email: lead.email || "",
    whatsapp: lead.whatsapp || "",
    tipo_renta: lead.tipo_renta || "noche",
    fecha_checkin: lead.fecha_checkin || "",
    fecha_checkout: lead.fecha_checkout || "",
    num_personas: lead.num_personas || 1,
    loft_id: lead.loft_id || "",
    presupuesto: lead.presupuesto || "",
    valor: lead.valor || 0,
    deposito_monto: lead.deposito_monto || 0,
    deposito_pagado: lead.deposito_pagado || false,
    deposito_devuelto: lead.deposito_devuelto || false,
    yale_email: lead.yale_email || "",
    id_recibida: lead.id_recibida || false,
    docs_recibidos: lead.docs_recibidos || false,
  });

  const currentStageId = stage?.id || lead.stage;
  const loftActual = lofts.find((l) => l.id === (lead.loft_id || draft.loft_id));

  const saveInfo = async () => {
    const textFields = ["nombre", "email", "whatsapp", "tipo_renta", "fecha_checkin", "fecha_checkout", "presupuesto", "yale_email", "loft_id"];
    const numFields = ["valor", "num_personas", "deposito_monto"];
    const boolFields = ["deposito_pagado", "deposito_devuelto", "id_recibida", "docs_recibidos"];
    for (const f of textFields) {
      if (draft[f] !== lead[f]) await updateLeadField(lead.id, f, draft[f] || null);
    }
    for (const f of numFields) {
      if (Number(draft[f]) !== Number(lead[f])) await updateLeadField(lead.id, f, Number(draft[f]));
    }
    for (const f of boolFields) {
      if (draft[f] !== lead[f]) await updateLeadField(lead.id, f, draft[f]);
    }
    setSelectedLead(prev => ({ ...prev, ...draft, valor: Number(draft.valor), num_personas: Number(draft.num_personas), deposito_monto: Number(draft.deposito_monto) }));
    setEditingInfo(false);
  };

  const fieldStyle = {
    background: "#1e1e1e", border: "1px solid #333", borderRadius: 6,
    color: "#e0e0e0", fontFamily: "inherit", fontSize: 12,
    padding: "7px 10px", width: "100%", outline: "none", boxSizing: "border-box",
  };

  return (
    <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "24px 24px 0" }}>

          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ flex: 1, marginRight: 12 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: "#e8e8e8", letterSpacing: 1 }}>{lead.nombre || lead.whatsapp}</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{lead.email} • {lead.whatsapp}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {isAdmin && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "4px 10px", color: "#E8A838", border: "1px solid #E8A83844" }}
                  onClick={() => { setDraft({ nombre: lead.nombre || "", email: lead.email || "", whatsapp: lead.whatsapp || "", zona: lead.zona || "", presupuesto: lead.presupuesto || "", cuartos: lead.cuartos || "", valor: lead.valor || 0 }); setEditingInfo(true); }}
                >
                  ✏️ Editar info
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setSelectedLead(null)}>✕</button>
            </div>
          </div>

          {/* PANEL EDICIÓN */}
          {editingInfo && isAdmin && (
            <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#E8A838", letterSpacing: 1.5, marginBottom: 14, fontWeight: 600 }}>EDITAR INFORMACIÓN</div>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  { label: "NOMBRE", key: "nombre", placeholder: "Nombre completo" },
                  { label: "EMAIL", key: "email", placeholder: "correo@email.com" },
                  { label: "WHATSAPP", key: "whatsapp", placeholder: "+52 747 XXX XXXX" },
                  { label: "PRESUPUESTO ($)", key: "presupuesto", placeholder: "Ej. 15000" },
                  { label: "RENTA / VALOR ($)", key: "valor", placeholder: "0", type: "number" },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>{f.label}</div>
                    <input style={fieldStyle} type={f.type || "text"} placeholder={f.placeholder} value={draft[f.key]} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>TIPO DE RENTA</div>
                  <select style={{ ...fieldStyle, cursor: "pointer" }} value={draft.tipo_renta} onChange={e => setDraft(p => ({ ...p, tipo_renta: e.target.value }))}>
                    <option value="noche">Por noche</option>
                    <option value="mes">Por mes</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>CHECK-IN</div>
                    <input style={fieldStyle} type="date" value={draft.fecha_checkin} onChange={e => setDraft(p => ({ ...p, fecha_checkin: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>CHECK-OUT</div>
                    <input style={fieldStyle} type="date" value={draft.fecha_checkout} onChange={e => setDraft(p => ({ ...p, fecha_checkout: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>NO. PERSONAS</div>
                    <input style={fieldStyle} type="number" min={1} max={10} value={draft.num_personas} onChange={e => setDraft(p => ({ ...p, num_personas: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>LOFT</div>
                    <select style={{ ...fieldStyle, cursor: "pointer" }} value={draft.loft_id} onChange={e => setDraft(p => ({ ...p, loft_id: e.target.value }))}>
                      <option value="">Sin asignar</option>
                      {lofts.map(l => <option key={l.id} value={l.id}>{l.nombre}{l.tipo ? ` (${l.tipo})` : ""}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>DEPÓSITO EN GARANTÍA ($)</div>
                  <input style={fieldStyle} type="number" value={draft.deposito_monto} onChange={e => setDraft(p => ({ ...p, deposito_monto: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>EMAIL YALE CONNECT</div>
                  <input style={fieldStyle} type="email" placeholder="email del huésped en Yale Connect" value={draft.yale_email} onChange={e => setDraft(p => ({ ...p, yale_email: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { key: "deposito_pagado",  label: "Depósito pagado" },
                    { key: "deposito_devuelto",label: "Depósito devuelto" },
                    { key: "id_recibida",      label: "ID recibida" },
                    { key: "docs_recibidos",   label: "Docs recibidos" },
                  ].map(f => (
                    <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "#ccc" }}>
                      <input type="checkbox" checked={!!draft[f.key]} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.checked }))} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditingInfo(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveInfo}>Guardar cambios</button>
              </div>
            </div>
          )}

          {/* DATOS DE RESERVA */}
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 12 }}>DATOS DE RESERVA</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>Tipo</div>
                <div style={{ fontSize: 12, color: "#e0e0e0", textTransform: "capitalize" }}>{lead.tipo_renta || "noche"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>Loft</div>
                <div style={{ fontSize: 12, color: "#e0e0e0" }}>{loftActual?.nombre || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>Check-in</div>
                <div style={{ fontSize: 12, color: "#e0e0e0" }}>{lead.fecha_checkin || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>Check-out</div>
                <div style={{ fontSize: 12, color: "#e0e0e0" }}>{lead.fecha_checkout || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>Personas</div>
                <div style={{ fontSize: 12, color: "#e0e0e0" }}>{lead.num_personas || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>Renta</div>
                <div style={{ fontSize: 14, color: stage?.color, fontFamily: "'Bebas Neue'" }}>{`$${Number(lead.valor || 0).toLocaleString("es-MX")}`}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>Depósito</div>
                <div style={{ fontSize: 12, color: lead.deposito_pagado ? "#27AE60" : "#e0e0e0" }}>
                  {`$${Number(lead.deposito_monto || 0).toLocaleString("es-MX")}`}
                  {lead.deposito_pagado && <span style={{ marginLeft: 6, fontSize: 10, color: "#27AE60" }}>✓ pagado</span>}
                  {lead.deposito_devuelto && <span style={{ marginLeft: 6, fontSize: 10, color: "#8ac0ff" }}>✓ devuelto</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 4 }}>Checklist</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {[
                    { label: "ID", ok: lead.id_recibida },
                    { label: "Docs", ok: lead.docs_recibidos },
                    { label: "Yale", ok: !!lead.yale_email },
                  ].map(c => (
                    <span key={c.label} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: c.ok ? "#1a3a1a" : "#2a2a2a", color: c.ok ? "#27AE60" : "#555", border: `1px solid ${c.ok ? "#27AE6044" : "#333"}` }}>
                      {c.ok ? "✓" : "○"} {c.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#131313", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 8 }}>SIGUIENTE PASO</div>
              <div style={{ fontSize: 12, color: "#e0e0e0", lineHeight: 1.6 }}>{getLeadNextStep(lead)}</div>
            </div>
            <div style={{ background: "#131313", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 8 }}>ULTIMA ACTIVIDAD</div>
              {leadTimelineLoading ? (
                <div style={{ fontSize: 12, color: "#777" }}>Cargando actividad...</div>
              ) : leadTimeline[0] ? (
                <>
                  <div style={{ fontSize: 12, color: "#e0e0e0" }}>{leadTimeline[0].title}</div>
                  <div style={{ fontSize: 11, color: "#777", marginTop: 4, lineHeight: 1.5 }}>{leadTimeline[0].detail}</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: "#777" }}>Sin actividad reciente registrada.</div>
              )}
            </div>
          </div>

          {isAdmin ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 8 }}>ASIGNADO A</div>
              <select className="select" value={lead.asignado_a || ""} onChange={(e) => reasignarLead(lead.id, e.target.value)}>
                <option value="">Sin asignar</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.nombre || v.email} {v.rol === "admin" ? "(admin)" : ""}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ marginBottom: 20, background: "#1a1a1a", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 4 }}>ASIGNADO A</div>
              <div style={{ fontSize: 13, color: "#e0e0e0" }}>{getNombreVendedor(lead.asignado_a)}</div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 8 }}>MOVER A ETAPA</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  className="btn"
                  style={{ background: currentStageId === s.id ? s.color : s.color + "18", color: currentStageId === s.id ? "#0e0e0e" : s.color, border: `1px solid ${s.color}44`, padding: "5px 10px", fontSize: 11 }}
                  onClick={() => { moveStage(lead.id, s.id); setSelectedLead({ ...lead, stage: s.id }); }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1 }}>NOTAS</div>
              <div style={{ fontSize: 10, color: notasSaved ? "#27AE60" : "#E8A838" }}>
                {notasSaved ? "✓ Guardado" : "Sin guardar…"}
              </div>
            </div>
            <textarea
              className="input"
              style={{ fontSize: 12, lineHeight: 1.5 }}
              value={localNotas}
              onChange={(e) => {
                const v = e.target.value;
                setLocalNotas(v);
                setNotasSaved(false);
                clearTimeout(notasSaveTimer.current);
                notasSaveTimer.current = setTimeout(async () => {
                  await updateNotas(lead.id, v);
                  setSelectedLead(prev => ({ ...prev, notas: v }));
                  setNotasSaved(true);
                }, 1200);
              }}
              onBlur={async () => {
                if (!notasSaved) {
                  clearTimeout(notasSaveTimer.current);
                  await updateNotas(lead.id, localNotas);
                  setSelectedLead(prev => ({ ...prev, notas: localNotas }));
                  setNotasSaved(true);
                }
              }}
              placeholder="Agrega notas sobre este lead..."
            />
          </div>

          <div style={{ marginBottom: 20, background: "#131313", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 10 }}>TIMELINE</div>
            {leadTimelineLoading ? (
              <div style={{ fontSize: 12, color: "#777" }}>Cargando timeline...</div>
            ) : leadTimeline.length === 0 ? (
              <div style={{ fontSize: 12, color: "#777" }}>Todavia no hay eventos de seguimiento para este lead.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {leadTimeline.map((item) => (
                  <div key={item.id} style={{ display: "grid", gridTemplateColumns: "8px 1fr", gap: 8, alignItems: "start" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.tone, marginTop: 4, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                        <div style={{ fontSize: 12, color: "#e0e0e0", fontWeight: 500 }}>{item.title}</div>
                        <div style={{ fontSize: 10, color: "#444", flexShrink: 0 }}>{item.date ? new Date(item.date).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</div>
                      </div>
                      {item.detail && (
                        <div style={{ fontSize: 11, color: "#666", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(() => {
            const fase = activeConversation?.fase || null;
            const modoHumano = activeConversation?.modo_humano || false;
            const FASES = {
              saludo:        { label: "Saludo",                color: "#6b7280", accion: "El bot está iniciando contacto. No se requiere intervención aún." },
              programa:      { label: "Identificando programa",color: "#6b7280", accion: "El bot está identificando el programa de interés. Monitorear." },
              correo:        { label: "Solicitando correo",    color: "#6b7280", accion: "El bot está solicitando el correo del prospecto. Monitorear." },
              info_enviada:  { label: "Info enviada",          color: "#2563eb", accion: "El bot ya envió la información del programa. Esperar respuesta del lead." },
              accion:        { label: "Esperando decisión",    color: "#d97706", accion: "El bot presentó opciones A/B al lead. Esperar su elección." },
              dudas:         { label: "Resolviendo dudas",     color: "#7c3aed", accion: "El lead tiene dudas activas. Considera tomar control para cerrar personalmente." },
              inscripcion:   { label: "Quiere inscribirse",    color: "#15803d", accion: "⚡ El lead quiere inscribirse. Toma control y cierra la inscripción ahora." },
              clase_prueba:  { label: "Clase prueba agendada", color: "#0891b2", accion: "⚡ El lead agendó clase de prueba. Confirma la cita y da seguimiento." },
              examen:        { label: "Examen de ubicación",   color: "#0891b2", accion: "El lead fue enviado a realizar su examen de ubicación." },
              asesor:        { label: "Pidió asesor humano",   color: "#dc2626", accion: "🚨 El lead pidió hablar con un asesor. Toma control y contáctalo ahora." },
              seguimiento:   { label: "En seguimiento",        color: "#9ca3af", accion: "El bot está en seguimiento automático. Intervenir si no responde en 48h." },
              cerrado:       { label: "Cerrado",               color: "#374151", accion: "Conversación cerrada. Lead procesado." },
              perdido:       { label: "No interesado",         color: "#374151", accion: "El lead indicó que no está interesado." },
            };
            const info = fase ? FASES[fase] : null;
            return (
              <div style={{ marginBottom: 20, background: "#0f172a", border: `1px solid ${modoHumano ? "#E8A83844" : "#25D36633"}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, color: modoHumano ? "#E8A838" : "#25D366", letterSpacing: 1, marginBottom: 10 }}>ESTADO DEL BOT</div>
                {!activeConversation ? (
                  <div style={{ fontSize: 12, color: "#555" }}>Sin conversación de WhatsApp activa.</div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ background: (info?.color || "#555") + "22", color: info?.color || "#555", border: `1px solid ${info?.color || "#555"}44`, borderRadius: 20, fontSize: 11, padding: "3px 10px", fontWeight: 600 }}>
                        {info?.label || fase || "Desconocida"}
                      </span>
                      {modoHumano && (
                        <span style={{ background: "#E8A83822", color: "#E8A838", border: "1px solid #E8A83844", borderRadius: 20, fontSize: 10, padding: "3px 8px" }}>
                          MODO HUMANO
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6, marginBottom: 12 }}>
                      {info?.accion || "Monitorear la conversación."}
                    </div>
                  </>
                )}
                {activeConversation && (
                  <button className="btn btn-wa" style={{ fontSize: 12, padding: "7px 14px" }} onClick={() => goToConversation(lead)}>
                    💬 Ver conversación
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #222", display: "flex", justifyContent: "space-between" }}>
          <button
            className="btn"
            style={{ background: "#1a1a1a", color: "#E8A838", border: "1px solid #E8A83844", padding: "8px 16px", fontSize: 12 }}
            onClick={() => { setShowCitaForm(true); setNuevaCita((prev) => ({ ...prev, lead_id: lead.id })); }}
          >
            Agendar cita
          </button>
          {isAdmin && (
            <button
              className="btn"
              style={{ background: "#2a0d0d", color: "#E85D38", border: "1px solid #E85D3844", padding: "8px 16px", fontSize: 12 }}
              onClick={() => deleteLead(lead.id)}
            >
              Eliminar lead
            </button>
          )}
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setSelectedLead(null)}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
