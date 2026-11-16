// ================================================================
// expiry-alerts.js — "Vencimientos" en el inicio
//   Botón en la barra superior (con contador de lo vencido/urgente) que
//   abre un panel lateral con contratos de proyectos, permisos de
//   oficinas provinciales y credenciales de armas que vencen pronto.
//   Cada sección depende del permiso del usuario (lo decide la base).
// ================================================================
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const estado = { datos: null, filtro: '', expandido: false, cargando: false };
  const DIAS = 60;
  const VISIBLES = 40;
  const TIPOS = {
    PROYECTO: { grupo: 'PROYECTOS', icono: '🏢', texto: 'Contrato' },
    PROYECTO_SIN_FECHA: { grupo: 'PROYECTOS', icono: '🏢', texto: 'Sin fecha de fin' },
    OFICINA: { grupo: 'OFICINAS', icono: '🏛', texto: 'Permiso de funcionamiento' },
    OFICINA_SIN_PERMISO: { grupo: 'OFICINAS', icono: '🏛', texto: 'Sin permiso registrado' },
    ARMA: { grupo: 'ARMAS', icono: '🔫', texto: 'Credencial / permiso de porte' }
  };

  function nivel(item) {
    if (item.days === null || item.days === undefined) return 'info';
    if (item.days < 0) return 'vencido';
    if (item.days <= 15) return 'urgente';
    return 'proximo';
  }
  function etiquetaDias(item) {
    if (item.kind === 'PROYECTO_SIN_FECHA') return 'SIN FECHA';
    if (item.kind === 'OFICINA_SIN_PERMISO') return 'SIN PERMISO';
    const d = Number(item.days);
    if (d < 0) return `VENCIÓ HACE ${Math.abs(d)} DÍA${Math.abs(d) === 1 ? '' : 'S'}`;
    if (d === 0) return 'VENCE HOY';
    return `EN ${d} DÍA${d === 1 ? '' : 'S'}`;
  }
  const fecha = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

  // Botón en la barra superior, junto a "Resumen OPE"
  function boton() {
    let b = document.getElementById('av-boton');
    if (b) return b;
    const acciones = document.querySelector('.app-header-actions');
    if (!acciones) return null;
    b = document.createElement('button');
    b.type = 'button';
    b.id = 'av-boton';
    b.className = 'av-launch';
    b.style.display = 'none';
    b.setAttribute('onclick', 'abrirPanelVencimientos()');
    const ope = acciones.querySelector('.ope-launch');
    acciones.insertBefore(b, ope || acciones.lastElementChild);
    return b;
  }

  // Panel lateral (se abre sobre el tablero, no lo desplaza)
  function contenedor() {
    let capa = document.getElementById('av-capa');
    if (!capa) {
      capa = document.createElement('div');
      capa.id = 'av-capa';
      capa.className = 'av-capa';
      capa.innerHTML = '<aside class="av-panel" id="alertas-vencimiento" role="dialog" aria-label="Vencimientos"></aside>';
      capa.addEventListener('click', (e) => { if (e.target === capa) cerrarPanelVencimientos(); });
      document.body.appendChild(capa);
    }
    return document.getElementById('alertas-vencimiento');
  }
  window.abrirPanelVencimientos = function () { contenedor(); render(); document.getElementById('av-capa').classList.add('abierta'); };
  window.cerrarPanelVencimientos = function () { document.getElementById('av-capa')?.classList.remove('abierta'); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarPanelVencimientos(); });

  function render() {
    const d = estado.datos;
    const secciones = d?.sections || {};
    const b = boton();
    if (!d || !Object.values(secciones).some(Boolean)) { if (b) b.style.display = 'none'; cerrarPanelVencimientos(); return; }
    const orden = (i) => (i.days === null || i.days === undefined ? 99999 : Number(i.days));
    const items = [...(d.items || [])].sort((a, b) => orden(a) - orden(b) || String(a.title).localeCompare(String(b.title), 'es'));
    const cuenta = (n) => items.filter((i) => nivel(i) === n).length;
    const grupos = [...new Set(items.map((i) => TIPOS[i.kind]?.grupo).filter(Boolean))];
    if (estado.filtro && !grupos.includes(estado.filtro)) estado.filtro = '';
    const lista = items.filter((i) => !estado.filtro || TIPOS[i.kind]?.grupo === estado.filtro);
    const mostrar = estado.expandido ? lista : lista.slice(0, VISIBLES);
    // Contador del botón: lo vencido y lo que vence en 15 días o menos
    if (b) {
      const criticos = cuenta('vencido') + cuenta('urgente');
      b.style.display = '';
      b.className = 'av-launch' + (criticos ? ' av-alerta' : '');
      b.title = items.length ? `${cuenta('vencido')} vencido(s) · ${cuenta('urgente')} en 15 días o menos · ${items.length} en total` : 'Sin vencimientos próximos';
      b.innerHTML = `<span aria-hidden="true">⏰</span><span>Vencimientos</span>${items.length ? `<b class="av-badge">${criticos || items.length}</b>` : ''}`;
    }
    const caja = document.getElementById('alertas-vencimiento');
    if (!caja) return;
    caja.innerHTML = `
      <div class="av-head"><h3>⏰ VENCIMIENTOS <small>VENCIDOS Y PRÓXIMOS ${esc(d.days || DIAS)} DÍAS</small></h3>
        <div><button class="av-recargar" onclick="cargarAlertasVencimiento(true)" title="Actualizar">↻</button><button class="av-recargar" onclick="cerrarPanelVencimientos()" title="Cerrar">✕</button></div></div>
      ${items.length ? `<div class="av-resumen">
        <span class="av-chip vencido"><b>${cuenta('vencido')}</b> VENCIDO(S)</span>
        <span class="av-chip urgente"><b>${cuenta('urgente')}</b> ≤ 15 DÍAS</span>
        <span class="av-chip proximo"><b>${cuenta('proximo')}</b> PRÓXIMO(S)</span>
        ${cuenta('info') ? `<span class="av-chip info"><b>${cuenta('info')}</b> SIN DATO</span>` : ''}
      </div>
      ${grupos.length > 1 ? `<div class="av-filtros"><button class="${estado.filtro ? '' : 'activo'}" onclick="filtrarAlertasVencimiento('')">TODOS ${items.length}</button>${grupos.map((g) => `<button class="${estado.filtro === g ? 'activo' : ''}" onclick="filtrarAlertasVencimiento('${g}')">${g} ${items.filter((i) => TIPOS[i.kind]?.grupo === g).length}</button>`).join('')}</div>` : ''}
      <ul class="av-lista">${mostrar.map((i) => {
        const t = TIPOS[i.kind] || { icono: '•', texto: i.kind };
        return `<li class="av-item ${nivel(i)}" onclick="abrirAlertaVencimiento('${esc(i.kind)}','${esc(i.id)}')" title="Abrir">
          <span class="av-icono">${t.icono}</span>
          <span class="av-texto"><b>${esc(i.title)}</b><small>${esc(t.texto)}${i.detail ? ' · ' + esc(i.detail) : ''}${i.date ? ' · ' + fecha(i.date) : ''}</small></span>
          <span class="av-dias">${etiquetaDias(i)}</span></li>`;
      }).join('')}</ul>
      ${lista.length > VISIBLES ? `<button class="av-mas" onclick="expandirAlertasVencimiento()">${estado.expandido ? 'VER MENOS ▴' : `VER TODOS (${lista.length}) ▾`}</button>` : ''}`
      : `<p class="av-vacio">✓ SIN VENCIMIENTOS EN LOS PRÓXIMOS ${esc(d.days || DIAS)} DÍAS.</p>`}`;
  }

  window.cargarAlertasVencimiento = async function (forzar = false) {
    if (estado.cargando || typeof supabaseRpc !== 'function') return;
    if (typeof backendUsaSupabase === 'function' && !backendUsaSupabase()) return;
    if (typeof estaAutenticado === 'function' && !estaAutenticado()) return;
    estado.cargando = true;
    try {
      estado.datos = await supabaseRpc('get_expiry_alerts', { p_days: DIAS });
      render();
    } catch (e) {
      console.warn('Alertas de vencimiento:', e.message || e);
      if (forzar) alert(`NO SE PUDIERON CARGAR LAS ALERTAS: ${e.message || e}`);
    } finally {
      estado.cargando = false;
    }
  };
  window.filtrarAlertasVencimiento = function (grupo) { estado.filtro = grupo; estado.expandido = false; render(); };
  window.expandirAlertasVencimiento = function () { estado.expandido = !estado.expandido; render(); };

  // Lleva al módulo donde se renueva o corrige el dato
  window.abrirAlertaVencimiento = async function (tipo, id) {
    const item = (estado.datos?.items || []).find((i) => i.kind === tipo && String(i.id) === String(id));
    cerrarPanelVencimientos();
    try {
      if (tipo.startsWith('PROYECTO') && typeof abrirGestionProyectos === 'function') {
        await abrirGestionProyectos();
        if (typeof seleccionarGestionProyecto === 'function') seleccionarGestionProyecto(id);
      } else if (tipo.startsWith('OFICINA') && typeof abrirResumenOpe === 'function') {
        await abrirResumenOpe();
      } else if (tipo === 'ARMA' && typeof abrirModalArmamento === 'function') {
        await abrirModalArmamento();
        const serie = String(item?.title || '').split('SERIE ').pop().trim();
        const buscador = document.getElementById('armamento-buscador');
        if (buscador && serie) { buscador.value = serie; if (typeof buscarArmamento === 'function') buscarArmamento(serie); }
      }
    } catch (e) {
      alert(`NO SE PUDO ABRIR: ${e.message || e}`);
    }
  };

  // Se actualiza cada vez que se recargan los datos del tablero
  const cargarDatosOriginal = window.cargarDatos;
  if (typeof cargarDatosOriginal === 'function') {
    window.cargarDatos = async function () {
      const resultado = await cargarDatosOriginal.apply(this, arguments);
      cargarAlertasVencimiento();
      return resultado;
    };
  }
})();
