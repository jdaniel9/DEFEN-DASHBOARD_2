// ================================================================
// filters.js — Filtros globales nacionales y resumen ejecutivo dinámico
// ================================================================

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

function toggleChip(btn, color) {
    const grupo = btn.dataset.filtro;
    const val   = btn.dataset.val;

    // Desactivar todos los chips del mismo grupo
    document.querySelectorAll(`.chip[data-filtro="${grupo}"]`).forEach(c => {
        c.className = 'chip';
    });

    // Activar el seleccionado
    btn.classList.add(`active-${color}`);
    filtrosActivos[grupo] = val;

    aplicarFiltrosGlobales();
    actualizarBadgeFab();
}

function toggleCheck(id) {
    const cb = document.getElementById(id);
    cb.checked = !cb.checked;
}

// Determina si una provincia pasa todos los filtros activos
function provinciaPassaFiltros(nombre) {
    const info    = data[nombre];
    const detalle = detalleProvincias[nombre];
    if (!info) return false;

    // ── Filtro categoría ──
    const fc = filtrosActivos.cat;
    if (fc !== 'todos' && info.cat !== fc) return false;

    // ── Filtro vencimiento (cualquier proyecto de la provincia) ──
    const fv = filtrosActivos.vence;
    if (fv !== 'todos' && detalle && detalle.proyectosList) {
        const pasaVence = detalle.proyectosList.some(p => {
            const d = diasRestantes(p.fin);
            if (fv === 'critico') return d <= 30;
            if (fv === 'alerta')  return d > 30 && d <= 60;
            if (fv === 'ok')      return d > 60;
            return true;
        });
        if (!pasaVence) return false;
    }

    // ── Filtro tipo de contrato (ODC/CT/BROW/CUST) ──
    const fcon = filtrosActivos.contrato;
    if (fcon !== 'todos' && detalle && detalle.proyectosList) {
        const pasaContrato = detalle.proyectosList.some(p =>
            (p.tipoContrato || '').toLowerCase() === fcon
        );
        if (!pasaContrato) return false;
    }

    // ── Filtros de puestos (jornada / arma / radio) ──
    const fj = filtrosActivos.jornada;
    const fa = filtrosActivos.arma;
    const fr = filtrosActivos.radio;
    const hayFiltrosPuesto = fj !== 'todos' || fa !== 'todos' || fr !== 'todos';

    if (hayFiltrosPuesto) {
        const puestosP = Object.values(puestosData[nombre] || {}).flat();
        if (puestosP.length === 0) return false; // sin puestos no puede pasar filtros de puesto

        const pasaPuesto = puestosP.some(p => {
            // Jornada
            if (fj !== 'todos') {
                const tipo = (p.tipo || '').toLowerCase().replace(/\s/g,'');
                if (!tipo.includes(fj)) return false;
            }
            // Arma
            const armado = p.armado === true || String(p.armado).toLowerCase() === 'si';
            if (fa === 'armado'    && !armado)  return false;
            if (fa === 'desarmado' &&  armado)  return false;
            // Radio
            const conRadio = p.radio === true || String(p.radio).toLowerCase() === 'si';
            if (fr === 'conradio' && !conRadio) return false;
            if (fr === 'sinradio' &&  conRadio) return false;
            return true;
        });
        if (!pasaPuesto) return false;
    }

    return true;
}

function aplicarFiltrosGlobales() {
    const todosNeutros = Object.values(filtrosActivos).every(v => v === 'todos');

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

            // Actualizar totales en la tarjeta con valores filtrados
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

    // Si hay un panel de detalle abierto, refrescarlo con los datos filtrados
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
    const todosNeutros = Object.values(filtrosActivos).every(v => v === 'todos');

    Object.keys(data).forEach(nombre => {
        const info = data[nombre];
        if (info.proyectos === 0) return;

        if (todosNeutros) {
            // Sin filtros: usar totales completos de la provincia
            provs++;
            proyectos  += info.proyectos;
            guardias   += info.guardias;
            armas      += info.armas;
            puestosTot += info.puestos;
        } else {
            // Con filtros: usar SOLO los proyectos que realmente cumplen
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

    // Actualizar resumen ejecutivo principal con valores filtrados
    document.getElementById('total-guardias').innerText   = guardias.toLocaleString();
    document.getElementById('total-armas').innerText      = armas;
    document.getElementById('total-proyectos').innerText  = proyectos;
    document.getElementById('total-provincias').innerText = provs;
    const elPuestosTot = document.getElementById('total-puestos');
    if (elPuestosTot) elPuestosTot.innerText = puestosTot;

    // Actualizar "En Campo" en resumen armamento con valor filtrado
    const elCampo = document.getElementById('armas-operativas-tbl');
    if (elCampo) elCampo.innerText = armas;

    // Rastrillo dinámico = Global - ArmasFiltradas - EnTránsito - Pérdida - Confiscada
    if (!todosNeutros) {
        const rastrilloDin = (armamento.global||0) - armas - (armamento.enTransito||0) - (armamento.perdida||0) - (armamento.confiscada||0);
        const elRas = document.getElementById('armas-rastrillo');
        if (elRas) elRas.innerText = rastrilloDin;
    } else {
        // Restaurar valores reales
        const elRas = document.getElementById('armas-rastrillo');
        if (elRas) elRas.innerText = armamento.rastrillo ?? '—';
        if (elCampo) elCampo.innerText = armamento.enCampo ?? armas;
    }
}

function actualizarBadgeFab() {
    const activos = Object.values(filtrosActivos).filter(v => v !== 'todos').length;
    const badge   = document.getElementById('fab-badge');
    badge.style.display = activos > 0 ? 'flex' : 'none';
    badge.textContent   = activos;
}

function resetearFiltros() {
    Object.keys(filtrosActivos).forEach(k => filtrosActivos[k] = 'todos');
    document.querySelectorAll('.chip').forEach(c => c.className = 'chip');
    document.querySelectorAll('.chip[data-val="todos"]').forEach(c => c.classList.add('active-blue'));
    aplicarFiltrosGlobales();
    actualizarBadgeFab();
    // Restaurar totales reales llamando a init parcial
    init();
}

// =====================================================================
// PDF GLOBAL
// =====================================================================

// Inicializar chips "Todos" como activos al cargar
function initChips() {
    document.querySelectorAll('.chip[data-val="todos"]').forEach(c => c.classList.add('active-blue'));
}
