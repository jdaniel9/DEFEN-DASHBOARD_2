// ================================================================
// audit.js — Migracion 44
// Consulta y exportacion de la auditoria administrativa consolidada.
// ================================================================

const auditoriaSistema = { workspace:null, cargando:false };

function audEsc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function audFechaIso(fecha) {
    const d=new Date(fecha), z=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}

function audFechaHora(valor) {
    if(!valor)return '—'; const d=new Date(valor);
    return Number.isNaN(d.getTime())?String(valor):d.toLocaleString('es-EC',{dateStyle:'short',timeStyle:'short'});
}

function audAccion(codigo) {
    const etiquetas={
        PROFILE_UPDATED:'PERFIL ACTUALIZADO',ACCESS_ACTIVATED:'ACCESO ACTIVADO',ACCESS_BLOCKED:'ACCESO BLOQUEADO',ROLE_CHANGED:'PERFIL CAMBIADO',
        PROJECT_CREATED:'PROYECTO CREADO',PROJECT_UPDATED:'PROYECTO ACTUALIZADO',POST_CREATED:'PUESTO CREADO',POST_UPDATED:'PUESTO ACTUALIZADO',PROJECT_ARCHIVED:'PROYECTO ARCHIVADO',SUPERVISOR_ASSIGNED:'SUPERVISOR ASIGNADO',SUPERVISOR_REMOVED:'SUPERVISOR RETIRADO',DOCUMENT_REGISTERED:'DOCUMENTO REGISTRADO',
        ATTENDANCE_REGISTERED:'ASISTENCIA REGISTRADA',ATTENDANCE_UPDATED:'ASISTENCIA MODIFICADA',ATTENDANCE_DELETED:'ASISTENCIA ELIMINADA',PERSONNEL_INGRESO:'INGRESO DE PERSONAL',PERSONNEL_SALIDA:'SALIDA DE PERSONAL',
        WARNING_VERBAL:'LLAMADO VERBAL',WARNING_ESCRITO:'LLAMADO ESCRITO',WARNING_SUSPENSION:'SUSPENSIÓN',WARNING_OTRO:'NOVEDAD DE PERSONAL'
    };
    return etiquetas[codigo]||String(codigo||'OPERACIÓN').replaceAll('_',' ');
}

function audColorModulo(modulo) {
    return {ACCESOS:'#7c3aed',PROYECTOS:'#0891b2',ASISTENCIA:'#2563eb',PERSONAL:'#db2777',RADIOS:'#ea580c',ARMAMENTO:'#15803d'}[modulo]||'#475569';
}

function asegurarModalAuditoriaSistema() {
    if(document.getElementById('auditoria-sistema-modal'))return;
    const modal=document.createElement('div'); modal.id='auditoria-sistema-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:22300;background:rgba(15,23,42,.9);backdrop-filter:blur(5px);padding:12px;align-items:center;justify-content:center';
    modal.innerHTML=`<div style="width:min(1580px,99vw);height:min(930px,97vh);background:#f8fafc;border-radius:19px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 35px 110px rgba(0,0,0,.6)">
      <header style="background:#0f172a;color:white;padding:14px 18px;display:flex;align-items:center;gap:10px"><div style="flex:1"><b style="font-size:16px">🔎 Auditoría general del sistema</b><div id="aud-subtitulo" style="font-size:10px;color:#93c5fd;margin-top:3px">Trazabilidad administrativa por usuario y módulo</div></div><button onclick="cerrarAuditoriaSistema()" style="border:0;border-radius:9px;background:#334155;color:white;padding:8px 12px;font-weight:900;cursor:pointer">✕ Cerrar</button></header>
      <div style="padding:11px 13px;background:white;border-bottom:1px solid #e2e8f0"><div style="display:grid;grid-template-columns:150px 150px 190px minmax(250px,1fr) auto auto auto;gap:8px;align-items:end"><label style="font-size:8px;font-weight:900">DESDE<input id="aud-desde" type="date" style="width:100%;box-sizing:border-box;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px"></label><label style="font-size:8px;font-weight:900">HASTA<input id="aud-hasta" type="date" style="width:100%;box-sizing:border-box;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px"></label><label style="font-size:8px;font-weight:900">MÓDULO<select id="aud-modulo" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px"><option>TODOS</option><option>ACCESOS</option><option>PROYECTOS</option><option>ASISTENCIA</option><option>PERSONAL</option><option>RADIOS</option><option>ARMAMENTO</option></select></label><label style="font-size:8px;font-weight:900">BUSCAR<input id="aud-buscar" onkeydown="if(event.key==='Enter')consultarAuditoriaSistema()" placeholder="Usuario, arma, radio, proyecto, acción…" style="width:100%;box-sizing:border-box;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px"></label><button onclick="consultarAuditoriaSistema()" style="border:0;border-radius:8px;background:#0369a1;color:white;padding:9px 12px;font-weight:900;cursor:pointer">🔍 Consultar</button><button onclick="exportarAuditoriaPDF()" style="border:0;border-radius:8px;background:#dc2626;color:white;padding:9px 12px;font-weight:900;cursor:pointer">PDF</button><button onclick="exportarAuditoriaExcel()" style="border:0;border-radius:8px;background:#15803d;color:white;padding:9px 12px;font-weight:900;cursor:pointer">Excel</button></div></div>
      <div id="aud-resumen" style="padding:10px 12px 0"></div><div id="aud-contenido" style="padding:10px 12px 15px;overflow:auto;flex:1"></div>
    </div>`;
    document.body.appendChild(modal);
    const hoy=new Date(), desde=new Date(); desde.setDate(hoy.getDate()-30);
    document.getElementById('aud-hasta').value=audFechaIso(hoy); document.getElementById('aud-desde').value=audFechaIso(desde);
}

async function abrirAuditoriaSistema() {
    if(typeof usuarioPuedeVerAuditoriaSistema==='function'&&!usuarioPuedeVerAuditoriaSistema())return alert('SOLO EL ADMINISTRADOR PUEDE CONSULTAR LA AUDITORÍA.');
    asegurarModalAuditoriaSistema(); document.getElementById('auditoria-sistema-modal').style.display='flex';
    if(!auditoriaSistema.workspace)await consultarAuditoriaSistema();
}

function cerrarAuditoriaSistema(){const m=document.getElementById('auditoria-sistema-modal');if(m)m.style.display='none';}

async function consultarAuditoriaSistema() {
    if(auditoriaSistema.cargando)return;
    const desde=document.getElementById('aud-desde').value,hasta=document.getElementById('aud-hasta').value;
    if(!desde||!hasta)return alert('SELECCIONA LAS FECHAS DE CONSULTA.');
    auditoriaSistema.cargando=true; document.getElementById('aud-contenido').innerHTML='<div style="padding:50px;text-align:center;color:#64748b">Consultando auditoría…</div>';
    try{
        auditoriaSistema.workspace=await supabaseCargarAuditoriaSistema(desde,hasta,document.getElementById('aud-modulo').value,document.getElementById('aud-buscar').value.trim(),1000);
        renderAuditoriaSistema();
    }catch(error){document.getElementById('aud-contenido').innerHTML=`<div style="padding:30px;color:#b91c1c;font-weight:900">NO SE PUDO CARGAR LA AUDITORÍA: ${audEsc(error.message||error)}</div>`;}
    finally{auditoriaSistema.cargando=false;}
}

function renderAuditoriaSistema() {
    const w=auditoriaSistema.workspace||{}, eventos=w.events||[], modulos=w.summary?.modules||{};
    const tarjetas=[['OPERACIONES',w.summary?.total||0,'#0f172a'],['USUARIOS',w.summary?.users||0,'#7c3aed'],...Object.entries(modulos).map(([m,n])=>[m,n,audColorModulo(m)])];
    document.getElementById('aud-resumen').innerHTML=`<div style="display:grid;grid-template-columns:repeat(${Math.min(Math.max(tarjetas.length,2),8)},minmax(100px,1fr));gap:7px">${tarjetas.map(t=>`<div style="background:white;border:1px solid #e2e8f0;border-top:4px solid ${t[2]};border-radius:10px;padding:8px"><small style="font-size:7px;color:#64748b;font-weight:900">${audEsc(t[0])}</small><b style="display:block;font-size:17px;color:${t[2]}">${t[1]}</b></div>`).join('')}</div>`;
    document.getElementById('aud-subtitulo').textContent=`${w.summary?.total||0} operación(es) encontrada(s) · mostrando ${eventos.length}`;
    if(!eventos.length){document.getElementById('aud-contenido').innerHTML='<div style="padding:55px;text-align:center;color:#94a3b8">No se encontraron operaciones con esos filtros.</div>';return;}
    document.getElementById('aud-contenido').innerHTML=`<div style="background:white;border:1px solid #cbd5e1;border-radius:12px;overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:1050px;font-size:9px"><thead style="position:sticky;top:0;background:#0f172a;color:white;z-index:1"><tr><th style="padding:9px;text-align:left">FECHA</th><th style="padding:9px;text-align:left">MÓDULO</th><th style="padding:9px;text-align:left">ACCIÓN</th><th style="padding:9px;text-align:left">REGISTRO</th><th style="padding:9px;text-align:left">DETALLE</th><th style="padding:9px;text-align:left">REALIZADO POR</th></tr></thead><tbody>${eventos.map((e,i)=>`<tr style="border-bottom:1px solid #e2e8f0;background:${i%2?'#f8fafc':'white'}"><td style="padding:8px;white-space:nowrap">${audEsc(audFechaHora(e.occurred_at))}</td><td style="padding:8px"><b style="display:inline-block;border-radius:999px;padding:4px 7px;background:${audColorModulo(e.module)}18;color:${audColorModulo(e.module)}">${audEsc(e.module)}</b></td><td style="padding:8px;font-weight:900;color:#1e293b">${audEsc(audAccion(e.action))}</td><td style="padding:8px;font-weight:800">${audEsc(e.entity_label||'—')}</td><td style="padding:8px;max-width:330px"><div>${audEsc(e.detail||'—')}</div><details style="margin-top:4px"><summary style="cursor:pointer;color:#2563eb;font-weight:800">Detalle técnico</summary><pre style="white-space:pre-wrap;word-break:break-word;background:#f1f5f9;padding:7px;border-radius:6px;font-size:8px">${audEsc(JSON.stringify(e.metadata||{},null,2))}</pre></details></td><td style="padding:8px;font-weight:800">${audEsc(e.actor_name||'SISTEMA')}</td></tr>`).join('')}</tbody></table></div>`;
}

function audFilasExportacion() {
    return (auditoriaSistema.workspace?.events||[]).map(e=>({Fecha:audFechaHora(e.occurred_at),Modulo:e.module,Accion:audAccion(e.action),Registro:e.entity_label||'',Detalle:e.detail||'',Usuario:e.actor_name||'SISTEMA'}));
}

function exportarAuditoriaPDF() {
    const filas=audFilasExportacion(); if(!filas.length)return alert('NO HAY DATOS PARA EXPORTAR.');
    if(!window.jspdf?.jsPDF)return alert('NO SE PUDO CARGAR LA LIBRERÍA PDF.');
    const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}), f=auditoriaSistema.workspace.filters||{};
    doc.setFontSize(15); doc.text('AUDITORÍA GENERAL DEL SISTEMA',14,14); doc.setFontSize(8); doc.text(`Periodo: ${f.from||''} al ${f.to||''} · Módulo: ${f.module||'TODOS'} · Registros exportados: ${filas.length}`,14,20);
    doc.autoTable({startY:24,head:[Object.keys(filas[0])],body:filas.map(Object.values),styles:{fontSize:6,cellPadding:1.5,overflow:'linebreak'},headStyles:{fillColor:[15,23,42]},columnStyles:{0:{cellWidth:27},1:{cellWidth:20},2:{cellWidth:38},3:{cellWidth:48},4:{cellWidth:100},5:{cellWidth:40}}});
    doc.save(`AUDITORIA_DEFEN_${f.from||'DESDE'}_${f.to||'HASTA'}.pdf`);
}

function exportarAuditoriaExcel() {
    const filas=audFilasExportacion(); if(!filas.length)return alert('NO HAY DATOS PARA EXPORTAR.');
    if(typeof XLSX==='undefined')return alert('NO SE PUDO CARGAR LA LIBRERÍA EXCEL.');
    const hoja=XLSX.utils.json_to_sheet(filas); hoja['!cols']=[{wch:20},{wch:16},{wch:34},{wch:45},{wch:90},{wch:35}];
    const libro=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro,hoja,'Auditoria');
    const f=auditoriaSistema.workspace.filters||{}; XLSX.writeFile(libro,`AUDITORIA_DEFEN_${f.from||'DESDE'}_${f.to||'HASTA'}.xlsx`);
}
