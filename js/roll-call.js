// ================================================================
// roll-call.js — Toma de lista por turno (Diurno / Tarde / Nocturno)
// Cada marca queda por turno; la cuadrícula mensual (D, T, N, DN, F, PM)
// se actualiza sola. Turnos extra: PAGADO / NO PAGADO; los apoyos externos
// (personal no registrado) siempre son PAGADOS. Los permisos médicos quedan
// con certificado PENDIENTE hasta subirlo. Pensado para celular y computador.
// ================================================================
(function () {
  const st = { ws: null, projectId: '', date: '', shift: '', candidatos: null, candidatosClave: '', ocupado: false, filtro: '' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fechaTexto = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
  const ESTADOS = { PRESENTE: { txt: 'PRESENTE', cls: 'rc-ok' }, FALTA: { txt: 'FALTA', cls: 'rc-falta' }, PERMISO: { txt: 'PERMISO MÉDICO', cls: 'rc-pm' } };

  function modal() {
    let m = document.getElementById('rc-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'rc-modal';
    m.className = 'rc-modal';
    m.innerHTML = `<div class="rc-shell">
      <header class="rc-header">
        <div class="rc-title"><h2>📋 TOMA DE LISTA</h2><p id="rc-sub">CARGANDO…</p></div>
        <div class="rc-header-actions"><button onclick="abrirTurnosExtraTomaLista()">💵 TURNOS EXTRA</button><button onclick="recargarTomaLista()">↻</button><button onclick="cerrarTomaLista()">✕ CERRAR</button></div>
      </header>
      <section class="rc-controls">
        <label>PROYECTO<select id="rc-proyecto" onchange="cambiarProyectoTomaLista(this.value)"></select></label>
        <label>FECHA<input id="rc-fecha" type="date" onchange="cambiarFechaTomaLista(this.value)"></label>
        <label class="rc-buscar">BUSCAR<input id="rc-buscar" placeholder="NOMBRE O CÉDULA" oninput="filtrarTomaLista(this.value)"></label>
      </section>
      <nav id="rc-turnos" class="rc-turnos"></nav>
      <section id="rc-resumen" class="rc-resumen"></section>
      <div id="rc-cuerpo" class="rc-cuerpo"><div class="rc-vacio">CARGANDO…</div></div>
    </div>`;
    document.body.appendChild(m);
    return m;
  }

  const rpc = (nombre, payload) => supabaseRpc(nombre, payload);

  // El panel de selección vive en <body> para poder abrirse también fuera de la toma de lista
  function pickerEl() {
    let p = document.getElementById('rc-picker');
    if (!p) { p = document.createElement('div'); p.id = 'rc-picker'; p.className = 'rc-picker'; document.body.appendChild(p); }
    return p;
  }

  window.abrirTomaListaAsistencia = async function (projectId = '') {
    if (typeof usuarioPuedeGestionarAsistencia === 'function' && !usuarioPuedeGestionarAsistencia()) {
      return alert('NO TIENES PERMISO PARA TOMAR LISTA.');
    }
    modal().style.display = 'flex';
    st.projectId = projectId || st.projectId || '';
    st.date = ''; st.shift = '';
    await cargar();
  };

  window.cerrarTomaLista = function () {
    const m = document.getElementById('rc-modal');
    if (m) m.style.display = 'none';
    if (document.getElementById('asistencia-modal')?.style.display === 'flex' && typeof recargarModuloAsistencia === 'function') {
      recargarModuloAsistencia().catch(() => {});
    }
  };
  window.recargarTomaLista = () => cargar(true);
  window.cambiarProyectoTomaLista = (id) => { st.projectId = id; st.shift = ''; cargar(); };
  window.cambiarFechaTomaLista = (fecha) => { st.date = fecha; cargar(); };
  window.cambiarTurnoTomaLista = (turno) => { st.shift = turno; st.candidatos = null; render(); };
  window.filtrarTomaLista = (texto) => { st.filtro = texto.trim().toUpperCase(); render(); };

  async function cargar(forzarCandidatos = false) {
    const cuerpo = document.getElementById('rc-cuerpo');
    try {
      let ws = await rpc('get_roll_call_workspace', { p_project_id: st.projectId || null, p_date: st.date || null });
      if (!st.projectId && ws.projects?.length) {
        st.projectId = ws.projects[0].id;
        ws = await rpc('get_roll_call_workspace', { p_project_id: st.projectId, p_date: st.date || null });
      }
      st.ws = ws;
      st.date = ws.date;
      const turnos = turnosProyecto();
      if (!st.shift || !turnos.some((t) => t.shift === st.shift)) {
        st.shift = ws.now?.date === ws.date && turnos.some((t) => t.shift === ws.now.shift) ? ws.now.shift : (turnos[0]?.shift || 'D');
      }
      if (forzarCandidatos) st.candidatos = null;
      render();
    } catch (e) {
      cuerpo.innerHTML = `<div class="rc-vacio rc-error">${esc(e.message || e)}</div>`;
    }
  }

  function turnosProyecto() {
    const esquema = st.ws?.project?.scheme || '12H';
    return (st.ws?.shifts || []).filter((t) => t.scheme === esquema);
  }
  function turnoActual() { return turnosProyecto().find((t) => t.shift === st.shift) || {}; }

  const chipPago = (c) => c?.payment
    ? `<span class="rc-chip ${c.payment === 'PAGADO' ? 'rc-pago' : 'rc-nopago'}">${c.payment === 'PAGADO' ? '💵 EXTRA PAGADO' : 'EXTRA NO PAGADO'}</span>` : '';
  const chipExterno = (c) => c?.is_external ? '<span class="rc-chip rc-ext">APOYO EXTERNO</span>' : '';
  function bloqueCertificado(c) {
    if (!c || c.status !== 'PERMISO' || !c.incident_id) return '';
    if (c.document_path) return `<div class="rc-cert rc-cert-ok">📄 CERTIFICADO SUBIDO <button onclick="verCertificadoTomaLista('${encodeURIComponent(c.document_path)}')">VER</button></div>`;
    return `<div class="rc-cert">📎 CERTIFICADO MÉDICO PENDIENTE ${st.ws?.can_edit ? `<button onclick="subirCertificadoTomaLista('${esc(c.incident_id)}')">SUBIR AHORA</button>` : ''}</div>`;
  }

  function render() {
    const ws = st.ws;
    if (!ws) return;
    document.getElementById('rc-proyecto').innerHTML = (ws.projects || []).map((p) =>
      `<option value="${esc(p.id)}" ${p.id === st.projectId ? 'selected' : ''}>${esc(p.province || '')} · ${esc(p.name)}</option>`).join('');
    document.getElementById('rc-fecha').value = ws.date;
    const t = turnoActual();
    const ahora = ws.now?.date === ws.date && ws.now?.shift === st.shift;
    document.getElementById('rc-sub').textContent = `${ws.project?.name || 'SIN PROYECTO'} · ${fechaTexto(ws.date)} · ${t.label || ''} ${t.start || ''}–${t.end || ''}${ahora ? ' · TURNO EN CURSO' : ''}${ws.can_edit ? '' : ' · SOLO LECTURA'}`;
    document.getElementById('rc-turnos').innerHTML = turnosProyecto().map((x) => `<button class="${x.shift === st.shift ? 'activo' : ''}" onclick="cambiarTurnoTomaLista('${esc(x.shift)}')">
        <b>${esc(x.label)}</b><small>${esc(x.start)} – ${esc(x.end)}${ws.now?.date === ws.date && ws.now?.shift === x.shift ? ' · AHORA' : ''}</small></button>`).join('');

    const checksTurno = (ws.checks || []).filter((c) => c.shift === st.shift);
    const porPersona = new Map(checksTurno.map((c) => [c.personnel_id, c]));
    const porId = new Map((ws.checks || []).map((c) => [c.id, c]));
    const coberturaDe = new Map(checksTurno.filter((c) => c.covers_check_id).map((c) => [c.covers_check_id, c]));
    const asignaciones = ws.assignments || [];
    const coincide = (nombre, cedula) => !st.filtro || String(nombre || '').toUpperCase().includes(st.filtro) || String(cedula || '').includes(st.filtro);

    const grupos = (ws.posts || []).map((p) => ({ id: p.id, nombre: p.name, requeridos: p.required, miembros: [], vacantes: [], visitas: [] }));
    const grupoPorId = new Map(grupos.map((g) => [g.id, g]));
    const sinPuesto = { id: null, nombre: 'SACAFRANCOS Y PERSONAL SIN PUESTO FIJO', miembros: [], vacantes: [], visitas: [] };
    asignaciones.forEach((a) => {
      const g = grupoPorId.get(a.post_id) || sinPuesto;
      if (a.status === 'VACANTE') g.vacantes.push(a); else g.miembros.push(a);
    });
    checksTurno.forEach((c) => {
      const g = grupoPorId.get(c.post_id);
      if (g && !g.miembros.some((m) => m.personnel_id === c.personnel_id)) g.visitas.push(c);
    });
    if (sinPuesto.miembros.length || sinPuesto.vacantes.length) grupos.push(sinPuesto);

    const puestosReales = grupos.filter((g) => g.id);
    const cubiertos = puestosReales.filter((g) => checksTurno.some((c) => c.post_id === g.id && c.status === 'PRESENTE')).length;
    const cuenta = (s) => checksTurno.filter((c) => c.status === s).length;
    const personasActivas = asignaciones.filter((a) => a.status !== 'VACANTE').length;
    const sinMarcar = asignaciones.filter((a) => a.status !== 'VACANTE' && !porPersona.has(a.personnel_id)).length;
    const certPendientes = (ws.checks || []).filter((c) => c.status === 'PERMISO' && c.incident_id && !c.document_path).length;
    const extras = checksTurno.filter((c) => c.payment).length;
    document.getElementById('rc-resumen').innerHTML = `
      <div class="${cubiertos === puestosReales.length && puestosReales.length ? 'rc-k-ok' : 'rc-k-mal'}"><span>PUESTOS CUBIERTOS</span><strong>${cubiertos}/${puestosReales.length}</strong></div>
      <div><span>PRESENTES</span><strong>${cuenta('PRESENTE')}</strong></div>
      <div><span>FALTAS / PERMISOS</span><strong>${cuenta('FALTA')} / ${cuenta('PERMISO')}</strong></div>
      <div><span>TURNOS EXTRA</span><strong>${extras}</strong></div>
      <div class="${certPendientes ? 'rc-k-mal' : ''}"><span>CERT. PENDIENTES (DÍA)</span><strong>${certPendientes}</strong></div>
      <div><span>SIN MARCAR</span><strong>${sinMarcar}/${personasActivas}</strong></div>`;

    const filaGuardia = (a, check, grupo) => {
      const enOtroPuesto = Boolean(check && check.post_id && check.post_id !== grupo.id);
      const estado = check ? ESTADOS[check.status] : null;
      const insignias = [];
      if (a.schedule) insignias.push(`<span class="rc-chip">${esc(a.schedule)}</span>`);
      if (a.status === 'APOYO') insignias.push('<span class="rc-chip rc-ext">APOYO</span>');
      if (check?.status === 'PRESENTE' && Number(check.presents_today) >= 2) insignias.push('<span class="rc-chip rc-dn">DN · DOBLA TURNO</span>');
      if (enOtroPuesto) insignias.push(`<span class="rc-chip rc-mov">EN ESTE TURNO: ${esc(check.post_name)}</span>`);
      if (check?.covers_check_id) insignias.push(`<span class="rc-chip rc-cov">CUBRE A ${esc(porId.get(check.covers_check_id)?.full_name || 'AUSENTE')}</span>`);
      insignias.push(chipPago(check), chipExterno(check));
      const cubridor = check ? coberturaDe.get(check.id) : null;
      if (check && check.status !== 'PRESENTE') insignias.push(cubridor
        ? `<span class="rc-chip rc-cov">CUBIERTO POR ${esc(cubridor.full_name)}${Number(cubridor.presents_today) >= 2 ? ' (DN)' : ''}</span>`
        : '<span class="rc-chip rc-mal">SIN REEMPLAZO</span>');
      const botones = st.ws.can_edit ? `<div class="rc-acciones">
          <button class="rc-b-ok ${check?.status === 'PRESENTE' && !enOtroPuesto ? 'activo' : ''}" onclick="marcarTomaLista('${esc(a.assignment_id)}','PRESENTE')">✔ PRESENTE</button>
          <button class="rc-b-falta ${check?.status === 'FALTA' ? 'activo' : ''}" onclick="marcarTomaLista('${esc(a.assignment_id)}','FALTA')">F</button>
          <button class="rc-b-pm ${check?.status === 'PERMISO' ? 'activo' : ''}" onclick="marcarTomaLista('${esc(a.assignment_id)}','PERMISO')">PM</button>
          <button class="rc-b-mas" onclick="masAccionesTomaLista('${esc(a.assignment_id)}')">⋯</button>
        </div>` : '';
      return `<article class="rc-guardia ${estado ? estado.cls : 'rc-pend'}">
        <div class="rc-g-info"><b>${esc(a.full_name || 'SIN NOMBRE')}</b><small>${a.national_id ? 'CI ' + esc(a.national_id) : 'SIN CÉDULA'}${a.mobile_phone ? ' · 📞 ' + esc(a.mobile_phone) : ''}</small>
          <div class="rc-chips">${estado ? `<span class="rc-chip ${estado.cls}">${estado.txt}</span>` : '<span class="rc-chip">SIN MARCAR</span>'}${insignias.join('')}</div>
          ${bloqueCertificado(check)}</div>
        ${botones}</article>`;
    };

    const filaVisita = (c) => {
      const cubierto = c.covers_check_id ? porId.get(c.covers_check_id) : null;
      return `<article class="rc-guardia rc-ok rc-visita">
        <div class="rc-g-info"><b>${esc(c.full_name)}</b><small>${c.is_external ? 'PERSONAL EXTERNO' : 'DE ' + esc(c.home_project || '') + ' · ' + esc(c.home_post || '')}</small>
          <div class="rc-chips"><span class="rc-chip rc-ok">PRESENTE EN ESTE PUESTO</span>${Number(c.presents_today) >= 2 ? '<span class="rc-chip rc-dn">DN · DOBLA TURNO</span>' : ''}${cubierto ? `<span class="rc-chip rc-cov">CUBRE A ${esc(cubierto.full_name)}</span>` : ''}${chipPago(c)}${chipExterno(c)}</div></div>
        ${st.ws.can_edit ? `<div class="rc-acciones"><button class="rc-b-mas" onclick="deshacerTomaLista('${esc(c.id)}')">↶ QUITAR</button></div>` : ''}</article>`;
    };

    const html = grupos.map((g) => {
      const miembros = g.miembros.filter((a) => coincide(a.full_name, a.national_id));
      const visitas = g.visitas.filter((c) => coincide(c.full_name, c.national_id));
      if (st.filtro && !miembros.length && !visitas.length) return '';
      let semaforo = '';
      if (g.id) {
        const presentes = checksTurno.filter((c) => c.post_id === g.id && c.status === 'PRESENTE');
        const marcas = checksTurno.filter((c) => c.post_id === g.id);
        semaforo = presentes.length
          ? `<span class="rc-sem rc-sem-ok">🟢 CUBIERTO · ${presentes.length} GUARDIA${presentes.length === 1 ? '' : 'S'}</span>`
          : (marcas.length ? '<span class="rc-sem rc-sem-mal">🔴 SIN GUARDIA</span>' : '<span class="rc-sem">⚪ SIN MARCAR</span>');
      }
      const vacantes = g.vacantes.map(() => `<article class="rc-guardia rc-vac"><div class="rc-g-info"><b>VACANTE</b><small>PUESTO SIN TITULAR</small></div>
          ${st.ws.can_edit && g.id ? `<div class="rc-acciones"><button class="rc-b-ok" onclick="agregarGuardiaTomaLista('${esc(g.id)}')">CUBRIR ESTE TURNO</button><button class="rc-b-mas" onclick="ingresoVacanteTomaLista()">INGRESO</button></div>` : ''}</article>`).join('');
      return `<section class="rc-puesto">
        <header><div><h3>${esc(g.nombre)}</h3>${g.requeridos ? `<small>${esc(g.requeridos)} AGENTE(S) REQUERIDO(S)</small>` : ''}</div>${semaforo}</header>
        ${miembros.map((a) => filaGuardia(a, porPersona.get(a.personnel_id), g)).join('')}
        ${visitas.map(filaVisita).join('')}
        ${vacantes}
        ${st.ws.can_edit && g.id ? `<button class="rc-agregar" onclick="agregarGuardiaTomaLista('${esc(g.id)}')">➕ AGREGAR GUARDIA A ESTE PUESTO EN ESTE TURNO</button>` : ''}
      </section>`;
    }).join('');
    document.getElementById('rc-cuerpo').innerHTML = html || `<div class="rc-vacio">${ws.project ? 'NO HAY PERSONAL PARA ESTE FILTRO.' : 'NO HAY PROYECTOS CON PERSONAL ACTIVO.'}</div>`;
  }

  const asignacion = (id) => (st.ws?.assignments || []).find((a) => a.assignment_id === id);
  const checkDe = (personnelId) => (st.ws?.checks || []).find((c) => c.personnel_id === personnelId && c.shift === st.shift);

  async function guardar(payload) {
    if (st.ocupado) return false;
    st.ocupado = true;
    try {
      const r = await rpc('save_roll_call_check', { p_payload: { date: st.date, shift: st.shift, ...payload } });
      st.candidatos = null;
      await cargar();
      return r;
    } catch (e) {
      alert(`NO SE PUDO GUARDAR: ${e.message || e}`);
      return false;
    } finally { st.ocupado = false; }
  }

  // Pregunta si el turno extra es pagado. Devuelve 'PAGADO', 'NO_PAGADO', '' (no es extra) o null (cancelado).
  function preguntarPago(nombre, permitirNoExtra) {
    return new Promise((resolve) => {
      const picker = pickerEl();
      window.__rcPago = (valor) => { cerrarSelectorTomaLista(); resolve(valor); };
      picker.innerHTML = `<div class="rc-picker-card rc-menu">
        <h3>TURNO EXTRA DE ${esc(nombre)}</h3><p>¿ESTE TURNO SE LE PAGA?</p>
        <button class="rc-b-pago" onclick="__rcPago('PAGADO')">💵 SÍ, ES PAGADO</button>
        <button onclick="__rcPago('NO_PAGADO')">NO PAGADO</button>
        ${permitirNoExtra ? '<button onclick="__rcPago(\'\')">NO ES TURNO EXTRA (SOLO CAMBIO DE UBICACIÓN)</button>' : ''}
        <button class="rc-cancelar" onclick="__rcPago(null)">CANCELAR</button></div>`;
      picker.style.display = 'flex';
    });
  }

  window.marcarTomaLista = async function (assignmentId, estado) {
    const a = asignacion(assignmentId);
    if (!a) return;
    if (estado === 'PRESENTE') return guardar({ assignment_id: assignmentId, status: 'PRESENTE', post_id: a.post_id || null });
    abrirSelector({
      titulo: `¿QUIÉN CUBRE A ${a.full_name}?`,
      subtitulo: `${estado === 'FALTA' ? 'FALTA' : 'PERMISO MÉDICO'} · ${turnoActual().label || ''} ${fechaTexto(st.date)} · ${a.post_name || ''}`,
      excluir: a.personnel_id,
      sinCubrir: true,
      alElegir: async (sel) => {
        const base = { assignment_id: assignmentId, status: estado };
        if (!sel) return finalizarMarca(await guardar(base), estado);
        if (sel.external) return finalizarMarca(await guardar({ ...base, replacement_external: sel.external }), estado);
        const pago = await preguntarPago(sel.nombre, false);
        if (pago === null) return;
        return finalizarMarca(await guardar({ ...base, replacement_assignment_id: sel.assignmentId, replacement_payment: pago }), estado);
      }
    });
  };

  // Tras un permiso médico, ofrece subir el certificado (o dejarlo pendiente)
  function finalizarMarca(resultado, estado) {
    if (!resultado || estado !== 'PERMISO' || !resultado.incident_id) return;
    const picker = pickerEl();
    picker.innerHTML = `<div class="rc-picker-card rc-menu"><h3>CERTIFICADO MÉDICO</h3>
      <p>¿TIENES EL CERTIFICADO AHORA? SI NO, QUEDA PENDIENTE Y LO PUEDES SUBIR DESPUÉS DESDE ESTA LISTA O DESDE "COBERTURAS".</p>
      <button class="rc-b-pago" onclick="cerrarSelectorTomaLista();subirCertificadoTomaLista('${esc(resultado.incident_id)}')">📎 SUBIR CERTIFICADO AHORA</button>
      <button class="rc-cancelar" onclick="cerrarSelectorTomaLista()">DEJAR PENDIENTE</button></div>`;
    picker.style.display = 'flex';
  }

  window.subirCertificadoTomaLista = function (incidentId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      const archivo = input.files?.[0];
      if (!archivo) return;
      let ruta = '';
      try {
        ruta = await supabaseSubirDocumentoAsistencia(archivo, 'justificantes');
        await supabaseAdjuntarJustificanteAsistencia(incidentId, ruta);
        await cargar();
        alert('CERTIFICADO SUBIDO CORRECTAMENTE.');
      } catch (e) {
        if (ruta) try { await supabaseEliminarDocumentoAsistencia(ruta); } catch (_) {}
        alert(`NO SE PUDO SUBIR EL CERTIFICADO: ${e.message || e}`);
      }
    };
    input.click();
  };

  window.verCertificadoTomaLista = async function (rutaCodificada) {
    try { window.open(await supabaseUrlFirmadaDocumentoAsistencia(decodeURIComponent(rutaCodificada), 300), '_blank', 'noopener'); }
    catch (e) { alert(e.message || e); }
  };

  window.agregarGuardiaTomaLista = function (postId) {
    const puesto = (st.ws?.posts || []).find((p) => p.id === postId);
    abrirSelector({
      titulo: `AGREGAR GUARDIA A ${puesto?.name || 'PUESTO'}`,
      subtitulo: `${turnoActual().label || ''} ${fechaTexto(st.date)} · QUEDARÁ PRESENTE EN ESTE PUESTO`,
      alElegir: async (sel) => {
        if (!sel) return;
        if (sel.external) return guardar({ status: 'PRESENTE', post_id: postId, external: sel.external });
        const pago = await preguntarPago(sel.nombre, true);
        if (pago === null) return;
        return guardar({ assignment_id: sel.assignmentId, status: 'PRESENTE', post_id: postId, payment: pago || null });
      }
    });
  };

  window.deshacerTomaLista = async function (checkId) {
    if (!confirm('¿QUITAR ESTA MARCA? SI ERA UNA FALTA O PERMISO, TAMBIÉN SE QUITA SU REEMPLAZO.')) return;
    try { await rpc('delete_roll_call_check', { p_check_id: checkId }); st.candidatos = null; await cargar(); }
    catch (e) { alert(`NO SE PUDO QUITAR: ${e.message || e}`); }
  };

  window.ingresoVacanteTomaLista = function () {
    if (typeof abrirIngresoPersonalAsistencia === 'function' && asistenciaModulo?.workspace) abrirIngresoPersonalAsistencia();
    else alert('ABRE LA TOMA DE LISTA DESDE EL MÓDULO DE ASISTENCIA PARA REGISTRAR INGRESOS.');
  };

  window.masAccionesTomaLista = function (assignmentId) {
    const a = asignacion(assignmentId);
    const check = a ? checkDe(a.personnel_id) : null;
    const hayAsistencia = typeof asistenciaModulo !== 'undefined' && asistenciaModulo?.workspace;
    const picker = pickerEl();
    picker.innerHTML = `<div class="rc-picker-card rc-menu">
      <h3>${esc(a?.full_name || '')}</h3><p>${esc(a?.post_name || '')} · CI ${esc(a?.national_id || '—')}</p>
      ${check ? `<button onclick="cerrarSelectorTomaLista();deshacerTomaLista('${esc(check.id)}')">↶ QUITAR LA MARCA DE ESTE TURNO</button>` : ''}
      <button onclick="moverTurnoTomaLista('${esc(assignmentId)}')">⇄ MOVER A OTRO PUESTO SOLO ESTE TURNO</button>
      ${hayAsistencia && a?.status !== 'APOYO' ? `<button onclick="cerrarSelectorTomaLista();abrirCambioPuestoAsistencia('${esc(assignmentId)}')">⇄ CAMBIO DE PUESTO PERMANENTE</button>
      <button onclick="cerrarSelectorTomaLista();abrirSalidaPersonalAsistencia('${esc(assignmentId)}')">↪ REGISTRAR SALIDA</button>` : ''}
      ${typeof abrirGestionLlamadosAtencion === 'function' ? '<button onclick="cerrarSelectorTomaLista();abrirGestionLlamadosAtencion()">⚠ LLAMADO DE ATENCIÓN</button>' : ''}
      <button class="rc-cancelar" onclick="cerrarSelectorTomaLista()">CANCELAR</button></div>`;
    picker.style.display = 'flex';
  };

  window.moverTurnoTomaLista = function (assignmentId) {
    const a = asignacion(assignmentId);
    const picker = pickerEl();
    picker.innerHTML = `<div class="rc-picker-card rc-menu"><h3>MOVER A ${esc(a?.full_name || '')}</h3><p>SOLO PARA ESTE TURNO. QUEDA PRESENTE EN EL PUESTO ELEGIDO (NO CUENTA COMO TURNO EXTRA).</p>
      ${(st.ws?.posts || []).filter((p) => p.id !== a?.post_id).map((p) => `<button onclick="cerrarSelectorTomaLista();marcarEnPuestoTomaLista('${esc(assignmentId)}','${esc(p.id)}')">📍 ${esc(p.name)}</button>`).join('') || '<p>NO HAY OTROS PUESTOS EN ESTE PROYECTO.</p>'}
      <button class="rc-cancelar" onclick="cerrarSelectorTomaLista()">CANCELAR</button></div>`;
    picker.style.display = 'flex';
  };
  window.marcarEnPuestoTomaLista = (assignmentId, postId) => guardar({ assignment_id: assignmentId, status: 'PRESENTE', post_id: postId });

  window.cerrarSelectorTomaLista = function () {
    const picker = pickerEl();
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
  };

  // Selector de personal (reemplazo o agregar a puesto)
  let selectorActual = null;
  async function abrirSelector(opciones) {
    selectorActual = opciones;
    const picker = pickerEl();
    picker.innerHTML = `<div class="rc-picker-card"><h3>${esc(opciones.titulo)}</h3><p>${esc(opciones.subtitulo || '')}</p>
      <button class="rc-externo" onclick="formExternoTomaLista()">➕ PERSONAL EXTERNO (NO REGISTRADO) · APOYO PAGADO</button>
      <div id="rc-externo-form"></div>
      <input id="rc-picker-buscar" placeholder="BUSCAR NOMBRE, CÉDULA O PROYECTO" oninput="pintarSelectorTomaLista(this.value)">
      <div id="rc-picker-lista" class="rc-picker-lista"><div class="rc-vacio">CARGANDO PERSONAL…</div></div>
      <div class="rc-picker-pie">${opciones.sinCubrir ? '<button class="rc-b-falta" onclick="elegirTomaLista(null)">DEJAR SIN REEMPLAZO</button>' : ''}<button class="rc-cancelar" onclick="cerrarSelectorTomaLista()">CANCELAR</button></div></div>`;
    picker.style.display = 'flex';
    const clave = `${st.date}|${st.shift}`;
    try {
      if (!st.candidatos || st.candidatosClave !== clave) {
        st.candidatos = await rpc('get_roll_call_candidates', { p_date: st.date, p_shift: st.shift });
        st.candidatosClave = clave;
      }
      pintarSelectorTomaLista('');
    } catch (e) {
      document.getElementById('rc-picker-lista').innerHTML = `<div class="rc-vacio rc-error">${esc(e.message || e)}</div>`;
    }
  }

  window.formExternoTomaLista = function () {
    const cont = document.getElementById('rc-externo-form');
    if (!cont) return;
    cont.innerHTML = `<div class="rc-externo-form">
      <label>NOMBRES Y APELLIDOS *<input id="rc-ext-nombre" maxlength="120" placeholder="APELLIDOS Y NOMBRES"></label>
      <label>CÉDULA (SI LA TIENES)<input id="rc-ext-cedula" inputmode="numeric" maxlength="10" placeholder="10 DÍGITOS"></label>
      <label>TELÉFONO (OPCIONAL)<input id="rc-ext-telefono" inputmode="tel" maxlength="15"></label>
      <button class="rc-b-pago" onclick="confirmarExternoTomaLista()">REGISTRAR APOYO EXTERNO (PAGADO)</button></div>`;
    document.getElementById('rc-ext-nombre').focus();
  };

  window.confirmarExternoTomaLista = function () {
    const nombre = (document.getElementById('rc-ext-nombre')?.value || '').trim().toUpperCase();
    const cedula = (document.getElementById('rc-ext-cedula')?.value || '').replace(/\D/g, '');
    const telefono = (document.getElementById('rc-ext-telefono')?.value || '').trim();
    if (nombre.length < 5) return alert('ESCRIBE EL NOMBRE COMPLETO DEL APOYO.');
    if (cedula && !/^\d{9,10}$/.test(cedula)) return alert('LA CÉDULA DEBE TENER 10 DÍGITOS (O DÉJALA VACÍA).');
    elegirTomaLista({ external: { full_name: nombre, national_id: cedula || null, mobile_phone: telefono || null } });
  };

  window.pintarSelectorTomaLista = function (texto) {
    const lista = document.getElementById('rc-picker-lista');
    if (!lista || !st.candidatos) return;
    const q = String(texto || '').trim().toUpperCase();
    const proyecto = st.ws?.project?.id;
    const base = st.candidatos.filter((c) => c.personnel_id !== selectorActual?.excluir)
      .filter((c) => !q || `${c.full_name} ${c.national_id} ${c.project} ${c.post}`.toUpperCase().includes(q));
    const grupos = [
      ['DEL MISMO PROYECTO', base.filter((c) => c.project_id === proyecto && !c.is_mobile)],
      ['SACAFRANCOS', base.filter((c) => c.is_mobile)],
      ['OTROS PROYECTOS', base.filter((c) => c.project_id !== proyecto && !c.is_mobile)]
    ];
    const item = (c) => {
      const ocupado = c.this_shift;
      const dn = !ocupado && Number(c.presents_today) > 0;
      return `<button class="rc-cand ${ocupado ? 'rc-cand-ocupado' : ''}" ${ocupado ? 'disabled' : ''} onclick="elegirCandidatoTomaLista('${esc(c.assignment_id)}')">
        <b>${esc(c.full_name)}</b><small>${esc(c.project || '')} · ${esc(c.post || '')}</small>
        ${ocupado ? `<span class="rc-chip">${esc(ocupado.status)} EN ESTE TURNO${ocupado.post ? ' · ' + esc(ocupado.post) : ''}</span>` : ''}
        ${dn ? '<span class="rc-chip rc-dn">YA TRABAJÓ HOY → QUEDARÁ EN DN</span>' : ''}</button>`;
    };
    const limite = q ? 60 : 40;
    lista.innerHTML = grupos.filter(([, filas]) => filas.length).map(([titulo, filas]) =>
      `<h4>${titulo} (${filas.length})</h4>${filas.slice(0, limite).map(item).join('')}${filas.length > limite ? '<small class="rc-mas">ESCRIBE PARA BUSCAR MÁS…</small>' : ''}`).join('')
      || '<div class="rc-vacio">SIN RESULTADOS. SI NO ESTÁ REGISTRADO, USA "PERSONAL EXTERNO".</div>';
  };

  window.elegirCandidatoTomaLista = function (assignmentId) {
    const c = (st.candidatos || []).find((x) => x.assignment_id === assignmentId);
    elegirTomaLista({ assignmentId, nombre: c?.full_name || '' });
  };

  window.elegirTomaLista = async function (seleccion) {
    const opciones = selectorActual;
    cerrarSelectorTomaLista();
    if (opciones?.alElegir) await opciones.alElegir(seleccion);
  };

  // Resumen de turnos extra del mes (para pago) con exportación a Excel
  window.abrirTurnosExtraTomaLista = async function () {
    const picker = pickerEl();
    picker.innerHTML = '<div class="rc-picker-card rc-extras"><div class="rc-vacio">CARGANDO TURNOS EXTRA…</div></div>';
    picker.style.display = 'flex';
    try {
      const r = await rpc('get_roll_call_extra_shifts', { p_period_id: st.ws?.period?.id || null });
      window.__rcExtras = r;
      const personas = r.people || [];
      const totalPagados = personas.reduce((s, p) => s + Number(p.paid || 0), 0);
      const totalNoPagados = personas.reduce((s, p) => s + Number(p.unpaid || 0), 0);
      const mes = fechaTexto(r.period?.month_start).slice(3);
      picker.innerHTML = `<div class="rc-picker-card rc-extras">
        <h3>💵 TURNOS EXTRA · ${esc(mes)}</h3>
        <p>COBERTURAS DE FALTAS O PERMISOS, REFUERZOS Y APOYOS EXTERNOS REGISTRADOS EN LA TOMA DE LISTA.</p>
        <div class="rc-extras-tot"><div><span>TURNOS A PAGAR</span><strong>${totalPagados}</strong></div><div><span>NO PAGADOS</span><strong>${totalNoPagados}</strong></div><div><span>PERSONAS</span><strong>${personas.length}</strong></div></div>
        <div class="rc-picker-lista"><table class="rc-extras-tabla"><thead><tr><th>PERSONA</th><th>TIPO</th><th>PAGADOS</th><th>NO PAGADOS</th></tr></thead><tbody>
        ${personas.map((p) => `<tr><td><b>${esc(p.full_name)}</b><small>${esc(p.national_id || 'SIN CÉDULA')}</small></td><td>${p.external ? 'EXTERNO' : 'INTERNO'}</td><td class="rc-num">${p.paid}</td><td class="rc-num">${p.unpaid}</td></tr>`).join('') || '<tr><td colspan="4">SIN TURNOS EXTRA EN ESTE MES.</td></tr>'}
        </tbody></table></div>
        <div class="rc-picker-pie"><button class="rc-b-pago" onclick="exportarTurnosExtraTomaLista()" ${personas.length ? '' : 'disabled'}>⇩ EXPORTAR EXCEL</button><button class="rc-cancelar" onclick="cerrarSelectorTomaLista()">CERRAR</button></div></div>`;
    } catch (e) {
      picker.innerHTML = `<div class="rc-picker-card"><div class="rc-vacio rc-error">${esc(e.message || e)}</div><button class="rc-cancelar" onclick="cerrarSelectorTomaLista()">CERRAR</button></div>`;
    }
  };

  window.exportarTurnosExtraTomaLista = function () {
    const r = window.__rcExtras;
    if (!r || typeof XLSX === 'undefined') return;
    const resumen = (r.people || []).map((p) => ({ PERSONA: p.full_name, CEDULA: p.national_id || '', TIPO: p.external ? 'EXTERNO' : 'INTERNO', TURNOS_PAGADOS: Number(p.paid), TURNOS_NO_PAGADOS: Number(p.unpaid) }));
    const detalle = (r.details || []).map((d) => ({
      FECHA: fechaTexto(d.date), TURNO: d.label, PERSONA: d.full_name, CEDULA: d.national_id || '', TIPO: d.external ? 'EXTERNO' : 'INTERNO',
      PROYECTO: d.project || '', PUESTO: d.post || '', CUBRIO_A: d.covers || '', MOTIVO: d.covers_reason === 'PERMISO' ? 'PERMISO MÉDICO' : (d.covers_reason || 'REFUERZO / VACANTE'),
      PAGO: d.payment === 'PAGADO' ? 'PAGADO' : 'NO PAGADO'
    }));
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(resumen); ws1['!cols'] = [{ wch: 38 }, { wch: 13 }, { wch: 10 }, { wch: 16 }, { wch: 18 }];
    const ws2 = XLSX.utils.json_to_sheet(detalle); ws2['!cols'] = [{ wch: 11 }, { wch: 10 }, { wch: 36 }, { wch: 13 }, { wch: 10 }, { wch: 26 }, { wch: 28 }, { wch: 34 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'RESUMEN');
    XLSX.utils.book_append_sheet(wb, ws2, 'DETALLE');
    XLSX.writeFile(wb, `Turnos_Extra_${String(r.period?.month_start || '').slice(0, 7)}.xlsx`);
  };

  // Al cerrar formularios de asistencia abiertos desde la toma de lista, se refresca
  const cerrarEditorOriginal = window.cerrarEditorAsistencia;
  if (typeof cerrarEditorOriginal === 'function') {
    window.cerrarEditorAsistencia = function () {
      cerrarEditorOriginal.apply(this, arguments);
      if (document.getElementById('rc-modal')?.style.display === 'flex') cargar(true);
    };
  }
})();
