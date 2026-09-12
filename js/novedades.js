// ================================================================
// novedades.js — Reporte de Novedades de Personal
// Ingresos · Salidas · Faltas Injustificadas (F) · Faltas Justificadas (PM)
// · Llamados de Atención — con corte Semanal o Mensual
// ================================================================

// Calcula el rango de días [inicio, fin] del mes actual según el periodo elegido.
// "semanal" = últimos 7 días calendario (incluyendo hoy).
// "mensual" = del día 1 del mes actual hasta hoy.
// NOTA: la hoja 'asistencia' solo representa el mes en curso (columnas 1-31),
// así que si "semanal" cruza al mes anterior, esos días no estarán disponibles.
function calcularRangoNovedades(periodo) {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    let diaInicio;
    if (periodo === 'semanal') {
        diaInicio = Math.max(1, diaHoy - 6);
    } else {
        diaInicio = 1;
    }
    return { diaInicio, diaFin: diaHoy, hoy };
}

// Convierte "YYYY-MM-DD" a Date, o null
function parseFechaISO(str) {
    return parseFechaLocal(str);
}

// Filtra ingresos/salidas/faltas/llamados según el periodo elegido —
// compartido entre el generador de PDF y el de Excel
function obtenerNovedadesFiltradas(periodo) {
    const { diaInicio, diaFin, hoy } = calcularRangoNovedades(periodo);
    const anio = hoy.getFullYear(), mes = hoy.getMonth();
    const fechaDesde = new Date(anio, mes, diaInicio);
    const fechaHasta = new Date(anio, mes, diaFin, 23, 59, 59);

    const fechaHoyStr = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;
    const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const etiquetaPeriodo = periodo === 'semanal'
        ? `Semanal — ${String(diaInicio).padStart(2,'0')} al ${String(diaFin).padStart(2,'0')} de ${nombresMes[mes]} ${anio}`
        : `Mensual — ${nombresMes[mes]} ${anio} (hasta el ${String(diaFin).padStart(2,'0')})`;

    const ingresosPeriodo = (novedadesPersonal.ingresos || []).filter(r => {
        const f = parseFechaISO(r.fecha);
        return f && f >= fechaDesde && f <= fechaHasta;
    });
    const salidasPeriodo = (novedadesPersonal.salidas || []).filter(r => {
        const f = parseFechaISO(r.fecha);
        return f && f >= fechaDesde && f <= fechaHasta;
    });
    const faltasPeriodo = (novedadesPersonal.faltas || []).map(r => ({
        ...r,
        diasInjustificados: (r.diasInjustificados||[]).filter(d => d >= diaInicio && d <= diaFin),
        diasJustificados:   (r.diasJustificados||[]).filter(d => d >= diaInicio && d <= diaFin)
    })).filter(r => r.diasInjustificados.length > 0 || r.diasJustificados.length > 0);
    const llamadosPeriodo = (llamadosAtencion || []).filter(r => {
        const f = parseFechaISO(r.fecha);
        return f && f >= fechaDesde && f <= fechaHasta;
    });

    return { ingresosPeriodo, salidasPeriodo, faltasPeriodo, llamadosPeriodo, etiquetaPeriodo, fechaHoyStr, hoy };
}

async function generarReporteNovedades() {
    const periodo = document.getElementById('novedades-periodo')?.value || 'semanal';
    const { ingresosPeriodo, salidasPeriodo, faltasPeriodo, llamadosPeriodo, etiquetaPeriodo, fechaHoyStr } = obtenerNovedadesFiltradas(periodo);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const W = 210, H = 297;
    const DARK=[15,23,42], RED=[220,38,38], AMB=[217,119,6], GREEN=[22,163,74], LGRAY=[248,250,252];

    const subt = `Reporte de Novedades de Personal — ${etiquetaPeriodo}`;
    dibujarMembretePDF(doc, subt, fechaHoyStr);
    const didDrawPageNov = () => dibujarMembretePDF(doc, subt, fechaHoyStr);

    let y = MARGEN_PDF + 8;
    doc.setTextColor(...DARK); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('Novedades de Personal', 14, y); y += 6;
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    doc.text(etiquetaPeriodo, 14, y); y += 10;

    // ── KPIs resumen ──
    const kpis = [
        ['Ingresos',  ingresosPeriodo.length, GREEN],
        ['Salidas',   salidasPeriodo.length,  [71,85,105]],
        ['Faltas Injust.', faltasPeriodo.reduce((s,r)=>s+r.diasInjustificados.length,0), RED],
        ['Faltas Justif.', faltasPeriodo.reduce((s,r)=>s+r.diasJustificados.length,0), AMB],
        ['Llamados At.', llamadosPeriodo.length, [124,58,237]],
    ];
    const bw = (W-28)/5 - 2.5;
    kpis.forEach(([lbl,val,col],i) => {
        const x = 14 + i*(bw+3);
        doc.setFillColor(...LGRAY); doc.roundedRect(x,y,bw,16,2,2,'F');
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...col);
        doc.text(String(val), x+bw/2, y+10, {align:'center'});
        doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
        doc.text(lbl.toUpperCase(), x+bw/2, y+14.5, {align:'center'});
    });
    y += 22;

    const tablaSeccion = (titulo, filas, columnas, colorHead) => {
        if (filas.length === 0) return;
        if (y > 245) { doc.addPage(); dibujarMembretePDF(doc, subt, fechaHoyStr); y = MARGEN_PDF + 8; }
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text(`${titulo} (${filas.length})`, 14, y); y += 5;
        doc.autoTable({
            startY: y,
            margin: { left:14, right:14, top:MARGEN_PDF+4, bottom:MARGEN_PDF+4 },
            didDrawPage: didDrawPageNov,
            headStyles:{halign:'center',valign:'middle', fillColor: colorHead, textColor:[255,255,255], fontSize:7, cellPadding:2.5 },
            head: [['N°', ...columnas]],
            body: numerarFilas(filas),
            styles:{halign:'center',valign:'middle', fontSize:7, cellPadding:2.2, overflow:'linebreak', lineColor:[226,232,240], lineWidth:0.3 },
            alternateRowStyles: { fillColor: LGRAY },
            columnStyles: { 0:{halign:'center', cellWidth:8} }
        });
        y = doc.lastAutoTable.finalY + 8;
    };

    // ── 1. Nuevos ingresos (agrupados/clasificados por proyecto) ──
    tablaSeccion(
        'NUEVOS INGRESOS',
        ingresosPeriodo
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [formatFecha(r.fecha), r.nombre, r.cedula||'—', r.puesto, r.proyecto||'—', r.provincia||'—']),
        ['Fecha','Nombre','Cédula','Puesto','Proyecto','Provincia'],
        GREEN
    );

    // ── 2. Salidas ──
    tablaSeccion(
        'SALIDAS',
        salidasPeriodo
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [formatFecha(r.fecha), r.nombre, r.cedula||'—', r.puesto, r.proyecto||'—', r.provincia||'—']),
        ['Fecha','Nombre','Cédula','Puesto','Proyecto','Provincia'],
        [71,85,105]
    );

    // ── 3. Faltas injustificadas ──
    tablaSeccion(
        'FALTAS INJUSTIFICADAS (F)',
        faltasPeriodo
            .filter(r => r.diasInjustificados.length > 0)
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [r.nombre, r.cedula||'—', r.puesto, r.proyecto||'—', r.provincia||'—', String(r.diasInjustificados.length), r.diasInjustificados.join(', ')]),
        ['Nombre','Cédula','Puesto','Proyecto','Provincia','N°','Días'],
        RED
    );

    // ── 4. Faltas justificadas ──
    tablaSeccion(
        'FALTAS JUSTIFICADAS (PM)',
        faltasPeriodo
            .filter(r => r.diasJustificados.length > 0)
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [r.nombre, r.cedula||'—', r.puesto, r.proyecto||'—', r.provincia||'—', String(r.diasJustificados.length), r.diasJustificados.join(', ')]),
        ['Nombre','Cédula','Puesto','Proyecto','Provincia','N°','Días'],
        AMB
    );

    // ── 5. Llamados de atención ──
    tablaSeccion(
        'LLAMADOS DE ATENCIÓN',
        llamadosPeriodo
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [formatFecha(r.fecha), r.nombre_guardia||'—', r.puesto||'—', r.proyecto||'—', r.motivo||'—', r.tipo_llamado||'—', r.registrado_por||'—']),
        ['Fecha','Guardia','Puesto','Proyecto','Motivo','Tipo','Registrado por'],
        [124,58,237]
    );

    if (ingresosPeriodo.length===0 && salidasPeriodo.length===0 && faltasPeriodo.length===0 && llamadosPeriodo.length===0) {
        doc.setFontSize(10); doc.setTextColor(148,163,184); doc.setFont('helvetica','italic');
        doc.text('No hay novedades registradas en el periodo seleccionado.', 14, y);
    }

    // ── Numeración de páginas ──
    const totalPag = doc.getNumberOfPages();
    for (let i=1; i<=totalPag; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5); doc.setTextColor(120,113,108);
        doc.text(`Página ${i} de ${totalPag}`, W-14, H-MARGEN_PDF+20, {align:'right'});
        doc.text('Documento confidencial · Uso interno', 14, H-MARGEN_PDF+20);
    }

    doc.save(`Novedades_Personal_${periodo}_DEFEN_${fechaHoyStr.replace(/\//g,'-')}.pdf`);
}

// =====================================================================
// EXCEL — Novedades de Personal (mismas secciones que el PDF, en hojas separadas)
// =====================================================================
function generarExcelNovedades() {
    const periodo = document.getElementById('novedades-periodo')?.value || 'semanal';
    const { ingresosPeriodo, salidasPeriodo, faltasPeriodo, llamadosPeriodo, fechaHoyStr } = obtenerNovedadesFiltradas(periodo);

    if (!ingresosPeriodo.length && !salidasPeriodo.length && !faltasPeriodo.length && !llamadosPeriodo.length) {
        alert('No hay novedades registradas en el periodo seleccionado.');
        return;
    }

    const wb = XLSX.utils.book_new();
    const agregarHoja = (nombre, filas) => {
        if (filas.length === 0) return;
        const ws = XLSX.utils.json_to_sheet(filas);
        ws['!cols'] = Object.keys(filas[0]).map(k => ({ wch: Math.max(k.length+2, 14) }));
        XLSX.utils.book_append_sheet(wb, ws, nombre);
    };

    agregarHoja('Ingresos', ingresosPeriodo.map((r,i) => ({
        'N°': i+1, 'Fecha': formatFecha(r.fecha), 'Nombre': r.nombre, 'Cédula': r.cedula||'',
        'Puesto': r.puesto, 'Proyecto': r.proyecto||'', 'Provincia': r.provincia||''
    })));

    agregarHoja('Salidas', salidasPeriodo.map((r,i) => ({
        'N°': i+1, 'Fecha': formatFecha(r.fecha), 'Nombre': r.nombre, 'Cédula': r.cedula||'',
        'Puesto': r.puesto, 'Proyecto': r.proyecto||'', 'Provincia': r.provincia||''
    })));

    agregarHoja('Faltas Injustificadas', faltasPeriodo.filter(r=>r.diasInjustificados.length>0).map((r,i) => ({
        'N°': i+1, 'Nombre': r.nombre, 'Cédula': r.cedula||'', 'Puesto': r.puesto,
        'Proyecto': r.proyecto||'', 'Provincia': r.provincia||'',
        'N° Faltas': r.diasInjustificados.length, 'Días': r.diasInjustificados.join(', ')
    })));

    agregarHoja('Faltas Justificadas', faltasPeriodo.filter(r=>r.diasJustificados.length>0).map((r,i) => ({
        'N°': i+1, 'Nombre': r.nombre, 'Cédula': r.cedula||'', 'Puesto': r.puesto,
        'Proyecto': r.proyecto||'', 'Provincia': r.provincia||'',
        'N° Faltas': r.diasJustificados.length, 'Días': r.diasJustificados.join(', ')
    })));

    agregarHoja('Llamados de Atención', llamadosPeriodo.map((r,i) => ({
        'N°': i+1, 'Fecha': formatFecha(r.fecha), 'Guardia': r.nombre_guardia||'', 'Puesto': r.puesto||'',
        'Proyecto': r.proyecto||'', 'Motivo': r.motivo||'', 'Tipo': r.tipo_llamado||'', 'Registrado por': r.registrado_por||''
    })));

    XLSX.writeFile(wb, `Novedades_Personal_${periodo}_DEFEN_${fechaHoyStr.replace(/\//g,'-')}.xlsx`);
}

// =====================================================================
// GESTIÓN DE LLAMADOS DE ATENCIÓN — Migración 41
// =====================================================================
let workspaceLlamadosAtencion = null;

function novedadesEsc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[caracter]));
}

function asegurarModalLlamadosAtencion() {
    if (document.getElementById('llamados-atencion-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'llamados-atencion-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:21800;background:rgba(15,23,42,.82);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
      <div style="width:min(1180px,98vw);height:min(760px,94vh);background:#f8fafc;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 30px 90px rgba(0,0,0,.5)">
        <div style="background:#0f172a;color:white;padding:14px 18px;display:flex;align-items:center;gap:12px">
          <div style="flex:1"><b style="font-size:15px">📣 Llamados de atención</b><div id="llamados-atencion-subtitulo" style="font-size:10px;color:#c4b5fd;margin-top:3px">Cargando información…</div></div>
          <button onclick="cerrarGestionLlamadosAtencion()" style="border:0;border-radius:9px;background:#334155;color:white;padding:8px 12px;font-weight:800;cursor:pointer">✕ Cerrar</button>
        </div>
        <div style="display:grid;grid-template-columns:minmax(320px,390px) 1fr;gap:12px;padding:14px;min-height:0;flex:1;overflow:auto">
          <div style="background:white;border:1px solid #ddd6fe;border-radius:14px;padding:14px;height:max-content">
            <h3 style="margin:0 0 4px;font-size:13px;color:#4c1d95">NUEVO LLAMADO</h3>
            <p style="margin:0 0 12px;font-size:10px;color:#64748b">Selecciona una persona activa del periodo abierto.</p>
            <label style="display:block;font-size:9px;font-weight:900;color:#475569;margin-bottom:4px">PERSONAL / UBICACIÓN</label>
            <select id="llamado-asignacion" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-size:10px"></select>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
              <label style="font-size:9px;font-weight:900;color:#475569">FECHA<input id="llamado-fecha" type="date" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px"></label>
              <label style="font-size:9px;font-weight:900;color:#475569">TIPO<select id="llamado-tipo" style="display:block;width:100%;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px"><option value="VERBAL">VERBAL</option><option value="ESCRITO">ESCRITO</option><option value="SUSPENSION">SUSPENSIÓN</option><option value="OTRO">OTRO</option></select></label>
            </div>
            <label style="display:block;font-size:9px;font-weight:900;color:#475569;margin-top:10px">MOTIVO / DETALLE<textarea id="llamado-motivo" rows="5" maxlength="500" placeholder="Describe el motivo con claridad" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:8px;resize:vertical;font-size:11px"></textarea></label>
            <button id="llamado-guardar" onclick="guardarLlamadoAtencion()" style="width:100%;margin-top:12px;border:0;border-radius:9px;background:#7c3aed;color:white;padding:10px;font-size:11px;font-weight:900;cursor:pointer">GUARDAR LLAMADO</button>
          </div>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:14px;display:flex;flex-direction:column;min-height:420px;overflow:hidden">
            <div style="padding:12px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px"><b style="font-size:12px;color:#1e293b">HISTORIAL RECIENTE</b><input id="llamados-buscar" oninput="renderHistorialLlamadosAtencion()" placeholder="Buscar persona, proyecto, puesto o motivo…" style="margin-left:auto;width:min(390px,60%);padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:10px"></div>
            <div id="llamados-atencion-lista" style="padding:12px;overflow:auto;flex:1"><p style="color:#64748b">Cargando…</p></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
}

function cerrarGestionLlamadosAtencion() {
    const modal = document.getElementById('llamados-atencion-modal');
    if (modal) modal.style.display = 'none';
}

function novedadesFechaHoyIso() {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`;
}

function novedadesRequestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, caracter => {
        const aleatorio = Math.random() * 16 | 0;
        return (caracter === 'x' ? aleatorio : (aleatorio & 3 | 8)).toString(16);
    });
}

async function abrirGestionLlamadosAtencion() {
    if (typeof usuarioPuedeGestionarLlamadosAtencion === 'function' && !usuarioPuedeGestionarLlamadosAtencion()) {
        return alert('NO TIENES PERMISO PARA GESTIONAR LLAMADOS DE ATENCIÓN.');
    }
    asegurarModalLlamadosAtencion();
    document.getElementById('llamados-atencion-modal').style.display = 'flex';
    document.getElementById('llamados-atencion-lista').innerHTML = '<p style="color:#64748b">Cargando información…</p>';
    try {
        workspaceLlamadosAtencion = await supabaseCargarWorkspaceLlamadosAtencion(300);
        renderWorkspaceLlamadosAtencion();
    } catch (error) {
        document.getElementById('llamados-atencion-lista').innerHTML = `<p style="color:#b91c1c;font-weight:800">${novedadesEsc(error.message || error)}</p>`;
    }
}

function renderWorkspaceLlamadosAtencion() {
    const workspace = workspaceLlamadosAtencion || {};
    const periodo = workspace.period;
    const asignaciones = Array.isArray(workspace.assignments) ? workspace.assignments : [];
    document.getElementById('llamados-atencion-subtitulo').textContent = periodo
        ? `${asignaciones.length} persona(s) disponible(s) · periodo ${periodo.month_start}`
        : 'No existe un periodo de asistencia abierto';
    document.getElementById('llamado-asignacion').innerHTML = '<option value="">SELECCIONAR PERSONAL…</option>' + asignaciones.map(a =>
        `<option value="${novedadesEsc(a.assignment_id)}">${novedadesEsc(a.full_name)} · ${novedadesEsc(a.national_id || 'SIN CÉDULA')} · ${novedadesEsc(a.project || 'SIN PROYECTO')} · ${novedadesEsc(a.post || 'SIN PUESTO')}</option>`
    ).join('');
    const fecha = document.getElementById('llamado-fecha');
    fecha.value = novedadesFechaHoyIso();
    fecha.min = periodo?.month_start || '';
    fecha.max = novedadesFechaHoyIso();
    document.getElementById('llamado-guardar').disabled = !periodo || !asignaciones.length;
    renderHistorialLlamadosAtencion();
}

function renderHistorialLlamadosAtencion() {
    const lista = document.getElementById('llamados-atencion-lista');
    if (!lista) return;
    const consulta = String(document.getElementById('llamados-buscar')?.value || '').trim().toUpperCase();
    const filas = (workspaceLlamadosAtencion?.warnings || []).filter(w => !consulta || [
        w.personnel_name, w.national_id, w.province_name, w.project_name,
        w.post_name, w.reason, w.warning_type, w.registered_by_name
    ].some(valor => String(valor || '').toUpperCase().includes(consulta)));
    if (!filas.length) {
        lista.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:11px">No existen llamados con esta búsqueda.</div>';
        return;
    }
    const colores = { VERBAL:'#f59e0b', ESCRITO:'#2563eb', SUSPENSION:'#dc2626', OTRO:'#7c3aed' };
    lista.innerHTML = filas.map(w => `
      <div style="border:1px solid #e2e8f0;border-left:5px solid ${colores[w.warning_type] || '#64748b'};border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#f8fafc">
        <div style="display:flex;align-items:center;gap:8px"><b style="font-size:11px;color:#0f172a">${novedadesEsc(w.personnel_name)}</b><span style="margin-left:auto;font-size:9px;font-weight:900;color:${colores[w.warning_type] || '#64748b'}">${novedadesEsc(w.warning_type)}</span></div>
        <div style="font-size:9px;color:#64748b;margin-top:3px">${novedadesEsc(w.warning_date)} · ${novedadesEsc(w.province_name || '—')} · ${novedadesEsc(w.project_name || '—')} · ${novedadesEsc(w.post_name || '—')}</div>
        <div style="font-size:10px;color:#334155;margin-top:7px;white-space:pre-wrap">${novedadesEsc(w.reason)}</div>
        <div style="font-size:8px;color:#94a3b8;margin-top:6px">Registrado por: ${novedadesEsc(w.registered_by_name || '—')}</div>
      </div>`).join('');
}

async function guardarLlamadoAtencion() {
    const assignmentId = document.getElementById('llamado-asignacion')?.value || '';
    const fecha = document.getElementById('llamado-fecha')?.value || '';
    const tipo = document.getElementById('llamado-tipo')?.value || '';
    const motivo = document.getElementById('llamado-motivo')?.value.trim() || '';
    if (!assignmentId || !fecha || !tipo || motivo.length < 5) return alert('SELECCIONA EL PERSONAL, LA FECHA, EL TIPO Y ESCRIBE UN MOTIVO DE AL MENOS 5 CARACTERES.');
    const asignacion = (workspaceLlamadosAtencion?.assignments || []).find(a => a.assignment_id === assignmentId);
    if (!confirm(`¿REGISTRAR LLAMADO ${tipo} PARA ${asignacion?.full_name || 'LA PERSONA SELECCIONADA'}?`)) return;
    const boton = document.getElementById('llamado-guardar');
    boton.disabled = true;
    try {
        await supabaseCrearLlamadoAtencion({
            request_id: novedadesRequestId(),
            assignment_id: assignmentId,
            warning_date: fecha,
            warning_type: tipo,
            reason: motivo
        });
        workspaceLlamadosAtencion = await supabaseCargarWorkspaceLlamadosAtencion(300);
        llamadosAtencion = adaptarLlamadosAtencionSupabase(workspaceLlamadosAtencion.warnings);
        document.getElementById('llamado-motivo').value = '';
        renderWorkspaceLlamadosAtencion();
        alert('LLAMADO DE ATENCIÓN REGISTRADO CORRECTAMENTE.');
    } catch (error) {
        alert('NO SE PUDO REGISTRAR EL LLAMADO: ' + (error.message || error));
    } finally {
        boton.disabled = false;
    }
}
