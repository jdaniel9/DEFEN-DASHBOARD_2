// ================================================================
// auth.js — Login configurable con sessionStorage.
// La fase actual utiliza Supabase Auth y conserva Apps Script como
// alternativa temporal de reversión.
// ================================================================

// ================================================================
// La contraseña nunca se guarda en el código del navegador.
//
// PERMISOS POR ROL (primera fase — se irá ampliando):
//   admin               → acceso total, incluida la gestion de Radios
//   coordinacion_general→ operacion general y Auditoria, sin facultades administrativas
//   operaciones         → consulta Radios, pero no los modifica
//   sistemas            → ve el mapa y administra el modulo de Radios
//   gdp                 → ve el mapa y consulta Asistencia sin modificarla
// (los totales del Resumen Armamento SIEMPRE se ven, lo que se
//  bloquea es abrir el detalle/tabla completa)
// ================================================================

const AUTH_SESSION_KEY  = 'defen_auth_ok';
const AUTH_ROL_KEY      = 'defen_auth_rol';
const AUTH_TOKEN_KEY    = 'defen_auth_token';
const FONDOS_DISPONIBLES = ['img/fondo1.png', 'img/fondo2.png', 'img/fondo3.png', 'img/fondo4.png'];
const ULTIMO_FONDO_KEY = 'defen_ultimo_fondo';
let loginEnCurso = false;
let formularioLoginConfigurado = false;

// Roles que NO pueden abrir el detalle de Armamento
const ROLES_SIN_ARMAMENTO = ['sistemas', 'gdp', 'inventario', 'financiero', 'central_monitoreo'];
// Roles que NO pueden abrir el detalle de Radios
const ROLES_SIN_RADIOS    = ['gdp', 'inventario', 'financiero', 'central_monitoreo'];

function estaAutenticado() {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
}

function rolActual() {
    return (sessionStorage.getItem(AUTH_ROL_KEY) || '').toLowerCase().trim();
}

function tokenSesionActual() {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function usuarioEsGestionOperativa() {
    return ['admin', 'coordinacion_general', 'operaciones'].includes(rolActual());
}

// Permisos configurables por el Administrador (por rol y por usuario).
// La lista llega del servidor al iniciar sesión y se refresca al cargar datos.
// La validación real siempre ocurre en la base de datos.
const AUTH_PERMISOS_KEY = 'defen_auth_permisos';
function permisosActuales() {
    try {
        const lista = JSON.parse(sessionStorage.getItem(AUTH_PERMISOS_KEY) || 'null');
        return Array.isArray(lista) ? lista : null;
    } catch (_) { return null; }
}
function guardarPermisosSesion(lista) {
    if (Array.isArray(lista)) sessionStorage.setItem(AUTH_PERMISOS_KEY, JSON.stringify(lista));
}
// Si aún no hay lista (sesión antigua), se usa la regla por rol como respaldo.
function tienePermiso(codigo, rolesRespaldo = []) {
    if (rolActual() === 'admin') return true;
    const lista = permisosActuales();
    if (lista) return lista.includes(codigo);
    return rolesRespaldo.includes(rolActual());
}

// Armamento y Radios usan la tabla de permisos (punto 2 del plan de mejoras).
// El segundo argumento de tienePermiso es solo el respaldo para sesiones antiguas.
const ARM_RESPALDO = ['operaciones'];
function permisoArmamento(codigo) { return tienePermiso(codigo, ARM_RESPALDO); }

function usuarioPuedeGenerarActas() {
    if (!permisoArmamento('armamento.actas')) return false;
    if (backendUsaSupabase() && SUPABASE_READ_ONLY_PHASE) {
        return typeof SUPABASE_WEAPON_DISPATCH_ENABLED !== 'undefined'
            && SUPABASE_WEAPON_DISPATCH_ENABLED;
    }
    return true;
}

function usuarioPuedeRegularizarArmamento() {
    return permisoArmamento('armamento.actas')
        && (!backendUsaSupabase() || SUPABASE_WEAPON_REGULARIZATION_ENABLED);
}

function usuarioPuedeGestionarEvidenciasArmamento() {
    return permisoArmamento('armamento.editar')
        && (!backendUsaSupabase() || SUPABASE_WEAPON_EVIDENCE_ENABLED);
}

function usuarioPuedeEditarDatosArmamento() {
    return permisoArmamento('armamento.editar');
}

function usuarioPuedeGestionarNovedadArmamento() {
    return permisoArmamento('armamento.novedades')
        && (!backendUsaSupabase() || SUPABASE_WEAPON_INCIDENT_ENABLED);
}

function usuarioPuedeGestionarMantenimientoArmamento() {
    return permisoArmamento('armamento.novedades')
        && (!backendUsaSupabase() || SUPABASE_WEAPON_MAINTENANCE_ENABLED);
}

function usuarioPuedeSubsanarDestinoArmamento() {
    return rolActual() === 'admin';
}

function usuarioPuedeConfirmarLlegadaArmamento() {
    return permisoArmamento('armamento.actas');
}

function usuarioPuedeGestionarTrasladoInternoArmamento() {
    return permisoArmamento('armamento.actas');
}

function usuarioPuedeVerControlDiarioArmamento() {
    return permisoArmamento('armamento.control') || permisoArmamento('armamento.cierre_mes');
}

function usuarioPuedeVerResumenOpe() {
    return usuarioEsGestionOperativa();
}

function usuarioPuedeVerHistorialMovimientosArmamento() {
    return permisoArmamento('armamento.ver')
        && (!backendUsaSupabase() || SUPABASE_WEAPON_HISTORY_ENABLED);
}

function usuarioPuedeVerArmamentoDetalle() {
    if (!backendUsaSupabase()) return !ROLES_SIN_ARMAMENTO.includes(rolActual());
    return permisoArmamento('armamento.ver');
}

function usuarioPuedeVerRadiosDetalle() {
    if (!backendUsaSupabase()) return !ROLES_SIN_RADIOS.includes(rolActual());
    return tienePermiso('radios.ver', ['operaciones', 'sistemas']) || tienePermiso('radios.gestionar', ['sistemas']);
}

function usuarioPuedeGestionarRadios() {
    return tienePermiso('radios.gestionar', ['sistemas'])
        && (!backendUsaSupabase() || (typeof SUPABASE_RADIO_MANAGEMENT_ENABLED !== 'undefined' && SUPABASE_RADIO_MANAGEMENT_ENABLED));
}

function usuarioPuedeVerHistorialRadios() {
    return usuarioPuedeVerRadiosDetalle();
}

function usuarioPuedeVerAsistencia() {
    return tienePermiso('asistencia.ver', ['coordinacion_general', 'operaciones', 'gdp', 'central_monitoreo']);
}

function usuarioPuedeGestionarAsistencia() {
    return tienePermiso('asistencia.tomar_lista', ['coordinacion_general', 'operaciones', 'central_monitoreo']);
}

function usuarioPuedeGestionarLlamadosAtencion() {
    return tienePermiso('llamados.ver', ['coordinacion_general', 'operaciones', 'central_monitoreo'])
        && (!backendUsaSupabase() || (typeof SUPABASE_PERSONNEL_WARNINGS_ENABLED !== 'undefined' && SUPABASE_PERSONNEL_WARNINGS_ENABLED));
}

function usuarioPuedeGestionarProyectos() {
    return tienePermiso('proyectos.gestionar', ['coordinacion_general', 'operaciones'])
        && backendUsaSupabase()
        && typeof SUPABASE_PROJECT_MANAGEMENT_ENABLED !== 'undefined'
        && SUPABASE_PROJECT_MANAGEMENT_ENABLED;
}

function usuarioPuedeArchivarProyectos() {
    return tienePermiso('proyectos.archivar', []);
}

function usuarioPuedeGestionarPersonalOperativo() {
    return tienePermiso('proyectos.gestionar', ['coordinacion_general', 'operaciones']) && backendUsaSupabase();
}

function usuarioPuedeGestionarUsuarios() {
    return rolActual() === 'admin'
        && backendUsaSupabase()
        && typeof SUPABASE_USER_ACCESS_MANAGEMENT_ENABLED !== 'undefined'
        && SUPABASE_USER_ACCESS_MANAGEMENT_ENABLED;
}

function usuarioPuedeVerAuditoriaSistema() {
    return tienePermiso('sistema.auditoria', ['coordinacion_general'])
        && backendUsaSupabase()
        && typeof SUPABASE_SYSTEM_AUDIT_ENABLED !== 'undefined'
        && SUPABASE_SYSTEM_AUDIT_ENABLED;
}

function usuarioPuedeVerSaludSistema() {
    return tienePermiso('sistema.salud', ['coordinacion_general'])
        && backendUsaSupabase()
        && typeof SUPABASE_SYSTEM_HEALTH_ENABLED !== 'undefined'
        && SUPABASE_SYSTEM_HEALTH_ENABLED;
}

function usuarioEsCentralMonitoreo() {
    return rolActual() === 'central_monitoreo';
}

// Al elegir un departamento en el login, autocompleta el campo Usuario
// (el usuario sigue teniendo que escribir su contraseña)
function autocompletarUsuarioPorDepartamento() {
    const dep = document.getElementById('login-departamento').value;
    if (dep) document.getElementById('login-usuario').value = dep === 'central_monitoreo' ? 'consola' : dep;
}

// Oculta/bloquea en la interfaz lo que el rol actual no puede ver.
// Se llama después de cada login exitoso (fresco o restaurado de sesión).
function aplicarPermisosUI() {
    const esCentral = usuarioEsCentralMonitoreo();
    const moduloExclusivo = esCentral;
    // Las actas de armamento son exclusivas de ADMIN y OPERACIONES.
    document.querySelectorAll('[data-permiso-actas]').forEach(el => {
        el.style.display = usuarioPuedeGenerarActas() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-despacho]').forEach(el => {
        el.style.display = usuarioPuedeGenerarActas() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-historial-armamento]').forEach(el => {
        el.style.display = usuarioPuedeVerHistorialMovimientosArmamento() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-regularizacion]').forEach(el => {
        el.style.display = usuarioPuedeRegularizarArmamento() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-asistencia]').forEach(el => {
        el.style.display = usuarioPuedeVerAsistencia() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-control-armamento]').forEach(el => {
        el.style.display = usuarioPuedeVerControlDiarioArmamento() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-resumen-ope]').forEach(el => {
        el.style.display = usuarioPuedeVerResumenOpe() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-gestion-radios]').forEach(el => {
        el.style.display = usuarioPuedeGestionarRadios() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-historial-radios]').forEach(el => {
        el.style.display = usuarioPuedeVerHistorialRadios() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-llamados]').forEach(el => {
        el.style.display = usuarioPuedeGestionarLlamadosAtencion() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-gestion-proyectos]').forEach(el => {
        el.style.display = usuarioPuedeGestionarProyectos() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-personal-operativo]').forEach(el => {
        el.style.display = usuarioPuedeGestionarPersonalOperativo() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-gestion-usuarios]').forEach(el => {
        el.style.display = usuarioPuedeGestionarUsuarios() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-auditoria]').forEach(el => {
        el.style.display = usuarioPuedeVerAuditoriaSistema() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-salud-sistema]').forEach(el => {
        el.style.display = usuarioPuedeVerSaludSistema() ? '' : 'none';
    });
    if (moduloExclusivo) {
        document.querySelectorAll('[onclick^="abrirModalHistorico"]').forEach(el => {
            el.style.display = 'none';
        });
        document.getElementById('fab-filtros')?.style.setProperty('display', 'none');
        document.getElementById('panel-filtros')?.style.setProperty('display', 'none');
    }
    if (!usuarioPuedeVerArmamentoDetalle()) {
        // Cubre el botón "Detalle" Y las filas clickeables del resumen
        // (En Campo, En Tránsito, Rastrillo, Pérdida, Confiscada, Global)
        document.querySelectorAll('[onclick^="abrirModalArmamento"]').forEach(el => {
            if (el.tagName === 'BUTTON') {
                el.style.display = 'none';
            } else {
                el.removeAttribute('onclick');
                el.style.cursor = 'default';
                el.classList.remove('cursor-pointer');
            }
        });
    }
    if (!usuarioPuedeVerRadiosDetalle()) {
        document.querySelectorAll('[onclick^="abrirModalRadios"]').forEach(el => {
            if (el.tagName === 'BUTTON') {
                el.style.display = 'none';
            } else {
                el.removeAttribute('onclick');
                el.style.cursor = 'default';
                el.classList.remove('cursor-pointer');
            }
        });
    }
    if (!usuarioPuedeArchivarProyectos()) {
        document.querySelectorAll('[onclick^="archivarProyectoActivo"]').forEach(el => {
            el.style.display = 'none';
        });
    }
    if (backendUsaSupabase() && SUPABASE_READ_ONLY_PHASE
        && !(typeof SUPABASE_PROJECT_ARCHIVE_ENABLED !== 'undefined' && SUPABASE_PROJECT_ARCHIVE_ENABLED)) {
        document.querySelectorAll('[onclick^="archivarProyectoActivo"]').forEach(el => {
            el.style.display = 'none';
        });
        mostrarAvisoSupabaseLectura();
    }
}

function mostrarAvisoSupabaseLectura() {
    if (document.getElementById('supabase-readonly-badge')) return;
    const aviso = document.createElement('div');
    aviso.id = 'supabase-readonly-badge';
    aviso.textContent = (typeof SUPABASE_WEAPON_DISPATCH_ENABLED !== 'undefined' && SUPABASE_WEAPON_DISPATCH_ENABLED)
        ? 'SUPABASE DEV · MIGRACIÓN CONTROLADA'
        : 'SUPABASE DEV · PRUEBA DE LECTURA';
    aviso.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:30000;background:#1e3a8a;color:#dbeafe;border:1px solid #60a5fa;border-radius:999px;padding:7px 11px;font-size:9px;font-weight:900;letter-spacing:.04em;box-shadow:0 8px 24px rgba(15,23,42,.3)';
    document.body.appendChild(aviso);
}

// Elige un fondo al azar EXCLUYENDO el último mostrado (guardado en localStorage,
// que persiste entre pestañas/recargas) — así nunca se repite dos veces seguidas.
function elegirFondoAleatorio() {
    const ultimo = localStorage.getItem(ULTIMO_FONDO_KEY);
    let candidatos = FONDOS_DISPONIBLES;
    if (ultimo && FONDOS_DISPONIBLES.length > 1) {
        candidatos = FONDOS_DISPONIBLES.filter(f => f !== ultimo);
    }
    const elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
    localStorage.setItem(ULTIMO_FONDO_KEY, elegido);
    return elegido;
}

function mostrarLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    aplicarFondoAleatorio();
}

// Elige una de las 4 imágenes de fondo (nunca repite la anterior) para el login
function aplicarFondoAleatorio() {
    document.getElementById('login-screen').style.backgroundImage = `url('${elegirFondoAleatorio()}')`;
}

function ocultarLogin() {
    document.getElementById('login-screen').style.display = 'none';
}

function mostrarErrorLogin(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.style.display = 'block';
}

async function intentarLogin(usuario, password, departamento) {
    if(loginEnCurso)return;
    const btn = document.getElementById('login-btn');
    loginEnCurso=true;
    btn.disabled = true;
    btn.textContent = 'Verificando…';
    document.getElementById('login-error').style.display = 'none';

    try {
        const json = await solicitarLoginConReintento({ usuario, password, departamento });

        if (json.ok) {
            sessionStorage.setItem(AUTH_SESSION_KEY, '1');
            sessionStorage.setItem('defen_auth_nombre', json.nombre || usuario);
            sessionStorage.setItem('defen_auth_usuario', usuario);
            sessionStorage.setItem(AUTH_ROL_KEY, json.rol || '');
            sessionStorage.setItem(AUTH_TOKEN_KEY, json.token || '');
            guardarPermisosSesion(json.permisos);
            if (backendUsaSupabase()) {
                sessionStorage.setItem(SUPABASE_REFRESH_TOKEN_KEY, json.refreshToken || '');
                sessionStorage.setItem(SUPABASE_EXPIRES_AT_KEY, String(json.expiresAt || 0));
            }
            ocultarLogin();
            iniciarDashboard({usarCachePrimero:false});
            aplicarPermisosUI();
        } else {
            mostrarErrorLogin(json.mensaje || 'Usuario o contraseña incorrectos');
        }
    } catch (e) {
        console.error('Error de autenticación:',e);
        mostrarErrorLogin(e.message||'No se pudo conectar. Revisa tu conexión a internet.');
    } finally {
        loginEnCurso=false;
        btn.disabled = false;
        btn.textContent = 'Ingresar';
    }
}

async function solicitarLoginConReintento(payload){
    if (backendUsaSupabase()) {
        return supabaseIniciarSesion(payload.usuario, payload.password, payload.departamento);
    }
    let ultimoError=null;
    for(let intento=1;intento<=2;intento++){
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000),url=new URL(APPS_SCRIPT_URL);url.searchParams.set('_t',Date.now()+'_'+intento);
        try{
            const res=await fetch(url.toString(),{method:'POST',body:JSON.stringify(payload),redirect:'follow',cache:'no-store',signal:controller.signal});
            if(!res.ok)throw new Error(`El servicio de acceso respondió HTTP ${res.status}.`);
            const texto=await res.text();try{return JSON.parse(texto);}catch(_){throw new Error('El servicio de acceso devolvió una respuesta inválida.');}
        }catch(e){ultimoError=e;if(intento<2&&e.name!=='AbortError')await new Promise(r=>setTimeout(r,700));}
        finally{clearTimeout(timeout);}
    }
    if(ultimoError?.name==='AbortError')throw new Error('El inicio de sesión tardó demasiado. Vuelve a intentarlo.');
    throw ultimoError||new Error('No se pudo conectar con el servicio de acceso.');
}

function configurarFormularioLogin(){
    if(formularioLoginConfigurado)return;formularioLoginConfigurado=true;
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const departamento = document.getElementById('login-departamento').value;
        const usuario  = document.getElementById('login-usuario').value.trim();
        const password = document.getElementById('login-password').value;
        if (!departamento) { mostrarErrorLogin('Selecciona tu departamento antes de ingresar.'); return; }
        if (!usuario || !password) return;
        intentarLogin(usuario, password, departamento);
    });
}

async function inicializarLogin() {
    configurarFormularioLogin();
    if (estaAutenticado()) {
        if (backendUsaSupabase()) {
            const restaurada = await supabaseRestaurarSesion();
            if (!restaurada) {
                cerrarSesionLocal();
                mostrarLogin();
                mostrarErrorLogin('Tu sesión venció. Ingresa nuevamente.');
                return;
            }
        }
        ocultarLogin();
        iniciarDashboard({usarCachePrimero:true});
        aplicarPermisosUI();
        return;
    }
    mostrarLogin();
}

function cerrarSesion() {
    if (backendUsaSupabase()) supabaseCerrarSesionRemota(tokenSesionActual());
    cerrarSesionLocal();
    location.reload();
}

function cerrarSesionLocal() {
    // El caché contiene una copia temporal de la respuesta del dashboard.
    // Se elimina al salir para que nunca quede disponible para otro usuario del mismo equipo.
    Object.keys(sessionStorage)
        .filter(k => k.startsWith('defen_dashboard_datos_v1_'))
        .forEach(k => sessionStorage.removeItem(k));
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem('defen_auth_nombre');
    sessionStorage.removeItem('defen_auth_usuario');
    sessionStorage.removeItem(AUTH_ROL_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_PERMISOS_KEY);
    sessionStorage.removeItem(SUPABASE_REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(SUPABASE_EXPIRES_AT_KEY);
}
