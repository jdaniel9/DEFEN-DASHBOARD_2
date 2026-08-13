// ================================================================
// actas.js — Generador de actas de entrega de armamento (V2)
// Guardia: A4 horizontal con membrete del dashboard.
// Custodio: plantilla corporativa vertical de 2 páginas.
// Solo ADMIN y OPERACIONES.
// ================================================================

let armaActaSeleccionada = null;
let actaGenerando = false;
let agentesActaFiltrados = [];
let agenteActaSeleccionado = null;

// Ajusta esta lista si aparecen nuevas denominaciones de personal VIP/custodio.
const ACTAS_KEYWORDS_CUSTODIO = [
    'custodio', 'dotacion personal', 'prefectura vip', 'vip', 'escolta'
];

function asegurarModalActas() {
    if (document.getElementById('actas-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'actas-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:21000;background:rgba(15,23,42,.82);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:14px;';
    modal.innerHTML = `
      <div style="width:100%;max-width:1020px;max-height:94vh;background:#f8fafc;border-radius:20px;box-shadow:0 32px 90px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column;">
        <div style="background:#0f172a;padding:14px 18px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1"><h2 style="margin:0;color:white;font-size:15px;font-weight:900">📄 Generador de Actas de Armamento</h2>
          <p style="margin:2px 0 0;color:#94a3b8;font-size:10px;font-weight:700">Guardia de Seguridad · Custodio / VIP</p></div>
          <button onclick="cerrarGeneradorActa()" style="background:rgba(255,255,255,.1);color:white;border:0;border-radius:9px;padding:7px 11px;font-weight:800;cursor:pointer">✕ Cerrar</button>
        </div>
        <div style="overflow:auto;padding:16px 18px;">
          <div id="acta-error" style="display:none;margin-bottom:10px;padding:9px 12px;border-radius:10px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800"></div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
            <div class="acta-card">
              <label class="acta-label">Arma — todo el inventario</label>
              <input id="acta-arma-busqueda" class="acta-input" list="acta-armas-list"
                     autocomplete="off" placeholder="Escribe la serie, código, marca o tipo..."
                     oninput="buscarArmaActa(this.value)" onchange="seleccionarArmaPorBusqueda(this.value)">
              <datalist id="acta-armas-list"></datalist>
              <p style="font-size:9px;color:#64748b;margin:5px 0 0">Incluye armas en Rastrillo, Activo, Tránsito y demás estados.</p>
              <div id="acta-arma-resumen" style="margin-top:8px;padding:9px;background:#eef2ff;border-radius:9px;font-size:10px;color:#3730a3;font-weight:700">Selecciona un arma.</div>
            </div>
            <div class="acta-card">
              <label class="acta-label">Tipo de acta</label>
              <select id="acta-tipo" class="acta-input" onchange="actualizarTipoActa()">
                <option value="guardia">GUARDIA DE SEGURIDAD</option>
                <option value="custodio">CUSTODIO / VIP</option>
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

            <div id="acta-receptor-registrado" style="margin-top:10px">
              <input id="acta-agente-busqueda" class="acta-input" placeholder="🔎 Buscar por nombre, cédula, proyecto o puesto..." oninput="filtrarAgentesActa(this.value)" style="margin-bottom:7px">
              <select id="acta-agente-select" class="acta-input" size="5" onchange="seleccionarAgenteRegistrado()"></select>
              <p id="acta-agentes-ayuda" style="font-size:9px;color:#64748b;margin:5px 0 0"></p>
            </div>

            <div id="acta-receptor-manual" style="display:none;margin-top:10px;grid-template-columns:2fr 1fr;gap:8px">
              <input id="acta-receptor-nombre" class="acta-input" placeholder="Nombre completo">
              <input id="acta-receptor-cedula" class="acta-input" placeholder="Cédula">
            </div>

            <div style="margin-top:9px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">
              <div>
                <label class="acta-label">Cargo</label>
                <select id="acta-cargo-select" class="acta-input" onchange="actualizarCargoActa()"></select>
                <input id="acta-cargo-otro" class="acta-input" placeholder="Escribe el cargo" style="display:none;margin-top:6px">
              </div>
              <div><label class="acta-label">Área / Proyecto de destino</label><input id="acta-proyecto-destino" class="acta-input" placeholder="Proyecto"></div>
              <div><label class="acta-label">Puesto / Área</label><input id="acta-puesto-destino" class="acta-input" placeholder="Puesto o área"></div>
              <div><label class="acta-label">Provincia</label><input id="acta-provincia-destino" class="acta-input" placeholder="Provincia"></div>
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

          <div id="acta-seccion-entrega">
            <h3 class="acta-section">QUIEN ENTREGA</h3>
            <div class="acta-card">
              <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;font-size:11px;font-weight:800;color:#334155">
                <label><input type="radio" name="acta-supervisor-origen" value="registrado" checked onchange="actualizarModoSupervisor()"> Supervisor registrado</label>
                <label><input type="radio" name="acta-supervisor-origen" value="manual" onchange="actualizarModoSupervisor()"> Escribir manualmente</label>
              </div>
              <div id="acta-supervisor-registrado" style="margin-top:10px;display:grid;grid-template-columns:2fr 1fr;gap:8px"><select id="acta-supervisor-select" class="acta-input"></select><input id="acta-supervisor-cedula-reg" class="acta-input" placeholder="Cédula supervisor (si aplica)"></div>
              <div id="acta-supervisor-manual" style="display:none;margin-top:10px;grid-template-columns:2fr 1fr;gap:8px"><input id="acta-supervisor-nombre" class="acta-input" placeholder="Nombre supervisor"><input id="acta-supervisor-cedula" class="acta-input" placeholder="Cédula supervisor"></div>
            </div>
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
    cargarListadoArmasActa();
    limpiarFormularioActa();

    if (serie) {
        const encontrada = armamentoDetalle.find(a => String(a.serie||'').trim() === String(serie).trim());
        if (encontrada) seleccionarArmaActa(encontrada);
    }

    document.getElementById('acta-fecha').value = fechaISOHoy();
    actualizarTipoActa();
    document.getElementById('actas-modal').style.display = 'flex';
}

function limpiarFormularioActa() {
    armaActaSeleccionada = null;
    agenteActaSeleccionado = null;
    const ids=['acta-arma-busqueda','acta-agente-busqueda','acta-receptor-nombre','acta-receptor-cedula','acta-proyecto-destino','acta-puesto-destino','acta-provincia-destino','acta-cargo-otro','acta-modelo'];
    ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('acta-arma-resumen').innerHTML='Selecciona un arma.';
    document.querySelector('input[name="acta-receptor-origen"][value="registrado"]').checked=true;
    document.querySelector('input[name="acta-supervisor-origen"][value="registrado"]').checked=true;
    document.getElementById('acta-municiones').value='0';
    document.getElementById('acta-aptitud').value='APTA';
    document.getElementById('acta-permiso').value='ORIGINAL';
    document.getElementById('acta-comentario').value='SE ENTREGA PERMISO ORIGINAL DEL ARMA';
    document.getElementById('acta-novedad').value='N/A';
    actualizarModoReceptor();
}

function cerrarGeneradorActa(){const m=document.getElementById('actas-modal');if(m&&!actaGenerando)m.style.display='none';}
function fechaISOHoy(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function ciudadSugerida(prov){const p=normalizarTexto(prov);if(p.includes('guayas'))return 'Guayaquil';if(p.includes('pichincha'))return 'Quito';if(p.includes('manabi'))return 'Manta';if(p.includes('azuay'))return 'Cuenca';return '';}
function escHtml(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function escAttr(s){return escHtml(s).replace(/'/g,'&#39;');}

// ----------------------------------------------------------------
// ARMAS — buscador sobre TODO el inventario, no solo Activo/asignado.
// ----------------------------------------------------------------
function armasDisponiblesActa(){
    const orden={rastrillo:0,activo:1,transito:2,perdida:3,confiscada:4};
    return [...armamentoDetalle]
      .filter(a=>a && (a.serie || a.codigoArma))
      .sort((a,b)=>(orden[normalizarTexto(a.estado)]??9)-(orden[normalizarTexto(b.estado)]??9) || String(a.serie||'').localeCompare(String(b.serie||'')));
}

function cargarListadoArmasActa(){
    const dl=document.getElementById('acta-armas-list');
    dl.innerHTML=armasDisponiblesActa().map(a=>{
        const extra=[a.estado,a.codigoArma,a.tipo,a.marca,a.calibre,a.provincia,a.proyecto].filter(Boolean).join(' · ');
        return `<option value="${escAttr(a.serie||a.codigoArma||'')}">${escHtml(extra)}</option>`;
    }).join('');
}

function buscarArmaActa(valor){
    const q=normalizarTexto(valor);
    if(!q)return;
    const exacta=armasDisponiblesActa().find(a=>normalizarTexto(a.serie)===q || normalizarTexto(a.codigoArma)===q);
    if(exacta)seleccionarArmaActa(exacta);
}

function seleccionarArmaPorBusqueda(valor){
    const q=normalizarTexto(valor);
    if(!q)return;
    const armas=armasDisponiblesActa();
    let a=armas.find(x=>normalizarTexto(x.serie)===q || normalizarTexto(x.codigoArma)===q);
    if(!a){
        const candidatas=armas.filter(x=>[x.serie,x.codigoArma,x.marca,x.tipo,x.calibre].some(v=>normalizarTexto(v).includes(q)));
        if(candidatas.length===1)a=candidatas[0];
    }
    if(a)seleccionarArmaActa(a);
    else mostrarErrorActa('Selecciona una serie válida del listado de armas.');
}

function seleccionarArmaActa(a){
    armaActaSeleccionada=a;
    document.getElementById('acta-arma-busqueda').value=a.serie||a.codigoArma||'';
    document.getElementById('acta-arma-resumen').innerHTML=`
      <span style="display:inline-block;background:${normalizarTexto(a.estado)==='rastrillo'?'#e2e8f0':'#dcfce7'};color:#334155;border-radius:999px;padding:2px 7px;margin-bottom:4px">${escHtml(a.estado||'SIN ESTADO')}</span><br>
      <b>${escHtml(a.clase||'—')}</b> · ${escHtml(a.tipo||'—')} ${escHtml(a.marca||'')} · Cal. ${escHtml(a.calibre||'—')} · Serie <b>${escHtml(a.serie||'—')}</b><br>
      ${escHtml(a.provincia||'')} ${a.proyecto?'· '+escHtml(a.proyecto):''} ${a.puesto?'· '+escHtml(a.puesto):''}`;
    if(!document.getElementById('acta-ciudad').value)document.getElementById('acta-ciudad').value=ciudadSugerida(a.provincia);
    mostrarErrorActa('');
}

// ----------------------------------------------------------------
// PERSONAL — listado global de Asistencia, filtrado por tipo de acta.
// ----------------------------------------------------------------
function personalBaseActas(){
    if(Array.isArray(personalActas) && personalActas.length)return personalActas;
    // Respaldo para despliegues que aún no actualizaron Code.gs/data.js.
    const out=[];
    Object.entries(puestosData||{}).forEach(([prov,proys])=>Object.entries(proys||{}).forEach(([proy,puestos])=>puestos.forEach(pu=>{
        const nombres=(pu.rotacionCompleta&&pu.rotacionCompleta.length?pu.rotacionCompleta:(pu.guardia||'').split(',')).map(x=>String(x).trim()).filter(Boolean);
        const pk=(pu.nombre||'').toUpperCase().trim();
        nombres.forEach(n=>out.push({nombre:n,cedula:(cedulasPorPuesto[pk]&&cedulasPorPuesto[pk][n])||'',cargo:'',puesto:pu.nombre||'',proyecto:proy,provincia:prov}));
    })));
    return out;
}

function esPerfilCustodio(p){
    const txt=normalizarTexto([p.cargo,p.proyecto,p.puesto].filter(Boolean).join(' '));
    return ACTAS_KEYWORDS_CUSTODIO.some(k=>txt.includes(normalizarTexto(k)));
}

function personalSegunTipoActa(){
    const tipo=document.getElementById('acta-tipo')?.value||'guardia';
    const base=personalBaseActas();
    return base.filter(p=>tipo==='custodio'?esPerfilCustodio(p):!esPerfilCustodio(p));
}

function cargarAgentesActa(){
    document.getElementById('acta-agente-busqueda').value='';
    filtrarAgentesActa('');
}

function filtrarAgentesActa(texto){
    const q=normalizarTexto(texto);
    const base=personalSegunTipoActa();
    agentesActaFiltrados=base.filter(p=>!q || [p.nombre,p.cedula,p.proyecto,p.puesto,p.provincia,p.cargo].some(v=>normalizarTexto(v).includes(q)))
      .sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||'')));
    const sel=document.getElementById('acta-agente-select');
    sel.innerHTML=agentesActaFiltrados.length?agentesActaFiltrados.map((g,i)=>`<option value="${i}">${escHtml(g.nombre)}${g.cedula?' · CI '+escHtml(g.cedula):''} · ${escHtml(g.proyecto||'SIN PROYECTO')} · ${escHtml(g.puesto||'')}</option>`).join(''):'<option value="">No hay personas que coincidan con este tipo/búsqueda</option>';
    const tipo=document.getElementById('acta-tipo').value;
    document.getElementById('acta-agentes-ayuda').textContent=tipo==='custodio'
      ? `Mostrando perfiles de Custodio / Dotación Personal / Prefectura VIP / VIP (${agentesActaFiltrados.length}).`
      : `Mostrando personal de Guardia, excluyendo perfiles VIP/Custodio (${agentesActaFiltrados.length}).`;
    if(agentesActaFiltrados.length){sel.selectedIndex=0;seleccionarAgenteRegistrado();}
}

function seleccionarAgenteRegistrado(){
    const sel=document.getElementById('acta-agente-select');
    if(!sel || sel.value==='')return;
    const g=agentesActaFiltrados[Number(sel.value)];
    if(!g)return;
    agenteActaSeleccionado=g;
    document.getElementById('acta-receptor-nombre').value=g.nombre||'';
    document.getElementById('acta-receptor-cedula').value=g.cedula||'';
    document.getElementById('acta-proyecto-destino').value=g.proyecto||'';
    document.getElementById('acta-puesto-destino').value=g.puesto||'';
    document.getElementById('acta-provincia-destino').value=g.provincia||'';
    if(g.provincia)document.getElementById('acta-ciudad').value=ciudadSugerida(g.provincia)||document.getElementById('acta-ciudad').value;
    configurarCargoActa(g.cargo||'');
    cargarSupervisoresActa();
}

function actualizarModoReceptor(){
    const modo=document.querySelector('input[name="acta-receptor-origen"]:checked')?.value||'registrado';
    document.getElementById('acta-receptor-registrado').style.display=modo==='registrado'?'block':'none';
    document.getElementById('acta-receptor-manual').style.display=modo==='manual'?'grid':'none';
    if(modo==='registrado')cargarAgentesActa();
    else{
        agenteActaSeleccionado=null;
        document.getElementById('acta-receptor-nombre').value='';
        document.getElementById('acta-receptor-cedula').value='';
        document.getElementById('acta-proyecto-destino').value='';
        document.getElementById('acta-puesto-destino').value='';
        document.getElementById('acta-provincia-destino').value='';
        configurarCargoActa('');
    }
}

function configurarCargoActa(cargoSugerido){
    const tipo=document.getElementById('acta-tipo')?.value||'guardia';
    const sel=document.getElementById('acta-cargo-select');
    const opciones=tipo==='custodio'
      ? ['CUSTODIO VIP','CUSTODIO','DOTACIÓN PERSONAL','PREFECTURA VIP','OTRO']
      : ['GUARDIA DE SEGURIDAD','AGENTE DE SEGURIDAD','OTRO'];
    sel.innerHTML=opciones.map(x=>`<option value="${escAttr(x)}">${escHtml(x)}</option>`).join('');
    const sugerido=String(cargoSugerido||'').trim();
    const exacto=opciones.find(o=>normalizarTexto(o)===normalizarTexto(sugerido));
    if(exacto)sel.value=exacto;
    else if(sugerido){sel.value='OTRO';document.getElementById('acta-cargo-otro').value=sugerido;}
    else sel.value=opciones[0];
    actualizarCargoActa();
}

function actualizarCargoActa(){
    const otro=document.getElementById('acta-cargo-select').value==='OTRO';
    document.getElementById('acta-cargo-otro').style.display=otro?'block':'none';
    if(!otro)document.getElementById('acta-cargo-otro').value='';
}

function cargoActaActual(){
    const sel=document.getElementById('acta-cargo-select').value;
    return sel==='OTRO'?document.getElementById('acta-cargo-otro').value.trim():sel;
}

// ----------------------------------------------------------------
// SUPERVISORES — solo Acta Guardia; se toma del proyecto de DESTINO.
// ----------------------------------------------------------------
function supervisoresDestino(){
    const prov=(document.getElementById('acta-provincia-destino').value||'').toUpperCase().trim();
    const proy=document.getElementById('acta-proyecto-destino').value||'';
    const det=detalleProvincias[prov]||{};
    const p=(det.proyectosList||[]).find(x=>normalizarTexto(x.nombre)===normalizarTexto(proy));
    return (p&&p.supervisores&&p.supervisores.length?p.supervisores:(det.supervisores||[])).filter(Boolean);
}

function cargarSupervisoresActa(){
    const sel=document.getElementById('acta-supervisor-select');
    const sups=supervisoresDestino();
    sel.innerHTML=sups.length?sups.map(s=>`<option>${escHtml(s)}</option>`).join(''):'<option value="">Sin supervisor registrado — usa ingreso manual</option>';
}
function actualizarModoSupervisor(){const m=document.querySelector('input[name="acta-supervisor-origen"]:checked')?.value||'registrado';document.getElementById('acta-supervisor-registrado').style.display=m==='registrado'?'grid':'none';document.getElementById('acta-supervisor-manual').style.display=m==='manual'?'grid':'none';}

function actualizarTipoActa(){
    const t=document.getElementById('acta-tipo').value;
    document.getElementById('acta-comentario').value=t==='guardia'?'SE ENTREGA PERMISO ORIGINAL DEL ARMA':'EQUIPO ENTREGADO EN BUENAS CONDICIONES';
    document.getElementById('acta-seccion-entrega').style.display=t==='guardia'?'block':'none';
    configurarCargoActa('');
    cargarAgentesActa();
}

function leerFormularioActa(){
    const a=armaActaSeleccionada;
    const origen=document.querySelector('input[name="acta-receptor-origen"]:checked').value;
    if(origen==='registrado')seleccionarAgenteRegistrado();
    const tipo=document.getElementById('acta-tipo').value;
    const esGuardia=tipo==='guardia';
    const supOrigen=esGuardia?(document.querySelector('input[name="acta-supervisor-origen"]:checked')?.value||'registrado'):'ninguno';
    return {
      tipoActa:tipo==='custodio'?'CUSTODIO VIP':'GUARDIA',
      fecha:document.getElementById('acta-fecha').value,
      ciudad:document.getElementById('acta-ciudad').value.trim(),
      codigoArma:a?.codigoArma||'',serie:a?.serie||'',clase:a?.clase||'',categoria:a?.categoria||'',tipoArma:a?.tipo||'',marca:a?.marca||'',modelo:document.getElementById('acta-modelo').value.trim(),calibre:a?.calibre||'',
      proyecto:document.getElementById('acta-proyecto-destino').value.trim(),
      provincia:document.getElementById('acta-provincia-destino').value.trim(),
      puesto:document.getElementById('acta-puesto-destino').value.trim(),
      receptorNombre:document.getElementById('acta-receptor-nombre').value.trim(),
      receptorCedula:document.getElementById('acta-receptor-cedula').value.trim(),
      receptorOrigen:origen,
      cargo:cargoActaActual(),
      municiones:Number(document.getElementById('acta-municiones').value)||0,
      aptitud:document.getElementById('acta-aptitud').value,
      permiso:document.getElementById('acta-permiso').value,
      comentario:document.getElementById('acta-comentario').value.trim(),
      novedad:document.getElementById('acta-novedad').value.trim(),
      supervisorNombre:esGuardia?(supOrigen==='registrado'?document.getElementById('acta-supervisor-select').value.trim():document.getElementById('acta-supervisor-nombre').value.trim()):'',
      supervisorCedula:esGuardia?(supOrigen==='registrado'?document.getElementById('acta-supervisor-cedula-reg').value.trim():document.getElementById('acta-supervisor-cedula').value.trim()):'',
      urlCredencial:a?.urlCredencial||'',urlArma:a?.urlImagenArma||'',estadoArma:a?.estado||''
    };
}

function validarDatosActa(d){
    if(!armaActaSeleccionada)return 'Selecciona el arma por serie antes de generar el acta.';
    if(!d.receptorNombre)return 'Selecciona o escribe el nombre de la persona que recibe.';
    if(!d.receptorCedula)return 'La cédula de la persona que recibe es obligatoria.';
    if(!d.cargo)return 'Selecciona o escribe el cargo de la persona que recibe.';
    if(!d.fecha)return 'Selecciona la fecha del acta.';
    if(!d.ciudad)return 'Escribe la ciudad donde se suscribe el acta.';
    if(!d.proyecto && d.tipoActa==='GUARDIA')return 'Indica el Área / Proyecto de destino para el acta de Guardia.';
    if(!d.supervisorNombre&&d.tipoActa==='GUARDIA')return 'Para el acta de Guardia indica quién entrega.';
    return '';
}
function mostrarErrorActa(m){const e=document.getElementById('acta-error');if(!e)return;e.textContent=m;e.style.display=m?'block':'none';}

async function postActas(payload){const r=await fetch(APPS_SCRIPT_URL,{method:'POST',body:JSON.stringify(payload),redirect:'follow'});return await r.json();}
async function registrarActaServidor(d){return await postActas({accion:'crear_acta_armamento',token:tokenSesionActual(),acta:d});}
async function imagenActaBase64(url){if(!url)return '';try{const j=await postActas({accion:'imagen_acta',token:tokenSesionActual(),url});if(j.ok&&j.base64)return `data:${j.mime||'image/jpeg'};base64,${j.base64}`;}catch(e){console.warn('Imagen acta:',e);}return '';}

async function generarActaArmamento(){
    if(actaGenerando)return;
    const d=leerFormularioActa();
    const err=validarDatosActa(d);if(err){mostrarErrorActa(err);return;}
    mostrarErrorActa('');
    const btn=document.getElementById('acta-btn-generar');actaGenerando=true;btn.disabled=true;btn.textContent='Generando…';
    try{
        const reg=await registrarActaServidor(d);if(!reg.ok)throw new Error(reg.mensaje||'No se pudo registrar el acta');d.codigoActa=reg.codigo;
        const [cred,arma]=await Promise.all([imagenActaBase64(d.urlCredencial),imagenActaBase64(d.urlArma)]);
        if(d.tipoActa==='CUSTODIO VIP')generarPDFCustodio(d,cred,arma);else generarPDFGuardia(d,cred,arma);
        if(typeof cerrarModalArmamento==='function')cerrarModalArmamento();
        document.getElementById('actas-modal').style.display='none';
    }catch(e){mostrarErrorActa(e.message||String(e));}
    finally{actaGenerando=false;btn.disabled=false;btn.textContent='📄 Registrar y generar PDF';}
}

// ----------------------------------------------------------------
// PDF helpers
// ----------------------------------------------------------------
function fechaLargaEspanol(iso){const [y,m,d]=String(iso).split('-').map(Number);const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];return `${d} de ${meses[(m||1)-1]} del ${y}`;}
function fechaPalabrasActa(iso){const [y,m,d]=String(iso).split('-').map(Number);const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];return {dia:d,mes:meses[(m||1)-1],anio:y};}
function addTextJustificado(doc,text,x,y,w,fontSize=11,lineH=5.4){doc.setFontSize(fontSize);doc.setFont('helvetica','normal');doc.setTextColor(20,20,20);const lines=doc.splitTextToSize(text,w);doc.text(lines,x,y,{align:'justify',maxWidth:w,lineHeightFactor:1.18});return y+lines.length*lineH;}
function addTextoMixtoJustificado(doc,segmentos,x,y,w,fontSize=10.9,lineH=5.25){
    doc.setFontSize(fontSize);doc.setTextColor(20,20,20);
    const palabras=[];
    segmentos.forEach(seg=>String(seg.text||'').trim().split(/\s+/).filter(Boolean).forEach(t=>palabras.push({text:t,bold:!!seg.bold})));
    const spaceW=doc.getTextWidth(' ');
    const lineas=[];let linea=[],ancho=0;
    palabras.forEach(p=>{doc.setFont('helvetica',p.bold?'bold':'normal');const pw=doc.getTextWidth(p.text);const nuevo=linea.length?ancho+spaceW+pw:pw;if(linea.length&&nuevo>w){lineas.push(linea);linea=[{...p,w:pw}];ancho=pw;}else{linea.push({...p,w:pw});ancho=nuevo;}});
    if(linea.length)lineas.push(linea);
    lineas.forEach((ln,idx)=>{
        const ultimo=idx===lineas.length-1;const sum=ln.reduce((a,p)=>a+p.w,0);const gap=ln.length>1?(ultimo?spaceW:(w-sum)/(ln.length-1)):0;let cx=x;
        ln.forEach((p,i)=>{doc.setFont('helvetica',p.bold?'bold':'normal');doc.text(p.text,cx,y);cx+=p.w+(i<ln.length-1?gap:0);});
        y+=lineH;
    });
    return y;
}
function addImagenAjustada(doc,data,x,y,w,h){if(!data)return false;try{const fmt=data.startsWith('data:image/png')?'PNG':'JPEG';const props=doc.getImageProperties(data),r=Math.min(w/props.width,h/props.height),iw=props.width*r,ih=props.height*r;doc.addImage(data,fmt,x+(w-iw)/2,y+(h-ih)/2,iw,ih);return true;}catch(e){return false;}}
function textoClaseActa(clase){const n=normalizarTexto(clase).replace(/\s/g,'');return n.includes('noletal')?'NO LETAL':'LETAL';}

function generarPDFGuardia(d,cred,arma){
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const W=297,DARK=[15,23,42],GRAY=[203,213,225],fechaFmt=formatFecha(d.fecha);
    dibujarMembretePDF(doc,`Acta de Recepción de Dotaciones · ${d.codigoActa}`,fechaFmt);
    let y=MARGEN_PDF+7;
    doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(...DARK);doc.text('ACTA DE RECEPCIÓN DE DOTACIONES',W/2,y,{align:'center'});y+=8;

    doc.autoTable({startY:y,margin:{left:14,right:14},theme:'grid',styles:{fontSize:7.8,cellPadding:2.7,valign:'middle'},columnStyles:{0:{fontStyle:'bold',fillColor:GRAY,cellWidth:22},2:{fontStyle:'bold',fillColor:GRAY,cellWidth:26}},body:[
      ['FECHA',fechaLargaEspanol(d.fecha),'CATEGORÍA',`ARMAMENTO - ${textoClaseActa(d.clase)}`],
      ['NOMBRE',d.receptorNombre,'CÉDULA',d.receptorCedula],
      ['CARGO',d.cargo||'GUARDIA DE SEGURIDAD','ÁREA / PROYECTO',d.proyecto||'—']
    ]});
    y=doc.lastAutoTable.finalY+6;

    doc.autoTable({startY:y,margin:{left:8,right:8},head:[['CANT.','CLASE','VIGILANCIA','TIPO','MARCA','MODELO','CALIBRE','SERIE','APTA/NO APTA','MUNICIONES','COMENTARIO','NOVEDAD']],body:[[1,d.clase||'—',d.categoria||'—',d.tipoArma||'—',d.marca||'—',d.modelo||'—',d.calibre||'—',d.serie||'—',d.aptitud,d.municiones,d.comentario||'—',d.novedad||'—']],headStyles:{fillColor:[71,85,105],textColor:[255,255,255],fontSize:6.2,halign:'center'},styles:{fontSize:6.1,cellPadding:1.7,halign:'center',valign:'middle'}});
    y=doc.lastAutoTable.finalY+5;

    doc.setFontSize(8.5);doc.setFont('helvetica','bold');doc.text('EVIDENCIA DE DOTACIÓN',14,y);y+=3;
    // Dos evidencias centradas como bloque en toda la hoja.
    const boxW=82,boxH=38,gap=12,totalW=boxW*2+gap,startX=(W-totalW)/2,boxY=y;
    const xCred=startX,xArma=startX+boxW+gap;
    doc.setDrawColor(203,213,225);doc.setLineWidth(.5);doc.rect(xCred,boxY,boxW,boxH);doc.rect(xArma,boxY,boxW,boxH);
    doc.setFontSize(6.5);doc.text('CREDENCIAL',xCred+boxW/2,boxY+4,{align:'center'});doc.text('ARMA ENTREGADA',xArma+boxW/2,boxY+4,{align:'center'});
    if(!addImagenAjustada(doc,cred,xCred+3,boxY+6,boxW-6,29)){doc.setFont('helvetica','normal');doc.text('Sin imagen disponible',xCred+boxW/2,boxY+22,{align:'center'});}
    if(!addImagenAjustada(doc,arma,xArma+3,boxY+6,boxW-6,29)){doc.setFont('helvetica','normal');doc.text('Sin imagen disponible',xArma+boxW/2,boxY+22,{align:'center'});}

    // Firma más compacta, limpia y con línea claramente visible.
    const sigY=boxY+44,sigW=96,sigGap=12,sigTotal=sigW*2+sigGap,sigX=(W-sigTotal)/2;
    dibujarFirmaGuardia(doc,sigX,sigY,sigW,'ENTREGA','SUPERVISOR',d.supervisorNombre||'—',d.supervisorCedula||'—');
    dibujarFirmaGuardia(doc,sigX+sigW+sigGap,sigY,sigW,'RECIBE',d.cargo||'AGENTE DE SEGURIDAD',d.receptorNombre,d.receptorCedula);

    doc.save(`${d.codigoActa}_GUARDIA_${d.serie}.pdf`);
}

function dibujarFirmaGuardia(doc,x,y,w,titulo,rol,nombre,cedula){
    const h=29;
    doc.setDrawColor(203,213,225);doc.setLineWidth(.35);doc.rect(x,y,w,h);
    doc.setFillColor(226,232,240);doc.rect(x,y,w,6,'F');
    doc.setTextColor(15,23,42);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(titulo,x+w/2,y+4.2,{align:'center'});
    doc.setFontSize(6.5);doc.setTextColor(71,85,105);doc.text(String(rol||'').toUpperCase(),x+4,y+10);
    doc.setFont('helvetica','bold');doc.setTextColor(15,23,42);doc.setFontSize(7.2);doc.text(String(nombre||'—'),x+4,y+14.5,{maxWidth:w-8});
    doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(71,85,105);doc.text(`CI: ${cedula||'—'}`,x+4,y+18.5);
    const lineW=48,lineX=x+(w-lineW)/2,lineY=y+24;
    doc.setDrawColor(71,85,105);doc.setLineWidth(.35);doc.line(lineX,lineY,lineX+lineW,lineY);
    doc.setFontSize(5.8);doc.setTextColor(100,116,139);doc.text('FIRMA',x+w/2,lineY+3.3,{align:'center'});
}

function dibujarPlantillaCustodio(doc,codigo,fecha){
    const W=210,H=297,ORANGE=[249,115,22],DARK=[30,30,30];
    doc.setFillColor(...DARK);doc.rect(0,0,46,30,'F');doc.triangle(46,0,70,0,46,30,'F');
    doc.setFillColor(...ORANGE);doc.triangle(55,0,75,0,59,12,'F');
    try{doc.addImage(window._LOGO_B64,'PNG',10,5,30,20);}catch(e){}
    doc.setDrawColor(...ORANGE);doc.setLineWidth(1);doc.line(70,5,205,5);
    doc.setFillColor(...DARK);doc.rect(0,265,168,32,'F');doc.triangle(168,265,190,297,168,297,'F');
    doc.setFillColor(...ORANGE);doc.triangle(145,265,162,265,184,297,'F');
    doc.setTextColor(255,255,255);doc.setFontSize(7.5);doc.setFont('helvetica','normal');
    doc.text('0959008838',25,285,{align:'center'});doc.text('info@defen.com.ec',85,285,{align:'center'});
    doc.text('Cdla Álamos II mz k solar 9',140,282,{align:'center'});doc.text('Guayaquil-Ecuador',140,287,{align:'center'});
    doc.setTextColor(125,125,125);doc.setFontSize(5.5);doc.text(`${codigo} · ${fecha}`,204,293,{align:'right'});
}

function generarPDFCustodioOriginal(d,cred,arma){
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const f=fechaPalabrasActa(d.fecha),x=18,w=174;
    dibujarPlantillaCustodio(doc,d.codigoActa,formatFecha(d.fecha));

    // El Word original usa Arial; Helvetica de jsPDF es su equivalente métrico más cercano.
    doc.setTextColor(15,15,15);doc.setFont('helvetica','bold');doc.setFontSize(11.2);
    doc.text('DEFEN CIA LTDA',105,34,{align:'center'});doc.text('GUAYAQUIL – ECUADOR',105,40,{align:'center'});
    doc.setFontSize(11.5);doc.text('ACTA DE ENTREGA, RECEPCIÓN',105,51,{align:'center'});doc.text('Y USO DE ARMAMENTO',105,57,{align:'center'});
    doc.setFontSize(10.5);doc.text(`NO.: ${d.codigoActa}`,18,70);

    let y=83;
    const cargoLegal=d.cargo||'CUSTODIO VIP';
    // Negritas iguales a la plantilla Word: título del acto, datos del arma y receptor.
    y=addTextoMixtoJustificado(doc,[
      {text:`En la ciudad de ${d.ciudad}, a los ${f.dia} días del mes de ${f.mes} del año ${f.anio}, se suscribe la presente`},
      {text:'ACTA DE ENTREGA, RECEPCIÓN Y USO DE ARMAMENTO,',bold:true},
      {text:'mediante la cual se deja constancia de la entrega de un'},
      {text:`Arma tipo ${d.tipoArma},`,bold:true},{text:`clase “${String(d.clase||'').toLowerCase()}”,`,bold:true},
      {text:`categoría “${String(d.categoria||'').toLowerCase()}”,`,bold:true},{text:`calibre ${d.calibre} marca ${d.marca}`,bold:true},
      {text:'perteneciente a la compañía de seguridad'},{text:'DEFEN CIA. LTDA.,',bold:true},
      {text:'debidamente identificado con el número de serie'},{text:`${d.serie}.`,bold:true}
    ],x,y,w,10.9,5.25)+5;
    y=addTextoMixtoJustificado(doc,[
      {text:'El Sr.'},{text:d.receptorNombre,bold:true},{text:'con CI.'},{text:`${d.receptorCedula},`,bold:true},
      {text:'de ahora en adelante denominado como'},{text:`“${cargoLegal}”,`,bold:true},
      {text:'declara haber recibido el equipo en buenas condiciones de funcionamiento, comprometiéndose a su correcta utilización, custodia y conservación durante el tiempo que permanezca bajo su responsabilidad. Cabe recalcar que el departamento de Operaciones dispone evidencia fotográfica del estado del mismo.'}
    ],x,y,w,10.9,5.25)+5;
    const p3='En tal virtud, el custodio recibe el equipo para el cumplimiento de sus funciones laborales, comprometiéndose a utilizarlo, custodiarlo y conservarlo de manera adecuada, conforme a los protocolos internos y a las instrucciones impartidas por la empresa. En caso de pérdida, daño, deterioro o cualquier otro desperfecto que afecte al equipo entregado, la empresa llevará a cabo las investigaciones correspondientes, con el objeto de determinar las causas, circunstancias y eventuales responsabilidades derivadas del hecho. Si como resultado de dichas actuaciones se estableciere que la responsabilidad es imputable al custodio, este asumirá las consecuencias administrativas a que hubiere lugar, de conformidad con lo previsto en el Código del Trabajo, la normativa interna vigente y demás disposiciones aplicables.';
    const p4='Asimismo, el custodio se compromete a no manipular, alterar o intervenir técnicamente el equipo sin la debida autorización, y a reportar de manera inmediata cualquier novedad o falla que se presente durante su uso.';
    const p5='Para constancia de lo anterior, las partes firman el presente documento en señal de aceptación y conformidad.';
    y=addTextJustificado(doc,p3,x,y,w,10.9,5.25)+5.5;
    y=addTextJustificado(doc,p4,x,y,w,10.9,5.25)+5;
    y=addTextJustificado(doc,p5,x,y,w,10.9,5.25)+5;

    doc.addPage();dibujarPlantillaCustodio(doc,d.codigoActa,formatFecha(d.fecha));
    y=42;doc.setTextColor(20,20,20);doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text('Arma de dotación:',18,y);y+=5;
    doc.autoTable({startY:y,margin:{left:18,right:18},head:[['N°','CLASE','CATEGORÍA','TIPO','MARCA','CALIBRE','SERIE','CANT. MUNICIONES','PERMISO (CREDENCIAL)']],body:[[1,d.clase,d.categoria,d.tipoArma,d.marca,d.calibre,d.serie,d.municiones,d.permiso]],headStyles:{fillColor:[145,145,145],textColor:[255,255,255],fontSize:6.4,halign:'center'},styles:{fontSize:6.5,cellPadding:1.8,halign:'center',valign:'middle'}});
    y=doc.lastAutoTable.finalY+8;

    // Evidencias centradas simétricamente en la página.
    const boxW=78,gap=18,startX=(210-(boxW*2+gap))/2;
    const xCred=startX,xArma=startX+boxW+gap,boxH=45;
    doc.setFontSize(7);doc.setTextColor(71,85,105);doc.text('CREDENCIAL',xCred+boxW/2,y,{align:'center'});doc.text('ARMA',xArma+boxW/2,y,{align:'center'});
    doc.setDrawColor(226,232,240);doc.rect(xCred,y+2,boxW,boxH);doc.rect(xArma,y+2,boxW,boxH);
    if(!addImagenAjustada(doc,cred,xCred+2,y+4,boxW-4,41))doc.text('Sin imagen disponible',xCred+boxW/2,y+25,{align:'center'});
    if(!addImagenAjustada(doc,arma,xArma+2,y+4,boxW-4,41))doc.text('Sin imagen disponible',xArma+boxW/2,y+25,{align:'center'});
    y+=57;

    const cierre=`En fe de lo cual, y habiendo leído íntegramente el contenido del presente documento, las partes intervinientes ratifican su conformidad con cada una de las cláusulas aquí establecidas, firmando en dos ejemplares de igual tenor y valor legal, en la ciudad de ${d.ciudad}, a los ${f.dia} días del mes de ${f.mes} del año ${f.anio}.`;
    y=addTextJustificado(doc,cierre,18,y,174,10.7,5.2)+14;
    doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(String(cargoLegal).toUpperCase(),18,y);
    y+=33;doc.setLineWidth(.3);doc.setDrawColor(60,60,60);doc.line(18,y,92,y);
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(`Nombre: ${d.receptorNombre}`,18,y+6);doc.text(`Ci.: ${d.receptorCedula}`,18,y+12);

    return doc;
}

// Compatibilidad con botones antiguos que llaman abrirGeneradorActas (plural).
function abrirGeneradorActas(serie){return abrirGeneradorActa(serie);}

// ================================================================
// V3 — Flujo guiado de actas y selección de una o varias armas.
// Se mantiene la compatibilidad con los PDF y registros anteriores.
// ================================================================
let armasActaSeleccionadas = [];
let indiceAgenteActa = -1;

function actasV3Provincias(){return Object.keys(detalleProvincias||{}).sort();}
function actasV3Proyectos(prov){return ((detalleProvincias[(prov||'').toUpperCase()]||{}).proyectosList||[]).map(p=>p.nombre).filter(Boolean).sort();}
function actasV3Puestos(prov,proy){return (((puestosData||{})[(prov||'').toUpperCase()]||{})[(proy||'').toUpperCase()]||[]).map(p=>p.nombre).filter(Boolean).sort();}
function actasV3Opciones(items, etiqueta){return [`<option value="">${etiqueta}</option>`,...items.map(v=>`<option value="${escAttr(v)}">${escHtml(v)}</option>`)].join('');}
function actasV3CamposReceptor(){return ['acta-receptor-nombre','acta-receptor-cedula','acta-cargo-select','acta-provincia-destino','acta-proyecto-destino','acta-puesto-destino'];}

function asegurarModalActas(){
  if(document.getElementById('actas-modal'))return;
  const modal=document.createElement('div'); modal.id='actas-modal';
  modal.style.cssText='display:none;position:fixed;inset:0;z-index:21000;background:rgba(15,23,42,.82);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:14px;';
  modal.innerHTML=`<div style="width:100%;max-width:1020px;max-height:94vh;background:#f8fafc;border-radius:20px;box-shadow:0 32px 90px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column;">
  <div style="background:#0f172a;padding:14px 18px;display:flex;align-items:center;gap:12px;"><div style="flex:1"><h2 style="margin:0;color:white;font-size:15px;font-weight:900">📄 Generador de Actas de Armamento</h2><p style="margin:2px 0 0;color:#94a3b8;font-size:10px;font-weight:700">Guardia de Seguridad · Custodio / VIP</p></div><button onclick="cerrarGeneradorActa()" class="acta-close">✕ Cerrar</button></div>
  <div style="overflow:auto;padding:16px 18px;"><div id="acta-error" class="acta-error"></div>
  <h3 class="acta-section">1. DATOS GENERALES</h3><div class="acta-card acta-grid3"><div><label class="acta-label">Tipo de acta</label><select id="acta-tipo" class="acta-input" onchange="actasV3ActualizarTipo()"><option value="guardia">GUARDIA DE SEGURIDAD</option><option value="custodio">CUSTODIO / VIP</option></select></div><div><label class="acta-label">Fecha del acta</label><input id="acta-fecha" type="date" class="acta-input"></div><div><label class="acta-label">Ciudad de origen</label><input id="acta-ciudad" class="acta-input" placeholder="Guayaquil"></div></div>
  <h3 class="acta-section">2. PERSONA QUE RECIBE</h3><div class="acta-card"><div class="acta-radio"><label><input type="radio" name="acta-receptor-origen" value="registrado" checked onchange="actasV3ModoReceptor()"> Sí, está registrado en Asistencia</label><label><input type="radio" name="acta-receptor-origen" value="manual" onchange="actasV3ModoReceptor()"> No, ingresar manualmente</label></div><div id="acta-receptor-registrado" style="margin-top:10px"><input id="acta-agente-busqueda" class="acta-input" placeholder="Buscar únicamente por nombre o cédula…" oninput="actasV3BuscarAgentes(this.value)"><div id="acta-agente-resultados" class="acta-resultados"></div><p id="acta-agentes-ayuda" class="acta-help">Escribe al menos 2 caracteres para buscar.</p></div><div id="acta-receptor-manual" style="display:none"></div><div class="acta-grid4" style="margin-top:10px"><div><label class="acta-label">Nombre completo</label><input id="acta-receptor-nombre" class="acta-input" placeholder="Nombre completo" readonly></div><div><label class="acta-label">Cédula</label><input id="acta-receptor-cedula" class="acta-input" placeholder="Cédula" readonly></div><div><label class="acta-label">Cargo</label><select id="acta-cargo-select" class="acta-input" onchange="actasV3CargoOtro()"><option>GUARDIA DE SEGURIDAD</option><option>SUPERVISOR</option><option>PERSONAL EXTERNO</option><option value="OTRO">OTROS</option></select><input id="acta-cargo-otro" class="acta-input" placeholder="Escriba el cargo" style="display:none;margin-top:6px"></div><div><label class="acta-label">Provincia</label><select id="acta-provincia-destino" class="acta-input" onchange="actasV3CambiarProvincia()"></select></div><div><label class="acta-label">Área / proyecto</label><select id="acta-proyecto-destino" class="acta-input" onchange="actasV3CambiarProyecto()"></select><input id="acta-proyecto-otro" class="acta-input" placeholder="Escriba el proyecto" style="display:none;margin-top:6px"></div><div><label class="acta-label">Puesto / área</label><select id="acta-puesto-destino" class="acta-input" onchange="actasV3PuestoOtro()"></select><input id="acta-puesto-otro" class="acta-input" placeholder="Escriba el puesto o área" style="display:none;margin-top:6px"></div></div></div>
  <h3 class="acta-section">3. DATOS DE ENTREGA</h3><div class="acta-card acta-grid3"><div><label class="acta-label">Municiones</label><input id="acta-municiones" type="number" min="0" value="0" class="acta-input"></div><div><label class="acta-label">Permiso / credencial</label><select id="acta-permiso" class="acta-input"><option>ORIGINAL</option><option>COPIA</option><option>N/A</option></select></div><div><label class="acta-label">Modelo (opcional)</label><input id="acta-modelo" class="acta-input" placeholder="Modelo del arma"></div><div style="grid-column:1/-1"><label class="acta-label">Comentario</label><input id="acta-comentario" class="acta-input" value="SE ENTREGA PERMISO ORIGINAL DEL ARMA"></div><div style="grid-column:1/-1"><label class="acta-label">Novedad</label><input id="acta-novedad" class="acta-input" value="N/A"></div></div>
  <div id="acta-seccion-entrega"><h3 class="acta-section">4. QUIEN ENTREGA</h3><div class="acta-card"><div class="acta-radio"><label><input type="radio" name="acta-supervisor-origen" value="registrado" checked onchange="actualizarModoSupervisor()"> Supervisor registrado</label><label><input type="radio" name="acta-supervisor-origen" value="manual" onchange="actualizarModoSupervisor()"> Escribir manualmente</label></div><div id="acta-supervisor-registrado" class="acta-grid2" style="margin-top:10px"><div><label class="acta-label">Supervisor de la provincia / proyecto</label><select id="acta-supervisor-select" class="acta-input"></select></div><div><label class="acta-label">Cédula (si aplica)</label><input id="acta-supervisor-cedula-reg" class="acta-input"></div></div><div id="acta-supervisor-manual" class="acta-grid2" style="display:none;margin-top:10px"><input id="acta-supervisor-nombre" class="acta-input" placeholder="Nombre supervisor"><input id="acta-supervisor-cedula" class="acta-input" placeholder="Cédula supervisor"></div></div></div>
  <h3 class="acta-section">5. ARMAMENTO</h3><div class="acta-card"><div class="acta-radio"><label><input type="radio" name="acta-cantidad-armas" value="1" checked onchange="actasV3CantidadArmas()"> Una arma</label><label><input type="radio" name="acta-cantidad-armas" value="varias" onchange="actasV3CantidadArmas()"> Varias armas</label><span id="acta-cantidad-wrap" style="display:none">Cantidad: <input id="acta-cantidad" type="number" min="2" max="20" value="2" class="acta-cantidad" onchange="actasV3CantidadArmas()"></span></div><p class="acta-help">Busca por serie. Elige cada arma de las coincidencias y evita repetir series.</p><div id="acta-armas-contenedor"></div></div></div>
  <div style="padding:12px 18px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:8px"><button onclick="cerrarGeneradorActa()" class="acta-cancel">Cancelar</button><button id="acta-btn-generar" onclick="generarActaArmamento()" class="acta-submit">📄 Registrar y generar PDF</button></div></div>`;
  document.body.appendChild(modal);
  const style=document.createElement('style'); style.textContent=`.acta-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px}.acta-label{display:block;font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin-bottom:4px}.acta-input{width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:11px;font-weight:700;outline:none}.acta-input:focus{border-color:#f97316}.acta-section{font-size:10px;letter-spacing:.08em;color:#475569;margin:14px 0 6px;font-weight:900}.acta-grid2,.acta-grid3,.acta-grid4{display:grid;gap:9px}.acta-grid2{grid-template-columns:repeat(2,minmax(0,1fr))}.acta-grid3{grid-template-columns:repeat(3,minmax(0,1fr))}.acta-grid4{grid-template-columns:repeat(4,minmax(150px,1fr))}.acta-radio{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;font-weight:800;color:#334155}.acta-resultados{display:none;margin-top:6px;max-height:165px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;background:#fff}.acta-resultado{padding:8px 10px;border-bottom:1px solid #f1f5f9;cursor:pointer;font-size:11px}.acta-resultado:hover{background:#fff7ed}.acta-help{font-size:9px;color:#64748b;margin:6px 0 0}.acta-error{display:none;margin-bottom:10px;padding:9px 12px;border-radius:10px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800}.acta-close,.acta-cancel,.acta-submit{border:0;border-radius:9px;padding:10px;font-weight:900;cursor:pointer}.acta-close{background:#334155;color:#fff}.acta-cancel{flex:1;border:1px solid #cbd5e1;background:#fff;color:#475569}.acta-submit{flex:2;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff}.acta-arma-item{margin-top:10px;padding:10px;border:1px solid #dbeafe;border-radius:10px;background:#f8fbff}.acta-arma-seleccionada{margin-top:7px;padding:8px;background:#eef2ff;border-radius:8px;color:#3730a3;font-size:10px;font-weight:700}.acta-cantidad{width:54px;padding:4px;border:1px solid #cbd5e1;border-radius:6px}@media(max-width:650px){.acta-grid2,.acta-grid3,.acta-grid4{grid-template-columns:1fr}}`; document.head.appendChild(style);
}
// Historial integrado dentro del mismo generador de actas.
function asegurarModalActas(){
  if(document.getElementById('actas-modal'))return;
  const modal=document.createElement('div');modal.id='actas-modal';modal.style.cssText='display:none;position:fixed;inset:0;z-index:21000;background:rgba(15,23,42,.82);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:14px';
  modal.innerHTML=`<div style="width:100%;max-width:1020px;max-height:94vh;background:#f8fafc;border-radius:20px;box-shadow:0 32px 90px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column"><div style="background:#0f172a;padding:14px 18px;display:flex;align-items:center;gap:12px"><div style="flex:1"><h2 style="margin:0;color:white;font-size:15px;font-weight:900">📄 Generador de Actas de Armamento</h2><p style="margin:2px 0 0;color:#94a3b8;font-size:10px;font-weight:700">Guardia de Seguridad · Custodio / VIP</p></div><button onclick="cerrarGeneradorActa()" class="acta-close">✕ Cerrar</button></div><div style="background:white;border-bottom:1px solid #e2e8f0;padding:8px 18px;display:flex;gap:8px"><button id="acta-tab-nueva" onclick="mostrarPestanaActas('nueva')" style="border:0;border-radius:8px;padding:7px 12px;background:#f97316;color:white;font-size:11px;font-weight:900;cursor:pointer">Nueva acta</button><button id="acta-tab-historial" onclick="mostrarPestanaActas('historial')" style="border:0;border-radius:8px;padding:7px 12px;background:#e2e8f0;color:#334155;font-size:11px;font-weight:900;cursor:pointer">🗂️ Historial</button></div><div id="acta-vista-nueva" style="overflow:auto;padding:16px 18px"><div id="acta-error" class="acta-error"></div><h3 class="acta-section">1. DATOS GENERALES</h3><div class="acta-card acta-grid3"><div><label class="acta-label">Tipo de acta</label><select id="acta-tipo" class="acta-input" onchange="actasV3ActualizarTipo()"><option value="guardia">GUARDIA DE SEGURIDAD</option><option value="custodio">CUSTODIO / VIP</option></select></div><div><label class="acta-label">Fecha del acta</label><input id="acta-fecha" type="date" class="acta-input"></div><div><label class="acta-label">Ciudad de origen</label><input id="acta-ciudad" class="acta-input" placeholder="Guayaquil"></div></div><h3 class="acta-section">2. PERSONA QUE RECIBE</h3><div class="acta-card"><div class="acta-radio"><label><input type="radio" name="acta-receptor-origen" value="registrado" checked onchange="actasV3ModoReceptor()"> Sí, está registrado en Asistencia</label><label><input type="radio" name="acta-receptor-origen" value="manual" onchange="actasV3ModoReceptor()"> No, ingresar manualmente</label></div><div id="acta-receptor-registrado" style="margin-top:10px"><input id="acta-agente-busqueda" class="acta-input" placeholder="Buscar únicamente por nombre o cédula…" oninput="actasV3BuscarAgentes(this.value)"><div id="acta-agente-resultados" class="acta-resultados"></div><p id="acta-agentes-ayuda" class="acta-help">Escribe al menos 2 caracteres para buscar.</p></div><div id="acta-receptor-manual" style="display:none"></div><div class="acta-grid4" style="margin-top:10px"><div><label class="acta-label">Nombre completo</label><input id="acta-receptor-nombre" class="acta-input" placeholder="Nombre completo" readonly></div><div><label class="acta-label">Cédula</label><input id="acta-receptor-cedula" class="acta-input" placeholder="Cédula" readonly></div><div><label class="acta-label">Cargo</label><select id="acta-cargo-select" class="acta-input" onchange="actasV3CargoOtro()"><option>GUARDIA DE SEGURIDAD</option><option>SUPERVISOR</option><option>PERSONAL EXTERNO</option><option value="OTRO">OTROS</option></select><input id="acta-cargo-otro" class="acta-input" placeholder="Escriba el cargo" style="display:none;margin-top:6px"></div><div><label class="acta-label">Provincia</label><select id="acta-provincia-destino" class="acta-input" onchange="actasV3CambiarProvincia()"></select></div><div><label class="acta-label">Área / proyecto</label><select id="acta-proyecto-destino" class="acta-input" onchange="actasV3CambiarProyecto()"></select><input id="acta-proyecto-otro" class="acta-input" placeholder="Escriba el proyecto" style="display:none;margin-top:6px"></div><div><label class="acta-label">Puesto / área</label><select id="acta-puesto-destino" class="acta-input" onchange="actasV3PuestoOtro()"></select><input id="acta-puesto-otro" class="acta-input" placeholder="Escriba el puesto o área" style="display:none;margin-top:6px"></div></div></div><h3 class="acta-section">3. DATOS DE ENTREGA</h3><div class="acta-card acta-grid3"><div><label class="acta-label">Municiones</label><input id="acta-municiones" type="number" min="0" value="0" class="acta-input"></div><div><label class="acta-label">Permiso / credencial</label><select id="acta-permiso" class="acta-input"><option>ORIGINAL</option><option>COPIA</option><option>N/A</option></select></div><div><label class="acta-label">Modelo (opcional)</label><input id="acta-modelo" class="acta-input" placeholder="Modelo del arma"></div><div style="grid-column:1/-1"><label class="acta-label">Comentario</label><input id="acta-comentario" class="acta-input" value="SE ENTREGA PERMISO ORIGINAL DEL ARMA"></div><div style="grid-column:1/-1"><label class="acta-label">Novedad</label><input id="acta-novedad" class="acta-input" value="N/A"></div></div><div id="acta-seccion-entrega"><h3 class="acta-section">4. QUIEN ENTREGA</h3><div class="acta-card"><div class="acta-radio"><label><input type="radio" name="acta-supervisor-origen" value="registrado" checked onchange="actualizarModoSupervisor()"> Supervisor registrado</label><label><input type="radio" name="acta-supervisor-origen" value="manual" onchange="actualizarModoSupervisor()"> Escribir manualmente</label></div><div id="acta-supervisor-registrado" class="acta-grid2" style="margin-top:10px"><div><label class="acta-label">Supervisor de la provincia / proyecto</label><select id="acta-supervisor-select" class="acta-input"></select></div><div><label class="acta-label">Cédula (si aplica)</label><input id="acta-supervisor-cedula-reg" class="acta-input"></div></div><div id="acta-supervisor-manual" class="acta-grid2" style="display:none;margin-top:10px"><input id="acta-supervisor-nombre" class="acta-input" placeholder="Nombre supervisor"><input id="acta-supervisor-cedula" class="acta-input" placeholder="Cédula supervisor"></div></div></div><h3 class="acta-section">5. ARMAMENTO</h3><div class="acta-card"><div class="acta-radio"><label><input type="radio" name="acta-cantidad-armas" value="1" checked onchange="actasV3CantidadArmas()"> Una arma</label><label><input type="radio" name="acta-cantidad-armas" value="varias" onchange="actasV3CantidadArmas()"> Varias armas</label><span id="acta-cantidad-wrap" style="display:none">Cantidad: <input id="acta-cantidad" type="number" min="2" max="20" value="2" class="acta-cantidad" onchange="actasV3CantidadArmas()"></span></div><p class="acta-help">Busca por serie. Elige cada arma de las coincidencias y evita repetir series.</p><div id="acta-armas-contenedor"></div></div></div><div id="acta-vista-historial" style="display:none;overflow:auto;padding:16px 18px"><div id="historial-actas-lista"></div></div><div id="acta-pie" style="padding:12px 18px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:8px"><button onclick="cerrarGeneradorActa()" class="acta-cancel">Cancelar</button><button id="acta-btn-generar" onclick="generarActaArmamento()" class="acta-submit">📄 Registrar y generar PDF</button></div></div>`;document.body.appendChild(modal);}
function mostrarPestanaActas(vista){const historial=vista==='historial';document.getElementById('acta-vista-nueva').style.display=historial?'none':'block';document.getElementById('acta-vista-historial').style.display=historial?'block':'none';document.getElementById('acta-pie').style.display=historial?'none':'flex';document.getElementById('acta-tab-nueva').style.cssText=`border:0;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:900;cursor:pointer;${historial?'background:#e2e8f0;color:#334155':'background:#f97316;color:white'}`;document.getElementById('acta-tab-historial').style.cssText=`border:0;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:900;cursor:pointer;${historial?'background:#f97316;color:white':'background:#e2e8f0;color:#334155'}`;if(historial)cargarHistorialIntegrado();}
async function cargarHistorialIntegrado(){const c=document.getElementById('historial-actas-lista');c.innerHTML='<p style="color:#64748b">Cargando historial…</p>';try{const r=await postActas({accion:'listar_actas',token:tokenSesionActual()});if(!r.ok)throw new Error(r.mensaje);const g={GUARDIA:[],CUSTODIO:[]};(r.actas||[]).forEach(a=>(normalizarTexto(a.tipo).includes('custodio')?g.CUSTODIO:g.GUARDIA).push(a));c.innerHTML=['GUARDIA','CUSTODIO'].map(t=>`<h3 class="acta-section">${t==='GUARDIA'?'Actas de Guardia':'Actas de Custodio'}</h3>${g[t].length?g[t].map(a=>`<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:7px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b style="font-size:12px;color:#0f172a">${escHtml(a.codigo)}</b><div style="font-size:10px;color:#64748b">${escHtml(a.receptor)} · ${a.armas.length} arma(s) · ${escHtml(a.fecha)}</div><div style="font-size:9px;color:#94a3b8">Series: ${a.armas.map(escHtml).join(', ')}</div></div><button onclick="descargarPdfDesdeHistorial('${escAttr(a.codigo)}')" style="border:0;border-radius:7px;background:#dbeafe;color:#075985;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer">📄 Generar PDF</button>${r.esAdmin?`<button onclick="eliminarUltimaActa('${escAttr(a.codigo)}')" style="border:0;border-radius:7px;background:#fee2e2;color:#b91c1c;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer">Eliminar</button>`:''}</div>`).join(''):'<p style="font-size:11px;color:#94a3b8">Sin actas registradas.</p>'}`).join('');}catch(e){c.innerHTML=`<p style="color:#b91c1c;font-weight:700">${escHtml(e.message||String(e))}</p>`;}}

function abrirGeneradorActa(serie){if(typeof usuarioPuedeGenerarActas==='function'&&!usuarioPuedeGenerarActas())return alert('Solo Operaciones y Administrador pueden generar actas de armamento.');if(!tokenSesionActual())return alert('Tu sesión venció. Ingresa nuevamente.');asegurarModalActas();limpiarFormularioActa();document.getElementById('acta-fecha').value=fechaISOHoy();actasV3ActualizarTipo();document.getElementById('actas-modal').style.display='flex';if(serie){const a=armamentoDetalle.find(x=>String(x.serie||'').trim()===String(serie).trim());if(a)actasV3ElegirArma(0,a);}}
function limpiarFormularioActa(){armasActaSeleccionadas=[];agenteActaSeleccionado=null;indiceAgenteActa=-1;['acta-receptor-nombre','acta-receptor-cedula','acta-ciudad','acta-modelo','acta-cargo-otro','acta-proyecto-otro','acta-puesto-otro','acta-supervisor-nombre','acta-supervisor-cedula','acta-supervisor-cedula-reg'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});document.querySelector('input[name="acta-receptor-origen"][value="registrado"]').checked=true;document.querySelector('input[name="acta-supervisor-origen"][value="registrado"]').checked=true;document.querySelector('input[name="acta-cantidad-armas"][value="1"]').checked=true;document.getElementById('acta-municiones').value='0';document.getElementById('acta-permiso').value='ORIGINAL';document.getElementById('acta-novedad').value='N/A';document.getElementById('acta-agente-resultados').innerHTML='';document.getElementById('acta-agente-resultados').style.display='none';actasV3ModoReceptor();actasV3CantidadArmas();}
function actasV3ActualizarTipo(){const t=document.getElementById('acta-tipo').value;document.getElementById('acta-comentario').value=t==='guardia'?'SE ENTREGA PERMISO ORIGINAL DEL ARMA':'EQUIPO ENTREGADO EN BUENAS CONDICIONES';document.getElementById('acta-seccion-entrega').style.display='block';actasV3BuscarAgentes(document.getElementById('acta-agente-busqueda').value||'');}
function actasV3ModoReceptor(){const manual=document.querySelector('input[name="acta-receptor-origen"]:checked').value==='manual';document.getElementById('acta-receptor-registrado').style.display=manual?'none':'block';['acta-receptor-nombre','acta-receptor-cedula'].forEach(id=>{const e=document.getElementById(id);e.readOnly=!manual;if(manual)e.value='';});document.getElementById('acta-receptor-manual').style.display='none';if(!manual)actasV3BuscarAgentes('');actasV3CargarUbicaciones();}
function actasV3BuscarAgentes(q){const out=document.getElementById('acta-agente-resultados');q=normalizarTexto(q);if(q.length<2){out.style.display='none';document.getElementById('acta-agentes-ayuda').textContent='Escribe al menos 2 caracteres para buscar.';return;}const tipo=document.getElementById('acta-tipo').value;agentesActaFiltrados=personalBaseActas().filter(p=>(tipo==='custodio'?esPerfilCustodio(p):!esPerfilCustodio(p))&&[p.nombre,p.cedula].some(v=>normalizarTexto(v).includes(q))).slice(0,12);out.innerHTML=agentesActaFiltrados.map((p,i)=>`<div class="acta-resultado" onclick="actasV3ElegirAgente(${i})"><strong>${escHtml(p.nombre)}</strong>${p.cedula?` · CI ${escHtml(p.cedula)}`:''}<br><span style="color:#64748b">${escHtml(p.provincia||'')} · ${escHtml(p.proyecto||'')} · ${escHtml(p.puesto||'')}</span></div>`).join('')||'<div class="acta-resultado">No hay coincidencias.</div>';out.style.display='block';document.getElementById('acta-agentes-ayuda').textContent=`${agentesActaFiltrados.length} coincidencia(s), mostrando nombre, cédula y ubicación.`;}
function actasV3ElegirAgente(i){const p=agentesActaFiltrados[i];if(!p)return;agenteActaSeleccionado=p;indiceAgenteActa=i;document.getElementById('acta-receptor-nombre').value=p.nombre||'';document.getElementById('acta-receptor-cedula').value=p.cedula||'';actasV3CargarUbicaciones(p.provincia,p.proyecto,p.puesto);document.getElementById('acta-agente-resultados').style.display='none';document.getElementById('acta-agente-busqueda').value=p.nombre||'';cargarSupervisoresActa();}
function actasV3CargarUbicaciones(prov='',proy='',puesto=''){const ps=actasV3Provincias();const e=document.getElementById('acta-provincia-destino');e.innerHTML=actasV3Opciones(ps,'Selecciona provincia');e.value=prov||'';actasV3CambiarProvincia(proy,puesto);}
function actasV3CambiarProvincia(proy='',puesto=''){const p=document.getElementById('acta-provincia-destino').value;const e=document.getElementById('acta-proyecto-destino');e.innerHTML=actasV3Opciones([...actasV3Proyectos(p),'OTRO'],'Selecciona proyecto');e.value=proy||'';document.getElementById('acta-proyecto-otro').style.display=e.value==='OTRO'?'block':'none';actasV3CambiarProyecto(puesto);cargarSupervisoresActa();}
function actasV3CambiarProyecto(puesto=''){const p=document.getElementById('acta-provincia-destino').value,proy=document.getElementById('acta-proyecto-destino').value;const e=document.getElementById('acta-puesto-destino');e.innerHTML=actasV3Opciones([...actasV3Puestos(p,proy),'OTRO'],'Selecciona puesto');e.value=puesto||'';document.getElementById('acta-puesto-otro').style.display=e.value==='OTRO'?'block':'none';document.getElementById('acta-proyecto-otro').style.display=proy==='OTRO'?'block':'none';cargarSupervisoresActa();}
function actasV3PuestoOtro(){document.getElementById('acta-puesto-otro').style.display=document.getElementById('acta-puesto-destino').value==='OTRO'?'block':'none';}
function actasV3CargoOtro(){document.getElementById('acta-cargo-otro').style.display=document.getElementById('acta-cargo-select').value==='OTRO'?'block':'none';}
function actasV3CantidadArmas(){const varias=document.querySelector('input[name="acta-cantidad-armas"]:checked').value==='varias';document.getElementById('acta-cantidad-wrap').style.display=varias?'inline':'none';const n=varias?Math.max(2,Math.min(20,Number(document.getElementById('acta-cantidad').value)||2)):1;armasActaSeleccionadas=armasActaSeleccionadas.slice(0,n);while(armasActaSeleccionadas.length<n)armasActaSeleccionadas.push(null);const c=document.getElementById('acta-armas-contenedor');c.innerHTML=armasActaSeleccionadas.map((a,i)=>`<div class="acta-arma-item"><label class="acta-label">Arma ${i+1} · Serie</label><input id="acta-arma-${i}" class="acta-input" value="${escAttr(a?.serie||'')}" placeholder="Escribe serie, código o marca…" oninput="actasV3BuscarArma(${i},this.value)"><div id="acta-arma-resultados-${i}" class="acta-resultados"></div><div id="acta-arma-resumen-${i}" class="acta-arma-seleccionada">${a?actasV3ResumenArma(a):'Selecciona un arma.'}</div></div>`).join('');}
function actasV3BuscarArma(i,q){const out=document.getElementById(`acta-arma-resultados-${i}`),n=normalizarTexto(q);if(n.length<2){out.style.display='none';return;}const usados=new Set(armasActaSeleccionadas.filter(Boolean).map(a=>a.serie));const rs=armasDisponiblesActa().filter(a=>!usados.has(a.serie)||armasActaSeleccionadas[i]===a).filter(a=>[a.serie,a.codigoArma,a.marca,a.tipo].some(v=>normalizarTexto(v).includes(n))).slice(0,10);out.innerHTML=rs.map(a=>`<div class="acta-resultado" onclick="actasV3ElegirArmaPorSerie(${i},'${encodeURIComponent(a.serie||a.codigoArma||'')}')"><strong>Serie: ${escHtml(a.serie||a.codigoArma)}</strong> · ${escHtml(a.tipo||'')} ${escHtml(a.marca||'')}<br><span style="color:#64748b">${escHtml(a.estado||'')} · ${escHtml(a.provincia||'')} ${escHtml(a.proyecto||'')}</span></div>`).join('')||'<div class="acta-resultado">No hay coincidencias.</div>';out.style.display='block';}
function actasV3ElegirArmaPorSerie(i,serieCodificada){const serie=decodeURIComponent(serieCodificada);actasV3ElegirArma(i,armasDisponiblesActa().find(a=>(a.serie||a.codigoArma)===serie));}
function actasV3ResumenArma(a){return `<span>${escHtml(a.estado||'SIN ESTADO')}</span><br><b>${escHtml(a.clase||'—')}</b> · ${escHtml(a.tipo||'—')} ${escHtml(a.marca||'')} · Cal. ${escHtml(a.calibre||'—')} · Serie <b>${escHtml(a.serie||'—')}</b>`;}
function actasV3ElegirArma(i,a){if(!a)return;armasActaSeleccionadas[i]=a;const e=document.getElementById(`acta-arma-${i}`);if(e)e.value=a.serie||a.codigoArma||'';document.getElementById(`acta-arma-resultados-${i}`).style.display='none';document.getElementById(`acta-arma-resumen-${i}`).innerHTML=actasV3ResumenArma(a);if(!document.getElementById('acta-ciudad').value)document.getElementById('acta-ciudad').value=ciudadSugerida(a.provincia);}
function actasV3Valor(id,otro){const v=document.getElementById(id).value;return v==='OTRO'?document.getElementById(otro).value.trim():v.trim();}
function supervisoresDestino(){const prov=(document.getElementById('acta-provincia-destino').value||'').toUpperCase(),proy=actasV3Valor('acta-proyecto-destino','acta-proyecto-otro'),det=detalleProvincias[prov]||{},p=(det.proyectosList||[]).find(x=>normalizarTexto(x.nombre)===normalizarTexto(proy));return (p?.supervisores?.length?p.supervisores:(det.supervisores||[])).filter(Boolean);}
function leerFormularioActa(){const tipo=document.getElementById('acta-tipo').value,origen=document.querySelector('input[name="acta-receptor-origen"]:checked').value,supOrigen=document.querySelector('input[name="acta-supervisor-origen"]:checked').value,armas=armasActaSeleccionadas.filter(Boolean).map(a=>({codigoArma:a.codigoArma||'',serie:a.serie||'',clase:a.clase||'',categoria:a.categoria||'',tipoArma:a.tipo||'',marca:a.marca||'',calibre:a.calibre||'',urlCredencial:a.urlCredencial||'',urlArma:a.urlImagenArma||'',estadoArma:a.estado||''}));return {tipoActa:tipo==='custodio'?'CUSTODIO VIP':'GUARDIA',fecha:document.getElementById('acta-fecha').value,ciudad:document.getElementById('acta-ciudad').value.trim(),armas,proyecto:actasV3Valor('acta-proyecto-destino','acta-proyecto-otro'),provincia:document.getElementById('acta-provincia-destino').value.trim(),puesto:actasV3Valor('acta-puesto-destino','acta-puesto-otro'),receptorNombre:document.getElementById('acta-receptor-nombre').value.trim(),receptorCedula:document.getElementById('acta-receptor-cedula').value.trim(),receptorOrigen:origen,cargo:actasV3Valor('acta-cargo-select','acta-cargo-otro'),municiones:Number(document.getElementById('acta-municiones').value)||0,aptitud:'APTA',permiso:document.getElementById('acta-permiso').value,modelo:document.getElementById('acta-modelo').value.trim(),comentario:document.getElementById('acta-comentario').value.trim(),novedad:document.getElementById('acta-novedad').value.trim(),supervisorNombre:supOrigen==='registrado'?document.getElementById('acta-supervisor-select').value.trim():document.getElementById('acta-supervisor-nombre').value.trim(),supervisorCedula:supOrigen==='registrado'?document.getElementById('acta-supervisor-cedula-reg').value.trim():document.getElementById('acta-supervisor-cedula').value.trim()};}
function validarDatosActa(d){if(!d.armas.length)return 'Selecciona todas las armas antes de generar el acta.';if(d.armas.length!==armasActaSeleccionadas.length)return 'Falta seleccionar una o más armas.';if(!d.receptorNombre||!d.receptorCedula)return 'El nombre y la cédula de quien recibe son obligatorios.';if(!d.cargo||!d.provincia)return 'Selecciona el cargo y la provincia de destino.';if(!d.fecha||!d.ciudad)return 'Indica la fecha y ciudad del acta.';if(!d.proyecto&&d.tipoActa==='GUARDIA')return 'Indica el proyecto de destino.';if(!d.supervisorNombre)return 'Indica quién entrega.';return '';}
async function generarActaArmamento(){if(actaGenerando)return;const d=leerFormularioActa(),err=validarDatosActa(d);if(err)return mostrarErrorActa(err);mostrarErrorActa('');const b=document.getElementById('acta-btn-generar');actaGenerando=true;b.disabled=true;b.textContent='Registrando…';try{const reg=await registrarActaServidor(d);if(!reg.ok)throw new Error(reg.mensaje||'No se pudo registrar el acta');d.codigoActa=reg.codigo;const ev=await Promise.all(d.armas.map(async a=>({cred:await imagenActaBase64(a.urlCredencial),arma:await imagenActaBase64(a.urlArma)})));if(d.tipoActa==='CUSTODIO VIP')generarPDFCustodio(d,ev);else generarPDFGuardia(d,ev);if(typeof cerrarModalArmamento==='function')cerrarModalArmamento();document.getElementById('actas-modal').style.display='none';}catch(e){mostrarErrorActa(e.message||String(e));}finally{actaGenerando=false;b.disabled=false;b.textContent='📄 Registrar y generar PDF';}}
// PDF V3: un documento y un código para una o varias armas.
function generarPDFGuardia(d,evidencias){
 const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),armas=d.armas||[],W=297;
 dibujarMembretePDF(doc,`Acta de Recepción de Dotaciones · ${d.codigoActa}`,formatFecha(d.fecha));let y=MARGEN_PDF+8;doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(15,23,42);doc.text('ACTA DE RECEPCIÓN DE DOTACIONES',W/2,y,{align:'center'});y+=8;
 const encabezado=armas.length>1?['FECHA',fechaLargaEspanol(d.fecha),'CANTIDAD',armas.length]:['FECHA',fechaLargaEspanol(d.fecha),'CATEGORÍA',`ARMAMENTO - ${textoClaseActa(armas[0]?.clase)}`];doc.autoTable({startY:y,margin:{left:14,right:14},theme:'grid',styles:{fontSize:7.8,cellPadding:2.7},columnStyles:{0:{fontStyle:'bold',fillColor:[203,213,225],cellWidth:22},2:{fontStyle:'bold',fillColor:[203,213,225],cellWidth:26}},body:[encabezado,['NOMBRE',d.receptorNombre,'CÉDULA',d.receptorCedula],['CARGO',d.cargo,'ÁREA / PROYECTO',d.proyecto||'—']]});y=doc.lastAutoTable.finalY+6;
 doc.autoTable({startY:y,margin:{left:8,right:8},head:[['N°','CLASE','CATEGORÍA','TIPO','MARCA','MODELO','CALIBRE','SERIE','MUNICIONES','PERMISO','COMENTARIO','NOVEDAD']],body:armas.map((a,i)=>[i+1,a.clase||'—',a.categoria||'—',a.tipoArma||'—',a.marca||'—',d.modelo||'—',a.calibre||'—',a.serie||'—',d.municiones,d.permiso,d.comentario||'—',d.novedad||'—']),headStyles:{fillColor:[71,85,105],textColor:[255,255,255],fontSize:6.2,halign:'center'},styles:{fontSize:6.1,cellPadding:1.7,halign:'center',valign:'middle'}});y=doc.lastAutoTable.finalY+7;
 armas.forEach((a,i)=>{if(y+45>182){doc.addPage();dibujarMembretePDF(doc,`Acta de Recepción de Dotaciones · ${d.codigoActa}`,formatFecha(d.fecha));y=MARGEN_PDF+8;}const e=evidencias[i]||{},bw=82,bh=38,g=12,x1=(W-(bw*2+g))/2,x2=x1+bw+g;doc.setDrawColor(203,213,225);doc.rect(x1,y,bw,bh);doc.rect(x2,y,bw,bh);doc.setFontSize(6.5);doc.text(`CREDENCIAL · ARMA ${i+1}`,x1+bw/2,y+4,{align:'center'});doc.text(`ARMA · SERIE ${a.serie}`,x2+bw/2,y+4,{align:'center'});if(!addImagenAjustada(doc,e.cred,x1+3,y+6,bw-6,29))doc.text('Sin imagen disponible',x1+bw/2,y+22,{align:'center'});if(!addImagenAjustada(doc,e.arma,x2+3,y+6,bw-6,29))doc.text('Sin imagen disponible',x2+bw/2,y+22,{align:'center'});y+=bh+5;});
 const sy=Math.min(y+3,184),sw=96,sg=12,sx=(W-(sw*2+sg))/2;dibujarFirmaGuardia(doc,sx,sy,sw,'ENTREGA','SUPERVISOR',d.supervisorNombre||'—',d.supervisorCedula||'—');dibujarFirmaGuardia(doc,sx+sw+sg,sy,sw,'RECIBE',d.cargo,d.receptorNombre,d.receptorCedula);return doc;
}
function generarPDFCustodioMultiple(d,evidencias){
 const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),armas=d.armas||[],f=fechaPalabrasActa(d.fecha),x=18,w=174;dibujarPlantillaCustodio(doc,d.codigoActa,formatFecha(d.fecha));doc.setTextColor(15,15,15);doc.setFont('helvetica','bold');doc.setFontSize(11.2);doc.text('DEFEN CIA LTDA',105,34,{align:'center'});doc.text('GUAYAQUIL – ECUADOR',105,40,{align:'center'});doc.setFontSize(11.5);doc.text('ACTA DE ENTREGA, RECEPCIÓN',105,51,{align:'center'});doc.text('Y USO DE ARMAMENTO',105,57,{align:'center'});doc.setFontSize(10.5);doc.text(`NO.: ${d.codigoActa}`,18,70);let y=83;
 y=addTextJustificado(doc,`En la ciudad de ${d.ciudad}, a los ${f.dia} días del mes de ${f.mes} del año ${f.anio}, se suscribe la presente ACTA DE ENTREGA, RECEPCIÓN Y USO DE ARMAMENTO. Se entrega(n) ${armas.length} arma(s) perteneciente(s) a DEFEN CIA. LTDA., con serie(s): ${armas.map(a=>a.serie).join(', ')}.`,x,y,w,10.9,5.25)+7;y=addTextJustificado(doc,`El Sr. ${d.receptorNombre}, con CI. ${d.receptorCedula}, en calidad de ${d.cargo}, declara haber recibido el equipo en buenas condiciones de funcionamiento y se compromete a su correcta utilización, custodia y conservación.`,x,y,w,10.9,5.25)+8;doc.setFont('helvetica','bold');doc.text(String(d.cargo).toUpperCase(),18,y);y+=32;doc.setLineWidth(.3);doc.line(18,y,92,y);doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(`Nombre: ${d.receptorNombre}`,18,y+6);doc.text(`CI.: ${d.receptorCedula}`,18,y+12);
 doc.addPage();dibujarPlantillaCustodio(doc,d.codigoActa,formatFecha(d.fecha));y=42;doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text('Armamento de dotación:',18,y);y+=5;doc.autoTable({startY:y,margin:{left:18,right:18},head:[['N°','CLASE','CATEGORÍA','TIPO','MARCA','CALIBRE','SERIE','MUNICIONES','PERMISO']],body:armas.map((a,i)=>[i+1,a.clase,a.categoria,a.tipoArma,a.marca,a.calibre,a.serie,d.municiones,d.permiso]),headStyles:{fillColor:[145,145,145],textColor:[255,255,255],fontSize:6.4,halign:'center'},styles:{fontSize:6.5,cellPadding:1.8,halign:'center',valign:'middle'}});y=doc.lastAutoTable.finalY+8;
 armas.forEach((a,i)=>{if(y+52>250){doc.addPage();dibujarPlantillaCustodio(doc,d.codigoActa,formatFecha(d.fecha));y=42;}const e=evidencias[i]||{},bw=78,g=18,x1=(210-(bw*2+g))/2,x2=x1+bw+g;doc.setFontSize(7);doc.text(`CREDENCIAL · ARMA ${i+1}`,x1+bw/2,y,{align:'center'});doc.text(`ARMA · ${a.serie}`,x2+bw/2,y,{align:'center'});doc.setDrawColor(226,232,240);doc.rect(x1,y+2,bw,45);doc.rect(x2,y+2,bw,45);if(!addImagenAjustada(doc,e.cred,x1+2,y+4,bw-4,41))doc.text('Sin imagen disponible',x1+bw/2,y+25,{align:'center'});if(!addImagenAjustada(doc,e.arma,x2+2,y+4,bw-4,41))doc.text('Sin imagen disponible',x2+bw/2,y+25,{align:'center'});y+=53;});return doc;
}
// Ajustes de presentación y reglas específicas de Custodio.
function actasV3ActualizarTipo(){const t=document.getElementById('acta-tipo').value;document.getElementById('acta-comentario').value=t==='guardia'?'SE ENTREGA PERMISO ORIGINAL DEL ARMA':'EQUIPO ENTREGADO EN BUENAS CONDICIONES';document.getElementById('acta-seccion-entrega').style.display=t==='guardia'?'block':'none';actasV3BuscarAgentes(document.getElementById('acta-agente-busqueda').value||'');actasV3CantidadArmas();}
function actasV3BuscarAgentes(q){const out=document.getElementById('acta-agente-resultados');q=normalizarTexto(q);const base=personalBaseActas(),tipo=document.getElementById('acta-tipo').value;let candidatos=tipo==='custodio'?base.filter(esPerfilCustodio):base.filter(p=>!esPerfilCustodio(p));if(tipo==='custodio'&&!candidatos.length)candidatos=base;const resultados=q.length>=2?candidatos.filter(p=>[p.nombre,p.cedula].some(v=>normalizarTexto(v).includes(q))).slice(0,12):[];agentesActaFiltrados=resultados;out.innerHTML=resultados.map((p,i)=>`<div class="acta-resultado" onclick="actasV3ElegirAgente(${i})"><strong>${escHtml(p.nombre)}</strong>${p.cedula?` · CI ${escHtml(p.cedula)}`:''}<br><span style="color:#64748b">${escHtml(p.provincia||'')} · ${escHtml(p.proyecto||'')} · ${escHtml(p.puesto||'')}</span></div>`).join('')||'<div class="acta-resultado">No hay coincidencias.</div>';out.style.display=q.length>=2?'block':'none';document.getElementById('acta-agentes-ayuda').textContent=q.length<2?'Escribe al menos 2 caracteres para buscar.':`${resultados.length} coincidencia(s), mostrando nombre, cédula y ubicación.`;}
function armasDisponiblesActa(){const orden={rastrillo:0,activo:1,transito:2,perdida:3,confiscada:4},esCustodio=document.getElementById('acta-tipo')?.value==='custodio';return [...armamentoDetalle].filter(a=>a&&(a.serie||a.codigoArma)&&(!esCustodio||normalizarTexto(a.categoria).includes('movil'))).sort((a,b)=>(orden[normalizarTexto(a.estado)]??9)-(orden[normalizarTexto(b.estado)]??9)||String(a.serie||'').localeCompare(String(b.serie||'')));}
function generarPDFCustodio(d,evidencias){const armas=d.armas||[];if(armas.length===1){const a=armas[0],ev=evidencias[0]||{};return generarPDFCustodioOriginal({...d,...a},ev.cred,ev.arma);}return generarPDFCustodioMultiple(d,evidencias);}

function asegurarProgresoActa(){if(document.getElementById('acta-progreso'))return;const e=document.createElement('div');e.id='acta-progreso';e.style.cssText='display:none;position:fixed;inset:0;z-index:22000;background:rgba(15,23,42,.88);align-items:center;justify-content:center;padding:20px';e.innerHTML='<div style="width:100%;max-width:390px;background:white;border-radius:16px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.4)"><p style="margin:0 0 5px;font-weight:900;color:#0f172a">Generando acta</p><p id="acta-progreso-texto" style="margin:0;color:#64748b;font-size:12px">Preparando…</p><div style="height:8px;background:#e2e8f0;border-radius:99px;margin-top:16px;overflow:hidden"><div id="acta-progreso-barra" style="height:100%;width:8%;background:linear-gradient(90deg,#f97316,#fb923c);transition:width .35s ease"></div></div><p style="margin:10px 0 0;font-size:10px;color:#94a3b8">El PDF se guardará automáticamente en el historial.</p></div>';document.body.appendChild(e);}
function progresoActa(texto,porcentaje){asegurarProgresoActa();document.getElementById('acta-progreso').style.display='flex';document.getElementById('acta-progreso-texto').textContent=texto;document.getElementById('acta-progreso-barra').style.width=`${porcentaje}%`;}
function cerrarProgresoActa(){const e=document.getElementById('acta-progreso');if(e)e.style.display='none';}
async function postActas(payload,timeoutMs=45000){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);try{const r=await fetch(APPS_SCRIPT_URL,{method:'POST',body:JSON.stringify(payload),redirect:'follow',signal:controller.signal});if(!r.ok)throw new Error(`El servidor respondió HTTP ${r.status}.`);return await r.json();}catch(e){if(e.name==='AbortError')throw new Error('El guardado en Drive tardó demasiado. El PDF local ya fue descargado y el acta quedó registrada; el historial lo mostrará como PDF pendiente.');throw e;}finally{clearTimeout(timeout);}}
async function guardarPdfHistorico(codigo,doc){const data=doc.output('datauristring');const base64=data.split(',')[1]||'';console.info(`Archivando PDF ${codigo}: ${(base64.length/1024/1024).toFixed(2)} MB codificados.`);return postActas({accion:'guardar_pdf_acta',token:tokenSesionActual(),codigo,base64},180000);}
async function generarActaArmamento(){if(actaGenerando)return;const d=leerFormularioActa(),err=validarDatosActa(d);if(err)return mostrarErrorActa(err);mostrarErrorActa('');const b=document.getElementById('acta-btn-generar');actaGenerando=true;b.disabled=true;try{progresoActa('Registrando datos del acta…',20);const reg=await registrarActaServidor(d);if(!reg.ok)throw new Error(reg.mensaje||'No se pudo registrar el acta');d.codigoActa=reg.codigo;progresoActa('Registro guardado. Generando PDF…',45);await descargarPdfActa(d);progresoActa('Finalizando…',100);if(typeof cerrarModalArmamento==='function')cerrarModalArmamento();document.getElementById('actas-modal').style.display='none';}catch(e){mostrarErrorActa(e.message||String(e));}finally{setTimeout(cerrarProgresoActa,350);actaGenerando=false;b.disabled=false;b.textContent='📄 Registrar y generar PDF';}}
async function descargarPdfActa(d){progresoActa('Recuperando evidencias fotográficas…',60);const ev=await Promise.all((d.armas||[]).map(async a=>({cred:await imagenActaBase64(a.urlCredencial),arma:await imagenActaBase64(a.urlArma)})));progresoActa('Construyendo PDF…',80);const doc=d.tipoActa==='CUSTODIO VIP'?generarPDFCustodio(d,ev):generarPDFGuardia(d,ev);doc.save(`${d.codigoActa}_${d.tipoActa==='CUSTODIO VIP'?'CUSTODIO':'GUARDIA'}.pdf`);}

function asegurarHistorialActas(){if(document.getElementById('historial-actas-modal'))return;const e=document.createElement('div');e.id='historial-actas-modal';e.style.cssText='display:none;position:fixed;inset:0;z-index:21500;background:rgba(15,23,42,.82);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:16px';e.innerHTML='<div style="width:100%;max-width:930px;max-height:88vh;background:#f8fafc;border-radius:18px;display:flex;flex-direction:column;overflow:hidden"><div style="padding:14px 18px;background:#0f172a;color:white;display:flex;justify-content:space-between"><div><b>Historial de Actas</b><div style="font-size:10px;color:#94a3b8;margin-top:3px">Guardia y Custodio · PDFs guardados en Drive</div></div><button onclick="cerrarHistorialActas()" class="acta-close">✕ Cerrar</button></div><div id="historial-actas-lista" style="padding:14px;overflow:auto;flex:1"></div></div>';document.body.appendChild(e);}
function cerrarHistorialActas(){document.getElementById('historial-actas-modal').style.display='none';}
async function abrirHistorialActas(){asegurarHistorialActas();document.getElementById('historial-actas-modal').style.display='flex';const c=document.getElementById('historial-actas-lista');c.innerHTML='<p style="color:#64748b">Cargando historial…</p>';try{const r=await postActas({accion:'listar_actas',token:tokenSesionActual()});if(!r.ok)throw new Error(r.mensaje);const grupos={GUARDIA:[],CUSTODIO:[]};(r.actas||[]).forEach(a=>(normalizarTexto(a.tipo).includes('custodio')?grupos.CUSTODIO:grupos.GUARDIA).push(a));c.innerHTML=['GUARDIA','CUSTODIO'].map(tipo=>`<h3 class="acta-section">${tipo==='GUARDIA'?'Actas de Guardia':'Actas de Custodio'}</h3>${grupos[tipo].length?grupos[tipo].map(a=>`<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:7px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b style="font-size:12px;color:#0f172a">${escHtml(a.codigo)}</b><div style="font-size:10px;color:#64748b">${escHtml(a.receptor)} · ${a.armas.length} arma(s) · ${escHtml(a.fecha)}</div><div style="font-size:9px;color:#94a3b8">Series: ${a.armas.map(escHtml).join(', ')}</div></div><button onclick="descargarPdfDesdeHistorial('${escAttr(a.codigo)}')" style="border:0;border-radius:7px;background:#dbeafe;color:#075985;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer">📄 Generar PDF</button>${r.esAdmin?`<button onclick="eliminarUltimaActa('${escAttr(a.codigo)}')" style="border:0;border-radius:7px;background:#fee2e2;color:#b91c1c;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer">Eliminar</button>`:''}</div>`).join(''):'<p style="font-size:11px;color:#94a3b8">Sin actas registradas.</p>'}`).join('');}catch(e){c.innerHTML=`<p style="color:#b91c1c;font-weight:700">${escHtml(e.message||String(e))}</p>`;}}
async function descargarPdfDesdeHistorial(codigo){try{progresoActa('Recuperando datos del acta…',20);const r=await postActas({accion:'obtener_acta',token:tokenSesionActual(),codigo});if(!r.ok)throw new Error(r.mensaje);await descargarPdfActa(r.acta);progresoActa('PDF descargado.',100);}catch(e){alert(e.message||String(e));}finally{setTimeout(cerrarProgresoActa,500);}}
async function eliminarUltimaActa(codigo){if(!confirm(`¿Eliminar ${codigo}? Solo se permite eliminar la última acta y también se enviará su PDF a la papelera de Drive.`))return;const r=await postActas({accion:'eliminar_ultima_acta',token:tokenSesionActual(),codigo});if(!r.ok)return alert(r.mensaje||'No se pudo eliminar.');await abrirHistorialActas();}
