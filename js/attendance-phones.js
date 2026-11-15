// ================================================================
// attendance-phones.js — Completar teléfonos del personal
// Flujo: descargar plantilla (ya viene con el personal activo SIN
// teléfono) → escribir el TELEFONO → subir → validar (vista previa en la
// base, sin guardar) → confirmar. Cada cambio queda en el historial del
// personal (personnel_profile_events).
// ================================================================
(function () {
  const esc = (v) => (typeof asistenciaEsc === 'function' ? asistenciaEsc(v) : String(v ?? ''));
  const estado = { filas: [], resultado: null, archivo: '' };

  function normalizarCedula(v) {
    let c = String(v ?? '').replace(/\D/g, '');
    if (c.length === 9) c = '0' + c; // Excel elimina el cero inicial
    return c;
  }

  // Exportada: también la usa la importación de nómina de proyectos
  window.normalizarTelefonoPersonal = function (v) {
    let t = String(v ?? '').trim().replace(/[^+0-9]/g, '');
    // Excel convierte 0987654321 en el número 987654321: se repone el cero de los celulares de Ecuador
    if (/^9\d{8}$/.test(t)) t = '0' + t;
    return t;
  };
  window.telefonoPersonalValido = (t) => /^\+?[0-9]{7,15}$/.test(t);

  const permitido = () => (typeof tienePermiso === 'function'
    ? tienePermiso('asistencia.personal', ['operaciones'])
    : Boolean(asistenciaModulo.workspace?.permissions?.manage_contacts));
  window.usuarioPuedeCargarTelefonosPersonal = permitido;

  window.abrirCargaTelefonosAsistencia = function () {
    if (!permitido()) return alert('NO TIENES PERMISO PARA ACTUALIZAR TELÉFONOS DEL PERSONAL.');
    estado.filas = []; estado.resultado = null; estado.archivo = '';
    const editor = asistenciaEditorElemento();
    editor.innerHTML = `<div class="as-editor-card as-coverage-form as-mass-exit">
      <h3>📞 COMPLETAR TELÉFONOS DEL PERSONAL (EXCEL)</h3>
      <p>1) DESCARGA LA PLANTILLA (YA VIENE CON EL PERSONAL ACTIVO <b>SIN TELÉFONO</b>) · 2) ESCRIBE EL TELÉFONO EN LA COLUMNA TELEFONO (7 A 15 DÍGITOS) · 3) SÚBELA, VALIDA Y CONFIRMA. LAS FILAS SIN TELÉFONO SE IGNORAN. <b>NADA SE GUARDA HASTA QUE CONFIRMES.</b></p>
      <div class="as-form-grid">
        <label class="as-form-wide">ARCHIVO EXCEL<input id="as-tel-archivo" type="file" accept=".xlsx,.xls,.csv" onchange="leerArchivoTelefonosAsistencia(this)"></label>
      </div>
      <div id="as-tel-vista"></div>
      <div class="as-editor-actions">
        <button onclick="descargarPlantillaTelefonosAsistencia()">⇩ DESCARGAR PLANTILLA</button>
        <button id="as-tel-validar" onclick="validarTelefonosAsistencia()" disabled>✓ VALIDAR ARCHIVO</button>
        <button id="as-tel-confirmar" class="primary" onclick="confirmarTelefonosAsistencia()" style="display:none">CONFIRMAR TELÉFONOS</button>
        <button onclick="cerrarEditorAsistencia()">CANCELAR</button>
      </div></div>`;
    editor.style.display = 'flex';
  };

  window.descargarPlantillaTelefonosAsistencia = async function () {
    if (typeof XLSX === 'undefined') return alert('NO SE PUDO CARGAR EL GENERADOR DE EXCEL. RECARGA LA PÁGINA.');
    try {
      const personas = await supabaseRpc('get_personnel_without_phone', {});
      const filas = (personas || []).map((p) => ({ CEDULA: p.national_id || '', NOMBRE: p.full_name || '', TELEFONO: '', PROYECTO: p.project || '', PUESTO: p.post || '' }));
      if (!filas.length) filas.push({ CEDULA: '', NOMBRE: '', TELEFONO: '', PROYECTO: '', PUESTO: '' });
      const ws = XLSX.utils.json_to_sheet(filas, { header: ['CEDULA', 'NOMBRE', 'TELEFONO', 'PROYECTO', 'PUESTO'] });
      // Cédula y teléfono como texto para conservar el cero inicial
      for (let i = 2; i <= filas.length + 1; i++) {
        const c = ws[`A${i}`]; if (c) { c.t = 's'; c.v = String(c.v); }
        ws[`C${i}`] = { t: 's', v: '', z: '@' };
      }
      ws['!cols'] = [{ wch: 13 }, { wch: 38 }, { wch: 16 }, { wch: 28 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'TELEFONOS');
      const ayuda = XLSX.utils.aoa_to_sheet([
        ['INSTRUCCIONES'],
        ['1. Escribe el teléfono en la columna TELEFONO (solo números, 7 a 15 dígitos; puede empezar con +).'],
        ['2. Las filas con TELEFONO vacío se ignoran: puedes subir el archivo aunque falten teléfonos.'],
        ['3. No cambies CEDULA ni NOMBRE: el sistema verifica que coincidan.'],
        ['4. PROYECTO y PUESTO son solo de referencia.'],
        ['5. Sube el archivo en Asistencia → PERSONAL → TELÉFONOS y pulsa VALIDAR antes de confirmar.']
      ]);
      ayuda['!cols'] = [{ wch: 95 }];
      XLSX.utils.book_append_sheet(wb, ayuda, 'INSTRUCCIONES');
      XLSX.writeFile(wb, `PLANTILLA_TELEFONOS_PERSONAL_${(personas || []).length}.xlsx`);
    } catch (e) {
      alert(`NO SE PUDO GENERAR LA PLANTILLA: ${e.message || e}`);
    }
  };

  window.leerArchivoTelefonosAsistencia = async function (input) {
    const archivo = input?.files?.[0];
    const vista = document.getElementById('as-tel-vista');
    estado.filas = []; estado.resultado = null; estado.archivo = archivo?.name || '';
    document.getElementById('as-tel-confirmar').style.display = 'none';
    document.getElementById('as-tel-validar').disabled = true;
    if (!archivo) { vista.innerHTML = ''; return; }
    try {
      const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array', raw: false });
      const hoja = libro.Sheets.TELEFONOS || libro.Sheets[libro.SheetNames[0]];
      const crudas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: false });
      const clave = (k) => String(k).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
      const filas = crudas.filter((r) => Object.values(r).some((v) => String(v).trim())).map((r) => {
        const n = {}; Object.entries(r).forEach(([k, v]) => { n[clave(k)] = v; });
        return { national_id: normalizarCedula(n.CEDULA), full_name: String(n.NOMBRE || '').trim(), mobile_phone: normalizarTelefonoPersonal(n.TELEFONO || n.CELULAR || '') };
      });
      if (!filas.length) throw new Error('EL ARCHIVO NO CONTIENE FILAS.');
      if (!('TELEFONO' in Object.fromEntries(Object.keys(crudas[0] || {}).map((k) => [clave(k), 1])))) throw new Error('FALTA LA COLUMNA TELEFONO.');
      const conTelefono = filas.filter((f) => f.mobile_phone);
      const invalidos = conTelefono.filter((f) => !telefonoPersonalValido(f.mobile_phone)).length;
      estado.filas = filas;
      vista.innerHTML = `<div class="as-tel-resumen ${invalidos ? 'error' : 'ok'}"><b>${filas.length} FILA(S) LEÍDAS</b> · ${conTelefono.length} CON TELÉFONO · ${filas.length - conTelefono.length} SIN TELÉFONO (SE IGNORAN)${invalidos ? ` · <b>${invalidos} CON FORMATO INVÁLIDO</b>` : ''}. PULSA <b>VALIDAR ARCHIVO</b>.</div>`;
      document.getElementById('as-tel-validar').disabled = !conTelefono.length;
    } catch (e) {
      vista.innerHTML = `<div class="as-tel-resumen error">${esc(e.message || e)}</div>`;
    }
  };

  const resumenConteos = (c) => `${c.new || 0} NUEVO(S) · ${c.replaced || 0} REEMPLAZADO(S) · ${c.unchanged || 0} SIN CAMBIO · ${c.skipped || 0} FILA(S) SIN TELÉFONO`;

  window.validarTelefonosAsistencia = async function () {
    if (!estado.filas.length) return;
    const vista = document.getElementById('as-tel-vista');
    const boton = document.getElementById('as-tel-validar');
    boton.disabled = true; boton.textContent = 'VALIDANDO…';
    try {
      const r = await supabaseRpc('import_personnel_phones', { p_payload: { rows: estado.filas, source_file_name: estado.archivo }, p_dry_run: true });
      estado.resultado = r;
      if (!r.ok) {
        vista.innerHTML = `<div class="as-tel-resumen error"><b>ARCHIVO RECHAZADO (NO SE GUARDÓ NADA)</b><ul>${(r.errors || []).map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
      } else {
        const cambios = (r.counts.new || 0) + (r.counts.replaced || 0);
        vista.innerHTML = `<div class="as-tel-resumen ok"><b>VALIDACIÓN CORRECTA</b><p>${resumenConteos(r.counts)}.</p>${cambios ? '' : '<p>NO HAY TELÉFONOS NUEVOS PARA GUARDAR.</p>'}</div>`;
        document.getElementById('as-tel-confirmar').style.display = cambios ? '' : 'none';
      }
    } catch (e) {
      vista.innerHTML = `<div class="as-tel-resumen error">${esc(e.message || e)}</div>`;
    } finally {
      boton.disabled = false; boton.textContent = '✓ VALIDAR ARCHIVO';
    }
  };

  window.confirmarTelefonosAsistencia = async function () {
    const r0 = estado.resultado;
    if (!r0?.ok) return;
    const cambios = (r0.counts.new || 0) + (r0.counts.replaced || 0);
    if (!confirm(`SE GUARDARÁN ${cambios} TELÉFONO(S)${r0.counts.replaced ? ` (${r0.counts.replaced} REEMPLAZAN UN TELÉFONO EXISTENTE)` : ''}. ¿CONFIRMAS?`)) return;
    const boton = document.getElementById('as-tel-confirmar');
    boton.disabled = true; boton.textContent = 'GUARDANDO…';
    try {
      const r = await supabaseRpc('import_personnel_phones', { p_payload: { rows: estado.filas, source_file_name: estado.archivo }, p_dry_run: false });
      if (!r.ok) throw new Error((r.errors || []).join(' · ') || 'EL ARCHIVO FUE RECHAZADO');
      cerrarEditorAsistencia();
      await recargarModuloAsistencia();
      alert(`TELÉFONOS GUARDADOS: ${resumenConteos(r.counts)}.`);
    } catch (e) {
      alert(`NO SE PUDIERON GUARDAR LOS TELÉFONOS: ${e.message || e}`);
      boton.disabled = false; boton.textContent = 'CONFIRMAR TELÉFONOS';
    }
  };
})();
