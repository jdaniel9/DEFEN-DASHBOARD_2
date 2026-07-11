// ================================================================
// filters.js — Filtros globales nacionales y resumen ejecutivo dinámico
// Soporta MULTI-SELECCIÓN: cada grupo de filtro es un array; se puede
// elegir más de una opción por grupo (OR dentro del grupo, AND entre grupos).
// Array vacío en un grupo = "todos" (sin restricción en ese grupo).
// ================================================================

function grupoActivo(g) {
    return Array.isArray(filtrosActivos[g]) && filtrosActivos[g].length > 0;
}

function togglePanelFiltros() {
    const panel   = document.getElementById('panel-filtros-global');
    const fab     = document.getElementById('fab-filtros');
    const overlay = document.getElementById('panel-overlay');
    const isOpen  = panel.classList.toggle('open');
    fab.classList.toggle('open', isOpen);
    overlay.style.display = isOpen ? 'block' : 'none';
    document.getElementById('fab-icon').textContent = isOpen ? '✕' : '⚙️';
    if (isOpen) actualizarResumenFiltro();
}

// Multi-select: cada chip (excepto "todos") se prende/apaga individualmente.
// El chip "todos" limpia el grupo completo (equivale a "sin restricción").
function toggleChip(btn, color) {
    const grupo = btn.dataset.filtro;
    const val   = btn.dataset.val;

    if (val === 'todos') {
        filtrosActivos[grupo] = [];
        document.querySelectorAll(`.chip[data-filtro="${grupo}"]`).forEach(c => c.className = 'chip');
        btn.classList.add(`active-${color}`);
    } else {
        const idx = filtrosActivos[grupo].indexOf(val);
        if (idx > -1) {
            filtrosActivos[grupo].splice(idx, 1);
            btn.className = 'chip';
        } else {
            filtrosActivos[grupo].push(val);
            btn.className = 'chip';
            btn.classList.add(`active-${color}`);
        }
        const chipTodos = document.querySelector(`.chip[data-filtro="${grupo}"][data-val="todos"]`);
        if (chipTodos) {
            chipTodos.className = 'chip';
            if (filtrosActivos[grupo].length === 0) chipTodos.classList.add('active-blue');
        }
    }

    aplicarFiltrosGlobales();
    actualizarBadgeFab();
}

function toggleCheck(id) {
    const cb = document.getElementById(id);
    cb.checked = !cb.checked;
}

// Determina si una provincia pasa TODOS los filtros activos
// (OR dentro de cada grupo, AND entre grupos distintos)
function provinciaPassaFiltros(nombre) {
    const info    = data[nombre];
    const detalle = detalleProvincias[nombre];
    if (!info) return false;

    if (grupoActivo('cat') && !filtrosActivos.cat.includes(info.cat)) return false;

    if (grupoActivo('vence') && detalle && detalle.proyectosList) {
        const pasaVence = detalle.proyectosList.some(p => {
            const d = diasRestantes(p.fin);
            const estado = d <= 30 ? 'critico' : d <= 60 ? 'alerta' : 'ok';
            return filtrosActivos.vence.includes(estado);
        });
        if (!pasaVence) return false;
    }

    if (grupoActivo('contrato') && detalle && detalle.proyectosList) {
        const pasaContrato = detalle.proyectosList.some(p =>
            filtrosActivos.contrato.includes((p.tipoContrato || '').toLowerCase())
        );
        if (!pasaContrato) return false;
    }

    const hayFiltrosPuesto = grupoActivo('jornada') || grupoActivo('arma') || grupoActivo('radio');

    if (hayFiltrosPuesto) {
        const puestosP = Object.values(puestosData[nombre] || {}).flat();
        if (puestosP.length === 0) return false;

        const pasaPuesto = puestosP.some(p => {
            if (grupoActivo('jornada')) {
                const tipo = (p.tipo || '').toLowerCase().replace(/\s/g,'');
                const cumple = filtrosActivos.jornada.some(j => tipo.includes(j));
                if (!cumple) return false;
            }
            if (grupoActivo('arma')) {
                const armado = p.armado === true || String(p.armado).toLowerCase() === 'si';
                const cumple = filtrosActivos.arma.some(v =>
                    (v === 'armado' && armado) || (v === 'desarmado' && !armado)
                );
                if (!cumple) return false;
            }
            if (grupoActivo('radio')) {
                const conRadio = p.radio === true || String(p.radio).toLowerCase() === 'si';
                const cumple = filtrosActivos.radio.some(v =>
                    (v === 'conradio' && conRadio) || (v === 'sinradio' && !conRadio)
                );
                if (!cumple) return false;
            }
            return true;
        });
        if (!pasaPuesto) return false;
    }

    return true;
}

function aplicarFiltrosGlobales() {
    const todosNeutros = !Object.keys(filtrosActivos).some(g => grupoActivo(g));

    Object.keys(data).forEach(nombre => {
        const cleanId = nombre.replace(/\s/g,'');
        const marker  = document.getElementById(`marker-${cleanId}`);
        const card    = document.getElementById(`card-${cleanId}`);
        const pasa    = todosNeutros || provinciaPassaFiltros(nombre);

        if (marker) {
            marker.style.opacity       = pasa ? '1'    : '0.1';
            marker.style.pointerEvents = pasa ? ''     : 'none';
            marker.style.transform     = pasa ? ''     : 'translate(-50%,-50%) scale(0.6)';
        }
        if (card) {
            card.style.opacity = pasa ? '1' : '0.3';
            if (data[nombre].proyectos > 0) {
                const tot = calcTotalesFiltrados(nombre);
                const elA = card.querySelector(`.card-armas-${cleanId}`);
                const elG = card.querySelector(`.card-guardias-${cleanId}`);
                const elB = card.querySelector(`.card-proy-badge-${cleanId}`);
                if (elA) elA.textContent = tot.armas;
                if (elG) elG.textContent = tot.guardias;
                if (elB) elB.textContent = `${tot.proyectos} PROY.`;
            }
        }
    });

    actualizarResumenFiltro();

    const panel = document.getElementById('detail-panel');
    if (panel && panel.classList.contains('visible')) {
        const titulo = panel.querySelector('h3');
        if (titulo) {
            const nombreProv = titulo.textContent.replace('📍','').trim();
            if (nombreProv && data[nombreProv]) renderDetailPanel(nombreProv);
        }
    }
}

function actualizarResumenFiltro() {
    let provs = 0, guardias = 0, armas = 0, proyectos = 0, puestosTot = 0;
    const todosNeutros = !Object.keys(filtrosActivos).some(g => grupoActivo(g));

    Object.keys(data).forEach(nombre => {
        const info = data[nombre];
        if (info.proyectos === 0) return;

        if (todosNeutros) {
            provs++;
            proyectos  += info.proyectos;
            guardias   += info.guardias;
            armas      += info.armas;
            puestosTot += info.puestos;
        } else {
            const tot = calcTotalesFiltrados(nombre);
            if (tot.proyectos > 0) {
                provs++;
                proyectos  += tot.proyectos;
                guardias   += tot.guardias;
                armas      += tot.armas;
                puestosTot += tot.puestos;
            }
        }
    });

    const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    set('fr-provincias', provs);
    set('fr-guardias',   guardias);
    set('fr-armas',      armas);
    set('fr-proyectos',  proyectos);

    document.getElementById('total-guardias').innerText   = guardias.toLocaleString();
    document.getElementById('total-armas').innerText      = armas;
    document.getElementById('total-proyectos').innerText  = proyectos;
    document.getElementById('total-provincias').innerText = provs;
    const elPuestosTot = document.getElementById('total-puestos');
    if (elPuestosTot) elPuestosTot.innerText = puestosTot;

    const elCampo = document.getElementById('armas-operativas-tbl');
    if (elCampo) elCampo.innerText = armas;

    if (!todosNeutros) {
        const rastrilloDin = (armamento.global||0) - armas - (armamento.enTransito||0) - (armamento.perdida||0) - (armamento.confiscada||0);
        const elRas = document.getElementById('armas-rastrillo');
        if (elRas) elRas.innerText = rastrilloDin;
    } else {
        const elRas = document.getElementById('armas-rastrillo');
        if (elRas) elRas.innerText = armamento.rastrillo ?? '—';
        if (elCampo) elCampo.innerText = armamento.enCampo ?? armas;
    }
}

function actualizarBadgeFab() {
    const activos = Object.keys(filtrosActivos).reduce((s,g) => s + filtrosActivos[g].length, 0);
    const badge   = document.getElementById('fab-badge');
    badge.style.display = activos > 0 ? 'flex' : 'none';
    badge.textContent   = activos;
}

function resetearFiltros() {
    Object.keys(filtrosActivos).forEach(k => filtrosActivos[k] = []);
    document.querySelectorAll('.chip').forEach(c => c.className = 'chip');
    document.querySelectorAll('.chip[data-val="todos"]').forEach(c => c.classList.add('active-blue'));
    aplicarFiltrosGlobales();
    actualizarBadgeFab();
    init();
}

function initChips() {
    document.querySelectorAll('.chip[data-val="todos"]').forEach(c => c.classList.add('active-blue'));
}
