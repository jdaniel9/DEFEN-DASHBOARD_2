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

async function supabaseCargarRadiosDetalle() {
    let token = await supabaseTokenVigente();
    const ruta = '/rest/v1/radio_inventory_detail'
        + '?select=serial_number,model,state,province_name,project_name,post_name,observation'
        + '&active=eq.true'
        + '&order=province_name.asc,project_name.asc,post_name.asc,serial_number.asc';
    let filas;
    try {
        filas = await supabasePeticion(ruta, { headers: supabaseHeaders(token) });
    } catch (error) {
        if (error.status !== 401) throw error;
        token = await supabaseRenovarSesion();
        filas = await supabasePeticion(ruta, { headers: supabaseHeaders(token) });
    }
    return (Array.isArray(filas) ? filas : []).map(radio => ({
        provincia: String(radio.province_name || '').toUpperCase().trim(),
        proyecto: radio.project_name || '',
        puesto: radio.post_name || '',
        modelo: radio.model || '',
        serie: radio.serial_number || '',
        estado: radio.state || '',
        observacion: radio.observation || ''
    }));
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
    const puedeVerRadios = typeof usuarioPuedeVerRadiosDetalle === 'function'
        ? usuarioPuedeVerRadiosDetalle()
        : ['admin', 'operaciones', 'sistemas'].includes((sessionStorage.getItem('defen_auth_rol') || '').toLowerCase());
    const [snapshot, radios] = await Promise.all([
        supabaseRpc('get_dashboard_snapshot_v2'),
        puedeVerRadios ? supabaseCargarRadiosDetalle() : Promise.resolve([])
    ]);
    const salida = adaptarSnapshotSupabase(snapshot);
    if (puedeVerRadios) salida.__radios_detalle__ = radios;
    return salida;
}

let supabaseWeaponWorkspacePromise = null;
let supabaseWeaponWorkspace = null;

function adaptarWeaponWorkspace(workspace) {
    if (!workspace || workspace.schema_version !== 1 || !Array.isArray(workspace.weapons)) {
        throw new Error('Supabase devolvió un contrato de armamento incompatible.');
    }
    armamentoDetalle = workspace.weapons.map(w => ({
        idArma: w.id,
        codigoArma: w.weapon_code || '',
        numeroDocumento: w.document_number || '',
        propietario: w.owner_name || '',
        clase: w.weapon_class || '',
        tipo: w.weapon_type || '',
        marca: w.brand || '',
        modelo: w.model || '',
        calibre: w.caliber || '',
        serie: w.serial_number || '',
        categoria: w.category || '',
        fechaEmision: w.issue_date || '',
        fechaExpiracion: w.expiration_date || '',
        urlCredencial: w.credential_url || '',
        urlImagenArma: w.photo_url || '',
        estado: w.state || '',
        provinciaId: w.province_id || null,
        provincia: w.province || '',
        ciudad: w.city || '',
        proyectoId: w.project_id || null,
        proyecto: w.project || '',
        puestoId: w.post_id || null,
        puesto: w.post || '',
        ubicacion: w.location || '',
        responsablePersonalId: w.responsible_personnel_id || null,
        responsableNombre: w.responsible_name || '',
        responsableCedula: w.responsible_national_id || '',
        destinoProvinciaId: w.destination_province_id || null,
        destinoCiudad: w.destination_city || '',
        destinoProyectoId: w.destination_project_id || null,
        destinoPuestoId: w.destination_post_id || null,
        destinoUbicacion: w.destination_location || '',
        urlGuiaEnvio: w.outbound_guide_url || '',
        urlGuiaRetorno: w.return_guide_url || '',
        estadoDocumental: w.document_status || '',
        condicionTecnica: w.technical_condition || '',
        bloqueadaAsignacion: Boolean(w.assignment_blocked),
        motivoBloqueo: w.block_reason || '',
        idActaActual: w.current_act_id || '',
        actaVigente: w.current_act_code || '',
        idMovimientoActual: w.current_movement_id || '',
        idMantenimientoActual: w.current_maintenance_id || '',
        fechaUltimoMovimiento: w.last_movement_at || '',
        fechaUltimaNovedadTecnica: w.last_technical_event_at || ''
    }));
    supervisoresActas = (workspace.supervisors || []).map(s => ({
        idAsignacion: s.assignment_id,
        personalId: s.personnel_id,
        cedula: s.national_id || '',
        nombre: s.full_name || '',
        provinciaId: s.province_id,
        provincia: s.province || '',
        proyectoId: s.project_id,
        proyecto: s.project || '',
        estado: 'ACTIVO'
    }));
    supabaseWeaponWorkspace = workspace;
    return workspace;
}

async function cargarWorkspaceArmamentoSupabase(forzar = false) {
    if (!backendUsaSupabase()) return null;
    if (supabaseWeaponWorkspace && !forzar) return supabaseWeaponWorkspace;
    if (supabaseWeaponWorkspacePromise && !forzar) return supabaseWeaponWorkspacePromise;
    supabaseWeaponWorkspacePromise = (async () => {
        const workspace = await supabaseRpc('get_weapon_workspace');
        return adaptarWeaponWorkspace(workspace);
    })();
    try { return await supabaseWeaponWorkspacePromise; }
    finally { supabaseWeaponWorkspacePromise = null; }
}

function invalidarWorkspaceArmamentoSupabase() {
    supabaseWeaponWorkspace = null;
    supabaseWeaponWorkspacePromise = null;
}

async function supabaseCrearActaArmamento(payload) {
    return supabaseRpc('create_weapon_act', { p_payload: payload });
}

async function supabaseListarActasArmamento(limite = 200) {
    return supabaseRpc('list_weapon_acts', { p_limit: limite });
}

async function supabaseObtenerActaArmamento(codigo) {
    return supabaseRpc('get_weapon_act_detail', { p_act_code: codigo });
}

let supabaseWeaponDispatchWorkspace = null;
let supabaseWeaponDispatchPromise = null;

function adaptarWorkspaceDespachoArmamento(workspace) {
    if (!workspace || workspace.schema_version !== 1
        || !Array.isArray(workspace.people) || !Array.isArray(workspace.in_transit)) {
        throw new Error('Supabase devolvió un contrato de despacho incompatible.');
    }
    personalActas = workspace.people.map(persona => ({
        idAsignacion: persona.assignment_id || '',
        personalId: persona.personnel_id || '',
        cedula: persona.national_id || '',
        nombre: persona.full_name || '',
        cargo: persona.is_support ? 'PERSONAL DE APOYO' : '',
        provinciaId: persona.province_id || null,
        provincia: persona.province || '',
        proyectoId: persona.project_id || null,
        proyecto: persona.project || '',
        puestoId: persona.post_id || null,
        puesto: persona.post || '',
        estado: persona.assignment_status || ''
    }));
    supabaseWeaponDispatchWorkspace = workspace;
    return workspace;
}

async function cargarWorkspaceDespachoArmamentoSupabase(forzar = false) {
    if (!backendUsaSupabase()) return null;
    if (supabaseWeaponDispatchWorkspace && !forzar) return supabaseWeaponDispatchWorkspace;
    if (supabaseWeaponDispatchPromise && !forzar) return supabaseWeaponDispatchPromise;
    supabaseWeaponDispatchPromise = (async () => {
        const workspace = await supabaseRpc('get_weapon_dispatch_workspace');
        return adaptarWorkspaceDespachoArmamento(workspace);
    })();
    try { return await supabaseWeaponDispatchPromise; }
    finally { supabaseWeaponDispatchPromise = null; }
}

function invalidarWorkspaceDespachoArmamentoSupabase() {
    supabaseWeaponDispatchWorkspace = null;
    supabaseWeaponDispatchPromise = null;
}

function supabaseRutaStorage(ruta) {
    return String(ruta || '').split('/').map(encodeURIComponent).join('/');
}

async function supabaseSubirGuiaArmamento(archivo, solicitudId, carpeta = 'dispatch') {
    if (!(archivo instanceof Blob)) throw new Error('Selecciona la guía PDF.');
    if (archivo.type && archivo.type !== 'application/pdf') throw new Error('La guía debe estar en formato PDF.');
    if (archivo.size > 10 * 1024 * 1024) throw new Error('La guía PDF no puede superar 10 MB.');
    const id = String(solicitudId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('La solicitud de la guía no tiene un identificador válido.');
    const ahora = new Date();
    const ruta = `${carpeta}/${ahora.getUTCFullYear()}/${String(ahora.getUTCMonth() + 1).padStart(2, '0')}/${id}.pdf`;
    let token = await supabaseTokenVigente();
    const subir = async () => {
        const respuesta = await fetch(`${SUPABASE_URL}/storage/v1/object/weapon-guides/${supabaseRutaStorage(ruta)}`, {
            method: 'POST',
            headers: { ...supabaseHeaders(token), 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
            body: archivo
        });
        if (respuesta.ok) return { path: ruta, reused: false };
        const texto = await respuesta.text();
        let cuerpo = null;
        try { cuerpo = texto ? JSON.parse(texto) : null; } catch (_) { cuerpo = texto; }
        if (respuesta.status === 409) return { path: ruta, reused: true };
        const error = new Error(cuerpo?.message || cuerpo?.error || `No se pudo cargar la guía (HTTP ${respuesta.status}).`);
        error.status = respuesta.status;
        throw error;
    };
    try { return await subir(); }
    catch (error) {
        if (error.status !== 401) throw error;
        token = await supabaseRenovarSesion();
        return subir();
    }
}

async function supabaseEliminarGuiaArmamento(ruta) {
    if (!ruta) return;
    let token = await supabaseTokenVigente();
    const eliminar = () => supabasePeticion(
        `/storage/v1/object/weapon-guides/${supabaseRutaStorage(ruta)}`,
        { method: 'DELETE', headers: supabaseHeaders(token) }
    );
    try { return await eliminar(); }
    catch (error) {
        if (error.status !== 401) throw error;
        token = await supabaseRenovarSesion();
        return eliminar();
    }
}

async function supabaseUrlFirmadaGuiaArmamento(ruta, segundos = 300) {
    const respuesta = await supabaseRpcStorageFirmada(ruta, segundos);
    const firmada = respuesta?.signedURL || respuesta?.signedUrl || '';
    if (!firmada) throw new Error('No se pudo generar el enlace temporal de la guía.');
    return firmada.startsWith('http') ? firmada : `${SUPABASE_URL}/storage/v1${firmada}`;
}

async function supabaseRpcStorageFirmada(ruta, segundos) {
    let token = await supabaseTokenVigente();
    const crear = () => supabasePeticion(
        `/storage/v1/object/sign/weapon-guides/${supabaseRutaStorage(ruta)}`,
        { method: 'POST', headers: supabaseHeaders(token, true), body: JSON.stringify({ expiresIn: segundos }) }
    );
    try { return await crear(); }
    catch (error) {
        if (error.status !== 401) throw error;
        token = await supabaseRenovarSesion();
        return crear();
    }
}

async function supabaseConfirmarLlegadaArmamento(loteId, fecha = new Date().toISOString(), observacion = '') {
    return supabaseRpc('receive_weapon_batch', {
        p_batch_id: loteId,
        p_received_at: fecha,
        p_observation: observacion || null
    });
}
