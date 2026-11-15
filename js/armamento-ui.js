// ================================================================
// armamento-ui.js — Mejoras del inventario de armamento
//   1) Filtros compactos: un botón desplegable por grupo con casillas,
//      búsqueda interna y "pastillas" de filtros activos para quitarlos.
//   2) Edición de datos del arma (Administrador y Operaciones), incluida
//      la ubicación física / bloque del rastrillo, con historial.
//   3) Mover varias armas de bloque a la vez (casillas + barra flotante),
//      cada cambio queda en el historial de ediciones del arma.
// ================================================================
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (v) => (typeof normalizarTexto === 'function' ? normalizarTexto(v) : String(v || '').toLowerCase());
  let grupoAbierto = '';
  const busquedaGrupo = {};

  const ETIQUETAS_ESTADO = { activo: 'ACTIVO', transito: 'EN TRÁNSITO', rastrillo: 'RASTRILLO', perdida: 'PÉRDIDA', confiscada: 'CONFISCADA' };

  function gruposFiltro() {
    const unicos = (campo, base = armamentoDetalle) => [...new Set(base.map((a) => a[campo]).filter(Boolean))].sort((x, y) => String(x).localeCompare(String(y), 'es', { numeric: true }));
    const provincias = filtrosArmamento.provincia || [];
    const baseProyectos = provincias.length ? armamentoDetalle.filter((a) => provincias.includes(norm(a.provincia))) : armamentoDetalle;
    return [
      { key: 'estado', label: 'Estado', valores: ['activo', 'transito', 'rastrillo', 'perdida', 'confiscada'], etiqueta: (v) => ETIQUETAS_ESTADO[v] || v },
      { key: 'condicionTecnica', label: 'Condición', valores: unicos('condicionTecnica') },
      { key: 'provincia', label: 'Provincia', valores: unicos('provincia') },
      { key: 'proyecto', label: 'Proyecto', valores: unicos('proyecto', baseProyectos) },
      { key: 'ubicacion', label: 'Ubicación / bloque', valores: unicos('ubicacion') },
      { key: 'tipo', label: 'Tipo', valores: unicos('tipo') },
      { key: 'clase', label: 'Clase', valores: unicos('clase') },
      { key: 'categoria', label: 'Categoría', valores: unicos('categoria') }
    ];
  }

  function contar(key, valor) {
    // Cuántas armas quedarían con ese valor, respetando los demás filtros activos
    const otros = { ...filtrosArmamento, [key]: [] };
    return armamentoDetalle.filter((a) => {
      if (typeof armaPasaFiltrosGlobales === 'function' && !armaPasaFiltrosGlobales(a)) return false;
      return Object.keys(otros).every((g) => !otros[g]?.length || otros[g].includes(norm(a[g]))) && norm(a[key]) === norm(valor);
    }).length;
  }

  // Reemplaza la barra de chips por botones desplegables compactos
  window.renderFiltrosArmamento = function () {
    const bar = document.getElementById('armamento-filtros-bar');
    if (!bar) return;
    Object.keys(filtrosArmamento).forEach((k) => { if (!Array.isArray(filtrosArmamento[k])) filtrosArmamento[k] = []; });
    if (!filtrosArmamento.ubicacion) filtrosArmamento.ubicacion = [];
    const grupos = gruposFiltro();
    // Proyectos que ya no aplican a las provincias elegidas se quitan
    const proyectosValidos = new Set(grupos.find((g) => g.key === 'proyecto').valores.map(norm));
    filtrosArmamento.proyecto = filtrosArmamento.proyecto.filter((p) => proyectosValidos.has(p));

    const botones = grupos.map((g) => {
      const activos = filtrosArmamento[g.key] || [];
      const q = norm(busquedaGrupo[g.key] || '');
      const opciones = g.valores.filter((v) => !q || norm(v).includes(q));
      const panel = grupoAbierto === g.key ? `<div class="af-panel" onclick="event.stopPropagation()">
          ${g.valores.length > 8 ? `<input class="af-buscar" placeholder="Buscar ${esc(g.label.toLowerCase())}…" value="${esc(busquedaGrupo[g.key] || '')}" oninput="filtrarOpcionesArmamento('${g.key}', this.value)">` : ''}
          <div class="af-opciones">${opciones.map((v) => {
            const vn = norm(v);
            const n = contar(g.key, v);
            return `<label class="${n ? '' : 'af-cero'}"><input type="checkbox" ${activos.includes(vn) ? 'checked' : ''} onchange="toggleFiltroArmamento('${g.key}','${esc(vn)}')">
              <span>${esc(g.etiqueta ? g.etiqueta(vn) : v)}</span><small>${n}</small></label>`;
          }).join('') || '<p class="af-vacio">Sin opciones</p>'}</div>
          ${activos.length ? `<button class="af-limpiar-grupo" onclick="limpiarGrupoArmamento('${g.key}')">Quitar filtro de ${esc(g.label.toLowerCase())}</button>` : ''}
        </div>` : '';
      return `<div class="af-grupo ${activos.length ? 'af-activo' : ''} ${grupoAbierto === g.key ? 'af-abierto' : ''}">
          <button class="af-boton" onclick="abrirGrupoFiltroArmamento('${g.key}', event)">${esc(g.label)}${activos.length ? ` <b>${activos.length}</b>` : ''} ▾</button>${panel}</div>`;
    }).join('');

    const pastillas = grupos.flatMap((g) => (filtrosArmamento[g.key] || []).map((vn) => {
      const original = g.valores.find((v) => norm(v) === vn) || vn;
      return `<span class="af-pill">${esc(g.label)}: <b>${esc(g.etiqueta ? g.etiqueta(vn) : original)}</b><button onclick="toggleFiltroArmamento('${g.key}','${esc(vn)}')" title="Quitar">✕</button></span>`;
    })).join('');

    bar.innerHTML = `<div class="af-fila">${botones}${pastillas ? '<button class="af-limpiar" onclick="limpiarFiltrosArmamento()">Limpiar todo</button>' : ''}</div>
      ${pastillas ? `<div class="af-pills">${pastillas}</div>` : ''}`;
    const buscador = bar.querySelector('.af-buscar');
    if (buscador && document.activeElement?.classList?.contains('af-buscar') === false && busquedaGrupo[grupoAbierto]) {
      buscador.focus(); buscador.setSelectionRange(buscador.value.length, buscador.value.length);
    }
  };

  window.abrirGrupoFiltroArmamento = function (key, evento) {
    evento?.stopPropagation();
    grupoAbierto = grupoAbierto === key ? '' : key;
    renderFiltrosArmamento();
    if (grupoAbierto) document.querySelector('#armamento-filtros-bar .af-buscar')?.focus();
  };
  window.filtrarOpcionesArmamento = function (key, texto) {
    busquedaGrupo[key] = texto;
    renderFiltrosArmamento();
    const input = document.querySelector('#armamento-filtros-bar .af-buscar');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  };
  window.limpiarGrupoArmamento = function (key) { filtrosArmamento[key] = []; renderFiltrosArmamento(); renderTablaArmamento(); };
  window.limpiarFiltrosArmamento = function () {
    Object.keys(filtrosArmamento).forEach((k) => { filtrosArmamento[k] = []; });
    grupoAbierto = '';
    renderFiltrosArmamento(); renderTablaArmamento();
  };
  window.toggleFiltroArmamento = function (grupo, valor) {
    if (!Array.isArray(filtrosArmamento[grupo])) filtrosArmamento[grupo] = [];
    const idx = filtrosArmamento[grupo].indexOf(valor);
    if (idx > -1) filtrosArmamento[grupo].splice(idx, 1); else filtrosArmamento[grupo].push(valor);
    renderFiltrosArmamento();
    renderTablaArmamento();
  };
  document.addEventListener('click', (e) => {
    if (grupoAbierto && !e.target.closest?.('#armamento-filtros-bar .af-grupo')) { grupoAbierto = ''; renderFiltrosArmamento(); }
  });

  // ── Edición de datos del arma ─────────────────────────────────────
  const puedeEditar = () => typeof usuarioEsGestionOperativa === 'function' && usuarioEsGestionOperativa();

  // Armas marcadas para mover de bloque en lote (se conservan al cambiar filtros)
  const seleccionLote = new Set();

  // Agrega la casilla de selección y el botón ✎ en la columna N° de cada fila
  const renderTablaOriginal = window.renderTablaArmamento;
  if (typeof renderTablaOriginal === 'function') {
    window.renderTablaArmamento = function () {
      renderTablaOriginal.apply(this, arguments);
      if (!puedeEditar()) { seleccionLote.clear(); renderBarraLote(); return; }
      const filas = document.querySelectorAll('#armamento-tbody > tr');
      const armas = obtenerArmasFiltradas();
      filas.forEach((tr, i) => {
        const arma = armas[i];
        const celda = tr.firstElementChild;
        if (!arma || !celda || celda.querySelector('.ae-editar')) return;
        if (seleccionLote.has(arma.idArma)) tr.classList.add('al-fila-marcada');
        celda.insertAdjacentHTML('afterbegin', `<input type="checkbox" class="al-check" title="Seleccionar para mover de bloque" ${seleccionLote.has(arma.idArma) ? 'checked' : ''} onchange="marcarArmaLote('${esc(arma.idArma)}', this.checked, this)">`);
        celda.insertAdjacentHTML('beforeend', `<button class="ae-editar" title="Editar datos del arma" onclick="abrirEdicionArma('${esc(arma.idArma)}')">✎</button>`);
      });
      // Casilla "seleccionar todas las visibles" en el encabezado N°
      const th = document.querySelector('#armamento-thead-row > th');
      if (th && !th.querySelector('.al-check')) {
        const todas = armas.length > 0 && armas.every((a) => seleccionLote.has(a.idArma));
        th.insertAdjacentHTML('afterbegin', `<input type="checkbox" class="al-check" title="Seleccionar todas las armas visibles" ${todas ? 'checked' : ''} onchange="marcarTodasArmasLote(this.checked)"><br>`);
      }
      renderBarraLote();
    };
  }

  window.marcarArmaLote = function (idArma, marcada, casilla) {
    if (marcada) seleccionLote.add(idArma); else seleccionLote.delete(idArma);
    casilla?.closest('tr')?.classList.toggle('al-fila-marcada', marcada);
    const th = document.querySelector('#armamento-thead-row > th .al-check');
    if (th) { const armas = obtenerArmasFiltradas(); th.checked = armas.length > 0 && armas.every((a) => seleccionLote.has(a.idArma)); }
    renderBarraLote();
  };
  window.marcarTodasArmasLote = function (marcar) {
    obtenerArmasFiltradas().forEach((a) => { if (marcar) seleccionLote.add(a.idArma); else seleccionLote.delete(a.idArma); });
    renderTablaArmamento();
  };
  window.limpiarSeleccionLote = function () { seleccionLote.clear(); renderTablaArmamento(); };

  const bloquesConocidos = () => [...new Set(armamentoDetalle.map((x) => x.ubicacion).filter((u) => /^(RASTRILLO|CAJA FUERTE)/i.test(u || '')))]
    .sort((x, y) => x.localeCompare(y, 'es', { numeric: true }));

  function renderBarraLote() {
    // Quita del lote las armas que ya no existen en el inventario cargado
    const existentes = new Set(armamentoDetalle.map((a) => a.idArma));
    [...seleccionLote].forEach((id) => { if (!existentes.has(id)) seleccionLote.delete(id); });
    let barra = document.getElementById('al-barra');
    if (!seleccionLote.size) { barra?.remove(); return; }
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'al-barra';
      barra.className = 'al-barra';
      barra.innerHTML = `<b id="al-contador"></b><span>→ MOVER A</span>
        <input id="al-destino" list="al-bloques" maxlength="120" placeholder="RASTRILLO · BLOQUE N">
        <datalist id="al-bloques"></datalist>
        <input id="al-motivo" maxlength="200" placeholder="MOTIVO (OPCIONAL)">
        <button class="al-mover" onclick="moverArmasLote()">MOVER</button>
        <button class="al-quitar" onclick="limpiarSeleccionLote()" title="Quitar selección">✕</button>`;
      // Dentro del modal de armamento: se oculta junto con él
      (document.getElementById('armamento-modal') || document.body).appendChild(barra);
    }
    const visibles = new Set(obtenerArmasFiltradas().map((a) => a.idArma));
    const ocultas = [...seleccionLote].filter((id) => !visibles.has(id)).length;
    document.getElementById('al-contador').textContent = `${seleccionLote.size} SELECCIONADA${seleccionLote.size === 1 ? '' : 'S'}${ocultas ? ` (${ocultas} FUERA DEL FILTRO)` : ''}`;
    document.getElementById('al-bloques').innerHTML = bloquesConocidos().map((b) => `<option value="${esc(b)}">`).join('');
  }

  window.moverArmasLote = async function () {
    const destino = (document.getElementById('al-destino')?.value || '').trim().replace(/\s+/g, ' ');
    const motivo = (document.getElementById('al-motivo')?.value || '').trim();
    if (!destino) { alert('ESCRIBE O ELIGE EL BLOQUE DE DESTINO.'); return; }
    const ids = [...seleccionLote];
    if (!confirm(`SE MOVERÁN ${ids.length} ARMA(S) A "${destino.toUpperCase()}". CADA CAMBIO QUEDA EN EL HISTORIAL DEL ARMA. ¿CONFIRMAS?`)) return;
    const boton = document.querySelector('#al-barra .al-mover');
    boton.disabled = true; boton.textContent = 'MOVIENDO…';
    try {
      const r = await supabaseRpc('move_weapons_location', { p_payload: { weapon_ids: ids, location: destino, reason: motivo } });
      seleccionLote.clear();
      document.getElementById('al-barra')?.remove();
      await cargarWorkspaceArmamentoSupabase(true);
      renderFiltrosArmamento();
      renderTablaArmamento();
      alert(`ARMAS MOVIDAS A ${r.location}: ${r.moved}${r.unchanged ? ` · ${r.unchanged} YA ESTABAN EN ESE BLOQUE` : ''}.`);
    } catch (e) {
      alert(`NO SE PUDO MOVER: ${e.message || e}`);
      boton.disabled = false; boton.textContent = 'MOVER';
    }
  };

  const fechaInput = (v) => (v ? String(v).slice(0, 10) : '');
  const lista = (id, valores) => `<datalist id="${id}">${[...new Set(valores.filter(Boolean))].sort().map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;
  const ETIQUETAS_CAMPO = { weapon_code: 'Código', serial_number: 'Serie', document_number: 'N° documento', owner_name: 'Propietario', weapon_class: 'Clase', weapon_type: 'Tipo', brand: 'Marca', model: 'Modelo', caliber: 'Calibre', category: 'Categoría', issue_date: 'Emisión', expiration_date: 'Expiración', location: 'Ubicación', city: 'Ciudad' };

  window.abrirEdicionArma = async function (idArma) {
    const a = armamentoDetalle.find((x) => x.idArma === idArma);
    if (!a) return;
    const esRastrillo = norm(a.estado) === 'rastrillo';
    const bloques = [...new Set(armamentoDetalle.map((x) => x.ubicacion).filter((u) => /^RASTRILLO/i.test(u || '')))]
      .sort((x, y) => x.localeCompare(y, 'es', { numeric: true }));
    const capa = document.createElement('div');
    capa.id = 'ae-modal';
    capa.className = 'ae-modal';
    capa.innerHTML = `<div class="ae-card">
      <header><div><h3>✎ EDITAR ARMA</h3><p>${esc(a.codigoArma)} · SERIE ${esc(a.serie)}</p></div><button onclick="cerrarEdicionArma()">✕</button></header>
      <div class="ae-cuerpo">
        <section><h4>DATOS DEL ARMA</h4><div class="ae-grid">
          <label>CÓDIGO<input id="ae-weapon_code" value="${esc(a.codigoArma)}" maxlength="60"></label>
          <label>SERIE<input id="ae-serial_number" value="${esc(a.serie)}" maxlength="80"></label>
          <label>CLASE<select id="ae-weapon_class"><option ${a.clase === 'LETAL' ? 'selected' : ''}>LETAL</option><option ${a.clase === 'NO LETAL' ? 'selected' : ''}>NO LETAL</option></select></label>
          <label>TIPO<input id="ae-weapon_type" list="ae-l-tipo" value="${esc(a.tipo)}" maxlength="60"></label>
          <label>MARCA<input id="ae-brand" list="ae-l-marca" value="${esc(a.marca)}" maxlength="60"></label>
          <label>MODELO<input id="ae-model" value="${esc(a.modelo)}" maxlength="60"></label>
          <label>CALIBRE<input id="ae-caliber" list="ae-l-calibre" value="${esc(a.calibre)}" maxlength="40"></label>
          <label>CATEGORÍA<select id="ae-category"><option ${a.categoria === 'FIJA' ? 'selected' : ''}>FIJA</option><option value="MÓVIL" ${norm(a.categoria) === 'movil' ? 'selected' : ''}>MÓVIL</option></select></label>
          <label>FECHA DE EMISIÓN<input id="ae-issue_date" type="date" value="${fechaInput(a.fechaEmision)}"></label>
          <label>FECHA DE EXPIRACIÓN<input id="ae-expiration_date" type="date" value="${fechaInput(a.fechaExpiracion)}"></label>
          <label>N° DOCUMENTO (PERMISO)<input id="ae-document_number" value="${esc(a.numeroDocumento)}" maxlength="40"></label>
          <label>PROPIETARIO<input id="ae-owner_name" value="${esc(a.propietario)}" maxlength="120"></label>
        </div>${lista('ae-l-tipo', armamentoDetalle.map((x) => x.tipo))}${lista('ae-l-marca', armamentoDetalle.map((x) => x.marca))}${lista('ae-l-calibre', armamentoDetalle.map((x) => x.calibre))}</section>
        <section><h4>UBICACIÓN FÍSICA ${esRastrillo ? '/ BLOQUE DEL RASTRILLO' : ''}</h4>
          ${esRastrillo ? `<div class="ae-bloques">${bloques.map((b) => `<button type="button" class="${b === a.ubicacion ? 'activo' : ''}" onclick="elegirBloqueArma(this, '${esc(b)}')">${esc(b.replace(/^RASTRILLO\s*·\s*/i, '') || b)}</button>`).join('')}</div>` : ''}
          <div class="ae-grid"><label class="ae-ancho">UBICACIÓN${esRastrillo ? ' (O ESCRIBE UN BLOQUE NUEVO, EJ. "RASTRILLO · BLOQUE 30")' : ''}<input id="ae-location" value="${esc(a.ubicacion)}" maxlength="120"></label>
          <label>CIUDAD<input id="ae-city" value="${esc(a.ciudad)}" maxlength="60"></label></div>
        </section>
        <section class="ae-solo-lectura"><h4>ASIGNACIÓN ACTUAL (SOLO LECTURA)</h4>
          <p><b>Estado:</b> ${esc(a.estado || '—')} · <b>Condición:</b> ${esc(a.condicionTecnica || '—')}</p>
          <p><b>Provincia / proyecto / puesto:</b> ${esc([a.provincia, a.proyecto, a.puesto].filter(Boolean).join(' · ') || '—')}</p>
          <p><b>Responsable:</b> ${esc(a.responsableNombre || '—')}</p>
          <small>El estado, el destino y el responsable cambian solo con <b>actas, intercambio interno o regularización</b>, para mantener el historial de movimientos.</small>
        </section>
        <label class="ae-motivo">MOTIVO DEL CAMBIO (OPCIONAL)<input id="ae-reason" maxlength="200" placeholder="EJ. REORGANIZACIÓN DEL RASTRILLO, CORRECCIÓN DE DIGITACIÓN"></label>
        <details class="ae-historial" ontoggle="if(this.open)cargarHistorialEdicionArma('${esc(a.idArma)}')"><summary>🕘 HISTORIAL DE EDICIONES</summary><div id="ae-historial-lista">Cargando…</div></details>
      </div>
      <footer><button class="ae-cancelar" onclick="cerrarEdicionArma()">CANCELAR</button><button class="ae-guardar" onclick="guardarEdicionArma('${esc(a.idArma)}')">GUARDAR CAMBIOS</button></footer>
    </div>`;
    document.body.appendChild(capa);
  };

  window.elegirBloqueArma = function (boton, bloque) {
    document.querySelectorAll('#ae-modal .ae-bloques button').forEach((b) => b.classList.remove('activo'));
    boton.classList.add('activo');
    document.getElementById('ae-location').value = bloque;
  };
  window.cerrarEdicionArma = () => document.getElementById('ae-modal')?.remove();

  window.cargarHistorialEdicionArma = async function (idArma) {
    const cont = document.getElementById('ae-historial-lista');
    try {
      const filas = await supabaseRpc('get_weapon_detail_edits', { p_weapon_id: idArma });
      cont.innerHTML = filas.length ? filas.map((e) => `<div class="ae-h-item"><b>${esc(new Date(e.edited_at).toLocaleString('es-EC'))}</b> · ${esc(e.edited_by || '')}${e.reason ? ` · <i>${esc(e.reason)}</i>` : ''}
        <ul>${(e.fields || []).map((f) => `<li>${esc(ETIQUETAS_CAMPO[f] || f)}: <s>${esc(e.before?.[f] ?? '—')}</s> → <b>${esc(e.after?.[f] ?? '—')}</b></li>`).join('')}</ul></div>`).join('')
        : '<p>Sin ediciones registradas.</p>';
    } catch (err) { cont.textContent = err.message || String(err); }
  };

  window.guardarEdicionArma = async function (idArma) {
    const payload = { weapon_id: idArma };
    Object.keys(ETIQUETAS_CAMPO).forEach((k) => { const el = document.getElementById(`ae-${k}`); if (el) payload[k] = el.value; });
    payload.reason = document.getElementById('ae-reason')?.value || '';
    const boton = document.querySelector('#ae-modal .ae-guardar');
    boton.disabled = true; boton.textContent = 'GUARDANDO…';
    try {
      const r = await supabaseRpc('update_weapon_details', { p_payload: payload });
      if (!r.changed) { alert('NO HAY CAMBIOS PARA GUARDAR.'); boton.disabled = false; boton.textContent = 'GUARDAR CAMBIOS'; return; }
      await cargarWorkspaceArmamentoSupabase(true);
      cerrarEdicionArma();
      renderFiltrosArmamento();
      renderTablaArmamento();
      alert(`ARMA ACTUALIZADA: ${(r.fields || []).map((f) => ETIQUETAS_CAMPO[f] || f).join(', ')}.`);
    } catch (e) {
      alert(`NO SE PUDO GUARDAR: ${e.message || e}`);
      boton.disabled = false; boton.textContent = 'GUARDAR CAMBIOS';
    }
  };
})();
