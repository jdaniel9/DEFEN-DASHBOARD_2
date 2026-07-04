// ================================================================
// map.js — Mapa nacional: marcadores, tarjetas, tooltips, panel detalle
// ================================================================

function renderDetailPanel(nombre) {
    const panel   = document.getElementById('detail-panel');
    const detalle = detalleProvincias[nombre];
    const prov    = data[nombre];

    if (!detalle) {
        panel.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-base font-black text-slate-800">📍 ${nombre}</h3>
                <button onclick="closeDetail()" class="text-slate-400 hover:text-slate-700 text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">✕ Cerrar</button>
            </div>
            <p class="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                Esta provincia aún no tiene información cargada en el sistema.
            </p>`;
        panel.classList.add('visible');
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
    }

    // ── Trámite ──
    const enTramite      = !detalle.vigenciaFin || !detalle.vigenciaInicio;
    const sinRegistro    = !detalle.tramite;
    const diasTramite    = enTramite ? null : diasRestantes(detalle.vigenciaFin);
    const alTramite      = (!enTramite && diasTramite !== null) ? alertaVigencia(diasTramite) : null;

    const tramiteHTML = sinRegistro
        ? `<p class="text-sm font-bold text-slate-400 italic">Sin registro de trámite</p>`
        : `<p class="font-black text-slate-900 text-sm" style="font-family:'DM Mono',monospace">${detalle.tramite}</p>`;

    const vigenciaHTML = sinRegistro
        ? `<p class="text-slate-400 text-[11px] italic">Sin datos de vigencia</p>`
        : enTramite
            ? `<p class="text-[11px] font-black text-amber-600">🕐 EN TRÁMITE</p>
               <p class="text-[10px] text-slate-400 mt-0.5">${detalle.estadoTramite || 'Registro de Inspección'}</p>`
            : `<p class="text-[11px] text-slate-600 font-semibold">${formatFecha(detalle.vigenciaInicio)} → ${formatFecha(detalle.vigenciaFin)}</p>
               <p class="text-[11px] font-black mt-1 ${alTramite.cls}">${alTramite.label}</p>`;

    // ── Supervisores provincia ──
    const supsProv     = detalle.supervisores || [];
    const supsProvHTML = supsProv.length > 0
        ? supsProv.map(s => `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full">👤 ${s}</span>`).join('')
        : `<span class="text-[11px] font-bold text-slate-400 italic">Sin supervisor asignado</span>`;

    // ── Proyectos — usar solo los que pasan el filtro activo ──
    const todosNeutros   = Object.values(filtrosActivos).every(v => v === 'todos');
    const totFiltrados   = calcTotalesFiltrados(nombre);
    const listaProy      = todosNeutros ? (detalle.proyectosList || []) : totFiltrados.proyectosList;
    const totalProv      = detalle.proyectosList ? detalle.proyectosList.length : 0;
    const hayFiltroActivo = !todosNeutros && totalProv !== listaProy.length;

    const tieneProy = listaProy.length > 0;
    const proyectosHTML = tieneProy
        ? listaProy.map(p => {
            const dias = diasRestantes(p.fin);
            const al   = alertaProyecto(dias);
            const supsP = p.supervisores && p.supervisores.length > 0
                ? `<div class="flex flex-wrap gap-1 mt-1">${p.supervisores.map(s => `<span class="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">👤 ${s}</span>`).join('')}</div>`
                : '';
            return `
            <div class="project-row bg-white flex flex-col gap-2">
                <div class="flex items-start justify-between gap-2">
                    <span class="text-sm font-black text-slate-800 leading-tight">${p.nombre}</span>
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${al.cls}">${al.label}</span>
                </div>
                <div class="flex flex-wrap gap-3 text-[11px] text-slate-500 font-semibold">
                    <span>👮 ${p.guardias} guardia(s)</span>
                    <span>🔫 ${p.armas} arma(s)</span>
                    <span>🏢 ${p.puestos ?? '—'} puesto(s)</span>
                    <span>📅 Finaliza: ${formatFecha(p.fin)}</span>
                </div>
                ${supsP}
                <div class="text-[10px] text-slate-400 font-medium">${al.desc}</div>
            </div>`;
        }).join('')
        : `<div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px] text-amber-700 font-semibold">
            ${hayFiltroActivo
                ? `⚙️ Ningún proyecto de esta provincia cumple el filtro activo. <button onclick="resetearFiltros()" class="underline ml-1">Limpiar filtros</button>`
                : 'Sin proyectos activos en esta provincia.'}
           </div>`;

    panel.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="text-lg font-black text-slate-900 leading-tight">📍 ${nombre}</h3>
                <div class="flex items-center gap-2 mt-0.5">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wide">${prov.tipo} · ${prov.estado}</p>
                    ${hayFiltroActivo ? `<span class="text-[8px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full">⚙️ Filtro activo · ${listaProy.length} de ${totalProv} proy.</span>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-2">
                ${puestosData[nombre] ? `
                <button onclick="abrirVistaProvincia('${nombre}')"
                        class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-3 py-1.5 rounded-xl transition-colors shadow-sm">
                    🗺️ Ver mapa de puestos
                </button>` : ''}
                <button onclick="closeDetail()" class="text-slate-400 hover:text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200">✕ Cerrar</button>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">N° de Trámite</p>
                ${tramiteHTML}
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vigencia Trámite</p>
                ${vigenciaHTML}
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Supervisor(es) Provincia</p>
                <div class="flex flex-wrap gap-1">${supsProvHTML}</div>
                ${supsProv.length > 0 ? `<p class="text-[9px] text-slate-400 font-medium mt-1">${supsProv.length} asignado(s)</p>` : ''}
            </div>
        </div>

        <div>
            <div class="flex items-center gap-2 mb-2">
                <h4 class="text-sm font-black text-slate-700">Proyecto(s) Activo(s)</h4>
                ${tieneProy ? `<div class="flex gap-2 ml-auto text-[9px] font-bold">
                    <span class="badge-danger px-2 py-0.5 rounded-full">≤30d: acción</span>
                    <span class="badge-warn  px-2 py-0.5 rounded-full">≤60d: pendiente</span>
                    <span class="badge-ok    px-2 py-0.5 rounded-full">&gt;60d: ok</span>
                </div>` : ''}
            </div>
            <div class="flex flex-col gap-2">${proyectosHTML}</div>
        </div>`;

    panel.classList.add('visible');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeDetail() {
    const panel = document.getElementById('detail-panel');
    panel.classList.remove('visible');
    panel.innerHTML = '';
    // Quitar selección visual de tarjetas
    document.querySelectorAll('.card-selected').forEach(c => c.classList.remove('card-selected'));
}

// =====================================================================
// MARKERS
// =====================================================================
const tooltip       = document.getElementById('tooltip');
const markersLayer  = document.getElementById('markers-layer');
const listContainer = document.getElementById('province-list');

function init() {
    document.getElementById('markers-layer').innerHTML = '';
    document.getElementById('province-list').innerHTML = '';

    // Totales calculados desde proyectosList (fuente de verdad)
    let totals = { G:0, A:0, Pu:0, Pr:0, Prov:0 };
    Object.keys(data).sort().forEach(name => {
        const info    = data[name];
        const detalle = detalleProvincias[name];
        if (info.proyectos > 0) {
            if (detalle && detalle.proyectosList && detalle.proyectosList.length > 0) {
                detalle.proyectosList.forEach(p => {
                    totals.G  += Number(p.guardias) || 0;
                    totals.A  += Number(p.armas)    || 0;
                    totals.Pu += Number(p.puestos)  || 0;
                });
            } else {
                totals.G  += info.guardias;
                totals.A  += info.armas;
                totals.Pu += info.puestos;
            }
            totals.Pr   += info.proyectos;
            totals.Prov++;
        }
        createMarker(name, info);
        createListItem(name, info);
    });

    // Resumen ejecutivo
    document.getElementById('total-guardias').innerText   = totals.G.toLocaleString();
    document.getElementById('total-armas').innerText      = totals.A;
    document.getElementById('total-puestos').innerText    = totals.Pu;
    document.getElementById('total-proyectos').innerText  = totals.Pr;
    document.getElementById('total-provincias').innerText = totals.Prov;

    // Resumen armamento — todos los valores calculados automáticamente
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val !== null && val !== undefined ? val : '—'; };
    set('armas-operativas-tbl', armamento.enCampo  ?? totals.A);
    set('armas-rastrillo',      armamento.rastrillo);
    set('armas-perdida',        armamento.perdida);
    set('armas-confiscada',     armamento.confiscada);
    set('armas-global',         armamento.global);
    // En campo en resumen ejecutivo = suma real de proyectosList
    document.getElementById('total-armas').innerText = totals.A;
}

function markerColor(info) {
    if (info.cat === 'active')
        return (info.tipo === 'MATRIZ' || info.tipo === 'SUCURSAL') ? '#2563eb' : '#16a34a';
    if (info.cat === 'agency_only') return '#f59e0b';
    return '#ef4444';
}

function createMarker(name, info) {
    const color   = markerColor(info);
    const cleanId = name.replace(/\s/g,'');
    const marker  = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = info.x + '%';
    marker.style.top  = info.y + '%';
    marker.style.backgroundColor = color;
    marker.id = `marker-${cleanId}`;

    if (info.cat === 'active') {
        const pulse = document.createElement('div');
        pulse.className = 'marker-pulse';
        pulse.style.backgroundColor = color;
        marker.appendChild(pulse);
    }

    marker.onmousemove = (e) => showTooltip(e, name, info);
    marker.onmouseleave = hideTooltip;
    marker.onclick = () => {
        hideTooltip();
        highlightCard(cleanId);
        renderDetailPanel(name);
        // Si tiene puestos registrados, ofrecer vista de mapa
        if (info.cat === 'active' && puestosData[name]) {
            abrirVistaProvincia(name);
        }
    };
    markersLayer.appendChild(marker);
}

function createListItem(name, info) {
    const cleanId = name.replace(/\s/g,'');
    let borderCls = 'border-l-red-500';
    let bgCls     = 'bg-slate-50';
    if (info.cat === 'active') {
        borderCls = (info.tipo === 'MATRIZ' || info.tipo === 'SUCURSAL') ? 'border-l-blue-600' : 'border-l-green-600';
        bgCls     = 'bg-white';
    } else if (info.cat === 'agency_only') {
        borderCls = 'border-l-yellow-500';
    }

    const div = document.createElement('div');
    div.id        = `card-${cleanId}`;
    div.className = `p-3 ${bgCls} border border-slate-200 rounded-xl transition-all hover:shadow-md cursor-pointer group border-l-4 ${borderCls}`;

    div.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-black text-slate-800 text-xs group-hover:text-blue-600 transition-colors">${name}</h4>
                <p class="text-[9px] font-bold text-slate-400 uppercase">${info.estado}</p>
            </div>
            ${info.proyectos > 0
                ? `<span class="bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full card-proy-badge-${cleanId}">${info.proyectos} PROY.</span>`
                : ''}
        </div>
        ${info.proyectos > 0 ? `
        <div class="grid grid-cols-2 gap-2 mt-2 text-[10px]">
            <div class="flex justify-between border-b border-slate-100 pb-1">
                <span class="text-slate-400 font-bold uppercase">Arma(s)</span>
                <span class="font-black text-slate-700 card-armas-${cleanId}">${info.armas}</span>
            </div>
            <div class="flex justify-between border-b border-slate-100 pb-1">
                <span class="text-slate-400 font-bold uppercase">Guardia(s)</span>
                <span class="font-black text-blue-600 card-guardias-${cleanId}">${info.guardias}</span>
            </div>
        </div>` : `<p class="text-[9px] text-slate-400 mt-1 font-medium">→ Ver trámite</p>`}
    `;

    div.onclick = () => {
        // Scroll al marcador en el mapa
        const marker = document.getElementById(`marker-${cleanId}`);
        if (marker) {
            marker.style.transform = 'translate(-50%, -50%) scale(2.5)';
            setTimeout(() => marker.style.transform = '', 900);
        }
        highlightCard(cleanId);
        renderDetailPanel(name);
    };

    listContainer.appendChild(div);
}

function highlightCard(id) {
    document.querySelectorAll('.card-selected').forEach(c => c.classList.remove('card-selected'));
    const card = document.getElementById(`card-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.classList.add('card-selected');
}

// =====================================================================
// HELPER: calcular totales de una provincia SEGÚN FILTROS ACTIVOS
// Devuelve {guardias, armas, puestos, proyectos, proyectosList}
// =====================================================================

function showTooltip(e, name, info) {
    // Usar totales filtrados en el tooltip
    const tot = calcTotalesFiltrados(name);
    const hayFiltro = !Object.values(filtrosActivos).every(v => v === 'todos');

    tooltip.style.display = 'block';
    tooltip.innerHTML = `
        <div class="text-[9px] font-bold text-blue-400 uppercase mb-1">${info.tipo}</div>
        <div class="text-sm font-black border-b border-white/10 pb-2 mb-2">${name}</div>
        ${hayFiltro ? `<div class="text-[8px] text-amber-400 font-bold mb-2 flex items-center gap-1">⚙️ Mostrando datos filtrados</div>` : ''}
        <div class="grid grid-cols-2 gap-3 text-[11px]">
            <div><div class="text-slate-400 text-[9px] uppercase">Puesto(s)</div><div class="font-bold">${tot.puestos}</div></div>
            <div><div class="text-slate-400 text-[9px] uppercase">Guardia(s)</div><div class="font-bold text-blue-400">${tot.guardias}</div></div>
            <div><div class="text-slate-400 text-[9px] uppercase">Proyecto(s)</div><div class="font-bold">${tot.proyectos}</div></div>
            <div><div class="text-slate-400 text-[9px] uppercase">Arma(s)</div><div class="font-bold text-green-400">${tot.armas}</div></div>
        </div>
        <div class="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300 uppercase">
            Estado: <span class="${info.estado==='VIGENTE'?'text-green-400':'text-amber-400'} font-bold">${info.estado}</span>
        </div>
        ${info.cat==='active' ? '<div class="mt-1 text-[9px] text-blue-300 font-medium">→ Clic para ver detalle completo</div>' : '<div class="mt-1 text-[9px] text-slate-400 font-medium">→ Clic para ver trámite</div>'}
    `;
    const x = e.clientX + 20;
    const y = e.clientY + 20;
    tooltip.style.left = (x + 220 > window.innerWidth ? e.clientX - 240 : x) + 'px';
    tooltip.style.top  = (y + 160 > window.innerHeight ? e.clientY - 180 : y) + 'px';
}

function hideTooltip() { tooltip.style.display = 'none'; }


function hideTooltip() { document.getElementById('tooltip').style.display = 'none'; }
