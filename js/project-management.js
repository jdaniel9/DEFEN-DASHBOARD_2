// ================================================================
// project-management.js — Migración 66
// Alta guiada de proyectos, puestos, documentos, factor y nómina inicial.
// ================================================================

const gestionProyectos = { workspace:null, proyectoId:'', guardando:false, busqueda:'', importacion:null };

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

function gpEsGerencia() {
    return typeof rolActual === 'function' && rolActual() === 'admin';
}

function gpNumero(valor) {
    const numero=Number(valor); return Number.isFinite(numero)?numero:0;
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
    const estadoAlta=p.onboarding_status||'CONFIRMED',s=p.staffing||{};
    const requerido=gpNumero(s.required_total??p.required_guard_count),fijosReq=gpNumero(s.required_fixed),movilesReq=gpNumero(s.required_mobile??p.required_mobile_guard_count);
    const fijosAsig=gpNumero(s.assigned_fixed),movilesAsig=gpNumero(s.assigned_mobile),asignados=fijosAsig+movilesAsig;
    const cuadraFactor=fijosReq+movilesReq===requerido,completo=asignados===requerido;
    const datos=`<div style="display:grid;grid-template-columns:repeat(4,minmax(135px,1fr));gap:9px;font-size:10px"><div><small>PROVINCIA</small><b style="display:block">${gpEsc(p.province)}</b></div><div><small>UBICACIÓN</small><b style="display:block">${gpEsc(p.service_location||'—')}</b></div><div><small>CONTRATO</small><b style="display:block">${gpEsc(p.contract_type||'—')}</b></div><div><small>DURACIÓN</small><b style="display:block">${gpEsc(p.duration_months||'—')} MES(ES)</b></div><div><small>INGRESO / INICIO</small><b style="display:block">${gpEsc(p.start_date||'—')}</b></div><div><small>FINALIZACIÓN</small><b style="display:block">${gpEsc(p.planned_end_date||'—')}</b></div><div><small>PUESTOS</small><b style="display:block">${puestos.filter(x=>x.active).length} / ${gpNumero(p.required_post_count)}</b></div><div><small>SUPERVISOR</small><b style="display:block">${p.requires_supervisor?'REQUERIDO':'NO REQUERIDO'}</b></div><div><small>ARMAMENTO</small><b style="display:block">${p.requires_weapons?'PREVISTO (SIN ASIGNAR)':'NO PREVISTO'}</b></div></div>`;
    const verificador=`<div style="display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:8px;text-align:center"><div><small>FACTOR AUTORIZADO</small><b style="display:block;font-size:18px">${requerido}</b></div><div><small>CUPOS FIJOS</small><b style="display:block;font-size:18px">${fijosReq}</b></div><div><small>SACAFRANCOS</small><b style="display:block;font-size:18px">${movilesReq}</b></div><div><small>PERSONAL CARGADO</small><b style="display:block;font-size:18px;color:${completo?'#15803d':'#b45309'}">${asignados}</b></div><div><small>VACANTES</small><b style="display:block;font-size:18px;color:${Math.max(requerido-asignados,0)?'#b91c1c':'#15803d'}">${Math.max(requerido-asignados,0)}</b></div></div><p style="margin:9px 0 0;padding:8px;border-radius:8px;background:${cuadraFactor?'#ecfdf5':'#fff7ed'};color:${cuadraFactor?'#166534':'#9a3412'};font-size:9px;font-weight:800">${cuadraFactor?'✓ LOS CUPOS DE PUESTOS + SACAFRANCOS CUADRAN CON EL FACTOR.':'⚠ LOS CUPOS DE PUESTOS + SACAFRANCOS NO COINCIDEN CON EL FACTOR AUTORIZADO.'}</p>`;
    const listaPuestos=puestos.map(po=>`<div style="border:1px solid #e2e8f0;border-radius:9px;padding:9px;margin-bottom:6px;display:flex;align-items:center;gap:8px;background:${po.active?'#f8fafc':'#f1f5f9'}"><div style="flex:1"><b style="font-size:10px">${gpEsc(po.name)}</b><div style="font-size:8px;color:#64748b">${gpEsc(po.service_type||'SIN HORARIO')} · ${gpEsc(po.shift_label||'SIN TURNO')} · CUPO ${gpNumero(po.required_agent_count)} · ASIGNADOS ${gpNumero(po.assigned_agent_count)} · ${po.armed?'ARMADO':'SIN ARMA'} · ${po.active?'ACTIVO':'INACTIVO'}</div></div>${activo?`<button onclick="abrirFormularioPuesto('${gpEsc(po.id)}')" style="border:0;border-radius:7px;background:#e0f2fe;color:#0369a1;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer">EDITAR</button>`:''}</div>`).join('')||'<p style="font-size:10px;color:#94a3b8">No hay puestos registrados.</p>';
    const listaSup=supervisores.map(s=>`<div style="display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:9px;padding:8px;margin-bottom:6px"><div style="flex:1"><b style="font-size:10px">${gpEsc(s.full_name)}</b><div style="font-size:8px;color:#64748b">CI ${gpEsc(s.national_id||'—')} · 📞 ${gpEsc(s.mobile_phone||'SIN TELÉFONO')} · Desde ${gpEsc(s.started_on||'—')}</div></div>${activo?`<button onclick="abrirFormularioSupervisor('${gpEsc(s.personnel_id)}')" style="border:0;border-radius:7px;background:#ede9fe;color:#6d28d9;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer">EDITAR</button><button onclick="retirarSupervisorProyecto('${gpEsc(s.assignment_id)}')" style="border:0;border-radius:7px;background:#fee2e2;color:#b91c1c;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer">RETIRAR</button>`:''}</div>`).join('')||'<p style="font-size:10px;color:#94a3b8">Sin supervisores activos.</p>';
    const listaDocs=documentos.map(d=>`<div style="display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:9px;padding:8px;margin-bottom:6px"><div style="flex:1"><b style="font-size:10px">${gpEsc(d.document_type)} · ${gpEsc(d.file_name||'DOCUMENTO')}</b><div style="font-size:8px;color:#64748b">${gpEsc(d.notes||'Sin observación')}</div></div><button onclick="abrirDocumentoProyecto('${encodeURIComponent(d.storage_path?'private:'+d.storage_path:(d.document_url||''))}')" style="border:0;border-radius:7px;background:#ecfdf5;color:#047857;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer">VER</button></div>`).join('')||'<p style="font-size:10px;color:#94a3b8">Sin documentos activos.</p>';
    const accionesAlta=activo?`<div style="display:flex;gap:6px;flex-wrap:wrap"><button onclick="descargarPlantillaPersonalProyecto()" style="border:0;border-radius:8px;background:#15803d;color:white;padding:8px 10px;font-weight:900;cursor:pointer">⬇ PLANTILLA</button><button onclick="abrirImportadorPersonalProyecto()" style="border:0;border-radius:8px;background:#7c3aed;color:white;padding:8px 10px;font-weight:900;cursor:pointer">⇧ CARGAR PERSONAL</button>${estadoAlta==='DRAFT'?`<button onclick="confirmarAltaProyecto()" style="border:0;border-radius:8px;background:#d97706;color:white;padding:8px 10px;font-weight:900;cursor:pointer">✓ CONFIRMAR PROYECTO</button>`:''}<button onclick="abrirFormularioProyecto('${gpEsc(p.id)}')" style="border:0;border-radius:9px;background:#0f172a;color:white;padding:8px 11px;font-weight:900;cursor:pointer">EDITAR</button></div>`:'';
    c.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px"><div style="flex:1"><h2 style="margin:0;font-size:17px;color:#0f172a">${gpEsc(p.name)}</h2><span style="font-size:9px;color:#64748b">${gpEsc(p.province)} · ALTA ${gpEsc(estadoAlta)}</span></div>${accionesAlta}</div>${gpCard('DATOS GENERALES','',datos)}${gpCard('VERIFICADOR DE PERSONAL','',verificador,completo?'#16a34a':'#f59e0b')}${gpCard('PUESTOS',activo?'<button onclick="abrirFormularioPuesto()" style="border:0;border-radius:7px;background:#0891b2;color:white;padding:6px 9px;font-size:9px;font-weight:900;cursor:pointer">＋ PUESTO</button>':'',listaPuestos,'#2563eb')}${gpCard('SUPERVISORES',activo?'<button onclick="abrirFormularioSupervisor()" style="border:0;border-radius:7px;background:#7c3aed;color:white;padding:6px 9px;font-size:9px;font-weight:900;cursor:pointer">＋ ASIGNAR</button>':'',listaSup,'#7c3aed')}${gpCard('DOCUMENTOS PRIVADOS',activo?'<button onclick="abrirFormularioDocumentoProyecto()" style="border:0;border-radius:7px;background:#15803d;color:white;padding:6px 9px;font-size:9px;font-weight:900;cursor:pointer">＋ DOCUMENTO</button>':'',listaDocs,'#15803d')}<div id="gp-editor"></div>`;
}

function abrirFormularioProyecto(id='') {
    const p=(gestionProyectos.workspace?.projects||[]).find(x=>x.id===id)||null;
    const provincias=(gestionProyectos.workspace?.provinces||[]).map(v=>`<option value="${v.id}" ${p?.province_id==v.id?'selected':''}>${gpEsc(v.name)}</option>`).join('');
    const tipo=gpTipoContrato(p?.contract_type);
    const factorBloqueado=Boolean(p&&p.onboarding_status==='CONFIRMED'&&!gpEsGerencia());
    document.getElementById('gp-contenido').innerHTML=gpCard(p?'EDITAR PROYECTO':'NUEVO PROYECTO','',`
      <p style="font-size:10px;color:#475569;background:#eff6ff;padding:9px;border-radius:8px">Complete los datos iniciales. Mientras el proyecto esté en BORRADOR, Operaciones puede ajustar el factor. Después de confirmarlo, cualquier aumento o reducción queda reservado a Gerencia.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label>PROVINCIA<select id="gp-proyecto-provincia" style="width:100%;padding:9px;margin-top:4px">${provincias}</select></label>
        <label>TIPO DE CONTRATO<select id="gp-proyecto-tipo" style="width:100%;padding:9px;margin-top:4px"><option ${tipo==='ORDEN DE COMPRA'?'selected':''}>ORDEN DE COMPRA</option><option value="CONTRATO/LICITACION" ${tipo==='CONTRATO/LICITACION'?'selected':''}>CONTRATO/LICITACIÓN</option><option ${tipo==='OTRO'?'selected':''}>OTRO</option></select></label>
        <label style="grid-column:1/-1">NOMBRE DEL PROYECTO<input id="gp-proyecto-nombre" maxlength="180" value="${gpEsc(p?.name||'')}" style="width:100%;box-sizing:border-box;padding:9px;margin-top:4px"></label>
        <label style="grid-column:1/-1">UBICACIÓN / DIRECCIÓN<input id="gp-proyecto-ubicacion" maxlength="240" value="${gpEsc(p?.service_location||'')}" placeholder="CIUDAD, DIRECCIÓN O REFERENCIA" style="width:100%;box-sizing:border-box;padding:9px;margin-top:4px"></label>
        <label>FACTOR HUMANO TOTAL<input id="gp-proyecto-dotacion" type="number" min="0" max="9999" step="1" value="${gpEsc(p?.required_guard_count??0)}" ${factorBloqueado?'disabled':''} style="width:100%;box-sizing:border-box;padding:9px;margin-top:4px"><small style="display:block;color:#64748b;margin-top:4px">Personal fijo + sacafrancos.</small></label>
        <label>SACAFRANCOS REQUERIDOS<input id="gp-proyecto-sacafrancos" type="number" min="0" max="9999" step="1" value="${gpEsc(p?.required_mobile_guard_count??0)}" ${factorBloqueado?'disabled':''} style="width:100%;box-sizing:border-box;padding:9px;margin-top:4px"></label>
        <label>CANTIDAD DE PUESTOS<input id="gp-proyecto-puestos" type="number" min="1" max="9999" step="1" value="${gpEsc(p?.required_post_count??1)}" ${factorBloqueado?'disabled':''} style="width:100%;box-sizing:border-box;padding:9px;margin-top:4px"></label>
        <label>FECHA DE INGRESO / INICIO<input id="gp-proyecto-inicio" type="date" value="${gpEsc(p?.start_date||'')}" style="width:100%;padding:9px;margin-top:4px"></label>
        <label>FECHA PREVISTA DE FINALIZACIÓN<input id="gp-proyecto-fin" type="date" value="${gpEsc(p?.planned_end_date||'')}" style="width:100%;padding:9px;margin-top:4px"></label>
        <label><input id="gp-proyecto-supervisor" type="checkbox" ${p?.requires_supervisor?'checked':''}> REQUIERE SUPERVISOR</label>
        <label><input id="gp-proyecto-armas" type="checkbox" ${p?.requires_weapons?'checked':''}> CONTEMPLA ARMAMENTO</label>
        ${p?.onboarding_status==='CONFIRMED'&&gpEsGerencia()?'<label style="grid-column:1/-1">MOTIVO DEL CAMBIO DE FACTOR<input id="gp-proyecto-motivo-factor" maxlength="240" placeholder="OBLIGATORIO SI AUMENTA O REDUCE EL FACTOR" style="width:100%;box-sizing:border-box;padding:9px;margin-top:4px"></label>':''}
      </div><div style="display:flex;gap:8px;margin-top:14px"><button onclick="guardarProyectoGestion('${gpEsc(p?.id||'')}')" style="flex:2;border:0;border-radius:9px;background:#0891b2;color:white;padding:10px;font-weight:900;cursor:pointer">GUARDAR Y CONTINUAR</button><button onclick="renderDetalleGestionProyecto()" style="flex:1;border:1px solid #cbd5e1;border-radius:9px;background:white;padding:10px;font-weight:900;cursor:pointer">CANCELAR</button></div>`);
}

async function guardarProyectoGestion(id='') {
    const actual=(gestionProyectos.workspace?.projects||[]).find(x=>x.id===id)||null;
    const valor=(idElemento,respaldo=0)=>document.getElementById(idElemento)?.disabled?respaldo:Number(document.getElementById(idElemento)?.value);
    const payload={request_id:gpRequestId(),project_id:id||null,province_id:document.getElementById('gp-proyecto-provincia').value,name:document.getElementById('gp-proyecto-nombre').value.trim(),contract_type:document.getElementById('gp-proyecto-tipo').value,service_location:document.getElementById('gp-proyecto-ubicacion').value.trim(),required_guard_count:valor('gp-proyecto-dotacion',actual?.required_guard_count),required_mobile_guard_count:valor('gp-proyecto-sacafrancos',actual?.required_mobile_guard_count),required_post_count:valor('gp-proyecto-puestos',actual?.required_post_count),requires_supervisor:document.getElementById('gp-proyecto-supervisor').checked,requires_weapons:document.getElementById('gp-proyecto-armas').checked,start_date:document.getElementById('gp-proyecto-inicio').value,planned_end_date:document.getElementById('gp-proyecto-fin').value,staffing_reason:document.getElementById('gp-proyecto-motivo-factor')?.value.trim()||''};
    if(!payload.name||!payload.service_location||!payload.start_date||!payload.planned_end_date||!Number.isInteger(payload.required_guard_count)||payload.required_guard_count<0||payload.required_mobile_guard_count>payload.required_guard_count||!Number.isInteger(payload.required_post_count)||payload.required_post_count<1)return alert('COMPLETA NOMBRE, UBICACIÓN, PUESTOS, FECHAS Y UN FACTOR HUMANO VÁLIDO.');
    if(payload.planned_end_date<payload.start_date)return alert('LA FECHA DE FINALIZACIÓN NO PUEDE SER ANTERIOR AL INICIO.');
    await gpEjecutar(async()=>{const r=await supabaseGuardarProyecto(payload);await Promise.all([cargarGestionProyectos(r.project_id),cargarDatos()]);alert('PROYECTO GUARDADO CORRECTAMENTE.');});
}

function abrirFormularioPuesto(id='') {
    const p=gpProyectoActual(), po=(p.posts||[]).find(x=>x.id===id)||null, editor=document.getElementById('gp-editor');
    const horario=po?.service_type||'12 HORAS',bloqueado=p.onboarding_status==='CONFIRMED'&&!gpEsGerencia();
    editor.innerHTML=gpCard(po?'EDITAR PUESTO':'NUEVO PUESTO','',`<div style="display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:9px"><label>NOMBRE<input id="gp-puesto-nombre" value="${gpEsc(po?.name||'')}" style="width:100%;box-sizing:border-box;padding:8px"></label><label>HORARIO<select id="gp-puesto-tipo" style="width:100%;box-sizing:border-box;padding:8px">${['24 HORAS','12 HORAS','10 HORAS','8 HORAS'].map(h=>`<option ${horario===h?'selected':''}>${h}</option>`).join('')}</select></label><label>AGENTES FIJOS REQUERIDOS<input id="gp-puesto-cupo" type="number" min="0" max="9999" value="${gpNumero(po?.required_agent_count)}" ${bloqueado?'disabled':''} style="width:100%;box-sizing:border-box;padding:8px"></label><label>TURNO / REFERENCIA<input id="gp-puesto-turno" value="${gpEsc(po?.shift_label||'')}" placeholder="D / N / ROTATIVO" style="width:100%;box-sizing:border-box;padding:8px"></label><label>DÍAS<input id="gp-puesto-dias" value="${gpEsc(po?.service_days||'LUNES A DOMINGO')}" placeholder="LUNES A DOMINGO" style="width:100%;box-sizing:border-box;padding:8px"></label><label>LATITUD<input id="gp-puesto-lat" type="number" step="any" value="${gpEsc(po?.latitude??'')}" style="width:100%;box-sizing:border-box;padding:8px"></label><label>LONGITUD<input id="gp-puesto-lng" type="number" step="any" value="${gpEsc(po?.longitude??'')}" style="width:100%;box-sizing:border-box;padding:8px"></label><label><input id="gp-puesto-armado" type="checkbox" ${po?.armed?'checked':''}> PUESTO ARMADO</label><label><input id="gp-puesto-radio" type="checkbox" ${po?.has_radio?'checked':''}> REQUIERE RADIO</label>${po?`<label><input id="gp-puesto-activo" type="checkbox" ${po.active?'checked':''}> PUESTO ACTIVO</label>`:''}${p.onboarding_status==='CONFIRMED'&&gpEsGerencia()?'<label style="grid-column:1/-1">MOTIVO DEL CAMBIO DE FACTOR<input id="gp-puesto-motivo-factor" maxlength="240" placeholder="OBLIGATORIO SI CAMBIA EL CUPO" style="width:100%;box-sizing:border-box;padding:8px"></label>':''}<label style="grid-column:1/-1">OBSERVACIÓN<textarea id="gp-puesto-obs" rows="2" style="width:100%;box-sizing:border-box;padding:8px">${gpEsc(po?.observation||'')}</textarea></label></div><div style="display:flex;gap:8px;margin-top:10px"><button onclick="guardarPuestoGestion('${gpEsc(po?.id||'')}')" style="flex:2;border:0;border-radius:8px;background:#2563eb;color:white;padding:9px;font-weight:900">GUARDAR</button><button onclick="document.getElementById('gp-editor').innerHTML=''" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;background:white">CANCELAR</button></div>`,'#2563eb');
    editor.scrollIntoView({behavior:'smooth',block:'start'});
}

async function guardarPuestoGestion(id='') {
    const po=(gpProyectoActual()?.posts||[]).find(x=>x.id===id)||null,cupoInput=document.getElementById('gp-puesto-cupo');
    const payload={request_id:gpRequestId(),project_id:gestionProyectos.proyectoId,post_id:id||null,name:document.getElementById('gp-puesto-nombre').value.trim(),service_type:document.getElementById('gp-puesto-tipo').value.trim(),required_agent_count:cupoInput?.disabled?gpNumero(po?.required_agent_count):Number(cupoInput?.value),shift_label:document.getElementById('gp-puesto-turno').value.trim(),service_days:document.getElementById('gp-puesto-dias').value.trim(),latitude:document.getElementById('gp-puesto-lat').value||null,longitude:document.getElementById('gp-puesto-lng').value||null,armed:document.getElementById('gp-puesto-armado').checked,has_radio:document.getElementById('gp-puesto-radio').checked,active:id?document.getElementById('gp-puesto-activo').checked:true,staffing_reason:document.getElementById('gp-puesto-motivo-factor')?.value.trim()||'',observation:document.getElementById('gp-puesto-obs').value.trim()};
    if(!payload.name||!Number.isInteger(payload.required_agent_count)||payload.required_agent_count<0)return alert('ESCRIBE EL NOMBRE Y UN CUPO VÁLIDO PARA EL PUESTO.');
    await gpEjecutar(async()=>{await supabaseGuardarPuestoProyecto(payload);await Promise.all([cargarGestionProyectos(gestionProyectos.proyectoId),cargarDatos()]);alert('PUESTO GUARDADO CORRECTAMENTE.');});
}

function abrirFormularioSupervisor(personnelId='') {
    const actual=(gestionProyectos.workspace?.personnel||[]).find(pe=>pe.id===personnelId)||null;
    const opciones=(gestionProyectos.workspace?.personnel||[]).map(pe=>`<option value="${gpEsc(pe.id)}" ${pe.id===personnelId?'selected':''}>${gpEsc(pe.full_name)} · ${gpEsc(pe.national_id||'SIN CÉDULA')}</option>`).join('');
    const editor=document.getElementById('gp-editor'); editor.innerHTML=gpCard(actual?'EDITAR SUPERVISOR':'CREAR O ASIGNAR SUPERVISOR','',`<label>SUPERVISOR EXISTENTE<select id="gp-supervisor-persona" onchange="cargarSupervisorSeleccionado()" style="width:100%;padding:9px"><option value="">NUEVO SUPERVISOR…</option>${opciones}</select></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><label>NOMBRES<input id="gp-supervisor-nombres" value="${gpEsc(actual?.given_names||'')}" style="width:100%;box-sizing:border-box;padding:9px"></label><label>APELLIDOS<input id="gp-supervisor-apellidos" value="${gpEsc(actual?.family_names||'')}" style="width:100%;box-sizing:border-box;padding:9px"></label><label>CÉDULA<input id="gp-supervisor-cedula" maxlength="10" value="${gpEsc(actual?.national_id||'')}" style="width:100%;box-sizing:border-box;padding:9px"></label><label>TELÉFONO<input id="gp-supervisor-telefono" maxlength="16" value="${gpEsc(actual?.mobile_phone||'')}" placeholder="0987654321" style="width:100%;box-sizing:border-box;padding:9px"></label><label>FECHA DE ASIGNACIÓN<input id="gp-supervisor-fecha" type="date" max="${gpHoy()}" value="${gpHoy()}" style="width:100%;box-sizing:border-box;padding:9px"></label><label>OBSERVACIÓN<textarea id="gp-supervisor-nota" style="width:100%;box-sizing:border-box;padding:9px"></textarea></label></div><button onclick="asignarSupervisorProyecto()" style="width:100%;border:0;border-radius:8px;background:#7c3aed;color:white;padding:9px;font-weight:900;margin-top:8px">GUARDAR Y ASIGNAR</button>`,'#7c3aed'); editor.scrollIntoView({behavior:'smooth'});
}

function cargarSupervisorSeleccionado(){const id=document.getElementById('gp-supervisor-persona').value,p=(gestionProyectos.workspace?.personnel||[]).find(x=>x.id===id)||{};document.getElementById('gp-supervisor-nombres').value=p.given_names||'';document.getElementById('gp-supervisor-apellidos').value=p.family_names||'';document.getElementById('gp-supervisor-cedula').value=p.national_id||'';document.getElementById('gp-supervisor-telefono').value=p.mobile_phone||'';}

async function asignarSupervisorProyecto() {
    const payload={request_id:gpRequestId(),project_id:gestionProyectos.proyectoId,personnel_id:document.getElementById('gp-supervisor-persona').value||null,given_names:document.getElementById('gp-supervisor-nombres').value.trim(),family_names:document.getElementById('gp-supervisor-apellidos').value.trim(),national_id:document.getElementById('gp-supervisor-cedula').value.trim(),mobile_phone:document.getElementById('gp-supervisor-telefono').value.trim(),effective_date:document.getElementById('gp-supervisor-fecha').value,notes:document.getElementById('gp-supervisor-nota').value.trim()||null};
    if(!payload.given_names||!payload.family_names||!/^\d{10}$/.test(payload.national_id)||!payload.effective_date)return alert('COMPLETA NOMBRES, APELLIDOS, CÉDULA DE 10 DÍGITOS Y FECHA.');
    await gpEjecutar(async()=>{await supabaseGuardarSupervisor(payload);await Promise.all([cargarGestionProyectos(gestionProyectos.proyectoId),cargarDatos()]);alert('SUPERVISOR GUARDADO Y ASIGNADO.');});
}

async function retirarSupervisorProyecto(assignmentId) {
    const fecha=prompt('Fecha efectiva de salida (AAAA-MM-DD):',gpHoy()); if(fecha===null)return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha))return alert('LA FECHA NO ES VÁLIDA.');
    if(!confirm('¿CONFIRMAS EL RETIRO DEL SUPERVISOR?'))return;
    await gpEjecutar(async()=>{await supabaseCambiarSupervisorProyecto({request_id:gpRequestId(),project_id:gestionProyectos.proyectoId,assignment_id:assignmentId,action:'REMOVE',effective_date:fecha});await Promise.all([cargarGestionProyectos(gestionProyectos.proyectoId),cargarDatos()]);alert('SUPERVISOR RETIRADO.');});
}

function abrirFormularioDocumentoProyecto() {
    const editor=document.getElementById('gp-editor'); editor.innerHTML=gpCard('REGISTRAR DOCUMENTO PRIVADO','',`<select id="gp-doc-tipo" style="width:100%;padding:9px"><option value="CONTRATO">CONTRATO</option><option value="ODC">ORDEN DE COMPRA (ODC)</option><option value="KARDEX">KARDEX</option><option value="NOMINA">LISTADO DE PERSONAL</option><option value="OTRO">OTRO</option></select><input id="gp-doc-archivo" type="file" accept="application/pdf,.pdf,.xls,.xlsx" style="width:100%;box-sizing:border-box;padding:9px;margin-top:8px"><textarea id="gp-doc-nota" maxlength="300" placeholder="Observación opcional" style="width:100%;box-sizing:border-box;padding:9px;margin-top:8px"></textarea><button onclick="guardarDocumentoProyecto()" style="width:100%;border:0;border-radius:8px;background:#15803d;color:white;padding:9px;font-weight:900;margin-top:8px">SUBIR Y REGISTRAR</button>`,'#15803d'); editor.scrollIntoView({behavior:'smooth'});
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

function descargarPlantillaPersonalProyecto() {
    const p=gpProyectoActual(); if(!p)return;
    if(typeof XLSX==='undefined')return alert('NO SE PUDO CARGAR EL GENERADOR DE EXCEL. RECARGA LA PÁGINA.');
    const filas=[['PUESTO','HORARIO','FECHA INGRESO','CEDULA','NOMBRE']];
    (p.posts||[]).filter(x=>x.active).forEach(po=>{
        const cantidad=gpNumero(po.required_agent_count);
        for(let i=0;i<cantidad;i++)filas.push([String(po.name||'').toUpperCase(),po.service_type||'12 HORAS',p.start_date||gpHoy(),'','']);
    });
    for(let i=0;i<gpNumero(p.required_mobile_guard_count);i++)filas.push(['SACAFRANCO','12 HORAS',p.start_date||gpHoy(),'','']);
    const libro=XLSX.utils.book_new(),hoja=XLSX.utils.aoa_to_sheet(filas),ayuda=XLSX.utils.aoa_to_sheet([
        ['INSTRUCCIONES'],['No cambie los cinco encabezados de la hoja PERSONAL.'],['PUESTO debe coincidir exactamente con un puesto del proyecto.'],['Para personal móvil escriba SACAFRANCO en PUESTO.'],['HORARIO permitido: 24 HORAS, 12 HORAS, 10 HORAS u 8 HORAS.'],['CEDULA debe contener 10 dígitos.'],['NOMBRE debe coincidir con el registrado para esa cédula.']
    ]);
    hoja['!cols']=[{wch:30},{wch:16},{wch:16},{wch:16},{wch:42}];
    XLSX.utils.book_append_sheet(libro,hoja,'PERSONAL');XLSX.utils.book_append_sheet(libro,ayuda,'INSTRUCCIONES');
    XLSX.writeFile(libro,`PLANTILLA_PERSONAL_${String(p.name||'PROYECTO').replace(/[^A-Z0-9]+/gi,'_')}.xlsx`);
}

function gpFechaExcel(valor) {
    if(typeof valor==='number'&&typeof XLSX!=='undefined'){
        const f=XLSX.SSF.parse_date_code(valor);if(f)return `${f.y}-${String(f.m).padStart(2,'0')}-${String(f.d).padStart(2,'0')}`;
    }
    if(valor instanceof Date&&!Number.isNaN(valor.getTime()))return `${valor.getFullYear()}-${String(valor.getMonth()+1).padStart(2,'0')}-${String(valor.getDate()).padStart(2,'0')}`;
    const t=String(valor??'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t;
    const m=t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';
}

function abrirImportadorPersonalProyecto() {
    const p=gpProyectoActual(),editor=document.getElementById('gp-editor');if(!p||!editor)return;
    gestionProyectos.importacion=null;
    editor.innerHTML=gpCard('CARGAR Y VERIFICAR PERSONAL','',`<p style="font-size:10px;color:#475569">Use la plantilla del proyecto. Primero se valida el archivo completo; ningún registro se guarda si existe un error.</p><input id="gp-personal-archivo" type="file" accept=".xlsx,.xls" style="width:100%;box-sizing:border-box;padding:10px;border:1px dashed #7c3aed;border-radius:8px"><div style="display:flex;gap:8px;margin-top:9px"><button onclick="validarArchivoPersonalProyecto()" style="flex:2;border:0;border-radius:8px;background:#7c3aed;color:white;padding:9px;font-weight:900">VALIDAR ARCHIVO</button><button onclick="document.getElementById('gp-editor').innerHTML=''" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;background:white">CANCELAR</button></div><div id="gp-personal-resultado" style="margin-top:10px"></div>`,'#7c3aed');
    editor.scrollIntoView({behavior:'smooth',block:'start'});
}

async function validarArchivoPersonalProyecto() {
    const archivo=document.getElementById('gp-personal-archivo')?.files?.[0],salida=document.getElementById('gp-personal-resultado');
    if(!archivo)return alert('SELECCIONA EL ARCHIVO EXCEL.');
    try{
        const libro=XLSX.read(await archivo.arrayBuffer(),{type:'array',cellDates:true}),hoja=libro.Sheets.PERSONAL||libro.Sheets[libro.SheetNames[0]];
        const crudas=XLSX.utils.sheet_to_json(hoja,{defval:'',raw:true});
        const normalizarClave=k=>String(k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
        const filas=crudas.filter(r=>Object.values(r).some(v=>String(v).trim())).map(r=>{const n={};Object.entries(r).forEach(([k,v])=>n[normalizarClave(k)]=v);return {post:String(n.PUESTO||'').trim(),schedule:String(n.HORARIO||'').trim(),start_date:gpFechaExcel(n['FECHA INGRESO']),national_id:String(n.CEDULA||'').replace(/\D/g,''),full_name:String(n.NOMBRE||'').trim()};});
        if(!filas.length)throw new Error('LA HOJA PERSONAL NO CONTIENE FILAS.');
        const payload={request_id:gpRequestId(),project_id:gestionProyectos.proyectoId,source_file_name:archivo.name,rows:filas};
        salida.innerHTML='<p style="font-size:10px;color:#475569">Validando con la base de datos…</p>';
        const r=await supabaseImportarNominaProyecto(payload,true);gestionProyectos.importacion={payload,resultado:r};
        if(!r.ok){salida.innerHTML=`<div style="padding:10px;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:10px"><b>ARCHIVO RECHAZADO</b><ul>${(r.errors||[]).map(e=>`<li>${gpEsc(e)}</li>`).join('')}</ul></div>`;return;}
        salida.innerHTML=`<div style="padding:10px;border-radius:8px;background:#ecfdf5;color:#166534;font-size:10px"><b>VALIDACIÓN CORRECTA</b><p>${r.counts.total} persona(s): ${r.counts.fixed} fija(s) y ${r.counts.mobile} sacafranco(s). Periodo ${gpEsc(r.month_start)}.</p><button onclick="confirmarImportacionPersonalProyecto()" style="border:0;border-radius:8px;background:#15803d;color:white;padding:9px 14px;font-weight:900">CONFIRMAR Y ASIGNAR PERSONAL</button></div>`;
    }catch(error){salida.innerHTML=`<div style="padding:10px;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:10px">${gpEsc(error.message||error)}</div>`;}
}

async function confirmarImportacionPersonalProyecto() {
    const imp=gestionProyectos.importacion;if(!imp?.payload||!imp?.resultado?.ok)return;
    if(!confirm(`SE ASIGNARÁN ${imp.resultado.counts.total} PERSONAS AL PERIODO ABIERTO. ¿CONFIRMAS?`))return;
    await gpEjecutar(async()=>{const r=await supabaseImportarNominaProyecto(imp.payload,false);gestionProyectos.importacion=null;await Promise.all([cargarGestionProyectos(gestionProyectos.proyectoId),cargarDatos()]);if(typeof cargarWorkspaceAsistencia==='function'&&document.getElementById('asistencia-modal')?.style.display==='flex')await cargarWorkspaceAsistencia(null);alert(`PERSONAL ASIGNADO: ${r.counts.total} REGISTRO(S).`);});
}

async function confirmarAltaProyecto() {
    const p=gpProyectoActual();if(!p)return;const esperado=`CONFIRMAR ${String(p.name).toUpperCase()}`;
    const texto=prompt(`Al confirmar, Operaciones ya no podrá cambiar el factor humano.\n\nEscribe exactamente:\n${esperado}`,'');if(texto===null)return;
    await gpEjecutar(async()=>{await supabaseConfirmarAltaProyecto(p.id,texto);await cargarGestionProyectos(p.id);alert('PROYECTO CONFIRMADO. LOS CAMBIOS DE FACTOR QUEDAN RESERVADOS A GERENCIA.');});
}

async function abrirImportadorPersonalDesdeAsistencia() {
    await abrirGestionProyectos();
    const proyectos=(gestionProyectos.workspace?.projects||[]).filter(p=>p.status==='ACTIVE');
    document.getElementById('gp-contenido').innerHTML=gpCard('SELECCIONA EL PROYECTO PARA CARGAR PERSONAL','',proyectos.map(p=>`<button onclick="gestionProyectos.proyectoId='${gpEsc(p.id)}';renderDetalleGestionProyecto();setTimeout(abrirImportadorPersonalProyecto,0)" style="width:100%;text-align:left;border:1px solid #cbd5e1;border-radius:9px;background:white;padding:10px;margin-bottom:6px;cursor:pointer"><b>${gpEsc(p.name)}</b><small style="display:block;color:#64748b">${gpEsc(p.province)} · FACTOR ${gpNumero(p.required_guard_count)}</small></button>`).join('')||'<p>No existen proyectos activos.</p>','#7c3aed');
}

async function reiniciarListadoAsistencia() {
    if(!gpEsGerencia())return alert('SOLO GERENCIA PUEDE REINICIAR EL LISTADO.');
    const mes=asistenciaModulo.workspace?.period?.month_start?.slice(0,7);if(!mes)return;
    const esperado=`REINICIAR ${mes}`,texto=prompt(`Esta acción retira la nómina de prueba del periodo ${mes}. No se ejecutará si existen novedades, coberturas o movimientos auditables.\n\nEscribe exactamente:\n${esperado}`,'');if(texto===null)return;
    if(!confirm('¿CONFIRMAS EL REINICIO DEL LISTADO DE PRUEBA?'))return;
    try{const r=await supabaseReiniciarNominaPeriodo(texto);await cargarWorkspaceAsistencia(null);alert(`LISTADO REINICIADO. ${r.removed_assignments} ASIGNACIÓN(ES) RETIRADA(S).`);}catch(error){alert(`NO SE PUDO REINICIAR: ${error.message||error}`);}
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
