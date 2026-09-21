// ================================================================
// config.js — Configuración global, estado de la aplicación
// ================================================================

// ► BACKEND ACTIVO
// Cambia temporalmente a "apps_script" para volver al backend anterior.
const BACKEND_PROVIDER = 'supabase';
const SUPABASE_READ_ONLY_PHASE = true;
const SUPABASE_WEAPON_REGULARIZATION_ENABLED = true;
const SUPABASE_WEAPON_DISPATCH_ENABLED = true;
const SUPABASE_WEAPON_GUIDE_REMEDIATION_ENABLED = true;
const SUPABASE_WEAPON_RETURN_ENABLED = true;
const SUPABASE_WEAPON_EVIDENCE_ENABLED = true;
const SUPABASE_WEAPON_INCIDENT_ENABLED = true;
const SUPABASE_WEAPON_MAINTENANCE_ENABLED = true;
const SUPABASE_WEAPON_HISTORY_ENABLED = true;
const SUPABASE_RADIO_MANAGEMENT_ENABLED = true;
const SUPABASE_PROJECT_ARCHIVE_ENABLED = true;
const SUPABASE_PERSONNEL_WARNINGS_ENABLED = true;
const SUPABASE_PROJECT_MANAGEMENT_ENABLED = true;
const SUPABASE_USER_ACCESS_MANAGEMENT_ENABLED = true;
const SUPABASE_SYSTEM_AUDIT_ENABLED = true;
const SUPABASE_SYSTEM_HEALTH_ENABLED = true;

// Configuración generada durante el despliegue desde variables de entorno.
// La clave publicable de Supabase necesariamente llega al navegador; nunca
// deben incluirse aquí service_role, contraseñas o secretos administrativos.
const DEFEN_RUNTIME_CONFIG = Object.freeze(globalThis.__DEFEN_CONFIG__ || {});
function configuracionRequerida(nombre) {
    const valor=String(DEFEN_RUNTIME_CONFIG[nombre]||'').trim();
    if(!valor) throw new Error(`CONFIGURACIÓN SEGURA INCOMPLETA: ${nombre}`);
    return valor;
}
const SUPABASE_URL = configuracionRequerida('SUPABASE_URL').replace(/\/+$/,'');
const SUPABASE_PUBLISHABLE_KEY = configuracionRequerida('SUPABASE_PUBLISHABLE_KEY');
const SUPABASE_INTERNAL_AUTH_DOMAIN = configuracionRequerida('SUPABASE_INTERNAL_AUTH_DOMAIN');
const APPS_SCRIPT_URL = String(DEFEN_RUNTIME_CONFIG.APPS_SCRIPT_URL||'').trim();
{
    const url=new URL(SUPABASE_URL);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co'))throw new Error('SUPABASE_URL NO ES VÁLIDA.');
    if(!/^[A-Za-z0-9._-]{20,300}$/.test(SUPABASE_PUBLISHABLE_KEY))throw new Error('LA CLAVE PUBLICABLE DE SUPABASE NO ES VÁLIDA.');
    if(!/^[a-z0-9.-]{3,120}$/.test(SUPABASE_INTERNAL_AUTH_DOMAIN))throw new Error('EL DOMINIO INTERNO DE AUTENTICACIÓN NO ES VÁLIDO.');
    if(APPS_SCRIPT_URL){const legacy=new URL(APPS_SCRIPT_URL);if(legacy.protocol!=='https:'||legacy.hostname!=='script.google.com')throw new Error('APPS_SCRIPT_URL NO ES VÁLIDA.');}
}

// Rutas de imágenes (archivos locales en /img/)
const IMG_MAPA  = 'img/mapa.png';
const IMG_FONDO = 'img/fondo1.png';
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
let vacantesNacional  = 0;
let historicoProyectos = [];
let cedulasPorPuesto = {};
let personalActas     = []; // personal activo de Asistencia para el generador de actas
let supervisoresActas = []; // supervisores activos desde la hoja supervisores
let contactosPersonal = {}; // teléfono y vigencia laboral por nombre/id
let puestosData       = {};
 
// ── Estado del panel de filtros globales (arrays = multi-selección) ──
// Array vacío = sin restricción en ese grupo ("todos")
const filtrosActivos = {
    jornada:   [],
    arma:      [],
    claseArma: [],
    radio:     [],
    vence:     [],
    contrato:  [],
    cat:       []
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
 
