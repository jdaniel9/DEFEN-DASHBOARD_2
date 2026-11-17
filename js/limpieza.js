// ================================================================
// limpieza.js — Servicio de LIMPIEZA (Grupo Coloma Avilés)
//   · Al iniciar sesión, quien tiene permiso elige entre SEGURIDAD y
//     LIMPIEZA. Sin permiso de Limpieza se entra directo a Seguridad.
//   · Limpieza: mapa del Ecuador con los puestos (logo de la asociación
//     al filtrar), mapa detallado por provincia con distancias entre
//     puestos, proyectos por asociación (tipo de contratación, tipo de
//     limpieza, metraje, ODC), puestos con horario y coordenadas,
//     asociaciones con RUC, documento del SRI y logo, carga por Excel,
//     exportación y tabla de vencimientos. Lo demás: "en mantenimiento".
// ================================================================
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
  const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const miles = (n) => Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 2 });
  const MODULO_KEY = 'defen_modulo_activo';
  const BUCKET = 'cleaning-files';
  const LOGO_GRUPO = 'img/limpieza/grupo-coloma-aviles.webp';
  const LOGOS = { ASOLABU: 'img/limpieza/asolabu.png', ASOPRES: 'img/limpieza/asopres.png', ASOINTERPLES: 'img/limpieza/asointerples.png', ASOINTERPRO: 'img/limpieza/asointerpro.png' };
  const TIPOS_CONTRATO = ['ORDEN DE COMPRA', 'CONTRATO', 'ÍNFIMA CUANTÍA', 'CONVENIO', 'OTRO'];
  const TIPOS_LIMPIEZA = ['HOSPITALARIA', 'TIPO I', 'TIPO II', 'TIPO III', 'OFICINAS / ADMINISTRATIVA', 'EDUCATIVA', 'INDUSTRIAL', 'OTRO'];
  const HORARIOS = ['8 HORAS', '12 HORAS', '24 HORAS', 'MEDIO TIEMPO (4 HORAS)', 'OTRO'];
  const COLORES = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];
  const lp = { w: null, vista: 'mapa', provincia: '', asociaciones: [], busqueda: '', filtroAsoc: '', filtroProv: '', filtroEstado: 'ACTIVE', filtroContrato: '', filtroTipo: '', horizonte: 60, proyectoId: '', cargando: false };
  const urlsLogo = {};

  const puedeVer = () => typeof tienePermiso === 'function' && tienePermiso('limpieza.ver', ['operaciones']);
  const puedeGestionar = () => Boolean(lp.w?.permissions?.manage);

  // ── Selector de módulo ─────────────────────────────────────────
  function mostrarSelector() {
    if (document.getElementById('modulo-selector')) return;
    const capa = document.createElement('div');
    capa.id = 'modulo-selector';
    capa.className = 'ms-capa';
    capa.innerHTML = `<div class="ms-caja">
      <h2>¿A QUÉ SERVICIO DESEAS INGRESAR?</h2>
      <p>${esc(sessionStorage.getItem('defen_auth_nombre') || '')}</p>
      <div class="ms-opciones">
        <button class="ms-seguridad" onclick="elegirModuloDefen('seguridad')"><img src="img/logo.png" alt=""><b>SEGURIDAD</b><small>DEFEN CIA. LTDA. · Mapa operativo, proyectos, armamento, radios y asistencia</small></button>
        <button class="ms-limpieza" onclick="elegirModuloDefen('limpieza')"><img src="${LOGO_GRUPO}" alt=""><b>LIMPIEZA</b><small>GRUPO COLOMA AVILÉS · Proyectos por asociación, puestos y vencimientos</small></button>
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

  // Botón "Limpieza" en la barra superior de Seguridad
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

  // ── Archivos privados (RUC, logo, ODC) ─────────────────────────
  async function subirArchivo(archivo, ruta) {
    const tipos = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const ext = String(archivo?.name || '').split('.').pop().toLowerCase();
    if (!tipos[ext]) throw new Error('EL ARCHIVO DEBE SER PDF, JPG, PNG O WEBP.');
    if (!archivo.size || archivo.size > 10 * 1024 * 1024) throw new Error('EL ARCHIVO NO PUEDE SUPERAR 10 MB.');
    const destino = `${ruta}/${crypto.randomUUID()}.${ext}`;
    let token = await supabaseTokenVigente();
    const subir = async () => {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${supabaseRutaStorage(destino)}`, { method: 'POST', headers: { ...supabaseHeaders(token), 'Content-Type': tipos[ext], 'x-upsert': 'false' }, body: archivo });
      if (r.ok) return destino;
      const t = await r.text(); let c = null; try { c = t ? JSON.parse(t) : null; } catch (_) { c = t; }
      const e = new Error(c?.message || c?.error || `NO SE PUDO SUBIR EL ARCHIVO (HTTP ${r.status}).`); e.status = r.status; throw e;
    };
    try { return await subir(); } catch (e) { if (e.status !== 401) throw e; token = await supabaseRenovarSesion(); return subir(); }
  }
  async function borrarArchivo(ruta) {
    if (!ruta) return;
    let token = await supabaseTokenVigente();
    const borrar = () => supabasePeticion(`/storage/v1/object/${BUCKET}/${supabaseRutaStorage(ruta)}`, { method: 'DELETE', headers: supabaseHeaders(token) });
    try { await borrar(); } catch (e) { if (e.status !== 401) return; token = await supabaseRenovarSesion(); try { await borrar(); } catch (_) {} }
  }
  async function urlFirmada(ruta, segundos = 600) {
    const r = await supabaseRpcStorageFirmadaEnBucket(BUCKET, ruta, segundos);
    const f = r?.signedURL || r?.signedUrl || '';
    if (!f) throw new Error('NO SE PUDO ABRIR EL ARCHIVO.');
    return f.startsWith('http') ? f : `${SUPABASE_URL}/storage/v1${f}`;
  }
  window.verArchivoLimpieza = async function (ruta) {
    try { window.open(await urlFirmada(decodeURIComponent(ruta), 300), '_blank', 'noopener'); }
    catch (e) { alert(e.message || e); }
  };
  // Elige un archivo, lo sube y lo registra en la asociación o el proyecto
  window.subirArchivoLimpieza = function (entidad, id, tipo) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = tipo === 'LOGO' ? 'image/png,image/jpeg,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      const archivo = input.files?.[0]; if (!archivo) return;
      let ruta = '';
      try {
        ruta = await subirArchivo(archivo, `${entidad === 'ASOCIACION' ? 'associations' : 'projects'}/${id}/${tipo.toLowerCase()}`);
        const r = await supabaseRpc('set_cleaning_file', { p_payload: { entity: entidad, kind: tipo, id, path: ruta } });
        if (r?.old_path && r.old_path !== ruta) await borrarArchivo(r.old_path);
        await cargarLimpieza();
        if (entidad === 'ASOCIACION') gestionarAsociacionesLimpieza(); else abrirProyectoLimpieza(id);
      } catch (e) {
        if (ruta) await borrarArchivo(ruta);
        alert(`NO SE PUDO GUARDAR EL ARCHIVO: ${e.message || e}`);
      }
    };
    input.click();
  };
  window.quitarArchivoLimpieza = async function (entidad, id, tipo) {
    if (!confirm('¿QUITAR ESTE ARCHIVO?')) return;
    try {
      const r = await supabaseRpc('set_cleaning_file', { p_payload: { entity: entidad, kind: tipo, id, path: null } });
      if (r?.old_path) await borrarArchivo(r.old_path);
      await cargarLimpieza();
      if (entidad === 'ASOCIACION') gestionarAsociacionesLimpieza(); else abrirProyectoLimpieza(id);
    } catch (e) { alert(`NO SE PUDO QUITAR: ${e.message || e}`); }
  };

  // ── Asociaciones: logos ────────────────────────────────────────
  const asociacion = (id) => (lp.w?.associations || []).find((a) => a.id === id);
  const logoAsoc = (a) => (a ? urlsLogo[a.id] || LOGOS[norm(a.name)] || '' : '');
  const colorAsoc = (id) => COLORES[Math.max(0, (lp.w?.associations || []).findIndex((a) => a.id === id)) % COLORES.length];
  const vinetaAsoc = (id, nombre) => {
    const a = asociacion(id), logo = logoAsoc(a);
    return logo ? `<span class="lp-vineta"><img src="${esc(logo)}" alt="">${esc(nombre ?? a?.name ?? '')}</span>`
      : `<span class="lp-vineta"><i style="background:${colorAsoc(id)}">${esc(String(nombre ?? a?.name ?? '?').slice(0, 2))}</i>${esc(nombre ?? a?.name ?? '')}</span>`;
  };
  async function firmarLogos() {
    await Promise.all((lp.w?.associations || []).filter((a) => a.logo_path).map(async (a) => {
      try { urlsLogo[a.id] = await urlFirmada(a.logo_path, 3600); } catch (_) { delete urlsLogo[a.id]; }
    }));
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
        <div class="lp-marca"><img src="${LOGO_GRUPO}" alt="Grupo Coloma Avilés"><div><h1>GRUPO COLOMA AVILÉS</h1><p>SERVICIO DE LIMPIEZA · PROYECTOS POR ASOCIACIÓN · PUESTOS · VENCIMIENTOS</p></div></div>
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
      lp.bases = await supabaseRpc('get_cleaning_reference_points', {}).catch(() => []);
      await firmarLogos();
      render();
    } catch (e) {
      const c = document.getElementById('lp-cuerpo');
      if (c) c.innerHTML = `<div class="lp-error">NO SE PUDO CARGAR LIMPIEZA: ${esc(e.message || e)}</div>`;
    } finally { lp.cargando = false; }
  }
  window.recargarLimpieza = cargarLimpieza;
  window.verLimpieza = function (vista) { lp.vista = vista; render(); document.getElementById('lp-cuerpo')?.scrollTo?.(0, 0); };

  function render() {
    const nav = document.getElementById('lp-nav');
    if (!nav) return;
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

  // ── Datos y filtros ────────────────────────────────────────────
  const proyectos = () => lp.w?.projects || [];
  const activos = () => proyectos().filter((p) => p.status === 'ACTIVE');
  const puestosDe = (p) => p.posts || [];
  const auxiliares = (p) => { const s = puestosDe(p).reduce((n, x) => n + Number(x.staff_count || 0), 0); return s || Number(p.staff_count || 0); };
  const valoresUnicos = (campo, base) => [...new Set([...base, ...proyectos().map((p) => p[campo]).filter(Boolean)])];
  // Filtros comunes a mapa, proyectos y vencimientos
  function filtrar(lista, { asociaciones = true } = {}) {
    return lista.filter((p) => (!asociaciones || !lp.asociaciones.length || lp.asociaciones.includes(p.association_id))
      && (!lp.filtroContrato || p.contract_type === lp.filtroContrato)
      && (!lp.filtroTipo || p.cleaning_type === lp.filtroTipo));
  }

  function diasInfo(p) {
    if (p.status === 'FINISHED') return { t: 'FINALIZADO', c: 'gris' };
    if (p.days_left === null || p.days_left === undefined) return { t: 'SIN FECHA', c: 'gris' };
    const d = Number(p.days_left);
    if (d < 0) return { t: `VENCIDO (${Math.abs(d)} D)`, c: 'vencido' };
    if (d === 0) return { t: 'HOY', c: 'vencido' };
    return { t: String(d), c: d <= 15 ? 'urgente' : d <= 30 ? 'pronto' : 'proximo' };
  }

  // Barra de filtros compartida: asociaciones con logo + tipo de contratación + tipo de limpieza
  function barraFiltros() {
    const asocs = (lp.w.associations || []).filter((a) => a.active);
    const contratos = valoresUnicos('contract_type', TIPOS_CONTRATO.filter((t) => t !== 'OTRO'));
    const tipos = valoresUnicos('cleaning_type', TIPOS_LIMPIEZA.filter((t) => t !== 'OTRO'));
    const activos = lp.asociaciones.length + (lp.filtroContrato ? 1 : 0) + (lp.filtroTipo ? 1 : 0);
    return `<div class="lp-filtros">
      <div class="lp-chips"><span>ASOCIACIÓN:</span><button class="${lp.asociaciones.length ? '' : 'activo'}" onclick="filtrarAsociacionLimpieza('')">TODAS</button>${asocs.map((a) => {
        const logo = logoAsoc(a);
        return `<button class="${lp.asociaciones.includes(a.id) ? 'activo' : ''}" onclick="filtrarAsociacionLimpieza('${a.id}')">${logo ? `<img src="${esc(logo)}" alt="">` : ''}${esc(a.name)} <small>${a.projects}</small></button>`;
      }).join('')}</div>
      <div class="lp-selects">
        <label>TIPO DE CONTRATACIÓN<select onchange="filtroLimpieza('filtroContrato', this.value)"><option value="">TODOS</option>${contratos.map((t) => `<option ${lp.filtroContrato === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label>TIPO DE LIMPIEZA<select onchange="filtroLimpieza('filtroTipo', this.value)"><option value="">TODOS</option>${tipos.map((t) => `<option ${lp.filtroTipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        ${activos ? '<button onclick="limpiarFiltrosLimpieza()">✕ QUITAR FILTROS</button>' : ''}
      </div></div>`;
  }
  window.filtrarAsociacionLimpieza = function (id) {
    if (!id) lp.asociaciones = []; else lp.asociaciones = lp.asociaciones.includes(id) ? lp.asociaciones.filter((x) => x !== id) : [...lp.asociaciones, id];
    render();
  };
  window.filtroLimpieza = function (campo, v) { lp[campo] = v; render(); };
  window.limpiarFiltrosLimpieza = function () { lp.asociaciones = []; lp.filtroContrato = ''; lp.filtroTipo = ''; render(); };

  // ── Vista: MAPA ────────────────────────────────────────────────
  function resumenPorProvincia(lista) {
    const porProv = new Map();
    lista.forEach((p) => {
      const sitios = puestosDe(p).length ? puestosDe(p) : [{ province_id: p.province_id, staff_count: p.staff_count, _sinPuesto: true }];
      sitios.forEach((s) => {
        const id = s.province_id ?? p.province_id; if (id == null) return;
        const e = porProv.get(id) || { puestos: 0, auxiliares: 0, proyectos: new Set(), asociaciones: new Set() };
        if (!s._sinPuesto) e.puestos++;
        e.auxiliares += Number(s.staff_count || 0); e.proyectos.add(p.id); e.asociaciones.add(p.association_id);
        porProv.set(id, e);
      });
    });
    return porProv;
  }

  function vistaMapa() {
    const lista = filtrar(activos());
    const porProv = resumenPorProvincia(lista);
    const provs = lp.w.provinces || [];
    const unaAsoc = lp.asociaciones.length === 1 ? asociacion(lp.asociaciones[0]) : null;
    const marcadores = provs.filter((pv) => porProv.has(pv.id) && pv.map_x != null).map((pv) => {
      const e = porProv.get(pv.id), n = e.puestos || e.proyectos.size;
      // Con una sola asociación filtrada (o una sola en la provincia), el marcador lleva su logo
      const soloAsoc = unaAsoc || (e.asociaciones.size === 1 ? asociacion([...e.asociaciones][0]) : null);
      const logo = soloAsoc ? logoAsoc(soloAsoc) : '';
      const titulo = `${pv.name}: ${e.proyectos.size} proyecto(s), ${e.puestos} puesto(s), ${e.auxiliares} auxiliar(es)`;
      return logo
        ? `<button class="lp-marcador lp-marcador-logo ${lp.provincia === pv.id ? 'activo' : ''}" style="left:${pv.map_x}%;top:${pv.map_y}%" onclick="elegirProvinciaLimpieza(${pv.id})" title="${esc(titulo)}"><img src="${esc(logo)}" alt=""><b>${n}</b></button>`
        : `<button class="lp-marcador ${lp.provincia === pv.id ? 'activo' : ''}" style="left:${pv.map_x}%;top:${pv.map_y}%" onclick="elegirProvinciaLimpieza(${pv.id})" title="${esc(titulo)}"><b>${n}</b></button>`;
    }).join('');
    const total = { proyectos: lista.length, puestos: lista.reduce((n, p) => n + puestosDe(p).length, 0), aux: lista.reduce((n, p) => n + auxiliares(p), 0), m2: lista.reduce((n, p) => n + Number(p.area_m2 || 0), 0), conCoord: lista.reduce((n, p) => n + puestosDe(p).filter((s) => s.latitude != null).length, 0) };
    const provSel = provs.find((pv) => pv.id === lp.provincia);
    const listaProv = provSel ? lista.filter((p) => p.province_id === provSel.id || puestosDe(p).some((s) => s.province_id === provSel.id)) : [];
    const coordProv = provSel ? listaProv.reduce((n, p) => n + puestosDe(p).filter((s) => s.province_id === provSel.id && s.latitude != null).length, 0) : 0;
    return `
      <div class="lp-kpis">
        <div><span>PROYECTOS ACTIVOS</span><b>${total.proyectos}</b></div>
        <div><span>PUESTOS</span><b>${total.puestos}</b></div>
        <div><span>AUXILIARES</span><b>${total.aux}</b></div>
        <div><span>METRAJE TOTAL</span><b>${miles(total.m2)} <small>m²</small></b></div>
      </div>
      ${barraFiltros()}
      <div class="lp-mapa-grid">
        <section class="lp-mapa-caja">
          <div class="lp-mapa"><img src="img/mapa.png" alt="Mapa del Ecuador"><div class="lp-mapa-marca"><img src="${LOGO_GRUPO}" alt="Grupo Coloma Avilés"></div>${marcadores}</div>
          <div class="lp-mapa-pie"><span>TOCA UNA PROVINCIA PARA VER SUS PROYECTOS Y SUS PUESTOS EN EL MAPA. EL NÚMERO ES LA CANTIDAD DE PUESTOS.</span>
            <button onclick="abrirMapaPuestosLimpieza()" ${total.conCoord ? '' : 'disabled'}>📍 VER TODOS LOS PUESTOS (${total.conCoord})</button></div>
        </section>
        <section class="lp-lateral">
          ${provSel ? `<div class="lp-lat-head"><h3>📍 ${esc(provSel.name)}</h3><button onclick="elegirProvinciaLimpieza('')">✕</button></div>
            <button class="lp-boton-mapa" onclick="abrirMapaPuestosLimpieza(${provSel.id})" ${coordProv ? '' : 'disabled'}>🗺 VER PUESTOS DE ${esc(provSel.name)} EN EL MAPA (${coordProv})</button>
            ${coordProv ? '' : '<p class="lp-nota">LOS PUESTOS DE ESTA PROVINCIA AÚN NO TIENEN COORDENADAS.</p>'}
            ${listaProv.map((p) => `<article class="lp-tarjeta" onclick="abrirProyectoLimpieza('${p.id}')"><header><b>${esc(p.name)}</b><span class="lp-dias ${diasInfo(p).c}">${esc(diasInfo(p).t)}</span></header>
              <small>${vinetaAsoc(p.association_id, p.association)}${p.contract_type ? ' · ' + esc(p.contract_type) : ''}${p.cleaning_type ? ' · ' + esc(p.cleaning_type) : ''} · FIN ${fecha(p.end_date)}</small>
              <ul>${puestosDe(p).filter((s) => s.province_id === provSel.id).map((s) => `<li>📍 ${esc(s.name)} <em>${s.staff_count} aux.</em>${s.schedule ? ` <span>${esc(s.schedule)}</span>` : ''}</li>`).join('') || '<li class="lp-vacio">SIN PUESTOS REGISTRADOS</li>'}</ul></article>`).join('') || '<p class="lp-vacio">SIN PROYECTOS EN ESTA PROVINCIA.</p>'}`
          : `<div class="lp-lat-head"><h3>PROVINCIAS CON SERVICIO</h3></div>
            ${provs.filter((pv) => porProv.has(pv.id)).sort((a, b) => porProv.get(b.id).auxiliares - porProv.get(a.id).auxiliares).map((pv) => { const e = porProv.get(pv.id); return `<button class="lp-prov" onclick="elegirProvinciaLimpieza(${pv.id})"><b>${esc(pv.name)}</b><small>${e.proyectos.size} proyecto(s) · ${e.puestos} puesto(s) · ${e.auxiliares} auxiliar(es)</small><span class="lp-prov-logos">${[...e.asociaciones].map((id) => { const l = logoAsoc(asociacion(id)); return l ? `<img src="${esc(l)}" alt="">` : ''; }).join('')}</span></button>`; }).join('')
              || `<div class="lp-vacio-grande"><img src="${LOGO_GRUPO}" alt=""><b>AÚN NO HAY PROYECTOS DE LIMPIEZA${lp.asociaciones.length || lp.filtroContrato || lp.filtroTipo ? ' CON ESTOS FILTROS' : ''}.</b>${puedeGestionar() ? `<p>Empieza agregando un proyecto o cargando tu Excel.</p><button onclick="verLimpieza('proyectos')">📋 IR A PROYECTOS</button>` : ''}</div>`}`}
        </section>
      </div>`;
  }
  window.elegirProvinciaLimpieza = function (id) { lp.provincia = id === '' ? '' : Number(id); render(); };

  // Distancia en km entre dos coordenadas (fórmula de Haversine)
  function distanciaKm(a, b) {
    const R = 6371, rad = (g) => (g * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const textoKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('es-EC', { maximumFractionDigits: 1 })} km`);

  // ── Mapa detallado con barra lateral: puesto, rutas y grupos de trabajo ──
  //   · PUESTO: al tocar un pin, sus datos y la distancia a los demás.
  //   · RUTA: salida desde un punto de partida (oficina DEFEN, bodega…),
  //     "mi ubicación" o un puesto, y varios destinos marcados. Calcula el
  //     recorrido recomendado por calles (OSRM) y lo compara con el orden
  //     marcado.
  //   · GRUPOS: sugiere grupos por cercanía (con comparativa de cuántos
  //     grupos conviene), permite mover puestos entre grupos a mano,
  //     equilibrar y calcular la ruta de cada grupo con recomendaciones.
  const OSRM = 'https://router.project-osrm.org/';
  const COLORES_GRUPO = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#b45309', '#475569'];
  const rm = { mapa: null, puntos: [], capaRuta: null, capaPines: null, seleccionado: null, pestana: 'puesto', titulo: '',
    origen: '', destinos: [], filtroDestino: '', volver: false, resultadoRuta: null,
    origenGrupos: '', grupos: null, sinGrupo: [], rutasGrupo: {}, nuevoPunto: false };
  const textoMin = (s) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  const nombrePunto = (pt) => (pt.tipo === 'puesto' ? pt.s.name : pt.nombre);
  const detallePunto = (pt) => (pt.tipo === 'puesto' ? pt.p.name : pt.tipo === 'base' ? 'PUNTO DE PARTIDA' : 'TU UBICACIÓN');
  const enlaceGoogle = (paradas) => {
    if (paradas.length < 2) return `https://www.google.com/maps?q=${paradas[0].lat},${paradas[0].lng}`;
    const o = paradas[0], d = paradas[paradas.length - 1], medio = paradas.slice(1, -1).slice(0, 9);
    return `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}${medio.length ? '&waypoints=' + medio.map((x) => `${x.lat},${x.lng}`).join('%7C') : ''}`;
  };
  const bases = () => (lp.bases || []).map((b) => ({ tipo: 'base', id: b.id, b, nombre: b.name, lat: Number(b.latitude), lng: Number(b.longitude) }));

  // Ordena paradas por "vecino más cercano" y mejora con 2-opt (la salida queda fija)
  function ordenarRecorrido(inicio, resto) {
    const orden = [inicio], pendientes = [...resto];
    while (pendientes.length) {
      const ultimo = orden[orden.length - 1];
      let mejor = 0;
      pendientes.forEach((x, i) => { if (distanciaKm(ultimo, x) < distanciaKm(ultimo, pendientes[mejor])) mejor = i; });
      orden.push(pendientes.splice(mejor, 1)[0]);
    }
    let mejoro = true, vueltas = 0;
    while (mejoro && vueltas++ < 50) {
      mejoro = false;
      for (let i = 1; i < orden.length - 1; i++) {
        for (let j = i + 1; j < orden.length; j++) {
          const antes = distanciaKm(orden[i - 1], orden[i]) + (j + 1 < orden.length ? distanciaKm(orden[j], orden[j + 1]) : 0);
          const despues = distanciaKm(orden[i - 1], orden[j]) + (j + 1 < orden.length ? distanciaKm(orden[i], orden[j + 1]) : 0);
          if (despues + 1e-9 < antes) { orden.splice(i, j - i + 1, ...orden.slice(i, j + 1).reverse()); mejoro = true; }
        }
      }
    }
    return orden;
  }
  const kmRecorrido = (lista) => lista.slice(1).reduce((n, x, i) => n + distanciaKm(lista[i], x), 0);
  // Largo estimado (línea recta) del recorrido de un grupo desde la salida
  const kmGrupo = (puntos, inicio) => (puntos.length ? kmRecorrido(inicio ? ordenarRecorrido(inicio, puntos) : ordenarRecorrido(puntos[0], puntos.slice(1))) : 0);

  async function osrm(servicio, paradas, extra = '') {
    const coords = paradas.map((x) => `${x.lng.toFixed(6)},${x.lat.toFixed(6)}`).join(';');
    const r = await fetch(`${OSRM}${servicio}/v1/driving/${coords}?overview=full&geometries=geojson${extra}`);
    if (!r.ok) throw new Error('EL SERVICIO DE RUTAS NO RESPONDIÓ. INTENTA DE NUEVO EN UNOS SEGUNDOS.');
    const j = await r.json();
    if (j.code !== 'Ok') throw new Error('NO SE ENCONTRÓ UNA RUTA POR CALLES ENTRE ESOS PUNTOS.');
    return j;
  }
  const leerViaje = (v) => ({ linea: v.geometry.coordinates.map(([lng, lat]) => [lat, lng]), km: v.distance / 1000, seg: v.duration, tramos: (v.legs || []).map((l) => ({ km: l.distance / 1000, seg: l.duration })) });
  async function rutaCalles(paradas) { return leerViaje((await osrm('route', paradas)).routes[0]); }
  // Recorrido óptimo por calles (OSRM "trip"); si falla, orden por cercanía
  async function recorridoOptimo(origen, destinos, volver) {
    const pts = [origen, ...destinos];
    if (pts.length > 2) {
      try {
        const j = await osrm('trip', pts, `&source=first&roundtrip=${volver ? 'true' : 'false'}${volver ? '' : '&destination=any'}`);
        const orden = pts.map((p, i) => ({ p, k: j.waypoints[i].waypoint_index })).sort((a, b) => a.k - b.k).map((x) => x.p);
        return { paradas: volver ? [...orden, origen] : orden, ruta: leerViaje(j.trips[0]) };
      } catch (_) { /* respaldo */ }
    }
    const paradas = ordenarRecorrido(origen, destinos);
    if (volver) paradas.push(origen);
    return { paradas, ruta: await rutaCalles(paradas) };
  }
  function dibujarRuta(ruta, paradas, color = '#0f766e', limpiar = true) {
    if (limpiar) rm.capaRuta.clearLayers();
    L.polyline(ruta.linea, { color: '#ffffff', weight: 8, opacity: 0.9 }).addTo(rm.capaRuta);
    L.polyline(ruta.linea, { color, weight: 5, opacity: 0.95 }).addTo(rm.capaRuta);
    paradas.forEach((x, i) => L.marker([x.lat, x.lng], { interactive: false, icon: L.divIcon({ className: 'lp-orden-caja', iconSize: [22, 22], iconAnchor: [11, 30], html: `<b class="lp-orden" style="background:${color}">${i === 0 && x.tipo !== 'puesto' ? '▶' : i + 1}</b>` }) }).addTo(rm.capaRuta));
    if (limpiar) rm.mapa.fitBounds(L.latLngBounds(ruta.linea).pad(0.15), { maxZoom: 16 });
  }

  function grupoDe(pt) { return rm.grupos ? rm.grupos.findIndex((g) => g.puntos.includes(pt)) : -1; }
  function pintarPines() {
    rm.capaPines.clearLayers();
    bases().forEach((b) => L.marker([b.lat, b.lng], { title: b.nombre, icon: L.divIcon({ className: 'lp-pin-caja', iconSize: [34, 34], iconAnchor: [17, 17], html: '<div class="lp-pin lp-pin-base">🏢</div>' }) }).addTo(rm.capaPines).bindTooltip(b.nombre, { direction: 'top' }));
    rm.puntos.forEach((pt, i) => {
      const a = asociacion(pt.p.association_id), logo = logoAsoc(a);
      const enGrupos = rm.pestana === 'grupos' && rm.grupos;
      const g = enGrupos ? grupoDe(pt) : -1;
      const color = enGrupos ? (g >= 0 ? rm.grupos[g].color : '#94a3b8') : colorAsoc(pt.p.association_id);
      const activo = rm.pestana === 'ruta' ? rm.destinos.includes(i) : rm.seleccionado === pt;
      const html = enGrupos ? `<div class="lp-pin lp-pin-color" style="background:${color}">${g >= 0 ? g + 1 : '?'}</div>`
        : logo ? `<div class="lp-pin ${activo ? 'lp-pin-activo' : ''}" style="border-color:${color}"><img src="${esc(logo)}" alt=""></div>`
          : `<div class="lp-pin lp-pin-color ${activo ? 'lp-pin-activo' : ''}" style="background:${color}">${esc(String(pt.p.association).slice(0, 2))}</div>`;
      L.marker([pt.lat, pt.lng], { title: `${pt.s.name} · ${pt.p.name}`, icon: L.divIcon({ className: 'lp-pin-caja', iconSize: [38, 38], iconAnchor: [19, 19], html }) })
        .addTo(rm.capaPines).on('click', () => tocarPinMapa(i));
    });
  }
  // Tocar un pin: en RUTA lo marca/desmarca como destino; en los demás muestra el puesto
  window.tocarPinMapa = function (i) {
    if (rm.pestana === 'ruta') { alternarDestinoMapa(i); return; }
    if (rm.pestana === 'grupos') { document.getElementById(`lpg-p-${i}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); document.getElementById(`lpg-p-${i}`)?.classList.add('lp-resaltar'); setTimeout(() => document.getElementById(`lpg-p-${i}`)?.classList.remove('lp-resaltar'), 1500); return; }
    seleccionarPuntoMapa(i);
  };

  window.abrirMapaPuestosLimpieza = function (provinciaId) {
    if (typeof L === 'undefined') return alert('NO SE PUDO CARGAR EL MAPA DETALLADO.');
    const puntos = [];
    filtrar(activos()).forEach((p) => puestosDe(p).forEach((s) => {
      if (s.latitude == null || s.longitude == null) return;
      if (provinciaId && s.province_id !== provinciaId) return;
      puntos.push({ tipo: 'puesto', p, s, lat: Number(s.latitude), lng: Number(s.longitude) });
    }));
    if (!puntos.length) return alert('NINGÚN PUESTO TIENE COORDENADAS TODAVÍA.');
    const prov = provinciaId ? (lp.w.provinces || []).find((x) => x.id === provinciaId) : null;
    const baseDefecto = bases()[0] ? `b:${bases()[0].id}` : '';
    Object.assign(rm, { puntos, seleccionado: null, pestana: 'puesto', titulo: `📍 PUESTOS DE LIMPIEZA${prov ? ' · ' + prov.name : ''} (${puntos.length})`,
      origen: baseDefecto, destinos: [], filtroDestino: '', resultadoRuta: null, origenGrupos: baseDefecto, grupos: null, sinGrupo: [], rutasGrupo: {}, nuevoPunto: false });
    document.getElementById('lp-mapa-modal')?.remove();
    const capa = document.createElement('div');
    capa.id = 'lp-mapa-modal'; capa.className = 'lp-modal';
    capa.innerHTML = `<div class="lp-modal-caja lp-modal-mapa"><header><h3>${esc(rm.titulo)}</h3><button onclick="cerrarMapaPuestosLimpieza()">✕</button></header>
      <div class="lp-rutas"><div id="lp-leaflet"></div><aside class="lp-rutas-lateral" id="lp-rutas-lateral"></aside></div></div>`;
    document.body.appendChild(capa);
    rm.mapa = L.map('lp-leaflet');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap · rutas: OSRM' }).addTo(rm.mapa);
    rm.capaRuta = L.layerGroup().addTo(rm.mapa);
    rm.capaPines = L.featureGroup().addTo(rm.mapa);
    pintarPines();
    rm.mapa.fitBounds(L.latLngBounds(puntos.map((x) => [x.lat, x.lng])).pad(0.2), { maxZoom: 15 });
    renderLateral();
    setTimeout(() => rm.mapa.invalidateSize(), 150);
  };
  window.cerrarMapaPuestosLimpieza = function () { try { rm.mapa?.remove(); } catch (_) {} rm.mapa = null; document.getElementById('lp-mapa-modal')?.remove(); };
  window.pestanaMapaLimpieza = function (p) { rm.pestana = p; rm.capaRuta.clearLayers(); pintarPines(); renderLateral(); };
  window.seleccionarPuntoMapa = function (i) { rm.seleccionado = rm.puntos[i] || null; rm.pestana = 'puesto'; rm.capaRuta.clearLayers(); pintarPines(); renderLateral(); };

  function renderLateral() {
    const caja = document.getElementById('lp-rutas-lateral'); if (!caja) return;
    const pest = [['puesto', '📍 PUESTO'], ['ruta', '🧭 RUTA'], ['grupos', '👥 GRUPOS']];
    const scroll = caja.querySelector('.lp-lateral-cuerpo')?.scrollTop || 0;
    caja.innerHTML = `<nav class="lp-pestanas">${pest.map(([k, t]) => `<button class="${rm.pestana === k ? 'activo' : ''}" onclick="pestanaMapaLimpieza('${k}')">${t}</button>`).join('')}</nav>
      <div class="lp-lateral-cuerpo">${rm.pestana === 'ruta' ? lateralRuta() : rm.pestana === 'grupos' ? lateralGrupos() : lateralPuesto()}</div>`;
    const cuerpo = caja.querySelector('.lp-lateral-cuerpo'); if (cuerpo) cuerpo.scrollTop = scroll;
  }

  // ── Pestaña PUESTO ─────────────────────────────────────────────
  function lateralPuesto() {
    const pt = rm.seleccionado;
    if (!pt) return `<div class="lp-ayuda-lateral"><b>TOCA UN PUESTO EN EL MAPA</b><p>Verás sus datos y la distancia a los demás. Para ir a varios puestos usa la pestaña <b>🧭 RUTA</b>; para repartir el trabajo, <b>👥 GRUPOS</b>.</p>
      <ul class="lp-lista-puestos">${rm.puntos.map((x, i) => `<li><button onclick="seleccionarPuntoMapa(${i})"><b>${esc(x.s.name)}</b><small>${esc(x.p.name)}</small></button></li>`).join('')}</ul></div>`;
    const cercanos = rm.puntos.filter((o) => o !== pt).map((o) => ({ o, i: rm.puntos.indexOf(o), km: distanciaKm(pt, o) })).sort((x, y) => x.km - y.km);
    return `<div class="lp-puesto-ficha">${vinetaAsoc(pt.p.association_id, pt.p.association)}<h4>${esc(pt.s.name)}</h4><p>${esc(pt.p.name)}</p>
        <small>${pt.s.staff_count} auxiliar(es)${pt.s.schedule ? ' · ' + esc(pt.s.schedule) : ''}${pt.s.address ? '<br>' + esc(pt.s.address) : ''}</small>
        <a href="https://www.google.com/maps?q=${pt.lat},${pt.lng}" target="_blank" rel="noopener">↗ VER EN GOOGLE MAPS</a></div>
      <h5>DISTANCIA A LOS DEMÁS PUESTOS <small>(en línea recta; toca 🚗 para la ruta por calles)</small></h5>
      <ol class="lp-cercanos">${cercanos.map(({ o, i, km }) => `<li id="lp-cerca-${i}"><div><b>${esc(o.s.name)}</b><small>${esc(o.p.name)}</small><span class="lp-ruta-dato"></span></div>
        <em>${textoKm(km)}</em><div class="lp-cerca-botones"><button onclick="rutaEntrePuestosLimpieza(${rm.puntos.indexOf(pt)}, ${i})">🚗 RUTA</button><a href="${enlaceGoogle([pt, o])}" target="_blank" rel="noopener" title="Abrir en Google Maps">↗</a></div></li>`).join('') || '<li class="lp-vacio">NO HAY OTROS PUESTOS EN ESTE MAPA.</li>'}</ol>`;
  }
  window.rutaEntrePuestosLimpieza = async function (a, b) {
    const o = rm.puntos[a], d = rm.puntos[b];
    const fila = document.querySelector(`#lp-cerca-${b} .lp-ruta-dato`);
    if (fila) fila.textContent = 'CALCULANDO RUTA…';
    try {
      const ruta = await rutaCalles([o, d]);
      dibujarRuta(ruta, [o, d]);
      document.querySelectorAll('.lp-cercanos li').forEach((li) => li.classList.remove('activo'));
      document.getElementById(`lp-cerca-${b}`)?.classList.add('activo');
      if (fila) fila.innerHTML = `🚗 <b>${textoKm(ruta.km)}</b> POR CALLES · ≈ ${textoMin(ruta.seg)}`;
    } catch (e) { if (fila) fila.textContent = e.message || String(e); }
  };

  // ── Selector de salida (puntos de partida, mi ubicación o un puesto) ──
  function opcionesSalida(actual, conNinguno) {
    const bs = bases();
    return `${conNinguno ? `<option value="" ${!actual ? 'selected' : ''}>— SIN PUNTO DE PARTIDA —</option>` : ''}
      ${bs.length ? `<optgroup label="PUNTOS DE PARTIDA">${bs.map((b) => `<option value="b:${b.id}" ${actual === `b:${b.id}` ? 'selected' : ''}>🏢 ${esc(b.nombre)}</option>`).join('')}</optgroup>` : ''}
      <option value="gps" ${actual === 'gps' ? 'selected' : ''}>📍 MI UBICACIÓN ACTUAL</option>
      <optgroup label="PUESTOS">${rm.puntos.map((x, i) => `<option value="p:${i}" ${actual === `p:${i}` ? 'selected' : ''}>${esc(x.s.name)} · ${esc(x.p.name)}</option>`).join('')}</optgroup>`;
  }
  async function resolverSalida(valorSalida) {
    if (!valorSalida) return null;
    if (valorSalida === 'gps') {
      if (!navigator.geolocation) throw new Error('ESTE DISPOSITIVO NO PERMITE OBTENER LA UBICACIÓN.');
      const pos = await new Promise((ok, mal) => navigator.geolocation.getCurrentPosition(ok, () => mal(new Error('NO SE PUDO OBTENER TU UBICACIÓN. REVISA EL PERMISO DE UBICACIÓN DEL NAVEGADOR.')), { enableHighAccuracy: true, timeout: 15000 }));
      return { tipo: 'gps', nombre: 'MI UBICACIÓN', lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
    if (valorSalida.startsWith('b:')) return bases().find((b) => b.id === valorSalida.slice(2)) || null;
    if (valorSalida.startsWith('p:')) return rm.puntos[Number(valorSalida.slice(2))] || null;
    return null;
  }
  // Alta de un punto de partida (oficina, bodega…)
  function formularioPunto() {
    if (!puedeGestionar()) return '';
    if (!rm.nuevoPunto) return '<button class="lp-enlace" onclick="rm_nuevoPuntoLimpieza(true)">＋ AGREGAR PUNTO DE PARTIDA (OFICINA, BODEGA…)</button>';
    return `<div class="lp-nuevo-punto"><b>NUEVO PUNTO DE PARTIDA</b>
      <label>NOMBRE<input id="lpb-nombre" maxlength="80" placeholder="EJ. DEFEN CIA. LTDA. (MATRIZ)"></label>
      <label>UBICACIÓN: PEGA UN ENLACE DE GOOGLE MAPS O "LATITUD, LONGITUD"<input id="lpb-enlace" placeholder="https://maps.google.com/…/@-2.15,-79.90,17z" oninput="leerCoordenadasPuntoLimpieza(this.value)"></label>
      <div class="lp-dos"><label>LATITUD<input id="lpb-lat" inputmode="decimal"></label><label>LONGITUD<input id="lpb-lng" inputmode="decimal"></label></div>
      <div class="lp-dos"><button onclick="usarMiUbicacionPuntoLimpieza()">📍 USAR MI UBICACIÓN</button><button class="lp-primario" onclick="guardarPuntoPartidaLimpieza()">GUARDAR</button></div>
      <button class="lp-enlace" onclick="rm_nuevoPuntoLimpieza(false)">CANCELAR</button></div>`;
  }
  window.rm_nuevoPuntoLimpieza = function (v) { rm.nuevoPunto = v; renderLateral(); };
  window.leerCoordenadasPuntoLimpieza = function (t) { const m = String(t).match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{2,3}\.\d+)/); if (m) { document.getElementById('lpb-lat').value = m[1]; document.getElementById('lpb-lng').value = m[2]; } };
  window.usarMiUbicacionPuntoLimpieza = async function () {
    try { const p = await resolverSalida('gps'); document.getElementById('lpb-lat').value = p.lat.toFixed(6); document.getElementById('lpb-lng').value = p.lng.toFixed(6); }
    catch (e) { alert(e.message || e); }
  };
  window.guardarPuntoPartidaLimpieza = async function () {
    const nombre = valor('lpb-nombre').trim(), lat = valor('lpb-lat').trim(), lng = valor('lpb-lng').trim();
    if (!nombre || !lat || !lng) return alert('COMPLETA EL NOMBRE Y LA UBICACIÓN.');
    try {
      const r = await supabaseRpc('save_cleaning_reference_point', { p_payload: { name: nombre, latitude: lat, longitude: lng } });
      lp.bases = await supabaseRpc('get_cleaning_reference_points', {});
      rm.nuevoPunto = false; rm.origen = `b:${r.id}`; rm.origenGrupos = rm.origenGrupos || `b:${r.id}`;
      pintarPines(); renderLateral();
    } catch (e) { alert(`NO SE PUDO GUARDAR: ${e.message || e}`); }
  };

  // ── Pestaña RUTA: varios destinos ──────────────────────────────
  function lateralRuta() {
    const q = norm(rm.filtroDestino);
    const visibles = rm.puntos.map((x, i) => ({ x, i })).filter(({ x }) => !q || norm([x.s.name, x.p.name, x.p.association, x.s.address].join(' ')).includes(q));
    const r = rm.resultadoRuta;
    return `<div class="lp-asistente">
      <label>1. ¿DESDE DÓNDE SALES?<select id="lpr-salida" onchange="rm_salidaLimpieza(this.value)">${opcionesSalida(rm.origen, false)}</select></label>
      ${formularioPunto()}
      <div class="lp-paso"><b>2. ¿A QUÉ PUESTOS VAS?</b> <small>(márcalos aquí o tocando los pines del mapa)</small></div>
      <div class="lp-dos"><input id="lpr-buscar" placeholder="FILTRAR: EJ. CDJ" value="${esc(rm.filtroDestino)}" oninput="rm_filtroDestinoLimpieza(this.value)"><button onclick="rm_marcarVisiblesLimpieza(true)">MARCAR ${visibles.length}</button></div>
      <ul class="lp-check-lista">${visibles.map(({ x, i }) => `<li><label><input type="checkbox" ${rm.destinos.includes(i) ? 'checked' : ''} onchange="alternarDestinoMapa(${i})"><span><b>${esc(x.s.name)}</b><small>${esc(x.p.name)}</small></span>${rm.destinos.includes(i) ? `<em>${rm.destinos.indexOf(i) + 1}</em>` : ''}</label></li>`).join('') || '<li class="lp-vacio">NINGÚN PUESTO COINCIDE.</li>'}</ul>
      <div class="lp-dos"><span class="lp-nota">${rm.destinos.length} DESTINO(S) MARCADO(S)</span>${rm.destinos.length ? '<button onclick="rm_marcarVisiblesLimpieza(false)">QUITAR TODOS</button>' : ''}</div>
      <label class="lp-check"><input type="checkbox" ${rm.volver ? 'checked' : ''} onchange="rm.volver=this.checked"> REGRESAR AL PUNTO DE SALIDA AL TERMINAR</label>
      <button class="lp-primario" onclick="calcularRutaMultipleLimpieza()" ${rm.destinos.length ? '' : 'disabled'}>🧭 CALCULAR LA MEJOR RUTA</button>
      <div id="lpr-resultado">${r ? resultadoRutaHtml(r) : ''}</div></div>`;
  }
  window.rm = rm;
  window.rm_salidaLimpieza = function (v) { rm.origen = v; rm.resultadoRuta = null; rm.capaRuta.clearLayers(); };
  window.rm_filtroDestinoLimpieza = function (v) { rm.filtroDestino = v; clearTimeout(rm._t); rm._t = setTimeout(() => { renderLateral(); const i = document.getElementById('lpr-buscar'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  window.alternarDestinoMapa = function (i) {
    rm.destinos = rm.destinos.includes(i) ? rm.destinos.filter((x) => x !== i) : [...rm.destinos, i];
    rm.resultadoRuta = null; rm.capaRuta.clearLayers();
    pintarPines(); renderLateral();
  };
  window.rm_marcarVisiblesLimpieza = function (marcar) {
    const q = norm(rm.filtroDestino);
    const vis = rm.puntos.map((x, i) => ({ x, i })).filter(({ x }) => !q || norm([x.s.name, x.p.name, x.p.association, x.s.address].join(' ')).includes(q)).map(({ i }) => i);
    rm.destinos = marcar ? [...rm.destinos, ...vis.filter((i) => !rm.destinos.includes(i))] : [];
    rm.resultadoRuta = null; rm.capaRuta.clearLayers(); pintarPines(); renderLateral();
  };
  window.calcularRutaMultipleLimpieza = async function () {
    const salidaHtml = document.getElementById('lpr-resultado');
    try {
      const origen = await resolverSalida(rm.origen);
      if (!origen) throw new Error('ELIGE DESDE DÓNDE SALES.');
      const destinos = rm.destinos.map((i) => rm.puntos[i]).filter((x) => x !== origen);
      if (!destinos.length) throw new Error('MARCA AL MENOS UN PUESTO DE DESTINO.');
      if (destinos.length > 24) throw new Error('MÁXIMO 24 DESTINOS POR RUTA. USA LA PESTAÑA GRUPOS PARA REPARTIRLOS.');
      salidaHtml.innerHTML = '<p class="lp-nota">CALCULANDO EL MEJOR RECORRIDO POR CALLES…</p>';
      const optimo = await recorridoOptimo(origen, destinos, rm.volver);
      // Comparación con el orden en que se marcaron los puestos
      let marcado = null;
      if (destinos.length > 1) {
        const paradasM = [origen, ...destinos, ...(rm.volver ? [origen] : [])];
        const mismo = paradasM.every((x, k) => x === optimo.paradas[k]);
        if (!mismo) { try { marcado = { paradas: paradasM, ruta: await rutaCalles(paradasM) }; } catch (_) {} }
      }
      rm.resultadoRuta = { origen, optimo, marcado, viendo: 'optimo' };
      dibujarRuta(optimo.ruta, optimo.paradas);
      renderLateral();
    } catch (e) { if (salidaHtml) salidaHtml.innerHTML = `<div class="lp-mal">${esc(e.message || e)}</div>`; }
  };
  function resultadoRutaHtml(r) {
    const o = r.optimo, m = r.marcado, ver = r.viendo === 'marcado' && m ? m : o;
    const ahorroKm = m ? m.ruta.km - o.ruta.km : 0, ahorroMin = m ? (m.ruta.seg - o.ruta.seg) / 60 : 0;
    const recomendaciones = [];
    if (m && (ahorroKm > 0.3 || ahorroMin > 2)) recomendaciones.push(`✅ La <b>ruta recomendada</b> te ahorra <b>${textoKm(Math.max(0, ahorroKm))}</b> y <b>${Math.max(0, Math.round(ahorroMin))} min</b> frente al orden en que marcaste los puestos.`);
    else if (r.optimo.paradas.length > 2) recomendaciones.push('✅ El orden en que marcaste los puestos ya es el más conveniente.');

    const tramoMax = o.ruta.tramos.reduce((mx, t, k) => (t.seg > (mx?.t.seg || 0) ? { t, k } : mx), null);
    if (tramoMax && o.ruta.tramos.length > 2 && tramoMax.t.seg > o.ruta.seg * 0.45) recomendaciones.push(`⚠ El tramo hacia <b>${esc(nombrePunto(o.paradas[tramoMax.k + 1]))}</b> ocupa casi la mitad del tiempo (${textoMin(tramoMax.t.seg)}); considera atenderlo en otro grupo o en otro día.`);
    if (o.ruta.seg > 3 * 3600) recomendaciones.push(`⚠ El recorrido dura más de 3 horas en vehículo. Usa <b>👥 GRUPOS</b> para dividirlo.`);
    return `${recomendaciones.length ? `<div class="lp-recomendacion">${recomendaciones.join('<br>')}</div>` : ''}
      ${m ? `<div class="lp-comparar"><button class="${r.viendo !== 'marcado' ? 'activo' : ''}" onclick="rm_verRutaLimpieza('optimo')">⭐ RECOMENDADA<br><b>${textoKm(o.ruta.km)} · ${textoMin(o.ruta.seg)}</b></button><button class="${r.viendo === 'marcado' ? 'activo' : ''}" onclick="rm_verRutaLimpieza('marcado')">TU ORDEN<br><b>${textoKm(m.ruta.km)} · ${textoMin(m.ruta.seg)}</b></button></div>` : ''}
      <div class="lp-ruta-total"><b>${textoKm(ver.ruta.km)}</b> · ≈ ${textoMin(ver.ruta.seg)} EN VEHÍCULO · ${ver.paradas.length - 1} TRAMO(S)</div>
      <ol class="lp-paradas">${ver.paradas.map((x, i) => `<li><b>${i + 1}. ${esc(nombrePunto(x))}</b><small>${esc(detallePunto(x))}</small>${i ? `<em>+ ${textoKm(ver.ruta.tramos[i - 1].km)} · ${textoMin(ver.ruta.tramos[i - 1].seg)}</em>` : '<em>SALIDA</em>'}</li>`).join('')}</ol>
      <a class="lp-boton-google" href="${enlaceGoogle(ver.paradas)}" target="_blank" rel="noopener">↗ ABRIR ESTA RUTA EN GOOGLE MAPS</a>
      ${ver.paradas.length > 11 ? '<p class="lp-nota">GOOGLE MAPS ADMITE HASTA 10 PARADAS POR ENLACE; EL RECORRIDO COMPLETO SE VE EN ESTE MAPA.</p>' : ''}
      ${rm.destinos.length > 3 ? '<button class="lp-enlace" onclick="rm_repartirDesdeRutaLimpieza()">👥 REPARTIR ESTOS PUESTOS EN GRUPOS</button>' : ''}`;
  }
  window.rm_verRutaLimpieza = function (cual) {
    const r = rm.resultadoRuta; if (!r) return;
    r.viendo = cual; const v = cual === 'marcado' && r.marcado ? r.marcado : r.optimo;
    dibujarRuta(v.ruta, v.paradas, cual === 'marcado' ? '#64748b' : '#0f766e');
    renderLateral();
  };
  window.rm_repartirDesdeRutaLimpieza = function () {
    rm.origenGrupos = rm.origen; rm.grupos = null; rm.sinGrupo = [...rm.destinos]; rm.rutasGrupo = {}; rm.soloMarcados = true;
    pestanaMapaLimpieza('grupos');
  };

  // ── Pestaña GRUPOS ─────────────────────────────────────────────
  function kMedias(puntos, k) {
    k = Math.max(1, Math.min(k, puntos.length));
    const centros = [[...puntos].sort((a, b) => b.lat - a.lat)[0]].map((x) => ({ lat: x.lat, lng: x.lng }));
    while (centros.length < k) {
      const lejano = puntos.reduce((m, x) => { const d = Math.min(...centros.map((c) => distanciaKm(c, x))); return d > m.d ? { x, d } : m; }, { x: puntos[0], d: -1 }).x;
      centros.push({ lat: lejano.lat, lng: lejano.lng });
    }
    let asignacion = [];
    for (let vuelta = 0; vuelta < 40; vuelta++) {
      const nueva = puntos.map((x) => centros.reduce((m, c, i) => (distanciaKm(c, x) < distanciaKm(centros[m], x) ? i : m), 0));
      if (nueva.join() === asignacion.join()) break;
      asignacion = nueva;
      centros.forEach((c, i) => { const del = puntos.filter((_, j) => asignacion[j] === i); if (del.length) { c.lat = del.reduce((n, x) => n + x.lat, 0) / del.length; c.lng = del.reduce((n, x) => n + x.lng, 0) / del.length; } });
    }
    return centros.map((c, i) => puntos.filter((_, j) => asignacion[j] === i)).filter((g) => g.length);
  }
  // Equilibrio: mueve puestos de un grupo a otro mientras baje el recorrido más largo
  function equilibrar(grupos, inicio) {
    for (let vuelta = 0; vuelta < 60; vuelta++) {
      const largos = grupos.map((g) => kmGrupo(g, inicio));
      const peor = largos.indexOf(Math.max(...largos));
      let mejor = null;
      grupos[peor].forEach((pt) => grupos.forEach((g, j) => {
        if (j === peor || grupos[peor].length < 2) return;
        const a = kmGrupo(grupos[peor].filter((x) => x !== pt), inicio), b = kmGrupo([...g, pt], inicio);
        const nuevoMax = Math.max(a, b, ...largos.filter((_, k) => k !== peor && k !== j));
        if (nuevoMax < largos[peor] - 0.05 && (!mejor || nuevoMax < mejor.max)) mejor = { pt, j, max: nuevoMax };
      }));
      if (!mejor) break;
      grupos[peor] = grupos[peor].filter((x) => x !== mejor.pt); grupos[mejor.j].push(mejor.pt);
    }
    return grupos;
  }
  const puntosParaGrupos = () => (rm.soloMarcados && rm.destinos.length ? rm.destinos.map((i) => rm.puntos[i]) : rm.puntos);
  function crearGrupos(listas) { rm.grupos = listas.map((pts, i) => ({ n: i + 1, color: COLORES_GRUPO[i % COLORES_GRUPO.length], puntos: pts })); rm.rutasGrupo = {}; }
  // Comparativa: recorrido más largo (línea recta) según la cantidad de grupos
  function comparativa(inicio) {
    const pts = puntosParaGrupos(), filas = [];
    for (let k = 1; k <= Math.min(6, pts.length); k++) {
      const gs = equilibrar(kMedias(pts, k), inicio);
      const largos = gs.map((g) => kmGrupo(g, inicio));
      filas.push({ k, max: Math.max(...largos), total: largos.reduce((a, b) => a + b, 0) });
    }
    // Recomendado: a partir de aquí, sumar un grupo reduce el más largo en menos de 25 %
    let rec = filas.length ? filas[filas.length - 1].k : 1;
    for (let i = 0; i < filas.length - 1; i++) { if (filas[i + 1].max > filas[i].max * 0.75) { rec = filas[i].k; break; } }
    return { filas, rec };
  }
  function lateralGrupos() {
    const pts = puntosParaGrupos();
    const asignados = rm.grupos ? rm.grupos.flatMap((g) => g.puntos) : [];
    const sinGrupo = pts.filter((x) => !asignados.includes(x));
    return `<div class="lp-asistente">
      <label>PUNTO DE SALIDA DE LOS GRUPOS<select id="lpg-salida" onchange="rm.origenGrupos=this.value; rm.rutasGrupo={}; renderLateralLimpieza()">${opcionesSalida(rm.origenGrupos, true)}</select></label>
      ${formularioPunto()}
      ${rm.soloMarcados && rm.destinos.length ? `<p class="lp-nota">REPARTIENDO LOS ${rm.destinos.length} PUESTOS MARCADOS EN RUTA. <button class="lp-enlace" onclick="rm.soloMarcados=false; rm.grupos=null; renderLateralLimpieza()">USAR TODOS LOS PUESTOS</button></p>` : `<p class="lp-nota">REPARTIENDO LOS ${pts.length} PUESTOS DE ESTE MAPA.</p>`}
      <div class="lp-grupos-modo">
        <label>¿CUÁNTOS GRUPOS?<input id="lpg-k" type="number" min="1" max="${Math.min(10, pts.length)}" value="${rm.grupos ? rm.grupos.length : Math.min(2, pts.length)}"></label>
        <button class="lp-primario" onclick="sugerirGruposLimpieza()">⭐ SUGERIR GRUPOS</button>
      </div>
      <div class="lp-dos"><button onclick="gruposManualesLimpieza()">✋ ARMAR A MANO</button><button onclick="compararGruposLimpieza()">📊 ¿CUÁNTOS CONVIENEN?</button></div>
      <div id="lpg-comparativa">${rm.comparativa ? comparativaHtml(rm.comparativa) : ''}</div>
      ${rm.grupos ? gruposHtml(sinGrupo) : ''}</div>`;
  }
  window.renderLateralLimpieza = () => { pintarPines(); renderLateral(); };
  function comparativaHtml(c) {
    return `<table class="lp-tabla lp-comp"><thead><tr><th>GRUPOS</th><th>RECORRIDO MÁS LARGO</th><th>KM TOTAL</th></tr></thead><tbody>
      ${c.filas.map((f) => `<tr class="${f.k === c.rec ? 'lp-rec' : ''}" onclick="document.getElementById('lpg-k').value=${f.k}; sugerirGruposLimpieza()"><td><b>${f.k}</b>${f.k === c.rec ? ' ⭐' : ''}</td><td>${textoKm(f.max)}</td><td>${textoKm(f.total)}</td></tr>`).join('')}
      </tbody></table><p class="lp-nota">⭐ RECOMENDADO: ${c.rec} GRUPO(S). AGREGAR MÁS GRUPOS YA NO REDUCE MUCHO EL RECORRIDO MÁS LARGO. DISTANCIAS EN LÍNEA RECTA; TOCA UNA FILA PARA ARMAR ESOS GRUPOS.</p>`;
  }
  function gruposHtml(sinGrupo) {
    const opcionesMover = (pt) => `<select onchange="moverPuestoGrupoLimpieza(${rm.puntos.indexOf(pt)}, this.value)"><option value="">MOVER…</option>${rm.grupos.map((g, j) => `<option value="${j}">GRUPO ${g.n}</option>`).join('')}<option value="-1">SIN GRUPO</option></select>`;
    const rutas = rm.rutasGrupo;
    const calculadas = rm.grupos.filter((g, j) => rutas[j]?.ruta);
    let recomend = '';
    if (calculadas.length > 1) {
      const tiempos = rm.grupos.map((g, j) => ({ g, j, seg: rutas[j]?.ruta?.seg || 0 })).filter((x) => x.seg);
      const max = tiempos.reduce((a, b) => (b.seg > a.seg ? b : a)), min = tiempos.reduce((a, b) => (b.seg < a.seg ? b : a));
      if (max.seg > min.seg * 1.5 && max.seg - min.seg > 15 * 60) {
        // Puesto del grupo más largo que queda más cerca del grupo más corto
        const cand = max.g.puntos.map((pt) => ({ pt, km: Math.min(...min.g.puntos.map((o) => distanciaKm(pt, o))) })).sort((a, b) => a.km - b.km)[0];
        recomend = `⚖ El <b>GRUPO ${max.g.n}</b> tarda ${textoMin(max.seg)} y el <b>GRUPO ${min.g.n}</b> ${textoMin(min.seg)}. ${cand ? `Sugerencia: mover <b>${esc(cand.pt.s.name)}</b> al GRUPO ${min.g.n} (está a ${textoKm(cand.km)} de ese grupo). <button class="lp-enlace" onclick="moverPuestoGrupoLimpieza(${rm.puntos.indexOf(cand.pt)}, ${min.j}); calcularRutasGruposLimpieza()">APLICAR</button>` : ''}`;
      } else recomend = '✅ Los grupos están equilibrados en tiempo de recorrido.';
    }
    if (sinGrupo.length) recomend = `⚠ Quedan <b>${sinGrupo.length} puesto(s) sin grupo</b>; no entran en ninguna ruta.${recomend ? '<br>' + recomend : ''}`;
    return `<div class="lp-dos lp-acciones-grupos"><button onclick="equilibrarGruposLimpieza()">⚖ EQUILIBRAR</button><button onclick="agregarGrupoLimpieza()">＋ GRUPO</button><button class="lp-primario" onclick="calcularRutasGruposLimpieza()">🚗 CALCULAR RUTAS</button></div>
      ${recomend ? `<div class="lp-recomendacion">${recomend}</div>` : ''}
      ${calculadas.length ? `<div class="lp-ruta-total">${calculadas.length} RUTA(S) · ${textoKm(calculadas.reduce((s, g) => s + rutas[rm.grupos.indexOf(g)].ruta.km, 0))} EN TOTAL · EL MÁS LARGO ≈ ${textoMin(Math.max(...calculadas.map((g) => rutas[rm.grupos.indexOf(g)].ruta.seg)))}</div>` : ''}
      ${sinGrupo.length ? `<article class="lp-grupo lp-sin-grupo"><header><b>SIN GRUPO (${sinGrupo.length})</b><small>ASÍGNALOS CON "MOVER…"</small></header><ul>${sinGrupo.map((pt) => `<li id="lpg-p-${rm.puntos.indexOf(pt)}"><span>${esc(pt.s.name)}<small>${esc(pt.p.name)}</small></span>${opcionesMover(pt)}</li>`).join('')}</ul></article>` : ''}
      ${rm.grupos.map((g, j) => { const r = rutas[j]; const lista = r?.paradas ? r.paradas.filter((x) => x.tipo === 'puesto') : g.puntos; return `<article class="lp-grupo" style="border-left-color:${g.color}"><header><b style="color:${g.color}">GRUPO ${g.n}</b><small>${g.puntos.length} puesto(s) · ${g.puntos.reduce((s, x) => s + Number(x.s.staff_count || 0), 0)} aux.</small></header>
        <ul>${lista.map((pt, k) => `<li id="lpg-p-${rm.puntos.indexOf(pt)}"><span>${r?.paradas ? `<i>${k + 1}</i>` : ''}${esc(pt.s.name)}<small>${esc(pt.p.name)}</small></span>${opcionesMover(pt)}</li>`).join('') || '<li class="lp-vacio">VACÍO: MUEVE PUESTOS A ESTE GRUPO.</li>'}</ul>
        ${r?.ruta ? `<span class="lp-ruta-dato">🚗 <b>${textoKm(r.ruta.km)}</b> POR CALLES · ≈ ${textoMin(r.ruta.seg)}</span>` : r?.error ? `<span class="lp-ruta-dato">${esc(r.error)}</span>` : ''}
        ${g.puntos.length ? `<div class="lp-cerca-botones"><button onclick="verRutaGrupoLimpieza(${j})">🗺 VER EN MAPA</button>${r?.paradas ? `<a href="${enlaceGoogle(r.paradas)}" target="_blank" rel="noopener">↗ GOOGLE MAPS</a>` : ''}</div>` : ''}</article>`; }).join('')}
      <button class="lp-boton-google" onclick="exportarGruposLimpieza()">📊 DESCARGAR GRUPOS EN EXCEL</button>`;
  }
  window.compararGruposLimpieza = async function () {
    const inicio = await resolverSalida(rm.origenGrupos).catch(() => null);
    rm.comparativa = comparativa(inicio);
    renderLateral();
  };
  window.sugerirGruposLimpieza = async function () {
    const pts = puntosParaGrupos();
    const k = Math.max(1, Math.min(10, pts.length, Number(valor('lpg-k')) || 1));
    let inicio = null; try { inicio = await resolverSalida(rm.origenGrupos); } catch (e) { alert(e.message || e); }
    crearGrupos(equilibrar(kMedias(pts, k), inicio));
    rm.comparativa = comparativa(inicio);
    rm.capaRuta.clearLayers(); pintarPines(); renderLateral();
  };
  window.gruposManualesLimpieza = function () {
    const k = Math.max(1, Math.min(10, Number(valor('lpg-k')) || 2));
    crearGrupos(Array.from({ length: k }, () => []));
    rm.capaRuta.clearLayers(); pintarPines(); renderLateral();
  };
  window.agregarGrupoLimpieza = function () {
    if (!rm.grupos || rm.grupos.length >= 10) return;
    const n = rm.grupos.length;
    rm.grupos.push({ n: n + 1, color: COLORES_GRUPO[n % COLORES_GRUPO.length], puntos: [] });
    renderLateral();
  };
  window.moverPuestoGrupoLimpieza = function (i, destino) {
    if (destino === '' || !rm.grupos) return;
    const pt = rm.puntos[i];
    rm.grupos.forEach((g) => { g.puntos = g.puntos.filter((x) => x !== pt); });
    if (Number(destino) >= 0) rm.grupos[Number(destino)].puntos.push(pt);
    rm.rutasGrupo = {};
    rm.capaRuta.clearLayers(); pintarPines(); renderLateral();
  };
  window.equilibrarGruposLimpieza = async function () {
    if (!rm.grupos) return;
    const inicio = await resolverSalida(rm.origenGrupos).catch(() => null);
    const listas = equilibrar(rm.grupos.map((g) => [...g.puntos]), inicio);
    rm.grupos.forEach((g, j) => { g.puntos = listas[j]; });
    rm.rutasGrupo = {}; pintarPines(); renderLateral();
  };
  window.calcularRutasGruposLimpieza = async function () {
    if (!rm.grupos) return;
    let inicio = null;
    try { inicio = await resolverSalida(rm.origenGrupos); } catch (e) { alert(e.message || e); return; }
    rm.capaRuta.clearLayers();
    for (let j = 0; j < rm.grupos.length; j++) {
      const g = rm.grupos[j];
      if (!g.puntos.length) { delete rm.rutasGrupo[j]; continue; }
      try {
        const salida = inicio || ordenarRecorrido(g.puntos[0], g.puntos.slice(1))[0];
        const destinos = inicio ? g.puntos : g.puntos.filter((x) => x !== salida);
        const r = destinos.length ? await recorridoOptimo(salida, destinos, false) : { paradas: [salida], ruta: null };
        rm.rutasGrupo[j] = r;
        if (r.ruta) dibujarRuta(r.ruta, r.paradas, g.color, false);
      } catch (e) { rm.rutasGrupo[j] = { error: e.message || String(e) }; }
    }
    const todas = Object.values(rm.rutasGrupo).filter((r) => r.ruta).flatMap((r) => r.ruta.linea);
    if (todas.length) rm.mapa.fitBounds(L.latLngBounds(todas).pad(0.1), { maxZoom: 15 });
    renderLateral();
  };
  window.verRutaGrupoLimpieza = async function (j) {
    const g = rm.grupos?.[j]; if (!g) return;
    let r = rm.rutasGrupo[j];
    if (!r?.ruta) {
      try {
        const inicio = await resolverSalida(rm.origenGrupos);
        const salida = inicio || ordenarRecorrido(g.puntos[0], g.puntos.slice(1))[0];
        const destinos = inicio ? g.puntos : g.puntos.filter((x) => x !== salida);
        if (!destinos.length) { rm.mapa.setView([salida.lat, salida.lng], 15); return; }
        r = rm.rutasGrupo[j] = await recorridoOptimo(salida, destinos, false);
      } catch (e) { alert(e.message || e); return; }
    }
    dibujarRuta(r.ruta, r.paradas, g.color);
    renderLateral();
  };
  window.exportarGruposLimpieza = function () {
    if (!rm.grupos || typeof XLSX === 'undefined') return;
    const filas = [];
    rm.grupos.forEach((g, j) => {
      const r = rm.rutasGrupo[j];
      const lista = r?.paradas ? r.paradas.filter((x) => x.tipo === 'puesto') : g.puntos;
      lista.forEach((pt, i) => filas.push({ 'GRUPO': g.n, 'ORDEN': i + 1, 'PUESTO': pt.s.name, 'PROYECTO': pt.p.name, 'ASOCIACIÓN': pt.p.association, 'AUXILIARES': Number(pt.s.staff_count || 0), 'HORARIO': pt.s.schedule || '', 'DIRECCIÓN': pt.s.address || '', 'LATITUD': pt.lat, 'LONGITUD': pt.lng, 'GOOGLE MAPS': `https://www.google.com/maps?q=${pt.lat},${pt.lng}` }));
    });
    const resumen = rm.grupos.map((g, j) => { const r = rm.rutasGrupo[j]; return { 'GRUPO': g.n, 'PUESTOS': g.puntos.length, 'AUXILIARES': g.puntos.reduce((s, x) => s + Number(x.s.staff_count || 0), 0), 'KM POR CALLES': r?.ruta ? Number(r.ruta.km.toFixed(1)) : '', 'TIEMPO (MIN)': r?.ruta ? Math.round(r.ruta.seg / 60) : '', 'RECORRIDO EN GOOGLE MAPS': r?.paradas ? enlaceGoogle(r.paradas) : '' }; });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'RESUMEN');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'INFORMACIÓN': 'SIN PUESTOS EN LOS GRUPOS' }]), 'RECORRIDOS');
    XLSX.writeFile(wb, `GRUPOS_LIMPIEZA_${String(lp.w.today).slice(0, 10)}.xlsx`);
  };

  // ── Vista: PROYECTOS ───────────────────────────────────────────
  function listaProyectos() {
    const q = norm(lp.busqueda);
    return filtrar(proyectos()).filter((p) => (!lp.filtroProv || String(p.province_id) === String(lp.filtroProv))
      && (!lp.filtroEstado || p.status === lp.filtroEstado)
      && (!q || norm([p.name, p.contract_code, p.association, p.province, p.city, p.contract_type, p.cleaning_type, ...puestosDe(p).map((s) => s.name)].join(' ')).includes(q)));
  }
  function vistaProyectos() {
    const lista = listaProyectos();
    const provs = lp.w.provinces || [];
    return `
      ${barraFiltros()}
      <div class="lp-barra">
        <input placeholder="Buscar entidad, ODC, puesto…" value="${esc(lp.busqueda)}" oninput="buscarLimpieza(this.value)">
        <select onchange="filtroLimpieza('filtroProv', this.value)"><option value="">TODAS LAS PROVINCIAS</option>${provs.map((p) => `<option value="${p.id}" ${String(lp.filtroProv) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <select onchange="filtroLimpieza('filtroEstado', this.value)"><option value="ACTIVE" ${lp.filtroEstado === 'ACTIVE' ? 'selected' : ''}>ACTIVOS</option><option value="FINISHED" ${lp.filtroEstado === 'FINISHED' ? 'selected' : ''}>FINALIZADOS</option><option value="" ${!lp.filtroEstado ? 'selected' : ''}>TODOS</option></select>
      </div>
      <div class="lp-botones">
        ${puedeGestionar() ? `<button class="lp-primario" onclick="formularioProyectoLimpieza()">＋ NUEVO PROYECTO</button>
        <button onclick="abrirImportacionLimpieza()">⇧ CARGAR DESDE EXCEL</button>
        <button onclick="descargarPlantillaLimpieza()">⇩ PLANTILLA EXCEL</button>` : ''}
        <button onclick="gestionarAsociacionesLimpieza()">🏷 ASOCIACIONES</button>
        <button onclick="exportarProyectosLimpieza()">📊 EXPORTAR EXCEL</button>
      </div>
      <div class="lp-tabla-wrap"><table class="lp-tabla"><thead><tr><th>ASOCIACIÓN</th><th>ODC</th><th>ENTIDAD</th><th>CONTRATACIÓN</th><th>LIMPIEZA</th><th>PROVINCIA</th><th>M²</th><th>PUESTOS</th><th>AUX.</th><th>FIN</th><th>DÍAS</th></tr></thead><tbody>
        ${lista.map((p) => { const d = diasInfo(p); return `<tr onclick="abrirProyectoLimpieza('${p.id}')"><td class="lp-izq">${vinetaAsoc(p.association_id, p.association)}</td><td>${esc(p.contract_code || '—')}${p.contract_document_path ? ' 📎' : ''}</td><td class="lp-izq"><b>${esc(p.name)}</b>${p.city ? `<small>${esc(p.city)}</small>` : ''}</td><td>${esc(p.contract_type || '—')}</td><td>${esc(p.cleaning_type || '—')}</td><td>${esc(p.province || '—')}</td><td>${p.area_m2 ? miles(p.area_m2) : '—'}</td><td>${puestosDe(p).length}</td><td>${auxiliares(p)}</td><td>${fecha(p.end_date)}</td><td><span class="lp-dias ${d.c}">${esc(d.t)}</span></td></tr>`; }).join('')
          || `<tr><td colspan="11" class="lp-vacio">NO HAY PROYECTOS CON ESTOS FILTROS.</td></tr>`}
      </tbody></table></div>
      <p class="lp-nota">${lista.length} PROYECTO(S) · TOCA UNO PARA VER SU FICHA, SUS DOCUMENTOS Y SUS PUESTOS.</p>`;
  }
  let tBusqueda = null;
  window.buscarLimpieza = function (v) { lp.busqueda = v; clearTimeout(tBusqueda); tBusqueda = setTimeout(() => { render(); const i = document.querySelector('.lp-barra input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };

  window.exportarProyectosLimpieza = function () {
    if (typeof XLSX === 'undefined') return alert('NO SE PUDO CARGAR EL GENERADOR DE EXCEL.');
    const lista = listaProyectos();
    const hojaP = XLSX.utils.json_to_sheet(lista.map((p, i) => ({ 'N°': i + 1, 'ASOCIACIÓN': p.association, 'ODC': p.contract_code || '', 'TIPO DE CONTRATACIÓN': p.contract_type || '', 'ENTIDAD': p.name, 'TIPO DE LIMPIEZA': p.cleaning_type || '', 'METRAJE (M²)': p.area_m2 != null ? Number(p.area_m2) : '', 'PROVINCIA': p.province || '', 'CIUDAD': p.city || '', 'PUESTOS': puestosDe(p).length, 'AUXILIARES': auxiliares(p), 'FECHA INICIO': fecha(p.start_date), 'FECHA FIN': fecha(p.end_date), 'DÍAS PARA CULMINAR': diasInfo(p).t, 'ESTADO': p.status === 'ACTIVE' ? 'ACTIVO' : 'FINALIZADO' })));
    const filasS = []; lista.forEach((p) => puestosDe(p).forEach((s) => filasS.push({ 'ASOCIACIÓN': p.association, 'ENTIDAD': p.name, 'PUESTO': s.name, 'PROVINCIA': s.province || '', 'CIUDAD': s.city || '', 'DIRECCIÓN': s.address || '', 'AUXILIARES': Number(s.staff_count || 0), 'HORARIO': s.schedule || '', 'LATITUD': s.latitude ?? '', 'LONGITUD': s.longitude ?? '' })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, hojaP, 'PROYECTOS');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasS.length ? filasS : [{ 'INFORMACIÓN': 'SIN PUESTOS' }]), 'PUESTOS');
    XLSX.writeFile(wb, `PROYECTOS_LIMPIEZA_${String(lp.w.today).slice(0, 10)}.xlsx`);
  };

  // ── Modales ────────────────────────────────────────────────────
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
  // Lista desplegable con opción "OTRO" que habilita un texto libre
  const selectConOtro = (id, opciones, actual) => {
    const conocido = !actual || opciones.includes(actual);
    return `<select id="${id}" onchange="document.getElementById('${id}-otro').style.display=this.value==='OTRO'?'':'none'"><option value="">—</option>${opciones.map((o) => `<option ${(conocido ? actual === o : o === 'OTRO') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>
      <input id="${id}-otro" maxlength="80" placeholder="ESPECIFICA" value="${conocido ? '' : esc(actual)}" style="display:${conocido ? 'none' : ''}">`;
  };
  const leerConOtro = (id) => { const v = valor(id); return v === 'OTRO' ? (valor(`${id}-otro`).trim() || 'OTRO') : v; };

  window.abrirProyectoLimpieza = function (id) {
    const p = proyectos().find((x) => x.id === id); if (!p) return;
    lp.proyectoId = id;
    const d = diasInfo(p), g = puedeGestionar();
    const doc = p.contract_document_path;
    modal('lp-proyecto', `${esc(p.name)}`, `
      <div class="lp-ficha">
        <div><span>ASOCIACIÓN</span><b>${vinetaAsoc(p.association_id, p.association)}</b></div>
        <div><span>ODC / CONTRATO</span><b>${esc(p.contract_code || '—')}</b></div>
        <div><span>TIPO DE CONTRATACIÓN</span><b>${esc(p.contract_type || '—')}</b></div>
        <div><span>TIPO DE LIMPIEZA</span><b>${esc(p.cleaning_type || '—')}</b></div>
        <div><span>METRAJE</span><b>${p.area_m2 ? miles(p.area_m2) + ' m²' : '—'}</b></div>
        <div><span>PROVINCIA / CIUDAD</span><b>${esc([p.province, p.city].filter(Boolean).join(' · ') || '—')}</b></div>
        <div><span>INICIO</span><b>${fecha(p.start_date)}</b></div><div><span>FIN</span><b>${fecha(p.end_date)}</b></div>
        <div><span>AUXILIARES</span><b>${auxiliares(p)}${p.staff_count ? ` <small>(CONTRATADOS: ${p.staff_count})</small>` : ''}</b></div>
        <div><span>DÍAS PARA CULMINAR</span><b><span class="lp-dias ${d.c}">${esc(d.t)}</span></b></div>
        <div class="lp-ancho"><span>DIRECCIÓN</span><b>${esc(p.address || '—')}</b></div>
        <div class="lp-ancho lp-doc"><span>DOCUMENTO DE LA ODC / CONTRATO</span>
          <div>${doc ? `<button onclick="verArchivoLimpieza('${encodeURIComponent(doc)}')">📄 VER DOCUMENTO</button>` : '<em>SIN DOCUMENTO</em>'}
          ${g ? `<button onclick="subirArchivoLimpieza('PROYECTO','${p.id}','ODC')">📎 ${doc ? 'REEMPLAZAR' : 'SUBIR'} (PDF O IMAGEN)</button>${doc ? `<button class="lp-quitar" onclick="quitarArchivoLimpieza('PROYECTO','${p.id}','ODC')">🗑</button>` : ''}` : ''}</div></div>
        ${p.notes ? `<div class="lp-ancho"><span>OBSERVACIONES</span><b>${esc(p.notes)}</b></div>` : ''}
      </div>
      <div class="lp-sub"><h4>PUESTOS (${puestosDe(p).length})</h4><div>${puestosDe(p).some((s) => s.latitude != null) ? `<button class="lp-sec" onclick="abrirMapaProyectoLimpieza('${p.id}')">🗺 VER EN MAPA</button>` : ''}${g ? `<button onclick="formularioPuestoLimpieza('${p.id}')">＋ AGREGAR PUESTO</button>` : ''}</div></div>
      <div class="lp-tabla-wrap"><table class="lp-tabla"><thead><tr><th>PUESTO</th><th>PROVINCIA / CIUDAD</th><th>DIRECCIÓN</th><th>AUX.</th><th>HORARIO</th><th>UBICACIÓN</th>${g ? '<th></th>' : ''}</tr></thead><tbody>
        ${puestosDe(p).map((s) => `<tr><td class="lp-izq"><b>${esc(s.name)}</b></td><td>${esc([s.province, s.city].filter(Boolean).join(' · ') || '—')}</td><td class="lp-izq">${esc(s.address || '—')}</td><td>${s.staff_count}</td><td>${esc(s.schedule || '—')}</td>
          <td>${s.latitude != null ? `<a href="https://www.google.com/maps?q=${s.latitude},${s.longitude}" target="_blank" rel="noopener">📍 VER</a>` : '<span class="lp-gris">SIN COORD.</span>'}</td>
          ${g ? `<td class="lp-acciones-fila"><button onclick="formularioPuestoLimpieza('${p.id}','${s.id}')">✎</button><button onclick="quitarPuestoLimpieza('${s.id}')">🗑</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="7" class="lp-vacio">SIN PUESTOS. ${g ? 'AGRÉGALOS CON EL BOTÓN DE ARRIBA O DESDE EXCEL.' : ''}</td></tr>`}
      </tbody></table></div>`,
    g ? `<button onclick="formularioProyectoLimpieza('${p.id}')">✎ EDITAR PROYECTO</button>${p.status === 'ACTIVE' ? `<button class="lp-peligro" onclick="finalizarProyectoLimpieza('${p.id}')">FINALIZAR PROYECTO</button>` : `<button onclick="finalizarProyectoLimpieza('${p.id}', true)">REACTIVAR</button>`}` : '', 'lp-modal-ancho');
  };
  // Mapa con los puestos de un solo proyecto
  window.abrirMapaProyectoLimpieza = function (id) {
    const guardado = { a: lp.asociaciones, c: lp.filtroContrato, t: lp.filtroTipo };
    const p = proyectos().find((x) => x.id === id); if (!p) return;
    const original = lp.w.projects;
    lp.w.projects = [p]; lp.asociaciones = []; lp.filtroContrato = ''; lp.filtroTipo = '';
    try { abrirMapaPuestosLimpieza(); } finally { lp.w.projects = original; lp.asociaciones = guardado.a; lp.filtroContrato = guardado.c; lp.filtroTipo = guardado.t; }
  };

  window.formularioProyectoLimpieza = function (id = '') {
    const p = proyectos().find((x) => x.id === id) || {};
    const asocs = (lp.w.associations || []).filter((a) => a.active || a.id === p.association_id);
    modal('lp-form-proyecto', id ? '✎ EDITAR PROYECTO' : '＋ NUEVO PROYECTO DE LIMPIEZA', `
      <div class="lp-form">
        <label>ASOCIACIÓN *<select id="lpf-asoc"><option value="">SELECCIONA…</option>${asocs.map((a) => `<option value="${a.id}" ${p.association_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
        <label>ODC / N° CONTRATO<input id="lpf-odc" maxlength="60" value="${esc(p.contract_code || '')}"></label>
        <label>TIPO DE CONTRATACIÓN${selectConOtro('lpf-contrato', TIPOS_CONTRATO, p.contract_type || '')}</label>
        <label>TIPO DE LIMPIEZA${selectConOtro('lpf-tipo', TIPOS_LIMPIEZA, p.cleaning_type || '')}</label>
        <label class="lp-ancho">ENTIDAD / CLIENTE *<input id="lpf-nombre" maxlength="150" value="${esc(p.name || '')}" placeholder="EJ. HOSPITAL GENERAL DE…"></label>
        <label>PROVINCIA<select id="lpf-prov">${opcionesProv(p.province_id)}</select></label>
        <label>CIUDAD<input id="lpf-ciudad" maxlength="80" value="${esc(p.city || '')}"></label>
        <label class="lp-ancho">DIRECCIÓN<input id="lpf-dir" maxlength="200" value="${esc(p.address || '')}"></label>
        <label>FECHA DE INICIO<input id="lpf-ini" type="date" value="${esc(p.start_date || '')}"></label>
        <label>FECHA DE FIN<input id="lpf-fin" type="date" value="${esc(p.end_date || '')}"></label>
        <label>METRAJE (M²)<input id="lpf-m2" inputmode="decimal" value="${esc(p.area_m2 ?? '')}" placeholder="EJ. 12500"></label>
        <label>AUXILIARES CONTRATADOS<input id="lpf-aux" type="number" min="0" max="5000" value="${esc(p.staff_count ?? '')}"></label>
        <label class="lp-ancho">OBSERVACIONES<textarea id="lpf-notas" rows="2" maxlength="500">${esc(p.notes || '')}</textarea></label>
        ${id ? '' : '<p class="lp-nota lp-ancho">📎 EL DOCUMENTO DE LA ODC SE SUBE DESDE LA FICHA DEL PROYECTO, DESPUÉS DE GUARDARLO.</p>'}
      </div>`, `<button onclick="document.getElementById('lp-form-proyecto').remove()">CANCELAR</button><button class="lp-primario" onclick="guardarProyectoLimpieza('${id}')">GUARDAR</button>`);
  };
  window.guardarProyectoLimpieza = async function (id) {
    const p = proyectos().find((x) => x.id === id) || {};
    const payload = { id: id || null, association_id: valor('lpf-asoc'), contract_code: valor('lpf-odc'), contract_type: leerConOtro('lpf-contrato'), cleaning_type: leerConOtro('lpf-tipo'), name: valor('lpf-nombre'), province_id: valor('lpf-prov'), city: valor('lpf-ciudad'), address: valor('lpf-dir'), start_date: valor('lpf-ini'), end_date: valor('lpf-fin'), area_m2: valor('lpf-m2'), staff_count: valor('lpf-aux'), notes: valor('lpf-notas'), status: p.status || 'ACTIVE' };
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
      await supabaseRpc('save_cleaning_project', { p_payload: { id: p.id, association_id: p.association_id, contract_code: p.contract_code, contract_type: p.contract_type, cleaning_type: p.cleaning_type, area_m2: p.area_m2, name: p.name, province_id: p.province_id, city: p.city, address: p.address, start_date: p.start_date, end_date: p.end_date, staff_count: p.staff_count, notes: p.notes, status: reactivar ? 'ACTIVE' : 'FINISHED' } });
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
        <label>TIPO DE HORARIO${selectConOtro('lps-horario', HORARIOS, s.schedule || '')}</label>
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
    const payload = { id: postId || null, project_id: projectId, name: valor('lps-nombre'), province_id: valor('lps-prov'), city: valor('lps-ciudad'), address: valor('lps-dir'), latitude: valor('lps-lat').trim(), longitude: valor('lps-lng').trim(), staff_count: valor('lps-aux'), schedule: leerConOtro('lps-horario') };
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

  // ── Asociaciones ───────────────────────────────────────────────
  window.gestionarAsociacionesLimpieza = function () {
    const asocs = lp.w.associations || [], g = puedeGestionar();
    modal('lp-asociaciones', '🏷 ASOCIACIONES', `
      ${g ? `<div class="lp-form lp-form-linea"><label class="lp-ancho">NUEVA ASOCIACIÓN<input id="lpa-nombre" maxlength="80" placeholder="EJ. ASOLABU"></label><label>RUC (OPCIONAL)<input id="lpa-ruc" maxlength="13" inputmode="numeric"></label><button class="lp-primario" onclick="guardarAsociacionLimpieza()">＋ AGREGAR</button></div>` : ''}
      <div class="lp-asocs">${asocs.map((a) => { const logo = logoAsoc(a); return `<article class="lp-asoc ${a.active ? '' : 'inactiva'}">
        <div class="lp-asoc-logo">${logo ? `<img src="${esc(logo)}" alt="">` : `<i style="background:${colorAsoc(a.id)}">${esc(a.name.slice(0, 2))}</i>`}</div>
        <div class="lp-asoc-datos"><b>${esc(a.name)}</b><small>RUC: ${esc(a.ruc || 'SIN REGISTRAR')} · ${a.projects} PROYECTO(S) ACTIVO(S)${a.active ? '' : ' · INACTIVA'}</small>
          <div class="lp-asoc-botones">
            ${a.ruc_document_path ? `<button onclick="verArchivoLimpieza('${encodeURIComponent(a.ruc_document_path)}')">📄 VER RUC (SRI)</button>` : '<em>SIN DOCUMENTO RUC</em>'}
            ${g ? `<button onclick="subirArchivoLimpieza('ASOCIACION','${a.id}','RUC')">📎 ${a.ruc_document_path ? 'REEMPLAZAR' : 'SUBIR'} RUC</button>
            <button onclick="subirArchivoLimpieza('ASOCIACION','${a.id}','LOGO')">🖼 ${a.logo_path ? 'CAMBIAR' : 'SUBIR'} LOGO</button>
            <button onclick="editarAsociacionLimpieza('${a.id}')">✎ EDITAR</button>
            <button onclick="cambiarEstadoAsociacionLimpieza('${a.id}')">${a.active ? 'DESACTIVAR' : 'ACTIVAR'}</button>` : ''}
          </div></div></article>`; }).join('')}</div>
      <p class="lp-nota">EL DOCUMENTO RUC Y EL LOGO PUEDEN SER PDF O IMAGEN (MÁXIMO 10 MB). ${Object.keys(LOGOS).join(', ')} YA TIENEN SU LOGO; SUBIR UNO NUEVO LO REEMPLAZA.</p>`, '', 'lp-modal-ancho');
  };
  window.editarAsociacionLimpieza = function (id) {
    const a = asociacion(id); if (!a) return;
    modal('lp-editar-asoc', `✎ EDITAR ${esc(a.name)}`, `<div class="lp-form">
      <label class="lp-ancho">NOMBRE<input id="lpe-nombre" maxlength="80" value="${esc(a.name)}"></label>
      <label>RUC<input id="lpe-ruc" maxlength="13" inputmode="numeric" value="${esc(a.ruc || '')}"></label>
      <label class="lp-ancho">OBSERVACIONES<textarea id="lpe-notas" rows="2" maxlength="300">${esc(a.notes || '')}</textarea></label></div>`,
    `<button onclick="document.getElementById('lp-editar-asoc').remove()">CANCELAR</button><button class="lp-primario" onclick="guardarEdicionAsociacionLimpieza('${a.id}')">GUARDAR</button>`);
  };
  window.guardarEdicionAsociacionLimpieza = async function (id) {
    const a = asociacion(id); if (!a) return;
    const ruc = valor('lpe-ruc').trim();
    if (ruc && !/^\d{10,13}$/.test(ruc)) return alert('EL RUC DEBE TENER ENTRE 10 Y 13 DÍGITOS.');
    try {
      await supabaseRpc('save_cleaning_association', { p_payload: { id, name: valor('lpe-nombre'), ruc, notes: valor('lpe-notas'), active: a.active } });
      document.getElementById('lp-editar-asoc')?.remove();
      await cargarLimpieza(); gestionarAsociacionesLimpieza();
    } catch (e) { alert(`NO SE PUDO GUARDAR: ${e.message || e}`); }
  };
  window.guardarAsociacionLimpieza = async function () {
    const nombre = valor('lpa-nombre').trim(), ruc = valor('lpa-ruc').trim();
    if (!nombre) return alert('ESCRIBE EL NOMBRE DE LA ASOCIACIÓN.');
    if (ruc && !/^\d{10,13}$/.test(ruc)) return alert('EL RUC DEBE TENER ENTRE 10 Y 13 DÍGITOS.');
    try { await supabaseRpc('save_cleaning_association', { p_payload: { name: nombre, ruc } }); await cargarLimpieza(); gestionarAsociacionesLimpieza(); }
    catch (e) { alert(`NO SE PUDO GUARDAR: ${e.message || e}`); }
  };
  window.cambiarEstadoAsociacionLimpieza = async function (id) {
    const a = asociacion(id); if (!a) return;
    try { await supabaseRpc('save_cleaning_association', { p_payload: { id: a.id, name: a.name, ruc: a.ruc, notes: a.notes, active: !a.active } }); await cargarLimpieza(); gestionarAsociacionesLimpieza(); }
    catch (e) { alert(`NO SE PUDO ACTUALIZAR: ${e.message || e}`); }
  };

  // ── Excel: plantilla e importación ─────────────────────────────
  const COLUMNAS = [
    ['ASOCIACION', 'association'], ['ODC', 'contract_code'], ['TIPO CONTRATACION', 'contract_type'], ['ENTIDAD', 'entity'], ['TIPO LIMPIEZA', 'cleaning_type'], ['METRAJE M2', 'area_m2'],
    ['PROVINCIA', 'province'], ['CIUDAD', 'city'], ['DIRECCION', 'address'],
    ['FECHA INICIO', 'start_date'], ['FECHA FIN', 'end_date'], ['AUXILIARES CONTRATADOS', 'project_staff'],
    ['PUESTO', 'post'], ['PROVINCIA PUESTO', 'post_province'], ['CIUDAD PUESTO', 'post_city'], ['DIRECCION PUESTO', 'post_address'],
    ['LATITUD', 'latitude'], ['LONGITUD', 'longitude'], ['AUXILIARES PUESTO', 'staff'], ['HORARIO', 'schedule']
  ];
  window.descargarPlantillaLimpieza = function () {
    if (typeof XLSX === 'undefined') return alert('NO SE PUDO CARGAR EL GENERADOR DE EXCEL.');
    const ejemplo = ['ASOLABU', 'CE-2026000000001', 'ORDEN DE COMPRA', 'HOSPITAL DE EJEMPLO', 'HOSPITALARIA', 12500, 'GUAYAS', 'GUAYAQUIL', 'AV. PRINCIPAL 123', '01/01/2026', '31/12/2026', 10, 'EMERGENCIA', 'GUAYAS', 'GUAYAQUIL', 'BLOQUE A, PLANTA BAJA', -2.1894, -79.8891, 4, '12 HORAS'];
    const ejemplo2 = ['ASOLABU', 'CE-2026000000001', 'ORDEN DE COMPRA', 'HOSPITAL DE EJEMPLO', 'HOSPITALARIA', 12500, 'GUAYAS', 'GUAYAQUIL', '', '01/01/2026', '31/12/2026', 10, 'CONSULTA EXTERNA', '', '', '', '', '', 6, '8 HORAS'];
    const ws = XLSX.utils.aoa_to_sheet([COLUMNAS.map((c) => c[0]), ejemplo, ejemplo2]);
    const ayuda = XLSX.utils.aoa_to_sheet([
      ['INSTRUCCIONES'],
      ['1. Cada fila es un PUESTO. Las filas con la misma ASOCIACION + ENTIDAD + ODC forman un mismo proyecto.'],
      ['2. Obligatorios: ASOCIACION y ENTIDAD. Si la asociación no existe, se crea automáticamente.'],
      [`3. TIPO CONTRATACION sugerido: ${TIPOS_CONTRATO.join(', ')}.`],
      [`4. TIPO LIMPIEZA sugerido: ${TIPOS_LIMPIEZA.join(', ')}.`],
      [`5. HORARIO sugerido: ${HORARIOS.join(', ')}.`],
      ['6. METRAJE M2 en metros cuadrados (ej. 12500 o 12.500). PROVINCIA con el nombre oficial (ej. GUAYAS, SANTO DOMINGO, LOS RIOS).'],
      ['7. Fechas en formato DD/MM/AAAA. LATITUD y LONGITUD son opcionales (ej. -2.1894 y -79.8891).'],
      ['8. Borra las 2 filas de ejemplo antes de cargar. Si vuelves a cargar el mismo archivo, no se duplican proyectos ni puestos.']
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
      // Tipo de contratación, tipo de limpieza y metraje
      try { await supabaseRpc('import_cleaning_projects_extra', { p_payload: { rows: importacion.filas } }); } catch (e) { console.warn('Datos adicionales:', e); }
      document.getElementById('lp-importar')?.remove();
      await cargarLimpieza();
      const c = r.counts || {};
      alert(`CARGA TERMINADA: ${c.projects} PROYECTO(S) NUEVO(S) · ${c.posts} PUESTO(S) NUEVO(S)${c.associations_new ? ` · ${c.associations_new} ASOCIACIÓN(ES) NUEVA(S)` : ''}.`);
    } catch (e) { alert(`NO SE PUDO CARGAR: ${e.message || e}`); b.disabled = false; b.textContent = 'CONFIRMAR CARGA'; }
  };

  // ── Vista: VENCIMIENTOS ────────────────────────────────────────
  function listaVencimientos() {
    return filtrar(activos()).filter((p) => lp.horizonte === 0 || (p.days_left != null && p.days_left <= lp.horizonte))
      .sort((a, b) => (a.days_left ?? 99999) - (b.days_left ?? 99999) || String(a.name).localeCompare(String(b.name), 'es'));
  }
  function vistaVencimientos() {
    const lista = listaVencimientos();
    const cuenta = (c) => lista.filter((p) => diasInfo(p).c === c).length;
    return `
      ${barraFiltros()}
      <div class="lp-barra">
        <select onchange="filtroLimpieza('horizonte', Number(this.value))">${[[30, 'PRÓXIMOS 30 DÍAS'], [60, 'PRÓXIMOS 60 DÍAS'], [90, 'PRÓXIMOS 90 DÍAS'], [0, 'TODOS LOS PROYECTOS ACTIVOS']].map(([v, t]) => `<option value="${v}" ${lp.horizonte === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <button onclick="exportarVencimientosLimpieza('imagen')">🖼 IMAGEN</button><button onclick="exportarVencimientosLimpieza('excel')">📊 EXCEL</button>
      </div>
      <div class="lp-resumen"><span class="vencido"><b>${cuenta('vencido')}</b> VENCIDO(S)</span><span class="urgente"><b>${cuenta('urgente')}</b> ≤ 15 DÍAS</span><span class="pronto"><b>${cuenta('pronto')}</b> 16 A 30 DÍAS</span><span class="proximo"><b>${cuenta('proximo')}</b> 31 DÍAS O MÁS</span></div>
      <div class="lp-tabla-wrap"><table class="lp-tabla lp-venc"><thead><tr><th>N°</th><th>ASOCIACIÓN</th><th>ODC</th><th>CONTRATACIÓN</th><th>ENTIDAD</th><th>PROVINCIA</th><th>PUESTOS</th><th>AUXILIARES</th><th>FECHA ACTIVACIÓN</th><th>FECHA DESACTIVACIÓN</th><th>DÍAS PARA CULMINAR</th></tr></thead><tbody>
        ${lista.map((p, i) => { const d = diasInfo(p); return `<tr onclick="abrirProyectoLimpieza('${p.id}')"><td>${i + 1}</td><td class="lp-izq">${vinetaAsoc(p.association_id, p.association)}</td><td>${esc(p.contract_code || '—')}</td><td>${esc(p.contract_type || '—')}</td><td class="lp-izq">${esc(p.name)}</td><td>${esc(p.province || '—')}</td><td>${puestosDe(p).length}</td><td>${auxiliares(p)}</td><td>${fecha(p.start_date)}</td><td>${fecha(p.end_date)}</td><td class="lp-celda-dias ${d.c}">${esc(d.t)}</td></tr>`; }).join('')
          || `<tr><td colspan="11" class="lp-vacio">NINGÚN PROYECTO DE LIMPIEZA VENCE EN ESTE PERIODO.</td></tr>`}
      </tbody></table></div>`;
  }
  const TONOS = { vencido: ['FFFFFF', 'D32F2F'], urgente: ['C62828', 'F4CCCC'], pronto: ['B45309', 'FCE5CD'], proximo: ['7F6000', 'FFF2CC'], gris: ['475569', 'E2E8F0'] };
  window.exportarVencimientosLimpieza = async function (formato) {
    const lista = listaVencimientos();
    const hoy = fecha(lp.w.today);
    const periodo = lp.horizonte ? `VENCIDOS Y PRÓXIMOS ${lp.horizonte} DÍAS` : 'TODOS LOS PROYECTOS ACTIVOS';
    const asoc = lp.asociaciones.length ? lp.asociaciones.map((id) => asociacion(id)?.name).join(', ') : 'TODAS LAS ASOCIACIONES';
    const columnas = ['N°', 'ASOCIACIÓN', 'ODC', 'CONTRATACIÓN', 'ENTIDAD', 'PROVINCIA', 'PUESTOS', 'AUXILIARES', 'FECHA ACTIVACIÓN', 'FECHA DESACTIVACIÓN', 'DÍAS PARA CULMINAR'];
    const filas = lista.map((p, i) => [i + 1, p.association, p.contract_code || '—', p.contract_type || '—', p.name, p.province || '—', puestosDe(p).length, auxiliares(p), fecha(p.start_date), fecha(p.end_date), diasInfo(p)]);
    const archivo = `VENCIMIENTOS_LIMPIEZA_${String(lp.w.today).slice(0, 10)}`;
    try {
      if (formato === 'excel') {
        const X = XLSX, ws = {}, linea = { style: 'thin', color: { rgb: 'B0BEC5' } }, bordes = { top: linea, bottom: linea, left: linea, right: linea };
        const poner = (f, c, v, s) => { ws[X.utils.encode_cell({ r: f, c })] = { t: typeof v === 'number' ? 'n' : 's', v: v ?? '', s }; };
        poner(0, 0, 'GRUPO COLOMA AVILÉS — PROYECTOS DE LIMPIEZA POR CULMINAR', { font: { name: 'Calibri', sz: 15, bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } }, alignment: { horizontal: 'center', vertical: 'center' } });
        for (let c = 1; c < columnas.length; c++) poner(0, c, '', { fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } } });
        poner(1, 0, `CORTE AL ${hoy} · ${periodo} · ${asoc}`, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '37474F' } }, alignment: { horizontal: 'center' } });
        columnas.forEach((t, c) => poner(3, c, t, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '37474F' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: bordes }));
        filas.forEach((f, i) => f.forEach((v, c) => {
          const dias = c === f.length - 1;
          const s = { font: { name: 'Calibri', sz: 10, bold: dias, color: { rgb: dias ? TONOS[v.c][0] : '1F2937' } }, alignment: { horizontal: c === 4 ? 'left' : 'center', vertical: 'center' }, border: bordes };
          if (dias) s.fill = { patternType: 'solid', fgColor: { rgb: TONOS[v.c][1] } }; else if (i % 2 === 0) s.fill = { patternType: 'solid', fgColor: { rgb: 'ECEFF1' } };
          poner(4 + i, c, dias ? v.t : v, s);
        }));
        const fin = 4 + Math.max(filas.length, 1);
        if (!filas.length) poner(4, 0, 'NINGÚN PROYECTO VENCE EN ESTE PERIODO.', { font: { italic: true }, alignment: { horizontal: 'center' } });
        ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: fin, c: columnas.length - 1 } });
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columnas.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: columnas.length - 1 } }];
        ws['!cols'] = [5, 16, 20, 18, 36, 16, 10, 12, 15, 16, 16].map((wch) => ({ wch }));
        ws['!rows'] = [{ hpt: 30 }, { hpt: 18 }, null, { hpt: 30 }];
        const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'VENCIMIENTOS'); X.writeFile(wb, archivo + '.xlsx');
        return;
      }
      if (typeof html2canvas !== 'function') throw new Error('NO SE ENCONTRÓ EL GENERADOR DE IMÁGENES.');
      const hoja = document.createElement('div');
      hoja.className = 'rg-hoja lp-hoja-limpieza';
      hoja.innerHTML = `<div class="rg-cabecera"><img src="${LOGO_GRUPO}" alt=""><div><b>GRUPO COLOMA AVILÉS · SERVICIO DE LIMPIEZA</b><h1>PROYECTOS POR CULMINAR</h1><p>${esc(`CORTE AL ${hoy} · ${periodo} · ${asoc}`)}</p></div></div>
        <table class="rg-tabla"><thead><tr>${columnas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
        ${filas.map((f, n) => `<tr>${f.map((v, i) => (i === f.length - 1 ? `<td class="rg-dias" style="color:#${TONOS[v.c][0]};background:#${TONOS[v.c][1]}">${esc(v.t)}</td>`
          : i === 1 ? `<td>${(() => { const l = logoAsoc(asociacion(lista[n].association_id)); return l ? `<img class="lp-hoja-logo" src="${esc(l)}" alt=""><br>` : ''; })()}${esc(v)}</td>` : `<td class="${i === 4 ? 'rg-izq' : ''}">${esc(v)}</td>`)).join('')}</tr>`).join('') || `<tr><td colspan="${columnas.length}" class="rg-vacio">NINGÚN PROYECTO VENCE EN ESTE PERIODO.</td></tr>`}
        </tbody></table>`;
      document.body.appendChild(hoja);
      try {
        await Promise.all([...hoja.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));
        const canvas = await html2canvas(hoja, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
        const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
        try { if (navigator.clipboard && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); } catch (_) {}
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = archivo + '.png'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } finally { hoja.remove(); }
    } catch (e) { alert(`NO SE PUDO GENERAR: ${e.message || e}`); }
  };
})();
