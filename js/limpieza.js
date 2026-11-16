// ================================================================
// limpieza.js — Servicio de LIMPIEZA (base)
//   · Al iniciar sesión, quien tiene permiso elige entre SEGURIDAD y
//     LIMPIEZA. Sin permiso de Limpieza se entra directo a Seguridad.
//   · Limpieza: mapa del Ecuador con los puestos, proyectos por
//     asociación (ASOLABU, ASOPRES…), puestos con coordenadas, carga
//     por Excel y tabla de vencimientos. Lo demás: "en mantenimiento".
// ================================================================
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
  const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const MODULO_KEY = 'defen_modulo_activo';
  const lp = { w: null, vista: 'mapa', provincia: '', asociaciones: [], busqueda: '', filtroAsoc: '', filtroProv: '', filtroEstado: 'ACTIVE', horizonte: 60, proyectoId: '', mapa: null, cargando: false };

  const puedeVer = () => typeof tienePermiso === 'function' && tienePermiso('limpieza.ver', ['operaciones']);
  const puedeGestionar = () => Boolean(lp.w?.permissions?.manage);

  // ── Selector de módulo ─────────────────────────────────────────
  function mostrarSelector() {
    if (document.getElementById('modulo-selector')) return;
    const capa = document.createElement('div');
    capa.id = 'modulo-selector';
    capa.className = 'ms-capa';
    capa.innerHTML = `<div class="ms-caja">
      <img src="img/logo.png" alt="DEFEN">
      <h2>¿A QUÉ SERVICIO DESEAS INGRESAR?</h2>
      <p>${esc(sessionStorage.getItem('defen_auth_nombre') || '')}</p>
      <div class="ms-opciones">
        <button class="ms-seguridad" onclick="elegirModuloDefen('seguridad')"><span>🛡</span><b>SEGURIDAD</b><small>Mapa operativo, proyectos, armamento, radios y asistencia</small></button>
        <button class="ms-limpieza" onclick="elegirModuloDefen('limpieza')"><span>🧹</span><b>LIMPIEZA</b><small>Proyectos por asociación, puestos en el mapa y vencimientos</small></button>
      </div>
      <button class="ms-salir" onclick="cerrarSesion()">🔒 CERRAR SESIÓN</button>
    </div>`;
    document.body.appendChild(capa);
  }
  window.elegirModuloDefen = function (modulo) {
    sessionStorage.setItem(MODULO_KEY, modulo);
    document.getElementById('modulo-selector')?.remove();
    if (modulo === 'limpieza') abrirLimpieza(); else cerrarLimpieza();
  };
  // Al cerrar sesión se olvida el servicio elegido
  const cerrarLocalOriginal = window.cerrarSesionLocal;
  if (typeof cerrarLocalOriginal === 'function') window.cerrarSesionLocal = function () { sessionStorage.removeItem(MODULO_KEY); return cerrarLocalOriginal.apply(this, arguments); };
  window.cambiarModuloDefen = function () { document.getElementById('modulo-selector')?.remove(); mostrarSelector(); };

  // Botón "Cambiar servicio" en la barra superior de Seguridad
  function botonCambio() {
    const acciones = document.querySelector('.app-header-actions');
    if (!acciones || document.getElementById('ms-boton-cambio')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'ms-boton-cambio'; b.className = 'ms-cambio';
    b.innerHTML = '<span aria-hidden="true">⇄</span><span>Limpieza</span>';
    b.title = 'Cambiar al servicio de Limpieza';
    b.onclick = () => elegirModuloDefen('limpieza');
    acciones.insertBefore(b, acciones.querySelector('.session-close-btn'));
  }

  // Se engancha al final del inicio de sesión (nuevo o restaurado)
  const aplicarOriginal = window.aplicarPermisosUI;
  if (typeof aplicarOriginal === 'function') {
    window.aplicarPermisosUI = function () {
      const r = aplicarOriginal.apply(this, arguments);
      try {
        if (!puedeVer()) { sessionStorage.removeItem(MODULO_KEY); return r; }
        botonCambio();
        const elegido = sessionStorage.getItem(MODULO_KEY);
        if (elegido === 'limpieza') abrirLimpieza();
        else if (!elegido) mostrarSelector();
      } catch (e) { console.warn('Selector de módulo:', e); }
      return r;
    };
  }

  // ── Aplicación de Limpieza ─────────────────────────────────────
  const MANTENIMIENTO = {
    personal: ['👥', 'PERSONAL DE LIMPIEZA', 'Fichas de auxiliares, ingresos y salidas.'],
    asistencia: ['📅', 'ASISTENCIA', 'Control diario de auxiliares por puesto.'],
    insumos: ['🧴', 'INSUMOS Y MATERIALES', 'Entregas de insumos y control de inventario.'],
    supervision: ['🔎', 'SUPERVISIÓN', 'Visitas, novedades y calidad del servicio.'],
    reportes: ['📊', 'REPORTES', 'Reportes gerenciales del servicio de limpieza.']
  };
  const VISTAS = [['mapa', '🗺', 'MAPA'], ['proyectos', '📋', 'PROYECTOS'], ['vencimientos', '⏰', 'VENCIMIENTOS'],
    ...Object.entries(MANTENIMIENTO).map(([k, v]) => [k, v[0], v[1].split(' ')[0]])];

  function crearApp() {
    if (document.getElementById('limpieza-app')) return;
    const app = document.createElement('div');
    app.id = 'limpieza-app';
    app.className = 'lp-app';
    app.innerHTML = `
      <header class="lp-cabecera">
        <div class="lp-marca"><img src="img/logo.png" alt=""><div><h1>SERVICIO DE LIMPIEZA</h1><p>PROYECTOS POR ASOCIACIÓN · PUESTOS · VENCIMIENTOS</p></div></div>
        <div class="lp-acciones"><button onclick="elegirModuloDefen('seguridad')">🛡 IR A SEGURIDAD</button><button class="lp-salir" onclick="cerrarSesion()">🔒 CERRAR SESIÓN</button></div>
      </header>
      <nav class="lp-nav" id="lp-nav"></nav>
      <main class="lp-cuerpo" id="lp-cuerpo"><div class="lp-cargando">CARGANDO…</div></main>`;
    document.body.appendChild(app);
  }

  window.abrirLimpieza = async function () {
    if (!puedeVer()) return;
    crearApp();
    document.getElementById('limpieza-app').style.display = 'flex';
    document.body.classList.add('lp-activo');
    await cargarLimpieza();
  };
  window.cerrarLimpieza = function () {
    const app = document.getElementById('limpieza-app');
    if (app) app.style.display = 'none';
    document.body.classList.remove('lp-activo');
  };

  async function cargarLimpieza() {
    if (lp.cargando) return;
    lp.cargando = true;
    try {
      lp.w = await supabaseRpc('get_cleaning_workspace', {});
      render();
    } catch (e) {
      document.getElementById('lp-cuerpo').innerHTML = `<div class="lp-error">NO SE PUDO CARGAR LIMPIEZA: ${esc(e.message || e)}</div>`;
    } finally { lp.cargando = false; }
  }
  window.recargarLimpieza = cargarLimpieza;

  window.verLimpieza = function (vista) { lp.vista = vista; render(); document.getElementById('lp-cuerpo')?.scrollTo?.(0, 0); };

  function render() {
    const nav = document.getElementById('lp-nav');
    nav.innerHTML = VISTAS.map(([k, i, t]) => `<button class="${lp.vista === k ? 'activo' : ''} ${MANTENIMIENTO[k] ? 'lp-mant' : ''}" onclick="verLimpieza('${k}')"><span>${i}</span>${t}</button>`).join('');
    const cuerpo = document.getElementById('lp-cuerpo');
    if (MANTENIMIENTO[lp.vista]) { cuerpo.innerHTML = vistaMantenimiento(lp.vista); return; }
    cuerpo.innerHTML = lp.vista === 'proyectos' ? vistaProyectos() : lp.vista === 'vencimientos' ? vistaVencimientos() : vistaMapa();
  }

  function vistaMantenimiento(k) {
    const [i, t, d] = MANTENIMIENTO[k];
    return `<div class="lp-mantenimiento"><div>${i}</div><h2>${esc(t)}</h2><p><b>ESTAMOS EN MANTENIMIENTO.</b> Esta sección del servicio de limpieza está en construcción.</p><small>${esc(d)}</small>
      <button onclick="verLimpieza('mapa')">← VOLVER AL MAPA</button></div>`;
  }

  // ── Datos auxiliares ───────────────────────────────────────────
  const proyectos = () => lp.w?.projects || [];
  const activos = () => proyectos().filter((p) => p.status === 'ACTIVE');
  const puestosDe = (p) => p.posts || [];
  const auxiliares = (p) => { const s = puestosDe(p).reduce((n, x) => n + Number(x.staff_count || 0), 0); return s || Number(p.staff_count || 0); };
  const filtrarAsoc = (lista) => (lp.asociaciones.length ? lista.filter((p) => lp.asociaciones.includes(p.association_id)) : lista);

  function diasInfo(p) {
    if (p.status === 'FINISHED') return { t: 'FINALIZADO', c: 'gris' };
    if (p.days_left === null || p.days_left === undefined) return { t: 'SIN FECHA', c: 'gris' };
    const d = Number(p.days_left);
    if (d < 0) return { t: `VENCIDO (${Math.abs(d)} D)`, c: 'vencido' };
    if (d === 0) return { t: 'HOY', c: 'vencido' };
    return { t: String(d), c: d <= 15 ? 'urgente' : d <= 30 ? 'pronto' : 'proximo' };
  }

  // ── Vista: MAPA ────────────────────────────────────────────────
  function vistaMapa() {
    const lista = filtrarAsoc(activos());
    const porProv = new Map();
    lista.forEach((p) => {
      const sitios = puestosDe(p).length ? puestosDe(p) : [{ province_id: p.province_id, staff_count: p.staff_count, _sinPuesto: true }];
      sitios.forEach((s) => {
        const id = s.province_id ?? p.province_id; if (id == null) return;
        const e = porProv.get(id) || { puestos: 0, auxiliares: 0, proyectos: new Set() };
        if (!s._sinPuesto) e.puestos++;
        e.auxiliares += Number(s.staff_count || 0); e.proyectos.add(p.id);
        porProv.set(id, e);
      });
    });
    const provs = lp.w.provinces || [];
    const marcadores = provs.filter((pv) => porProv.has(pv.id) && pv.map_x != null).map((pv) => {
      const e = porProv.get(pv.id);
      return `<button class="lp-marcador ${lp.provincia === pv.id ? 'activo' : ''}" style="left:${pv.map_x}%;top:${pv.map_y}%" onclick="elegirProvinciaLimpieza(${pv.id})" title="${esc(pv.name)}: ${e.proyectos.size} proyecto(s), ${e.puestos} puesto(s)"><b>${e.puestos || e.proyectos.size}</b></button>`;
    }).join('');
    const total = { proyectos: lista.length, puestos: lista.reduce((n, p) => n + puestosDe(p).length, 0), aux: lista.reduce((n, p) => n + auxiliares(p), 0), conCoord: lista.reduce((n, p) => n + puestosDe(p).filter((s) => s.latitude != null).length, 0) };
    const asocs = (lp.w.associations || []).filter((a) => a.active);
    const provSel = provs.find((pv) => pv.id === lp.provincia);
    const listaProv = provSel ? lista.filter((p) => p.province_id === provSel.id || puestosDe(p).some((s) => s.province_id === provSel.id)) : [];
    return `
      <div class="lp-kpis">
        <div><span>PROYECTOS ACTIVOS</span><b>${total.proyectos}</b></div>
        <div><span>PUESTOS</span><b>${total.puestos}</b></div>
        <div><span>AUXILIARES</span><b>${total.aux}</b></div>
        <div><span>ASOCIACIONES</span><b>${asocs.length}</b></div>
      </div>
      <div class="lp-chips"><span>ASOCIACIÓN:</span><button class="${lp.asociaciones.length ? '' : 'activo'}" onclick="filtrarAsociacionLimpieza('')">TODAS</button>${asocs.map((a) => `<button class="${lp.asociaciones.includes(a.id) ? 'activo' : ''}" onclick="filtrarAsociacionLimpieza('${a.id}')">${esc(a.name)} <small>${a.projects}</small></button>`).join('')}</div>
      <div class="lp-mapa-grid">
        <section class="lp-mapa-caja">
          <div class="lp-mapa"><img src="img/mapa.png" alt="Mapa del Ecuador">${marcadores}</div>
          <div class="lp-mapa-pie"><span>EL NÚMERO EN CADA PROVINCIA ES LA CANTIDAD DE PUESTOS (O DE PROYECTOS SI AÚN NO TIENEN PUESTOS).</span>
            <button onclick="abrirMapaPuestosLimpieza()" ${total.conCoord ? '' : 'disabled'}>📍 VER PUESTOS EN MAPA DETALLADO (${total.conCoord})</button></div>
        </section>
        <section class="lp-lateral">
          ${provSel ? `<div class="lp-lat-head"><h3>📍 ${esc(provSel.name)}</h3><button onclick="elegirProvinciaLimpieza('')">✕</button></div>
            ${listaProv.map((p) => `<article class="lp-tarjeta" onclick="abrirProyectoLimpieza('${p.id}')"><header><b>${esc(p.name)}</b><span class="lp-dias ${diasInfo(p).c}">${esc(diasInfo(p).t)}</span></header>
              <small>${esc(p.association)}${p.contract_code ? ' · ' + esc(p.contract_code) : ''} · FIN ${fecha(p.end_date)}</small>
              <ul>${puestosDe(p).filter((s) => !provSel || s.province_id === provSel.id).map((s) => `<li>📍 ${esc(s.name)} <em>${s.staff_count} aux.</em></li>`).join('') || '<li class="lp-vacio">SIN PUESTOS REGISTRADOS</li>'}</ul></article>`).join('') || '<p class="lp-vacio">SIN PROYECTOS EN ESTA PROVINCIA.</p>'}`
          : `<div class="lp-lat-head"><h3>PROVINCIAS CON SERVICIO</h3></div>
            ${provs.filter((pv) => porProv.has(pv.id)).sort((a, b) => porProv.get(b.id).auxiliares - porProv.get(a.id).auxiliares).map((pv) => { const e = porProv.get(pv.id); return `<button class="lp-prov" onclick="elegirProvinciaLimpieza(${pv.id})"><b>${esc(pv.name)}</b><small>${e.proyectos.size} proyecto(s) · ${e.puestos} puesto(s) · ${e.auxiliares} auxiliar(es)</small></button>`; }).join('')
              || `<div class="lp-vacio-grande"><b>AÚN NO HAY PROYECTOS DE LIMPIEZA.</b>${puedeGestionar() ? `<p>Empieza agregando un proyecto o cargando tu Excel.</p><button onclick="verLimpieza('proyectos')">📋 IR A PROYECTOS</button>` : ''}</div>`}`}
        </section>
      </div>`;
  }
  window.elegirProvinciaLimpieza = function (id) { lp.provincia = id === '' ? '' : Number(id); render(); };
  window.filtrarAsociacionLimpieza = function (id) {
    if (!id) lp.asociaciones = []; else lp.asociaciones = lp.asociaciones.includes(id) ? lp.asociaciones.filter((x) => x !== id) : [...lp.asociaciones, id];
    render();
  };

  // Mapa detallado (calles) con todos los puestos que tienen coordenadas
  window.abrirMapaPuestosLimpieza = function () {
    if (typeof L === 'undefined') return alert('NO SE PUDO CARGAR EL MAPA DETALLADO.');
    const puntos = [];
    filtrarAsoc(activos()).forEach((p) => puestosDe(p).forEach((s) => { if (s.latitude != null && s.longitude != null) puntos.push({ p, s }); }));
    if (!puntos.length) return alert('NINGÚN PUESTO TIENE COORDENADAS TODAVÍA.');
    document.getElementById('lp-mapa-modal')?.remove();
    const capa = document.createElement('div');
    capa.id = 'lp-mapa-modal'; capa.className = 'lp-modal';
    capa.innerHTML = `<div class="lp-modal-caja lp-modal-mapa"><header><h3>📍 PUESTOS DE LIMPIEZA (${puntos.length})</h3><button onclick="document.getElementById('lp-mapa-modal').remove()">✕</button></header><div id="lp-leaflet"></div></div>`;
    document.body.appendChild(capa);
    const colores = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];
    const asocIds = [...new Set(puntos.map((x) => x.p.association_id))];
    const mapa = L.map('lp-leaflet');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    const grupo = L.featureGroup().addTo(mapa);
    puntos.forEach(({ p, s }) => {
      const color = colores[asocIds.indexOf(p.association_id) % colores.length];
      L.circleMarker([Number(s.latitude), Number(s.longitude)], { radius: 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95 })
        .bindPopup(`<b>${esc(s.name)}</b><br>${esc(p.name)}<br><small>${esc(p.association)} · ${s.staff_count} auxiliar(es)${s.address ? '<br>' + esc(s.address) : ''}</small>`)
        .addTo(grupo);
    });
    mapa.fitBounds(grupo.getBounds().pad(0.2), { maxZoom: 15 });
    const leyenda = L.control({ position: 'bottomleft' });
    leyenda.onAdd = () => { const d = L.DomUtil.create('div', 'lp-leyenda-mapa'); d.innerHTML = asocIds.map((id, i) => `<span><i style="background:${colores[i % colores.length]}"></i>${esc(puntos.find((x) => x.p.association_id === id).p.association)}</span>`).join(''); return d; };
    leyenda.addTo(mapa);
    setTimeout(() => mapa.invalidateSize(), 150);
  };

  // ── Vista: PROYECTOS ───────────────────────────────────────────
  function vistaProyectos() {
    const q = norm(lp.busqueda);
    const lista = proyectos().filter((p) => (!lp.filtroAsoc || p.association_id === lp.filtroAsoc)
      && (!lp.filtroProv || String(p.province_id) === String(lp.filtroProv))
      && (!lp.filtroEstado || p.status === lp.filtroEstado)
      && (!q || norm([p.name, p.contract_code, p.association, p.province, p.city, ...puestosDe(p).map((s) => s.name)].join(' ')).includes(q)));
    const asocs = lp.w.associations || [];
    const provs = lp.w.provinces || [];
    return `
      <div class="lp-barra">
        <input placeholder="Buscar entidad, ODC, puesto…" value="${esc(lp.busqueda)}" oninput="buscarLimpieza(this.value)">
        <select onchange="filtroLimpieza('filtroAsoc', this.value)"><option value="">TODAS LAS ASOCIACIONES</option>${asocs.map((a) => `<option value="${a.id}" ${lp.filtroAsoc === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
        <select onchange="filtroLimpieza('filtroProv', this.value)"><option value="">TODAS LAS PROVINCIAS</option>${provs.map((p) => `<option value="${p.id}" ${String(lp.filtroProv) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <select onchange="filtroLimpieza('filtroEstado', this.value)"><option value="ACTIVE" ${lp.filtroEstado === 'ACTIVE' ? 'selected' : ''}>ACTIVOS</option><option value="FINISHED" ${lp.filtroEstado === 'FINISHED' ? 'selected' : ''}>FINALIZADOS</option><option value="" ${!lp.filtroEstado ? 'selected' : ''}>TODOS</option></select>
      </div>
      ${puedeGestionar() ? `<div class="lp-botones">
        <button class="lp-primario" onclick="formularioProyectoLimpieza()">＋ NUEVO PROYECTO</button>
        <button onclick="abrirImportacionLimpieza()">⇧ CARGAR DESDE EXCEL</button>
        <button onclick="descargarPlantillaLimpieza()">⇩ PLANTILLA EXCEL</button>
        <button onclick="gestionarAsociacionesLimpieza()">🏷 ASOCIACIONES</button>
      </div>` : ''}
      <div class="lp-tabla-wrap"><table class="lp-tabla"><thead><tr><th>ASOCIACIÓN</th><th>ODC</th><th>ENTIDAD</th><th>PROVINCIA</th><th>PUESTOS</th><th>AUXILIARES</th><th>INICIO</th><th>FIN</th><th>DÍAS</th></tr></thead><tbody>
        ${lista.map((p) => { const d = diasInfo(p); return `<tr onclick="abrirProyectoLimpieza('${p.id}')"><td><b>${esc(p.association)}</b></td><td>${esc(p.contract_code || '—')}</td><td class="lp-izq"><b>${esc(p.name)}</b>${p.city ? `<small>${esc(p.city)}</small>` : ''}</td><td>${esc(p.province || '—')}</td><td>${puestosDe(p).length}</td><td>${auxiliares(p)}</td><td>${fecha(p.start_date)}</td><td>${fecha(p.end_date)}</td><td><span class="lp-dias ${d.c}">${esc(d.t)}</span></td></tr>`; }).join('')
          || `<tr><td colspan="9" class="lp-vacio">NO HAY PROYECTOS CON ESTOS FILTROS.</td></tr>`}
      </tbody></table></div>
      <p class="lp-nota">${lista.length} PROYECTO(S) · TOCA UNO PARA VER Y EDITAR SUS PUESTOS.</p>`;
  }
  let tBusqueda = null;
  window.buscarLimpieza = function (v) { lp.busqueda = v; clearTimeout(tBusqueda); tBusqueda = setTimeout(() => { render(); const i = document.querySelector('.lp-barra input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  window.filtroLimpieza = function (campo, v) { lp[campo] = v; render(); };

  // ── Modales: proyecto, puesto, asociaciones ────────────────────
  function modal(id, titulo, cuerpo, pie = '', clase = '') {
    document.getElementById(id)?.remove();
    const capa = document.createElement('div');
    capa.id = id; capa.className = 'lp-modal';
    capa.innerHTML = `<div class="lp-modal-caja ${clase}"><header><h3>${titulo}</h3><button onclick="document.getElementById('${id}').remove()">✕</button></header><div class="lp-modal-cuerpo">${cuerpo}</div>${pie ? `<footer>${pie}</footer>` : ''}</div>`;
    document.body.appendChild(capa);
    return capa;
  }
  const opcionesProv = (sel) => `<option value="">—</option>${(lp.w.provinces || []).map((p) => `<option value="${p.id}" ${String(sel) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}`;
  const valor = (id) => document.getElementById(id)?.value ?? '';

  window.abrirProyectoLimpieza = function (id) {
    const p = proyectos().find((x) => x.id === id); if (!p) return;
    lp.proyectoId = id;
    const d = diasInfo(p), g = puedeGestionar();
    modal('lp-proyecto', `${esc(p.name)}`, `
      <div class="lp-ficha">
        <div><span>ASOCIACIÓN</span><b>${esc(p.association)}</b></div><div><span>ODC / CONTRATO</span><b>${esc(p.contract_code || '—')}</b></div>
        <div><span>PROVINCIA / CIUDAD</span><b>${esc([p.province, p.city].filter(Boolean).join(' · ') || '—')}</b></div><div><span>DIRECCIÓN</span><b>${esc(p.address || '—')}</b></div>
        <div><span>INICIO</span><b>${fecha(p.start_date)}</b></div><div><span>FIN</span><b>${fecha(p.end_date)}</b></div>
        <div><span>AUXILIARES</span><b>${auxiliares(p)}${p.staff_count ? ` <small>(CONTRATADOS: ${p.staff_count})</small>` : ''}</b></div><div><span>DÍAS PARA CULMINAR</span><b><span class="lp-dias ${d.c}">${esc(d.t)}</span></b></div>
        ${p.notes ? `<div class="lp-ancho"><span>OBSERVACIONES</span><b>${esc(p.notes)}</b></div>` : ''}
      </div>
      <div class="lp-sub"><h4>PUESTOS (${puestosDe(p).length})</h4>${g ? `<button onclick="formularioPuestoLimpieza('${p.id}')">＋ AGREGAR PUESTO</button>` : ''}</div>
      <div class="lp-tabla-wrap"><table class="lp-tabla"><thead><tr><th>PUESTO</th><th>PROVINCIA / CIUDAD</th><th>DIRECCIÓN</th><th>AUX.</th><th>HORARIO</th><th>UBICACIÓN</th>${g ? '<th></th>' : ''}</tr></thead><tbody>
        ${puestosDe(p).map((s) => `<tr><td class="lp-izq"><b>${esc(s.name)}</b></td><td>${esc([s.province, s.city].filter(Boolean).join(' · ') || '—')}</td><td class="lp-izq">${esc(s.address || '—')}</td><td>${s.staff_count}</td><td>${esc(s.schedule || '—')}</td>
          <td>${s.latitude != null ? `<a href="https://www.google.com/maps?q=${s.latitude},${s.longitude}" target="_blank" rel="noopener">📍 VER</a>` : '<span class="lp-gris">SIN COORD.</span>'}</td>
          ${g ? `<td class="lp-acciones-fila"><button onclick="formularioPuestoLimpieza('${p.id}','${s.id}')">✎</button><button onclick="quitarPuestoLimpieza('${s.id}')">🗑</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="7" class="lp-vacio">SIN PUESTOS. ${g ? 'AGRÉGALOS CON EL BOTÓN DE ARRIBA O DESDE EXCEL.' : ''}</td></tr>`}
      </tbody></table></div>`,
    g ? `<button onclick="formularioProyectoLimpieza('${p.id}')">✎ EDITAR PROYECTO</button>${p.status === 'ACTIVE' ? `<button class="lp-peligro" onclick="finalizarProyectoLimpieza('${p.id}')">FINALIZAR PROYECTO</button>` : `<button onclick="finalizarProyectoLimpieza('${p.id}', true)">REACTIVAR</button>`}` : '', 'lp-modal-ancho');
  };

  window.formularioProyectoLimpieza = function (id = '') {
    const p = proyectos().find((x) => x.id === id) || {};
    const asocs = (lp.w.associations || []).filter((a) => a.active || a.id === p.association_id);
    modal('lp-form-proyecto', id ? '✎ EDITAR PROYECTO' : '＋ NUEVO PROYECTO DE LIMPIEZA', `
      <div class="lp-form">
        <label>ASOCIACIÓN *<select id="lpf-asoc"><option value="">SELECCIONA…</option>${asocs.map((a) => `<option value="${a.id}" ${p.association_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
        <label>ODC / N° CONTRATO<input id="lpf-odc" maxlength="60" value="${esc(p.contract_code || '')}"></label>
        <label class="lp-ancho">ENTIDAD / CLIENTE *<input id="lpf-nombre" maxlength="150" value="${esc(p.name || '')}" placeholder="EJ. HOSPITAL GENERAL DE…"></label>
        <label>PROVINCIA<select id="lpf-prov">${opcionesProv(p.province_id)}</select></label>
        <label>CIUDAD<input id="lpf-ciudad" maxlength="80" value="${esc(p.city || '')}"></label>
        <label class="lp-ancho">DIRECCIÓN<input id="lpf-dir" maxlength="200" value="${esc(p.address || '')}"></label>
        <label>FECHA DE INICIO<input id="lpf-ini" type="date" value="${esc(p.start_date || '')}"></label>
        <label>FECHA DE FIN<input id="lpf-fin" type="date" value="${esc(p.end_date || '')}"></label>
        <label>AUXILIARES CONTRATADOS<input id="lpf-aux" type="number" min="0" max="5000" value="${esc(p.staff_count ?? '')}"></label>
        <label class="lp-ancho">OBSERVACIONES<textarea id="lpf-notas" rows="2" maxlength="500">${esc(p.notes || '')}</textarea></label>
      </div>`, `<button onclick="document.getElementById('lp-form-proyecto').remove()">CANCELAR</button><button class="lp-primario" onclick="guardarProyectoLimpieza('${id}')">GUARDAR</button>`);
  };
  window.guardarProyectoLimpieza = async function (id) {
    const p = proyectos().find((x) => x.id === id) || {};
    const payload = { id: id || null, association_id: valor('lpf-asoc'), contract_code: valor('lpf-odc'), name: valor('lpf-nombre'), province_id: valor('lpf-prov'), city: valor('lpf-ciudad'), address: valor('lpf-dir'), start_date: valor('lpf-ini'), end_date: valor('lpf-fin'), staff_count: valor('lpf-aux'), notes: valor('lpf-notas'), status: p.status || 'ACTIVE' };
    if (!payload.association_id || !payload.name.trim()) return alert('COMPLETA LA ASOCIACIÓN Y LA ENTIDAD.');
    try {
      const r = await supabaseRpc('save_cleaning_project', { p_payload: payload });
      document.getElementById('lp-form-proyecto')?.remove();
      await cargarLimpieza();
      abrirProyectoLimpieza(r.id);
    } catch (e) { alert(`NO SE PUDO GUARDAR: ${e.message || e}`); }
  };
  window.finalizarProyectoLimpieza = async function (id, reactivar = false) {
    const p = proyectos().find((x) => x.id === id); if (!p) return;
    if (!confirm(reactivar ? `¿REACTIVAR EL PROYECTO ${p.name}?` : `¿FINALIZAR EL PROYECTO ${p.name}? DEJARÁ DE APARECER EN EL MAPA Y EN LOS VENCIMIENTOS.`)) return;
    try {
      await supabaseRpc('save_cleaning_project', { p_payload: { id: p.id, association_id: p.association_id, contract_code: p.contract_code, name: p.name, province_id: p.province_id, city: p.city, address: p.address, start_date: p.start_date, end_date: p.end_date, staff_count: p.staff_count, notes: p.notes, status: reactivar ? 'ACTIVE' : 'FINISHED' } });
      document.getElementById('lp-proyecto')?.remove();
      await cargarLimpieza();
    } catch (e) { alert(`NO SE PUDO ACTUALIZAR: ${e.message || e}`); }
  };

  window.formularioPuestoLimpieza = function (projectId, postId = '') {
    const p = proyectos().find((x) => x.id === projectId) || {};
    const s = puestosDe(p).find((x) => x.id === postId) || {};
    modal('lp-form-puesto', postId ? '✎ EDITAR PUESTO' : `＋ NUEVO PUESTO · ${esc(p.name)}`, `
      <div class="lp-form">
        <label class="lp-ancho">NOMBRE DEL PUESTO *<input id="lps-nombre" maxlength="150" value="${esc(s.name || '')}" placeholder="EJ. EMERGENCIA, BLOQUE A, OFICINA MATRIZ"></label>
        <label>PROVINCIA<select id="lps-prov">${opcionesProv(s.province_id ?? p.province_id)}</select></label>
        <label>CIUDAD<input id="lps-ciudad" maxlength="80" value="${esc(s.city || p.city || '')}"></label>
        <label class="lp-ancho">DIRECCIÓN<input id="lps-dir" maxlength="200" value="${esc(s.address || '')}"></label>
        <label>LATITUD<input id="lps-lat" inputmode="decimal" value="${esc(s.latitude ?? '')}" placeholder="EJ. -2.189400"></label>
        <label>LONGITUD<input id="lps-lng" inputmode="decimal" value="${esc(s.longitude ?? '')}" placeholder="EJ. -79.889100"></label>
        <label class="lp-ancho lp-ayuda">💡 TAMBIÉN PUEDES PEGAR AQUÍ UN ENLACE DE GOOGLE MAPS O "LATITUD, LONGITUD":<input id="lps-enlace" placeholder="https://maps.google.com/…/@-2.1894,-79.8891,17z" oninput="leerCoordenadasLimpieza(this.value)"></label>
        <label>AUXILIARES EN EL PUESTO<input id="lps-aux" type="number" min="0" max="1000" value="${esc(s.staff_count ?? 0)}"></label>
        <label>HORARIO<input id="lps-horario" maxlength="60" value="${esc(s.schedule || '')}" placeholder="EJ. 07:00 A 15:00"></label>
      </div>`, `<button onclick="document.getElementById('lp-form-puesto').remove()">CANCELAR</button><button class="lp-primario" onclick="guardarPuestoLimpieza('${projectId}','${postId}')">GUARDAR PUESTO</button>`);
  };
  // Acepta "-2.18, -79.88", enlaces de Google Maps con @lat,lng o ?q=lat,lng
  window.leerCoordenadasLimpieza = function (texto) {
    const m = String(texto).match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{2,3}\.\d+)/);
    if (!m) return;
    document.getElementById('lps-lat').value = m[1];
    document.getElementById('lps-lng').value = m[2];
  };
  window.guardarPuestoLimpieza = async function (projectId, postId) {
    const payload = { id: postId || null, project_id: projectId, name: valor('lps-nombre'), province_id: valor('lps-prov'), city: valor('lps-ciudad'), address: valor('lps-dir'), latitude: valor('lps-lat').trim(), longitude: valor('lps-lng').trim(), staff_count: valor('lps-aux'), schedule: valor('lps-horario') };
    if (!payload.name.trim()) return alert('ESCRIBE EL NOMBRE DEL PUESTO.');
    try {
      await supabaseRpc('save_cleaning_post', { p_payload: payload });
      document.getElementById('lp-form-puesto')?.remove();
      await cargarLimpieza();
      abrirProyectoLimpieza(projectId);
    } catch (e) { alert(`NO SE PUDO GUARDAR EL PUESTO: ${e.message || e}`); }
  };
  window.quitarPuestoLimpieza = async function (postId) {
    if (!confirm('¿QUITAR ESTE PUESTO DEL PROYECTO?')) return;
    try { await supabaseRpc('remove_cleaning_post', { p_post_id: postId }); await cargarLimpieza(); abrirProyectoLimpieza(lp.proyectoId); }
    catch (e) { alert(`NO SE PUDO QUITAR: ${e.message || e}`); }
  };

  window.gestionarAsociacionesLimpieza = function () {
    const asocs = lp.w.associations || [];
    modal('lp-asociaciones', '🏷 ASOCIACIONES', `
      <div class="lp-form lp-form-linea"><label class="lp-ancho">NUEVA ASOCIACIÓN<input id="lpa-nombre" maxlength="80" placeholder="EJ. ASOLABU"></label><label>RUC (OPCIONAL)<input id="lpa-ruc" maxlength="13"></label><button class="lp-primario" onclick="guardarAsociacionLimpieza()">＋ AGREGAR</button></div>
      <div class="lp-tabla-wrap"><table class="lp-tabla"><thead><tr><th>ASOCIACIÓN</th><th>RUC</th><th>PROYECTOS ACTIVOS</th><th>ESTADO</th><th></th></tr></thead><tbody>
        ${asocs.map((a) => `<tr><td><b>${esc(a.name)}</b></td><td>${esc(a.ruc || '—')}</td><td>${a.projects}</td><td>${a.active ? 'ACTIVA' : 'INACTIVA'}</td><td><button onclick="cambiarEstadoAsociacionLimpieza('${a.id}')">${a.active ? 'DESACTIVAR' : 'ACTIVAR'}</button></td></tr>`).join('')}
      </tbody></table></div>`);
  };
  window.guardarAsociacionLimpieza = async function () {
    const nombre = valor('lpa-nombre').trim(); if (!nombre) return alert('ESCRIBE EL NOMBRE DE LA ASOCIACIÓN.');
    try { await supabaseRpc('save_cleaning_association', { p_payload: { name: nombre, ruc: valor('lpa-ruc') } }); await cargarLimpieza(); gestionarAsociacionesLimpieza(); }
    catch (e) { alert(`NO SE PUDO GUARDAR: ${e.message || e}`); }
  };
  window.cambiarEstadoAsociacionLimpieza = async function (id) {
    const a = (lp.w.associations || []).find((x) => x.id === id); if (!a) return;
    try { await supabaseRpc('save_cleaning_association', { p_payload: { id: a.id, name: a.name, ruc: a.ruc, notes: a.notes, active: !a.active } }); await cargarLimpieza(); gestionarAsociacionesLimpieza(); }
    catch (e) { alert(`NO SE PUDO ACTUALIZAR: ${e.message || e}`); }
  };

  // ── Excel: plantilla e importación ─────────────────────────────
  const COLUMNAS = [
    ['ASOCIACION', 'association'], ['ODC', 'contract_code'], ['ENTIDAD', 'entity'], ['PROVINCIA', 'province'], ['CIUDAD', 'city'], ['DIRECCION', 'address'],
    ['FECHA INICIO', 'start_date'], ['FECHA FIN', 'end_date'], ['AUXILIARES CONTRATADOS', 'project_staff'],
    ['PUESTO', 'post'], ['PROVINCIA PUESTO', 'post_province'], ['CIUDAD PUESTO', 'post_city'], ['DIRECCION PUESTO', 'post_address'],
    ['LATITUD', 'latitude'], ['LONGITUD', 'longitude'], ['AUXILIARES PUESTO', 'staff'], ['HORARIO', 'schedule']
  ];
  window.descargarPlantillaLimpieza = function () {
    if (typeof XLSX === 'undefined') return alert('NO SE PUDO CARGAR EL GENERADOR DE EXCEL.');
    const ejemplo = ['ASOLABU', 'CE-2026000000001', 'HOSPITAL DE EJEMPLO', 'GUAYAS', 'GUAYAQUIL', 'AV. PRINCIPAL 123', '01/01/2026', '31/12/2026', 10, 'EMERGENCIA', 'GUAYAS', 'GUAYAQUIL', 'BLOQUE A, PLANTA BAJA', -2.1894, -79.8891, 4, '07:00 A 15:00'];
    const ejemplo2 = ['ASOLABU', 'CE-2026000000001', 'HOSPITAL DE EJEMPLO', 'GUAYAS', 'GUAYAQUIL', '', '01/01/2026', '31/12/2026', 10, 'CONSULTA EXTERNA', '', '', '', '', '', 6, '07:00 A 15:00'];
    const ws = XLSX.utils.aoa_to_sheet([COLUMNAS.map((c) => c[0]), ejemplo, ejemplo2]);
    const ayuda = XLSX.utils.aoa_to_sheet([
      ['INSTRUCCIONES'],
      ['1. Cada fila es un PUESTO. Las filas con la misma ASOCIACION + ENTIDAD + ODC forman un mismo proyecto.'],
      ['2. Obligatorios: ASOCIACION y ENTIDAD. Si la asociación no existe, se crea automáticamente.'],
      ['3. PROVINCIA con el nombre oficial (ej. GUAYAS, PICHINCHA, SANTO DOMINGO, LOS RIOS).'],
      ['4. Fechas en formato DD/MM/AAAA. LATITUD y LONGITUD son opcionales (ej. -2.1894 y -79.8891).'],
      ['5. Si solo tienes los datos del proyecto, deja vacía la columna PUESTO.'],
      ['6. Borra las 2 filas de ejemplo antes de cargar. Si vuelves a cargar el mismo archivo, no se duplican proyectos ni puestos.']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PROYECTOS');
    XLSX.utils.book_append_sheet(wb, ayuda, 'INSTRUCCIONES');
    XLSX.writeFile(wb, 'PLANTILLA_PROYECTOS_LIMPIEZA.xlsx');
  };

  function fechaExcel(v) {
    if (v === '' || v == null) return '';
    if (typeof v === 'number' && XLSX.SSF) { const d = XLSX.SSF.parse_date_code(v); if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; }
    if (v instanceof Date && !isNaN(v)) { const d = new Date(v.getTime() + 12 * 3600 * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return s;
  }
  const importacion = { filas: [], archivo: '', resultado: null };
  window.abrirImportacionLimpieza = function () {
    importacion.filas = []; importacion.resultado = null;
    modal('lp-importar', '⇧ CARGAR PROYECTOS Y PUESTOS DESDE EXCEL', `
      <p class="lp-nota">USA LA <b>PLANTILLA EXCEL</b>. PRIMERO SE VALIDA TODO EL ARCHIVO; <b>NO SE GUARDA NADA HASTA QUE CONFIRMES</b>.</p>
      <input type="file" accept=".xlsx,.xls,.csv" onchange="leerExcelLimpieza(this)">
      <div id="lp-import-res"></div>`,
    `<button onclick="document.getElementById('lp-importar').remove()">CANCELAR</button><button class="lp-primario" id="lp-import-ok" disabled onclick="confirmarImportacionLimpieza()">CONFIRMAR CARGA</button>`);
  };
  window.leerExcelLimpieza = async function (input) {
    const archivo = input.files?.[0]; const salida = document.getElementById('lp-import-res');
    document.getElementById('lp-import-ok').disabled = true;
    if (!archivo) return;
    try {
      const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true });
      const hoja = libro.Sheets.PROYECTOS || libro.Sheets[libro.SheetNames[0]];
      const crudas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: true });
      const clave = (k) => norm(k).replace(/[^A-Z0-9]+/g, ' ').trim();
      importacion.filas = crudas.filter((r) => Object.values(r).some((v) => String(v).trim())).map((r) => {
        const n = {}; Object.entries(r).forEach(([k, v]) => { n[clave(k)] = v; });
        const fila = {};
        COLUMNAS.forEach(([titulo, campo]) => { let v = n[clave(titulo)]; if (campo.endsWith('_date')) v = fechaExcel(v); fila[campo] = v === undefined || v === null ? '' : String(v).trim(); });
        return fila;
      });
      importacion.archivo = archivo.name;
      if (!importacion.filas.length) throw new Error('EL ARCHIVO NO CONTIENE FILAS.');
      salida.innerHTML = '<p class="lp-nota">VALIDANDO…</p>';
      const r = await supabaseRpc('import_cleaning_projects', { p_payload: { rows: importacion.filas, source_file_name: archivo.name }, p_dry_run: true });
      importacion.resultado = r;
      const c = r.counts || {};
      salida.innerHTML = r.ok
        ? `<div class="lp-ok"><b>VALIDACIÓN CORRECTA</b><p>${c.rows} FILA(S) · ${c.projects} PROYECTO(S) · ${c.posts} PUESTO(S)${c.associations_new ? ` · ${c.associations_new} ASOCIACIÓN(ES) NUEVA(S)` : ''}. LOS PROYECTOS Y PUESTOS QUE YA EXISTEN NO SE DUPLICAN.</p></div>`
        : `<div class="lp-mal"><b>ARCHIVO CON ERRORES (NO SE GUARDÓ NADA)</b><ul>${(r.errors || []).slice(0, 60).map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
      document.getElementById('lp-import-ok').disabled = !r.ok;
    } catch (e) { salida.innerHTML = `<div class="lp-mal">${esc(e.message || e)}</div>`; }
  };
  window.confirmarImportacionLimpieza = async function () {
    if (!importacion.resultado?.ok) return;
    const b = document.getElementById('lp-import-ok'); b.disabled = true; b.textContent = 'GUARDANDO…';
    try {
      const r = await supabaseRpc('import_cleaning_projects', { p_payload: { rows: importacion.filas, source_file_name: importacion.archivo }, p_dry_run: false });
      document.getElementById('lp-importar')?.remove();
      await cargarLimpieza();
      const c = r.counts || {};
      alert(`CARGA TERMINADA: ${c.projects} PROYECTO(S) NUEVO(S) · ${c.posts} PUESTO(S) NUEVO(S)${c.associations_new ? ` · ${c.associations_new} ASOCIACIÓN(ES) NUEVA(S)` : ''}.`);
    } catch (e) { alert(`NO SE PUDO CARGAR: ${e.message || e}`); b.disabled = false; b.textContent = 'CONFIRMAR CARGA'; }
  };

  // ── Vista: VENCIMIENTOS ────────────────────────────────────────
  function listaVencimientos() {
    return activos().filter((p) => (!lp.filtroAsoc || p.association_id === lp.filtroAsoc) && (lp.horizonte === 0 || (p.days_left != null && p.days_left <= lp.horizonte)))
      .sort((a, b) => (a.days_left ?? 99999) - (b.days_left ?? 99999) || String(a.name).localeCompare(String(b.name), 'es'));
  }
  function vistaVencimientos() {
    const lista = listaVencimientos();
    const asocs = lp.w.associations || [];
    const cuenta = (c) => lista.filter((p) => diasInfo(p).c === c).length;
    return `
      <div class="lp-barra">
        <select onchange="filtroLimpieza('filtroAsoc', this.value)"><option value="">TODAS LAS ASOCIACIONES</option>${asocs.map((a) => `<option value="${a.id}" ${lp.filtroAsoc === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
        <select onchange="filtroLimpieza('horizonte', Number(this.value))">${[[30, 'PRÓXIMOS 30 DÍAS'], [60, 'PRÓXIMOS 60 DÍAS'], [90, 'PRÓXIMOS 90 DÍAS'], [0, 'TODOS LOS PROYECTOS ACTIVOS']].map(([v, t]) => `<option value="${v}" ${lp.horizonte === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <button onclick="exportarVencimientosLimpieza('imagen')">🖼 IMAGEN</button><button onclick="exportarVencimientosLimpieza('excel')">📊 EXCEL</button>
      </div>
      <div class="lp-resumen"><span class="vencido"><b>${cuenta('vencido')}</b> VENCIDO(S)</span><span class="urgente"><b>${cuenta('urgente')}</b> ≤ 15 DÍAS</span><span class="pronto"><b>${cuenta('pronto')}</b> 16 A 30 DÍAS</span><span class="proximo"><b>${cuenta('proximo')}</b> 31 DÍAS O MÁS</span></div>
      <div class="lp-tabla-wrap"><table class="lp-tabla lp-venc"><thead><tr><th>N°</th><th>ASOCIACIÓN</th><th>ODC</th><th>ENTIDAD</th><th>PROVINCIA</th><th>PUESTOS</th><th>AUXILIARES</th><th>FECHA ACTIVACIÓN</th><th>FECHA DESACTIVACIÓN</th><th>DÍAS PARA CULMINAR</th></tr></thead><tbody>
        ${lista.map((p, i) => { const d = diasInfo(p); return `<tr onclick="abrirProyectoLimpieza('${p.id}')"><td>${i + 1}</td><td><b>${esc(p.association)}</b></td><td>${esc(p.contract_code || '—')}</td><td class="lp-izq">${esc(p.name)}</td><td>${esc(p.province || '—')}</td><td>${puestosDe(p).length}</td><td>${auxiliares(p)}</td><td>${fecha(p.start_date)}</td><td>${fecha(p.end_date)}</td><td class="lp-celda-dias ${d.c}">${esc(d.t)}</td></tr>`; }).join('')
          || `<tr><td colspan="10" class="lp-vacio">NINGÚN PROYECTO DE LIMPIEZA VENCE EN ESTE PERIODO.</td></tr>`}
      </tbody></table></div>`;
  }
  const TONOS = { vencido: ['FFFFFF', 'D32F2F'], urgente: ['C62828', 'F4CCCC'], pronto: ['B45309', 'FCE5CD'], proximo: ['7F6000', 'FFF2CC'], gris: ['475569', 'E2E8F0'] };
  window.exportarVencimientosLimpieza = async function (formato) {
    const lista = listaVencimientos();
    const hoy = fecha(lp.w.today);
    const periodo = lp.horizonte ? `VENCIDOS Y PRÓXIMOS ${lp.horizonte} DÍAS` : 'TODOS LOS PROYECTOS ACTIVOS';
    const asoc = lp.filtroAsoc ? (lp.w.associations || []).find((a) => a.id === lp.filtroAsoc)?.name : 'TODAS LAS ASOCIACIONES';
    const columnas = ['N°', 'ASOCIACIÓN', 'ODC', 'ENTIDAD', 'PROVINCIA', 'PUESTOS', 'AUXILIARES', 'FECHA ACTIVACIÓN', 'FECHA DESACTIVACIÓN', 'DÍAS PARA CULMINAR'];
    const filas = lista.map((p, i) => [i + 1, p.association, p.contract_code || '—', p.name, p.province || '—', puestosDe(p).length, auxiliares(p), fecha(p.start_date), fecha(p.end_date), diasInfo(p)]);
    const archivo = `VENCIMIENTOS_LIMPIEZA_${String(lp.w.today).slice(0, 10)}`;
    try {
      if (formato === 'excel') {
        const X = XLSX, ws = {}, linea = { style: 'thin', color: { rgb: 'B0BEC5' } }, bordes = { top: linea, bottom: linea, left: linea, right: linea };
        const poner = (f, c, v, s) => { ws[X.utils.encode_cell({ r: f, c })] = { t: typeof v === 'number' ? 'n' : 's', v: v ?? '', s }; };
        poner(0, 0, 'SERVICIO DE LIMPIEZA — PROYECTOS POR CULMINAR', { font: { name: 'Calibri', sz: 15, bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '0F766E' } }, alignment: { horizontal: 'center', vertical: 'center' } });
        for (let c = 1; c < columnas.length; c++) poner(0, c, '', { fill: { patternType: 'solid', fgColor: { rgb: '0F766E' } } });
        poner(1, 0, `CORTE AL ${hoy} · ${periodo} · ${asoc}`, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '37474F' } }, alignment: { horizontal: 'center' } });
        columnas.forEach((t, c) => poner(3, c, t, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '37474F' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: bordes }));
        filas.forEach((f, i) => f.forEach((v, c) => {
          const dias = c === f.length - 1;
          const s = { font: { name: 'Calibri', sz: 10, bold: dias, color: { rgb: dias ? TONOS[v.c][0] : '1F2937' } }, alignment: { horizontal: c === 3 ? 'left' : 'center', vertical: 'center' }, border: bordes };
          if (dias) s.fill = { patternType: 'solid', fgColor: { rgb: TONOS[v.c][1] } }; else if (i % 2 === 0) s.fill = { patternType: 'solid', fgColor: { rgb: 'ECEFF1' } };
          poner(4 + i, c, dias ? v.t : v, s);
        }));
        const fin = 4 + Math.max(filas.length, 1);
        if (!filas.length) poner(4, 0, 'NINGÚN PROYECTO VENCE EN ESTE PERIODO.', { font: { italic: true }, alignment: { horizontal: 'center' } });
        ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: fin, c: columnas.length - 1 } });
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columnas.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: columnas.length - 1 } }];
        ws['!cols'] = [5, 16, 20, 36, 16, 10, 12, 15, 16, 16].map((wch) => ({ wch }));
        ws['!rows'] = [{ hpt: 30 }, { hpt: 18 }, null, { hpt: 30 }];
        const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'VENCIMIENTOS'); X.writeFile(wb, archivo + '.xlsx');
        return;
      }
      if (typeof html2canvas !== 'function') throw new Error('NO SE ENCONTRÓ EL GENERADOR DE IMÁGENES.');
      const hoja = document.createElement('div');
      hoja.className = 'rg-hoja lp-hoja-limpieza';
      hoja.innerHTML = `<div class="rg-cabecera"><img src="img/logo.png" alt=""><div><b>SERVICIO DE LIMPIEZA</b><h1>PROYECTOS POR CULMINAR</h1><p>${esc(`CORTE AL ${hoy} · ${periodo} · ${asoc}`)}</p></div></div>
        <table class="rg-tabla"><thead><tr>${columnas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
        ${filas.map((f) => `<tr>${f.map((v, i) => (i === f.length - 1 ? `<td class="rg-dias" style="color:#${TONOS[v.c][0]};background:#${TONOS[v.c][1]}">${esc(v.t)}</td>` : `<td class="${i === 3 ? 'rg-izq' : ''}">${esc(v)}</td>`)).join('')}</tr>`).join('') || `<tr><td colspan="${columnas.length}" class="rg-vacio">NINGÚN PROYECTO VENCE EN ESTE PERIODO.</td></tr>`}
        </tbody></table>`;
      document.body.appendChild(hoja);
      try {
        await Promise.all([...hoja.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));
        const canvas = await html2canvas(hoja, { scale: 2, backgroundColor: '#ffffff', logging: false });
        const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
        try { if (navigator.clipboard && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); } catch (_) {}
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = archivo + '.png'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } finally { hoja.remove(); }
    } catch (e) { alert(`NO SE PUDO GENERAR: ${e.message || e}`); }
  };
})();
