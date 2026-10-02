// Migración 63 - incidencias, coberturas, justificantes y control de pagos.
(function(){
const turnoNombre={3:'DN · DOBLA TURNO',4:'D · DIURNO',5:'N · NOCTURNO',6:'T · TARDE'};
const horasTurno={3:24,4:12,5:12,6:8};
const esc=window.asistenciaEsc||((v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const id=()=>crypto.randomUUID();

window.cargarCoberturasAsistencia=async function(forzar=false){
  const periodId=asistenciaModulo.workspace?.period?.id;if(!periodId)return null;
  if(!forzar&&asistenciaModulo.coberturas?.period_id===periodId)return asistenciaModulo.coberturas;
  try{const r=await supabaseCargarOperacionesAsistencia(periodId);if(!r||r.schema_version!==2)throw new Error('EJECUTA LA MIGRACIÓN 63 PARA ACTIVAR INCIDENCIAS Y PAGOS.');asistenciaModulo.coberturas=r;renderModuloAsistencia();return r;}
  catch(e){asistenciaModulo.coberturas=null;throw e;}
};

window.editarMarcacionAsistencia=function(assignmentId,dia,codigoActual){
  if(asistenciaModulo.guardando)return;const w=asistenciaModulo.workspace;if(!w?.permissions?.manage||w.period.status!=='OPEN')return;
  const a=w.assignments.find(x=>x.assignment_id===assignmentId),fecha=asistenciaFechaDesdeDia(w.period.month_start,dia),editor=asistenciaEditorElemento();
  editor.innerHTML=`<div class="as-editor-card"><h3>REGISTRAR ASISTENCIA</h3><p>${esc(a?.full_name||'VACANTE')}<br><b>${esc(fecha)}</b></p><div class="as-code-grid">${(w.codes||[]).map(c=>`<button class="${asistenciaCodigoClase(c.code)} ${c.code===codigoActual?'selected':''}" onclick="asSeleccionarCodigoAvanzado('${esc(assignmentId)}',${dia},'${esc(c.code)}')"><b>${esc(asistenciaCodigoVisible(c.code))}</b><small>${esc(c.label)}</small></button>`).join('')}</div><div class="as-editor-actions">${codigoActual?`<button class="danger" onclick="eliminarMarcacionAsistencia('${esc(assignmentId)}',${dia})">BORRAR MARCACIÓN</button>`:''}<button onclick="cerrarEditorAsistencia()">CANCELAR</button></div></div>`;
  editor.style.display='flex';
};

window.asSeleccionarCodigoAvanzado=function(assignmentId,dia,codigo){
  if(codigo==='F'||codigo==='PM')return asAbrirIncidencia(assignmentId,dia,codigo);
  if(codigo==='3')return asAbrirTurnoExtra(assignmentId,dia,codigo);
  return guardarMarcacionAsistencia(assignmentId,dia,codigo);
};

function opcionesPersonal(a,seleccion=''){
  const personas=(asistenciaModulo.coberturas?.personnel||[]).filter(p=>p.id!==a.personnel_id);
  return personas.sort((x,y)=>{
    const xm=(x.project_ids||[]).includes(a.project_id),ym=(y.project_ids||[]).includes(a.project_id);return Number(ym)-Number(xm)||String(x.full_name).localeCompare(String(y.full_name),'es');
  }).map(p=>{const mismo=(p.project_ids||[]).includes(a.project_id),grupo=p.personnel_type==='EXTERNO'?'EXTERNO':mismo?'MISMO PROYECTO':'OTRO PROYECTO';return `<option value="${esc(p.id)}" data-tipo="${esc(p.personnel_type||'INTERNO')}" data-mismo="${mismo?'1':'0'}" ${p.id===seleccion?'selected':''}>[${grupo}] ${esc(p.full_name)} · ${esc(p.projects||'SIN PROYECTO')}</option>`}).join('');
}

window.asFiltrarPersonasCobertura=function(){
  const texto=(document.getElementById('as-av-buscar-persona')?.value||'').trim().toLocaleUpperCase('es');
  const select=document.getElementById('as-av-persona');if(!select)return;
  [...select.options].forEach((op,i)=>{if(i===0)return;op.hidden=texto&&!op.text.toLocaleUpperCase('es').includes(texto);});
};

function asGuardarBorradorAvanzado(modo,assignmentId,dia='',codigo=''){
  return {modo,assignmentId,dia,codigo,inicio:document.getElementById('as-av-inicio')?.value||'',fin:document.getElementById('as-av-fin')?.value||'',
    turno:document.getElementById('as-av-turno')?.value||'4',horas:document.getElementById('as-av-horas')?.value||'12',pago:document.getElementById('as-av-pago')?.value||'DIA_TRABAJADO',
    motivo:document.getElementById('as-av-motivo')?.value||'',nota:document.getElementById('as-av-nota')?.value||''};
}

window.asAbrirPersonalExterno=function(modo,assignmentId,dia='',codigo=''){
  const borrador=asGuardarBorradorAvanzado(modo,assignmentId,dia,codigo),e=asistenciaEditorElemento();window.asBorradorExterno=borrador;
  e.innerHTML=`<div class="as-editor-card as-coverage-form"><h3>AGREGAR PERSONAL EXTERNO / APOYO</h3><p>LA CÉDULA EVITA DUPLICAR PERSONAS YA REGISTRADAS.</p><div class="as-form-grid"><label class="as-form-wide">NOMBRES Y APELLIDOS<input id="as-ext-nombre" maxlength="150" placeholder="NOMBRE COMPLETO"></label><label>CÉDULA<input id="as-ext-cedula" inputmode="numeric" maxlength="10" placeholder="10 DÍGITOS"></label><label>TIPO<select id="as-ext-tipo"><option value="EXTERNO">EXTERNO · DÍA TRABAJADO</option><option value="INTERNO">INTERNO DE APOYO</option></select></label></div><div class="as-editor-actions"><button class="primary" onclick="asGuardarPersonalExterno()">AGREGAR Y SELECCIONAR</button><button onclick="asVolverCoberturaExterna()">VOLVER</button></div></div>`;e.style.display='flex';
  const ci=document.getElementById('as-ext-cedula');ci.oninput=()=>{ci.value=ci.value.replace(/\D/g,'').slice(0,10);};
};

window.asVolverCoberturaExterna=async function(personnelId=''){
  const b=window.asBorradorExterno;if(!b)return cerrarEditorAsistencia();
  if(b.modo==='INCIDENTE')await asAbrirIncidencia(b.assignmentId,b.dia,b.codigo);else await abrirNuevaCoberturaAsistencia(b.assignmentId);
  const valores={"as-av-inicio":b.inicio,"as-av-fin":b.fin,"as-av-turno":b.turno,"as-av-horas":b.horas,"as-av-pago":b.pago,"as-av-nota":b.nota,"as-av-motivo":b.motivo,"as-av-persona":personnelId};
  Object.entries(valores).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&v)el.value=v;});asActualizarCoberturaCampos();
};

window.asGuardarPersonalExterno=async function(){
  if(asistenciaModulo.guardando)return;const nombre=document.getElementById('as-ext-nombre')?.value.trim().toUpperCase(),cedula=document.getElementById('as-ext-cedula')?.value.trim(),tipo=document.getElementById('as-ext-tipo')?.value;
  if(!nombre||nombre.length<5||!/^\d{10}$/.test(cedula||''))return alert('INGRESA EL NOMBRE COMPLETO Y UNA CÉDULA DE 10 DÍGITOS.');
  asistenciaModulo.guardando=true;try{const r=await supabaseRpc('create_attendance_support_personnel',{p_national_id:cedula,p_full_name:nombre,p_personnel_type:tipo});if(!r?.personnel?.id)throw new Error('NO SE RECIBIÓ LA PERSONA.');await cargarCoberturasAsistencia(true);asistenciaModulo.guardando=false;await asVolverCoberturaExterna(r.personnel.id);alert(r.already_existed?'LA PERSONA YA EXISTÍA Y FUE SELECCIONADA.':'PERSONAL DE APOYO AGREGADO.');}catch(e){alert('NO SE PUDO AGREGAR: '+(e.message||e));}finally{asistenciaModulo.guardando=false;}
};

window.asActualizarCoberturaCampos=function(){
  const turno=document.getElementById('as-av-turno')?.value,horas=document.getElementById('as-av-horas');if(horas&&turno)horas.value=horasTurno[turno]||12;
  const op=document.getElementById('as-av-persona')?.selectedOptions?.[0],pago=document.getElementById('as-av-pago');if(op&&pago){if(op.dataset.tipo==='EXTERNO'||op.dataset.mismo!=='1')pago.value='DIA_TRABAJADO';else if(!pago.value||pago.value==='DIA_TRABAJADO')pago.value='ROL';}
};

window.asAbrirIncidencia=async function(assignmentId,dia,codigo){
  try{const datos=await cargarCoberturasAsistencia(false),a=asistenciaModulo.workspace.assignments.find(x=>x.assignment_id===assignmentId);if(!a)throw new Error('NO SE ENCONTRÓ LA PERSONA.');
    const fecha=asistenciaFechaDesdeDia(asistenciaModulo.workspace.period.month_start,dia),tipo=codigo==='F'?'FALTA_INJUSTIFICADA':'PERMISO_MEDICO',editor=asistenciaEditorElemento();
    editor.innerHTML=`<div class="as-editor-card as-coverage-form as-advanced-form"><h3>${codigo==='F'?'FALTA INJUSTIFICADA':'PERMISO MÉDICO'}</h3><p><b>${esc(a.full_name)}</b><br>${esc([a.project,a.post].filter(Boolean).join(' · '))}</p><div class="as-form-grid"><label>DESDE<input id="as-av-inicio" type="date" min="${esc(asistenciaModulo.workspace.period.month_start)}" max="${esc(asistenciaFinPeriodo())}" value="${fecha}"></label><label>HASTA<input id="as-av-fin" type="date" min="${fecha}" max="${esc(asistenciaFinPeriodo())}" value="${fecha}"></label><label class="as-form-wide">QUIÉN CUBRE ${codigo==='PM'?'(OPCIONAL AL INICIO)':'(OBLIGATORIO)'}<input id="as-av-buscar-persona" placeholder="ESCRIBE EL NOMBRE PARA FILTRAR" oninput="asFiltrarPersonasCobertura()"><div class="as-personnel-picker"><select id="as-av-persona" onchange="asActualizarCoberturaCampos()"><option value="">${codigo==='PM'?'PENDIENTE / SIN COBERTURA TODAVÍA':'SELECCIONA PERSONAL…'}</option>${opcionesPersonal(a)}</select><button type="button" onclick="asAbrirPersonalExterno('INCIDENTE','${esc(assignmentId)}','${dia}','${codigo}')">＋ PERSONAL EXTERNO</button></div><small>LOS AGENTES DEL MISMO PROYECTO CONSERVAN UNA SOLA FILA.</small></label><label>TURNO CUBIERTO<select id="as-av-turno" onchange="asActualizarCoberturaCampos()"><option value="4">D · DIURNO</option><option value="5">N · NOCTURNO</option><option value="3">DN · DOBLA TURNO</option><option value="6">T · TARDE</option></select></label><label>HORAS POR DÍA<input id="as-av-horas" type="number" min="1" max="24" step="0.5" value="12"></label><label>RECONOCIMIENTO<select id="as-av-pago"><option value="ROL">PAGO ROL</option><option value="DIA_TRABAJADO">DÍA TRABAJADO</option><option value="NO_PAGADO">NO PAGADO</option></select></label><label>JUSTIFICANTE<input id="as-av-documento" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></label><label class="as-form-wide">OBSERVACIÓN<textarea id="as-av-nota" rows="3" maxlength="500" placeholder="DETALLE DE LA NOVEDAD Y COBERTURA"></textarea></label></div>${codigo==='PM'?'<div class="as-document-warning">⚠ El permiso médico quedará como PENDIENTE hasta subir su justificante.</div>':''}<div class="as-editor-actions"><button class="primary" onclick="asGuardarIncidencia('${esc(assignmentId)}','${tipo}')">GUARDAR NOVEDAD</button><button onclick="cerrarEditorAsistencia()">CANCELAR</button></div></div>`;
    editor.style.display='flex';
  }catch(e){alert('NO SE PUDO PREPARAR LA NOVEDAD: '+(e.message||e));}
};

window.asGuardarIncidencia=async function(assignmentId,tipo){
  if(asistenciaModulo.guardando)return;const persona=document.getElementById('as-av-persona')?.value||'',archivo=document.getElementById('as-av-documento')?.files?.[0]||null;
  if(tipo==='FALTA_INJUSTIFICADA'&&!persona)return alert('DEBES INDICAR QUÉ AGENTE CUBRIÓ LA FALTA.');
  if(tipo==='PERMISO_MEDICO'&&!archivo&&!confirm('NO HAS SUBIDO EL JUSTIFICANTE MÉDICO. ¿GUARDAR COMO PENDIENTE PARA ADJUNTARLO DESPUÉS?'))return;
  const payload={request_id:id(),assignment_id:assignmentId,incident_type:tipo,start_date:document.getElementById('as-av-inicio').value,end_date:document.getElementById('as-av-fin').value,replacement_personnel_id:persona||null,shift_code:document.getElementById('as-av-turno').value,hours_per_day:Number(document.getElementById('as-av-horas').value),payment_type:document.getElementById('as-av-pago').value,note:document.getElementById('as-av-nota').value.trim()||null,document_path:null};
  if(!payload.start_date||!payload.end_date||payload.end_date<payload.start_date)return alert('REVISA EL RANGO DE FECHAS.');
  asistenciaModulo.guardando=true;let ruta='';try{if(archivo){ruta=await supabaseSubirDocumentoAsistencia(archivo,'justificantes');payload.document_path=ruta;}await supabaseGuardarIncidenciaAsistencia(payload);cerrarEditorAsistencia();await refrescarCoberturasAsistencia();alert(tipo==='PERMISO_MEDICO'&&!ruta?'PERMISO REGISTRADO. QUEDA PENDIENTE SUBIR EL JUSTIFICANTE.':'NOVEDAD Y COBERTURA REGISTRADAS.');}catch(e){if(ruta)try{await supabaseEliminarDocumentoAsistencia(ruta)}catch(_){}alert('NO SE PUDO GUARDAR: '+(e.message||e));}finally{asistenciaModulo.guardando=false;}
};

window.asAbrirTurnoExtra=function(assignmentId,dia,codigo='3'){
  const a=asistenciaModulo.workspace.assignments.find(x=>x.assignment_id===assignmentId),fecha=asistenciaFechaDesdeDia(asistenciaModulo.workspace.period.month_start,dia),editor=asistenciaEditorElemento();
  editor.innerHTML=`<div class="as-editor-card as-coverage-form"><h3>JUSTIFICAR TURNO ADICIONAL</h3><p><b>${esc(a?.full_name||'')}</b> · ${esc(fecha)}<br>Si existe una vacante, falta o permiso, indícalo como respaldo del doble turno.</p><div class="as-form-grid"><label>MOTIVO<select id="as-extra-referencia"><option value="VACANTE">VACANTE</option><option value="FALTA_INJUSTIFICADA">FALTA INJUSTIFICADA</option><option value="PERMISO_MEDICO">PERMISO MÉDICO</option><option value="OTRO">OTRO</option></select></label><label>RECONOCIMIENTO<select id="as-extra-pago"><option value="ROL">PAGO ROL</option><option value="DIA_TRABAJADO">DÍA TRABAJADO</option><option value="NO_PAGADO">NO PAGADO</option></select></label><label>HORAS<input id="as-extra-horas" type="number" min="1" max="24" step="0.5" value="24"></label><label class="as-form-wide">DETALLE<input id="as-extra-motivo" maxlength="300" placeholder="EJ.: CUBRE VACANTE DEL PUESTO 2"></label></div><div class="as-editor-actions"><button class="primary" onclick="asGuardarTurnoExtra('${esc(assignmentId)}','${fecha}','${codigo}')">GUARDAR DOBLADA</button><button onclick="cerrarEditorAsistencia()">CANCELAR</button></div></div>`;editor.style.display='flex';
};

window.asGuardarTurnoExtra=async function(assignmentId,fecha,codigo){
  const motivo=document.getElementById('as-extra-motivo').value.trim();if(motivo.length<3)return alert('EXPLICA POR QUÉ SE REALIZA EL DOBLE TURNO.');
  asistenciaModulo.guardando=true;try{await supabaseGuardarTurnoExtraAsistencia({request_id:id(),assignment_id:assignmentId,attendance_date:fecha,shift_code:codigo,reference_type:document.getElementById('as-extra-referencia').value,payment_type:document.getElementById('as-extra-pago').value,hours:Number(document.getElementById('as-extra-horas').value),reason:motivo});cerrarEditorAsistencia();await refrescarCoberturasAsistencia();}catch(e){alert('NO SE PUDO GUARDAR EL TURNO: '+(e.message||e));}finally{asistenciaModulo.guardando=false;}
};

window.abrirNuevaCoberturaAsistencia=async function(assignmentId){
  try{const datos=await cargarCoberturasAsistencia(false),a=asistenciaModulo.workspace.assignments.find(x=>x.assignment_id===assignmentId);if(!a)throw new Error('ASIGNACIÓN NO ENCONTRADA.');if(coberturaActivaParaAsignacion(assignmentId))return alert('ESTA FILA YA TIENE UNA COBERTURA ACTIVA. FINALÍZALA ANTES DE CREAR OTRA.');
    const inicio=asistenciaHoyEcuador(),fin=asistenciaFinPeriodo(),esVacante=a.status==='VACANTE',editor=asistenciaEditorElemento();editor.innerHTML=`<div class="as-editor-card as-coverage-form as-advanced-form"><h3>${esVacante?'CUBRIR VACANTE':'CREAR COBERTURA TEMPORAL'}</h3><p><b>${esc(a.full_name||'VACANTE')}</b><br>${esc([a.project,a.post].filter(Boolean).join(' · '))}</p><div class="as-form-grid"><label class="as-form-wide">PERSONA QUE CUBRE<input id="as-av-buscar-persona" placeholder="ESCRIBE EL NOMBRE PARA FILTRAR" oninput="asFiltrarPersonasCobertura()"><div class="as-personnel-picker"><select id="as-av-persona" onchange="asActualizarCoberturaCampos()"><option value="">SELECCIONA PERSONAL…</option>${opcionesPersonal(a)}</select><button type="button" onclick="asAbrirPersonalExterno('COBERTURA','${esc(assignmentId)}')">＋ PERSONAL EXTERNO</button></div><small>MISMO PROYECTO: USA SU FILA ACTUAL. EXTERNO U OTRO PROYECTO: CREA UNA FILA APOYO.</small></label><label>MOTIVO<select id="as-av-motivo">${esVacante?'<option value="VACANTE">VACANTE</option>':'<option value="PERMISO_MEDICO">PERMISO MÉDICO</option><option value="FALTA_INJUSTIFICADA">FALTA INJUSTIFICADA</option><option value="OTRO">OTRO</option>'}</select></label><label>DESDE<input id="as-av-inicio" type="date" min="${esc(asistenciaModulo.workspace.period.month_start)}" max="${esc(fin)}" value="${esc(inicio)}"></label><label>HASTA<input id="as-av-fin" type="date" min="${esc(inicio)}" value="${esc(fin)}"></label><label>TURNO<select id="as-av-turno" onchange="asActualizarCoberturaCampos()"><option value="4">D · DIURNO</option><option value="5">N · NOCTURNO</option><option value="3">DN · DOBLA TURNO</option><option value="6">T · TARDE</option></select></label><label>HORAS / DÍA<input id="as-av-horas" type="number" min="1" max="24" step="0.5" value="12"></label><label>RECONOCIMIENTO<select id="as-av-pago"><option value="ROL">PAGO ROL</option><option value="DIA_TRABAJADO">DÍA TRABAJADO</option><option value="NO_PAGADO">NO PAGADO</option></select></label><label class="as-form-wide">OBSERVACIÓN<textarea id="as-av-nota" rows="3"></textarea></label></div><div class="as-editor-actions"><button class="primary" onclick="asGuardarCoberturaV2('${esc(assignmentId)}')">GUARDAR COBERTURA</button><button onclick="cerrarEditorAsistencia()">CANCELAR</button></div></div>`;editor.style.display='flex';
  }catch(e){alert('NO SE PUDO PREPARAR LA COBERTURA: '+(e.message||e));}
};

window.asGuardarCoberturaV2=async function(assignmentId){
  const p={request_id:id(),target_assignment_id:assignmentId,replacement_personnel_id:document.getElementById('as-av-persona').value,reason:document.getElementById('as-av-motivo').value,start_date:document.getElementById('as-av-inicio').value,end_date:document.getElementById('as-av-fin').value,shift_code:document.getElementById('as-av-turno').value,hours_per_day:Number(document.getElementById('as-av-horas').value),payment_type:document.getElementById('as-av-pago').value,note:document.getElementById('as-av-nota').value.trim()||null};if(!p.replacement_personnel_id||!p.start_date||!p.end_date)return alert('COMPLETA PERSONA Y FECHAS.');asistenciaModulo.guardando=true;try{await supabaseGuardarCoberturaAsistenciaV2(p);cerrarEditorAsistencia();await refrescarCoberturasAsistencia();alert('COBERTURA Y TURNOS REGISTRADOS.');}catch(e){alert('NO SE PUDO CREAR LA COBERTURA: '+(e.message||e));}finally{asistenciaModulo.guardando=false;}
};

window.asAbrirDocumento=async function(ruta){try{const url=await supabaseUrlFirmadaDocumentoAsistencia(decodeURIComponent(ruta),300);window.open(url,'_blank','noopener');}catch(e){alert(e.message||e);}};
window.asAdjuntarPendiente=async function(incidentId){const input=document.createElement('input');input.type='file';input.accept='application/pdf,image/jpeg,image/png,image/webp';input.onchange=async()=>{const archivo=input.files?.[0];if(!archivo)return;let ruta='';try{ruta=await supabaseSubirDocumentoAsistencia(archivo,'justificantes');await supabaseAdjuntarJustificanteAsistencia(incidentId,ruta);await cargarCoberturasAsistencia(true);await abrirGestorCoberturasAsistencia();}catch(e){if(ruta)try{await supabaseEliminarDocumentoAsistencia(ruta)}catch(_){}alert('NO SE PUDO ADJUNTAR: '+(e.message||e));}};input.click();};

window.abrirGestorCoberturasAsistencia=async function(){
  try{const d=await cargarCoberturasAsistencia(true),inc=d.incidents||[],cov=d.coverages||[],pag=d.payment_summary||[];const incidentes=inc.map(i=>`<article class="as-coverage-card"><div class="as-coverage-card-head"><span class="as-coverage-state ${i.document_path?'as-coverage-state-activa':'as-coverage-state-programada'}">${i.document_path?'RESPALDADO':'PENDIENTE'}</span><b>${esc(String(i.incident_type).replaceAll('_',' '))}</b></div><h4>${esc(i.full_name)}</h4><p>${esc(i.project)} · ${esc(i.post)} · ${esc(asistenciaFechaLocal(i.start_date))} A ${esc(asistenciaFechaLocal(i.end_date))}</p><div class="as-card-actions">${i.document_path?`<button onclick="asAbrirDocumento('${encodeURIComponent(i.document_path)}')">VER JUSTIFICANTE</button>`:`<button class="danger" onclick="asAdjuntarPendiente('${esc(i.id)}')">SUBIR JUSTIFICANTE</button>`}</div></article>`).join('')||'<div class="as-empty-coverages">SIN FALTAS O PERMISOS REGISTRADOS.</div>';
    const coberturas=cov.map(c=>`<article class="as-coverage-card"><div class="as-coverage-card-head"><span class="as-coverage-state as-coverage-state-${esc(String(c.status).toLowerCase())}">${esc(c.status)}</span><b>${esc(String(c.reason).replaceAll('_',' '))}</b></div><h4>${esc(c.target_name||'VACANTE')} <span>→</span> ${esc(c.replacement_name)}</h4><p>${esc(c.project)} · ${esc(c.post)}</p><p>${esc(turnoNombre[c.shift_code]||'TURNO PENDIENTE')} · <b>${esc(c.hours_per_day||0)} H/DÍA</b> · ${esc(String(c.payment_type||'SIN CLASIFICAR').replaceAll('_',' '))}</p><p>${asistenciaFechaLocal(c.start_date)} A ${asistenciaFechaLocal(c.actual_end_date||c.planned_end_date)} · TOTAL ${esc(c.total_hours||0)} H</p>${['ACTIVA','PROGRAMADA'].includes(c.status)&&d.permissions?.manage?`<button class="danger" onclick="abrirCancelarCoberturaAsistencia('${esc(c.id)}')">FINALIZAR / CAMBIAR APOYO</button>`:''}</article>`).join('')||'<div class="as-empty-coverages">SIN COBERTURAS.</div>';
    const pagos=pag.map(x=>`<div class="as-payment-row"><b>${esc(x.full_name)}</b><span>${esc(String(x.payment_type).replaceAll('_',' '))}</span><strong>${esc(x.shifts)} TURNO(S) · ${esc(x.hours)} H</strong></div>`).join('')||'<div class="as-empty-coverages">SIN TURNOS ADICIONALES.</div>';
    const e=asistenciaEditorElemento();e.innerHTML=`<div class="as-editor-card as-coverage-manager as-operations-manager"><div class="as-manager-head"><div><h3>INCIDENCIAS, COBERTURAS Y PAGOS</h3><p>${asistenciaMesEtiqueta(d.month_start)}</p></div><button onclick="cerrarEditorAsistencia()">✕ CERRAR</button></div><h4>FALTAS Y PERMISOS / JUSTIFICANTES</h4><div class="as-coverage-list">${incidentes}</div><h4>COBERTURAS Y TURNOS</h4><div class="as-coverage-list">${coberturas}</div><h4>RESUMEN PARA PAGOS</h4><div class="as-payment-list">${pagos}</div></div>`;e.style.display='flex';
  }catch(e){alert('NO SE PUDO CARGAR EL CONTROL: '+(e.message||e));}
};

window.cancelarCoberturaAsistencia=async function(coverageId){
  if(asistenciaModulo.guardando)return;const fecha=document.getElementById('as-cancelar-fecha')?.value,motivo=document.getElementById('as-cancelar-motivo')?.value.trim();if(!fecha||!motivo)return alert('LA FECHA EFECTIVA Y EL MOTIVO SON OBLIGATORIOS.');if(!confirm('¿FINALIZAR ESTA COBERTURA EN LA FECHA INDICADA? PODRÁS REGISTRAR OTRO APOYO DESPUÉS.'))return;asistenciaModulo.guardando=true;try{await supabaseFinalizarCoberturaAsistencia(coverageId,fecha,motivo);cerrarEditorAsistencia();await refrescarCoberturasAsistencia();await abrirGestorCoberturasAsistencia();}catch(e){alert('NO SE PUDO FINALIZAR: '+(e.message||e));}finally{asistenciaModulo.guardando=false;}
};

const datosOriginal=window.asistenciaDatosReporteMensual;
window.asistenciaDatosReporteMensual=function(){const d=datosOriginal();d.incidents=asistenciaModulo.coberturas?.incidents||[];d.extraShifts=asistenciaModulo.coberturas?.extra_shifts||[];d.paymentSummary=asistenciaModulo.coberturas?.payment_summary||[];return d;};
})();
