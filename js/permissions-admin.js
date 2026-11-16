// ================================================================
// permissions-admin.js — Administración de permisos y contraseñas
// Se integra al panel "Usuarios y accesos" (solo Administrador):
//   · PERMISOS POR PERFIL: matriz perfil × permiso.
//   · En cada usuario: permisos especiales (conceder / quitar) y
//     cambio de contraseña.
// La base de datos valida todo; el Administrador siempre tiene acceso total.
// ================================================================
(function () {
  const pa = { datos: null, guardando: false };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MODULOS = { ASISTENCIA: '📋 ASISTENCIA', LLAMADOS: '⚠ LLAMADOS DE ATENCIÓN', PROYECTOS: '🏢 PROYECTOS', ARMAMENTO: '🔫 ARMAMENTO', RADIOS: '📻 RADIOS', LIMPIEZA: '🧹 LIMPIEZA', SISTEMA: '🛡 SISTEMA' };

  async function cargar(forzar = false) {
    if (!pa.datos || forzar) pa.datos = await supabaseCargarPermisosAdmin();
    return pa.datos;
  }
  const porModulo = (permisos) => permisos.reduce((acc, p) => { (acc[p.module] = acc[p.module] || []).push(p); return acc; }, {});

  // Botón en el encabezado del panel de usuarios
  const asegurarOriginal = window.asegurarModalGestionUsuarios;
  if (typeof asegurarOriginal === 'function') {
    window.asegurarModalGestionUsuarios = function () {
      asegurarOriginal.apply(this, arguments);
      const crear = document.querySelector('#gestion-usuarios-modal [onclick="abrirFormularioNuevoUsuario()"]');
      if (crear && !document.getElementById('gu-btn-permisos')) {
        const boton = document.createElement('button');
        boton.id = 'gu-btn-permisos';
        boton.textContent = '🔐 PERMISOS POR PERFIL';
        boton.style.cssText = 'border:0;border-radius:8px;background:#0f172a;color:white;padding:8px 11px;font-weight:900;cursor:pointer';
        boton.onclick = () => abrirPermisosPorPerfil();
        crear.parentNode.insertBefore(boton, crear);
      }
    };
  }

  // Secciones extra en el detalle de cada usuario
  const detalleOriginal = window.renderDetalleGestionUsuario;
  if (typeof detalleOriginal === 'function') {
    window.renderDetalleGestionUsuario = function () {
      detalleOriginal.apply(this, arguments);
      const perfil = typeof guPerfilActual === 'function' ? guPerfilActual() : null;
      const contenedor = document.getElementById('gu-contenido');
      if (!perfil || !contenedor) return;
      const extra = document.createElement('div');
      extra.id = 'gu-extra-permisos';
      extra.innerHTML = `<section class="pa-card"><div class="pa-head"><div><h3>🔑 CONTRASEÑA</h3><p>Asigna una contraseña nueva si el usuario la olvidó. Entrégala por un canal seguro y pídele que no la comparta.</p></div>
          <button class="pa-btn" onclick="abrirCambioClaveUsuario('${esc(perfil.id)}')">CAMBIAR CONTRASEÑA</button></div></section>
        <section class="pa-card" id="pa-usuario"><div class="pa-head"><div><h3>🔐 PERMISOS DE ESTE USUARIO</h3><p>${perfil.role_code === 'admin' ? 'El Administrador siempre tiene todos los permisos.' : 'Por defecto hereda los permisos de su perfil. Puedes concederle o quitarle permisos solo a esta persona.'}</p></div></div>
          <div id="pa-usuario-lista"><div class="pa-vacio">Cargando permisos…</div></div></section>`;
      contenedor.appendChild(extra);
      if (perfil.role_code !== 'admin') pintarPermisosUsuario(perfil).catch((e) => {
        document.getElementById('pa-usuario-lista').innerHTML = `<div class="pa-vacio pa-error">${esc(e.message || e)}</div>`;
      });
      else document.getElementById('pa-usuario-lista').innerHTML = '';
    };
  }

  async function pintarPermisosUsuario(perfil) {
    const d = await cargar();
    const rol = (d.roles || []).find((r) => r.code === perfil.role_code);
    const delRol = new Set(rol?.permissions || []);
    const propios = new Map((d.overrides || []).filter((o) => o.profile_id === perfil.id).map((o) => [o.code, o.effect]));
    const grupos = porModulo(d.permissions || []);
    document.getElementById('pa-usuario-lista').innerHTML = Object.entries(grupos).map(([modulo, lista]) => `
      <h4 class="pa-modulo">${esc(MODULOS[modulo] || modulo)}</h4>
      ${lista.map((p) => {
        const efecto = propios.get(p.code) || '';
        const final = efecto === 'GRANT' ? true : efecto === 'DENY' ? false : delRol.has(p.code);
        return `<div class="pa-fila"><div><b>${esc(p.label)}</b><small>${esc(p.description)}</small></div>
          <span class="pa-estado ${final ? 'pa-si' : 'pa-no'}">${final ? '✔ PUEDE' : '✖ NO PUEDE'}</span>
          <select data-code="${esc(p.code)}">
            <option value="" ${efecto === '' ? 'selected' : ''}>SEGÚN SU PERFIL (${delRol.has(p.code) ? 'SÍ' : 'NO'})</option>
            <option value="GRANT" ${efecto === 'GRANT' ? 'selected' : ''}>CONCEDER A ESTE USUARIO</option>
            <option value="DENY" ${efecto === 'DENY' ? 'selected' : ''}>QUITAR A ESTE USUARIO</option>
          </select></div>`;
      }).join('')}`).join('') +
      `<button class="pa-guardar" onclick="guardarPermisosUsuarioAdmin('${esc(perfil.id)}')">GUARDAR PERMISOS DE ESTE USUARIO</button>`;
  }

  window.guardarPermisosUsuarioAdmin = async function (profileId) {
    if (pa.guardando) return;
    const cambios = [...document.querySelectorAll('#pa-usuario-lista select[data-code]')].map((s) => ({ code: s.dataset.code, effect: s.value }));
    if (!confirm('¿GUARDAR LOS PERMISOS ESPECIALES DE ESTE USUARIO? SE APLICAN EN SU PRÓXIMA CARGA DE DATOS.')) return;
    pa.guardando = true;
    try {
      await supabaseGuardarPermisosUsuario(profileId, cambios);
      await cargar(true);
      const perfil = typeof guPerfilActual === 'function' ? guPerfilActual() : null;
      if (perfil) await pintarPermisosUsuario(perfil);
      alert('PERMISOS DEL USUARIO GUARDADOS.');
    } catch (e) { alert(`NO SE PUDIERON GUARDAR: ${e.message || e}`); }
    finally { pa.guardando = false; }
  };

  // Matriz de permisos por perfil
  window.abrirPermisosPorPerfil = async function () {
    const contenedor = document.getElementById('gu-contenido');
    contenedor.innerHTML = '<div class="pa-vacio">Cargando permisos…</div>';
    try {
      const d = await cargar(true);
      const roles = d.roles || [];
      const grupos = porModulo(d.permissions || []);
      const tieneRol = (rol, code) => (rol.permissions || []).includes(code);
      contenedor.innerHTML = `<section class="pa-card pa-matriz-card">
        <div class="pa-head"><div><h3>🔐 PERMISOS POR PERFIL</h3><p>Marca qué puede hacer cada perfil. El Administrador siempre puede todo. Para excepciones de una sola persona, usa "Permisos de este usuario" dentro de su ficha.</p></div>
        <button class="pa-btn" onclick="renderDetalleGestionUsuario()">← VOLVER</button></div>
        <div class="pa-matriz-wrap"><table class="pa-matriz"><thead><tr><th>PERMISO</th><th title="Siempre tiene todos los permisos">ADMIN</th>${roles.map((r) => `<th>${esc(r.label)}</th>`).join('')}</tr></thead><tbody>
        ${Object.entries(grupos).map(([modulo, lista]) => `<tr class="pa-grupo"><td colspan="${roles.length + 2}">${esc(MODULOS[modulo] || modulo)}</td></tr>` +
          lista.map((p) => `<tr><td><b>${esc(p.label)}</b><small>${esc(p.description)}</small></td><td class="pa-c"><input type="checkbox" checked disabled></td>
            ${roles.map((r) => `<td class="pa-c"><input type="checkbox" data-role="${esc(r.code)}" data-code="${esc(p.code)}" ${tieneRol(r, p.code) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')).join('')}
        </tbody></table></div>
        <p class="pa-nota">Las funciones exclusivas del Administrador (eliminar actas, subsanar destino, importar inventario) no se delegan.</p>
        <button class="pa-guardar" onclick="guardarPermisosPorPerfil()">GUARDAR CAMBIOS DE PERFILES</button></section>`;
    } catch (e) {
      contenedor.innerHTML = `<div class="pa-vacio pa-error">${esc(e.message || e)}</div>`;
    }
  };

  window.guardarPermisosPorPerfil = async function () {
    if (pa.guardando) return;
    const d = pa.datos;
    const cambiados = (d?.roles || []).map((r) => {
      const nuevos = [...document.querySelectorAll(`.pa-matriz input[data-role="${r.code}"]:checked`)].map((i) => i.dataset.code).sort();
      const antes = [...(r.permissions || [])].sort();
      return { rol: r, nuevos, cambio: nuevos.join('|') !== antes.join('|') };
    }).filter((x) => x.cambio);
    if (!cambiados.length) return alert('NO HAY CAMBIOS PARA GUARDAR.');
    if (!confirm(`¿GUARDAR LOS PERMISOS DE: ${cambiados.map((x) => x.rol.label).join(', ')}?\nSE APLICAN A TODOS LOS USUARIOS DE ESOS PERFILES EN SU PRÓXIMA CARGA DE DATOS.`)) return;
    pa.guardando = true;
    try {
      for (const x of cambiados) await supabaseGuardarPermisosRol(x.rol.code, x.nuevos);
      await abrirPermisosPorPerfil();
      alert('PERMISOS DE PERFILES GUARDADOS.');
    } catch (e) { alert(`NO SE PUDIERON GUARDAR: ${e.message || e}`); }
    finally { pa.guardando = false; }
  };

  // Cambio de contraseña por el Administrador
  window.abrirCambioClaveUsuario = function (profileId) {
    const perfil = (gestionUsuarios?.workspace?.profiles || []).find((p) => p.id === profileId);
    const capa = document.createElement('div');
    capa.id = 'pa-clave-modal';
    capa.className = 'pa-modal';
    capa.innerHTML = `<div class="pa-modal-card"><h3>🔑 NUEVA CONTRASEÑA</h3>
      <p>Usuario: <b>${esc(perfil?.username || '')}</b> · ${esc(perfil?.full_name || '')}</p>
      <label>NUEVA CONTRASEÑA<input id="pa-clave-1" type="password" autocomplete="new-password" maxlength="128"></label>
      <label>REPETIR CONTRASEÑA<input id="pa-clave-2" type="password" autocomplete="new-password" maxlength="128"></label>
      <small>Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.</small>
      <div class="pa-modal-acciones"><button class="pa-guardar" onclick="guardarCambioClaveUsuario('${esc(profileId)}')">CAMBIAR CONTRASEÑA</button><button class="pa-btn" onclick="document.getElementById('pa-clave-modal')?.remove()">CANCELAR</button></div></div>`;
    document.body.appendChild(capa);
    document.getElementById('pa-clave-1').focus();
  };

  window.guardarCambioClaveUsuario = async function (profileId) {
    if (pa.guardando) return;
    const c1 = document.getElementById('pa-clave-1')?.value || '';
    const c2 = document.getElementById('pa-clave-2')?.value || '';
    if (c1.length < 12 || c1.length > 128 || !/[a-z]/.test(c1) || !/[A-Z]/.test(c1) || !/[0-9]/.test(c1) || !/[^A-Za-z0-9]/.test(c1)) {
      return alert('LA CONTRASEÑA DEBE TENER 12 A 128 CARACTERES, MAYÚSCULA, MINÚSCULA, NÚMERO Y SÍMBOLO.');
    }
    if (c1 !== c2) return alert('LAS CONTRASEÑAS NO COINCIDEN.');
    pa.guardando = true;
    try {
      await supabaseCambiarClaveUsuarioAdmin(profileId, c1);
      document.getElementById('pa-clave-modal')?.remove();
      alert('CONTRASEÑA CAMBIADA. ENTRÉGALA AL USUARIO POR UN CANAL SEGURO.');
    } catch (e) { alert(`NO SE PUDO CAMBIAR LA CONTRASEÑA: ${e.message || e}`); }
    finally { pa.guardando = false; }
  };
})();
