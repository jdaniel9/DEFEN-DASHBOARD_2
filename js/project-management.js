// ================================================================
// project-management.js — Migración 42
// Administración de proyectos, puestos, documentos y supervisores.
// ================================================================

const gestionProyectos = { workspace:null, proyectoId:'', guardando:false, busqueda:'' };

function gpEsc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function gpRequestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r=Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16);
    });
}

function gpHoy() {
    const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function gpTipoContrato(valor) {
    const v=String(valor||'').toUpperCase();
    if (v.includes('ORDEN') || ['ODC','OC'].includes(v.trim())) return 'ORDEN DE COMPRA';
    if (v.includes('CONTRATO') || v.includes('LICIT') || ['CT'].includes(v.trim())) return 'CONTRATO/LICITACION';
    return 'OTRO';
}

function gpProyectoActual() {
    return (gestionProyectos.workspace?.projects||[]).find(p=>p.id===gestionProyectos.proyectoId)||null;
}

function asegurarModalGestionProyectos() {
    if (document.getElementById('gestion-proyectos-modal')) return;
    const modal=document.createElement('div'); modal.id='gestion-proyectos-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:21900;background:rgba(15,23,42,.86);backdrop-filter:blur(5px);padding:14px;align-items:center;justify-content:center';
    modal.innerHTML=`<div style="width:min(1440px,99vw);height:min(900px,96vh);background:#f1f5f9;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 32px 100px rgba(0,0,0,.55)">
      <div style="padding:14px 18px;background:#0f172a;color:white;display:flex;align-items:center;gap:12px"><div style="flex:1"><b style="font-size:15px">🏢 Administración de proyectos</b><div id="gp-subtitulo" style="font-size:10px;color:#67e8f9;margin-top:3px">Cargando catálogo…</div></div><button onclick="cerrarGestionProyectos()" style="border:0;border-radius:9px;background:#334155;color:white;padding:8px 12px;font-weight:800;cursor:pointer">✕ Cerrar</button></div>
      <div style="display:grid;grid-template-columns:320px minmax(650px,1fr);gap:12px;padding:12px;min-height:0;flex:1;overflow:auto">
        <aside style="background:white;border:1px solid #cbd5e1;border-radius:14px;display:flex;flex-direction:column;min-height:500px;overflow:hidden"><div style="padding:12px;border-bottom:1px solid #e2e8f0"><button onclick="abrirFormularioProyecto()" style="width:100%;border:0;border-radius:9px;background:#0891b2;color:white;padding:9px;font-weight:900;cursor:pointer">＋ NUEVO PROYECTO</button><input id="gp-buscar" oninput="gestionProyectos.busqueda=this.value;renderListaGestionProyectos()" placeholder="Buscar proyecto o provincia…" style="width:100%;box-sizing:border-box;margin-top:8px;padding:8px;border:1px solid #cbd5e1;border-radius:8px"></div><div id="gp-lista" style="padding:9px;overflow:auto;flex:1"></div></aside>
        <main id="gp-contenido" style="min-height:500px;overflow:auto"></main>
      </div></div>`;
    document.body.appendChild(modal);
}

async function abrirGestionProyectos() {
    if (typeof usuarioPuedeGestionarProyectos==='function' && !usuarioPuedeGestionarProyectos()) return alert('NO TIENES PERMISO PARA ADMINISTRAR PROYECTOS.');
    asegurarModalGestionProyectos(); document.getElementById('gestion-proyectos-modal').style.display='flex';
    document.getElementById('gp-contenido').innerHTML='<div style="padding:40px;text-align:center;color:#64748b">Cargando información…</div>';
    try { await cargarGestionProyectos(); }
    catch(error){document.getElementById('gp-contenido').innerHTML=`<div style="padding:30px;color:#b91c1c;font-weight:800">${gpEsc(error.message||error)}</div>`;}
}

function cerrarGestionProyectos(){document.getElementById('gestion-proyectos-modal').style.display='none';}

async function cargarGestionProyectos(seleccionarId='') {
    gestionProyectos.workspace=await supabaseCargarWorkspaceProyectos();
    if(seleccionarId)gestionProyectos.proyectoId=seleccionarId;
    if(!gpProyectoActual())gestionProyectos.proyectoId=(gestionProyectos.workspace.projects||[]).find(p=>p.status==='ACTIVE')?.id||'';
    document.getElementById('gp-subtitulo').textContent=`${(gestionProyectos.workspace.projects||[]).filter(p=>p.status==='ACTIVE').length} proyecto(s) activo(s)`;
    renderListaGestionProyectos(); renderDetalleGestionProyecto();
}

function renderListaGestionProyectos() {
    const q=String(gestionProyectos.busqueda||'').trim().toUpperCase();
    const proyectos=(gestionProyectos.workspace?.projects||[]).filter(p=>!q||[p.name,p.province,p.contract_type].some(v=>String(v||'').toUpperCase().includes(q)));
    document.getElementById('gp-lista').innerHTML=proyectos.map(p=>`<button onclick="seleccionarGestionProyecto('${gpEsc(p.id)}')" style="width:100%;text-align:left;border:1px solid ${p.id===gestionProyectos.proyectoId?'#0891b2':'#e2e8f0'};border-left:5px solid ${p.status==='ACTIVE'?'#16a34a':'#94a3b8'};background:${p.id===gestionProyectos.proyectoId?'#ecfeff':'#f8fafc'};border-radius:9px;padding:9px;margin-bottom:7px;cursor:pointer"><b style="display:block;font-size:10px;color:#0f172a">${gpEsc(p.name)}</b><span style="font-size:8px;color:#64748b">${gpEsc(p.province)} · ${gpEsc(p.contract_type||'SIN TIPO')} · ${p.status==='ACTIVE'?'ACTIVO':'ARCHIVADO'}</span></button>`).join('')||'<p style="padding:20px;color:#94a3b8;text-align:center">Sin coincidencias.</p>';
}

function seleccionarGestionProyecto(id){gestionProyectos.proyectoId=id;renderListaGestionProyectos();renderDetalleGestionProyecto();}

function gpCard(titulo,accion,contenido,color='#0891b2') {
    return `<section style="background:white;border:1px solid #cbd5e1;border-top:4px solid ${color};border-radius:13px;padding:13px;margin-bottom:11px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><b style="font-size:12px;color:#0f172a">${titulo}</b><div style="margin-left:auto">${accion||''}</div></div>${contenido}</section>`;
}

function renderDetalleGestionProyecto() {
    const p=gpProyectoActual(), c=document.getElementById('gp-contenido');
    if(!p){c.innerHTML='<div style="padding:45px;text-align:center;color:#94a3b8">Crea o selecciona un proyecto.</div>';return;}
    const activo=p.status==='ACTIVE';
    const documentos=(p.documents||[]).filter(d=>d.active);
    const supervisores=(p.supervisors||[]).filter(s=>s.status==='ACTIVE');
    const puestos=(p.posts||[]);
    const datos=`<div style="display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;font-size:10px"><div><small>PROVINCIA</small><b style="display:block">${gpEsc(p.province)}</b></div><div><small>CONTRATO</small><b style="display:block">${gpEsc(p.contract_type||'—')}</b></div><div><small>FINALIZACIÓN</small><b style="display:block">${gpEsc(p.planned_end_date||'—')}</b></div><div><small>ESTADO</small><b style="display:block;color:${activo?'#15803d':'#64748b'}">${gpEsc(p.status)}</b></div></div>`;
    const listaPuestos=puestos.map(po=>`<div style="border:1px solid #e2e8f0;border-radius:9px;padding:9px;margin-bottom:6px;display:flex;align-items:center;gap:8px;background:${po.active?'#f8fafc':'#f1f5f9'}"><div style="flex:1"><b style="font-size:10px">${gpEsc(po.name)}</b><div style="font-size:8px;color:#64748b">${gpEsc(po.service_type||'SIN TIPO')} · ${gpEsc(po.shift_label||'SIN TURNO')} · ${po.armed?'ARMADO':'SIN ARMA'} · ${po.has_radio?'CON RADIO':'SIN RADIO'} · ${po.active?'ACTIVO':'INACTIVO'}</div></div>${activo?`<button onclick="abrirFormularioPuesto('${gpEsc(po.id)}')" style="border:0;border-radius:7px;background:#e0f2fe;color:#0369a1;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer">EDITAR</button>`:''}</div>`).join('')||'<p style="font-size:10px;color:#94a3b8">No hay puestos registrados.</p>';
    const listaSup=supervisores.map(s=>`<div style="display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:9px;padding:8px;margin-bottom:6px"><div style="flex:1"><b style="font-size:10px">${gpEsc(s.full_name)}</b><div style="font-size:8px;color:#64748b">CI ${gpEsc(s.national_id||'—')} · Desde ${gpEsc(s.started_on||'—')}</div></div>${activo?`<button onclick="retirarSupervisorProyecto('${gpEsc(s.assignment_id)}')" style="border:0;border-radius:7px;background:#fee2e2;color:#b91c1c;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer">RETIRAR</button>`:''}</div>`).join('')||'<p style="font-size:10px;color:#94a3b8">Sin supervisores activos.</p>';
    const listaDocs=documentos.map(d=>`<div style="display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:9px;padding:8px;margin-bottom:6px"><div style="flex:1"><b style="font-size:10px">${gpEsc(d.document_type)} · ${gpEsc(d.file_name||'DOCUMENTO')}</b><div style="font-size:8px;color:#64748b">${gpEsc(d.notes||'Sin observación')}</div></div><button onclick="abrirDocumentoProyecto('${encodeURIComponent(d.storage_path?'private:'+d.storage_path:(d.document_url||''))}')" style="border:0;border-radius:7px;background:#ecfdf5;color:#047857;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer">VER</button></div>`).join('')||'<p style="font-size:10px;color:#94a3b8">Sin documentos activos.</p>';
    c.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px"><div style="flex:1"><h2 style="margin:0;font-size:17px;color:#0f172a">${gpEsc(p.name)}</h2><span style="font-size:9px;color:#64748b">${gpEsc(p.province)}</span></div>${activo?`<button onclick="abrirFormularioProyecto('${gpEsc(p.id)}')" style="border:0;border-radius:9px;background:#0f172a;color:white;padding:8px 11px;font-weight:900;cursor:pointer">EDITAR PROYECTO</button>`:''}</div>${gpCard('DATOS GENERALES','',datos)}${gpCard('PUESTOS',activo?'<button onclick="abrirFormularioPuesto()" style="border:0;border-radius:7px;background:#0891b2;color:white;padding:6px 9px;font-size:9px;font-weight:900;cursor:pointer">＋ PUESTO</button>':'',listaPuestos,'#2563eb')}${gpCard('SUPERVISORES',activo?'<button onclick="abrirFormularioSupervisor()" style="border:0;border-radius:7px;background:#7c3aed;color:white;padding:6px 9px;font-size:9px;font-weight:900;cursor:pointer">＋ ASIGNAR</button>':'',listaSup,'#7c3aed')}${gpCard('DOCUMENTOS PRIVADOS',activo?'<button onclick="abrirFormularioDocumentoProyecto()" style="border:0;border-radius:7px;background:#15803d;color:white;padding:6px 9px;font-size:9px;font-weight:900;cursor:pointer">＋ DOCUMENTO</button>':'',listaDocs,'#15803d')}<div id="gp-editor"></div>`;
}

function abrirFormularioProyecto(id='') {
    const p=(gestionProyectos.workspace?.projects||[]).find(x=>x.id===id)||null;
    const provincias=(gestionProyectos.workspace?.provinces||[]).map(v=>`<option value="${v.id}" ${p?.province_id==v.id?'selected':''}>${gpEsc(v.name)}</option>`).join('');
    const tipo=gpTipoContrato(p?.contract_type);
    document.getElementById('gp-contenido').innerHTML=gpCard(p?'EDITAR PROYECTO':'NUEVO PROYECTO','',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>PROVINCIA<select id="gp-proyecto-provincia" style="width:100%;padding:9px;margin-top:4px">${provincias}</select></label><label>TIPO DE CONTRATO<select id="gp-proyecto-tipo" style="width:100%;padding:9px;margin-top:4px"><option ${tipo==='ORDEN DE COMPRA'?'selected':''}>ORDEN DE COMPRA</option><option value="CONTRATO/LICITACION" ${tipo==='CONTRATO/LICITACION'?'selected':''}>CONTRATO/LICITACIÓN</option><option ${tipo==='OTRO'?'selected':''}>OTRO</option></select></label><label style="grid-column:1/-1">NOMBRE<input id="gp-proyecto-nombre" maxlength="180" value="${gpEsc(p?.name||'')}" style="width:100%;box-sizing:border-box;padding:9px;margin-top:4px"></label><label>FECHA PREVISTA DE FINALIZACIÓN<input id="gp-proyecto-fin" type="date" value="${gpEsc(p?.planned_end_date||'')}" style="width:100%;padding:9px;margin-top:4px"></label></div><div style="display:flex;gap:8px;margin-top:14px"><button onclick="guardarProyectoGestion('${gpEsc(p?.id||'')}')" style="flex:2;border:0;border-radius:9px;background:#0891b2;color:white;padding:10px;font-weight:900;cursor:pointer">GUARDAR</button><button onclick="renderDetalleGestionProyecto()" style="flex:1;border:1px solid #cbd5e1;border-radius:9px;background:white;padding:10px;font-weight:900;cursor:pointer">CANCELAR</button></div>`);
}

async function guardarProyectoGestion(id='') {
    const payload={request_id:gpRequestId(),project_id:id||null,province_id:document.getElementById('gp-proyecto-provincia').value,name:document.getElementById('gp-proyecto-nombre').value.trim(),contract_type:document.getElementById('gp-proyecto-tipo').value,planned_end_date:document.getElementById('gp-proyecto-fin').value};
    if(!payload.name||!payload.planned_end_date)return alert('COMPLETA EL NOMBRE Y LA FECHA DE FINALIZACIÓN.');
    await gpEjecutar(async()=>{const r=await supabaseGuardarProyecto(payload);await Promise.all([cargarGestionProyectos(r.project_id),cargarDatos()]);alert('PROYECTO GUARDADO CORRECTAMENTE.');});
}

function abrirFormularioPuesto(id='') {
    const p=gpProyectoActual(), po=(p.posts||[]).find(x=>x.id===id)||null, editor=document.getElementById('gp-editor');
    editor.innerHTML=gpCard(po?'EDITAR PUESTO':'NUEVO PUESTO','',`<div style="display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:9px"><label>NOMBRE<input id="gp-puesto-nombre" value="${gpEsc(po?.name||'')}" style="width:100%;box-sizing:border-box;padding:8px"></label><label>TIPO DE SERVICIO<input id="gp-puesto-tipo" value="${gpEsc(po?.service_type||'')}" placeholder="12 HORAS / 24 HORAS" style="width:100%;box-sizing:border-box;padding:8px"></label><label>TURNO<input id="gp-puesto-turno" value="${gpEsc(po?.shift_label||'')}" placeholder="D/N" style="width:100%;box-sizing:border-box;padding:8px"></label><label>DÍAS<input id="gp-puesto-dias" value="${gpEsc(po?.service_days||'')}" placeholder="LUNES A DOMINGO" style="width:100%;box-sizing:border-box;padding:8px"></label><label>LATITUD<input id="gp-puesto-lat" type="number" step="any" value="${gpEsc(po?.latitude??'')}" style="width:100%;box-sizing:border-box;padding:8px"></label><label>LONGITUD<input id="gp-puesto-lng" type="number" step="any" value="${gpEsc(po?.longitude??'')}" style="width:100%;box-sizing:border-box;padding:8px"></label><label><input id="gp-puesto-armado" type="checkbox" ${po?.armed?'checked':''}> PUESTO ARMADO</label><label><input id="gp-puesto-radio" type="checkbox" ${po?.has_radio?'checked':''}> REQUIERE RADIO</label>${po?`<label><input id="gp-puesto-activo" type="checkbox" ${po.active?'checked':''}> PUESTO ACTIVO</label>`:''}<label style="grid-column:1/-1">OBSERVACIÓN<textarea id="gp-puesto-obs" rows="2" style="width:100%;box-sizing:border-box;padding:8px">${gpEsc(po?.observation||'')}</textarea></label></div><div style="display:flex;gap:8px;margin-top:10px"><button onclick="guardarPuestoGestion('${gpEsc(po?.id||'')}')" style="flex:2;border:0;border-radius:8px;background:#2563eb;color:white;padding:9px;font-weight:900">GUARDAR</button><button onclick="document.getElementById('gp-editor').innerHTML=''" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;background:white">CANCELAR</button></div>`,'#2563eb');
    editor.scrollIntoView({behavior:'smooth',block:'start'});
}

async function guardarPuestoGestion(id='') {
    const payload={request_id:gpRequestId(),project_id:gestionProyectos.proyectoId,post_id:id||null,name:document.getElementById('gp-puesto-nombre').value.trim(),service_type:document.getElementById('gp-puesto-tipo').value.trim(),shift_label:document.getElementById('gp-puesto-turno').value.trim(),service_days:document.getElementById('gp-puesto-dias').value.trim(),latitude:document.getElementById('gp-puesto-lat').value||null,longitude:document.getElementById('gp-puesto-lng').value||null,armed:document.getElementById('gp-puesto-armado').checked,has_radio:document.getElementById('gp-puesto-radio').checked,active:id?document.getElementById('gp-puesto-activo').checked:true,observation:document.getElementById('gp-puesto-obs').value.trim()};
    if(!payload.name)return alert('ESCRIBE EL NOMBRE DEL PUESTO.');
    await gpEjecutar(async()=>{await supabaseGuardarPuestoProyecto(payload);await Promise.all([cargarGestionProyectos(gestionProyectos.proyectoId),cargarDatos()]);alert('PUESTO GUARDADO CORRECTAMENTE.');});
}

function abrirFormularioSupervisor() {
    const opciones=(gestionProyectos.workspace?.personnel||[]).map(pe=>`<option value="${gpEsc(pe.id)}">${gpEsc(pe.full_name)} · ${gpEsc(pe.national_id||'SIN CÉDULA')}</option>`).join('');
    const editor=document.getElementById('gp-editor'); editor.innerHTML=gpCard('ASIGNAR SUPERVISOR','',`<select id="gp-supervisor-persona" style="width:100%;padding:9px"><option value="">SELECCIONAR…</option>${opciones}</select><input id="gp-supervisor-fecha" type="date" max="${gpHoy()}" value="${gpHoy()}" style="width:100%;box-sizing:border-box;padding:9px;margin-top:8px"><textarea id="gp-supervisor-nota" placeholder="Observación opcional" style="width:100%;box-sizing:border-box;padding:9px;margin-top:8px"></textarea><button onclick="asignarSupervisorProyecto()" style="width:100%;border:0;border-radius:8px;background:#7c3aed;color:white;padding:9px;font-weight:900;margin-top:8px">ASIGNAR</button>`,'#7c3aed'); editor.scrollIntoView({behavior:'smooth'});
}

async function asignarSupervisorProyecto() {
    const persona=document.getElementById('gp-supervisor-persona').value,fecha=document.getElementById('gp-supervisor-fecha').value;
    if(!persona||!fecha)return alert('SELECCIONA EL SUPERVISOR Y LA FECHA.');
    await gpEjecutar(async()=>{await supabaseCambiarSupervisorProyecto({request_id:gpRequestId(),project_id:gestionProyectos.proyectoId,personnel_id:persona,action:'ASSIGN',effective_date:fecha,notes:document.getElementById('gp-supervisor-nota').value.trim()||null});await Promise.all([cargarGestionProyectos(gestionProyectos.proyectoId),cargarDatos()]);alert('SUPERVISOR ASIGNADO.');});
}

async function retirarSupervisorProyecto(assignmentId) {
    const fecha=prompt('Fecha efectiva de salida (AAAA-MM-DD):',gpHoy()); if(fecha===null)return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha))return alert('LA FECHA NO ES VÁLIDA.');
    if(!confirm('¿CONFIRMAS EL RETIRO DEL SUPERVISOR?'))return;
    await gpEjecutar(async()=>{await supabaseCambiarSupervisorProyecto({request_id:gpRequestId(),project_id:gestionProyectos.proyectoId,assignment_id:assignmentId,action:'REMOVE',effective_date:fecha});await Promise.all([cargarGestionProyectos(gestionProyectos.proyectoId),cargarDatos()]);alert('SUPERVISOR RETIRADO.');});
}

function abrirFormularioDocumentoProyecto() {
    const editor=document.getElementById('gp-editor'); editor.innerHTML=gpCard('REGISTRAR DOCUMENTO PRIVADO','',`<select id="gp-doc-tipo" style="width:100%;padding:9px"><option value="CONTRATO">CONTRATO / ORDEN DE COMPRA</option><option value="KARDEX">KARDEX</option><option value="OTRO">OTRO</option></select><input id="gp-doc-archivo" type="file" accept="application/pdf,.pdf,.xls,.xlsx" style="width:100%;box-sizing:border-box;padding:9px;margin-top:8px"><textarea id="gp-doc-nota" maxlength="300" placeholder="Observación opcional" style="width:100%;box-sizing:border-box;padding:9px;margin-top:8px"></textarea><button onclick="guardarDocumentoProyecto()" style="width:100%;border:0;border-radius:8px;background:#15803d;color:white;padding:9px;font-weight:900;margin-top:8px">SUBIR Y REGISTRAR</button>`,'#15803d'); editor.scrollIntoView({behavior:'smooth'});
}

async function guardarDocumentoProyecto() {
    const archivo=document.getElementById('gp-doc-archivo')?.files?.[0],tipo=document.getElementById('gp-doc-tipo').value; if(!archivo)return alert('SELECCIONA UN ARCHIVO PDF, XLS O XLSX.');
    let ruta='';
    await gpEjecutar(async()=>{try{ruta=await supabaseSubirDocumentoProyecto(archivo,gestionProyectos.proyectoId,tipo);await supabaseRegistrarDocumentoProyecto({request_id:gpRequestId(),project_id:gestionProyectos.proyectoId,document_type:tipo,storage_path:ruta,file_name:archivo.name,notes:document.getElementById('gp-doc-nota').value.trim()||null});ruta='';await Promise.all([cargarGestionProyectos(gestionProyectos.proyectoId),cargarDatos()]);alert('DOCUMENTO REGISTRADO EN ALMACENAMIENTO PRIVADO.');}catch(error){if(ruta)try{await supabaseEliminarDocumentoProyecto(ruta);}catch(_){}throw error;}});
}

async function abrirDocumentoProyecto(valorCodificado) {
    const valor=decodeURIComponent(String(valorCodificado||'')); if(!valor)return alert('EL DOCUMENTO NO ESTÁ DISPONIBLE.');
    try{const url=valor.startsWith('private:')?await supabaseUrlFirmadaDocumentoProyecto(valor.slice(8),300):valor;window.open(url,'_blank','noopener');}
    catch(error){alert('NO SE PUDO ABRIR EL DOCUMENTO: '+(error.message||error));}
}

function renderBotonDocumentoProyecto(url,etiqueta,compacto=false) {
    if(!url)return '';
    const color=etiqueta==='KARDEX'?'background:#15803d':'background:#334155';
    const padding=compacto?'padding:2px 6px;font-size:8px':'padding:4px 8px;font-size:9px';
    return `<button onclick="event.stopPropagation();abrirDocumentoProyecto('${encodeURIComponent(url)}')" style="border:0;border-radius:999px;${color};color:white;${padding};font-weight:900;cursor:pointer">${etiqueta==='KARDEX'?'📊':'⬇️'} ${gpEsc(etiqueta)}</button>`;
}

async function gpEjecutar(accion) {
    if(gestionProyectos.guardando)return; gestionProyectos.guardando=true;
    try{await accion();}catch(error){alert('NO SE PUDO COMPLETAR LA OPERACIÓN: '+(error.message||error));}
    finally{gestionProyectos.guardando=false;}
}
