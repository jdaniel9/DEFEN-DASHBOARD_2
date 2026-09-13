// ================================================================
// system-health.js — Migracion 45
// Diagnostico de capacidad e integridad. Nunca repara automaticamente.
// ================================================================

const saludSistema = { workspace:null, cargando:false };

function ssEsc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function ssTamano(bytes) {
    const n=Number(bytes)||0;
    if(n>=1073741824)return `${(n/1073741824).toFixed(2)} GB`;
    if(n>=1048576)return `${(n/1048576).toFixed(2)} MB`;
    if(n>=1024)return `${(n/1024).toFixed(2)} KB`;
    return `${n} B`;
}

function ssFecha(valor) {
    const d=new Date(valor); return Number.isNaN(d.getTime())?String(valor||'—'):d.toLocaleString('es-EC',{dateStyle:'medium',timeStyle:'short'});
}

function ssEstadoVisual(estado) {
    if(estado==='CRITICAL')return {color:'#b91c1c',fondo:'#fee2e2',texto:'REQUIERE ATENCIÓN'};
    if(estado==='WARNING')return {color:'#b45309',fondo:'#fef3c7',texto:'CON ADVERTENCIAS'};
    return {color:'#15803d',fondo:'#dcfce7',texto:'OPERATIVO'};
}

function asegurarModalSaludSistema() {
    if(document.getElementById('salud-sistema-modal'))return;
    const modal=document.createElement('div');modal.id='salud-sistema-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:22500;background:rgba(15,23,42,.9);backdrop-filter:blur(5px);padding:12px;align-items:center;justify-content:center';
    modal.innerHTML=`<div style="width:min(1420px,99vw);height:min(900px,97vh);background:#f8fafc;border-radius:19px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 35px 110px rgba(0,0,0,.6)">
      <header style="background:#0f172a;color:white;padding:14px 18px;display:flex;align-items:center;gap:10px"><div style="flex:1"><b style="font-size:16px">🩺 Estado general del sistema</b><div id="ss-subtitulo" style="font-size:10px;color:#86efac;margin-top:3px">Diagnóstico seguro de Supabase y operaciones</div></div><button onclick="cargarSaludSistema()" style="border:0;border-radius:9px;background:#047857;color:white;padding:8px 12px;font-weight:900;cursor:pointer">↻ Actualizar</button><button onclick="exportarSaludSistemaPDF()" style="border:0;border-radius:9px;background:#dc2626;color:white;padding:8px 12px;font-weight:900;cursor:pointer">PDF</button><button onclick="cerrarSaludSistema()" style="border:0;border-radius:9px;background:#334155;color:white;padding:8px 12px;font-weight:900;cursor:pointer">✕ Cerrar</button></header>
      <div style="background:#ecfdf5;border-bottom:1px solid #a7f3d0;padding:9px 14px;color:#065f46;font-size:9px"><b>Panel de solo lectura.</b> Los resultados identifican situaciones para revisar; no corrigen, eliminan ni trasladan registros automáticamente.</div>
      <div id="ss-contenido" style="padding:12px;overflow:auto;flex:1"></div>
    </div>`;
    document.body.appendChild(modal);
}

async function abrirSaludSistema() {
    if(typeof usuarioPuedeVerSaludSistema==='function'&&!usuarioPuedeVerSaludSistema())return alert('SOLO EL ADMINISTRADOR PUEDE CONSULTAR EL ESTADO DEL SISTEMA.');
    asegurarModalSaludSistema();document.getElementById('salud-sistema-modal').style.display='flex';
    await cargarSaludSistema();
}

function cerrarSaludSistema(){const m=document.getElementById('salud-sistema-modal');if(m)m.style.display='none';}

async function cargarSaludSistema() {
    if(saludSistema.cargando)return;saludSistema.cargando=true;
    document.getElementById('ss-contenido').innerHTML='<div style="padding:60px;text-align:center;color:#64748b">Analizando integridad y capacidad…</div>';
    try{saludSistema.workspace=await supabaseCargarSaludSistema();renderSaludSistema();}
    catch(error){document.getElementById('ss-contenido').innerHTML=`<div style="padding:35px;color:#b91c1c;font-weight:900">NO SE PUDO GENERAR EL DIAGNÓSTICO: ${ssEsc(error.message||error)}</div>`;}
    finally{saludSistema.cargando=false;}
}

function ssTarjeta(titulo,valor,color,detalle='') {
    return `<div style="background:white;border:1px solid #e2e8f0;border-top:4px solid ${color};border-radius:11px;padding:10px"><small style="font-size:8px;color:#64748b;font-weight:900">${ssEsc(titulo)}</small><b style="display:block;font-size:19px;color:${color};margin-top:2px">${ssEsc(valor)}</b>${detalle?`<span style="font-size:8px;color:#64748b">${ssEsc(detalle)}</span>`:''}</div>`;
}

function renderSaludSistema() {
    const w=saludSistema.workspace||{},visual=ssEstadoVisual(w.status),c=w.counts||{},cap=w.capacity||{},checks=w.checks||[];
    document.getElementById('ss-subtitulo').textContent=`Migración ${w.migration_level||45} · diagnóstico ${ssFecha(w.generated_at)}`;
    const capacidad=`<section style="margin-bottom:12px"><h3 style="font-size:11px;margin:0 0 7px;color:#334155">CAPACIDAD UTILIZADA</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${ssTarjeta('BASE DE DATOS',ssTamano(cap.database_bytes),'#2563eb','Tamaño actual')}${ssTarjeta('ALMACENAMIENTO',ssTamano(cap.storage_bytes),'#7c3aed',`${cap.storage_objects||0} archivo(s)`) }${ssTarjeta('NIVEL DE MIGRACIÓN',String(w.migration_level||45),'#0891b2','Esquema operativo')}</div></section>`;
    const modulos=[['USUARIOS',c.profiles?.active||0,'#7c3aed',`${c.profiles?.total||0} registrados`],['PROYECTOS',c.projects?.active||0,'#0891b2',`${c.projects?.archived||0} archivados`],['PUESTOS',c.projects?.active_posts||0,'#0ea5e9','activos'],['PERSONAL',c.attendance?.personnel||0,'#db2777',`${c.attendance?.entries||0} marcaciones`],['ARMAS',c.weapons?.total||0,'#15803d',`${c.weapons?.field||0} campo · ${c.weapons?.transit||0} tránsito`],['RADIOS',c.radios?.total||0,'#ea580c',`${c.radios?.assigned||0} asignados`]];
    const resumen=`<section style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:9px;margin-bottom:8px"><b style="border-radius:999px;padding:7px 11px;background:${visual.fondo};color:${visual.color};font-size:10px">${visual.texto}</b><span style="font-size:9px;color:#64748b">${w.summary?.critical||0} novedad(es) crítica(s) · ${w.summary?.warning||0} advertencia(s)</span></div><div style="display:grid;grid-template-columns:repeat(6,minmax(110px,1fr));gap:7px">${modulos.map(x=>ssTarjeta(x[0],String(x[1]),x[2],x[3])).join('')}</div></section>`;
    const buckets=Object.entries(cap.storage_buckets||{}).map(([nombre,d])=>`<div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #e2e8f0;padding:7px 2px"><b>${ssEsc(nombre)}</b><span>${Number(d.objects)||0} archivo(s) · ${ssTamano(d.bytes)}</span></div>`).join('')||'<span style="color:#94a3b8">No existen archivos registrados.</span>';
    const controles=checks.map(ch=>{const ok=ch.ok,color=ok?'#15803d':ch.severity==='CRITICAL'?'#b91c1c':ch.severity==='WARNING'?'#b45309':'#0369a1',fondo=ok?'#f0fdf4':ch.severity==='CRITICAL'?'#fef2f2':ch.severity==='WARNING'?'#fffbeb':'#eff6ff';return `<div style="display:flex;align-items:center;gap:10px;border:1px solid ${color}35;background:${fondo};border-radius:10px;padding:10px;margin-bottom:7px"><b style="font-size:16px;color:${color}">${ok?'✓':ch.count}</b><div style="flex:1"><b style="font-size:10px;color:#1e293b">${ssEsc(ch.label)}</b><div style="font-size:8px;color:${color};font-weight:900">${ok?'SIN NOVEDADES':`${ch.severity} · ${ch.count} REGISTRO(S) PARA REVISAR`}</div></div></div>`;}).join('');
    document.getElementById('ss-contenido').innerHTML=`${resumen}${capacidad}<div style="display:grid;grid-template-columns:minmax(320px,.8fr) minmax(520px,1.6fr);gap:12px"><section style="background:white;border:1px solid #cbd5e1;border-radius:12px;padding:12px"><h3 style="font-size:11px;margin:0 0 8px">ARCHIVOS POR DEPÓSITO PRIVADO</h3><div style="font-size:9px;color:#475569">${buckets}</div></section><section style="background:white;border:1px solid #cbd5e1;border-radius:12px;padding:12px"><h3 style="font-size:11px;margin:0 0 8px">CONTROLES DE INTEGRIDAD</h3>${controles}</section></div>`;
}

function exportarSaludSistemaPDF() {
    const w=saludSistema.workspace;if(!w)return alert('PRIMERO GENERA EL DIAGNÓSTICO.');
    if(!window.jspdf?.jsPDF)return alert('NO SE PUDO CARGAR LA LIBRERÍA PDF.');
    const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),checks=w.checks||[];
    doc.setFontSize(15);doc.text('ESTADO GENERAL DEL SISTEMA DEFEN',14,14);doc.setFontSize(8);doc.text(`Estado: ${ssEstadoVisual(w.status).texto} · Migración: ${w.migration_level} · Generado: ${ssFecha(w.generated_at)}`,14,20);doc.text(`Base de datos: ${ssTamano(w.capacity?.database_bytes)} · Storage: ${ssTamano(w.capacity?.storage_bytes)} · Archivos: ${w.capacity?.storage_objects||0}`,14,25);
    doc.autoTable({startY:30,head:[['SEVERIDAD','CONTROL','RESULTADO']],body:checks.map(ch=>[ch.severity,ch.label,ch.ok?'CORRECTO':`${ch.count} REGISTRO(S) PARA REVISAR`]),styles:{fontSize:8,cellPadding:2},headStyles:{fillColor:[15,23,42]},columnStyles:{0:{cellWidth:30},1:{cellWidth:175},2:{cellWidth:65}}});
    doc.save(`ESTADO_SISTEMA_DEFEN_${new Date().toISOString().slice(0,10)}.pdf`);
}
