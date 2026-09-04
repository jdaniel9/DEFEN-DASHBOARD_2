// ================================================================
// asistencia.js — Matriz mensual de asistencia sobre Supabase
// ================================================================

const asistenciaModulo = {
    workspace: null,
    pagina: 1,
    porPagina: 35,
    busqueda: '',
    proyecto: '',
    estado: '',
    guardando: false
};

function asistenciaEsc(valor) {
    return String(valor ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function asistenciaFechaLocal(iso) {
    if (!iso) return '—';
    const [anio, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return String(iso);
    return new Intl.DateTimeFormat('es-EC', { day:'2-digit', month:'short', year:'numeric' })
        .format(new Date(anio, mes - 1, dia)).toUpperCase();
}

function asistenciaMesEtiqueta(iso) {
    if (!iso) return 'PERIODO';
    const [anio, mes] = String(iso).split('-').map(Number);
    return new Intl.DateTimeFormat('es-EC', { month:'long', year:'numeric' })
        .format(new Date(anio, mes - 1, 1)).toUpperCase();
}

function asistenciaDiasMes(iso) {
    const [anio, mes] = String(iso || '').split('-').map(Number);
    return anio && mes ? new Date(anio, mes, 0).getDate() : 31;
}

function asistenciaCodigoClase(codigo) {
    return ({ '3':'as-code-3', '4':'as-code-4', '5':'as-code-5', '6':'as-code-6', 'F':'as-code-f', 'PM':'as-code-pm' })[codigo] || '';
}

function crearModalAsistencia() {
    if (document.getElementById('asistencia-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'asistencia-modal';
    modal.className = 'as-modal';
    modal.innerHTML = `
      <div class="as-shell">
        <header class="as-header">
          <div><h2>CONTROL MENSUAL DE ASISTENCIA</h2><p id="as-periodo-subtitulo">CARGANDO PERIODO…</p></div>
          <div class="as-header-actions"><button onclick="recargarModuloAsistencia()">↻ ACTUALIZAR</button><button onclick="cerrarModuloAsistencia()">✕ CERRAR</button></div>
        </header>
        <div class="as-body">
          <section class="as-kpis">
            <div><span>PERSONAS</span><strong id="as-kpi-personal">—</strong></div>
            <div><span>VACANTES</span><strong id="as-kpi-vacantes">—</strong></div>
            <div><span>SACAFRANCOS</span><strong id="as-kpi-moviles">—</strong></div>
            <div><span>FALTAS</span><strong id="as-kpi-faltas">—</strong></div>
            <div><span>PERIODO</span><strong id="as-kpi-estado">—</strong></div>
          </section>
          <section class="as-toolbar">
            <label>PERIODO<select id="as-filtro-periodo" onchange="cambiarPeriodoAsistencia(this.value)"></select></label>
            <label>PROYECTO<select id="as-filtro-proyecto" onchange="filtrarModuloAsistencia()"><option value="">TODOS</option></select></label>
            <label>ESTADO<select id="as-filtro-estado" onchange="filtrarModuloAsistencia()"><option value="">TODOS</option><option>ACTIVO</option><option>APOYO</option><option>CAMBIO</option><option>VACANTE</option><option>INACTIVO</option></select></label>
            <label class="as-search">BUSCAR<input id="as-filtro-busqueda" oninput="filtrarModuloAsistencia()" placeholder="NOMBRE, CÉDULA, PROYECTO O PUESTO"></label>
          </section>
          <div id="as-leyenda" class="as-legend"></div>
          <div id="as-mensaje" class="as-message">CARGANDO ASISTENCIA…</div>
          <div id="as-tabla-wrap" class="as-table-wrap" style="display:none">
            <table class="as-table"><thead id="as-thead"></thead><tbody id="as-tbody"></tbody></table>
          </div>
          <footer class="as-footer"><span id="as-contador">—</span><div><button id="as-anterior" onclick="paginaAsistencia(-1)">← ANTERIOR</button><span id="as-pagina">—</span><button id="as-siguiente" onclick="paginaAsistencia(1)">SIGUIENTE →</button></div></footer>
        </div>
      </div>`;
    document.body.appendChild(modal);
}

async function abrirModuloAsistencia() {
    if (typeof usuarioPuedeVerAsistencia === 'function' && !usuarioPuedeVerAsistencia()) {
        alert('NO TIENES PERMISO PARA CONSULTAR ASISTENCIA.');
        return;
    }
    crearModalAsistencia();
    document.getElementById('asistencia-modal').style.display = 'flex';
    await cargarWorkspaceAsistencia(null);
}

function cerrarModuloAsistencia() {
    const modal = document.getElementById('asistencia-modal');
    if (modal) modal.style.display = 'none';
}

async function recargarModuloAsistencia() {
    const id = asistenciaModulo.workspace?.period?.id || null;
    await cargarWorkspaceAsistencia(id);
}

async function cambiarPeriodoAsistencia(periodId) {
    await cargarWorkspaceAsistencia(periodId || null);
}

async function cargarWorkspaceAsistencia(periodId) {
    const mensaje = document.getElementById('as-mensaje');
    const tabla = document.getElementById('as-tabla-wrap');
    mensaje.style.display = 'block';
    mensaje.className = 'as-message';
    mensaje.textContent = 'CARGANDO MATRIZ MENSUAL…';
    tabla.style.display = 'none';
    try {
        const workspace = await supabaseRpc('get_attendance_workspace', { p_period_id: periodId || null });
        if (!workspace || workspace.schema_version !== 1) throw new Error('CONTRATO DE ASISTENCIA INCOMPATIBLE.');
        asistenciaModulo.workspace = workspace;
        asistenciaModulo.pagina = 1;
        asistenciaModulo.busqueda = '';
        asistenciaModulo.proyecto = '';
        asistenciaModulo.estado = '';
        document.getElementById('as-filtro-busqueda').value = '';
        document.getElementById('as-filtro-estado').value = '';
        prepararControlesAsistencia();
        renderModuloAsistencia();
        mensaje.style.display = 'none';
        tabla.style.display = 'block';
    } catch (error) {
        mensaje.className = 'as-message as-error';
        mensaje.textContent = `NO SE PUDO CARGAR LA ASISTENCIA: ${error.message || error}`;
    }
}

function prepararControlesAsistencia() {
    const w = asistenciaModulo.workspace;
    document.getElementById('as-periodo-subtitulo').textContent = `${asistenciaMesEtiqueta(w.period.month_start)} · ${w.period.status}`;
    document.getElementById('as-filtro-periodo').innerHTML = (w.periods || []).map(p =>
        `<option value="${asistenciaEsc(p.id)}" ${p.id === w.period.id ? 'selected' : ''}>${asistenciaMesEtiqueta(p.month_start)} · ${asistenciaEsc(p.status)}</option>`
    ).join('');
    const proyectos = [...new Set((w.assignments || []).map(a => a.project).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'es'));
    document.getElementById('as-filtro-proyecto').innerHTML = '<option value="">TODOS</option>' + proyectos.map(p => `<option value="${asistenciaEsc(p)}">${asistenciaEsc(p)}</option>`).join('');
    document.getElementById('as-leyenda').innerHTML = (w.codes || []).map(c => `<span class="${asistenciaCodigoClase(c.code)}"><b>${asistenciaEsc(c.code)}</b> ${asistenciaEsc(c.label)}</span>`).join('');
}

function filtrarModuloAsistencia() {
    asistenciaModulo.busqueda = document.getElementById('as-filtro-busqueda').value.trim().toUpperCase();
    asistenciaModulo.proyecto = document.getElementById('as-filtro-proyecto').value;
    asistenciaModulo.estado = document.getElementById('as-filtro-estado').value;
    asistenciaModulo.pagina = 1;
    renderModuloAsistencia();
}

function asignacionesAsistenciaFiltradas() {
    const q = asistenciaModulo.busqueda;
    return (asistenciaModulo.workspace?.assignments || []).filter(a => {
        if (asistenciaModulo.proyecto && a.project !== asistenciaModulo.proyecto) return false;
        if (asistenciaModulo.estado && a.status !== asistenciaModulo.estado) return false;
        if (!q) return true;
        return [a.full_name, a.national_id, a.province, a.project, a.post, a.schedule]
            .some(v => String(v || '').toUpperCase().includes(q));
    });
}

function renderModuloAsistencia() {
    const w = asistenciaModulo.workspace;
    if (!w) return;
    const todas = asignacionesAsistenciaFiltradas();
    const paginas = Math.max(1, Math.ceil(todas.length / asistenciaModulo.porPagina));
    asistenciaModulo.pagina = Math.min(asistenciaModulo.pagina, paginas);
    const inicio = (asistenciaModulo.pagina - 1) * asistenciaModulo.porPagina;
    const filas = todas.slice(inicio, inicio + asistenciaModulo.porPagina);
    const dias = asistenciaDiasMes(w.period.month_start);
    const hoy = new Date();
    const esMesActual = w.period.month_start.slice(0,7) === `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
    const puedeEditar = Boolean(w.permissions?.manage && w.period.status === 'OPEN');

    document.getElementById('as-kpi-personal').textContent = Number(w.summary?.personnel || 0).toLocaleString('es-EC');
    document.getElementById('as-kpi-vacantes').textContent = Number(w.summary?.vacancies || 0).toLocaleString('es-EC');
    document.getElementById('as-kpi-moviles').textContent = Number(w.summary?.mobile_coverage || 0).toLocaleString('es-EC');
    document.getElementById('as-kpi-faltas').textContent = Number(w.summary?.unjustified_absences || 0) + Number(w.summary?.justified_absences || 0);
    document.getElementById('as-kpi-estado').textContent = w.period.status;

    const dayHeaders = Array.from({length:dias}, (_,i) => `<th class="as-day-head ${esMesActual && i+1===hoy.getDate()?'as-today':''}">${i+1}</th>`).join('');
    document.getElementById('as-thead').innerHTML = `<tr><th class="as-sticky as-col-person">PERSONAL / UBICACIÓN</th><th class="as-sticky as-col-status">ESTADO</th>${dayHeaders}</tr>`;
    document.getElementById('as-tbody').innerHTML = filas.map(a => {
        const nombre = a.status === 'VACANTE' ? 'VACANTE' : (a.full_name || 'SIN NOMBRE');
        const ubicacion = [a.province, a.project, a.post].filter(Boolean).join(' · ');
        const dayCells = Array.from({length:dias}, (_,i) => {
            const dia = i + 1;
            const codigo = String(a.days?.[dia] || '');
            const editable = puedeEditar && a.status !== 'INACTIVO' && a.status !== 'VACANTE';
            return `<td class="as-day ${asistenciaCodigoClase(codigo)} ${esMesActual&&dia===hoy.getDate()?'as-today':''} ${editable?'as-editable':''}" ${editable?`onclick="editarMarcacionAsistencia('${asistenciaEsc(a.assignment_id)}',${dia},'${asistenciaEsc(codigo)}')"`:''}>${codigo ? asistenciaEsc(codigo) : '·'}</td>`;
        }).join('');
        return `<tr><td class="as-sticky as-col-person"><b>${asistenciaEsc(nombre)}</b><small>${asistenciaEsc(a.national_id || 'SIN CÉDULA')}</small><small>${asistenciaEsc(ubicacion)}</small><small>${asistenciaEsc(a.schedule || 'SIN HORARIO')}${a.mobile_coverage?' · COBERTURA MÓVIL':''}</small></td><td class="as-sticky as-col-status"><span class="as-status as-status-${String(a.status||'').toLowerCase()}">${asistenciaEsc(a.status)}</span></td>${dayCells}</tr>`;
    }).join('') || `<tr><td colspan="${dias+2}" class="as-empty">NO HAY ASIGNACIONES PARA LOS FILTROS SELECCIONADOS.</td></tr>`;
    document.getElementById('as-contador').textContent = `${todas.length} ASIGNACIÓN(ES) · MOSTRANDO ${filas.length}`;
    document.getElementById('as-pagina').textContent = `PÁGINA ${asistenciaModulo.pagina} DE ${paginas}`;
    document.getElementById('as-anterior').disabled = asistenciaModulo.pagina <= 1;
    document.getElementById('as-siguiente').disabled = asistenciaModulo.pagina >= paginas;
}

function paginaAsistencia(delta) {
    asistenciaModulo.pagina += delta;
    renderModuloAsistencia();
    document.getElementById('as-tabla-wrap').scrollTop = 0;
}

function editarMarcacionAsistencia(assignmentId, dia, codigoActual) {
    if (asistenciaModulo.guardando) return;
    const w = asistenciaModulo.workspace;
    if (!w?.permissions?.manage || w.period.status !== 'OPEN') return;
    let editor = document.getElementById('as-editor');
    if (!editor) {
        editor = document.createElement('div');
        editor.id = 'as-editor';
        editor.className = 'as-editor-overlay';
        document.body.appendChild(editor);
    }
    const asignacion = w.assignments.find(a => a.assignment_id === assignmentId);
    editor.innerHTML = `<div class="as-editor-card"><h3>REGISTRAR ASISTENCIA</h3><p>${asistenciaEsc(asignacion?.full_name || 'VACANTE')}<br><b>${asistenciaEsc(asistenciaFechaDesdeDia(w.period.month_start,dia))}</b></p><div class="as-code-grid">${(w.codes||[]).map(c=>`<button class="${asistenciaCodigoClase(c.code)} ${c.code===codigoActual?'selected':''}" onclick="guardarMarcacionAsistencia('${asistenciaEsc(assignmentId)}',${dia},'${asistenciaEsc(c.code)}')"><b>${asistenciaEsc(c.code)}</b><small>${asistenciaEsc(c.label)}</small></button>`).join('')}</div><div class="as-editor-actions">${codigoActual?`<button class="danger" onclick="eliminarMarcacionAsistencia('${asistenciaEsc(assignmentId)}',${dia})">BORRAR MARCACIÓN</button>`:''}<button onclick="cerrarEditorAsistencia()">CANCELAR</button></div></div>`;
    editor.style.display = 'flex';
}

function asistenciaFechaDesdeDia(monthStart, dia) {
    return `${monthStart.slice(0,8)}${String(dia).padStart(2,'0')}`;
}

function cerrarEditorAsistencia() {
    const editor = document.getElementById('as-editor');
    if (editor) editor.style.display = 'none';
}

async function guardarMarcacionAsistencia(assignmentId, dia, codigo) {
    if (asistenciaModulo.guardando) return;
    asistenciaModulo.guardando = true;
    const fecha = asistenciaFechaDesdeDia(asistenciaModulo.workspace.period.month_start, dia);
    try {
        await supabaseRpc('upsert_attendance_entry', { p_assignment_id: assignmentId, p_attendance_date: fecha, p_code: codigo, p_note: null });
        const asignacion = asistenciaModulo.workspace.assignments.find(a => a.assignment_id === assignmentId);
        if (asignacion) {
            const anterior = String(asignacion.days?.[dia] || '');
            actualizarResumenCodigoAsistencia(anterior, -1);
            actualizarResumenCodigoAsistencia(codigo, 1);
            asignacion.days = { ...(asignacion.days || {}), [dia]: codigo };
        }
        cerrarEditorAsistencia();
        renderModuloAsistencia();
        if (typeof cargarDatos === 'function') cargarDatos().catch(() => {});
    } catch (error) {
        alert(`NO SE PUDO GUARDAR LA MARCACIÓN: ${error.message || error}`);
    } finally { asistenciaModulo.guardando = false; }
}

async function eliminarMarcacionAsistencia(assignmentId, dia) {
    if (asistenciaModulo.guardando || !confirm('¿ELIMINAR ESTA MARCACIÓN DE ASISTENCIA?')) return;
    asistenciaModulo.guardando = true;
    const fecha = asistenciaFechaDesdeDia(asistenciaModulo.workspace.period.month_start, dia);
    try {
        await supabaseRpc('delete_attendance_entry', { p_assignment_id: assignmentId, p_attendance_date: fecha });
        const asignacion = asistenciaModulo.workspace.assignments.find(a => a.assignment_id === assignmentId);
        if (asignacion?.days) {
            actualizarResumenCodigoAsistencia(String(asignacion.days[dia] || ''), -1);
            delete asignacion.days[dia];
        }
        cerrarEditorAsistencia();
        renderModuloAsistencia();
        if (typeof cargarDatos === 'function') cargarDatos().catch(() => {});
    } catch (error) {
        alert(`NO SE PUDO ELIMINAR LA MARCACIÓN: ${error.message || error}`);
    } finally { asistenciaModulo.guardando = false; }
}

function actualizarResumenCodigoAsistencia(codigo, delta) {
    const resumen = asistenciaModulo.workspace?.summary;
    if (!resumen) return;
    if (codigo === 'F') resumen.unjustified_absences = Math.max(0, Number(resumen.unjustified_absences || 0) + delta);
    if (codigo === 'PM') resumen.justified_absences = Math.max(0, Number(resumen.justified_absences || 0) + delta);
}
