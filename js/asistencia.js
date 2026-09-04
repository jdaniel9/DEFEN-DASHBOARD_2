// ================================================================
// asistencia.js — Matriz mensual de asistencia sobre Supabase
// ================================================================

const asistenciaModulo = {
    workspace: null,
    coberturas: null,
    pagina: 1,
    porPagina: 35,
    busqueda: '',
    proyecto: '',
    estado: '',
    borradorCobertura: null,
    cierre: { periodId: null, preview: null, pdf: false, excel: false },
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
          <div class="as-header-actions"><button id="as-btn-cierre" onclick="abrirCierreMensualAsistencia()">📦 CIERRE MENSUAL</button><button onclick="abrirGestorCoberturasAsistencia()">👥 COBERTURAS</button><button onclick="recargarModuloAsistencia()">↻ ACTUALIZAR</button><button onclick="cerrarModuloAsistencia()">✕ CERRAR</button></div>
        </header>
        <div class="as-body">
          <section class="as-kpis">
            <div><span>PERSONAS</span><strong id="as-kpi-personal">—</strong></div>
            <div><span>VACANTES</span><strong id="as-kpi-vacantes">—</strong></div>
            <div><span>SACAFRANCOS</span><strong id="as-kpi-moviles">—</strong></div>
            <div><span>FALTAS</span><strong id="as-kpi-faltas">—</strong></div>
            <div><span>COBERTURAS</span><strong id="as-kpi-coberturas">—</strong></div>
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
    await cargarCoberturasAsistencia(true);
}

function cerrarModuloAsistencia() {
    const modal = document.getElementById('asistencia-modal');
    if (modal) modal.style.display = 'none';
    asistenciaModulo.borradorCobertura = null;
}

async function recargarModuloAsistencia() {
    const id = asistenciaModulo.workspace?.period?.id || null;
    await cargarWorkspaceAsistencia(id);
    if (asistenciaModulo.coberturas) await cargarCoberturasAsistencia(true);
}

async function cambiarPeriodoAsistencia(periodId) {
    await cargarWorkspaceAsistencia(periodId || null);
    await cargarCoberturasAsistencia(true);
}

async function cargarWorkspaceAsistencia(periodId) {
    const mensaje = document.getElementById('as-mensaje');
    const tabla = document.getElementById('as-tabla-wrap');
    mensaje.style.display = 'block';
    mensaje.className = 'as-message';
    mensaje.textContent = 'CARGANDO MATRIZ MENSUAL…';
    tabla.style.display = 'none';
    try {
        const periodoAnterior = asistenciaModulo.workspace?.period?.id || null;
        const workspace = await supabaseRpc('get_attendance_workspace', { p_period_id: periodId || null });
        if (!workspace || workspace.schema_version !== 1) throw new Error('CONTRATO DE ASISTENCIA INCOMPATIBLE.');
        asistenciaModulo.workspace = workspace;
        if (periodoAnterior !== workspace.period.id) {
            asistenciaModulo.coberturas = null;
            asistenciaModulo.cierre = { periodId: workspace.period.id, preview: null, pdf: false, excel: false };
        }
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
    const botonCierre = document.getElementById('as-btn-cierre');
    if (botonCierre) botonCierre.style.display = w.period.status === 'OPEN' ? '' : 'none';
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
    const coberturasPeriodo = (asistenciaModulo.coberturas?.coverages || []).length;
    document.getElementById('as-kpi-coberturas').textContent = asistenciaModulo.coberturas ? coberturasPeriodo : '—';
    document.getElementById('as-kpi-estado').textContent = w.period.status;

    const dayHeaders = Array.from({length:dias}, (_,i) => `<th class="as-day-head ${esMesActual && i+1===hoy.getDate()?'as-today':''}">${i+1}</th>`).join('');
    document.getElementById('as-thead').innerHTML = `<tr><th class="as-sticky as-col-person">PERSONAL / UBICACIÓN</th><th class="as-sticky as-col-status">ESTADO</th>${dayHeaders}</tr>`;
    document.getElementById('as-tbody').innerHTML = filas.map(a => {
        const nombre = a.status === 'VACANTE' ? 'VACANTE' : (a.full_name || 'SIN NOMBRE');
        const ubicacion = [a.province, a.project, a.post].filter(Boolean).join(' · ');
        const cobertura = coberturaActivaParaAsignacion(a.assignment_id);
        const esApoyoCobertura = asignacionEsApoyoCobertura(a.assignment_id);
        const puedeCrearCobertura = puedeEditar && a.status !== 'INACTIVO' && !esApoyoCobertura && !cobertura;
        const coberturaHtml = cobertura
            ? `<small class="as-coverage-badge">CUBIERTO POR ${asistenciaEsc(cobertura.replacement_name)} · ${asistenciaEsc(cobertura.status)}</small>`
            : '';
        const accionHtml = puedeCrearCobertura
            ? `<button class="as-cover-row" onclick="abrirNuevaCoberturaAsistencia('${asistenciaEsc(a.assignment_id)}')">${a.status === 'VACANTE' ? 'CUBRIR VACANTE' : 'CREAR COBERTURA'}</button>`
            : '';
        const dayCells = Array.from({length:dias}, (_,i) => {
            const dia = i + 1;
            const codigo = String(a.days?.[dia] || '');
            const fechaCelda = asistenciaFechaDesdeDia(w.period.month_start, dia);
            const dentroVigencia = (!a.employment_start_date || fechaCelda >= a.employment_start_date)
                && (!a.employment_end_date || fechaCelda <= a.employment_end_date);
            const editable = puedeEditar && a.status !== 'INACTIVO' && a.status !== 'VACANTE' && dentroVigencia;
            return `<td class="as-day ${asistenciaCodigoClase(codigo)} ${esMesActual&&dia===hoy.getDate()?'as-today':''} ${editable?'as-editable':''}" ${editable?`onclick="editarMarcacionAsistencia('${asistenciaEsc(a.assignment_id)}',${dia},'${asistenciaEsc(codigo)}')"`:''}>${codigo ? asistenciaEsc(codigo) : '·'}</td>`;
        }).join('');
        return `<tr><td class="as-sticky as-col-person"><b>${asistenciaEsc(nombre)}</b><small>${asistenciaEsc(a.national_id || 'SIN CÉDULA')}</small><small>${asistenciaEsc(ubicacion)}</small><small>${asistenciaEsc(a.schedule || 'SIN HORARIO')}${a.mobile_coverage?' · COBERTURA MÓVIL':''}</small>${coberturaHtml}${accionHtml}</td><td class="as-sticky as-col-status"><span class="as-status as-status-${String(a.status||'').toLowerCase()}">${asistenciaEsc(a.status)}</span></td>${dayCells}</tr>`;
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

async function cargarCoberturasAsistencia(forzar = false) {
    const periodId = asistenciaModulo.workspace?.period?.id;
    if (!periodId) return null;
    if (!forzar && asistenciaModulo.coberturas?.period_id === periodId) return asistenciaModulo.coberturas;
    try {
        const respuesta = await supabaseRpc('get_attendance_coverages', { p_period_id: periodId });
        if (!respuesta || respuesta.schema_version !== 1) throw new Error('CONTRATO DE COBERTURAS INCOMPATIBLE.');
        asistenciaModulo.coberturas = respuesta;
        renderModuloAsistencia();
        return respuesta;
    } catch (error) {
        asistenciaModulo.coberturas = null;
        throw error;
    }
}

function coberturaActivaParaAsignacion(assignmentId) {
    return (asistenciaModulo.coberturas?.coverages || []).find(c =>
        c.target_assignment_id === assignmentId && ['ACTIVA', 'PROGRAMADA'].includes(c.status)
    ) || null;
}

function asignacionEsApoyoCobertura(assignmentId) {
    return (asistenciaModulo.coberturas?.coverages || []).some(c => c.support_assignment_id === assignmentId);
}

function asistenciaHoyEcuador() {
    try {
        const partes = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const valor = Object.fromEntries(partes.map(p => [p.type, p.value]));
        return `${valor.year}-${valor.month}-${valor.day}`;
    } catch (_) {
        return new Date().toISOString().slice(0, 10);
    }
}

function asistenciaSumarDias(fechaIso, dias) {
    const fecha = new Date(`${fechaIso}T12:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
}

function asistenciaEditorElemento() {
    let editor = document.getElementById('as-editor');
    if (!editor) {
        editor = document.createElement('div');
        editor.id = 'as-editor';
        editor.className = 'as-editor-overlay';
        document.body.appendChild(editor);
    }
    return editor;
}

async function abrirNuevaCoberturaAsistencia(assignmentId, personaSeleccionada = '') {
    if (asistenciaModulo.guardando) return;
    try {
        const datos = await cargarCoberturasAsistencia(false);
        if (!datos?.permissions?.manage || datos.period_status !== 'OPEN') {
            alert('NO TIENES PERMISO PARA CREAR COBERTURAS EN ESTE PERIODO.');
            return;
        }
        if (asignacionEsApoyoCobertura(assignmentId)) {
            alert('UNA ASIGNACIÓN DE APOYO NO PUEDE SER CUBIERTA POR OTRA COBERTURA.');
            return;
        }
        if (coberturaActivaParaAsignacion(assignmentId)) {
            alert('ESTA ASIGNACIÓN YA TIENE UNA COBERTURA ACTIVA O PROGRAMADA.');
            return;
        }
        const asignacion = asistenciaModulo.workspace.assignments.find(a => a.assignment_id === assignmentId);
        if (!asignacion) throw new Error('NO SE ENCONTRÓ LA ASIGNACIÓN SELECCIONADA.');
        const personal = (datos.personnel || []).filter(p => p.id !== asignacion.personnel_id);
        const inicioMes = asistenciaModulo.workspace.period.month_start;
        const finMes = asistenciaSumarDias(asistenciaSumarDias(inicioMes, asistenciaDiasMes(inicioMes)), -1);
        const hoy = asistenciaHoyEcuador();
        const inicioPredeterminado = hoy >= inicioMes && hoy <= finMes ? hoy : inicioMes;
        const borrador = asistenciaModulo.borradorCobertura?.assignmentId === assignmentId
            ? asistenciaModulo.borradorCobertura : null;
        const inicio = borrador?.inicio || inicioPredeterminado;
        const fin = borrador?.fin || asistenciaSumarDias(inicio, 6);
        const esVacante = asignacion.status === 'VACANTE';
        const motivos = esVacante
            ? '<option value="VACANTE">VACANTE</option>'
            : '<option value="PERMISO_MEDICO">PERMISO MÉDICO</option><option value="FALTA_INJUSTIFICADA">FALTA INJUSTIFICADA</option><option value="OTRO">OTRO</option>';
        const personaActual = personaSeleccionada || borrador?.persona || '';
        const opciones = personal.map(p =>
            `<option value="${asistenciaEsc(p.id)}" ${p.id === personaActual ? 'selected' : ''}>${p.personnel_type ? `[${asistenciaEsc(p.personnel_type)}] ` : ''}${asistenciaEsc(p.full_name)}${p.national_id ? ` · ${asistenciaEsc(p.national_id)}` : ''}</option>`
        ).join('');
        const editor = asistenciaEditorElemento();
        editor.innerHTML = `
          <div class="as-editor-card as-coverage-form">
            <h3>${esVacante ? 'CUBRIR VACANTE' : 'CREAR COBERTURA TEMPORAL'}</h3>
            <p><b>${asistenciaEsc(asignacion.full_name || 'VACANTE')}</b><br>${asistenciaEsc([asignacion.province, asignacion.project, asignacion.post].filter(Boolean).join(' · '))}</p>
            <div class="as-form-grid">
              <label class="as-form-wide">PERSONA QUE CUBRE<div class="as-personnel-picker"><select id="as-cobertura-persona"><option value="">SELECCIONA PERSONAL…</option>${opciones}</select><button type="button" onclick="abrirAgregarPersonaCoberturaAsistencia('${asistenciaEsc(assignmentId)}')">＋ AGREGAR PERSONA</button></div></label>
              <label>MOTIVO<select id="as-cobertura-motivo">${motivos}</select></label>
              <label>FECHA INICIAL<input id="as-cobertura-inicio" type="date" min="${inicioMes}" max="${finMes}" value="${inicio}"></label>
              <label>FECHA FINAL PREVISTA<input id="as-cobertura-fin" type="date" min="${inicio}" value="${fin}"></label>
              <label class="as-form-wide">OBSERVACIÓN<textarea id="as-cobertura-nota" rows="3" placeholder="DETALLE DEL PERMISO, FALTA O COBERTURA">${asistenciaEsc(borrador?.nota || '')}</textarea></label>
            </div>
            <div class="as-editor-actions"><button class="primary" onclick="guardarCoberturaAsistencia('${asistenciaEsc(assignmentId)}')">GUARDAR COBERTURA</button><button onclick="cerrarEditorAsistencia()">CANCELAR</button></div>
          </div>`;
        editor.style.display = 'flex';
        if (borrador?.motivo && document.querySelector(`#as-cobertura-motivo option[value="${borrador.motivo}"]`)) {
            document.getElementById('as-cobertura-motivo').value = borrador.motivo;
        }
        document.getElementById('as-cobertura-inicio').addEventListener('change', event => {
            const finInput = document.getElementById('as-cobertura-fin');
            finInput.min = event.target.value;
            if (finInput.value < event.target.value) finInput.value = event.target.value;
        });
    } catch (error) {
        alert(`NO SE PUDO PREPARAR LA COBERTURA: ${error.message || error}`);
    }
}

function guardarBorradorCoberturaAsistencia(assignmentId) {
    asistenciaModulo.borradorCobertura = {
        assignmentId,
        persona: document.getElementById('as-cobertura-persona')?.value || '',
        motivo: document.getElementById('as-cobertura-motivo')?.value || '',
        inicio: document.getElementById('as-cobertura-inicio')?.value || '',
        fin: document.getElementById('as-cobertura-fin')?.value || '',
        nota: document.getElementById('as-cobertura-nota')?.value.trim() || ''
    };
}

function abrirAgregarPersonaCoberturaAsistencia(assignmentId) {
    guardarBorradorCoberturaAsistencia(assignmentId);
    const editor = asistenciaEditorElemento();
    editor.innerHTML = `
      <div class="as-editor-card as-coverage-form">
        <h3>AGREGAR PERSONA PARA COBERTURA</h3>
        <p>REGISTRA PERSONAL INTERNO DE APOYO O UNA PERSONA EXTERNA QUE NO ESTÉ EN EL LISTADO.</p>
        <div class="as-form-grid">
          <label class="as-form-wide">NOMBRES Y APELLIDOS<input id="as-nueva-persona-nombre" type="text" maxlength="150" placeholder="NOMBRE COMPLETO"></label>
          <label>CÉDULA<input id="as-nueva-persona-cedula" type="text" inputmode="numeric" maxlength="10" placeholder="10 DÍGITOS"></label>
          <label>TIPO DE PERSONAL<select id="as-nueva-persona-tipo"><option value="INTERNO">INTERNO DE APOYO</option><option value="EXTERNO">EXTERNO</option></select></label>
        </div>
        <div class="as-editor-actions"><button class="primary" onclick="guardarNuevaPersonaCoberturaAsistencia('${asistenciaEsc(assignmentId)}')">AGREGAR Y SELECCIONAR</button><button onclick="abrirNuevaCoberturaAsistencia('${asistenciaEsc(assignmentId)}')">VOLVER</button></div>
      </div>`;
    editor.style.display = 'flex';
    const cedula = document.getElementById('as-nueva-persona-cedula');
    cedula.addEventListener('input', () => { cedula.value = cedula.value.replace(/\D/g, '').slice(0, 10); });
}

async function guardarNuevaPersonaCoberturaAsistencia(assignmentId) {
    if (asistenciaModulo.guardando) return;
    const nombre = document.getElementById('as-nueva-persona-nombre')?.value.trim().toUpperCase();
    const cedula = document.getElementById('as-nueva-persona-cedula')?.value.trim();
    const tipo = document.getElementById('as-nueva-persona-tipo')?.value;
    if (!nombre || nombre.length < 5) {
        alert('INGRESA LOS NOMBRES Y APELLIDOS COMPLETOS.');
        return;
    }
    if (!/^\d{10}$/.test(cedula || '')) {
        alert('LA CÉDULA DEBE CONTENER EXACTAMENTE 10 DÍGITOS.');
        return;
    }
    asistenciaModulo.guardando = true;
    try {
        const respuesta = await supabaseRpc('create_attendance_support_personnel', {
            p_national_id: cedula,
            p_full_name: nombre,
            p_personnel_type: tipo
        });
        const persona = respuesta?.personnel;
        if (!respuesta?.ok || !persona?.id) throw new Error('SUPABASE NO DEVOLVIÓ LA PERSONA REGISTRADA.');
        const catalogo = asistenciaModulo.coberturas?.personnel || [];
        if (!catalogo.some(p => p.id === persona.id)) catalogo.push(persona);
        catalogo.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'es'));
        if (asistenciaModulo.borradorCobertura) asistenciaModulo.borradorCobertura.persona = persona.id;
        asistenciaModulo.guardando = false;
        await abrirNuevaCoberturaAsistencia(assignmentId, persona.id);
        alert(respuesta.already_existed
            ? 'LA PERSONA YA ESTABA REGISTRADA Y FUE SELECCIONADA.'
            : 'PERSONA AGREGADA Y SELECCIONADA CORRECTAMENTE.');
    } catch (error) {
        alert(`NO SE PUDO AGREGAR LA PERSONA: ${error.message || error}`);
    } finally {
        asistenciaModulo.guardando = false;
    }
}

async function guardarCoberturaAsistencia(assignmentId) {
    if (asistenciaModulo.guardando) return;
    const persona = document.getElementById('as-cobertura-persona')?.value;
    const motivo = document.getElementById('as-cobertura-motivo')?.value;
    const inicio = document.getElementById('as-cobertura-inicio')?.value;
    const fin = document.getElementById('as-cobertura-fin')?.value;
    const nota = document.getElementById('as-cobertura-nota')?.value.trim();
    if (!persona || !motivo || !inicio || !fin) {
        alert('SELECCIONA LA PERSONA, EL MOTIVO Y EL RANGO DE FECHAS.');
        return;
    }
    if (fin < inicio) {
        alert('LA FECHA FINAL NO PUEDE SER ANTERIOR A LA FECHA INICIAL.');
        return;
    }
    asistenciaModulo.guardando = true;
    try {
        await supabaseRpc('create_attendance_coverage', {
            p_target_assignment_id: assignmentId,
            p_replacement_personnel_id: persona,
            p_reason: motivo,
            p_start_date: inicio,
            p_end_date: fin,
            p_note: nota || null
        });
        asistenciaModulo.borradorCobertura = null;
        cerrarEditorAsistencia();
        await refrescarCoberturasAsistencia();
        alert('COBERTURA REGISTRADA CORRECTAMENTE.');
    } catch (error) {
        alert(`NO SE PUDO CREAR LA COBERTURA: ${error.message || error}`);
    } finally {
        asistenciaModulo.guardando = false;
    }
}

async function abrirGestorCoberturasAsistencia() {
    if (asistenciaModulo.guardando) return;
    try {
        const datos = await cargarCoberturasAsistencia(true);
        const filas = datos.coverages || [];
        const contenido = filas.length ? filas.map(c => {
            const cancelable = datos.permissions?.cancel && ['ACTIVA', 'PROGRAMADA'].includes(c.status);
            const motivo = String(c.reason || '').replaceAll('_', ' ');
            return `<article class="as-coverage-card">
              <div class="as-coverage-card-head"><span class="as-coverage-state as-coverage-state-${asistenciaEsc(String(c.status).toLowerCase())}">${asistenciaEsc(c.status)}</span><b>${asistenciaEsc(motivo)}</b></div>
              <h4>${asistenciaEsc(c.target_name || 'VACANTE')} <span>→</span> ${asistenciaEsc(c.replacement_name)}</h4>
              <p>${asistenciaEsc([c.province, c.project, c.post].filter(Boolean).join(' · '))}</p>
              <p><b>${asistenciaFechaLocal(c.start_date)}</b> HASTA <b>${asistenciaFechaLocal(c.actual_end_date || c.planned_end_date)}</b></p>
              ${c.note ? `<small>OBSERVACIÓN: ${asistenciaEsc(c.note)}</small>` : ''}
              ${c.cancellation_reason ? `<small>CANCELACIÓN: ${asistenciaEsc(c.cancellation_reason)}</small>` : ''}
              ${cancelable ? `<button class="danger" onclick="abrirCancelarCoberturaAsistencia('${asistenciaEsc(c.id)}')">CANCELAR ANTICIPADAMENTE</button>` : ''}
            </article>`;
        }).join('') : '<div class="as-empty-coverages">NO EXISTEN COBERTURAS EN ESTE PERIODO.</div>';
        const editor = asistenciaEditorElemento();
        editor.innerHTML = `<div class="as-editor-card as-coverage-manager"><div class="as-manager-head"><div><h3>COBERTURAS DEL PERIODO</h3><p>${asistenciaMesEtiqueta(datos.month_start)} · ${filas.length} REGISTRO(S)</p></div><button onclick="cerrarEditorAsistencia()">✕ CERRAR</button></div><div class="as-coverage-list">${contenido}</div></div>`;
        editor.style.display = 'flex';
    } catch (error) {
        alert(`NO SE PUDIERON CARGAR LAS COBERTURAS: ${error.message || error}`);
    }
}

function abrirCancelarCoberturaAsistencia(coverageId) {
    const cobertura = (asistenciaModulo.coberturas?.coverages || []).find(c => c.id === coverageId);
    if (!cobertura) return;
    const hoy = asistenciaHoyEcuador();
    const fecha = hoy > cobertura.planned_end_date ? cobertura.planned_end_date : hoy;
    const editor = asistenciaEditorElemento();
    editor.innerHTML = `<div class="as-editor-card as-coverage-form"><h3>CANCELAR COBERTURA ANTICIPADAMENTE</h3><p><b>${asistenciaEsc(cobertura.replacement_name)}</b><br>${asistenciaEsc([cobertura.project, cobertura.post].filter(Boolean).join(' · '))}</p><div class="as-form-grid"><label>ÚLTIMO DÍA EFECTIVO<input id="as-cancelar-fecha" type="date" max="${asistenciaEsc(cobertura.planned_end_date)}" value="${asistenciaEsc(fecha)}"></label><label class="as-form-wide">MOTIVO DE CANCELACIÓN<textarea id="as-cancelar-motivo" rows="3" placeholder="EXPLICA POR QUÉ TERMINA ANTES"></textarea></label></div><div class="as-editor-actions"><button class="danger" onclick="cancelarCoberturaAsistencia('${asistenciaEsc(coverageId)}')">CONFIRMAR CANCELACIÓN</button><button onclick="abrirGestorCoberturasAsistencia()">VOLVER</button></div></div>`;
    editor.style.display = 'flex';
}

async function cancelarCoberturaAsistencia(coverageId) {
    if (asistenciaModulo.guardando) return;
    const fecha = document.getElementById('as-cancelar-fecha')?.value;
    const motivo = document.getElementById('as-cancelar-motivo')?.value.trim();
    if (!fecha || !motivo) {
        alert('LA FECHA EFECTIVA Y EL MOTIVO DE CANCELACIÓN SON OBLIGATORIOS.');
        return;
    }
    if (!confirm('¿CONFIRMAS LA CANCELACIÓN ANTICIPADA DE ESTA COBERTURA?')) return;
    asistenciaModulo.guardando = true;
    try {
        await supabaseRpc('cancel_attendance_coverage', {
            p_coverage_id: coverageId,
            p_effective_end_date: fecha,
            p_reason: motivo
        });
        cerrarEditorAsistencia();
        await refrescarCoberturasAsistencia();
        asistenciaModulo.guardando = false;
        await abrirGestorCoberturasAsistencia();
    } catch (error) {
        alert(`NO SE PUDO CANCELAR LA COBERTURA: ${error.message || error}`);
    } finally {
        asistenciaModulo.guardando = false;
    }
}

async function refrescarCoberturasAsistencia() {
    const periodId = asistenciaModulo.workspace?.period?.id || null;
    asistenciaModulo.coberturas = null;
    await cargarWorkspaceAsistencia(periodId);
    await cargarCoberturasAsistencia(true);
}

function asistenciaFechaEnPeriodo(fecha, inicioMes) {
    return Boolean(fecha && fecha >= inicioMes && fecha < asistenciaSumarDias(inicioMes, asistenciaDiasMes(inicioMes)));
}

function asistenciaDatosReporteMensual() {
    const w = asistenciaModulo.workspace;
    const coberturas = asistenciaModulo.coberturas?.coverages || [];
    const apoyos = new Set(coberturas.map(c => c.support_assignment_id).filter(Boolean));
    const ingresos = [], salidas = [], faltas = [], vacantes = [];
    (w.assignments || []).forEach(a => {
        if (!apoyos.has(a.assignment_id) && asistenciaFechaEnPeriodo(a.employment_start_date, w.period.month_start)) ingresos.push(a);
        if (!apoyos.has(a.assignment_id) && asistenciaFechaEnPeriodo(a.employment_end_date, w.period.month_start)) salidas.push(a);
        if (a.status === 'VACANTE') vacantes.push(a);
        const injustificadas = [], medicos = [];
        Object.entries(a.days || {}).forEach(([dia, codigo]) => {
            if (codigo === 'F') injustificadas.push(Number(dia));
            if (codigo === 'PM') medicos.push(Number(dia));
        });
        if (injustificadas.length || medicos.length) faltas.push({ ...a, injustificadas, medicos });
    });
    return { ingresos, salidas, faltas, vacantes, coberturas };
}

function asistenciaNombrePeriodoArchivo() {
    return String(asistenciaModulo.workspace?.period?.month_start || 'PERIODO').slice(0, 7);
}

function generarPDFCierreAsistencia() {
    try {
        if (!window.jspdf?.jsPDF) throw new Error('NO SE ENCONTRÓ EL GENERADOR PDF.');
        const w = asistenciaModulo.workspace;
        const datos = asistenciaDatosReporteMensual();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const subtitulo = `REPORTE MENSUAL DE NOVEDADES DE ASISTENCIA · ${asistenciaMesEtiqueta(w.period.month_start)}`;
        const fechaEmision = asistenciaFechaLocal(asistenciaHoyEcuador());
        const dibujarPagina = () => dibujarMembretePDF(doc, subtitulo, fechaEmision, { mayusculas: true });
        dibujarPagina();
        let y = MARGEN_PDF + 7;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(15, 23, 42);
        doc.text('REPORTE MENSUAL DE NOVEDADES DE ASISTENCIA', 14, y); y += 7;
        doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        doc.text(`${asistenciaMesEtiqueta(w.period.month_start)} · ${w.assignments.length} ASIGNACIONES · ${w.summary?.personnel || 0} PERSONAS`, 14, y); y += 8;

        const seccion = (titulo, encabezados, filas, color) => {
            if (!filas.length) return;
            if (y > 170) { doc.addPage(); dibujarPagina(); y = MARGEN_PDF + 7; }
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
            doc.text(`${titulo} (${filas.length})`, 14, y); y += 4;
            doc.autoTable({
                startY: y, head: [encabezados], body: filas,
                margin: { left: 14, right: 14, top: MARGEN_PDF + 5, bottom: MARGEN_PDF + 4 },
                headStyles: { fillColor: color, textColor: [255,255,255], fontSize: 6.5, halign: 'center' },
                styles: { fontSize: 6.3, cellPadding: 1.8, valign: 'middle', overflow: 'linebreak' },
                alternateRowStyles: { fillColor: [248,250,252] },
                didDrawPage: dibujarPagina
            });
            y = doc.lastAutoTable.finalY + 7;
        };

        seccion('FALTAS Y PERMISOS MÉDICOS', ['PERSONAL','CÉDULA','PROYECTO','PUESTO','F','PM'], datos.faltas.map(a => [a.full_name || '—',a.national_id || '—',a.project || '—',a.post || '—',a.injustificadas.join(', ') || '—',a.medicos.join(', ') || '—']), [217,119,6]);
        seccion('COBERTURAS TEMPORALES', ['ESTADO','MOTIVO','TITULAR / VACANTE','PERSONA QUE CUBRE','UBICACIÓN','DESDE','HASTA'], datos.coberturas.map(c => [c.status,String(c.reason || '').replaceAll('_',' '),c.target_name || 'VACANTE',c.replacement_name || '—',[c.project,c.post].filter(Boolean).join(' · '),asistenciaFechaLocal(c.start_date),asistenciaFechaLocal(c.actual_end_date || c.planned_end_date)]), [37,99,235]);
        seccion('VACANTES', ['PROVINCIA','PROYECTO','PUESTO','HORARIO'], datos.vacantes.map(a => [a.province || '—',a.project || '—',a.post || '—',a.schedule || '—']), [220,38,38]);
        seccion('INGRESOS', ['FECHA','PERSONAL','CÉDULA','PROVINCIA','PROYECTO','PUESTO'], datos.ingresos.map(a => [asistenciaFechaLocal(a.employment_start_date),a.full_name || '—',a.national_id || '—',a.province || '—',a.project || '—',a.post || '—']), [22,163,74]);
        seccion('SALIDAS', ['FECHA','PERSONAL','CÉDULA','PROVINCIA','PROYECTO','PUESTO'], datos.salidas.map(a => [asistenciaFechaLocal(a.employment_end_date),a.full_name || '—',a.national_id || '—',a.province || '—',a.project || '—',a.post || '—']), [71,85,105]);

        if (![datos.faltas, datos.coberturas, datos.vacantes, datos.ingresos, datos.salidas].some(lista => lista.length)) {
            doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(100,116,139);
            doc.text('NO EXISTEN NOVEDADES REGISTRADAS EN ESTE PERIODO.', 14, y);
        }
        const total = doc.getNumberOfPages();
        const anchoPagina = doc.internal.pageSize.getWidth();
        const altoPagina = doc.internal.pageSize.getHeight();
        for (let pagina = 1; pagina <= total; pagina++) {
            doc.setPage(pagina); doc.setFontSize(6.5); doc.setTextColor(100,116,139);
            doc.text(`PÁGINA ${pagina} DE ${total}`, anchoPagina - 14, altoPagina - 5, { align: 'right' });
        }
        doc.save(`NOVEDADES_ASISTENCIA_${asistenciaNombrePeriodoArchivo()}_DEFEN.pdf`);
        asistenciaModulo.cierre.pdf = true;
        renderAsistenteCierreAsistencia();
    } catch (error) {
        alert(`NO SE PUDO GENERAR EL PDF: ${error.message || error}`);
    }
}

function generarExcelCierreAsistencia() {
    try {
        if (!window.XLSX) throw new Error('NO SE ENCONTRÓ EL GENERADOR EXCEL.');
        const w = asistenciaModulo.workspace;
        const datos = asistenciaDatosReporteMensual();
        const dias = asistenciaDiasMes(w.period.month_start);
        const libro = XLSX.utils.book_new();
        const matriz = (w.assignments || []).map((a, indice) => {
            const fila = {
                'N°': indice + 1, 'ESTADO': a.status, 'CÉDULA': a.national_id || '',
                'PERSONAL': a.full_name || 'VACANTE', 'PROVINCIA': a.province || '',
                'PROYECTO': a.project || '', 'PUESTO': a.post || '', 'HORARIO': a.schedule || '',
                'INICIO': a.employment_start_date || '', 'FIN': a.employment_end_date || ''
            };
            for (let dia = 1; dia <= dias; dia++) fila[`DÍA ${dia}`] = a.days?.[dia] || '';
            return fila;
        });
        const resumen = [{
            'PERIODO': w.period.month_start, 'ESTADO': w.period.status,
            'ASIGNACIONES': w.summary?.assignments || 0, 'PERSONAS': w.summary?.personnel || 0,
            'VACANTES': w.summary?.vacancies || 0, 'SACAFRANCOS': w.summary?.mobile_coverage || 0,
            'FALTAS INJUSTIFICADAS': w.summary?.unjustified_absences || 0,
            'PERMISOS MÉDICOS': w.summary?.justified_absences || 0,
            'COBERTURAS': datos.coberturas.length
        }];
        const coberturas = datos.coberturas.map(c => ({
            'ESTADO': c.status, 'MOTIVO': String(c.reason || '').replaceAll('_',' '),
            'TITULAR O VACANTE': c.target_name || 'VACANTE', 'PERSONA QUE CUBRE': c.replacement_name || '',
            'CÉDULA APOYO': c.replacement_national_id || '', 'PROVINCIA': c.province || '',
            'PROYECTO': c.project || '', 'PUESTO': c.post || '', 'DESDE': c.start_date || '',
            'HASTA PREVISTO': c.planned_end_date || '', 'HASTA EFECTIVO': c.actual_end_date || '',
            'OBSERVACIÓN': c.note || '', 'CANCELACIÓN': c.cancellation_reason || ''
        }));
        const novedades = [];
        datos.faltas.forEach(a => {
            a.injustificadas.forEach(dia => novedades.push({'TIPO':'FALTA INJUSTIFICADA','DÍA':dia,'PERSONAL':a.full_name || '','CÉDULA':a.national_id || '','PROYECTO':a.project || '','PUESTO':a.post || ''}));
            a.medicos.forEach(dia => novedades.push({'TIPO':'PERMISO MÉDICO','DÍA':dia,'PERSONAL':a.full_name || '','CÉDULA':a.national_id || '','PROYECTO':a.project || '','PUESTO':a.post || ''}));
        });
        datos.ingresos.forEach(a => novedades.push({'TIPO':'INGRESO','FECHA':a.employment_start_date,'PERSONAL':a.full_name || '','CÉDULA':a.national_id || '','PROYECTO':a.project || '','PUESTO':a.post || ''}));
        datos.salidas.forEach(a => novedades.push({'TIPO':'SALIDA','FECHA':a.employment_end_date,'PERSONAL':a.full_name || '','CÉDULA':a.national_id || '','PROYECTO':a.project || '','PUESTO':a.post || ''}));
        const agregarHoja = (nombre, filas) => {
            const hoja = XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'INFORMACIÓN': 'SIN REGISTROS' }]);
            hoja['!cols'] = Object.keys(filas[0] || { 'INFORMACIÓN': '' }).map(campo => ({ wch: Math.min(45, Math.max(12, campo.length + 3)) }));
            XLSX.utils.book_append_sheet(libro, hoja, nombre);
        };
        agregarHoja('RESUMEN', resumen);
        agregarHoja('MATRIZ MENSUAL', matriz);
        agregarHoja('NOVEDADES', novedades);
        agregarHoja('COBERTURAS', coberturas);
        XLSX.writeFile(libro, `RESPALDO_ASISTENCIA_${asistenciaNombrePeriodoArchivo()}_DEFEN.xlsx`);
        asistenciaModulo.cierre.excel = true;
        renderAsistenteCierreAsistencia();
    } catch (error) {
        alert(`NO SE PUDO GENERAR EL EXCEL: ${error.message || error}`);
    }
}

async function abrirCierreMensualAsistencia() {
    if (asistenciaModulo.guardando) return;
    const periodId = asistenciaModulo.workspace?.period?.id;
    if (!periodId) return;
    try {
        const preview = await supabaseRpc('preview_attendance_month_closure', { p_period_id: periodId });
        if (!preview || preview.schema_version !== 1) throw new Error('CONTRATO DE CIERRE INCOMPATIBLE.');
        if (asistenciaModulo.cierre.periodId !== periodId) {
            asistenciaModulo.cierre = { periodId, preview, pdf: false, excel: false };
        } else {
            asistenciaModulo.cierre.preview = preview;
        }
        renderAsistenteCierreAsistencia();
    } catch (error) {
        alert(`NO SE PUDO PREPARAR EL CIERRE: ${error.message || error}`);
    }
}

function renderAsistenteCierreAsistencia() {
    const estado = asistenciaModulo.cierre;
    const p = estado.preview;
    if (!p) return;
    const c = p.counts || {};
    const puedeGestionar = Boolean(p.permissions?.close);
    const problemas = (p.issues || []).map(i => `<li>${asistenciaEsc(i)}</li>`).join('');
    const cierreHtml = p.can_close && puedeGestionar ? `
      <div class="as-close-confirm">
        <p>ESCRIBE <b>${asistenciaEsc(p.required_confirmation)}</b> PARA CONFIRMAR:</p>
        <input id="as-cierre-confirmacion" autocomplete="off" placeholder="${asistenciaEsc(p.required_confirmation)}">
        <button onclick="ejecutarCierreMensualAsistencia()" ${estado.pdf && estado.excel ? '' : 'disabled'}>CERRAR MES Y ABRIR ${asistenciaEsc(asistenciaMesEtiqueta(p.next_month))}</button>
      </div>` : `
      <div class="as-close-blocked"><b>CIERRE TODAVÍA BLOQUEADO</b><ul>${problemas || '<li>NO TIENES PERMISO PARA EJECUTAR EL CIERRE.</li>'}</ul></div>`;
    const editor = asistenciaEditorElemento();
    editor.innerHTML = `<div class="as-editor-card as-close-manager">
      <div class="as-manager-head"><div><h3>CIERRE MENSUAL DE ASISTENCIA</h3><p>${asistenciaMesEtiqueta(p.month_start)} · ÚLTIMO DÍA ${asistenciaFechaLocal(p.last_day)}</p></div><button onclick="cerrarEditorAsistencia()">✕ CERRAR</button></div>
      <div class="as-close-kpis"><div><span>ASIGNACIONES</span><b>${c.assignments || 0}</b></div><div><span>PERSONAS</span><b>${c.personnel || 0}</b></div><div><span>VACANTES</span><b>${c.vacancies || 0}</b></div><div><span>MARCACIONES</span><b>${c.entries || 0}</b></div><div><span>CONTINUARÁN</span><b>${c.continuing_assignments || 0}</b></div><div><span>COBERTURAS</span><b>${c.continuing_coverages || 0}</b></div></div>
      <div class="as-close-reports"><button onclick="generarPDFCierreAsistencia()"><b>${estado.pdf ? '✓' : '1'}</b><span>REPORTE PDF</span><small>NOVEDADES, VACANTES Y COBERTURAS</small></button><button onclick="generarExcelCierreAsistencia()"><b>${estado.excel ? '✓' : '2'}</b><span>RESPALDO EXCEL</span><small>MATRIZ COMPLETA DEL PERIODO</small></button></div>
      ${cierreHtml}
      <p class="as-close-note">EL SIGUIENTE MES CONSERVARÁ LAS ASIGNACIONES Y COBERTURAS VIGENTES, PERO COMENZARÁ SIN MARCACIONES.</p>
    </div>`;
    editor.style.display = 'flex';
}

async function ejecutarCierreMensualAsistencia() {
    if (asistenciaModulo.guardando) return;
    const estado = asistenciaModulo.cierre, p = estado.preview;
    const confirmacion = document.getElementById('as-cierre-confirmacion')?.value.trim().toUpperCase();
    if (!estado.pdf || !estado.excel) {
        alert('GENERA Y CONSERVA EL PDF Y EL EXCEL ANTES DE CERRAR.'); return;
    }
    if (!p?.can_close) { alert('EL CIERRE TODAVÍA NO ESTÁ HABILITADO.'); return; }
    if (confirmacion !== p.required_confirmation) {
        alert(`ESCRIBE EXACTAMENTE: ${p.required_confirmation}`); return;
    }
    if (!confirm(`ESTA ACCIÓN CERRARÁ DEFINITIVAMENTE ${asistenciaMesEtiqueta(p.month_start)} Y ABRIRÁ ${asistenciaMesEtiqueta(p.next_month)}.\n\n¿CONFIRMAS EL CIERRE?`)) return;
    asistenciaModulo.guardando = true;
    try {
        const respuesta = await supabaseRpc('close_attendance_month', {
            p_period_id: p.period_id,
            p_confirmation: confirmacion,
            p_reports_generated: true
        });
        if (!respuesta?.ok) throw new Error('SUPABASE NO CONFIRMÓ EL CIERRE.');
        cerrarEditorAsistencia();
        asistenciaModulo.cierre = { periodId: null, preview: null, pdf: false, excel: false };
        await cargarWorkspaceAsistencia(null);
        await cargarCoberturasAsistencia(true);
        if (typeof cargarDatos === 'function') cargarDatos().catch(() => {});
        alert(`CIERRE COMPLETADO. NUEVO PERIODO: ${asistenciaMesEtiqueta(respuesta.new_month)}.`);
    } catch (error) {
        alert(`NO SE PUDO CERRAR EL MES: ${error.message || error}`);
    } finally {
        asistenciaModulo.guardando = false;
    }
}

function editarMarcacionAsistencia(assignmentId, dia, codigoActual) {
    if (asistenciaModulo.guardando) return;
    const w = asistenciaModulo.workspace;
    if (!w?.permissions?.manage || w.period.status !== 'OPEN') return;
    const editor = asistenciaEditorElemento();
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
