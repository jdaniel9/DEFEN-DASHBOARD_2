// ================================================================
// supabase.js — Cliente REST, sesión y adaptador temporal del dashboard
// ================================================================

const SUPABASE_REFRESH_TOKEN_KEY = 'defen_supabase_refresh_token';
const SUPABASE_EXPIRES_AT_KEY = 'defen_supabase_expires_at';

function backendUsaSupabase() {
    return typeof BACKEND_PROVIDER !== 'undefined' && BACKEND_PROVIDER === 'supabase';
}

function supabaseHeaders(token = '', json = false) {
    const headers = { apikey: SUPABASE_PUBLISHABLE_KEY };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
}

async function supabasePeticion(ruta, opciones = {}) {
    const respuesta = await fetch(`${SUPABASE_URL}${ruta}`, opciones);
    const texto = await respuesta.text();
    let cuerpo = null;
    try { cuerpo = texto ? JSON.parse(texto) : null; } catch (_) { cuerpo = texto; }
    if (!respuesta.ok) {
        const error = new Error(cuerpo?.message || cuerpo?.msg || cuerpo?.error_description || `Supabase respondió HTTP ${respuesta.status}.`);
        error.status = respuesta.status;
        error.codigo = cuerpo?.code || '';
        throw error;
    }
    return cuerpo;
}

async function supabaseObtenerPerfil(token, userId) {
    const filas = await supabasePeticion(
        `/rest/v1/profiles?select=id,username,full_name,role_code,active&id=eq.${encodeURIComponent(userId)}`,
        { headers: supabaseHeaders(token) }
    );
    if (!Array.isArray(filas) || filas.length !== 1) throw new Error('No se encontró el perfil interno del usuario.');
    if (!filas[0].active) throw new Error('El usuario está desactivado.');
    return filas[0];
}

async function supabaseIniciarSesion(usuario, password, departamento) {
    const username = String(usuario || '').trim().toLowerCase();
    const auth = await supabasePeticion('/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: supabaseHeaders('', true),
        body: JSON.stringify({
            email: `${username}@${SUPABASE_INTERNAL_AUTH_DOMAIN}`,
            password
        })
    });

    try {
        const perfil = await supabaseObtenerPerfil(auth.access_token, auth.user.id);
        if (departamento && perfil.role_code !== departamento) {
            throw new Error('El usuario no pertenece al departamento seleccionado.');
        }
        return {
            ok: true,
            nombre: perfil.full_name,
            usuario: perfil.username,
            rol: perfil.role_code,
            token: auth.access_token,
            refreshToken: auth.refresh_token,
            expiresAt: Number(auth.expires_at || 0)
        };
    } catch (error) {
        supabaseCerrarSesionRemota(auth.access_token);
        throw error;
    }
}

async function supabaseRenovarSesion() {
    const refreshToken = sessionStorage.getItem(SUPABASE_REFRESH_TOKEN_KEY) || '';
    if (!refreshToken) throw new Error('La sesión no puede renovarse.');
    const auth = await supabasePeticion('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: supabaseHeaders('', true),
        body: JSON.stringify({ refresh_token: refreshToken })
    });
    sessionStorage.setItem('defen_auth_token', auth.access_token);
    sessionStorage.setItem(SUPABASE_REFRESH_TOKEN_KEY, auth.refresh_token || refreshToken);
    sessionStorage.setItem(SUPABASE_EXPIRES_AT_KEY, String(Number(auth.expires_at || 0)));
    return auth.access_token;
}

async function supabaseTokenVigente() {
    const token = sessionStorage.getItem('defen_auth_token') || '';
    const expiresAt = Number(sessionStorage.getItem(SUPABASE_EXPIRES_AT_KEY) || 0);
    const ahora = Math.floor(Date.now() / 1000);
    if (token && expiresAt > ahora + 60) return token;
    return supabaseRenovarSesion();
}

async function supabaseRestaurarSesion() {
    try {
        const token = await supabaseTokenVigente();
        const usuario = sessionStorage.getItem('defen_auth_usuario') || '';
        if (!token || !usuario) return false;
        return true;
    } catch (_) {
        return false;
    }
}

function supabaseCerrarSesionRemota(token) {
    if (!token) return;
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: supabaseHeaders(token)
    }).catch(() => {});
}

async function supabaseRpc(nombre, payload = {}) {
    let token = await supabaseTokenVigente();
    try {
        return await supabasePeticion(`/rest/v1/rpc/${nombre}`, {
            method: 'POST',
            headers: supabaseHeaders(token, true),
            body: JSON.stringify(payload)
        });
    } catch (error) {
        if (error.status !== 401) throw error;
        token = await supabaseRenovarSesion();
        return supabasePeticion(`/rest/v1/rpc/${nombre}`, {
            method: 'POST',
            headers: supabaseHeaders(token, true),
            body: JSON.stringify(payload)
        });
    }
}

function agruparNovedadesSupabase(novedades) {
    const ingresos = [];
    const salidas = [];
    const faltasMap = new Map();
    (novedades || []).forEach(n => {
        const base = {
            puesto: n.post || '', nombre: n.full_name || '', fecha: n.date || '',
            proyecto: n.project || '', provincia: n.province || ''
        };
        if (n.type === 'INGRESO') ingresos.push(base);
        else if (n.type === 'SALIDA') salidas.push(base);
        else if (n.type === 'FALTA_INJUSTIFICADA' || n.type === 'FALTA_JUSTIFICADA') {
            const key = `${n.assignment_id || ''}|${n.full_name || ''}`;
            if (!faltasMap.has(key)) faltasMap.set(key, { ...base, diasInjustificados: [], diasJustificados: [] });
            const dia = Number(String(n.date || '').slice(8, 10));
            if (n.type === 'FALTA_INJUSTIFICADA') faltasMap.get(key).diasInjustificados.push(dia);
            else faltasMap.get(key).diasJustificados.push(dia);
        }
    });
    return { ingresos, salidas, faltas: [...faltasMap.values()] };
}

function adaptarSnapshotSupabase(snapshot) {
    if (!snapshot || snapshot.schema_version !== 2) throw new Error('Supabase devolvió un contrato de dashboard incompatible.');
    const salida = {
        __meta__: {
            tipo: 'dashboard', version: 8, backend: 'supabase',
            generadoEn: snapshot.generated_at, duracionServidorMs: null
        },
        __armamento__: {
            global: Number(snapshot.weapon_summary?.global) || 0,
            enCampo: Number(snapshot.weapon_summary?.en_campo) || 0,
            enTransito: Number(snapshot.weapon_summary?.en_transito) || 0,
            rastrillo: Number(snapshot.weapon_summary?.rastrillo) || 0,
            perdida: Number(snapshot.weapon_summary?.perdida_robada) || 0,
            confiscada: Number(snapshot.weapon_summary?.confiscada) || 0
        },
        __puestos__: [],
        __asistencia__: {},
        __novedades__: agruparNovedadesSupabase(snapshot.attendance_novelties),
        __llamados__: (snapshot.personnel_warnings || []).map(w => ({
            fecha: w.date, puesto: w.post || '', proyecto: w.project || '', provincia: w.province || '',
            nombre_guardia: w.personnel_name || '', motivo: w.reason || '', tipo_llamado: w.type || '', registrado_por: ''
        })),
        __historico__: (snapshot.project_history || []).map(h => ({
            provincia: h.province || '', proyecto: h.project || '', fechaArchivado: h.archived_at || '',
            finReal: h.actual_end_date || '', tipoContrato: '', supervisores: [], snapshot: h.snapshot || { guardias: 0, armas: 0, radios: 0, puestos: [] }
        })),
        __vacantes_nacional__: 0,
        __cedulas__: {},
        __personal_actas__: [],
        __supervisores__: []
    };

    const asistenciaPorPuesto = new Map();
    (snapshot.attendance_today || []).forEach(a => {
        const key = String(a.post_id || a.post_name || '').toUpperCase().trim();
        if (!key) return;
        if (!asistenciaPorPuesto.has(key)) asistenciaPorPuesto.set(key, { rotacion: [], activos: [] });
        const grupo = asistenciaPorPuesto.get(key);
        if (a.full_name && !grupo.rotacion.includes(a.full_name)) grupo.rotacion.push(a.full_name);
        if (a.counts_as_on_duty && a.full_name) grupo.activos.push(a);
    });

    const proyectosPorProvincia = new Map();
    (snapshot.projects || []).forEach(p => {
        const provincia = String(p.province || '').toUpperCase().trim();
        if (!proyectosPorProvincia.has(provincia)) proyectosPorProvincia.set(provincia, []);
        const documentos = Array.isArray(p.documents) ? p.documents : [];
        const supervisores = (p.supervisors || []).map(s => s.full_name).filter(Boolean);
        const proyectoLegacy = {
            nombre: p.name || '', guardias: Number(p.guards) || 0, armas: Number(p.weapons) || 0,
            radios: Number(p.radios) || 0, puestos: (p.posts || []).length, vacantes: Number(p.vacancies) || 0,
            fin: p.planned_end_date || '', tipoContrato: String(p.contract_type || '').toUpperCase(),
            urlDocumento: documentos.find(d => d.type === 'CONTRATO')?.url || '',
            urlKardex: documentos.find(d => d.type === 'KARDEX')?.url || '', supervisores
        };
        proyectosPorProvincia.get(provincia).push(proyectoLegacy);
        salida.__vacantes_nacional__ += proyectoLegacy.vacantes;
        salida.__supervisores__.push(...(p.supervisors || []).map(s => ({
            cedula: '', nombre: s.full_name || '', provincia, proyecto: p.name || '', estado: 'ACTIVO'
        })));

        (p.posts || []).forEach(po => {
            const keyId = String(po.id || '').toUpperCase();
            const keyNombre = String(po.name || '').toUpperCase().trim();
            const asistencia = asistenciaPorPuesto.get(keyId) || asistenciaPorPuesto.get(keyNombre) || { rotacion: [], activos: [] };
            const activo = asistencia.activos[0] || null;
            salida.__asistencia__[keyNombre] = {
                enTurno: activo?.full_name || null,
                turnoTipo: activo?.code_label || null,
                rotacion: asistencia.rotacion
            };
            salida.__puestos__.push({
                provincia, proyecto: p.name || '', nombre_puesto: po.name || '',
                lat: Number(po.latitude) || 0, lng: Number(po.longitude) || 0,
                tipo: po.service_type || '', guardia: asistencia.rotacion.join(', '),
                armado: po.armed ? 'SI' : 'NO', arma: '', tieneLetal: false, tieneNoLetal: false,
                radio: po.has_radio ? 'SI' : 'NO', radio_info: '', turno: po.shift_label || '',
                dias: po.service_days || '', observacion: po.observation || ''
            });
        });
    });

    (snapshot.provinces || []).forEach(p => {
        const nombre = String(p.name || '').toUpperCase().trim();
        const proyectosList = proyectosPorProvincia.get(nombre) || [];
        const supervisores = [...new Set(proyectosList.flatMap(pr => pr.supervisores || []))];
        salida[nombre] = {
            x: Number(p.map_x) || 0, y: Number(p.map_y) || 0,
            tipo: p.office_type || '', estado: p.operational_status || '', cat: p.map_category || 'none',
            guardias: Number(p.guards) || 0, armas: Number(p.weapons) || 0,
            puestos: Number(p.posts) || 0, proyectos: Number(p.projects) || 0,
            vacantes: Number(p.vacancies) || 0, rastrilloSede: Number(p.rastrillo_weapons) || 0,
            urlPermisoOperaciones: p.procedures?.operations_permit_url || '',
            urlTenenciaArmas: p.procedures?.weapons_possession_url || '',
            urlPermisoUniforme: p.procedures?.uniform_permit_url || '',
            tramiteInfo: {
                tramite: p.procedures?.procedure_number || '',
                vigenciaInicio: p.procedures?.valid_from || '',
                vigenciaFin: p.procedures?.valid_until || '',
                estadoTramite: p.procedures?.status || '',
                urlCertificado: p.procedures?.certificate_url || ''
            },
            proyectosList, supervisores
        };
    });
    return salida;
}

async function supabaseCargarDashboardLegacy() {
    const snapshot = await supabaseRpc('get_dashboard_snapshot_v2');
    return adaptarSnapshotSupabase(snapshot);
}
