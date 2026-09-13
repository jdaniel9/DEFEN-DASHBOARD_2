// ================================================================
// user-management.js — Migracion 43
// Perfiles, roles y bloqueo de acceso. No administra contrasenas.
// ================================================================

const gestionUsuarios = { workspace:null, perfilId:'', busqueda:'', filtro:'TODOS', guardando:false };

function guEsc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function guRequestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r=Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16);
    });
}

function guPerfilActual() {
    return (gestionUsuarios.workspace?.profiles || []).find(p => p.id === gestionUsuarios.perfilId) || null;
}

function asegurarModalGestionUsuarios() {
    if (document.getElementById('gestion-usuarios-modal')) return;
    const modal=document.createElement('div');
    modal.id='gestion-usuarios-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:22100;background:rgba(15,23,42,.88);backdrop-filter:blur(5px);padding:14px;align-items:center;justify-content:center';
    modal.innerHTML=`<div style="width:min(1200px,98vw);height:min(820px,95vh);background:#f1f5f9;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 32px 100px rgba(0,0,0,.55)">
      <header style="padding:14px 18px;background:#0f172a;color:white;display:flex;align-items:center;gap:12px"><div style="flex:1"><b style="font-size:16px">🛡️ Usuarios y accesos</b><div id="gu-subtitulo" style="font-size:10px;color:#c4b5fd;margin-top:3px">Cargando perfiles…</div></div><button onclick="cerrarGestionUsuarios()" style="border:0;border-radius:9px;background:#334155;color:white;padding:8px 12px;font-weight:800;cursor:pointer">✕ Cerrar</button></header>
      <div style="padding:10px 14px;background:#ede9fe;border-bottom:1px solid #ddd6fe;color:#4c1d95;font-size:10px"><b>Alta de una cuenta nueva:</b> créala primero en Supabase → Authentication → Users. Aparecerá aquí automáticamente como inactiva y podrás asignarle su perfil. Las contraseñas nunca se muestran en este panel.</div>
      <div id="gu-resumen" style="padding:10px 12px 0"></div>
      <div style="display:grid;grid-template-columns:390px minmax(480px,1fr);gap:12px;padding:12px;min-height:0;flex:1;overflow:auto">
        <aside style="background:white;border:1px solid #cbd5e1;border-radius:14px;display:flex;flex-direction:column;min-height:430px;overflow:hidden"><div style="padding:11px;border-bottom:1px solid #e2e8f0"><input id="gu-buscar" oninput="gestionUsuarios.busqueda=this.value;renderListaGestionUsuarios()" placeholder="Buscar nombre, usuario o correo…" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd5e1;border-radius:8px"><select id="gu-filtro" onchange="gestionUsuarios.filtro=this.value;renderListaGestionUsuarios()" style="width:100%;padding:9px;margin-top:7px;border:1px solid #cbd5e1;border-radius:8px"><option>TODOS</option><option value="ACTIVOS">ACTIVOS</option><option value="BLOQUEADOS">BLOQUEADOS</option></select></div><div id="gu-lista" style="padding:9px;overflow:auto;flex:1"></div></aside>
        <main id="gu-contenido" style="min-height:430px;overflow:auto"></main>
      </div></div>`;
    document.body.appendChild(modal);
}

async function abrirGestionUsuarios() {
    if (typeof usuarioPuedeGestionarUsuarios === 'function' && !usuarioPuedeGestionarUsuarios()) return alert('SOLO EL ADMINISTRADOR PUEDE GESTIONAR USUARIOS.');
    asegurarModalGestionUsuarios();
    document.getElementById('gestion-usuarios-modal').style.display='flex';
    document.getElementById('gu-contenido').innerHTML='<div style="padding:45px;text-align:center;color:#64748b">Cargando usuarios…</div>';
    try { await cargarGestionUsuarios(); }
    catch(error) { document.getElementById('gu-contenido').innerHTML=`<div style="padding:30px;color:#b91c1c;font-weight:800">${guEsc(error.message||error)}</div>`; }
}

function cerrarGestionUsuarios() {
    const modal=document.getElementById('gestion-usuarios-modal'); if(modal) modal.style.display='none';
}

async function cargarGestionUsuarios(seleccionarId='') {
    gestionUsuarios.workspace=await supabaseCargarWorkspaceUsuarios();
    if(seleccionarId) gestionUsuarios.perfilId=seleccionarId;
    if(!guPerfilActual()) gestionUsuarios.perfilId=(gestionUsuarios.workspace.profiles||[])[0]?.id||'';
    const perfiles=gestionUsuarios.workspace.profiles||[], activos=perfiles.filter(p=>p.active).length;
    document.getElementById('gu-subtitulo').textContent=`${perfiles.length} cuenta(s) registrada(s) · ${activos} activa(s)`;
    document.getElementById('gu-resumen').innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"><div style="background:white;border-top:4px solid #7c3aed;border-radius:11px;padding:10px"><small>TOTAL</small><b style="display:block;font-size:18px">${perfiles.length}</b></div><div style="background:white;border-top:4px solid #16a34a;border-radius:11px;padding:10px"><small>ACTIVOS</small><b style="display:block;font-size:18px;color:#15803d">${activos}</b></div><div style="background:white;border-top:4px solid #dc2626;border-radius:11px;padding:10px"><small>BLOQUEADOS / PENDIENTES</small><b style="display:block;font-size:18px;color:#b91c1c">${perfiles.length-activos}</b></div></div>`;
    renderListaGestionUsuarios(); renderDetalleGestionUsuario();
}

function renderListaGestionUsuarios() {
    const q=String(gestionUsuarios.busqueda||'').trim().toUpperCase(), filtro=gestionUsuarios.filtro;
    const perfiles=(gestionUsuarios.workspace?.profiles||[]).filter(p => {
        if(filtro==='ACTIVOS'&&!p.active)return false; if(filtro==='BLOQUEADOS'&&p.active)return false;
        return !q || [p.full_name,p.username,p.email,p.role_code].some(v=>String(v||'').toUpperCase().includes(q));
    });
    document.getElementById('gu-lista').innerHTML=perfiles.map(p=>`<button onclick="seleccionarGestionUsuario('${guEsc(p.id)}')" style="width:100%;text-align:left;border:1px solid ${p.id===gestionUsuarios.perfilId?'#7c3aed':'#e2e8f0'};border-left:5px solid ${p.active?'#16a34a':'#dc2626'};background:${p.id===gestionUsuarios.perfilId?'#f5f3ff':'#f8fafc'};border-radius:9px;padding:9px;margin-bottom:7px;cursor:pointer"><b style="display:block;font-size:10px;color:#0f172a">${guEsc(p.full_name)}</b><span style="font-size:8px;color:#64748b">${guEsc(p.username)} · ${guEsc(p.role_code).toUpperCase()} · ${p.active?'ACTIVO':'BLOQUEADO'}</span>${p.is_current_user?'<span style="display:block;font-size:8px;color:#7c3aed;font-weight:900;margin-top:3px">TU CUENTA</span>':''}</button>`).join('')||'<p style="padding:20px;color:#94a3b8;text-align:center">Sin coincidencias.</p>';
}

function seleccionarGestionUsuario(id) {
    gestionUsuarios.perfilId=id; renderListaGestionUsuarios(); renderDetalleGestionUsuario();
}

function guFecha(valor) {
    if(!valor)return 'NUNCA'; const d=new Date(valor); return Number.isNaN(d.getTime())?guEsc(valor):d.toLocaleString('es-EC');
}

function renderDetalleGestionUsuario() {
    const p=guPerfilActual(), c=document.getElementById('gu-contenido');
    if(!p){c.innerHTML='<div style="padding:45px;text-align:center;color:#94a3b8">Selecciona un usuario.</div>';return;}
    const roles=(gestionUsuarios.workspace.roles||[]).map(r=>`<option value="${guEsc(r.code)}" ${r.code===p.role_code?'selected':''}>${guEsc(r.label)} — ${guEsc(r.description||'')}</option>`).join('');
    const bloqueoPropio=p.is_current_user?'disabled title="La cuenta actual debe conservar el perfil Administrador"':'';
    c.innerHTML=`<section style="background:white;border:1px solid #cbd5e1;border-top:5px solid ${p.active?'#16a34a':'#dc2626'};border-radius:14px;padding:16px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:15px"><div style="flex:1"><h2 style="margin:0;font-size:17px;color:#0f172a">${guEsc(p.full_name)}</h2><span style="font-size:9px;color:#64748b">${guEsc(p.email||'SIN CORREO')}</span></div><b style="border-radius:999px;padding:6px 10px;font-size:9px;background:${p.active?'#dcfce7':'#fee2e2'};color:${p.active?'#15803d':'#b91c1c'}">${p.active?'ACTIVO':'BLOQUEADO'}</b></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px"><label style="font-size:9px;font-weight:900;color:#475569">USUARIO<input id="gu-usuario" value="${guEsc(p.username)}" readonly title="El usuario de acceso debe coincidir con el correo de Authentication" style="width:100%;box-sizing:border-box;padding:9px;margin-top:4px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px"></label><label style="font-size:9px;font-weight:900;color:#475569">NOMBRE COMPLETO<input id="gu-nombre" maxlength="150" value="${guEsc(p.full_name)}" style="width:100%;box-sizing:border-box;padding:9px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px"></label><label style="grid-column:1/-1;font-size:9px;font-weight:900;color:#475569">PERFIL<select id="gu-rol" ${bloqueoPropio} style="width:100%;padding:9px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px">${roles}</select></label><label style="grid-column:1/-1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:10px;font-size:10px;font-weight:900"><input id="gu-activo" type="checkbox" ${p.active?'checked':''} ${bloqueoPropio}> PERMITIR INICIO DE SESIÓN Y USO DEL SISTEMA</label></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px;font-size:9px;color:#64748b"><div><b>CREADA</b><br>${guFecha(p.created_at)}</div><div><b>ÚLTIMO INGRESO</b><br>${guFecha(p.last_sign_in_at)}</div></div>
      ${p.is_current_user?'<p style="background:#fef3c7;color:#92400e;border-radius:8px;padding:9px;font-size:9px;font-weight:800;margin:13px 0 0">Por seguridad no puedes bloquear tu propia cuenta ni retirarle el perfil Administrador.</p>':''}
      <button onclick="guardarGestionUsuario()" style="width:100%;border:0;border-radius:9px;background:#7c3aed;color:white;padding:10px;font-weight:900;margin-top:14px;cursor:pointer">GUARDAR CAMBIOS DE ACCESO</button></section>`;
}

async function guardarGestionUsuario() {
    if(gestionUsuarios.guardando)return;
    const anterior=guPerfilActual(); if(!anterior)return;
    const payload={request_id:guRequestId(),profile_id:anterior.id,username:anterior.username,full_name:document.getElementById('gu-nombre').value.trim(),role_code:document.getElementById('gu-rol').value,active:document.getElementById('gu-activo').checked};
    if(payload.full_name.length<5)return alert('EL NOMBRE COMPLETO DEBE TENER AL MENOS 5 CARACTERES.');
    if(payload.active&&payload.role_code==='sin_asignar')return alert('UNA CUENTA ACTIVA DEBE TENER UN PERFIL AUTORIZADO.');
    const cambioCritico=anterior.active&&!payload.active||anterior.role_code!==payload.role_code;
    if(cambioCritico&&!confirm(`¿CONFIRMAS EL CAMBIO DE ACCESO PARA ${anterior.full_name}?`))return;
    gestionUsuarios.guardando=true;
    try{await supabaseGuardarAccesoUsuario(payload);await cargarGestionUsuarios(anterior.id);alert('ACCESO ACTUALIZADO CORRECTAMENTE.');}
    catch(error){alert('NO SE PUDO ACTUALIZAR EL ACCESO: '+(error.message||error));}
    finally{gestionUsuarios.guardando=false;}
}
