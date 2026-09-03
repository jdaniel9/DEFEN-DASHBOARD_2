// ================================================================
// actas.js — Generador de actas de entrega de armamento
// Guardia: A4 horizontal con membrete del dashboard.
// Custodio: plantilla corporativa vertical de 2 páginas.
// Solo ADMIN y OPERACIONES.
// ================================================================

// Estilos compartidos del generador. Se cargan una sola vez, incluso cuando
// el modal se recrea al cambiar entre Nueva acta e Historial.
function inyectarEstilosActasV3() {
    if (document.getElementById('actas-v3-estilos')) return;
    const style = document.createElement('style');
    style.id = 'actas-v3-estilos';
    style.textContent = `
      #actas-modal .acta-card{background:#fff;border:1px solid #dbe4ef;border-radius:12px;padding:13px;box-shadow:0 1px 2px rgba(15,23,42,.03)}
      #actas-modal .acta-label{display:block;margin:0 0 5px;font-size:9px;font-weight:900;letter-spacing:.02em;color:#64748b;text-transform:uppercase}
      #actas-modal .acta-input{display:block;width:100%;min-height:36px;box-sizing:border-box;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;background:#fff;color:#172033;font-size:11px;font-weight:700;outline:none;transition:border-color .16s,box-shadow .16s}
      #actas-modal .acta-input:focus{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.12)}
      #actas-modal .acta-input[readonly]{background:#f8fafc;color:#334155}
      #actas-modal .acta-section{margin:15px 0 7px;font-size:10px;font-weight:900;letter-spacing:.08em;color:#475569}
      #actas-modal .acta-grid2,#actas-modal .acta-grid3,#actas-modal .acta-grid4{display:grid;gap:10px;align-items:start}
      #actas-modal .acta-grid2{grid-template-columns:repeat(2,minmax(0,1fr))}
      #actas-modal .acta-grid3{grid-template-columns:repeat(3,minmax(0,1fr))}
      #actas-modal .acta-grid4{grid-template-columns:repeat(4,minmax(145px,1fr))}
      #actas-modal .acta-radio{display:flex;gap:15px;align-items:center;flex-wrap:wrap;font-size:11px;font-weight:800;color:#334155}
      #actas-modal .acta-radio label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
      #actas-modal .acta-resultados{display:none;position:relative;z-index:3;max-height:165px;margin-top:6px;overflow:auto;border:1px solid #dbe4ef;border-radius:8px;background:#fff;box-shadow:0 8px 20px rgba(15,23,42,.10)}
      #actas-modal .acta-resultado{padding:9px 10px;border-bottom:1px solid #f1f5f9;cursor:pointer;font-size:11px;color:#172033}
      #actas-modal .acta-resultado:last-child{border-bottom:0}
      #actas-modal .acta-resultado:hover{background:#fff7ed}
      #actas-modal .acta-help{margin:6px 0 0;font-size:9px;color:#64748b}
      #actas-modal .acta-error{display:none;margin-bottom:10px;padding:9px 12px;border-radius:9px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800}
      #actas-modal .acta-close,#actas-modal .acta-cancel,#actas-modal .acta-submit{border:0;border-radius:9px;padding:10px 13px;font-weight:900;cursor:pointer;transition:filter .16s,transform .16s}
      #actas-modal .acta-close{background:#334155;color:#fff}
      #actas-modal .acta-cancel{flex:1;border:1px solid #cbd5e1;background:#fff;color:#475569}
      #actas-modal .acta-submit{flex:2;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff}
      #actas-modal .acta-close:hover,#actas-modal .acta-cancel:hover,#actas-modal .acta-submit:hover{filter:brightness(.96)}
      #actas-modal .acta-arma-item{margin-top:10px;padding:11px;border:1px solid #cfe0ff;border-radius:10px;background:#f8fbff}
      #actas-modal .acta-arma-seleccionada{margin-top:7px;padding:9px 10px;border-radius:8px;background:#e9efff;color:#3730a3;font-size:10px;font-weight:700;line-height:1.45}
      #actas-modal .acta-cantidad{width:58px;min-height:28px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px}
      @media(max-width:700px){#actas-modal .acta-grid2,#actas-modal .acta-grid3,#actas-modal .acta-grid4{grid-template-columns:1fr}#actas-modal .acta-radio{gap:9px}}
    `;
    document.head.appendChild(style);
}
inyectarEstilosActasV3();

let armaActaSeleccionada = null;
let actaGenerando = false;
let agentesActaFiltrados = [];
let agenteActaSeleccionado = null;
let idSolicitudActaActual = '';
let idSolicitudRetornoActual = '';
let armasRetornoActuales = [];
let seriesRetornoSeleccionadas = new Set();
let armasRegularizacionActuales = [];
let seriesRegularizacionSeleccionadas = new Set();
let configuracionRegularizacionIndividual = {};
let idSolicitudRegularizacionActual = '';
let personalRegularizacionActual = [];

function nuevoIdSolicitudActa(){
    if(window.crypto && typeof window.crypto.randomUUID==='function')return window.crypto.randomUUID();
    return `acta-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// Ajusta esta lista si aparecen nuevas denominaciones de personal VIP/custodio.
const ACTAS_KEYWORDS_CUSTODIO = [
    'custodio', 'dotacion personal', 'prefectura vip', 'vip', 'escolta'
];

// Implementación heredada conservada temporalmente para comparar la regresión.
// No está enlazada desde la interfaz; las funciones públicas activas están en V3.
function asegurarModalActasLegacyV2() {
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

function abrirGeneradorActaLegacyV2(serie) {
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

function limpiarFormularioActaLegacyV2() {
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
function armasDisponiblesActaLegacyV2(){
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
    // Un custodio puede constar en Asistencia con otro cargo o proyecto.
    // Por eso, para este tipo de acta se permite buscar en todo el personal
    // activo y solo se priorizan los perfiles identificados como custodios.
    if(tipo==='custodio'){
        return [...base].sort((a,b)=>Number(esPerfilCustodio(b))-Number(esPerfilCustodio(a)));
    }
    return base.filter(p=>!esPerfilCustodio(p));
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
function supervisoresDestinoLegacyV2(){
    const prov=(document.getElementById('acta-provincia-destino').value||'').toUpperCase().trim();
    const proy=document.getElementById('acta-proyecto-destino').value||'';
    const det=detalleProvincias[prov]||{};
    const p=(det.proyectosList||[]).find(x=>normalizarTexto(x.nombre)===normalizarTexto(proy));
    return (p&&p.supervisores&&p.supervisores.length?p.supervisores:(det.supervisores||[])).filter(Boolean);
}

function cargarSupervisoresActa(){
    const sel=document.getElementById('acta-supervisor-select');
    const sups=supervisoresDestino();
    sel.innerHTML=sups.length?sups.map(s=>`<option value="${escAttr(s.nombre)}" data-cedula="${escAttr(s.cedula||'')}">${escHtml(s.nombre)}${s.cedula?' · '+escHtml(s.cedula):' · cédula pendiente'}</option>`).join(''):'<option value="">Sin supervisor registrado — usa ingreso manual</option>';
    sel.onchange=seleccionarSupervisorActa;seleccionarSupervisorActa();
}
function seleccionarSupervisorActa(){const opcion=document.getElementById('acta-supervisor-select')?.selectedOptions?.[0],cedula=document.getElementById('acta-supervisor-cedula-reg');if(cedula)cedula.value=opcion?.dataset?.cedula||'';}
function actualizarModoSupervisor(){const m=document.querySelector('input[name="acta-supervisor-origen"]:checked')?.value||'registrado';document.getElementById('acta-supervisor-registrado').style.display=m==='registrado'?'grid':'none';document.getElementById('acta-supervisor-manual').style.display=m==='manual'?'grid':'none';}

function actualizarTipoActa(){
    const t=document.getElementById('acta-tipo').value;
    document.getElementById('acta-comentario').value=t==='guardia'?'SE ENTREGA PERMISO ORIGINAL DEL ARMA':'EQUIPO ENTREGADO EN BUENAS CONDICIONES';
    document.getElementById('acta-seccion-entrega').style.display=t==='guardia'?'block':'none';
    configurarCargoActa('');
    cargarAgentesActa();
}

function leerFormularioActaLegacyV2(){
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

function validarDatosActaLegacyV2(d){
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
function mostrarErrorActa(m){
    const e=document.getElementById('acta-error');
    if(!e)return;
    e.textContent=m;
    e.style.display=m?'block':'none';
    if(m){
        console.error('Actas:',m);
        e.scrollIntoView({behavior:'smooth',block:'center'});
    }
}

async function postActasLegacyV2(payload){const r=await fetch(APPS_SCRIPT_URL,{method:'POST',body:JSON.stringify(payload),redirect:'follow'});return await r.json();}
async function registrarActaServidor(d,confirmarInvalidacion=false,guia=null){if(!idSolicitudActaActual)idSolicitudActaActual=nuevoIdSolicitudActa();return await postActas({accion:'crear_acta_armamento',token:tokenSesionActual(),idSolicitud:idSolicitudActaActual,confirmarInvalidacion,guia,acta:d},90000);}
async function imagenActaBase64(url){if(!url)return '';try{const j=await postActas({accion:'imagen_acta',token:tokenSesionActual(),url});if(j.ok&&j.base64)return `data:${j.mime||'image/jpeg'};base64,${j.base64}`;}catch(e){console.warn('Imagen acta:',e);}return '';}

async function generarActaArmamentoLegacyV2(){
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
        if(typeof cargarDatos==='function')cargarDatos();
    }catch(e){mostrarErrorActa(e.message||String(e));}
    finally{actaGenerando=false;btn.disabled=false;btn.textContent='📄 Registrar y generar PDF';}
}

// ----------------------------------------------------------------
// PDF helpers
// ----------------------------------------------------------------
function partesFechaActa(valor){
    if(!valor)return null;
    const texto=String(valor).trim();
    let p=texto.match(/^(\d{4})-(\d{2})-(\d{2})(?=$|[T\s])/);
    if(p)return {anio:Number(p[1]),mes:Number(p[2]),dia:Number(p[3])};
    p=texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(p)return {anio:Number(p[3]),mes:Number(p[2]),dia:Number(p[1])};
    const fecha=new Date(texto);
    return Number.isNaN(fecha.getTime())?null:{anio:fecha.getFullYear(),mes:fecha.getMonth()+1,dia:fecha.getDate()};
}
function formatearFechaActa(valor){const f=partesFechaActa(valor);return f?`${String(f.dia).padStart(2,'0')}/${String(f.mes).padStart(2,'0')}/${f.anio}`:'—';}
function fechaLargaEspanol(iso){const f=partesFechaActa(iso),meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];return f&&f.mes>=1&&f.mes<=12?`${f.dia} de ${meses[f.mes-1]} del ${f.anio}`:'FECHA NO DISPONIBLE';}
function fechaPalabrasActa(iso){const f=partesFechaActa(iso),meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];return f&&f.mes>=1&&f.mes<=12?{dia:f.dia,mes:meses[f.mes-1],anio:f.anio}:{dia:'—',mes:'—',anio:'—'};}
function textoPDFMayusculas(valor,alternativa='—'){const texto=String(valor??'').trim()||alternativa;return texto.toLocaleUpperCase('es-EC');}
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

function generarPDFGuardiaLegacyV2(d,cred,arma){
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const W=297,DARK=[15,23,42],GRAY=[203,213,225],fechaFmt=formatearFechaActa(d.fecha);
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
    doc.setFont('helvetica','bold');doc.setTextColor(15,23,42);doc.setFontSize(7.2);doc.text(textoPDFMayusculas(nombre),x+4,y+14.5,{maxWidth:w-8});
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
    dibujarPlantillaCustodio(doc,d.codigoActa,formatearFechaActa(d.fecha));

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

    doc.addPage();dibujarPlantillaCustodio(doc,d.codigoActa,formatearFechaActa(d.fecha));
    y=42;doc.setTextColor(20,20,20);doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text('Arma de dotación:',18,y);y+=5;
    doc.autoTable({startY:y,margin:{left:18,right:18},head:[['N°','CLASE','CATEGORÍA','TIPO','MARCA','CALIBRE','SERIE','ALIMENT.','MUNICIONES','PERMISO (CREDENCIAL)']],body:[[1,d.clase,d.categoria,d.tipoArma,d.marca,d.calibre,d.serie,d.alimentadoras||1,d.municiones,d.permiso]],headStyles:{fillColor:[145,145,145],textColor:[255,255,255],fontSize:6,halign:'center'},styles:{fontSize:6.1,cellPadding:1.6,halign:'center',valign:'middle'}});
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

function asegurarModalActasLegacyV3Inicial(){
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
function actasV3PrepararPestanaPendientes(){
    const tabHistorial=document.getElementById('acta-tab-historial'),vistaHistorial=document.getElementById('acta-vista-historial');
    if(!tabHistorial||!vistaHistorial)return;
    if(!document.getElementById('acta-tab-pendientes')){
        const boton=document.createElement('button');boton.id='acta-tab-pendientes';boton.textContent='⚠️ Pendientes de subsanar';boton.onclick=()=>mostrarPestanaActas('pendientes');boton.style.cssText='border:0;border-radius:8px;padding:7px 12px;background:#e2e8f0;color:#334155;font-size:11px;font-weight:900;cursor:pointer';tabHistorial.after(boton);
        const vista=document.createElement('div');vista.id='acta-vista-pendientes';vista.style.cssText='display:none;overflow:auto;padding:16px 18px';vista.innerHTML='<div id="actas-pendientes-lista"></div>';vistaHistorial.after(vista);
    }
    if(!document.getElementById('acta-tab-transito')){
        const boton=document.createElement('button');boton.id='acta-tab-transito';boton.textContent='🚚 En tránsito';boton.onclick=()=>mostrarPestanaActas('transito');boton.style.cssText='border:0;border-radius:8px;padding:7px 12px;background:#e2e8f0;color:#334155;font-size:11px;font-weight:900;cursor:pointer';document.getElementById('acta-tab-pendientes').after(boton);
        const vista=document.createElement('div');vista.id='acta-vista-transito';vista.style.cssText='display:none;overflow:auto;padding:16px 18px';vista.innerHTML='<div id="actas-transito-lista"></div>';document.getElementById('acta-vista-pendientes').after(vista);
    }
    if(!document.getElementById('acta-tab-retorno')){
        const boton=document.createElement('button');boton.id='acta-tab-retorno';boton.textContent='↩ Retornar al rastrillo';boton.onclick=()=>mostrarPestanaActas('retorno');boton.style.cssText='border:0;border-radius:8px;padding:7px 12px;background:#e2e8f0;color:#334155;font-size:11px;font-weight:900;cursor:pointer';document.getElementById('acta-tab-transito').after(boton);boton.parentElement.style.flexWrap='wrap';
        const vista=document.createElement('div');vista.id='acta-vista-retorno';vista.style.cssText='display:none;overflow:auto;padding:16px 18px';vista.innerHTML=`<div class="acta-card"><div class="acta-grid3"><div><label class="acta-label">Proyecto de origen</label><select id="retorno-proyecto" class="acta-input" onchange="cambiarProyectoRetorno()"></select></div><div><label class="acta-label">Rastrillo de destino</label><select id="retorno-destino" class="acta-input"><option value="">Selecciona destino</option><option value="GUAYAS">GUAYAS · Guayaquil / Matriz</option><option value="MANABI">MANABÍ · Manta / Sucursal</option><option value="PICHINCHA">PICHINCHA · Quito / Sucursal</option></select></div><div><label class="acta-label">Fecha efectiva</label><input id="retorno-fecha" type="date" class="acta-input"></div></div><div style="margin-top:10px"><label class="acta-label">Observación</label><textarea id="retorno-observacion" class="acta-input" maxlength="500" rows="2" placeholder="Motivo o detalle del retorno"></textarea></div><div style="margin-top:10px"><label class="acta-label">Guía de retorno (PDF · máximo 10 MB)</label><input id="retorno-guia" type="file" accept="application/pdf,.pdf" class="acta-input"><p class="acta-help">Obligatoria para Operaciones. Administrador puede iniciar una emergencia pendiente de subsanar.</p></div></div><h3 class="acta-section">ARMAS DEL PROYECTO</h3><div class="acta-card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px"><span id="retorno-contador" style="font-size:10px;font-weight:900;color:#475569">0 seleccionadas</span><button onclick="seleccionarTodasRetorno()" style="border:0;border-radius:7px;background:#e2e8f0;color:#334155;padding:6px 9px;font-size:9px;font-weight:900;cursor:pointer">Seleccionar todas</button></div><div id="retorno-armas-lista"></div></div><button id="retorno-btn-iniciar" onclick="iniciarRetornoArmamento()" style="width:100%;margin-top:12px;border:0;border-radius:10px;background:#0f172a;color:white;padding:11px;font-size:11px;font-weight:900;cursor:pointer">↩ Iniciar retorno al rastrillo</button>`;document.getElementById('acta-vista-transito').after(vista);
    }
    if(!document.getElementById('acta-tab-regularizacion')){
        const boton=document.createElement('button');boton.id='acta-tab-regularizacion';boton.textContent='🛠 Regularizar';boton.onclick=()=>mostrarPestanaActas('regularizacion');boton.style.cssText='border:0;border-radius:8px;padding:7px 12px;background:#e2e8f0;color:#334155;font-size:11px;font-weight:900;cursor:pointer';document.getElementById('acta-tab-retorno').after(boton);
        const vista=document.createElement('div');vista.id='acta-vista-regularizacion';vista.style.cssText='display:none;overflow:auto;padding:16px 18px';vista.innerHTML=`<div class="acta-card"><div class="acta-grid4"><div><label class="acta-label">Proyecto</label><select id="regularizacion-proyecto" class="acta-input" onchange="cambiarProyectoRegularizacion()"></select></div><div><label class="acta-label">Modalidad</label><select id="regularizacion-modo" class="acta-input" onchange="renderArmasRegularizacion()"><option value="LOTE">Una acta en lote</option><option value="INDIVIDUAL">Actas individuales</option></select></div><div><label class="acta-label">Fecha del acta</label><input id="regularizacion-fecha" type="date" class="acta-input"></div><div><label class="acta-label">Fecha real de traslado</label><input id="regularizacion-fecha-traslado" type="date" class="acta-input"></div><div><label class="acta-label">Ciudad</label><input id="regularizacion-ciudad" class="acta-input" placeholder="Ciudad donde se regulariza"></div></div><div id="regularizacion-datos-lote" class="acta-grid3" style="margin-top:10px"><div><label class="acta-label">Tipo de acta del lote</label><select id="regularizacion-tipo" class="acta-input" onchange="renderArmasRegularizacion()"><option value="GUARDIA">GUARDIA</option><option value="CUSTODIO VIP">CUSTODIO / VIP</option></select></div><div><label class="acta-label">Supervisor responsable</label><select id="regularizacion-responsable" class="acta-input" onchange="elegirResponsableRegularizacion()"></select></div><div><label class="acta-label">Cédula del responsable</label><input id="regularizacion-responsable-cedula" inputmode="numeric" maxlength="10" class="acta-input"></div></div><div class="acta-grid3" style="margin-top:10px"><div><label class="acta-label">Alimentadoras por arma</label><input id="regularizacion-alimentadoras" type="number" min="1" max="100" value="1" class="acta-input"></div><div><label class="acta-label">Quién entrega (para Guardia)</label><input id="regularizacion-entrega" class="acta-input" placeholder="Nombre de quien entrega"></div><div><label class="acta-label">Cédula de quien entrega (opcional)</label><input id="regularizacion-entrega-cedula" class="acta-input" maxlength="10"></div></div><p class="acta-help"><b>Fecha real de traslado:</b> desde esa fecha se calcularán los días que el arma lleva fuera del rastrillo. La fecha del acta corresponde al documento que generas ahora. Se reutilizará la guía existente.</p></div><h3 class="acta-section">ARMAS ACTIVAS SIN ACTA</h3><div class="acta-card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px"><span id="regularizacion-contador" style="font-size:10px;font-weight:900;color:#475569">0 seleccionadas</span><button onclick="seleccionarTodasRegularizacion()" style="border:0;border-radius:7px;background:#e2e8f0;color:#334155;padding:6px 9px;font-size:9px;font-weight:900;cursor:pointer">Seleccionar todas</button></div><div id="regularizacion-armas-lista"></div></div><button id="regularizacion-btn" onclick="ejecutarRegularizacion()" style="width:100%;margin-top:12px;border:0;border-radius:10px;background:#7c3aed;color:white;padding:11px;font-size:11px;font-weight:900;cursor:pointer">🛠 Crear acta(s) de regularización</button>`;document.getElementById('acta-vista-retorno').after(vista);
        const selectorResponsable=document.getElementById('regularizacion-responsable');
        if(selectorResponsable&&!document.getElementById('regularizacion-responsable-manual')){
            const manual=document.createElement('input');
            manual.id='regularizacion-responsable-manual';
            manual.className='acta-input';
            manual.maxLength=120;
            manual.placeholder='Nombre del supervisor';
            manual.style.cssText='display:none;margin-top:6px';
            selectorResponsable.after(manual);
        }
    }
}
function mostrarPestanaActas(vista){
    const historial=vista==='historial',pendientes=vista==='pendientes',transito=vista==='transito',retorno=vista==='retorno',regularizacion=vista==='regularizacion',nueva=!historial&&!pendientes&&!transito&&!retorno&&!regularizacion;
    document.getElementById('acta-vista-nueva').style.display=nueva?'block':'none';
    document.getElementById('acta-vista-historial').style.display=historial?'block':'none';
    const vistaPendientes=document.getElementById('acta-vista-pendientes');if(vistaPendientes)vistaPendientes.style.display=pendientes?'block':'none';
    const vistaTransito=document.getElementById('acta-vista-transito');if(vistaTransito)vistaTransito.style.display=transito?'block':'none';
    const vistaRetorno=document.getElementById('acta-vista-retorno');if(vistaRetorno)vistaRetorno.style.display=retorno?'block':'none';
    const vistaRegularizacion=document.getElementById('acta-vista-regularizacion');if(vistaRegularizacion)vistaRegularizacion.style.display=regularizacion?'block':'none';
    document.getElementById('acta-pie').style.display=nueva?'flex':'none';
    [['acta-tab-nueva',nueva],['acta-tab-historial',historial],['acta-tab-pendientes',pendientes],['acta-tab-transito',transito],['acta-tab-retorno',retorno],['acta-tab-regularizacion',regularizacion]].forEach(([id,activo])=>{const e=document.getElementById(id);if(e)e.style.cssText=`border:0;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:900;cursor:pointer;${activo?'background:#f97316;color:white':'background:#e2e8f0;color:#334155'}`;});
    if(historial)cargarHistorialIntegrado();
    if(pendientes)cargarGuiasPendientes();
    if(transito)cargarMovimientosTransito();
    if(retorno)prepararFormularioRetorno();
    if(regularizacion)prepararFormularioRegularizacion();
}
function armasDisponiblesRetorno(){return (armamentoDetalle||[]).filter(a=>['activo','en campo'].includes(normalizarTexto(a.estado))&&!a.bloqueadaAsignacion&&!a.idMantenimientoActual&&a.provincia&&a.proyecto&&a.serie);}
function armasPendientesRegularizacion(){return (armamentoDetalle||[]).filter(a=>['activo','en campo'].includes(normalizarTexto(a.estado))&&!a.bloqueadaAsignacion&&!a.idMantenimientoActual&&!String(a.actaVigente||'').trim()&&a.provincia&&a.proyecto&&a.serie);}
function prepararFormularioRegularizacion(){
    const select=document.getElementById('regularizacion-proyecto');if(!select)return;const proyectos=[...new Map(armasPendientesRegularizacion().map(a=>[`${a.provincia}||${a.proyecto}`,{clave:`${a.provincia}||${a.proyecto}`,provincia:a.provincia,proyecto:a.proyecto}])).values()].sort((a,b)=>a.clave.localeCompare(b.clave)),anterior=select.value;
    select.innerHTML='<option value="">Selecciona un proyecto</option>'+proyectos.map(p=>`<option value="${escAttr(p.clave)}">${escHtml(p.provincia)} · ${escHtml(p.proyecto)}</option>`).join('');if(proyectos.some(p=>p.clave===anterior))select.value=anterior;
    const fecha=document.getElementById('regularizacion-fecha');if(fecha&&!fecha.value)fecha.value=fechaISOHoy();if(!idSolicitudRegularizacionActual)idSolicitudRegularizacionActual=nuevoIdSolicitudActa();cambiarProyectoRegularizacion();
}
function supervisoresConfiguradosProyecto(provincia,proyecto){return (Array.isArray(supervisoresActas)?supervisoresActas:[]).filter(s=>normalizarTexto(s.estado||'activo')==='activo'&&normalizarTexto(s.provincia)===normalizarTexto(provincia)&&normalizarTexto(s.proyecto)===normalizarTexto(proyecto)).filter((s,i,lista)=>lista.findIndex(x=>normalizarTexto(x.nombre)===normalizarTexto(s.nombre))===i).sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||'')));}
function cambiarProyectoRegularizacion(){
    const clave=document.getElementById('regularizacion-proyecto')?.value||'';armasRegularizacionActuales=armasPendientesRegularizacion().filter(a=>`${a.provincia}||${a.proyecto}`===clave);seriesRegularizacionSeleccionadas=new Set();configuracionRegularizacionIndividual={};
    const [provincia,proyecto]=clave.split('||');personalRegularizacionActual=supervisoresConfiguradosProyecto(provincia,proyecto).filter(p=>/^\d{10}$/.test(String(p.cedula||'')));
    const resp=document.getElementById('regularizacion-responsable'),manual=document.getElementById('regularizacion-responsable-manual'),cedula=document.getElementById('regularizacion-responsable-cedula');if(resp)resp.innerHTML='<option value="">'+(personalRegularizacionActual.length?'Selecciona supervisor':'No hay supervisores con cédula registrados')+'</option>'+personalRegularizacionActual.map((p,i)=>`<option value="${i}">${escHtml(p.nombre)} · ${escHtml(p.cedula)}</option>`).join('')+'<option value="MANUAL">Escribir supervisor manualmente</option>';if(manual){manual.value='';manual.style.display='none';}if(cedula)cedula.value='';renderArmasRegularizacion();
}
function opcionesPersonalRegularizacion(cedula=''){return '<option value="">Selecciona responsable</option>'+personalRegularizacionActual.map((p,i)=>`<option value="${i}" ${String(p.cedula)===String(cedula)?'selected':''}>${escHtml(p.nombre)} · ${escHtml(p.cedula)}</option>`).join('');}
function renderArmasRegularizacion(){
    const c=document.getElementById('regularizacion-armas-lista'),contador=document.getElementById('regularizacion-contador'),modo=document.getElementById('regularizacion-modo')?.value||'LOTE';if(!c)return;document.getElementById('regularizacion-datos-lote').style.display=modo==='LOTE'?'grid':'none';contador.textContent=`${seriesRegularizacionSeleccionadas.size} de ${armasRegularizacionActuales.length} seleccionada(s)`;
    c.innerHTML=armasRegularizacionActuales.length?armasRegularizacionActuales.map((a,i)=>{const cfg=configuracionRegularizacionIndividual[a.serie]||{tipoActa:'GUARDIA',responsableCedula:''},esMovil=normalizarTexto(a.categoria).includes('movil');return `<div style="padding:8px;border-bottom:1px solid #f1f5f9"><label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-size:10px;color:#334155"><input type="checkbox" ${seriesRegularizacionSeleccionadas.has(a.serie)?'checked':''} onchange="alternarArmaRegularizacion(${i},this.checked)"><span><b>${escHtml(a.serie)}</b> · ${escHtml(a.clase)} · ${escHtml(a.marca)} · ${escHtml(a.puesto||'Sin puesto')}${a.urlGuiaEnvio?' · 📄 Guía existente':' · Sin guía registrada'}</span></label>${modo==='INDIVIDUAL'&&seriesRegularizacionSeleccionadas.has(a.serie)?`<div class="acta-grid2" style="margin:8px 0 0 24px"><select class="acta-input" onchange="actualizarTipoRegularizacion('${escAttr(a.serie)}',this.value)"><option value="GUARDIA" ${cfg.tipoActa==='GUARDIA'?'selected':''}>GUARDIA</option>${esMovil?`<option value="CUSTODIO VIP" ${cfg.tipoActa==='CUSTODIO VIP'?'selected':''}>CUSTODIO / VIP</option>`:''}</select><select class="acta-input" onchange="actualizarResponsableRegularizacion('${escAttr(a.serie)}',this.value)">${opcionesPersonalRegularizacion(cfg.responsableCedula)}</select></div>`:''}</div>`;}).join(''):'<p style="font-size:10px;color:#94a3b8">No existen armas Activo sin acta en este proyecto.</p>';
}
function alternarArmaRegularizacion(indice,marcada){const a=armasRegularizacionActuales[indice];if(!a)return;if(marcada){seriesRegularizacionSeleccionadas.add(a.serie);if(!configuracionRegularizacionIndividual[a.serie])configuracionRegularizacionIndividual[a.serie]={tipoActa:'GUARDIA',responsableCedula:'',responsableNombre:''};}else seriesRegularizacionSeleccionadas.delete(a.serie);renderArmasRegularizacion();}
function seleccionarTodasRegularizacion(){if(seriesRegularizacionSeleccionadas.size===armasRegularizacionActuales.length)seriesRegularizacionSeleccionadas=new Set();else{seriesRegularizacionSeleccionadas=new Set(armasRegularizacionActuales.map(a=>a.serie));armasRegularizacionActuales.forEach(a=>{if(!configuracionRegularizacionIndividual[a.serie])configuracionRegularizacionIndividual[a.serie]={tipoActa:'GUARDIA',responsableCedula:'',responsableNombre:''};});}renderArmasRegularizacion();}
function elegirResponsableRegularizacion(){const valor=document.getElementById('regularizacion-responsable')?.value||'',manual=document.getElementById('regularizacion-responsable-manual'),p=valor===''||valor==='MANUAL'?null:personalRegularizacionActual[Number(valor)];if(manual)manual.style.display=valor==='MANUAL'?'block':'none';document.getElementById('regularizacion-responsable-cedula').value=p?.cedula||'';}
function actualizarTipoRegularizacion(serie,tipo){if(!configuracionRegularizacionIndividual[serie])configuracionRegularizacionIndividual[serie]={};configuracionRegularizacionIndividual[serie].tipoActa=tipo;}
function actualizarResponsableRegularizacion(serie,indice){const p=indice===''?null:personalRegularizacionActual[Number(indice)];if(!configuracionRegularizacionIndividual[serie])configuracionRegularizacionIndividual[serie]={};configuracionRegularizacionIndividual[serie].responsableNombre=p?.nombre||'';configuracionRegularizacionIndividual[serie].responsableCedula=p?.cedula||'';}
async function ejecutarRegularizacion(){
    const clave=document.getElementById('regularizacion-proyecto')?.value||'',modo=document.getElementById('regularizacion-modo')?.value||'LOTE',fecha=document.getElementById('regularizacion-fecha')?.value||'',fechaTraslado=document.getElementById('regularizacion-fecha-traslado')?.value||'',ciudad=document.getElementById('regularizacion-ciudad')?.value.trim()||'',entregaNombre=document.getElementById('regularizacion-entrega')?.value.trim()||'',entregaCedula=document.getElementById('regularizacion-entrega-cedula')?.value.trim()||'',alimentadoras=Math.trunc(Number(document.getElementById('regularizacion-alimentadoras')?.value)||0),btn=document.getElementById('regularizacion-btn'),[provincia,proyecto]=clave.split('||'),seleccionadas=armasRegularizacionActuales.filter(a=>seriesRegularizacionSeleccionadas.has(a.serie));
    if(!clave)return alert('Selecciona el proyecto.');if(!seleccionadas.length)return alert('Selecciona al menos un arma.');if(!fecha||!fechaTraslado||!ciudad)return alert('Fecha del acta, fecha real de traslado y ciudad son obligatorias.');if(fechaTraslado>fecha)return alert('La fecha real de traslado no puede ser posterior a la fecha del acta de regularización.');if(alimentadoras<1||alimentadoras>100)return alert('Las alimentadoras deben estar entre 1 y 100 por arma.');let registros=[];
    if(modo==='LOTE'){const tipoActa=document.getElementById('regularizacion-tipo').value,valorResponsable=document.getElementById('regularizacion-responsable').value,p=valorResponsable===''||valorResponsable==='MANUAL'?null:personalRegularizacionActual[Number(valorResponsable)],nombreResponsable=valorResponsable==='MANUAL'?(document.getElementById('regularizacion-responsable-manual')?.value.trim()||''):(p?.nombre||''),cedula=document.getElementById('regularizacion-responsable-cedula').value.trim();if(!nombreResponsable||!/^\d{10}$/.test(cedula))return alert('Selecciona o escribe el supervisor responsable y verifica su cédula.');if(tipoActa==='GUARDIA'&&!entregaNombre)return alert('Indica quién entrega para el acta de Guardia.');if(tipoActa==='CUSTODIO VIP'&&seleccionadas.some(a=>!normalizarTexto(a.categoria).includes('movil')))return alert('Para Custodio/VIP todas las armas seleccionadas deben ser categoría Móvil.');registros=seleccionadas.map(a=>({serie:a.serie,tipoActa,responsableNombre:nombreResponsable,responsableCedula:cedula,cargo:'SUPERVISOR',puesto:a.puesto||'',alimentadoras,municiones:alimentadoras*(tipoActa==='CUSTODIO VIP'?10:5),urlCredencial:a.urlCredencial||'',urlArma:a.urlImagenArma||''}));}
    else{for(const a of seleccionadas){const cfg=configuracionRegularizacionIndividual[a.serie]||{};if(!cfg.responsableNombre||!/^\d{10}$/.test(String(cfg.responsableCedula||'')))return alert(`Selecciona un responsable válido para la serie ${a.serie}.`);if(cfg.tipoActa==='GUARDIA'&&!entregaNombre)return alert('Indica quién entrega para las actas de Guardia.');const tipoActa=cfg.tipoActa||'GUARDIA';registros.push({serie:a.serie,tipoActa,responsableNombre:cfg.responsableNombre,responsableCedula:cfg.responsableCedula,cargo:'RESPONSABLE',puesto:a.puesto||'',alimentadoras,municiones:alimentadoras*(tipoActa==='CUSTODIO VIP'?10:5),urlCredencial:a.urlCredencial||'',urlArma:a.urlImagenArma||''});}}
    if(!confirm(`¿Regularizar ${registros.length} arma(s) de ${proyecto}?\n\nEl tiempo fuera del rastrillo se contará desde ${fechaTraslado}. Permanecerán en estado Activo y se crearán ${modo==='LOTE'?'una acta':'actas individuales'}.`))return;
    try{btn.disabled=true;progresoActa('Registrando regularización…',25);const r=await postActas({accion:'regularizar_armas',token:tokenSesionActual(),idSolicitud:idSolicitudRegularizacionActual||nuevoIdSolicitudActa(),modo,fecha,fechaTraslado,ciudad,provincia,proyecto,entregaNombre,entregaCedula,registros},90000);if(!r.ok)throw new Error(r.mensaje);idSolicitudRegularizacionActual='';progresoActa('Generando acta(s)…',55);for(const codigo of (r.codigos||[])){const detalle=await postActas({accion:'obtener_acta',token:tokenSesionActual(),codigo});if(detalle.ok)await descargarPdfActa(detalle.acta);}alert(r.mensaje);if(typeof cargarDatos==='function')await cargarDatos();mostrarPestanaActas('historial');}catch(e){alert(e.message||String(e));}finally{btn.disabled=false;setTimeout(cerrarProgresoActa,350);}
}
function prepararFormularioRetorno(){
    const select=document.getElementById('retorno-proyecto');if(!select)return;
    const proyectos=[...new Map(armasDisponiblesRetorno().map(a=>[`${a.provincia}||${a.proyecto}`,{clave:`${a.provincia}||${a.proyecto}`,provincia:a.provincia,proyecto:a.proyecto}])).values()].sort((a,b)=>`${a.provincia} ${a.proyecto}`.localeCompare(`${b.provincia} ${b.proyecto}`));
    const anterior=select.value;select.innerHTML='<option value="">Selecciona un proyecto</option>'+proyectos.map(p=>`<option value="${escAttr(p.clave)}">${escHtml(p.provincia)} · ${escHtml(p.proyecto)}</option>`).join('');if(proyectos.some(p=>p.clave===anterior))select.value=anterior;
    const fecha=document.getElementById('retorno-fecha');if(fecha&&!fecha.value)fecha.value=fechaISOHoy();
    if(!idSolicitudRetornoActual)idSolicitudRetornoActual=nuevoIdSolicitudActa();
    cambiarProyectoRetorno();
}
function cambiarProyectoRetorno(){
    const clave=document.getElementById('retorno-proyecto')?.value||'';armasRetornoActuales=armasDisponiblesRetorno().filter(a=>`${a.provincia}||${a.proyecto}`===clave);seriesRetornoSeleccionadas=new Set();renderArmasRetorno();
}
function renderArmasRetorno(){
    const c=document.getElementById('retorno-armas-lista'),contador=document.getElementById('retorno-contador');if(!c)return;
    contador.textContent=`${seriesRetornoSeleccionadas.size} de ${armasRetornoActuales.length} seleccionada(s)`;
    c.innerHTML=armasRetornoActuales.length?armasRetornoActuales.map((a,i)=>`<label style="display:flex;align-items:center;gap:9px;padding:8px;border-bottom:1px solid #f1f5f9;cursor:pointer;font-size:10px;color:#334155"><input type="checkbox" ${seriesRetornoSeleccionadas.has(a.serie)?'checked':''} onchange="alternarArmaRetorno(${i},this.checked)"><span><b>${escHtml(a.serie)}</b> · ${escHtml(a.clase)} · ${escHtml(a.marca)}<br><span style="color:#94a3b8">${escHtml(a.puesto||'Sin puesto')} · Responsable: ${escHtml(a.responsableNombre||'No registrado')}</span></span></label>`).join(''):'<p style="font-size:10px;color:#94a3b8">Selecciona un proyecto con armamento Activo.</p>';
}
function alternarArmaRetorno(indice,marcada){const arma=armasRetornoActuales[indice];if(!arma)return;if(marcada)seriesRetornoSeleccionadas.add(arma.serie);else seriesRetornoSeleccionadas.delete(arma.serie);renderArmasRetorno();}
function seleccionarTodasRetorno(){if(seriesRetornoSeleccionadas.size===armasRetornoActuales.length)seriesRetornoSeleccionadas=new Set();else seriesRetornoSeleccionadas=new Set(armasRetornoActuales.map(a=>a.serie));renderArmasRetorno();}
async function iniciarRetornoArmamento(){
    const series=[...seriesRetornoSeleccionadas],destino=document.getElementById('retorno-destino')?.value||'',fecha=document.getElementById('retorno-fecha')?.value||'',observacion=document.getElementById('retorno-observacion')?.value||'',archivo=document.getElementById('retorno-guia')?.files?.[0],btn=document.getElementById('retorno-btn-iniciar');
    if(!document.getElementById('retorno-proyecto')?.value)return alert('Selecciona el proyecto de origen.');if(!series.length)return alert('Selecciona al menos un arma.');if(!destino)return alert('Selecciona el rastrillo de destino.');if(!fecha)return alert('Selecciona la fecha efectiva.');
    if(!archivo&&rolActual()!=='admin')return alert('La guía PDF es obligatoria para Operaciones.');
    if(!archivo&&rolActual()==='admin'&&!confirm('El retorno se iniciará SIN GUÍA por autorización de Administrador.\n\nEl movimiento quedará PENDIENTE DE SUBSANAR.\n\n¿Deseas continuar?'))return;
    if(fecha!==fechaISOHoy()){const relacion=fecha<fechaISOHoy()?'anterior':'futura';if(!confirm(`La fecha del retorno es ${relacion} a la actual. ¿Confirmas que deseas continuar?`))return;}
    const destinoTexto=document.getElementById('retorno-destino').selectedOptions[0]?.textContent||destino;if(!confirm(`¿Iniciar el retorno de ${series.length} arma(s) hacia ${destinoTexto}?\n\nLas armas pasarán de Activo a Transito.`))return;
    try{
        btn.disabled=true;progresoActa(archivo?'Subiendo guía e iniciando retorno…':'Registrando retorno de emergencia…',35);const guia=archivo?await actasV3ArchivoPdfABase64(archivo):null;
        const r=await postActas({accion:'iniciar_retorno_armas',token:tokenSesionActual(),idSolicitud:idSolicitudRetornoActual||nuevoIdSolicitudActa(),series,destino,fecha,observacion,guia},90000);if(!r.ok)throw new Error(r.mensaje);
        progresoActa('Retorno registrado.',100);alert(r.mensaje+(r.pendienteSubsanar?'\nLa guía quedó pendiente de subsanar.':''));idSolicitudRetornoActual='';seriesRetornoSeleccionadas=new Set();if(typeof cargarDatos==='function')await cargarDatos();mostrarPestanaActas('transito');
    }catch(e){alert(e.message||String(e));}finally{btn.disabled=false;setTimeout(cerrarProgresoActa,350);}
}
async function cargarMovimientosTransito(){
    const c=document.getElementById('actas-transito-lista');if(!c)return;c.innerHTML='<p style="color:#64748b">Cargando armas en tránsito…</p>';
    try{
        const r=await postActas({accion:'listar_movimientos_transito',token:tokenSesionActual()});if(!r.ok)throw new Error(r.mensaje);
        const movimientos=r.movimientos||[];
        if(!movimientos.length){c.innerHTML='<div style="background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:12px;padding:14px;font-size:11px;font-weight:800">✓ No existen armas pendientes de confirmar llegada.</div>';return;}
        c.innerHTML=`<div style="background:#eff6ff;border:1px solid #93c5fd;color:#1e40af;border-radius:12px;padding:12px;margin-bottom:12px;font-size:10px;font-weight:700">Confirma la llegada únicamente cuando todas las armas del lote estén físicamente en su destino.</div>`+movimientos.map(m=>{const haciaRastrillo=['RETORNO','RECUPERACION'].includes(m.tipoMovimiento),recuperacion=m.tipoMovimiento==='RECUPERACION',color=recuperacion?'#0891b2':haciaRastrillo?'#f97316':'#2563eb',etiqueta=recuperacion?'RECUPERACIÓN · ':m.tipoMovimiento==='RETORNO'?'RETORNO · ':'';return `<div style="background:white;border:1px solid #bfdbfe;border-left:4px solid ${color};border-radius:10px;padding:11px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:250px"><b style="font-size:12px;color:#0f172a">${escHtml(m.loteId||m.codigoActa)}</b><span style="display:inline-block;margin-left:7px;padding:3px 7px;border-radius:99px;background:#dbeafe;color:#1d4ed8;font-size:8px;font-weight:900">${etiqueta}EN TRÁNSITO</span>${m.estadoDocumental==='PENDIENTE_SUBSANAR'?'<span style="display:inline-block;margin-left:5px;padding:3px 7px;border-radius:99px;background:#ffedd5;color:#c2410c;font-size:8px;font-weight:900">GUÍA PENDIENTE</span>':''}<div style="font-size:10px;color:#475569;margin-top:4px">Destino: ${escHtml(m.provinciaDestino)} · ${escHtml(m.ciudadDestino)}${m.proyectoDestino?' · '+escHtml(m.proyectoDestino):''}${m.puestoDestino?' · '+escHtml(m.puestoDestino):''}</div><div style="font-size:9px;color:#94a3b8">${m.responsable?'Responsable: '+escHtml(m.responsable)+' · ':''}Series: ${(m.armas||[]).map(a=>escHtml(a.serie)).join(', ')}</div></div>${m.urlGuia?`<a href="${escAttr(m.urlGuia)}" target="_blank" rel="noopener" style="border-radius:7px;background:#ecfdf5;color:#047857;padding:7px 9px;font-size:10px;font-weight:900;text-decoration:none">Ver guía</a>`:''}<button onclick="confirmarLlegadaMovimiento('${escAttr(m.loteId||'')}','${escAttr(m.codigoActa||'')}',${Number((m.armas||[]).length)},'${escAttr(m.tipoMovimiento||'ASIGNACION')}')" style="border:0;border-radius:7px;background:${color};color:white;padding:7px 10px;font-size:10px;font-weight:900;cursor:pointer">✓ Confirmar llegada</button></div>`;}).join('');
    }catch(e){c.innerHTML=`<p style="color:#b91c1c;font-weight:700">${escHtml(e.message||String(e))}</p>`;}
}
async function confirmarLlegadaMovimiento(loteId,codigoActa,cantidad,tipoMovimiento){
    const haciaRastrillo=['RETORNO','RECUPERACION'].includes(tipoMovimiento),resultado=haciaRastrillo?'Rastrillo y sus actas quedarán FINALIZADAS':'Activo en el proyecto y puesto de destino';
    if(!confirm(`¿Confirmas que las ${cantidad} arma(s) de ${loteId||codigoActa} llegaron físicamente a su destino?\n\nAl continuar quedarán en estado ${resultado}.`))return;
    try{progresoActa('Confirmando recepción del armamento…',45);const r=await postActas({accion:'confirmar_llegada_armas',token:tokenSesionActual(),loteId,codigoActa},90000);if(!r.ok)throw new Error(r.mensaje);progresoActa('Llegada confirmada.',100);alert(r.mensaje);if(typeof cargarDatos==='function')await cargarDatos();await cargarMovimientosTransito();}catch(e){alert(e.message||String(e));}finally{setTimeout(cerrarProgresoActa,350);}
}
async function cargarGuiasPendientes(){
    const c=document.getElementById('actas-pendientes-lista');if(!c)return;
    c.innerHTML='<p style="color:#64748b">Cargando movimientos pendientes…</p>';
    try{
        const r=await postActas({accion:'listar_guias_pendientes',token:tokenSesionActual()});
        if(!r.ok)throw new Error(r.mensaje);
        const pendientes=r.pendientes||[];
        if(!pendientes.length){c.innerHTML='<div style="background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:12px;padding:14px;font-size:11px;font-weight:800">✓ No existen actas pendientes de guía.</div>';return;}
        c.innerHTML=`<div style="background:#fff7ed;border:1px solid #fdba74;color:#9a3412;border-radius:12px;padding:12px;margin-bottom:12px;font-size:10px;font-weight:700">${pendientes.length} acta(s) o movimiento(s) de emergencia requieren adjuntar su guía PDF.</div>`+pendientes.map(a=>`<div style="background:white;border:1px solid #fed7aa;border-left:4px solid #f97316;border-radius:10px;padding:11px 12px;margin-bottom:8px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:230px"><b style="font-size:12px;color:#0f172a">${escHtml(a.codigo)}</b><span style="display:inline-block;margin-left:7px;padding:3px 7px;border-radius:99px;background:#ffedd5;color:#c2410c;font-size:8px;font-weight:900">PENDIENTE DE SUBSANAR</span><div style="font-size:10px;color:#64748b;margin-top:4px">${escHtml(a.tipo)} · ${escHtml(a.receptor)} · ${escHtml(a.fecha)}</div><div style="font-size:9px;color:#94a3b8">${escHtml(a.provincia)} · ${escHtml(a.proyecto)} · Series: ${(a.armas||[]).map(escHtml).join(', ')}</div></div><label style="border:0;border-radius:7px;background:#fff7ed;color:#c2410c;padding:7px 9px;font-size:10px;font-weight:900;cursor:pointer">Seleccionar PDF<input id="guia-pendiente-${escAttr(a.codigo)}" type="file" accept="application/pdf,.pdf" style="display:none" onchange="actasV3MostrarNombreGuiaPendiente('${escAttr(a.codigo)}',this)"></label><button onclick="subsanarGuiaPendiente('${escAttr(a.codigo)}','${escAttr(a.tipoPendiente||'ACTA')}')" style="border:0;border-radius:7px;background:#f97316;color:white;padding:7px 9px;font-size:10px;font-weight:900;cursor:pointer">Subsanar</button></div><div id="guia-pendiente-nombre-${escAttr(a.codigo)}" style="font-size:9px;color:#64748b;margin-top:7px">Ningún PDF seleccionado.</div></div>`).join('');
    }catch(e){c.innerHTML=`<p style="color:#b91c1c;font-weight:700">${escHtml(e.message||String(e))}</p>`;}
}
function actasV3MostrarNombreGuiaPendiente(codigo,input){const e=document.getElementById(`guia-pendiente-nombre-${codigo}`),archivo=input?.files?.[0];if(e)e.textContent=archivo?`${archivo.name} · ${(archivo.size/1024/1024).toFixed(2)} MB`:'Ningún PDF seleccionado.';}
async function actasV3ArchivoPdfABase64(archivo){
    if(!archivo)throw new Error('Selecciona la guía PDF.');
    if(!archivo.name.toLowerCase().endsWith('.pdf')||(archivo.type&&archivo.type!=='application/pdf'))throw new Error('La guía debe estar en formato PDF.');
    if(archivo.size>10*1024*1024)throw new Error('La guía PDF no puede superar 10 MB.');
    const dataUrl=await new Promise((resolve,reject)=>{const lector=new FileReader();lector.onload=()=>resolve(String(lector.result||''));lector.onerror=()=>reject(new Error('No se pudo leer la guía PDF.'));lector.readAsDataURL(archivo);});
    return {nombre:archivo.name,mime:'application/pdf',base64:dataUrl.split(',')[1]||''};
}
async function subsanarGuiaPendiente(codigo,tipoPendiente='ACTA'){
    const input=document.getElementById(`guia-pendiente-${codigo}`),archivo=input?.files?.[0];
    try{
        const guia=await actasV3ArchivoPdfABase64(archivo);
        if(!confirm(`¿Adjuntar ${archivo.name} a ${codigo}? La misma guía quedará asociada a todas las armas de esta acta.`))return;
        progresoActa('Subiendo guía y actualizando el movimiento…',45);
        const payload=tipoPendiente==='MOVIMIENTO'?{accion:'subsanar_guia_movimiento',token:tokenSesionActual(),loteId:codigo,guia}:{accion:'subsanar_guia_acta',token:tokenSesionActual(),codigo,guia};
        const r=await postActas(payload,90000);
        if(!r.ok)throw new Error(r.mensaje||'No se pudo subsanar la guía.');
        progresoActa('Movimiento subsanado.',100);alert(r.mensaje||'Guía adjuntada correctamente.');await cargarGuiasPendientes();
    }catch(e){alert(e.message||String(e));}finally{setTimeout(cerrarProgresoActa,350);}
}
async function cargarHistorialIntegrado(){
    const c=document.getElementById('historial-actas-lista');
    c.innerHTML='<p style="color:#64748b">Cargando historial…</p>';
    try{
        const r=await postActas({accion:'listar_actas',token:tokenSesionActual()});
        if(!r.ok)throw new Error(r.mensaje);
        const g={GUARDIA:[],CUSTODIO:[]};
        (r.actas||[]).forEach(a=>(normalizarTexto(a.tipo).includes('custodio')?g.CUSTODIO:g.GUARDIA).push(a));
        c.innerHTML=['GUARDIA','CUSTODIO'].map(t=>{
            const tarjetas=g[t].map(a=>{
                const estadoNormal=normalizarTexto(a.estadoActa),invalidada=estadoNormal==='invalidada',finalizada=estadoNormal==='finalizada',parcial=estadoNormal==='vigente parcial';
                const colorEstado=invalidada?['#fee2e2','#b91c1c']:finalizada?['#e2e8f0','#475569']:parcial?['#fef3c7','#92400e']:['#dcfce7','#15803d'];
                const estado=`<span style="display:inline-block;margin-left:7px;padding:3px 7px;border-radius:99px;background:${colorEstado[0]};color:${colorEstado[1]};font-size:8px;font-weight:900">${escHtml(a.estadoActa||'VIGENTE')}</span>`;
                const guiaPendiente=a.estadoDocumental==='PENDIENTE_SUBSANAR';
                const estadoGuia=`<span style="display:inline-block;margin-left:5px;padding:3px 7px;border-radius:99px;background:${guiaPendiente?'#ffedd5':'#e0f2fe'};color:${guiaPendiente?'#c2410c':'#0369a1'};font-size:8px;font-weight:900">${guiaPendiente?'GUÍA PENDIENTE':a.urlGuia?'GUÍA COMPLETA':'SIN CONTROL DE GUÍA'}</span>`;
                const detalleInvalidacion=invalidada?`<div style="font-size:9px;color:#b91c1c;margin-top:4px">Reemplazada por ${escHtml(a.actaReemplazo||'otra acta')} · ${escHtml(a.motivoInvalidacion||'REASIGNACIÓN')}</div>`:'';
                const detalleFinalizacion=(finalizada||parcial)?`<div style="font-size:9px;color:#475569;margin-top:4px">${parcial?'Una parte del armamento fue retornada':'Finalizada por retorno al rastrillo'}${a.fechaFinalizacion?' · '+escHtml(a.fechaFinalizacion):''}</div>`:'';
                return `<div style="background:white;border:1px solid ${invalidada?'#fecaca':'#e2e8f0'};border-radius:10px;padding:10px 12px;margin-bottom:7px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b style="font-size:12px;color:#0f172a">${escHtml(a.codigo)}</b>${estado}${estadoGuia}<div style="font-size:10px;color:#64748b">${escHtml(a.receptor)} · ${a.armas.length} arma(s) · ${escHtml(a.fecha)}</div><div style="font-size:9px;color:#94a3b8">Series: ${a.armas.map(escHtml).join(', ')}</div>${detalleInvalidacion}${detalleFinalizacion}</div>${a.urlGuia?`<a href="${escAttr(a.urlGuia)}" target="_blank" rel="noopener" style="border:0;border-radius:7px;background:#ecfdf5;color:#047857;padding:6px 8px;font-size:10px;font-weight:900;text-decoration:none">Ver guía</a>`:''}<button onclick="descargarPdfDesdeHistorial('${escAttr(a.codigo)}')" style="border:0;border-radius:7px;background:#dbeafe;color:#075985;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer">📄 Generar PDF</button>${r.esAdmin?`<button onclick="eliminarUltimaActa('${escAttr(a.codigo)}')" style="border:0;border-radius:7px;background:#fee2e2;color:#b91c1c;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer">Eliminar</button>`:''}</div>`;
            }).join('');
            return `<h3 class="acta-section">${t==='GUARDIA'?'Actas de Guardia':'Actas de Custodio'}</h3>${tarjetas||'<p style="font-size:11px;color:#94a3b8">Sin actas registradas.</p>'}`;
        }).join('');
    }catch(e){c.innerHTML=`<p style="color:#b91c1c;font-weight:700">${escHtml(e.message||String(e))}</p>`;}
}

function actasV3PrepararCampos(){const mun=document.getElementById('acta-municiones');if(mun){const bloque=mun.parentElement;bloque.querySelector('label').textContent='Municiones por arma';if(!document.getElementById('acta-alimentadoras')){const nuevo=document.createElement('div');nuevo.innerHTML='<label class="acta-label">Alimentadoras por arma</label><input id="acta-alimentadoras" type="number" min="1" max="100" value="1" class="acta-input" oninput="actasV3ActualizarMuniciones(true)"><p id="acta-municiones-ayuda" class="acta-help"></p>';bloque.parentElement.insertBefore(nuevo,bloque);}}const cargo=document.getElementById('acta-cargo-select');if(cargo&&!cargo.querySelector('option[value=""]'))cargo.insertAdjacentHTML('afterbegin','<option value="">OPCIONAL / SIN CARGO</option>');}
function actasV3PrepararValidacionesCampos(){const cedula=document.getElementById('acta-receptor-cedula');if(cedula){cedula.inputMode='numeric';cedula.maxLength=10;if(!cedula.dataset.soloDigitos){cedula.addEventListener('input',()=>{cedula.value=cedula.value.replace(/\D/g,'').slice(0,10);});cedula.dataset.soloDigitos='1';}}const limites={'acta-receptor-nombre':120,'acta-ciudad':80,'acta-proyecto-otro':160,'acta-puesto-otro':160,'acta-cargo-otro':100,'acta-modelo':100,'acta-comentario':500,'acta-novedad':500,'acta-supervisor-nombre':120,'acta-supervisor-cedula':30,'acta-supervisor-cedula-reg':30};Object.entries(limites).forEach(([id,max])=>{const e=document.getElementById(id);if(e)e.maxLength=max;});}
function actasV3PrepararGuia(){if(document.getElementById('acta-guia-pdf'))return;const novedad=document.getElementById('acta-novedad'),card=novedad?.parentElement?.parentElement;if(!card)return;const bloque=document.createElement('div');bloque.style.gridColumn='1/-1';bloque.innerHTML=`<label class="acta-label">Guía de movilización (PDF · máximo 10 MB)</label><input id="acta-guia-pdf" type="file" accept="application/pdf,.pdf" class="acta-input"><p class="acta-help">Obligatoria para Operaciones. Administrador puede continuar por emergencia; el movimiento quedará pendiente de subsanar.</p>`;card.appendChild(bloque);}
function actasV3LimpiarGuia(){const guia=document.getElementById('acta-guia-pdf');if(guia)guia.value='';}
async function actasV3LeerGuiaPdf(){const archivo=document.getElementById('acta-guia-pdf')?.files?.[0];return archivo?actasV3ArchivoPdfABase64(archivo):null;}
function actasV3ValidarGuiaCliente(){const archivo=document.getElementById('acta-guia-pdf')?.files?.[0];if(!archivo&&rolActual()!=='admin')return 'La guía PDF es obligatoria para Operaciones.';if(archivo&&!archivo.name.toLowerCase().endsWith('.pdf'))return 'La guía debe tener extensión .pdf.';if(archivo&&archivo.size>10*1024*1024)return 'La guía PDF no puede superar 10 MB.';return '';}
function actasV3ActualizarMuniciones(ajustar=false){const alimentadoras=document.getElementById('acta-alimentadoras'),municiones=document.getElementById('acta-municiones');if(!alimentadoras||!municiones)return;const cantidad=Math.max(1,Math.min(100,Math.trunc(Number(alimentadoras.value)||1))),porAlimentadora=document.getElementById('acta-tipo')?.value==='custodio'?10:5,maximo=cantidad*porAlimentadora;alimentadoras.value=String(cantidad);municiones.max=String(maximo);if(ajustar||Number(municiones.value)>maximo||Number(municiones.value)<0)municiones.value=String(maximo);const ayuda=document.getElementById('acta-municiones-ayuda');if(ayuda)ayuda.textContent=`Máximo ${maximo} municiones por arma (${porAlimentadora} por alimentadora).`;}
function abrirGeneradorActa(serie){if(typeof usuarioPuedeGenerarActas==='function'&&!usuarioPuedeGenerarActas())return alert('Solo Operaciones y Administrador pueden generar actas de armamento.');if(!tokenSesionActual())return alert('Tu sesión venció. Ingresa nuevamente.');asegurarModalActas();actasV3PrepararPestanaPendientes();actasV3PrepararCampos();actasV3PrepararValidacionesCampos();actasV3PrepararGuia();mostrarPestanaActas('nueva');document.getElementById('acta-tipo').value='guardia';limpiarFormularioActa();actasV3LimpiarGuia();document.getElementById('acta-fecha').value=fechaISOHoy();actasV3ActualizarTipo();document.getElementById('actas-modal').style.display='flex';if(serie){const a=armasDisponiblesActa().find(x=>String(x.serie||'').trim()===String(serie).trim());if(a)actasV3ElegirArma(0,a);else mostrarErrorActa('Esta arma no puede utilizarse en un acta porque está En Tránsito, Perdida/Robada, Confiscada o no cumple las reglas del tipo seleccionado.');}}
function limpiarFormularioActa(){idSolicitudActaActual=nuevoIdSolicitudActa();armasActaSeleccionadas=[];agenteActaSeleccionado=null;indiceAgenteActa=-1;['acta-receptor-nombre','acta-receptor-cedula','acta-ciudad','acta-modelo','acta-cargo-otro','acta-proyecto-otro','acta-puesto-otro','acta-supervisor-nombre','acta-supervisor-cedula','acta-supervisor-cedula-reg'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});document.querySelector('input[name="acta-receptor-origen"][value="registrado"]').checked=true;document.querySelector('input[name="acta-supervisor-origen"][value="registrado"]').checked=true;document.querySelector('input[name="acta-cantidad-armas"][value="1"]').checked=true;const alimentadoras=document.getElementById('acta-alimentadoras');if(alimentadoras)alimentadoras.value='1';document.getElementById('acta-municiones').value='5';document.getElementById('acta-permiso').value='ORIGINAL';document.getElementById('acta-novedad').value='N/A';document.getElementById('acta-agente-resultados').innerHTML='';document.getElementById('acta-agente-resultados').style.display='none';actasV3ModoReceptor();actasV3CantidadArmas();actasV3ActualizarMuniciones(true);}
function actasV3ActualizarTipoLegacyInicial(){const t=document.getElementById('acta-tipo').value;document.getElementById('acta-comentario').value=t==='guardia'?'SE ENTREGA PERMISO ORIGINAL DEL ARMA':'EQUIPO ENTREGADO EN BUENAS CONDICIONES';document.getElementById('acta-seccion-entrega').style.display='block';actasV3BuscarAgentes(document.getElementById('acta-agente-busqueda').value||'');}
function actasV3LimpiarAgenteSeleccionado(){agenteActaSeleccionado=null;indiceAgenteActa=-1;['acta-receptor-nombre','acta-receptor-cedula'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});actasV3CargarUbicaciones();}
function actasV3ModoReceptor(){const manual=document.querySelector('input[name="acta-receptor-origen"]:checked').value==='manual';actasV3LimpiarAgenteSeleccionado();document.getElementById('acta-receptor-registrado').style.display=manual?'none':'block';['acta-receptor-nombre','acta-receptor-cedula'].forEach(id=>{const e=document.getElementById(id);e.readOnly=!manual;});document.getElementById('acta-receptor-manual').style.display='none';if(!manual)actasV3BuscarAgentes('');}
function actasV3BuscarAgentesLegacyInicial(q){const out=document.getElementById('acta-agente-resultados');q=normalizarTexto(q);if(q.length<2){out.style.display='none';document.getElementById('acta-agentes-ayuda').textContent='Escribe al menos 2 caracteres para buscar.';return;}const tipo=document.getElementById('acta-tipo').value;agentesActaFiltrados=personalBaseActas().filter(p=>(tipo==='custodio'?esPerfilCustodio(p):!esPerfilCustodio(p))&&[p.nombre,p.cedula].some(v=>normalizarTexto(v).includes(q))).slice(0,12);out.innerHTML=agentesActaFiltrados.map((p,i)=>`<div class="acta-resultado" onclick="actasV3ElegirAgente(${i})"><strong>${escHtml(p.nombre)}</strong>${p.cedula?` · CI ${escHtml(p.cedula)}`:''}<br><span style="color:#64748b">${escHtml(p.provincia||'')} · ${escHtml(p.proyecto||'')} · ${escHtml(p.puesto||'')}</span></div>`).join('')||'<div class="acta-resultado">No hay coincidencias.</div>';out.style.display='block';document.getElementById('acta-agentes-ayuda').textContent=`${agentesActaFiltrados.length} coincidencia(s), mostrando nombre, cédula y ubicación.`;}
function actasV3ElegirAgente(i){const p=agentesActaFiltrados[i];if(!p)return;agenteActaSeleccionado=p;indiceAgenteActa=i;document.getElementById('acta-receptor-nombre').value=p.nombre||'';document.getElementById('acta-receptor-cedula').value=p.cedula||'';actasV3CargarUbicaciones(p.provincia,p.proyecto,p.puesto);document.getElementById('acta-agente-resultados').style.display='none';document.getElementById('acta-agente-busqueda').value=p.nombre||'';cargarSupervisoresActa();}
function actasV3CargarUbicaciones(prov='',proy='',puesto=''){const ps=actasV3Provincias();const e=document.getElementById('acta-provincia-destino');e.innerHTML=actasV3Opciones(ps,'Selecciona provincia');e.value=prov||'';actasV3CambiarProvincia(proy,puesto);}
function actasV3CambiarProvincia(proy='',puesto=''){const p=document.getElementById('acta-provincia-destino').value;const e=document.getElementById('acta-proyecto-destino');e.innerHTML=actasV3Opciones([...actasV3Proyectos(p),'OTRO'],'Selecciona proyecto');e.value=proy||'';document.getElementById('acta-proyecto-otro').style.display=e.value==='OTRO'?'block':'none';actasV3CambiarProyecto(puesto);cargarSupervisoresActa();}
function actasV3CambiarProyecto(puesto=''){const p=document.getElementById('acta-provincia-destino').value,proy=document.getElementById('acta-proyecto-destino').value;const e=document.getElementById('acta-puesto-destino');e.innerHTML=actasV3Opciones([...actasV3Puestos(p,proy),'OTRO'],'Selecciona puesto');e.value=puesto||'';document.getElementById('acta-puesto-otro').style.display=e.value==='OTRO'?'block':'none';document.getElementById('acta-proyecto-otro').style.display=proy==='OTRO'?'block':'none';cargarSupervisoresActa();}
function actasV3PuestoOtro(){document.getElementById('acta-puesto-otro').style.display=document.getElementById('acta-puesto-destino').value==='OTRO'?'block':'none';}
function actasV3CargoOtro(){document.getElementById('acta-cargo-otro').style.display=document.getElementById('acta-cargo-select').value==='OTRO'?'block':'none';}
function actasV3CantidadArmas(){const varias=document.querySelector('input[name="acta-cantidad-armas"]:checked').value==='varias';document.getElementById('acta-cantidad-wrap').style.display=varias?'inline':'none';const n=varias?Math.max(2,Math.min(20,Number(document.getElementById('acta-cantidad').value)||2)):1;armasActaSeleccionadas=armasActaSeleccionadas.slice(0,n);while(armasActaSeleccionadas.length<n)armasActaSeleccionadas.push(null);const c=document.getElementById('acta-armas-contenedor');c.innerHTML=armasActaSeleccionadas.map((a,i)=>`<div class="acta-arma-item"><label class="acta-label">Arma ${i+1} · Serie</label><input id="acta-arma-${i}" class="acta-input" value="${escAttr(a?.serie||'')}" placeholder="Escribe serie, código o marca…" oninput="actasV3BuscarArma(${i},this.value)"><div id="acta-arma-resultados-${i}" class="acta-resultados"></div><div id="acta-arma-resumen-${i}" class="acta-arma-seleccionada">${a?actasV3ResumenArma(a):'Selecciona un arma.'}</div></div>`).join('');}
function actasV3BuscarArma(i,q){const out=document.getElementById(`acta-arma-resultados-${i}`),n=normalizarTexto(q),seleccionada=armasActaSeleccionadas[i];if(seleccionada&&n!==normalizarTexto(seleccionada.serie||seleccionada.codigoArma)){armasActaSeleccionadas[i]=null;const resumen=document.getElementById(`acta-arma-resumen-${i}`);if(resumen)resumen.textContent='Selección anulada. Elige nuevamente el arma.';}if(n.length<2){out.style.display='none';return;}const usados=new Set(armasActaSeleccionadas.filter(Boolean).map(a=>a.serie));const rs=armasDisponiblesActa().filter(a=>!usados.has(a.serie)||armasActaSeleccionadas[i]===a).filter(a=>[a.serie,a.codigoArma,a.marca,a.tipo].some(v=>normalizarTexto(v).includes(n))).slice(0,10);out.innerHTML=rs.map(a=>`<div class="acta-resultado" onclick="actasV3ElegirArmaPorSerie(${i},'${encodeURIComponent(a.serie||a.codigoArma||'')}')"><strong>Serie: ${escHtml(a.serie||a.codigoArma)}</strong> · ${escHtml(a.tipo||'')} ${escHtml(a.marca||'')}<br><span style="color:#64748b">${escHtml(a.estado||'')} · ${escHtml(a.provincia||'')} ${escHtml(a.proyecto||'')}</span></div>`).join('')||'<div class="acta-resultado">No hay coincidencias.</div>';out.style.display='block';}
function actasV3ElegirArmaPorSerie(i,serieCodificada){const serie=decodeURIComponent(serieCodificada);actasV3ElegirArma(i,armasDisponiblesActa().find(a=>(a.serie||a.codigoArma)===serie));}
function actasV3ResumenArma(a){return `<span>${escHtml(a.estado||'SIN ESTADO')}</span><br><b>${escHtml(a.clase||'—')}</b> · ${escHtml(a.tipo||'—')} ${escHtml(a.marca||'')} · Cal. ${escHtml(a.calibre||'—')} · Serie <b>${escHtml(a.serie||'—')}</b>`;}
function actasV3ElegirArma(i,a){if(!a)return;armasActaSeleccionadas[i]=a;const e=document.getElementById(`acta-arma-${i}`);if(e)e.value=a.serie||a.codigoArma||'';document.getElementById(`acta-arma-resultados-${i}`).style.display='none';document.getElementById(`acta-arma-resumen-${i}`).innerHTML=actasV3ResumenArma(a);if(!document.getElementById('acta-ciudad').value)document.getElementById('acta-ciudad').value=ciudadSugerida(a.provincia);}
function actasV3Valor(id,otro){const v=document.getElementById(id).value;return v==='OTRO'?document.getElementById(otro).value.trim():v.trim();}
function supervisoresDestino(){const prov=(document.getElementById('acta-provincia-destino').value||'').toUpperCase(),proy=actasV3Valor('acta-proyecto-destino','acta-proyecto-otro');return supervisoresConfiguradosProyecto(prov,proy);}
function leerFormularioActa(){const tipo=document.getElementById('acta-tipo').value,origen=document.querySelector('input[name="acta-receptor-origen"]:checked').value,supOrigen=document.querySelector('input[name="acta-supervisor-origen"]:checked').value,armas=armasActaSeleccionadas.filter(Boolean).map(a=>({codigoArma:a.codigoArma||'',serie:a.serie||'',clase:a.clase||'',categoria:a.categoria||'',tipoArma:a.tipo||'',marca:a.marca||'',calibre:a.calibre||'',urlCredencial:a.urlCredencial||'',urlArma:a.urlImagenArma||'',estadoArma:a.estado||''})),esGuardia=tipo==='guardia';return {tipoActa:esGuardia?'GUARDIA':'CUSTODIO VIP',fecha:document.getElementById('acta-fecha').value,ciudad:document.getElementById('acta-ciudad').value.trim(),armas,proyecto:actasV3Valor('acta-proyecto-destino','acta-proyecto-otro'),provincia:document.getElementById('acta-provincia-destino').value.trim(),puesto:actasV3Valor('acta-puesto-destino','acta-puesto-otro'),receptorNombre:document.getElementById('acta-receptor-nombre').value.trim(),receptorCedula:document.getElementById('acta-receptor-cedula').value.trim(),receptorOrigen:origen,cargo:actasV3Valor('acta-cargo-select','acta-cargo-otro'),alimentadoras:Number(document.getElementById('acta-alimentadoras')?.value)||1,municiones:Number(document.getElementById('acta-municiones').value),aptitud:'APTA',permiso:document.getElementById('acta-permiso').value,modelo:document.getElementById('acta-modelo').value.trim(),comentario:document.getElementById('acta-comentario').value.trim(),novedad:document.getElementById('acta-novedad').value.trim(),supervisorNombre:esGuardia?(supOrigen==='registrado'?document.getElementById('acta-supervisor-select').value.trim():document.getElementById('acta-supervisor-nombre').value.trim()):'',supervisorCedula:esGuardia?(supOrigen==='registrado'?document.getElementById('acta-supervisor-cedula-reg').value.trim():document.getElementById('acta-supervisor-cedula').value.trim()):''};}
function validarDatosActa(d){if(!d.armas.length)return 'Selecciona todas las armas antes de generar el acta.';if(d.armas.length!==armasActaSeleccionadas.length)return 'Falta seleccionar una o más armas.';const armaAlterada=armasActaSeleccionadas.some((a,i)=>normalizarTexto(document.getElementById(`acta-arma-${i}`)?.value)!==normalizarTexto(a?.serie||a?.codigoArma));if(armaAlterada)return 'La serie escrita no coincide con el arma seleccionada. Elige nuevamente el arma del listado.';if(d.receptorOrigen==='registrado'&&!agenteActaSeleccionado)return 'Busca y haz clic sobre la persona registrada que recibirá el arma.';if(d.receptorOrigen==='registrado'&&(normalizarTexto(d.receptorNombre)!==normalizarTexto(agenteActaSeleccionado?.nombre)||normalizarTexto(d.receptorCedula)!==normalizarTexto(agenteActaSeleccionado?.cedula)))return 'Los datos de la persona cambiaron. Selecciónala nuevamente desde el listado.';if(!d.receptorNombre)return 'El nombre de quien recibe es obligatorio.';if(!/^\d{10}$/.test(d.receptorCedula))return 'La cédula debe contener exactamente 10 números, sin espacios ni texto.';if(!d.provincia||!d.proyecto)return 'La provincia y el proyecto son obligatorios para ambas actas.';if(!d.fecha||!d.ciudad)return 'Indica la fecha y ciudad del acta.';if(!Number.isInteger(d.alimentadoras)||d.alimentadoras<1||d.alimentadoras>100)return 'Las alimentadoras deben ser un número entero entre 1 y 100.';const maximo=d.alimentadoras*(d.tipoActa==='CUSTODIO VIP'?10:5);if(!Number.isInteger(d.municiones)||d.municiones<0||d.municiones>maximo)return `Las municiones deben estar entre 0 y ${maximo} para ${d.alimentadoras} alimentadora(s).`;if(d.tipoActa==='GUARDIA'&&!d.supervisorNombre)return 'En las actas de Guardia es obligatorio indicar quién entrega.';return '';}
async function generarActaArmamentoLegacyV3Inicial(){if(actaGenerando)return;const d=leerFormularioActa(),err=validarDatosActa(d);if(err)return mostrarErrorActa(err);mostrarErrorActa('');const b=document.getElementById('acta-btn-generar');actaGenerando=true;b.disabled=true;b.textContent='Registrando…';try{const reg=await registrarActaServidor(d);if(!reg.ok)throw new Error(reg.mensaje||'No se pudo registrar el acta');d.codigoActa=reg.codigo;const ev=await Promise.all(d.armas.map(async a=>({cred:await imagenActaBase64(a.urlCredencial),arma:await imagenActaBase64(a.urlArma)})));if(d.tipoActa==='CUSTODIO VIP')generarPDFCustodio(d,ev);else generarPDFGuardia(d,ev);if(typeof cerrarModalArmamento==='function')cerrarModalArmamento();document.getElementById('actas-modal').style.display='none';}catch(e){mostrarErrorActa(e.message||String(e));}finally{actaGenerando=false;b.disabled=false;b.textContent='📄 Registrar y generar PDF';}}
// PDF V3: un documento y un código para una o varias armas.
function generarPDFGuardia(d,evidencias){
 const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),armas=d.armas||[],W=297,H=210;
 const opcionesMembrete={mayusculas:true},subtitulo=`ACTA DE RECEPCIÓN DE DOTACIONES · ${d.codigoActa}`,topeContenido=H-MARGEN_PDF-4,inicioContenido=MARGEN_PDF+8;
 const nuevaPagina=()=>{doc.addPage();dibujarMembretePDF(doc,subtitulo,formatearFechaActa(d.fecha),opcionesMembrete);return inicioContenido;};
 dibujarMembretePDF(doc,subtitulo,formatearFechaActa(d.fecha),opcionesMembrete);let y=inicioContenido;doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(15,23,42);doc.text('ACTA DE RECEPCIÓN DE DOTACIONES',W/2,y,{align:'center'});y+=8;
 const fechaActa=textoPDFMayusculas(fechaLargaEspanol(d.fecha));
 const encabezado=armas.length>1?['FECHA',fechaActa,'CANTIDAD',armas.length]:['FECHA',fechaActa,'CATEGORÍA',`ARMAMENTO - ${textoClaseActa(armas[0]?.clase)}`];doc.autoTable({startY:y,margin:{left:14,right:14},theme:'grid',styles:{fontSize:7.8,cellPadding:2.7},columnStyles:{0:{fontStyle:'bold',fillColor:[203,213,225],cellWidth:22},2:{fontStyle:'bold',fillColor:[203,213,225],cellWidth:26}},body:[encabezado,['NOMBRE',textoPDFMayusculas(d.receptorNombre),'CÉDULA',d.receptorCedula],['CARGO',textoPDFMayusculas(d.cargo),'ÁREA / PROYECTO',textoPDFMayusculas(d.proyecto)]]});y=doc.lastAutoTable.finalY+6;
 doc.autoTable({startY:y,margin:{left:8,right:8,top:inicioContenido,bottom:MARGEN_PDF+4},head:[['N°','CLASE','CATEGORÍA','TIPO','MARCA','MODELO','CALIBRE','SERIE','ALIMENT.','MUNICIONES','PERMISO','COMENTARIO','NOVEDAD']],body:armas.map((a,i)=>[i+1,textoPDFMayusculas(a.clase),textoPDFMayusculas(a.categoria),textoPDFMayusculas(a.tipoArma),textoPDFMayusculas(a.marca),textoPDFMayusculas(d.modelo),textoPDFMayusculas(a.calibre),textoPDFMayusculas(a.serie),d.alimentadoras||1,d.municiones,textoPDFMayusculas(d.permiso),textoPDFMayusculas(d.comentario),textoPDFMayusculas(d.novedad)]),headStyles:{fillColor:[71,85,105],textColor:[255,255,255],fontSize:5.9,halign:'center'},styles:{fontSize:5.8,cellPadding:1.5,halign:'center',valign:'middle'},didDrawPage:()=>dibujarMembretePDF(doc,subtitulo,formatearFechaActa(d.fecha),opcionesMembrete)});y=doc.lastAutoTable.finalY+7;
 const altoEvidencia=32,pasoEvidencia=35;
 armas.forEach((a,i)=>{if(y+altoEvidencia>topeContenido)y=nuevaPagina();const e=evidencias[i]||{},bw=82,g=12,x1=(W-(bw*2+g))/2,x2=x1+bw+g;doc.setDrawColor(203,213,225);doc.rect(x1,y,bw,altoEvidencia);doc.rect(x2,y,bw,altoEvidencia);doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.text(`CREDENCIAL · ARMA ${i+1}`,x1+bw/2,y+4,{align:'center'});doc.text(`ARMA · SERIE ${textoPDFMayusculas(a.serie)}`,x2+bw/2,y+4,{align:'center'});if(!addImagenAjustada(doc,e.cred,x1+3,y+6,bw-6,23))doc.text('SIN IMAGEN DISPONIBLE',x1+bw/2,y+19,{align:'center'});if(!addImagenAjustada(doc,e.arma,x2+3,y+6,bw-6,23))doc.text('SIN IMAGEN DISPONIBLE',x2+bw/2,y+19,{align:'center'});y+=pasoEvidencia;});
 const altoFirma=29,separacionFirma=4;if(y+separacionFirma+altoFirma>topeContenido)y=nuevaPagina();const sy=y+separacionFirma,sw=96,sg=12,sx=(W-(sw*2+sg))/2;dibujarFirmaGuardia(doc,sx,sy,sw,'ENTREGA','SUPERVISOR',d.supervisorNombre||'—',d.supervisorCedula||'—');dibujarFirmaGuardia(doc,sx+sw+sg,sy,sw,'RECIBE',d.cargo,d.receptorNombre,d.receptorCedula);return doc;
}
function generarPDFCustodioMultiple(d,evidencias){
 const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),armas=d.armas||[],f=fechaPalabrasActa(d.fecha),x=18,w=174;dibujarPlantillaCustodio(doc,d.codigoActa,formatearFechaActa(d.fecha));doc.setTextColor(15,15,15);doc.setFont('helvetica','bold');doc.setFontSize(11.2);doc.text('DEFEN CIA LTDA',105,34,{align:'center'});doc.text('GUAYAQUIL – ECUADOR',105,40,{align:'center'});doc.setFontSize(11.5);doc.text('ACTA DE ENTREGA, RECEPCIÓN',105,51,{align:'center'});doc.text('Y USO DE ARMAMENTO',105,57,{align:'center'});doc.setFontSize(10.5);doc.text(`NO.: ${d.codigoActa}`,18,70);let y=83;
 const cargoLegal=d.cargo||'CUSTODIO VIP';y=addTextJustificado(doc,`En la ciudad de ${d.ciudad}, a los ${f.dia} días del mes de ${f.mes} del año ${f.anio}, se suscribe la presente ACTA DE ENTREGA, RECEPCIÓN Y USO DE ARMAMENTO. Se entrega(n) ${armas.length} arma(s) perteneciente(s) a DEFEN CIA. LTDA., con serie(s): ${armas.map(a=>a.serie).join(', ')}.`,x,y,w,10.9,5.25)+7;y=addTextJustificado(doc,`El Sr. ${d.receptorNombre}, con CI. ${d.receptorCedula}, en calidad de ${cargoLegal}, declara haber recibido el equipo en buenas condiciones de funcionamiento y se compromete a su correcta utilización, custodia y conservación.`,x,y,w,10.9,5.25)+8;doc.setFont('helvetica','bold');doc.text(String(cargoLegal).toUpperCase(),18,y);y+=32;doc.setLineWidth(.3);doc.line(18,y,92,y);doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(`Nombre: ${d.receptorNombre}`,18,y+6);doc.text(`CI.: ${d.receptorCedula}`,18,y+12);
 doc.addPage();dibujarPlantillaCustodio(doc,d.codigoActa,formatearFechaActa(d.fecha));y=42;doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text('Armamento de dotación:',18,y);y+=5;doc.autoTable({startY:y,margin:{left:18,right:18},head:[['N°','CLASE','CATEGORÍA','TIPO','MARCA','CALIBRE','SERIE','ALIMENT.','MUNICIONES','PERMISO']],body:armas.map((a,i)=>[i+1,a.clase,a.categoria,a.tipoArma,a.marca,a.calibre,a.serie,d.alimentadoras||1,d.municiones,d.permiso]),headStyles:{fillColor:[145,145,145],textColor:[255,255,255],fontSize:6,halign:'center'},styles:{fontSize:6.1,cellPadding:1.6,halign:'center',valign:'middle'}});y=doc.lastAutoTable.finalY+8;
 armas.forEach((a,i)=>{if(y+52>250){doc.addPage();dibujarPlantillaCustodio(doc,d.codigoActa,formatearFechaActa(d.fecha));y=42;}const e=evidencias[i]||{},bw=78,g=18,x1=(210-(bw*2+g))/2,x2=x1+bw+g;doc.setFontSize(7);doc.text(`CREDENCIAL · ARMA ${i+1}`,x1+bw/2,y,{align:'center'});doc.text(`ARMA · ${a.serie}`,x2+bw/2,y,{align:'center'});doc.setDrawColor(226,232,240);doc.rect(x1,y+2,bw,45);doc.rect(x2,y+2,bw,45);if(!addImagenAjustada(doc,e.cred,x1+2,y+4,bw-4,41))doc.text('Sin imagen disponible',x1+bw/2,y+25,{align:'center'});if(!addImagenAjustada(doc,e.arma,x2+2,y+4,bw-4,41))doc.text('Sin imagen disponible',x2+bw/2,y+25,{align:'center'});y+=53;});return doc;
}
// Ajustes de presentación y reglas específicas de Custodio.
function actasV3ActualizarTipo(){const t=document.getElementById('acta-tipo').value;actasV3LimpiarAgenteSeleccionado();armasActaSeleccionadas=[];document.getElementById('acta-comentario').value=t==='guardia'?'SE ENTREGA PERMISO ORIGINAL DEL ARMA':'EQUIPO ENTREGADO EN BUENAS CONDICIONES';document.getElementById('acta-seccion-entrega').style.display=t==='guardia'?'block':'none';const cargo=document.getElementById('acta-cargo-select');if(cargo)cargo.value=t==='guardia'?'GUARDIA DE SEGURIDAD':'';actasV3BuscarAgentes(document.getElementById('acta-agente-busqueda').value||'');actasV3CantidadArmas();actasV3ActualizarMuniciones(true);}
function actasV3BuscarAgentes(q){const out=document.getElementById('acta-agente-resultados'),textoOriginal=String(q||''),consulta=normalizarTexto(textoOriginal);if(agenteActaSeleccionado&&consulta!==normalizarTexto(agenteActaSeleccionado.nombre)&&consulta!==normalizarTexto(agenteActaSeleccionado.cedula))actasV3LimpiarAgenteSeleccionado();const tipo=document.getElementById('acta-tipo').value,candidatos=personalSegunTipoActa();const resultados=consulta.length>=2?candidatos.filter(p=>[p.nombre,p.cedula].some(v=>normalizarTexto(v).includes(consulta))).slice(0,12):[];agentesActaFiltrados=resultados;out.innerHTML=resultados.map((p,i)=>`<div class="acta-resultado" onclick="actasV3ElegirAgente(${i})"><strong>${escHtml(p.nombre)}</strong>${p.cedula?` · CI ${escHtml(p.cedula)}`:''}<br><span style="color:#64748b">${escHtml(p.provincia||'')} · ${escHtml(p.proyecto||'')} · ${escHtml(p.puesto||'')}</span></div>`).join('')||'<div class="acta-resultado">No hay coincidencias.</div>';out.style.display=consulta.length>=2?'block':'none';document.getElementById('acta-agentes-ayuda').textContent=consulta.length<2?'Escribe al menos 2 caracteres para buscar.':`${resultados.length} coincidencia(s) en ${tipo==='custodio'?'todo el personal activo':'el personal de Guardia'}, mostrando nombre, cédula y ubicación.`;}
function armasDisponiblesActa(){const orden={rastrillo:0,activo:1,'en campo':1},esCustodio=document.getElementById('acta-tipo')?.value==='custodio';return [...armamentoDetalle].filter(a=>{const estado=normalizarTexto(a?.estado);return a&&(a.serie||a.codigoArma)&&['rastrillo','activo','en campo'].includes(estado)&&!a.bloqueadaAsignacion&&!a.idMantenimientoActual&&(!esCustodio||normalizarTexto(a.categoria).includes('movil'));}).sort((a,b)=>(orden[normalizarTexto(a.estado)]??9)-(orden[normalizarTexto(b.estado)]??9)||String(a.serie||'').localeCompare(String(b.serie||'')));}
function generarPDFCustodio(d,evidencias){const armas=d.armas||[];if(armas.length===1){const a=armas[0],ev=evidencias[0]||{};return generarPDFCustodioOriginal({...d,...a},ev.cred,ev.arma);}return generarPDFCustodioMultiple(d,evidencias);}

function asegurarProgresoActa(){if(document.getElementById('acta-progreso'))return;const e=document.createElement('div');e.id='acta-progreso';e.style.cssText='display:none;position:fixed;inset:0;z-index:22000;background:rgba(15,23,42,.88);align-items:center;justify-content:center;padding:20px';e.innerHTML='<div style="width:100%;max-width:390px;background:white;border-radius:16px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.4)"><p style="margin:0 0 5px;font-weight:900;color:#0f172a">Generando acta</p><p id="acta-progreso-texto" style="margin:0;color:#64748b;font-size:12px">Preparando…</p><div style="height:8px;background:#e2e8f0;border-radius:99px;margin-top:16px;overflow:hidden"><div id="acta-progreso-barra" style="height:100%;width:8%;background:linear-gradient(90deg,#f97316,#fb923c);transition:width .35s ease"></div></div><p style="margin:10px 0 0;font-size:10px;color:#94a3b8">El registro quedará disponible para regenerar el acta desde el historial.</p></div>';document.body.appendChild(e);}
function progresoActa(texto,porcentaje){asegurarProgresoActa();document.getElementById('acta-progreso').style.display='flex';document.getElementById('acta-progreso-texto').textContent=texto;document.getElementById('acta-progreso-barra').style.width=`${porcentaje}%`;}
function cerrarProgresoActa(){const e=document.getElementById('acta-progreso');if(e)e.style.display='none';}
async function postActas(payload,timeoutMs=45000){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
    try{
        const r=await fetch(APPS_SCRIPT_URL,{method:'POST',body:JSON.stringify(payload),redirect:'follow',signal:controller.signal});
        if(!r.ok){
            if(r.status===404)throw new Error('La URL publicada de Apps Script no tiene esta función. Publica una nueva versión de Code.gs y verifica que config.js conserve la URL /exec correcta.');
            throw new Error(`El servidor respondió HTTP ${r.status}.`);
        }
        const contenido=await r.text();
        try{
            const json=JSON.parse(contenido);
            if(!json||typeof json!=='object')throw new Error();
            return json;
        }catch(_){
            throw new Error('Apps Script no devolvió una respuesta JSON válida. Actualiza e implementa una nueva versión del proyecto en Apps Script y confirma que config.js use la URL /exec vigente.');
        }
    }catch(e){
        if(e.name==='AbortError')throw new Error('La operación tardó demasiado. Intenta nuevamente.');
        throw e;
    }finally{clearTimeout(timeout);}
}
async function generarActaArmamento(){
    if(actaGenerando)return;
    const d=leerFormularioActa(),err=validarDatosActa(d);
    if(err)return mostrarErrorActa(err);
    const errorGuia=actasV3ValidarGuiaCliente();
    if(errorGuia)return mostrarErrorActa(errorGuia);
    const tieneGuia=Boolean(document.getElementById('acta-guia-pdf')?.files?.[0]);
    if(!tieneGuia&&rolActual()==='admin'&&!confirm('Esta acta se generará SIN GUÍA por autorización de Administrador.\n\nEl movimiento quedará PENDIENTE DE SUBSANAR hasta que se adjunte el PDF.\n\n¿Deseas continuar?'))return;
    const hoy=fechaISOHoy();
    if(d.fecha!==hoy){
        const relacion=d.fecha<hoy?'anterior':'futura';
        if(!confirm(`La fecha seleccionada (${formatearFechaActa(d.fecha)}) es ${relacion} a la fecha actual (${formatearFechaActa(hoy)}).\n\n¿Confirmas que deseas generar el acta con esta novedad?`))return;
    }
    mostrarErrorActa('');
    const b=document.getElementById('acta-btn-generar');actaGenerando=true;b.disabled=true;
    try{
        progresoActa(tieneGuia?'Preparando y cargando la guía PDF…':'Registrando emergencia sin guía…',15);
        const guia=await actasV3LeerGuiaPdf();
        progresoActa('Registrando datos del acta…',20);
        let reg=await registrarActaServidor(d,false,guia);
        if(reg.requiereConfirmacion){
            const codigos=(reg.codigosAnteriores||[]).join(', ');
            const aceptar=confirm(`Una o más armas ya tienen un acta vigente: ${codigos}.\n\nSi continúas, esas actas quedarán INVALIDADAS en el historial y se registrará una nueva acta VIGENTE.\n\n¿Deseas continuar?`);
            if(!aceptar){mostrarErrorActa('Operación cancelada. No se modificó ninguna acta.');return;}
            progresoActa('Invalidando actas anteriores y registrando la nueva…',30);
            reg=await registrarActaServidor(d,true,guia);
        }
        if(!reg.ok)throw new Error(reg.mensaje||'No se pudo registrar el acta');
        d.codigoActa=reg.codigo;
        if(reg.pendienteSubsanar)alert('El acta fue registrada sin guía. Aparecerá en Pendientes de subsanar hasta que un Administrador u Operaciones adjunte el PDF.');
        progresoActa(reg.reutilizada?'La solicitud ya estaba registrada. Recuperando el acta…':'Registro guardado. Generando PDF…',45);
        await descargarPdfActa(d);
        progresoActa('Finalizando…',100);
        if(typeof cerrarModalArmamento==='function')cerrarModalArmamento();
        document.getElementById('actas-modal').style.display='none';
        if(typeof cargarDatos==='function')cargarDatos();
    }catch(e){mostrarErrorActa(e.message||String(e));}
    finally{setTimeout(cerrarProgresoActa,350);actaGenerando=false;b.disabled=false;b.textContent='📄 Registrar y generar PDF';}
}
function marcarPdfActaInvalidada(doc,d){if(normalizarTexto(d.estadoActa)!=='invalidada')return;const paginas=doc.getNumberOfPages();for(let i=1;i<=paginas;i++){doc.setPage(i);const ancho=doc.internal.pageSize.getWidth();doc.setTextColor(185,28,28);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(`DOCUMENTO INVALIDADO · REEMPLAZADO POR ${d.actaReemplazo||'OTRA ACTA'}`,ancho/2,12,{align:'center'});}}
async function descargarPdfActa(d){progresoActa('Recuperando evidencias fotográficas…',60);const ev=await Promise.all((d.armas||[]).map(async a=>({cred:await imagenActaBase64(a.urlCredencial),arma:await imagenActaBase64(a.urlArma)})));progresoActa('Construyendo PDF…',80);const doc=d.tipoActa==='CUSTODIO VIP'?generarPDFCustodio(d,ev):generarPDFGuardia(d,ev);marcarPdfActaInvalidada(doc,d);doc.save(`${d.codigoActa}_${d.tipoActa==='CUSTODIO VIP'?'CUSTODIO':'GUARDIA'}.pdf`);}

function asegurarHistorialActas(){if(document.getElementById('historial-actas-modal'))return;const e=document.createElement('div');e.id='historial-actas-modal';e.style.cssText='display:none;position:fixed;inset:0;z-index:21500;background:rgba(15,23,42,.82);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:16px';e.innerHTML='<div style="width:100%;max-width:930px;max-height:88vh;background:#f8fafc;border-radius:18px;display:flex;flex-direction:column;overflow:hidden"><div style="padding:14px 18px;background:#0f172a;color:white;display:flex;justify-content:space-between"><div><b>Historial de Actas</b><div style="font-size:10px;color:#94a3b8;margin-top:3px">Guardia y Custodio · Actas regeneradas desde sus registros</div></div><button onclick="cerrarHistorialActas()" class="acta-close">✕ Cerrar</button></div><div id="historial-actas-lista" style="padding:14px;overflow:auto;flex:1"></div></div>';document.body.appendChild(e);}
function cerrarHistorialActas(){document.getElementById('historial-actas-modal').style.display='none';}
async function abrirHistorialActas(){
    asegurarHistorialActas();document.getElementById('historial-actas-modal').style.display='flex';const c=document.getElementById('historial-actas-lista');c.innerHTML='<p style="color:#64748b">Cargando historial…</p>';
    try{
        const r=await postActas({accion:'listar_actas',token:tokenSesionActual()});if(!r.ok)throw new Error(r.mensaje);const grupos={GUARDIA:[],CUSTODIO:[]};(r.actas||[]).forEach(a=>(normalizarTexto(a.tipo).includes('custodio')?grupos.CUSTODIO:grupos.GUARDIA).push(a));
        const panelAdmin=r.esAdmin&&r.actas?.length?`<div style="background:#fff1f2;border:1px solid #fecdd3;border-left:5px solid #be123c;border-radius:12px;padding:12px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:260px"><b style="font-size:11px;color:#881337">REINICIO PRODUCTIVO DE ACTAS</b><div style="font-size:9px;color:#9f1239;margin-top:3px">Elimina todas las actas de armamento, reinicia ambas numeraciones y deja las armas activas pendientes de regularización. El inventario, proyectos, puestos y guías se conservan.</div></div><button onclick="reiniciarTodasActasAdmin()" style="border:0;border-radius:8px;background:#be123c;color:white;padding:8px 11px;font-size:9px;font-weight:900;cursor:pointer">🗑 REINICIAR TODAS</button></div>`:'';
        c.innerHTML=panelAdmin+['GUARDIA','CUSTODIO'].map(tipo=>`<h3 class="acta-section">${tipo==='GUARDIA'?'Actas de Guardia':'Actas de Custodio'}</h3>${grupos[tipo].length?grupos[tipo].map(a=>`<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:7px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b style="font-size:12px;color:#0f172a">${escHtml(a.codigo)}</b><div style="font-size:10px;color:#64748b">${escHtml(a.receptor)} · ${a.armas.length} arma(s) · ${escHtml(a.fecha)}</div><div style="font-size:9px;color:#94a3b8">Series: ${a.armas.map(escHtml).join(', ')}</div></div><button onclick="descargarPdfDesdeHistorial('${escAttr(a.codigo)}')" style="border:0;border-radius:7px;background:#dbeafe;color:#075985;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer">📄 Generar PDF</button>${r.esAdmin?`<button onclick="eliminarUltimaActa('${escAttr(a.codigo)}')" style="border:0;border-radius:7px;background:#fee2e2;color:#b91c1c;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer">Eliminar</button>`:''}</div>`).join(''):'<p style="font-size:11px;color:#94a3b8">Sin actas registradas.</p>'}`).join('');
    }catch(e){c.innerHTML=`<p style="color:#b91c1c;font-weight:700">${escHtml(e.message||String(e))}</p>`;}
}
async function descargarPdfDesdeHistorial(codigo){try{progresoActa('Recuperando datos del acta…',20);const r=await postActas({accion:'obtener_acta',token:tokenSesionActual(),codigo});if(!r.ok)throw new Error(r.mensaje);await descargarPdfActa(r.acta);progresoActa('PDF descargado.',100);}catch(e){alert(e.message||String(e));}finally{setTimeout(cerrarProgresoActa,500);}}
async function reiniciarTodasActasAdmin(){
    const motivo=prompt('Indica el motivo del reinicio de todas las actas:','REINICIO PARA REGULARIZACIÓN PRODUCTIVA');if(motivo===null)return;if(motivo.trim().length<8)return alert('El motivo debe tener al menos 8 caracteres.');
    const confirmacion=prompt('Esta acción afecta TODAS las actas de Guardia y Custodio.\n\nPara continuar escribe exactamente:\nBORRAR TODAS LAS ACTAS','');if(confirmacion===null)return;if(confirmacion.trim().toUpperCase()!=='BORRAR TODAS LAS ACTAS')return alert('La frase no coincide. No se realizó ningún cambio.');
    if(!confirm('Última confirmación: las actas serán retiradas y las armas activas quedarán pendientes de regularización. ¿Continuar?'))return;
    try{progresoActa('Respaldando y reiniciando las actas…',30);const r=await postActas({accion:'reiniciar_actas_armamento',token:tokenSesionActual(),motivo:motivo.trim(),confirmacion},90000);if(!r.ok)throw new Error(r.mensaje);progresoActa('Actualizando inventario…',75);if(typeof cargarDatos==='function')await cargarDatos();await abrirHistorialActas();progresoActa('Reinicio completado.',100);alert(r.mensaje+'\n\nYa puedes entrar en Regularizar y registrar la fecha real del traslado.');}catch(e){alert(e.message||String(e));}finally{setTimeout(cerrarProgresoActa,400);}
}
async function eliminarUltimaActa(codigo){
    if(!confirm(`¿Eliminar ${codigo}? Solo se permite eliminar la última acta.`))return;
    try{
        progresoActa('Eliminando acta y restaurando el estado anterior…',35);
        const r=await postActas({accion:'eliminar_ultima_acta',token:tokenSesionActual(),codigo},90000);
        if(!r.ok)throw new Error(r.mensaje||'No se pudo eliminar.');
        progresoActa('Actualizando inventario y contadores…',70);
        if(typeof cargarDatos==='function')await cargarDatos();
        const historialIntegrado=document.getElementById('acta-vista-historial');
        if(historialIntegrado&&historialIntegrado.style.display!=='none')await cargarHistorialIntegrado();
        const historialAnterior=document.getElementById('historial-actas-modal');
        if(historialAnterior&&historialAnterior.style.display==='flex')await abrirHistorialActas();
        progresoActa('Información actualizada.',100);
    }catch(e){alert(e.message||String(e));}
    finally{setTimeout(cerrarProgresoActa,350);}
}
