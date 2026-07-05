// ================================================================
// data.js — Carga de datos desde API + datos locales de respaldo
// ================================================================

async function cargarDatos() {
    mostrarCargando(true);
    let cargadoDesdeAPI = false;

    if (APPS_SCRIPT_URL !== "PEGA_AQUI_TU_URL") {
        try {
            const res  = await fetch(APPS_SCRIPT_URL, { redirect: 'follow' });
            const json = await res.json();
            procesarDatosAPI(json);
            cargadoDesdeAPI = true;
            console.log("✅ Datos cargados desde Google Sheets");
        } catch (e) {
            console.warn("⚠️ Usando datos locales:", e.message);
        }
    }

    if (!cargadoDesdeAPI) {
        data              = DATOS_LOCALES_data;
        detalleProvincias = DATOS_LOCALES_detalle;
        armamento         = { rastrillo: 289, perdida: 1, confiscada: 1, global: 414, enCampo: 0, enTransito: 0 };
        puestosData       = PUESTOS_LOCALES;
    }

    mostrarCargando(false);
    init();
    // Activar chips "Todos" por defecto
    document.querySelectorAll('.chip[data-val="todos"]').forEach(c => c.classList.add('active-blue'));
}

function mostrarCargando(activo) {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = activo ? 'flex' : 'none';
}

// Procesa JSON de la API → llena data, detalleProvincias, armamento y puestosData
function procesarDatosAPI(json) {
    data              = {};
    detalleProvincias = {};
    puestosData       = {};

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

    // ── Asistencia: quién está de turno HOY por puesto ──
    if (json.__asistencia__) {
        asistenciaHoy = json.__asistencia__;
        delete json.__asistencia__;
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
            proyectos: Number(p.proyectos) || 0
        };
        const ti = p.tramiteInfo || {};
        detalleProvincias[nombre] = {
            tramite:        ti.tramite        || null,
            vigenciaInicio: ti.vigenciaInicio || null,
            vigenciaFin:    ti.vigenciaFin    || null,
            estadoTramite:  ti.estadoTramite  || null,
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
