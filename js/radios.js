// ================================================================
// radios.js — Interfaz operativa de la Migracion 39
// ================================================================

let radioWorkspace = null;
let radioEditorActual = null;
let radioGuardando = false;

function radioEsc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
}

function radioFechaLocalInput() {
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
}

function radioEstadoEstilo(estado) {
    return ({
        ASIGNADO: 'background:#dcfce7;color:#166534',
        BODEGA: 'background:#e2e8f0;color:#334155',
        MANTENIMIENTO: 'background:#ede9fe;color:#6d28d9',
        PERDIDO: 'background:#fee2e2;color:#b91c1c'
    })[String(estado || '').toUpperCase()] || 'background:#f1f5f9;color:#475569';
}

function mapearRadioWorkspace(r) {
    return {
        id: r.id,
        provinciaId: r.province_id == null ? '' : String(r.province_id),
        proyectoId: r.project_id || '',
        puestoId: r.post_id || '',
        provincia: String(r.province || '').toUpperCase().trim(),
        proyecto: r.project || '',
        puesto: r.post || '',
        modelo: r.model || '',
        serie: r.serial_number || '',
        estado: r.state || '',
        observacion: r.observation || '',
        actualizado: r.updated_at || ''
    };
}

async function cargarWorkspaceRadios() {
    if (!backendUsaSupabase()) return null;
    let workspace = null;
    let ultimoError = null;
    for (let intento = 1; intento <= 3; intento++) {
        try {
            workspace = await supabaseRpc('get_radio_management_workspace');
            break;
        } catch (error) {
            ultimoError = error;
            const falloRed = /failed to fetch|networkerror|load failed/i.test(String(error?.message || error));
            if (!falloRed || intento === 3) break;
            if (intento === 1 && typeof supabaseRenovarSesion === 'function') {
                try { await supabaseRenovarSesion(); } catch (_) { /* el siguiente intento conserva el error original */ }
            }
            await new Promise(resolve => setTimeout(resolve, 500 * intento));
        }
    }
    if (!workspace) {
        const error = new Error(`NO SE PUDO CONECTAR CON SUPABASE DESPUÉS DE 3 INTENTOS. ${ultimoError?.message || ultimoError || ''}`.trim());
        error.cause = ultimoError;
        throw error;
    }
    if (!workspace || workspace.schema_version !== 1) throw new Error('CONTRATO DE RADIOS INCOMPATIBLE.');
    radioWorkspace = workspace;
    radiosDetalle = (workspace.radios || []).map(mapearRadioWorkspace);
    return workspace;
}

async function abrirModalRadios() {
    if (typeof usuarioPuedeVerRadiosDetalle === 'function' && !usuarioPuedeVerRadiosDetalle()) {
        alert('TU PERFIL NO TIENE PERMISO PARA VER EL DETALLE DE RADIOS.');
        return;
    }
    filtrosRadios = { provincia: [], proyecto: [] };
    busquedaRadios = '';
    document.getElementById('radios-modal').style.display = 'flex';
    const buscador = document.getElementById('radios-buscador');
    if (buscador) buscador.value = '';
    document.getElementById('radios-modal-contador').textContent = 'Cargando radios…';
    try {
        if (backendUsaSupabase() && usuarioPuedeGestionarRadios()) await cargarWorkspaceRadios();
        renderFiltrosRadios();
        renderTablaRadios();
        aplicarPermisosUI();
    } catch (error) {
        console.error(error);
        renderFiltrosRadios();
        renderTablaRadios();
        alert(`NO SE PUDO CARGAR LA GESTIÓN DE RADIOS: ${error.message || error}`);
    }
}

function renderTablaRadios() {
    const filtrados = obtenerRadiosFiltrados();
    document.getElementById('radios-modal-contador').textContent = `${filtrados.length} de ${radiosDetalle.length} radio(s)`;
    const tbody = document.getElementById('radios-tbody');
    const puedeGestionar = typeof usuarioPuedeGestionarRadios === 'function' && usuarioPuedeGestionarRadios();
    if (!filtrados.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="padding:20px;text-align:center;color:#94a3b8;">${radiosDetalle.length ? 'No existen radios con este filtro.' : 'No hay radios registrados en el sistema.'}</td></tr>`;
        return;
    }
    tbody.innerHTML = filtrados.map((r, i) => `
      <tr style="border-bottom:1px solid #f1f5f9;${i % 2 === 0 ? 'background:#f8fafc;' : ''}">
        <td style="padding:7px 8px;color:#94a3b8;">${i + 1}</td>
        <td style="padding:7px 8px;">${radioEsc(r.provincia || '—')}</td>
        <td style="padding:7px 8px;">${radioEsc(r.proyecto || '—')}</td>
        <td style="padding:7px 8px;">${radioEsc(r.puesto || '—')}</td>
        <td style="padding:7px 8px;font-weight:700;">${radioEsc(r.modelo || '—')}</td>
        <td style="padding:7px 8px;font-weight:900;">${radioEsc(r.serie || '—')}</td>
        <td style="padding:7px 8px;"><span style="display:inline-block;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:900;${radioEstadoEstilo(r.estado)}">${radioEsc(r.estado || '—')}</span></td>
        <td style="padding:7px 8px;max-width:190px;font-size:10px;color:#64748b;">${radioEsc(r.observacion || '—')}</td>
        <td style="padding:7px 8px;${puedeGestionar ? '' : 'display:none;'}"><button onclick="abrirFormularioCambioRadio('${radioEsc(r.id || '')}')" style="border:0;border-radius:7px;background:#7c3aed;color:white;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer;">CAMBIAR</button></td>
      </tr>`).join('');
}

function asegurarEditorRadio() {
    let modal = document.getElementById('radio-editor-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'radio-editor-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:18000;background:rgba(15,23,42,.78);align-items:center;justify-content:center;padding:18px';
    modal.innerHTML = '<div id="radio-editor-card" style="width:100%;max-width:720px;max-height:92vh;overflow:auto;background:#f8fafc;border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.45)"></div>';
    document.body.appendChild(modal);
    return modal;
}

function radiosProvincias() {
    const mapa = new Map();
    (radioWorkspace?.projects || []).forEach(p => mapa.set(String(p.province_id), p.province));
    (radiosDetalle || []).forEach(r => { if (r.provinciaId && r.provincia) mapa.set(String(r.provinciaId), r.provincia); });
    return [...mapa].map(([id, nombre]) => ({ id, nombre })).sort((a,b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function radioOpciones(lista, valor, etiqueta) {
    return `<option value="">${etiqueta}</option>` + lista.map(x => `<option value="${radioEsc(x.id)}" ${String(x.id) === String(valor || '') ? 'selected' : ''}>${radioEsc(x.nombre || x.name)}</option>`).join('');
}

function abrirFormularioRadioNuevo() {
    if (!usuarioPuedeGestionarRadios()) return alert('NO TIENES PERMISO PARA GESTIONAR RADIOS.');
    radioEditorActual = { modo:'NUEVO', estado:'BODEGA', provinciaId:'', proyectoId:'', puestoId:'' };
    renderFormularioRadio();
}

function abrirFormularioCambioRadio(id) {
    if (!usuarioPuedeGestionarRadios()) return alert('NO TIENES PERMISO PARA GESTIONAR RADIOS.');
    const radio = radiosDetalle.find(r => r.id === id);
    if (!radio) return alert('NO SE ENCONTRÓ EL RADIO. ACTUALIZA LA TABLA.');
    radioEditorActual = { ...radio, modo:'CAMBIO' };
    renderFormularioRadio();
}

function renderFormularioRadio() {
    const modal = asegurarEditorRadio();
    const d = radioEditorActual;
    const nuevo = d.modo === 'NUEVO';
    document.getElementById('radio-editor-card').innerHTML = `
      <div style="background:#0f172a;color:white;padding:14px 17px;display:flex;align-items:center;gap:10px"><div style="flex:1"><h3 style="margin:0;font-size:15px">${nuevo ? '＋ REGISTRAR RADIO' : `📻 RADIO ${radioEsc(d.serie)}`}</h3><p style="margin:3px 0 0;color:#94a3b8;font-size:10px">${nuevo ? 'ALTA EN EL INVENTARIO' : 'CAMBIO AUDITADO DE ESTADO O UBICACIÓN'}</p></div><button onclick="cerrarEditorRadio()" style="border:0;border-radius:8px;background:#334155;color:white;padding:7px 10px;cursor:pointer">✕</button></div>
      <div style="padding:16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <label style="font-size:10px;font-weight:900;color:#475569">SERIE<input id="radio-form-serie" value="${radioEsc(d.serie || '')}" ${nuevo ? '' : 'readonly'} style="width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px"></label>
        <label style="font-size:10px;font-weight:900;color:#475569">MODELO<input id="radio-form-modelo" value="${radioEsc(d.modelo || '')}" ${nuevo ? '' : 'readonly'} style="width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px"></label>
        <label style="font-size:10px;font-weight:900;color:#475569">ESTADO<select id="radio-form-estado" onchange="actualizarUbicacionFormularioRadio()" style="width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px">${(nuevo ? ['BODEGA','ASIGNADO'] : ['ASIGNADO','BODEGA','MANTENIMIENTO','PERDIDO']).map(e => `<option ${e === d.estado ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label style="font-size:10px;font-weight:900;color:#475569">FECHA Y HORA<input id="radio-form-fecha" type="datetime-local" value="${radioFechaLocalInput()}" style="width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px"></label>
        <label style="font-size:10px;font-weight:900;color:#475569">PROVINCIA<select id="radio-form-provincia" onchange="actualizarUbicacionFormularioRadio(true)" style="width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px">${radioOpciones(radiosProvincias(), d.provinciaId, 'SELECCIONA PROVINCIA')}</select></label>
        <label id="radio-form-proyecto-wrap" style="font-size:10px;font-weight:900;color:#475569">PROYECTO<select id="radio-form-proyecto" onchange="actualizarPuestosFormularioRadio()" style="width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px"></select></label>
        <label id="radio-form-puesto-wrap" style="font-size:10px;font-weight:900;color:#475569">PUESTO<select id="radio-form-puesto" style="width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px"></select></label>
        <label style="grid-column:1/-1;font-size:10px;font-weight:900;color:#475569">OBSERVACIÓN<textarea id="radio-form-observacion" rows="3" placeholder="MOTIVO DEL REGISTRO O CAMBIO" style="width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px">${radioEsc(d.observacion || '')}</textarea></label>
      </div>
      <div style="padding:0 16px 16px;display:flex;gap:8px"><button onclick="cerrarEditorRadio()" style="flex:1;border:1px solid #cbd5e1;background:white;border-radius:9px;padding:10px;font-weight:900;cursor:pointer">CANCELAR</button><button id="radio-form-guardar" onclick="guardarFormularioRadio()" style="flex:2;border:0;background:#7c3aed;color:white;border-radius:9px;padding:10px;font-weight:900;cursor:pointer">GUARDAR</button></div>`;
    modal.style.display = 'flex';
    actualizarUbicacionFormularioRadio(false);
}

function actualizarUbicacionFormularioRadio(limpiarProyecto = false) {
    const estado = document.getElementById('radio-form-estado')?.value;
    const provinciaId = document.getElementById('radio-form-provincia')?.value;
    const usaDestino = estado === 'ASIGNADO' || estado === 'PERDIDO';
    document.getElementById('radio-form-proyecto-wrap').style.display = usaDestino ? '' : 'none';
    document.getElementById('radio-form-puesto-wrap').style.display = usaDestino ? '' : 'none';
    const proyectos = (radioWorkspace?.projects || []).filter(p => String(p.province_id) === String(provinciaId));
    const proyecto = document.getElementById('radio-form-proyecto');
    const valor = limpiarProyecto ? '' : (proyecto.value || radioEditorActual?.proyectoId || '');
    proyecto.innerHTML = radioOpciones(proyectos, valor, estado === 'ASIGNADO' ? 'SELECCIONA PROYECTO' : 'SIN PROYECTO / ÚLTIMA UBICACIÓN');
    actualizarPuestosFormularioRadio();
}

function actualizarPuestosFormularioRadio() {
    const proyectoId = document.getElementById('radio-form-proyecto')?.value;
    const proyecto = (radioWorkspace?.projects || []).find(p => p.id === proyectoId);
    const puesto = document.getElementById('radio-form-puesto');
    if (!puesto) return;
    puesto.innerHTML = radioOpciones(proyecto?.posts || [], puesto.value || radioEditorActual?.puestoId || '', 'SELECCIONA PUESTO');
}

function cerrarEditorRadio() {
    const modal = document.getElementById('radio-editor-modal');
    if (modal) modal.style.display = 'none';
    radioEditorActual = null;
}

async function guardarFormularioRadio() {
    if (radioGuardando) return;
    const d = radioEditorActual;
    const estado = document.getElementById('radio-form-estado').value;
    const provincia = document.getElementById('radio-form-provincia').value;
    const proyecto = document.getElementById('radio-form-proyecto').value || null;
    const puesto = document.getElementById('radio-form-puesto').value || null;
    const observacion = document.getElementById('radio-form-observacion').value.trim();
    const fecha = document.getElementById('radio-form-fecha').value;
    if (!provincia) return alert('SELECCIONA LA PROVINCIA.');
    if (estado === 'ASIGNADO' && (!proyecto || !puesto)) return alert('SELECCIONA PROYECTO Y PUESTO.');
    if (observacion.length < 5) return alert('ESCRIBE UNA OBSERVACIÓN DE AL MENOS 5 CARACTERES.');
    if (!fecha) return alert('INDICA LA FECHA Y HORA.');
    radioGuardando = true;
    const boton = document.getElementById('radio-form-guardar');
    boton.disabled = true; boton.textContent = 'GUARDANDO…';
    try {
        const base = {
            p_state: estado,
            p_province_id: Number(provincia),
            p_project_id: ['BODEGA','MANTENIMIENTO'].includes(estado) ? null : proyecto,
            p_post_id: ['BODEGA','MANTENIMIENTO'].includes(estado) ? null : puesto,
            p_observation: observacion,
            p_effective_at: new Date(fecha).toISOString(),
            p_request_id: crypto.randomUUID()
        };
        if (d.modo === 'NUEVO') {
            await supabaseRpc('register_radio', {
                p_serial_number: document.getElementById('radio-form-serie').value.trim(),
                p_model: document.getElementById('radio-form-modelo').value.trim(),
                ...base
            });
        } else {
            const { p_state, ...resto } = base;
            await supabaseRpc('change_radio_status', { p_radio_id: d.id, p_new_state: p_state, ...resto });
        }
        cerrarEditorRadio();
        await cargarWorkspaceRadios();
        renderFiltrosRadios(); renderTablaRadios();
        await cargarDatos({ usarCachePrimero:false });
        alert('RADIO ACTUALIZADO CORRECTAMENTE.');
    } catch (error) {
        alert(`NO SE PUDO GUARDAR EL RADIO: ${error.message || error}`);
    } finally {
        radioGuardando = false;
        if (boton) { boton.disabled = false; boton.textContent = 'GUARDAR'; }
    }
}

function abrirHistorialRadios() {
    if (!usuarioPuedeGestionarRadios()) return alert('NO TIENES PERMISO PARA VER ESTE HISTORIAL.');
    let modal = document.getElementById('radio-historial-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'radio-historial-modal';
        modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:18000;background:rgba(15,23,42,.78);align-items:center;justify-content:center;padding:18px';
        document.body.appendChild(modal);
    }
    const filas = radioWorkspace?.history || [];
    modal.innerHTML = `<div style="width:100%;max-width:1050px;max-height:90vh;overflow:hidden;background:#f8fafc;border-radius:18px;display:flex;flex-direction:column"><div style="background:#0f172a;color:white;padding:14px 17px;display:flex;align-items:center"><div style="flex:1"><h3 style="margin:0">↻ HISTORIAL DE RADIOS</h3><small style="color:#94a3b8">${filas.length} MOVIMIENTO(S)</small></div><button onclick="document.getElementById('radio-historial-modal').style.display='none'" style="border:0;border-radius:8px;background:#334155;color:white;padding:7px 10px;cursor:pointer">✕ CERRAR</button></div><div style="overflow:auto;padding:14px"><table style="width:100%;border-collapse:collapse;font-size:10px;background:white"><thead style="background:#334155;color:white"><tr><th style="padding:8px">FECHA</th><th>SERIE</th><th>MOVIMIENTO</th><th>CAMBIO</th><th>ORIGEN</th><th>DESTINO</th><th>OBSERVACIÓN</th><th>USUARIO</th></tr></thead><tbody>${filas.map((m,i) => `<tr style="border-bottom:1px solid #e2e8f0;${i%2?'background:#f8fafc':''}"><td style="padding:8px;white-space:nowrap">${radioEsc(new Date(m.effective_at).toLocaleString('es-EC'))}</td><td style="padding:7px;font-weight:900">${radioEsc(m.serial_number)}</td><td style="padding:7px">${radioEsc(m.movement_type)}</td><td style="padding:7px">${radioEsc(m.previous_state || '—')} → <b>${radioEsc(m.new_state)}</b></td><td style="padding:7px">${radioEsc(m.origin || '—')}</td><td style="padding:7px">${radioEsc(m.destination || '—')}</td><td style="padding:7px">${radioEsc(m.observation)}</td><td style="padding:7px">${radioEsc(m.performed_by || '—')}</td></tr>`).join('') || '<tr><td colspan="8" style="padding:25px;text-align:center;color:#94a3b8">AÚN NO EXISTEN MOVIMIENTOS REGISTRADOS.</td></tr>'}</tbody></table></div></div>`;
    modal.style.display = 'flex';
}
