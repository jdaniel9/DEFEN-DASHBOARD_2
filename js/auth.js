// ================================================================
// auth.js — Login configurable con sessionStorage.
// La fase actual utiliza Supabase Auth y conserva Apps Script como
// alternativa temporal de reversión.
// ================================================================

// ================================================================
// La contraseña nunca se guarda en el código del navegador.
//
// PERMISOS POR ROL (primera fase — se irá ampliando):
//   admin, operaciones  → ven todo, sin restricciones
//   sistemas            → ve todo EXCEPTO el detalle de Armamento
//   gdp, inventario,
//   financiero          → ven todo EXCEPTO el detalle de Armamento y Radios
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
const ROLES_SIN_ARMAMENTO = ['sistemas', 'gdp', 'inventario', 'financiero'];
// Roles que NO pueden abrir el detalle de Radios
const ROLES_SIN_RADIOS    = ['gdp', 'inventario', 'financiero'];

function estaAutenticado() {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
}

function rolActual() {
    return (sessionStorage.getItem(AUTH_ROL_KEY) || '').toLowerCase().trim();
}

function tokenSesionActual() {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function usuarioPuedeGenerarActas() {
    if (backendUsaSupabase() && SUPABASE_READ_ONLY_PHASE) return false;
    return ['admin','operaciones'].includes(rolActual());
}


function usuarioPuedeVerArmamentoDetalle() {
    return !ROLES_SIN_ARMAMENTO.includes(rolActual());
}

function usuarioPuedeVerRadiosDetalle() {
    return !ROLES_SIN_RADIOS.includes(rolActual());
}

function usuarioPuedeVerAsistencia() {
    return ['admin', 'operaciones', 'gdp'].includes(rolActual());
}

function usuarioPuedeGestionarAsistencia() {
    return ['admin', 'operaciones'].includes(rolActual());
}

// Al elegir un departamento en el login, autocompleta el campo Usuario
// (el usuario sigue teniendo que escribir su contraseña)
function autocompletarUsuarioPorDepartamento() {
    const dep = document.getElementById('login-departamento').value;
    if (dep) document.getElementById('login-usuario').value = dep;
}

// Oculta/bloquea en la interfaz lo que el rol actual no puede ver.
// Se llama después de cada login exitoso (fresco o restaurado de sesión).
function aplicarPermisosUI() {
    // Las actas de armamento son exclusivas de ADMIN y OPERACIONES.
    document.querySelectorAll('[data-permiso-actas]').forEach(el => {
        el.style.display = usuarioPuedeGenerarActas() ? '' : 'none';
    });
    document.querySelectorAll('[data-permiso-asistencia]').forEach(el => {
        el.style.display = usuarioPuedeVerAsistencia() ? '' : 'none';
    });
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
    if (backendUsaSupabase() && SUPABASE_READ_ONLY_PHASE) {
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
    aviso.textContent = 'SUPABASE DEV · PRUEBA DE LECTURA';
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
    sessionStorage.removeItem(SUPABASE_REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(SUPABASE_EXPIRES_AT_KEY);
}
