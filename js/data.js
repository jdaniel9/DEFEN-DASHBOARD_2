// ================================================================
// data.js — Carga de datos desde API + datos locales de respaldo
// ================================================================

const API_TIMEOUT_MS = 60000;
const API_AVISO_DEMORA_MS = 15000;
const CACHE_DATOS_PREFIJO = 'defen_dashboard_datos_v1_';
let cargaDatosEnCurso = null;
let cargaImagenesEnCurso = null;

async function cargarDatos(opciones={}) {
    if (cargaDatosEnCurso) return cargaDatosEnCurso;
    cargaDatosEnCurso = ejecutarCargaDatos(opciones);
    try { return await cargaDatosEnCurso; }
    finally { cargaDatosEnCurso = null; }
}

function aplicarDatosDashboard(json, origen) {
    validarRespuestaDatos(json);
    if(json.__meta__?.duracionServidorMs!==undefined)console.info(`Servidor: ${json.__meta__.duracionServidorMs} ms · origen: ${origen}`);
    procesarDatosAPI(json);
    init();
    document.querySelectorAll('.chip[data-val="todos"]').forEach(c => c.classList.add('active-blue'));
    console.log(`Datos cargados desde ${origen}`);
    programarCargaImagenesArmamento();
}

async function ejecutarCargaDatos(opciones={}) {
    const cacheInicial = opciones.usarCachePrimero ? leerCacheDatos() : null;
    if (cacheInicial) {
        try {
            aplicarDatosDashboard(cacheInicial, 'la copia rápida de sesión');
            mostrarCargando(false);
            setTimeout(refrescarDatosSilenciosamente, 0);
            return;
        } catch (_) { sessionStorage.removeItem(claveCacheDatos()); }
    }
    mostrarCargando(true);
    try {
        const json = await solicitarDatosAPI();
        aplicarDatosDashboard(json, 'Google Sheets');
        guardarCacheDatos(json);
    } catch (error) {
        console.error('No se pudieron cargar los datos:', error);
        if (error.codigo === 'SESION_INVALIDA') {
            limpiarSesionVencida();
            return;
        }
        const cache = leerCacheDatos();
        if (cache) {
            try {
                aplicarDatosDashboard(cache, 'la última copia válida');
                console.warn('Se muestran los últimos datos válidos guardados en esta sesión.');
                return;
            } catch (_) { sessionStorage.removeItem(claveCacheDatos()); }
        }
        mostrarErrorCarga(error.message || 'No se pudieron cargar los datos.');
    } finally {
        mostrarCargando(false);
    }
}

async function refrescarDatosSilenciosamente() {
    try {
        const json=await solicitarDatosAPI();validarRespuestaDatos(json);guardarCacheDatos(json);procesarDatosAPI(json);init();programarCargaImagenesArmamento();
        console.log('Datos actualizados silenciosamente desde Google Sheets');
    } catch (error) {
        if(error.codigo==='SESION_INVALIDA')limpiarSesionVencida();
        else console.warn('La actualización en segundo plano no estuvo disponible:',error.message);
    }
}

async function solicitarDatosAPI() {
    if (!tokenSesionActual()) {
        const error = new Error('Tu sesión no es válida. Ingresa nuevamente.');
        error.codigo = 'SESION_INVALIDA';
        throw error;
    }
    const avisoDemora = setTimeout(() => {
        const texto = document.querySelector('#loading-overlay p');
        if (texto) texto.textContent = 'La información sigue cargando; puede tardar hasta un minuto…';
    }, API_AVISO_DEMORA_MS);
    try {
        let ultimoError=null;
        for(let intento=1;intento<=2;intento++){
            const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),API_TIMEOUT_MS),url=new URL(APPS_SCRIPT_URL);
            url.searchParams.set('accion','datos');url.searchParams.set('token',tokenSesionActual());url.searchParams.set('_t',Date.now()+'_'+intento);
            try{
                const res=await fetch(url.toString(),{method:'GET',redirect:'follow',cache:'no-store',signal:controller.signal});
                if(!res.ok)throw new Error(`El servidor respondió HTTP ${res.status}.`);
                const texto=await res.text();try{return JSON.parse(texto);}catch(_){throw new Error('El servidor devolvió una respuesta que no es JSON.');}
            }catch(e){ultimoError=e;if(intento<2&&e.name!=='AbortError')await new Promise(r=>setTimeout(r,800));}
            finally{clearTimeout(timeout);}
        }
        if(ultimoError?.name==='AbortError')throw new Error('La carga tardó demasiado. Intenta nuevamente.');
        throw ultimoError||new Error('No se pudo consultar el servidor.');
    } finally {
        clearTimeout(avisoDemora);
    }
}

function programarCargaImagenesArmamento(){
    if(cargaImagenesEnCurso||!usuarioPuedeVerArmamentoDetalle()||!armamentoDetalle.length)return;
    const pendientes=armamentoDetalle.filter(a=>a.serie&&(!a.urlCredencial||!a.urlImagenArma)).map(a=>a.serie);if(!pendientes.length)return;
    cargaImagenesEnCurso=(async()=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),75000);try{const url=new URL(APPS_SCRIPT_URL);url.searchParams.set('_t',Date.now());const res=await fetch(url.toString(),{method:'POST',body:JSON.stringify({accion:'cargar_imagenes_armamento',token:tokenSesionActual(),series:pendientes}),redirect:'follow',cache:'no-store',signal:controller.signal});if(!res.ok)throw new Error('HTTP '+res.status);const json=await res.json();if(!json.ok)throw new Error(json.mensaje||'Índice no disponible');armamentoDetalle.forEach(a=>{const img=json.imagenes?.[a.serie];if(img){a.urlCredencial=a.urlCredencial||img.urlCredencial||'';a.urlImagenArma=a.urlImagenArma||img.urlImagenArma||'';}});console.log('Evidencias de armamento preparadas en segundo plano.');}catch(e){console.warn('Las imágenes se cargarán en un próximo intento:',e.message);}finally{clearTimeout(timeout);cargaImagenesEnCurso=null;}})();
}

function validarRespuestaDatos(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('El servidor devolvió una respuesta inválida.');
    if (json.ok === false) {
        const error = new Error(json.mensaje || 'El servidor rechazó la consulta.');
        error.codigo = json.codigo || '';
        throw error;
    }
    if (!json.__meta__ || json.__meta__.tipo !== 'dashboard') throw new Error('La respuesta del servidor está incompleta. No se modificaron los datos mostrados.');
    if (Object.keys(json).filter(k => !k.startsWith('__')).length === 0) throw new Error('La respuesta no contiene provincias. No se modificaron los datos mostrados.');
}

function claveCacheDatos() {
    const usuario = sessionStorage.getItem('defen_auth_usuario') || 'anonimo';
    const rol = sessionStorage.getItem(AUTH_ROL_KEY) || 'sin_rol';
    return `${CACHE_DATOS_PREFIJO}${usuario}_${rol}`;
}
function guardarCacheDatos(json) { try { sessionStorage.setItem(claveCacheDatos(), JSON.stringify(json)); } catch (e) { console.warn('No fue posible guardar la copia temporal de datos:', e.message); } }
function leerCacheDatos() { try { const raw = sessionStorage.getItem(claveCacheDatos()); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
function limpiarSesionVencida() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    mostrarErrorCarga('Tu sesión venció. Ingresa nuevamente para consultar el dashboard.');
    if (typeof mostrarLogin === 'function') mostrarLogin();
}
function mostrarErrorCarga(mensaje) {
    const panel = document.getElementById('detail-panel');
    if (panel) panel.innerHTML = `<div style="padding:18px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-weight:700;font-size:12px;">${mensaje}<button onclick="cargarDatos()" style="margin-left:10px;padding:6px 10px;border:0;border-radius:7px;background:#ea580c;color:white;font-weight:800;cursor:pointer;">Reintentar</button></div>`;
}

function mostrarCargando(activo) {
    const el = document.getElementById('loading-overlay');
    if (!el) return;
    el.style.display = activo ? 'flex' : 'none';
    const texto = el.querySelector('p');
    if (texto && !activo) texto.textContent = 'Cargando datos desde Google Sheets…';
}

// Procesa JSON de la API → llena data, detalleProvincias, armamento y puestosData
function procesarDatosAPI(json) {
    // No mutar la respuesta original: se conserva para recuperación temporal.
    json = { ...json };
    data              = {};
    detalleProvincias = {};
    puestosData       = {};
    personalActas     = [];
    supervisoresActas = [];
    armamentoDetalle  = [];
    radiosDetalle     = [];
    cedulasPorPuesto  = {};
    asistenciaHoy     = {};
    novedadesPersonal = { ingresos: [], salidas: [], faltas: [] };
    llamadosAtencion  = [];
    historicoProyectos = [];
    delete json.__meta__;

    // ── Armamento ──
    if (json.__armamento__) {
        const a = json.__armamento__;
        armamento = {
            global:     Number(a.global)     || 0,
            enCampo:    Number(a.enCampo)    || 0,
            enTransito: Number(a.enTransito) || 0,
            rastrillo:  Number(a.rastrillo)  || 0,
            perdida:    Number(a.perdida)     || 0,
            confiscada: Number(a.confiscada) || 0
        };
        delete json.__armamento__;
    }

    // ── Armamento detalle ──
    if (json.__armamento_detalle__) {
        armamentoDetalle = json.__armamento_detalle__;
        delete json.__armamento_detalle__;
    }

    // ── Radios detalle ──
    if (json.__radios_detalle__) {
        radiosDetalle = json.__radios_detalle__;
        delete json.__radios_detalle__;
    }

    // ── Cédulas por puesto (para la Nómina de Personal) ──
    if (json.__cedulas__) {
        cedulasPorPuesto = json.__cedulas__;
        delete json.__cedulas__;
    }

    // ── Personal para Actas: listado activo completo desde Asistencia ──
    if (json.__personal_actas__) {
        personalActas = Array.isArray(json.__personal_actas__) ? json.__personal_actas__ : [];
        delete json.__personal_actas__;
    }

    // ── Supervisores: fuente independiente de la hoja proyectos ──
    if (json.__supervisores__) {
        supervisoresActas = Array.isArray(json.__supervisores__) ? json.__supervisores__ : [];
        delete json.__supervisores__;
    }

    // ── Asistencia: quién está de turno HOY por puesto ──
    if (json.__asistencia__) {
        asistenciaHoy = json.__asistencia__;
        delete json.__asistencia__;
    }

    // ── Novedades de personal: ingresos, salidas, faltas ──
    if (json.__novedades__) {
        novedadesPersonal = {
            ingresos: Array.isArray(json.__novedades__.ingresos) ? json.__novedades__.ingresos : [],
            salidas:  Array.isArray(json.__novedades__.salidas)  ? json.__novedades__.salidas  : [],
            faltas:   Array.isArray(json.__novedades__.faltas)   ? json.__novedades__.faltas   : []
        };
        delete json.__novedades__;
    }

    // ── Llamados de atención ──
    if (json.__llamados__) {
        llamadosAtencion = Array.isArray(json.__llamados__) ? json.__llamados__ : [];
        delete json.__llamados__;
    }

    // ── Vacantes a nivel nacional ──
    if (json.__vacantes_nacional__ !== undefined) {
        vacantesNacional = Number(json.__vacantes_nacional__) || 0;
        delete json.__vacantes_nacional__;
    }

    // ── Proyectos históricos (archivados) ──
    if (json.__historico__) {
        historicoProyectos = Array.isArray(json.__historico__) ? json.__historico__ : [];
        delete json.__historico__;
    }

    // ── Puestos: indexar por provincia → proyecto → array ──
    if (json.__puestos__) {
        json.__puestos__.forEach(p => {
            const prov = (p.provincia || '').toUpperCase().trim();
            const proy = (p.proyecto  || '').toUpperCase().trim();
            if (!prov || !proy) return;
            if (!puestosData[prov]) puestosData[prov] = {};
            if (!puestosData[prov][proy]) puestosData[prov][proy] = [];

            const nombrePuesto = p.nombre_puesto || p.nombre || '';
            // Buscar info de asistencia para este puesto (por nombre, case-insensitive)
            const asistInfo = asistenciaHoy[nombrePuesto.toUpperCase().trim()] || null;

            puestosData[prov][proy].push({
                nombre:     nombrePuesto,
                lat:        Number(p.lat)   || 0,
                lng:        Number(p.lng)   || 0,
                tipo:       p.tipo          || '',
                guardia:    p.guardia       || '',
                armado:     (p.armado || '').toLowerCase() === 'si' || p.armado === true,
                arma:       p.arma          || null,
                tieneLetal:   p.tieneLetal   === true,
                tieneNoLetal: p.tieneNoLetal === true,
                radio:      (p.radio  || '').toLowerCase() === 'si' || p.radio  === true,
                radio_info: p.radio_info    || '',
                turno:      p.turno         || '',
                dias:       p.dias          || '',
                obs:        p.observacion   || p.obs || '',
                // ── Datos en tiempo real desde asistencia ──
                enTurnoHoy:  asistInfo ? asistInfo.enTurno   : null,
                tipoTurnoHoy: asistInfo ? asistInfo.turnoTipo : null,
                rotacionCompleta: asistInfo ? asistInfo.rotacion : null
            });
        });
        delete json.__puestos__;
    }

    // ── Provincias ──
    Object.keys(json).forEach(nombre => {
        const p = json[nombre];
        data[nombre] = {
            x:         Number(p.x)         || 0,
            y:         Number(p.y)         || 0,
            tipo:      p.tipo      || '',
            estado:    p.estado    || '',
            cat:       p.cat       || 'none',
            guardias:  Number(p.guardias)  || 0,
            armas:     Number(p.armas)     || 0,
            puestos:   Number(p.puestos)   || 0,
            proyectos: Number(p.proyectos) || 0,
            rastrilloSede: Number(p.rastrilloSede) || 0
        };
        const ti = p.tramiteInfo || {};
        detalleProvincias[nombre] = {
            tramite:        ti.tramite        || null,
            vigenciaInicio: ti.vigenciaInicio || null,
            vigenciaFin:    ti.vigenciaFin    || null,
            estadoTramite:  ti.estadoTramite  || null,
            urlCertificado: ti.urlCertificado || null,
            urlPermisoOperaciones: p.urlPermisoOperaciones || null,
            urlTenenciaArmas:      p.urlTenenciaArmas      || null,
            urlPermisoUniforme:    p.urlPermisoUniforme    || null,
            supervisores:   Array.isArray(p.supervisores)  ? p.supervisores  : [],
            proyectosList:  Array.isArray(p.proyectosList) ? p.proyectosList : []
        };
    });
}

// =====================================================================
// DATOS LOCALES DE RESPALDO
// =====================================================================
const DATOS_LOCALES_data = {
    // ACTIVAS CON PROYECTOS
    "AZUAY":          { x:47, y:67, tipo:"AGENCIA",  estado:"EN TRÁMITE",               proyectos:1,  puestos:4,   armas:0,  guardias:5,   cat:'active' },
    "EL ORO":         { x:36, y:73, tipo:"AGENCIA",  estado:"VIGENTE",                   proyectos:2,  puestos:5,   armas:3,  guardias:12,  cat:'active' },
    "ESMERALDAS":     { x:41, y:17, tipo:"AGENCIA",  estado:"EN TRÁMITE",               proyectos:1,  puestos:10,  armas:0,  guardias:27,  cat:'active' },
    "GUAYAS":         { x:35, y:56, tipo:"MATRIZ",   estado:"VIGENTE",                   proyectos:6,  puestos:88,  armas:73, guardias:200, cat:'active' },
    "IMBABURA":       { x:58, y:18, tipo:"AGENCIA",  estado:"VIGENTE",                   proyectos:1,  puestos:1,   armas:0,  guardias:3,   cat:'active' },
    "LOJA":           { x:39, y:84, tipo:"AGENCIA",  estado:"VIGENTE",                   proyectos:1,  puestos:1,   armas:0,  guardias:3,   cat:'active' },
    "LOS RIOS":       { x:40, y:49, tipo:"AGENCIA",  estado:"EN TRÁMITE",               proyectos:3,  puestos:10,  armas:0,  guardias:13,  cat:'active' },
    "MANABI":         { x:28, y:36, tipo:"SUCURSAL", estado:"VIGENTE",                   proyectos:4,  puestos:46,  armas:9,  guardias:102, cat:'active' },
    "PICHINCHA":      { x:53, y:28, tipo:"SUCURSAL", estado:"EN TRÁMITE",               proyectos:6,  puestos:58,  armas:34, guardias:153, cat:'active' },
    "SANTO DOMINGO":  { x:46, y:32, tipo:"AGENCIA",  estado:"VIGENTE",                   proyectos:1,  puestos:11,  armas:1,  guardias:21,  cat:'active' },
    "TUNGURAHUA":     { x:55, y:44, tipo:"AGENCIA",  estado:"VIGENTE",                   proyectos:1,  puestos:4,   armas:4,  guardias:5,   cat:'active' },

    // SIN PROYECTOS (con trámite registrado)
    "BOLIVAR":          { x:44, y:53, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "CAÑAR":            { x:46, y:62, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "CARCHI":           { x:61, y:12, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "CHIMBORAZO":       { x:52, y:54, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "COTOPAXI":         { x:51, y:38, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "GALAPAGOS":        { x:7,  y:15, tipo:"N/A",     estado:"SIN REGISTRO",  proyectos:0, puestos:0, armas:0, guardias:0, cat:'none' },
    "MORONA SANTIAGO":  { x:60, y:65, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "NAPO":             { x:65, y:37, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "ORELLANA":         { x:78, y:35, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "PASTAZA":          { x:72, y:51, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "SANTA ELENA":      { x:19, y:58, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "SUCUMBIOS":        { x:83, y:17, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' },
    "ZAMORA CHINCHIPE": { x:48, y:88, tipo:"AGENCIA", estado:"SIN PROYECTOS", proyectos:0, puestos:0, armas:0, guardias:0, cat:'agency_only' }
};

const DATOS_LOCALES_detalle = {
    // ── PROVINCIAS CON PROYECTOS ACTIVOS ──────────────────────────────
    "AZUAY": {
        tramite:        "SOL-0002153858",
        vigenciaInicio: null,
        vigenciaFin:    null,
        estadoTramite:  "EN TRÁMITE — Registro de Inspección",
        supervisores:   ["Freddy Carrera"],
        proyectosList: [
            { nombre: "COORDINACIÓN ZONAL 6", guardias: 5, armas: 0, puestos: 4, fin: "2026-09-30", supervisores: ["Freddy Carrera"] }
        ]
    },
    "EL ORO": {
        tramite:        "TRA-0002119371",
        vigenciaInicio: "2026-03-05",
        vigenciaFin:    "2028-03-05",
        supervisores:   ["Raúl Illesca"],
        proyectosList: [
            { nombre: "MSP SANTA ROSA",  guardias: 9, armas: 2, puestos: 3, fin: "2026-06-30", supervisores: ["Raúl Illesca"] },
            { nombre: "MERCADO MACHALA", guardias: 3, armas: 1, puestos: 2, fin: "2026-12-13", supervisores: ["Raúl Illesca"] }
        ]
    },
    "ESMERALDAS": {
        tramite:        "SOL-0002181487",
        vigenciaInicio: null,
        vigenciaFin:    null,
        estadoTramite:  "EN TRÁMITE — Registro de Inspección",
        supervisores:   ["Johan Cuasaluzan"],
        proyectosList: [
            { nombre: "ESMERALDAS MIT", guardias: 27, armas: 0, puestos: 10, fin: "2027-01-16", supervisores: ["Johan Cuasaluzan"] }
        ]
    },
    "GUAYAS": {
        tramite:        "TRA-MATRIZ-GUAYAS",
        vigenciaInicio: "2025-04-11",
        vigenciaFin:    "2027-04-10",
        supervisores:   ["Johanna Hernández", "Jorge Moya", "Gerardo Crispín", "Wilmer Flores"],
        proyectosList: [
            { nombre: "CNEL EP GUAYAQUIL/PLAYAS", guardias: 128, armas: 38, puestos: 58, fin: "2026-06-13", supervisores: ["Johanna Hernández", "Jorge Moya", "Gerardo Crispín"] },
            { nombre: "IESS GUAYAS",              guardias: 59,  armas: 23, puestos: 24, fin: "2026-11-30", supervisores: ["Wilmer Flores"] },
            { nombre: "MILAGRO EDU",              guardias: 2,   armas: 1,  puestos: 1,  fin: "2026-10-31" },
            { nombre: "PEDRO CARBO EDU",          guardias: 3,   armas: 1,  puestos: 1,  fin: "2026-12-31" },
            { nombre: "MSP SALITRE",              guardias: 6,   armas: 0,  puestos: 2,  fin: "2026-07-04" },
            { nombre: "PREFECTURA VIP",           guardias: 2,   armas: 3,  puestos: 2,  fin: "2027-03-10" }
        ]
    },
    "IMBABURA": {
        tramite:        "TRA-0001703808",
        vigenciaInicio: "2024-11-13",
        vigenciaFin:    "2026-11-13",
        supervisores:   [],
        proyectosList: [
            { nombre: "COORDINACIÓN ZONAL 1", guardias: 3, armas: 0, puestos: 1, fin: "2026-12-10" }
        ]
    },
    "LOJA": {
        tramite:        "TRA-0001690676",
        vigenciaInicio: "2024-11-05",
        vigenciaFin:    "2026-11-05",
        supervisores:   [],
        proyectosList: [
            { nombre: "CELICA EDU", guardias: 3, armas: 0, puestos: 1, fin: "2026-12-31" }
        ]
    },
    "LOS RIOS": {
        tramite:        "SOL-0002184059",
        vigenciaInicio: null,
        vigenciaFin:    null,
        estadoTramite:  "EN TRÁMITE — Registro de Inspección",
        supervisores:   ["Wilson Ramírez"],
        proyectosList: [
            { nombre: "MSP BABAHOYO 12H", guardias: 3, armas: 0, puestos: 2, fin: "2026-06-30", supervisores: ["Wilson Ramírez"] },
            { nombre: "MSP BABAHOYO 8H",  guardias: 7, armas: 0, puestos: 7, fin: "2026-06-30", supervisores: ["Wilson Ramírez"] },
            { nombre: "VINCES EDU",        guardias: 3, armas: 0, puestos: 1, fin: "2026-08-31" }
        ]
    },
    "MANABI": {
        tramite:        "SOL-0002177824",
        vigenciaInicio: "2026-04-14",
        vigenciaFin:    "2028-04-14",
        supervisores:   ["Luis Zambrano", "Edisson Moreira"],
        proyectosList: [
            { nombre: "APM",             guardias: 42, armas: 8, puestos: 14, fin: "2026-12-19", supervisores: ["Luis Zambrano"] },
            { nombre: "PATIO 300",       guardias: 3,  armas: 0, puestos: 1,  fin: "2027-01-09", supervisores: ["Luis Zambrano"] },
            { nombre: "HOSP PORTOVIEJO", guardias: 7,  armas: 1, puestos: 6,  fin: "2027-01-28", supervisores: ["Luis Zambrano"] },
            { nombre: "EL CARMEN EDU",   guardias: 50, armas: 0, puestos: 25, fin: "2026-07-12", supervisores: ["Edisson Moreira"] }
        ]
    },
    "PICHINCHA": {
        tramite:        "SOL-0002189038",
        vigenciaInicio: null,
        vigenciaFin:    null,
        estadoTramite:  "EN TRÁMITE — Registro de Inspección",
        supervisores:   ["Milton Márquez", "Lenin Cerón", "Daniel Balero"],
        proyectosList: [
            { nombre: "MINISTERIO TRABAJO",              guardias: 2,  armas: 1,  puestos: 2,  fin: "2026-07-28", supervisores: ["Milton Márquez"] },
            { nombre: "TUMBACO TABABELA",                guardias: 3,  armas: 1,  puestos: 1,  fin: "2026-12-31", supervisores: ["Milton Márquez"] },
            { nombre: "MINISTERIO SALUD PÚBLICA MATRIZ", guardias: 15, armas: 5,  puestos: 5,  fin: "2026-12-09", supervisores: ["Milton Márquez"] },
            { nombre: "DISTRITAL 17D03",                 guardias: 84, armas: 5,  puestos: 28, fin: "2026-06-03", supervisores: ["Lenin Cerón"] },
            { nombre: "MINISTERIO DE GOBIERNO",          guardias: 4,  armas: 4,  puestos: 4,  fin: "2027-01-06", supervisores: ["Milton Márquez"] },
            { nombre: "MERCADO MAYORISTA QUITO",         guardias: 45, armas: 18, puestos: 18, fin: "2027-04-06", supervisores: ["Daniel Balero"] }
        ]
    },
    "SANTO DOMINGO": {
        tramite:        "TRA-0002166502",
        vigenciaInicio: "2026-04-07",
        vigenciaFin:    "2028-04-07",
        supervisores:   ["Juan Marcillo"],
        proyectosList: [
            { nombre: "IESS STD", guardias: 21, armas: 1, puestos: 11, fin: "2026-11-06", supervisores: ["Juan Marcillo"] }
        ]
    },
    "TUNGURAHUA": {
        tramite:        "TRA-0001704124",
        vigenciaInicio: "2024-11-26",
        vigenciaFin:    "2026-11-26",
        supervisores:   ["Wilson Chávez"],
        proyectosList: [
            { nombre: "PARROQUIAS URBANAS", guardias: 5, armas: 4, puestos: 4, fin: "2026-06-05", supervisores: ["Wilson Chávez"] }
        ]
    },

    // ── PROVINCIAS SIN PROYECTOS (solo trámite) ───────────────────────
    "BOLIVAR": {
        tramite:        "TRA-0001318517",
        vigenciaInicio: "2023-08-04",
        vigenciaFin:    "2025-08-04",
        supervisores:   [],
        proyectosList:  []
    },
    "CAÑAR": {
        tramite:        "TRA-0001962141",
        vigenciaInicio: "2025-06-01",
        vigenciaFin:    "2027-09-01",
        supervisores:   [],
        proyectosList:  []
    },
    "CARCHI": {
        tramite:        "TRA-0001691256",
        vigenciaInicio: "2024-10-24",
        vigenciaFin:    "2026-10-24",
        supervisores:   [],
        proyectosList:  []
    },
    "CHIMBORAZO": {
        tramite:        "TRA-0001336444",
        vigenciaInicio: "2023-08-14",
        vigenciaFin:    "2025-08-14",
        supervisores:   [],
        proyectosList:  []
    },
    "COTOPAXI": {
        tramite:        "TRA-0001694291",
        vigenciaInicio: "2024-12-26",
        vigenciaFin:    "2026-12-26",
        supervisores:   [],
        proyectosList:  []
    },
    "GALAPAGOS": {
        tramite:        null,
        vigenciaInicio: null,
        vigenciaFin:    null,
        estadoTramite:  "Sin registro de trámite",
        supervisores:   [],
        proyectosList:  []
    },
    "MORONA SANTIAGO": {
        tramite:        "TRA-0001704006",
        vigenciaInicio: "2024-11-26",
        vigenciaFin:    "2026-11-26",
        supervisores:   [],
        proyectosList:  []
    },
    "NAPO": {
        tramite:        "TRA-0001704249",
        vigenciaInicio: "2024-11-26",
        vigenciaFin:    "2026-11-26",
        supervisores:   [],
        proyectosList:  []
    },
    "ORELLANA": {
        tramite:        "TRA-0001319401",
        vigenciaInicio: "2023-07-18",
        vigenciaFin:    "2025-07-18",
        supervisores:   [],
        proyectosList:  []
    },
    "PASTAZA": {
        tramite:        "TRA-0001309245",
        vigenciaInicio: "2023-11-09",
        vigenciaFin:    "2025-11-09",
        supervisores:   [],
        proyectosList:  []
    },
    "SANTA ELENA": {
        tramite:        "TRA-0001704259",
        vigenciaInicio: "2024-12-18",
        vigenciaFin:    "2026-12-18",
        supervisores:   [],
        proyectosList:  []
    },
    "SUCUMBIOS": {
        tramite:        "TRA-0001318403",
        vigenciaInicio: "2023-07-18",
        vigenciaFin:    "2025-07-18",
        supervisores:   [],
        proyectosList:  []
    },
    "ZAMORA CHINCHIPE": {
        tramite:        "TRA-0001704054",
        vigenciaInicio: "2024-11-26",
        vigenciaFin:    "2026-11-26",
        supervisores:   [],
        proyectosList:  []
    }
};
