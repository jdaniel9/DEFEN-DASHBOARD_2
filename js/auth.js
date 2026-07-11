// ================================================================
// auth.js — Login contra Apps Script (doPost) con sessionStorage
// La contraseña nunca se guarda en el código; se valida en el
// servidor (Apps Script) contra un hash SHA-256 guardado en Sheets.
// ================================================================

const AUTH_SESSION_KEY = 'defen_auth_ok';

function estaAutenticado() {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
}

function mostrarLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    aplicarFondoAleatorio();
}

// Elige una de las 4 imágenes de fondo al azar cada vez que se muestra el login
// (nueva persona entrando, o la misma recargando/cerrando sesión y volviendo)
function aplicarFondoAleatorio() {
    const fondos = ['img/fondo1.png', 'img/fondo2.png', 'img/fondo3.png', 'img/fondo4.png'];
    const elegido = fondos[Math.floor(Math.random() * fondos.length)];
    document.getElementById('login-screen').style.backgroundImage = `url('${elegido}')`;
}

function ocultarLogin() {
    document.getElementById('login-screen').style.display = 'none';
}

function mostrarErrorLogin(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.style.display = 'block';
}

async function intentarLogin(usuario, password) {
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Verificando…';
    document.getElementById('login-error').style.display = 'none';

    try {
        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ usuario, password })
        });
        const json = await res.json();

        if (json.ok) {
            sessionStorage.setItem(AUTH_SESSION_KEY, '1');
            sessionStorage.setItem('defen_auth_nombre', json.nombre || usuario);
            ocultarLogin();
            iniciarDashboard();
        } else {
            mostrarErrorLogin(json.mensaje || 'Usuario o contraseña incorrectos');
        }
    } catch (e) {
        mostrarErrorLogin('No se pudo conectar. Revisa tu conexión a internet.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Ingresar';
    }
}

function inicializarLogin() {
    if (estaAutenticado()) {
        ocultarLogin();
        iniciarDashboard();
        return;
    }
    mostrarLogin();

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const usuario  = document.getElementById('login-usuario').value.trim();
        const password = document.getElementById('login-password').value;
        if (!usuario || !password) return;
        intentarLogin(usuario, password);
    });
}

function cerrarSesion() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem('defen_auth_nombre');
    location.reload();
}
