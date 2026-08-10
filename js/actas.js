// ================================================================
// actas.js — Generador de actas de entrega de armamento
// Tipos: Guardia (A4 horizontal con membrete dashboard) y Custodio VIP
// Solo ADMIN y OPERACIONES. Registra cada acta en Google Sheets.
// ================================================================

let armaActaSeleccionada = null;
let actaGenerando = false;

function asegurarModalActas() {
    if (document.getElementById('actas-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'actas-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:21000;background:rgba(15,23,42,.82);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:14px;';
    modal.innerHTML = `
      <div style="width:100%;max-width:980px;max-height:94vh;background:#f8fafc;border-radius:20px;box-shadow:0 32px 90px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column;">
        <div style="background:#0f172a;padding:14px 18px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1"><h2 style="margin:0;color:white;font-size:15px;font-weight:900">📄 Generador de Actas de Armamento</h2>
          <p style="margin:2px 0 0;color:#94a3b8;font-size:10px;font-weight:700">Guardia de Seguridad · Custodio VIP</p></div>
          <button onclick="cerrarGeneradorActa()" style="background:rgba(255,255,255,.1);color:white;border:0;border-radius:9px;padding:7px 11px;font-weight:800;cursor:pointer">✕ Cerrar</button>
        </div>
        <div style="overflow:auto;padding:16px 18px;">
          <div id="acta-error" style="display:none;margin-bottom:10px;padding:9px 12px;border-radius:10px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800"></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
            <div class="acta-card">
              <label class="acta-label">Arma</label>
              <select id="acta-arma" class="acta-input" onchange="cambiarArmaActa(this.value)"></select>
              <div id="acta-arma-resumen" style="margin-top:8px;padding:9px;background:#eef2ff;border-radius:9px;font-size:10px;color:#3730a3;font-weight:700"></div>
            </div>
            <div class="acta-card">
              <label class="acta-label">Tipo de acta</label>
              <select id="acta-tipo" class="acta-input" onchange="actualizarTipoActa()">
                <option value="guardia">GUARDIA DE SEGURIDAD</option>
                <option value="custodio">CUSTODIO VIP</option>
              </select>
              <label class="acta-label" style="margin-top:10px">Fecha del acta</label>
              <input id="acta-fecha" type="date" class="acta-input">
              <label class="acta-label" style="margin-top:10px">Ciudad</label>
              <input id="acta-ciudad" class="acta-input" placeholder="Guayaquil">
            </div>
          </div>

          <h3 class="acta-section">PERSONA QUE RECIBE</h3>
          <div class="acta-card">
            <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;font-size:11px;font-weight:800;color:#334155">
              <label><input type="radio" name="acta-receptor-origen" value="registrado" checked onchange="actualizarModoReceptor()"> Sí, está registrado en Asistencia</label>
              <label><input type="radio" name="acta-receptor-origen" value="manual" onchange="actualizarModoReceptor()"> No, ingresar manualmente</label>
            </div>
            <div id="acta-receptor-registrado" style="margin-top:10px"><select id="acta-agente-select" class="acta-input" onchange="seleccionarAgenteRegistrado()"></select></div>
            <div id="acta-receptor-manual" style="display:none;margin-top:10px;grid-template-columns:2fr 1fr;gap:8px">
              <input id="acta-receptor-nombre" class="acta-input" placeholder="Nombre completo">
              <input id="acta-receptor-cedula" class="acta-input" placeholder="Cédula">
            </div>
          </div>

          <h3 class="acta-section">DATOS DE ENTREGA</h3>
          <div class="acta-card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px">
            <div><label class="acta-label">Municiones</label><input id="acta-municiones" type="number" min="0" value="0" class="acta-input"></div>
            <div><label class="acta-label">Aptitud</label><select id="acta-aptitud" class="acta-input"><option>APTA</option><option>NO APTA</option></select></div>
            <div><label class="acta-label">Permiso / Credencial</label><select id="acta-permiso" class="acta-input"><option>ORIGINAL</option><option>COPIA</option><option>N/A</option></select></div>
            <div><label class="acta-label">Modelo (opcional)</label><input id="acta-modelo" class="acta-input" placeholder="Modelo del arma"></div>
            <div style="grid-column:1/-1"><label class="acta-label">Comentario</label><input id="acta-comentario" class="acta-input" value="SE ENTREGA PERMISO ORIGINAL DEL ARMA"></div>
            <div style="grid-column:1/-1"><label class="acta-label">Novedad</label><input id="acta-novedad" class="acta-input" value="N/A"></div>
          </div>

          <h3 class="acta-section">QUIEN ENTREGA</h3>
          <div class="acta-card">
            <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;font-size:11px;font-weight:800;color:#334155">
              <label><input type="radio" name="acta-supervisor-origen" value="registrado" checked onchange="actualizarModoSupervisor()"> Supervisor registrado</label>
              <label><input type="radio" name="acta-supervisor-origen" value="manual" onchange="actualizarModoSupervisor()"> Escribir manualmente</label>
            </div>
            <div id="acta-supervisor-registrado" style="margin-top:10px;display:grid;grid-template-columns:2fr 1fr;gap:8px"><select id="acta-supervisor-select" class="acta-input"></select><input id="acta-supervisor-cedula-reg" class="acta-input" placeholder="Cédula supervisor (si aplica)"></div>
            <div id="acta-supervisor-manual" style="display:none;margin-top:10px;grid-template-columns:2fr 1fr;gap:8px"><input id="acta-supervisor-nombre" class="acta-input" placeholder="Nombre supervisor"><input id="acta-supervisor-cedula" class="acta-input" placeholder="Cédula supervisor"></div>
          </div>

          <div style="margin-top:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:9px 12px;font-size:10px;color:#9a3412;font-weight:700">
            El código único se asigna al registrar el acta. Las fotografías se toman automáticamente de la credencial y del arma asociadas a la serie seleccionada.
          </div>
        </div>
        <div style="padding:12px 18px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:8px">
          <button onclick="cerrarGeneradorActa()" style="flex:1;padding:10px;border:1px solid #cbd5e1;background:white;color:#475569;border-radius:10px;font-weight:900;cursor:pointer">Cancelar</button>
          <button id="acta-btn-generar" onclick="generarActaArmamento()" style="flex:2;padding:10px;border:0;background:linear-gradient(135deg,#f97316,#ea580c);color:white;border-radius:10px;font-weight:900;cursor:pointer">📄 Registrar y generar PDF</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const style = document.createElement('style');
    style.textContent = `.acta-card{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px}.acta-label{display:block;font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin-bottom:4px}.acta-input{width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;background:white;color:#0f172a;font-size:11px;font-weight:700;outline:none}.acta-input:focus{border-color:#f97316}.acta-section{font-size:10px;letter-spacing:.08em;color:#475569;margin:14px 0 6px;font-weight:900}`;
    document.head.appendChild(style);
}

function abrirGeneradorActa(serie) {
    if (typeof usuarioPuedeGenerarActas === 'function' && !usuarioPuedeGenerarActas()) {
        alert('Solo Operaciones y Administrador pueden generar actas de armamento.'); return;
    }
    if (!tokenSesionActual()) {
        alert('Tu sesión actual no tiene token de seguridad. Cierra sesión e ingresa nuevamente para generar actas.'); return;
    }
    asegurarModalActas();
    const armas = armamentoDetalle.filter(a => normalizarTexto(a.estado) === 'activo');
    const sel = document.getElementById('acta-arma');
    sel.innerHTML = armas.map(a => `<option value="${escAttr(a.serie)}">${escHtml(a.serie||'SIN SERIE')} · ${escHtml(a.tipo||'')} ${escHtml(a.marca||'')} · ${escHtml(a.proyecto||'')}</option>`).join('');
    let elegida = armas.find(a => String(a.serie) === String(serie)) || armas[0] || null;
    if (!elegida) { alert('No hay armas activas disponibles para generar actas.'); return; }
    sel.value = elegida.serie;
    armaActaSeleccionada = elegida;
    document.getElementById('acta-fecha').value = fechaISOHoy();
    document.getElementById('acta-ciudad').value = ciudadSugerida(elegida.provincia);
    cargarDatosArmaActa();
    document.getElementById('actas-modal').style.display = 'flex';
}

function cerrarGeneradorActa() { const m=document.getElementById('actas-modal'); if(m&&!actaGenerando)m.style.display='none'; }
function cambiarArmaActa(serie) { armaActaSeleccionada = armamentoDetalle.find(a => String(a.serie)===String(serie)) || null; cargarDatosArmaActa(); }
function fechaISOHoy(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function ciudadSugerida(prov){const p=normalizarTexto(prov);if(p.includes('guayas'))return 'Guayaquil';if(p.includes('pichincha'))return 'Quito';if(p.includes('manabi'))return 'Manta';if(p.includes('azuay'))return 'Cuenca';return '';}
function escHtml(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function escAttr(s){return escHtml(s).replace(/'/g,'&#39;');}

function cargarDatosArmaActa(){
    const a=armaActaSeleccionada;if(!a)return;
    document.getElementById('acta-arma-resumen').innerHTML=`<b>${escHtml(a.clase||'—')}</b> · ${escHtml(a.tipo||'—')} ${escHtml(a.marca||'')} · Cal. ${escHtml(a.calibre||'—')} · Serie <b>${escHtml(a.serie||'—')}</b><br>${escHtml(a.provincia||'')} · ${escHtml(a.proyecto||'')} · ${escHtml(a.puesto||a.ubicacion||'')}`;
    cargarAgentesActa(); cargarSupervisoresActa();
}

function agentesRegistradosDelArma(a){
    const prov=(a.provincia||'').toUpperCase().trim(), proy=(a.proyecto||'').toUpperCase().trim();
    const puestos=(puestosData[prov]||{})[proy]||[]; const lista=[]; const vistos=new Set();
    puestos.forEach(pu=>{
        const nombres=(pu.rotacionCompleta&&pu.rotacionCompleta.length?pu.rotacionCompleta:(pu.guardia||'').split(',')).map(x=>String(x).trim()).filter(Boolean);
        const pk=(pu.nombre||'').toUpperCase().trim();
        nombres.forEach(n=>{const key=n.toUpperCase();if(vistos.has(key))return;vistos.add(key);lista.push({nombre:n,cedula:(cedulasPorPuesto[pk]&&cedulasPorPuesto[pk][n])||'',puesto:pu.nombre||'',prioridad:normalizarTexto(pu.nombre)===normalizarTexto(a.puesto)?0:1});});
    });
    return lista.sort((x,y)=>x.prioridad-y.prioridad||x.nombre.localeCompare(y.nombre));
}
function cargarAgentesActa(){const sel=document.getElementById('acta-agente-select');const lista=agentesRegistradosDelArma(armaActaSeleccionada);sel.innerHTML=lista.length?lista.map((g,i)=>`<option value="${i}">${escHtml(g.nombre)}${g.cedula?' · CI '+escHtml(g.cedula):''} · ${escHtml(g.puesto)}</option>`).join(''):'<option value="">No hay agentes activos registrados para este proyecto</option>';sel._lista=lista;seleccionarAgenteRegistrado();}
function seleccionarAgenteRegistrado(){const sel=document.getElementById('acta-agente-select');const g=sel&&sel._lista?sel._lista[Number(sel.value)||0]:null;if(g){document.getElementById('acta-receptor-nombre').value=g.nombre;document.getElementById('acta-receptor-cedula').value=g.cedula;}}
function actualizarModoReceptor(){const modo=document.querySelector('input[name="acta-receptor-origen"]:checked').value;document.getElementById('acta-receptor-registrado').style.display=modo==='registrado'?'block':'none';document.getElementById('acta-receptor-manual').style.display=modo==='manual'?'grid':'none';if(modo==='registrado')seleccionarAgenteRegistrado();}

function supervisoresDelArma(a){const det=detalleProvincias[(a.provincia||'').toUpperCase().trim()]||{};const p=(det.proyectosList||[]).find(x=>normalizarTexto(x.nombre)===normalizarTexto(a.proyecto));return (p&&p.supervisores&&p.supervisores.length?p.supervisores:(det.supervisores||[])).filter(Boolean);}
function cargarSupervisoresActa(){const sel=document.getElementById('acta-supervisor-select');const sups=supervisoresDelArma(armaActaSeleccionada);sel.innerHTML=sups.length?sups.map(s=>`<option>${escHtml(s)}</option>`).join(''):'<option value="">Sin supervisor registrado — usa ingreso manual</option>';}
function actualizarModoSupervisor(){const m=document.querySelector('input[name="acta-supervisor-origen"]:checked').value;document.getElementById('acta-supervisor-registrado').style.display=m==='registrado'?'grid':'none';document.getElementById('acta-supervisor-manual').style.display=m==='manual'?'grid':'none';}
function actualizarTipoActa(){const t=document.getElementById('acta-tipo').value;document.getElementById('acta-comentario').value=t==='guardia'?'SE ENTREGA PERMISO ORIGINAL DEL ARMA':'EQUIPO ENTREGADO EN BUENAS CONDICIONES';}

function leerFormularioActa(){
    const a=armaActaSeleccionada, origen=document.querySelector('input[name="acta-receptor-origen"]:checked').value;
    if(origen==='registrado') seleccionarAgenteRegistrado();
    const supOrigen=document.querySelector('input[name="acta-supervisor-origen"]:checked').value;
    const tipo=document.getElementById('acta-tipo').value;
    return {tipoActa:tipo==='custodio'?'CUSTODIO VIP':'GUARDIA',fecha:document.getElementById('acta-fecha').value,ciudad:document.getElementById('acta-ciudad').value.trim(),
      codigoArma:a.codigoArma||'',serie:a.serie||'',clase:a.clase||'',categoria:a.categoria||'',tipoArma:a.tipo||'',marca:a.marca||'',modelo:document.getElementById('acta-modelo').value.trim(),calibre:a.calibre||'',proyecto:a.proyecto||'',provincia:a.provincia||'',puesto:a.puesto||a.ubicacion||'',
      receptorNombre:document.getElementById('acta-receptor-nombre').value.trim(),receptorCedula:document.getElementById('acta-receptor-cedula').value.trim(),receptorOrigen:origen,cargo:tipo==='custodio'?'CUSTODIO VIP':'GUARDIA DE SEGURIDAD',municiones:Number(document.getElementById('acta-municiones').value)||0,aptitud:document.getElementById('acta-aptitud').value,permiso:document.getElementById('acta-permiso').value,comentario:document.getElementById('acta-comentario').value.trim(),novedad:document.getElementById('acta-novedad').value.trim(),
      supervisorNombre:supOrigen==='registrado'?document.getElementById('acta-supervisor-select').value.trim():document.getElementById('acta-supervisor-nombre').value.trim(),supervisorCedula:supOrigen==='registrado'?document.getElementById('acta-supervisor-cedula-reg').value.trim():document.getElementById('acta-supervisor-cedula').value.trim(),urlCredencial:a.urlCredencial||'',urlArma:a.urlImagenArma||''};
}
function validarDatosActa(d){if(!d.receptorNombre)return 'Selecciona o escribe el nombre de la persona que recibe.';if(!d.receptorCedula)return 'La cédula de la persona que recibe es obligatoria.';if(!d.fecha)return 'Selecciona la fecha del acta.';if(!d.ciudad)return 'Escribe la ciudad donde se suscribe el acta.';if(!d.supervisorNombre&&d.tipoActa==='GUARDIA')return 'Para el acta de Guardia indica quién entrega.';return '';}
function mostrarErrorActa(m){const e=document.getElementById('acta-error');e.textContent=m;e.style.display=m?'block':'none';}

async function postActas(payload){const r=await fetch(APPS_SCRIPT_URL,{method:'POST',body:JSON.stringify(payload),redirect:'follow'});return await r.json();}
async function registrarActaServidor(d){return await postActas({accion:'crear_acta_armamento',token:tokenSesionActual(),acta:d});}
async function imagenActaBase64(url){if(!url)return '';try{const j=await postActas({accion:'imagen_acta',token:tokenSesionActual(),url});if(j.ok&&j.base64)return `data:${j.mime||'image/jpeg'};base64,${j.base64}`;}catch(e){console.warn('Imagen acta:',e);}return '';}

async function generarActaArmamento(){
    if(actaGenerando)return; const d=leerFormularioActa(); const err=validarDatosActa(d);if(err){mostrarErrorActa(err);return;} mostrarErrorActa('');
    const btn=document.getElementById('acta-btn-generar');actaGenerando=true;btn.disabled=true;btn.textContent='Generando…';
    try{
        const reg=await registrarActaServidor(d);if(!reg.ok)throw new Error(reg.mensaje||'No se pudo registrar el acta');d.codigoActa=reg.codigo;
        const [cred,arma]=await Promise.all([imagenActaBase64(d.urlCredencial),imagenActaBase64(d.urlArma)]);
        if(d.tipoActa==='CUSTODIO VIP') generarPDFCustodio(d,cred,arma); else generarPDFGuardia(d,cred,arma);
        cerrarModalArmamento(); document.getElementById('actas-modal').style.display='none';
    }catch(e){mostrarErrorActa(e.message||String(e));}
    finally{actaGenerando=false;btn.disabled=false;btn.textContent='📄 Registrar y generar PDF';}
}

function fechaLargaEspanol(iso){const [y,m,d]=String(iso).split('-').map(Number);const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];return `${d} de ${meses[(m||1)-1]} del ${y}`;}
function fechaPalabrasActa(iso){const [y,m,d]=String(iso).split('-').map(Number);const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];return {dia:d,mes:meses[(m||1)-1],anio:y};}
function addTextJustificado(doc,text,x,y,w,fontSize=10,lineH=5.2,boldFragments=[]){doc.setFontSize(fontSize);doc.setFont('helvetica','normal');doc.setTextColor(20,20,20);const lines=doc.splitTextToSize(text,w);doc.text(lines,x,y,{align:'justify',maxWidth:w,lineHeightFactor:1.12});return y+lines.length*lineH;}
function addImagenAjustada(doc,data,x,y,w,h){if(!data)return false;try{const fmt=data.startsWith('data:image/png')?'PNG':'JPEG';const props=doc.getImageProperties(data),r=Math.min(w/props.width,h/props.height),iw=props.width*r,ih=props.height*r;doc.addImage(data,fmt,x+(w-iw)/2,y+(h-ih)/2,iw,ih);return true;}catch(e){return false;}}

function generarPDFGuardia(d,cred,arma){
    const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});const W=297,H=210,DARK=[15,23,42],GRAY=[203,213,225];const fechaFmt=formatFecha(d.fecha);
    dibujarMembretePDF(doc,`Acta de Recepción de Dotaciones · ${d.codigoActa}`,fechaFmt);let y=MARGEN_PDF+7;
    doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(...DARK);doc.text('ACTA DE RECEPCIÓN DE DOTACIONES',W/2,y,{align:'center'});y+=8;
    doc.autoTable({startY:y,margin:{left:14,right:14},theme:'grid',styles:{fontSize:7.8,cellPadding:2.7,valign:'middle'},columnStyles:{0:{fontStyle:'bold',fillColor:GRAY,cellWidth:22},2:{fontStyle:'bold',fillColor:GRAY,cellWidth:26}},body:[['FECHA',fechaLargaEspanol(d.fecha),'CATEGORÍA',`ARMAMENTO - ${normalizarTexto(d.clase).includes('no letal')?'NO LETAL':'LETAL'}`],['NOMBRE',d.receptorNombre,'CÉDULA',d.receptorCedula],['CARGO','GUARDIA DE SEGURIDAD','ÁREA / PROYECTO',d.proyecto||'—']]});y=doc.lastAutoTable.finalY+6;
    doc.autoTable({startY:y,margin:{left:8,right:8},head:[['CANT.','CLASE','VIGILANCIA','TIPO','MARCA','MODELO','CALIBRE','SERIE','APTA/NO APTA','MUNICIONES','COMENTARIO','NOVEDAD']],body:[[1,d.clase||'—',d.categoria||'—',d.tipoArma||'—',d.marca||'—',d.modelo||'—',d.calibre||'—',d.serie||'—',d.aptitud,d.municiones,d.comentario||'—',d.novedad||'—']],headStyles:{fillColor:[71,85,105],textColor:[255,255,255],fontSize:6.2,halign:'center'},styles:{fontSize:6.1,cellPadding:1.7,halign:'center',valign:'middle'}});y=doc.lastAutoTable.finalY+5;
    doc.setFontSize(8.5);doc.setFont('helvetica','bold');doc.text('EVIDENCIA DE DOTACIÓN',14,y);y+=3;
    const boxY=y,boxH=38,boxW=80;doc.setDrawColor(203,213,225);doc.rect(14,boxY,boxW,boxH);doc.rect(101,boxY,boxW,boxH);doc.setFontSize(6.5);doc.text('CREDENCIAL',54,boxY+4,{align:'center'});doc.text('ARMA ENTREGADA',141,boxY+4,{align:'center'});if(!addImagenAjustada(doc,cred,17,boxY+6,74,29)){doc.setFont('helvetica','normal');doc.text('Sin imagen disponible',54,boxY+22,{align:'center'});}if(!addImagenAjustada(doc,arma,104,boxY+6,74,29)){doc.setFont('helvetica','normal');doc.text('Sin imagen disponible',141,boxY+22,{align:'center'});}
    const sigY=boxY+43;doc.autoTable({startY:sigY,margin:{left:14,right:14},theme:'grid',styles:{fontSize:7,cellPadding:2.2,minCellHeight:9},head:[['ENTREGA','','RECIBE','']],body:[['SUPERVISOR',d.supervisorNombre||'—','AGENTE SEGURIDAD',d.receptorNombre],['CI',d.supervisorCedula||'—','CÉDULA',d.receptorCedula],['FIRMA','________________________','FIRMA','________________________']],headStyles:{fillColor:[203,213,225],textColor:[15,23,42],halign:'center'}});
    doc.save(`${d.codigoActa}_GUARDIA_${d.serie}.pdf`);
}

function dibujarPlantillaCustodio(doc,codigo,fecha){const W=210,H=297,ORANGE=[249,115,22],DARK=[30,30,30];doc.setFillColor(...DARK);doc.rect(0,0,46,30,'F');doc.triangle(46,0,70,0,46,30,'F');doc.setFillColor(...ORANGE);doc.triangle(55,0,75,0,59,12,'F');try{doc.addImage(window._LOGO_B64,'PNG',10,5,30,20);}catch(e){}doc.setDrawColor(...ORANGE);doc.setLineWidth(1);doc.line(70,5,205,5);doc.setFillColor(...DARK);doc.rect(0,265,168,32,'F');doc.triangle(168,265,190,297,168,297,'F');doc.setFillColor(...ORANGE);doc.triangle(145,265,162,265,184,297,'F');doc.setTextColor(255,255,255);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text('0959008838',25,285,{align:'center'});doc.text('info@defen.com.ec',85,285,{align:'center'});doc.text('Cdla Álamos II mz k solar 9',140,282,{align:'center'});doc.text('Guayaquil-Ecuador',140,287,{align:'center'});doc.setTextColor(100,100,100);doc.setFontSize(6);doc.text(`${codigo} · ${fecha}`,204,293,{align:'right'});}
function generarPDFCustodio(d,cred,arma){
    const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});const f=fechaPalabrasActa(d.fecha),x=18,w=174;dibujarPlantillaCustodio(doc,d.codigoActa,formatFecha(d.fecha));
    doc.setTextColor(15,15,15);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('DEFEN CIA LTDA',105,34,{align:'center'});doc.text('GUAYAQUIL – ECUADOR',105,40,{align:'center'});doc.setFontSize(11);doc.text('ACTA DE ENTREGA, RECEPCIÓN',105,51,{align:'center'});doc.text('Y USO DE ARMAMENTO',105,57,{align:'center'});doc.setFontSize(10);doc.text(`NO.: ${d.codigoActa}`,18,70);
    let y=82;
    const p1=`En la ciudad de ${d.ciudad}, a los ${f.dia} días del mes de ${f.mes} del año ${f.anio}, se suscribe la presente ACTA DE ENTREGA, RECEPCIÓN Y USO DE ARMAMENTO, mediante la cual se deja constancia de la entrega de un Arma tipo ${d.tipoArma}, clase “${String(d.clase||'').toLowerCase()}”, categoría “${String(d.categoria||'').toLowerCase()}”, calibre ${d.calibre} marca ${d.marca} perteneciente a la compañía de seguridad DEFEN CIA. LTDA., debidamente identificado con el número de serie ${d.serie}.`;
    const p2=`El Sr. ${d.receptorNombre} con CI. ${d.receptorCedula}, de ahora en adelante denominado como “Custodio VIP”, declara haber recibido el equipo en buenas condiciones de funcionamiento, comprometiéndose a su correcta utilización, custodia y conservación durante el tiempo que permanezca bajo su responsabilidad. Cabe recalcar que el departamento de Operaciones dispone evidencia fotográfica del estado del mismo.`;
    const p3='En tal virtud, el custodio recibe el equipo para el cumplimiento de sus funciones laborales, comprometiéndose a utilizarlo, custodiarlo y conservarlo de manera adecuada, conforme a los protocolos internos y a las instrucciones impartidas por la empresa. En caso de pérdida, daño, deterioro o cualquier otro desperfecto que afecte al equipo entregado, la empresa llevará a cabo las investigaciones correspondientes, con el objeto de determinar las causas, circunstancias y eventuales responsabilidades derivadas del hecho. Si como resultado de dichas actuaciones se estableciere que la responsabilidad es imputable al custodio, este asumirá las consecuencias administrativas a que hubiere lugar, de conformidad con lo previsto en el Código del Trabajo, la normativa interna vigente y demás disposiciones aplicables.';
    const p4='Asimismo, el custodio se compromete a no manipular, alterar o intervenir técnicamente el equipo sin la debida autorización, y a reportar de manera inmediata cualquier novedad o falla que se presente durante su uso.';
    const p5='Para constancia de lo anterior, las partes firman el presente documento en señal de aceptación y conformidad.';
    [p1,p2,p3,p4,p5].forEach(t=>{y=addTextJustificado(doc,t,x,y,w,9.6,4.8)+4;});
    doc.addPage();dibujarPlantillaCustodio(doc,d.codigoActa,formatFecha(d.fecha));y=42;doc.setTextColor(20,20,20);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Arma de dotación:',18,y);y+=5;
    doc.autoTable({startY:y,margin:{left:18,right:18},head:[['N°','CLASE','CATEGORÍA','TIPO','MARCA','CALIBRE','SERIE','CANT. MUNICIONES','PERMISO (CREDENCIAL)']],body:[[1,d.clase,d.categoria,d.tipoArma,d.marca,d.calibre,d.serie,d.municiones,d.permiso]],headStyles:{fillColor:[145,145,145],textColor:[255,255,255],fontSize:6.4,halign:'center'},styles:{fontSize:6.4,cellPadding:1.8,halign:'center',valign:'middle'}});y=doc.lastAutoTable.finalY+8;
    doc.setFontSize(7);doc.setTextColor(71,85,105);doc.text('CREDENCIAL',56,y,{align:'center'});doc.text('ARMA',153,y,{align:'center'});doc.setDrawColor(226,232,240);doc.rect(18,y+2,78,45);doc.rect(114,y+2,78,45);if(!addImagenAjustada(doc,cred,20,y+4,74,41))doc.text('Sin imagen disponible',57,y+25,{align:'center'});if(!addImagenAjustada(doc,arma,116,y+4,74,41))doc.text('Sin imagen disponible',153,y+25,{align:'center'});y+=57;
    const cierre=`En fe de lo cual, y habiendo leído íntegramente el contenido del presente documento, las partes intervinientes ratifican su conformidad con cada una de las cláusulas aquí establecidas, firmando en dos ejemplares de igual tenor y valor legal, en la ciudad de ${d.ciudad}, a los ${f.dia} días del mes de ${f.mes} del año ${f.anio}.`;
    y=addTextJustificado(doc,cierre,18,y,174,9.6,4.8)+15;doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('CUSTODIO VIP',18,y);y+=34;doc.setLineWidth(.3);doc.line(18,y,92,y);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`Nombre: ${d.receptorNombre}`,18,y+6);doc.text(`Ci.: ${d.receptorCedula}`,18,y+12);
    doc.save(`${d.codigoActa}_CUSTODIO_${d.serie}.pdf`);
}

// Compatibilidad con botones antiguos que llaman abrirGeneradorActas (plural).
function abrirGeneradorActas(serie) { return abrirGeneradorActa(serie); }
