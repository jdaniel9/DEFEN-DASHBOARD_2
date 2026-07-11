// ================================================================
// config.js — Configuración global, estado de la aplicación
// ================================================================

// ► CONFIGURACIÓN — pega aquí tu URL de Apps Script
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzsQ-GMfOMFIq9T13cjrFY7nCtEa-YGVA1R6-aF2rgKkTOWo-TnP9mMGZlivjJKGS8/exec";

// Rutas de imágenes (archivos locales en /img/)
const IMG_MAPA  = 'img/mapa.png';
const IMG_FONDO = 'img/fondo.png';
const IMG_LOGO  = 'img/logo.png';

// ── Estado global de la aplicación ──────────────────────────────
let data              = {};
let detalleProvincias = {};
let armamento         = { global:414, enCampo:0, enTransito:0, rastrillo:0, perdida:1, confiscada:1 };
let armamentoDetalle  = [];
let radiosDetalle     = [];
let asistenciaHoy     = {};
let novedadesPersonal = { ingresos: [], salidas: [], faltas: [] };
let llamadosAtencion  = [];
let puestosData       = {};

// ── Estado del panel de filtros globales (arrays = multi-selección) ──
// Array vacío = sin restricción en ese grupo ("todos")
const filtrosActivos = {
    jornada:  [],
    arma:     [],
    radio:    [],
    vence:    [],
    contrato: [],
    cat:      []
};

// ── Estado del mapa de provincia (Leaflet) ───────────────────────
let provMap         = null;
let marcadoresMapa  = [];
let proyectoActivo  = null;
let puestoActivo    = null;
let mostrandoTodos  = false;
let provinciaActual = null;
let puestosActuales = [];
let filtroActivo    = 'todos';

// Datos locales de respaldo para puestos (con coordenadas reales de Pichincha)
const PUESTOS_LOCALES = {
    "PICHINCHA": {
        "MINISTERIO TRABAJO": [
            {
                nombre:     "Edificio Géminis",
                lat:        -0.21182498265414754,
                lng:        -78.5000201921123,
                tipo:       "8 Horas",
                guardia:    "Juan Celi",
                armado:     true,
                arma:       "Arma Letal · Serie: XXXX XXXX",
                radio:      true,
                radio_info: "1 TH510 · Serie: XXX XXX",
                turno:      "Diurno",
                dias:       "Lunes / Viernes",
                obs:        "",
                enTurnoHoy: null, tipoTurnoHoy: null, rotacionCompleta: null
            },
            {
                nombre:     "Edificio Torre Azul",
                lat:        -0.18489594537669302,
                lng:        -78.48118202942977,
                tipo:       "8 Horas",
                guardia:    "Julianna Márquez",
                armado:     false,
                arma:       null,
                radio:      true,
                radio_info: "1 TH510 · Serie: XXX XXX",
                turno:      "Diurno",
                dias:       "Lunes / Viernes",
                obs:        "",
                enTurnoHoy: null, tipoTurnoHoy: null, rotacionCompleta: null
            }
        ]
    }
};
