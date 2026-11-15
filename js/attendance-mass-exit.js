// ================================================================
// attendance-mass-exit.js — Salida masiva de personal desde Excel
// Flujo: elegir motivo/proyecto → descargar plantilla → subir archivo →
// validar (vista previa en la base, sin guardar) → confirmar.
// ================================================================
(function () {
  const esc = (v) => (typeof asistenciaEsc === 'function' ? asistenciaEsc(v) : String(v ?? ''));
  const estado = { filas: [], resultado: null, archivo: '' };

  function normalizarTexto(v) {
    return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  function normalizarCedula(v) {
    let c = String(v ?? '').replace(/\D/g, '');
    if (c.length === 9) c = '0' + c; // Excel elimina el cero inicial
    return c;
  }

  function isoLocal(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }

  function normalizarFecha(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) {
      // SheetJS puede devolver la medianoche con desfase horario: se redondea al día más cercano
      return isoLocal(new Date(v.getTime() + 12 * 3600 * 1000));
    }
    if (typeof v === 'number' && typeof XLSX !== 'undefined') {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/); // DD/MM/AAAA (formato Ecuador)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return s;
  }

  function nombresCoinciden(archivo, sistema) {
    if (!archivo || !sistema) return true;
    const a = new Set(normalizarTexto(archivo).split(' ').filter((p) => p.length > 2));
    const b = normalizarTexto(sistema).split(' ').filter((p) => p.length > 2);
    return b.some((p) => a.has(p));
  }

  function motivoSeleccionado() {
    const tipo = document.getElementById('as-ms-motivo')?.value || '';
    const detalle = (document.getElementById('as-ms-otro')?.value || '').trim();
    if (tipo === 'OTROS') return detalle.length >= 3 ? `OTROS: ${detalle}` : '';
    return tipo;
  }

  window.abrirSalidaMasivaAsistencia = function () {
    const w = asistenciaModulo.workspace;
    const permitido = typeof tienePermiso === 'function'
      ? tienePermiso('asistencia.salida_masiva', ['operaciones', 'coordinacion_general', 'central_monitoreo'])
      : Boolean(w?.permissions?.manage);
    if (!w || !permitido || w.period.status !== 'OPEN') {
      return alert('NO TIENES PERMISO PARA REGISTRAR SALIDAS MASIVAS O EL PERIODO ESTÁ CERRADO.');
    }
    estado.filas = []; estado.resultado = null; estado.archivo = '';
    const conPersonal = new Set((w.assignments || []).filter((a) => ['ACTIVO', 'CAMBIO'].includes(a.status)).map((a) => a.project_id));
    const proyectos = (w.projects || []).filter((p) => conPersonal.has(p.id))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
    const opciones = proyectos.map((p) => `<option value="${esc(p.id)}">${esc(p.province || '')} · ${esc(p.name)}</option>`).join('');
    const editor = asistenciaEditorElemento();
    editor.innerHTML = `<div class="as-editor-card as-coverage-form as-mass-exit">
      <h3>SALIDA MASIVA DE PERSONAL (EXCEL)</h3>
      <p>1) ELIGE EL MOTIVO Y EL PROYECTO · 2) DESCARGA LA PLANTILLA (YA VIENE CON EL PERSONAL DEL PROYECTO) · 3) BORRA A QUIEN NO SALE, COMPLETA LA FECHA Y SÚBELA · 4) VALIDA Y CONFIRMA. <b>NADA SE GUARDA HASTA QUE CONFIRMES.</b></p>
      <div class="as-form-grid">
        <label>MOTIVO<select id="as-ms-motivo" onchange="document.getElementById('as-ms-otro-wrap').style.display=this.value==='OTROS'?'':'none'">
          <option value="TERMINACION DE PROYECTO">TERMINACIÓN DE PROYECTO (NO CREA VACANTE)</option>
          <option value="RENUNCIA VOLUNTARIA">RENUNCIA VOLUNTARIA (CREA VACANTE)</option>
          <option value="OTROS">OTROS (CREA VACANTE)</option></select></label>
        <label>PROYECTO<select id="as-ms-proyecto"><option value="">TODOS LOS PROYECTOS</option>${opciones}</select></label>
        <label class="as-form-wide" id="as-ms-otro-wrap" style="display:none">DETALLE DEL MOTIVO<input id="as-ms-otro" maxlength="120" placeholder="ESPECIFICA EL MOTIVO"></label>
        <label>FECHA DE SALIDA POR DEFECTO (OPCIONAL)<input id="as-ms-fecha" type="date" min="${esc(w.period.month_start)}" max="${esc(asistenciaFinPeriodo())}"></label>
        <label>ARCHIVO EXCEL<input id="as-ms-archivo" type="file" accept=".xlsx,.xls,.csv" onchange="leerArchivoSalidaMasivaAsistencia(this)"></label>
        <label class="as-form-wide as-ms-check"><input id="as-ms-borrar" type="checkbox"> BORRAR MARCACIONES REGISTRADAS DESPUÉS DE LA FECHA DE SALIDA (SI NO, ESAS FILAS DARÁN ERROR)</label>
      </div>
      <div id="as-ms-vista" class="as-ms-vista"></div>
      <div class="as-editor-actions">
        <button onclick="descargarPlantillaSalidaMasivaAsistencia()">⇩ DESCARGAR PLANTILLA</button>
        <button id="as-ms-validar" onclick="validarSalidaMasivaAsistencia()" disabled>✓ VALIDAR ARCHIVO</button>
        <button id="as-ms-confirmar" class="danger" onclick="confirmarSalidaMasivaAsistencia()" style="display:none">CONFIRMAR SALIDAS</button>
        <button onclick="cerrarEditorAsistencia()">CANCELAR</button>
      </div></div>`;
    editor.style.display = 'flex';
  };

  window.descargarPlantillaSalidaMasivaAsistencia = function () {
    const w = asistenciaModulo.workspace;
    const proyectoId = document.getElementById('as-ms-proyecto')?.value || '';
    const fecha = document.getElementById('as-ms-fecha')?.value || '';
    const vistos = new Set();
    const filas = (w.assignments || [])
      .filter((a) => ['ACTIVO', 'CAMBIO'].includes(a.status) && a.national_id && (!proyectoId || a.project_id === proyectoId))
      .filter((a) => !vistos.has(a.national_id) && vistos.add(a.national_id))
      .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'es'))
      .map((a) => ({ CEDULA: a.national_id, NOMBRE: a.full_name, FECHA_SALIDA: fecha ? fecha.split('-').reverse().join('/') : '', PROYECTO: a.project || '', PUESTO: a.post || '' }));
    if (!filas.length) filas.push({ CEDULA: '', NOMBRE: '', FECHA_SALIDA: '', PROYECTO: '', PUESTO: '' });
    const ws = XLSX.utils.json_to_sheet(filas, { header: ['CEDULA', 'NOMBRE', 'FECHA_SALIDA', 'PROYECTO', 'PUESTO'] });
    // Cédula como texto para conservar el cero inicial
    for (let i = 2; i <= filas.length + 1; i++) { const c = ws[`A${i}`]; if (c) { c.t = 's'; c.v = String(c.v); } }
    ws['!cols'] = [{ wch: 13 }, { wch: 38 }, { wch: 14 }, { wch: 28 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SALIDAS');
    const instrucciones = XLSX.utils.aoa_to_sheet([
      ['INSTRUCCIONES'],
      ['1. Deja solo a las personas que salen (borra las filas de quien se queda).'],
      ['2. FECHA_SALIDA = último día trabajado, formato DD/MM/AAAA, dentro del mes abierto.'],
      ['3. PROYECTO y PUESTO son solo de referencia; el sistema identifica a cada persona por su CÉDULA.'],
      ['4. Sube el archivo en Asistencia → SALIDA MASIVA y pulsa VALIDAR antes de confirmar.']
    ]);
    instrucciones['!cols'] = [{ wch: 95 }];
    XLSX.utils.book_append_sheet(wb, instrucciones, 'INSTRUCCIONES');
    const nombreProyecto = (w.projects || []).find((p) => p.id === proyectoId)?.name || 'TODOS';
    XLSX.writeFile(wb, `Plantilla_Salida_Masiva_${normalizarTexto(nombreProyecto).replace(/[^A-Z0-9]+/g, '_')}.xlsx`);
  };

  window.leerArchivoSalidaMasivaAsistencia = async function (input) {
    const archivo = input.files?.[0];
    estado.filas = []; estado.resultado = null;
    document.getElementById('as-ms-confirmar').style.display = 'none';
    const vista = document.getElementById('as-ms-vista');
    if (!archivo) { vista.innerHTML = ''; document.getElementById('as-ms-validar').disabled = true; return; }
    try {
      const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true });
      const hoja = libro.Sheets.SALIDAS || libro.Sheets[libro.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: true });
      const idxEncabezado = matriz.findIndex((fila) => fila.some((c) => normalizarTexto(c).includes('CEDULA')));
      if (idxEncabezado < 0) throw new Error('NO SE ENCONTRÓ LA COLUMNA "CEDULA". USA LA PLANTILLA.');
      const enc = matriz[idxEncabezado].map(normalizarTexto);
      const col = (clave) => enc.findIndex((h) => h.includes(clave));
      const cCed = col('CEDULA'), cNom = col('NOMBRE'), cFec = col('FECHA');
      if (cFec < 0) throw new Error('NO SE ENCONTRÓ LA COLUMNA "FECHA_SALIDA". USA LA PLANTILLA.');
      const fechaDefecto = document.getElementById('as-ms-fecha')?.value || '';
      matriz.slice(idxEncabezado + 1).forEach((fila, i) => {
        const cedula = normalizarCedula(fila[cCed]);
        const nombre = cNom >= 0 ? String(fila[cNom] || '').trim() : '';
        if (!cedula && !nombre) return; // fila vacía
        estado.filas.push({ row: idxEncabezado + i + 2, national_id: cedula, full_name: nombre, exit_date: normalizarFecha(fila[cFec]) || fechaDefecto });
      });
      if (!estado.filas.length) throw new Error('EL ARCHIVO NO TIENE PERSONAS.');
      if (estado.filas.length > 500) throw new Error('MÁXIMO 500 PERSONAS POR ARCHIVO.');
      estado.archivo = archivo.name;
      vista.innerHTML = `<div class="as-ms-resumen">📄 ${esc(archivo.name)} · <b>${estado.filas.length}</b> PERSONA(S) LEÍDAS. PULSA <b>VALIDAR ARCHIVO</b>.</div>`;
      document.getElementById('as-ms-validar').disabled = false;
    } catch (e) {
      vista.innerHTML = `<div class="as-ms-resumen as-ms-error">${esc(e.message || e)}</div>`;
      document.getElementById('as-ms-validar').disabled = true;
    }
  };

  function renderResultado(r, esPrueba) {
    const filasArchivo = new Map(estado.filas.map((f) => [f.row, f]));
    const filas = (r.results || []).map((x) => {
      const original = filasArchivo.get(x.row) || {};
      const aviso = x.status === 'OK' && !nombresCoinciden(original.full_name, x.system_name)
        ? `<br><small class="as-ms-aviso">⚠ EL NOMBRE DEL ARCHIVO ("${esc(original.full_name)}") NO COINCIDE: REVISA LA CÉDULA</small>` : '';
      return `<tr class="${x.status === 'OK' ? 'as-ms-ok' : 'as-ms-err'}"><td>${esc(x.row)}</td><td>${esc(x.national_id)}</td><td>${esc(x.system_name || original.full_name || '—')}</td><td>${esc((original.exit_date || '').split('-').reverse().join('/'))}</td><td><b>${x.status === 'OK' ? '✔' : '✖'}</b> ${esc(x.detail)}${aviso}</td></tr>`;
    }).join('');
    const titulo = esPrueba
      ? `VISTA PREVIA: <b>${r.processed}</b> LISTA(S) PARA SALIR · <b>${r.errors}</b> CON ERROR. ${r.errors ? 'LAS FILAS CON ERROR NO SE PROCESARÁN.' : ''}`
      : `RESULTADO: <b>${r.processed}</b> SALIDA(S) REGISTRADA(S) · <b>${r.errors}</b> CON ERROR.`;
    document.getElementById('as-ms-vista').innerHTML = `<div class="as-ms-resumen ${!esPrueba && !r.errors ? 'as-ms-exito' : ''}">${titulo}</div>
      <div class="as-ms-tabla"><table><thead><tr><th>FILA</th><th>CÉDULA</th><th>NOMBRE EN SISTEMA</th><th>SALIDA</th><th>RESULTADO</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }

  function payload(dryRun, filas) {
    return {
      reason: motivoSeleccionado(),
      project_id: document.getElementById('as-ms-proyecto')?.value || null,
      dry_run: dryRun,
      delete_later_entries: Boolean(document.getElementById('as-ms-borrar')?.checked),
      rows: filas
    };
  }

  window.validarSalidaMasivaAsistencia = async function () {
    if (asistenciaModulo.guardando) return;
    if (!motivoSeleccionado()) return alert('ESPECIFICA EL MOTIVO (MÍNIMO 3 CARACTERES EN "OTROS").');
    if (!estado.filas.length) return alert('PRIMERO SUBE EL ARCHIVO.');
    asistenciaModulo.guardando = true;
    const boton = document.getElementById('as-ms-validar');
    boton.disabled = true; boton.textContent = 'VALIDANDO…';
    try {
      const r = await supabaseRpc('register_attendance_mass_exit', { p_payload: payload(true, estado.filas) });
      estado.resultado = r;
      renderResultado(r, true);
      const confirmar = document.getElementById('as-ms-confirmar');
      confirmar.style.display = r.processed > 0 ? '' : 'none';
      confirmar.textContent = `CONFIRMAR SALIDA DE ${r.processed} PERSONA(S)`;
    } catch (e) {
      alert(`NO SE PUDO VALIDAR: ${e.message || e}`);
    } finally {
      asistenciaModulo.guardando = false;
      boton.disabled = false; boton.textContent = '✓ VALIDAR ARCHIVO';
    }
  };

  window.confirmarSalidaMasivaAsistencia = async function () {
    if (asistenciaModulo.guardando || !estado.resultado) return;
    const filasOk = new Set((estado.resultado.results || []).filter((x) => x.status === 'OK').map((x) => x.row));
    const filas = estado.filas.filter((f) => filasOk.has(f.row));
    if (!filas.length) return;
    const motivo = motivoSeleccionado();
    const efecto = motivo === 'TERMINACION DE PROYECTO' ? 'NO SE CREARÁN VACANTES.' : 'CADA PUESTO QUEDARÁ COMO VACANTE.';
    if (!confirm(`¿CONFIRMAS LA SALIDA DE ${filas.length} PERSONA(S) POR "${motivo}"?\n${efecto}`)) return;
    asistenciaModulo.guardando = true;
    const boton = document.getElementById('as-ms-confirmar');
    boton.disabled = true; boton.textContent = 'REGISTRANDO…';
    try {
      const r = await supabaseRpc('register_attendance_mass_exit', { p_payload: payload(false, filas) });
      estado.resultado = r;
      renderResultado(r, false);
      boton.style.display = 'none';
      document.getElementById('as-ms-validar').style.display = 'none';
      asistenciaModulo.guardando = false;
      await recargarModuloAsistencia();
    } catch (e) {
      alert(`NO SE PUDIERON REGISTRAR LAS SALIDAS: ${e.message || e}`);
      boton.disabled = false; boton.textContent = `CONFIRMAR SALIDA DE ${filas.length} PERSONA(S)`;
    } finally {
      asistenciaModulo.guardando = false;
    }
  };
})();
