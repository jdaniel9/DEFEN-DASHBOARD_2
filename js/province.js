// ================================================================
// province.js — Vista de provincia: Leaflet, puestos, PDF por provincia
// ================================================================

function calcTotalesFiltrados(nombre) {
    const detalle = detalleProvincias[nombre];
    if (!detalle || !detalle.proyectosList) return { guardias:0, armas:0, puestos:0, proyectos:0, proyectosList:[] };

    const fj   = filtrosActivos.jornada;
    const fa   = filtrosActivos.arma;
    const fr   = filtrosActivos.radio;
    const fv   = filtrosActivos.vence;
    const fcon = filtrosActivos.contrato;

    // Filtrar proyectos según vencimiento
    let proysFiltrados = detalle.proyectosList.filter(p => {
        if (fv === 'todos') return true;
        const d = diasRestantes(p.fin);
        if (fv === 'critico') return d <= 30;
        if (fv === 'alerta')  return d > 30 && d <= 60;
        if (fv === 'ok')      return d > 60;
        return true;
    });

    // Filtrar por tipo de contrato (ODC/CT/BROW/CUST)
    if (fcon !== 'todos') {
        proysFiltrados = proysFiltrados.filter(p =>
            (p.tipoContrato || '').toLowerCase() === fcon
        );
    }

    // Si hay filtros de puesto (jornada/arma/radio), filtrar proyectos que tengan
    // al menos un puesto que los cumpla, Y recalcular armas reales de esos puestos
    const hayFiltroPuesto = fj !== 'todos' || fa !== 'todos' || fr !== 'todos';
    if (hayFiltroPuesto) {
        const puestosP = Object.entries(puestosData[nombre] || {});
        proysFiltrados = proysFiltrados
            .map(p => {
                const entry = puestosP.find(([k]) => k.toUpperCase() === p.nombre.toUpperCase());
                if (!entry) return null;
                const puestosQuePasan = entry[1].filter(pu => {
                    if (fj !== 'todos') {
                        const tipo = (pu.tipo || '').toLowerCase().replace(/\s/g,'');
                        if (!tipo.includes(fj)) return false;
                    }
                    const armado   = pu.armado === true || String(pu.armado).toLowerCase() === 'si';
                    const conRadio = pu.radio  === true || String(pu.radio).toLowerCase()  === 'si';
                    if (fa === 'armado'    && !armado)   return false;
                    if (fa === 'desarmado' &&  armado)   return false;
                    if (fr === 'conradio'  && !conRadio) return false;
                    if (fr === 'sinradio'  &&  conRadio) return false;
                    return true;
                });
                if (puestosQuePasan.length === 0) return null;
                // Armas reales = solo las de los puestos que pasan el filtro y están armados
                const armasReales = puestosQuePasan.filter(pu =>
                    pu.armado === true || String(pu.armado).toLowerCase() === 'si'
                ).length;
                return { ...p, armas: armasReales, puestos: puestosQuePasan.length };
            })
            .filter(Boolean);
    }

    // Calcular totales SOLO de proyectos filtrados
    let g=0, a=0, pu=0;
    proysFiltrados.forEach(p => {
        g  += Number(p.guardias) || 0;
        a  += Number(p.armas)    || 0;
        pu += Number(p.puestos)  || 0;
    });

    return { guardias:g, armas:a, puestos:pu, proyectos:proysFiltrados.length, proyectosList:proysFiltrados };
}

// =====================================================================
// Filtrar puestos de un proyecto según filtros activos
// =====================================================================
function puestosFiltrados(nombre, proyectoNombre) {
    const todos = (puestosData[nombre] || {})[proyectoNombre] || [];
    const fj = filtrosActivos.jornada;
    const fa = filtrosActivos.arma;
    const fr = filtrosActivos.radio;
    if (fj === 'todos' && fa === 'todos' && fr === 'todos') return todos;
    return todos.filter(pu => {
        if (fj !== 'todos') {
            const tipo = (pu.tipo||'').toLowerCase().replace(/\s/g,'');
            if (!tipo.includes(fj)) return false;
        }
        const armado   = pu.armado === true || String(pu.armado).toLowerCase() === 'si';
        const conRadio = pu.radio  === true || String(pu.radio).toLowerCase()  === 'si';
        if (fa === 'armado'    && !armado)   return false;
        if (fa === 'desarmado' &&  armado)   return false;
        if (fr === 'conradio'  && !conRadio) return false;
        if (fr === 'sinradio'  &&  conRadio) return false;
        return true;
    });
}




// =====================================================================
// SISTEMA DE VISTA DE PROVINCIA (Leaflet)
// =====================================================================

// Centros aproximados de cada provincia para el zoom inicial
const provinciaCentros = {
    "AZUAY":           [-2.9001, -78.9999, 10],
    "BOLIVAR":         [-1.6000, -79.0000, 10],
    "CAÑAR":           [-2.5500, -78.9300, 10],
    "CARCHI":          [ 0.5000, -77.9000, 10],
    "CHIMBORAZO":      [-1.6635, -78.6543, 10],
    "COTOPAXI":        [-0.8300, -78.6166, 10],
    "EL ORO":          [-3.2590, -79.9554, 10],
    "ESMERALDAS":      [ 0.9592, -79.6522, 10],
    "GALAPAGOS":       [-0.9537, -90.9656,  9],
    "GUAYAS":          [-2.1710, -79.9224, 10],
    "IMBABURA":        [ 0.3500, -78.1300, 10],
    "LOJA":            [-3.9931, -79.2042, 10],
    "LOS RIOS":        [-1.8000, -79.5300, 10],
    "MANABI":          [-1.0544, -80.4524,  9],
    "MORONA SANTIAGO": [-2.3000, -78.1200,  9],
    "NAPO":            [-0.9956, -77.8129,  9],
    "ORELLANA":        [-0.4606, -76.9956,  9],
    "PASTAZA":         [-1.4924, -78.0030,  9],
    "PICHINCHA":       [-0.2200, -78.5100, 11],
    "SANTA ELENA":     [-2.2267, -80.8591, 10],
    "SANTO DOMINGO":   [-0.2520, -79.1770, 11],
    "SUCUMBIOS":       [ 0.0847, -76.8897,  9],
    "TUNGURAHUA":      [-1.2490, -78.6196, 11],
    "ZAMORA CHINCHIPE":[-4.0653, -78.9500,  9]
};

// Abrir modal de provincia

function abrirVistaProvincia(nombre) {
    const modal = document.getElementById('prov-modal');
    modal.classList.add('open');
    document.getElementById('prov-nombre').textContent = nombre;

    if (provMap) { provMap.remove(); provMap = null; }
    const centro = provinciaCentros[nombre] || [-1.8312, -78.1834, 9];
    provMap = L.map('prov-map', { zoomControl: true }).setView([centro[0], centro[1]], centro[2]);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19, crossOrigin: true
    }).addTo(provMap);

    const detalle  = detalleProvincias[nombre];
    const sidebar  = document.getElementById('prov-proyectos');
    sidebar.innerHTML = '';
    mostrandoTodos  = false;
    mostrandoTodosProvincia = false;
    provinciaActual = nombre;
    puestosActuales = [];
    limpiarMarcadores();

    if (!detalle || !detalle.proyectosList || detalle.proyectosList.length === 0) {
        sidebar.innerHTML = '<p class="text-xs text-slate-400 px-1">Esta provincia no tiene proyectos registrados.</p>';
    } else {
        // Respetar filtros globales activos
        const todosN    = Object.values(filtrosActivos).every(v => v === 'todos');
        const totFilt   = calcTotalesFiltrados(nombre);
        const listaMapa = todosN ? detalle.proyectosList : totFilt.proyectosList;

        // Botón global: ver todos los puestos de TODA la provincia
        const hayPuestos = puestosData[nombre] && Object.keys(puestosData[nombre]).length > 0;
        if (hayPuestos) {
            const btnGlobal = document.createElement('button');
            btnGlobal.id = 'btn-todos-provincia';
            btnGlobal.className = 'w-full flex items-center justify-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl transition-colors bg-indigo-600 hover:bg-indigo-700 text-white mb-3';
            btnGlobal.innerHTML = '🗺️ Ver todos los puestos de la provincia';
            btnGlobal.onclick = toggleTodosPuestosProvincia;
            sidebar.appendChild(btnGlobal);
        }

        if (listaMapa.length === 0) {
            const p = document.createElement('div');
            p.innerHTML = `<p class="text-xs text-amber-600 font-bold px-1">⚙️ Ningún proyecto cumple el filtro activo.</p>
                <button onclick="resetearFiltros();abrirVistaProvincia('${nombre}')" class="text-[10px] text-blue-600 underline mt-1 px-1">Limpiar filtros y ver todos</button>`;
            sidebar.appendChild(p);
        } else {
            if (!todosN) {
                const aviso = document.createElement('p');
                aviso.className = 'text-[9px] text-amber-600 font-bold px-1 mb-2';
                aviso.textContent = `⚙️ Filtro activo: mostrando ${listaMapa.length} de ${detalle.proyectosList.length} proyectos`;
                sidebar.appendChild(aviso);
            }
            listaMapa.forEach((p, idx) => sidebar.appendChild(crearAcordeonProyecto(nombre, p, idx)));
        }
    }

    filtroActivo = 'todos';
    aplicarFiltro('todos');
    setTimeout(() => provMap.invalidateSize(), 150);
}

// Crear acordeón para un proyecto
function crearAcordeonProyecto(provincia, proyecto, idx) {
    const dias    = diasRestantes(proyecto.fin);
    const al      = alertaProyecto(dias);
    // Usar puestos filtrados según filtros globales
    const puestos = puestosFiltrados(provincia, proyecto.nombre);

    const wrap   = document.createElement('div');
    wrap.className = 'acord-proyecto';

    const header = document.createElement('div');
    header.className = 'acord-header';
    header.innerHTML = `
        <div class="flex-1 min-w-0">
            <p class="text-[11px] font-black text-slate-800 leading-tight truncate">${proyecto.nombre}</p>
            <div class="flex gap-1.5 mt-0.5 flex-wrap items-center">
                <span class="text-[9px] text-slate-500 font-semibold">👮${proyecto.guardias} 🔫${proyecto.armas} 🏢${proyecto.puestos ?? '—'}</span>
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${al.cls}">${al.label}</span>
            </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
            ${puestos.length > 0 ? `<span class="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">${puestos.length} pts</span>` : ''}
            <span class="acord-chevron">▼</span>
        </div>`;

    const body = document.createElement('div');
    body.className = 'acord-body';

    if (puestos.length === 0) {
        body.innerHTML = `<p class="text-[10px] text-slate-400 italic px-1 py-1">Sin puestos con coordenadas.<br>Agrégalos en la pestaña <strong>puestos</strong> del Excel.</p>`;
    } else {
        // Fila de botones: Ver todos + Reporte PDF de este proyecto
        const filaBtns = document.createElement('div');
        filaBtns.className = 'flex gap-1.5 mb-2';

        const btnTodos = document.createElement('button');
        btnTodos.className = 'flex-1 flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl transition-colors justify-center bg-blue-600 hover:bg-blue-700 text-white';
        btnTodos.innerHTML = `🗺️ Ver todos (${puestos.length})`;
        btnTodos.onclick   = (e) => {
            e.stopPropagation();
            seleccionarProyectoActual(provincia, proyecto.nombre, puestos);
            // Si ya mostrando, ocultar; si no, mostrar
            if (mostrandoTodos) {
                limpiarMarcadores();
                mostrandoTodos = false;
                btnTodos.innerHTML = `🗺️ Ver todos (${puestos.length})`;
                btnTodos.className = 'flex-1 flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl transition-colors justify-center bg-blue-600 hover:bg-blue-700 text-white';
                document.querySelectorAll('.puesto-card').forEach(c => c.classList.remove('active'));
            } else {
                limpiarMarcadores();
                puestosActuales.forEach((p, i) => colocarMarcador(p, false));
                mostrandoTodos = true;
                btnTodos.innerHTML = `🙈 Ocultar`;
                btnTodos.className = 'flex-1 flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl transition-colors justify-center bg-slate-200 hover:bg-slate-300 text-slate-700';
                if (puestosActuales.length > 0) {
                    const bounds = L.latLngBounds(puestosActuales.map(p => [p.lat, p.lng]));
                    provMap.fitBounds(bounds, { padding: [40, 40] });
                }
            }
        };
        filaBtns.appendChild(btnTodos);

        const btnPdfProy = document.createElement('button');
        btnPdfProy.className = 'flex items-center gap-1 text-[10px] font-black px-3 py-1.5 rounded-xl transition-colors bg-amber-500 hover:bg-amber-600 text-white';
        btnPdfProy.title = 'Descargar reporte PDF de este proyecto';
        btnPdfProy.innerHTML = '⬇️ PDF';
        btnPdfProy.onclick = (e) => {
            e.stopPropagation();
            exportarPDFProyecto(proyecto.nombre);
        };
        filaBtns.appendChild(btnPdfProy);

        body.appendChild(filaBtns);

        // Tarjetas de puestos
        puestos.forEach((puesto, pi) => {
            const card = crearTarjetaPuesto(puesto, pi);
            card.onclick = () => {
                seleccionarProyectoActual(provincia, proyecto.nombre, puestos);
                seleccionarPuesto(puesto, card, pi);
            };
            body.appendChild(card);
        });
    }

    // Toggle acordeón al hacer clic en header
    header.onclick = () => {
        const isOpen = body.classList.contains('open');
        document.querySelectorAll('.acord-body').forEach(b => b.classList.remove('open'));
        document.querySelectorAll('.acord-header').forEach(h => h.classList.remove('active'));
        limpiarMarcadores();
        mostrandoTodos = false;
        mostrandoTodosProvincia = false;
        const btnGlobal = document.getElementById('btn-todos-provincia');
        if (btnGlobal) {
            btnGlobal.innerHTML = '🗺️ Ver todos los puestos de la provincia';
            btnGlobal.className = 'w-full flex items-center justify-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl transition-colors bg-indigo-600 hover:bg-indigo-700 text-white mb-3';
        }
        aplicarFiltro('todos');   // resetear filtros al cambiar proyecto
        if (!isOpen) {
            body.classList.add('open');
            header.classList.add('active');
            seleccionarProyectoActual(provincia, proyecto.nombre, puestos);
        }
    };

    wrap.appendChild(header);
    wrap.appendChild(body);
    return wrap;
}

// Actualiza estado global del proyecto activo y centra el mapa
function seleccionarProyectoActual(provincia, nombreProyecto, puestos) {
    provinciaActual = provincia;
    proyectoActivo  = nombreProyecto;
    puestosActuales = puestos;
    if (!mostrandoTodos) limpiarMarcadores();
    if (puestos.length > 0) {
        const bounds = L.latLngBounds(puestos.map(p => [p.lat, p.lng]));
        provMap.fitBounds(bounds, { padding: [60, 60] });
    }
}

// Mantener por compatibilidad — vacía, reemplazada por crearAcordeonProyecto
function seleccionarProyecto() {}

// Crear tarjeta de puesto con guardias múltiples
function crearTarjetaPuesto(puesto, idx) {
    const card = document.createElement('div');
    card.className      = 'puesto-card';
    card.dataset.idx    = idx;

    // Guardias: puede ser string único o array separado por comas
    const guardias = Array.isArray(puesto.guardias)
        ? puesto.guardias
        : (puesto.guardia || '').split(',').map(g => g.trim()).filter(Boolean);

    const tieneAsistenciaReal = !!puesto.enTurnoHoy;

    const guardiasHTML = guardias.length > 1
        ? `<div class="flex flex-col gap-0.5 mt-1">
            ${guardias.map((g) => {
                const esHoy = tieneAsistenciaReal && g === puesto.enTurnoHoy;
                return `
                <span class="text-[9px] text-slate-500 font-medium">
                    ${esHoy ? '🟢' : '👮'} <span class="font-bold ${esHoy?'text-green-700':'text-slate-700'}">${g}</span>
                    ${esHoy ? '<span class="text-[8px] bg-green-100 text-green-700 font-bold px-1 rounded ml-1">Hoy</span>' : ''}
                </span>`;
            }).join('')}
           </div>`
        : `<p class="text-[9px] text-slate-400 font-medium">👮 ${guardias[0] || '—'} · ${puesto.tipo}</p>`;

    // Badge "En turno hoy" — solo si hay dato real de asistencia
    const badgeTurnoHoy = tieneAsistenciaReal
        ? `<div class="flex items-center gap-1 mt-1.5 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
               <span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" style="animation:pulseGreen 1.5s infinite;"></span>
               <span class="text-[9px] font-black text-green-700">EN TURNO: ${puesto.enTurnoHoy}</span>
           </div>`
        : '';

    card.innerHTML = `
        <div class="flex items-start gap-2">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${puesto.armado ? 'bg-red-500' : 'bg-green-500'}" style="min-width:10px;"></span>
            <div class="flex-1 min-w-0">
                <p class="text-[11px] font-black text-slate-800 leading-tight">${puesto.nombre}</p>
                ${guardiasHTML}
                ${badgeTurnoHoy}
            </div>
        </div>`;
    card.onclick = () => seleccionarPuesto(puesto, card, idx);
    return card;
}

// Seleccionar puesto individual → volar y mostrar popup
function seleccionarPuesto(puesto, cardEl, idx) {
    document.querySelectorAll('.puesto-card').forEach(c => c.classList.remove('active'));
    if (cardEl) cardEl.classList.add('active');

    // Si estaba en modo "todos", solo resaltar ese pin sin limpiar los demás
    if (!mostrandoTodos) {
        limpiarMarcadores();
        colocarMarcador(puesto, true);
    } else {
        // Resaltar el marcador seleccionado y atenuar los demás
        marcadoresMapa.forEach((m, i) => {
            const el = m.getElement();
            if (el) el.style.opacity = (i === idx) ? '1' : '0.35';
        });
        if (marcadoresMapa[idx]) {
            marcadoresMapa[idx].openPopup();
            provMap.flyTo([puesto.lat, puesto.lng], 16, { duration: 1 });
        }
        return;
    }

    provMap.flyTo([puesto.lat, puesto.lng], 16, { duration: 1.2 });
}

// Colocar un marcador en el mapa y devolver la instancia
function colocarMarcador(puesto, abrirPopup) {
    const guardias = Array.isArray(puesto.guardias)
        ? puesto.guardias
        : (puesto.guardia || '').split(',').map(g => g.trim()).filter(Boolean);

    const iconHtml = `
        <div style="
            width:34px;height:34px;
            background:${puesto.armado ? '#dc2626' : '#16a34a'};
            border:3px solid white;border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            box-shadow:0 4px 14px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;transition:opacity 0.2s;">
            <span style="transform:rotate(45deg);font-size:13px;">${puesto.armado ? '🔫' : '👮'}</span>
        </div>`;

    const icon = L.divIcon({ html: iconHtml, className:'', iconSize:[34,34], iconAnchor:[17,34], popupAnchor:[0,-36] });
    const marker = L.marker([puesto.lat, puesto.lng], { icon }).addTo(provMap);
    marker._puestoData = puesto;  // ← referencia para los filtros

    // ── Bloque "EN TURNO HOY" — datos reales desde asistencia (Zoho) ──
    const tieneAsistenciaReal = !!puesto.enTurnoHoy;
    const bloqueTurnoHoy = tieneAsistenciaReal ? `
        <div style="background:#ecfdf5;border:1.5px solid #6ee7b7;border-radius:10px;padding:8px 10px;margin-bottom:2px;">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">
                <span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block;animation:pulseGreen 1.5s infinite;"></span>
                <span style="font-size:8px;font-weight:900;color:#15803d;text-transform:uppercase;letter-spacing:0.04em;">En turno ahora</span>
            </div>
            <p style="font-size:12px;font-weight:900;color:#14532d;margin:0;">👤 ${puesto.enTurnoHoy}</p>
            <p style="font-size:9px;font-weight:700;color:#16a34a;margin:2px 0 0;">${iconoTurno(puesto.tipoTurnoHoy)} Turno ${puesto.tipoTurnoHoy}</p>
        </div>
    ` : '';

    // Lista de rotación (todos los que cubren el puesto)
    const listaRotacion = puesto.rotacionCompleta && puesto.rotacionCompleta.length > 0
        ? puesto.rotacionCompleta
        : guardias;

    // ── Guías de armas (envío/retorno) asignadas a este puesto ──
    const armasDelPuesto = (armamentoDetalle || []).filter(a =>
        a.provincia === provinciaActual &&
        a.puesto && a.puesto.trim().toUpperCase() === (puesto.nombre || '').trim().toUpperCase() &&
        (a.urlGuiaEnvio || a.urlGuiaRetorno)
    );
    const guiasHTML = armasDelPuesto.length > 0
        ? `<div style="border-top:1px solid #f1f5f9;padding-top:8px;margin-top:2px;">
               <p style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:5px;">Guías de armamento</p>
               ${armasDelPuesto.map(a => `
                   <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 0;">
                       <span style="font-size:9px;color:#475569;font-weight:600;">🔫 ${a.serie || 'Serie s/n'}</span>
                       <div style="display:flex;gap:4px;">
                           ${a.urlGuiaEnvio ? `<a href="${a.urlGuiaEnvio}" target="_blank" rel="noopener" style="font-size:8px;font-weight:800;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:5px;text-decoration:none;">⬇️ Envío</a>` : ''}
                           ${a.urlGuiaRetorno ? `<a href="${a.urlGuiaRetorno}" target="_blank" rel="noopener" style="font-size:8px;font-weight:800;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:5px;text-decoration:none;">⬇️ Retorno</a>` : ''}
                       </div>
                   </div>`).join('')}
           </div>`
        : '';

    const guardiasPopup = listaRotacion.length > 1
        ? listaRotacion.map((g) => {
            const esElDeHoy = tieneAsistenciaReal && g === puesto.enTurnoHoy;
            return `
            <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                <span style="font-size:10px;">${esElDeHoy ? '🟢' : '👮'}</span>
                <span style="font-size:11px;font-weight:${esElDeHoy?900:700};color:${esElDeHoy?'#15803d':'#1e293b'};">${g}</span>
                ${esElDeHoy ? '<span style="font-size:8px;background:#dcfce7;color:#15803d;font-weight:700;padding:1px 5px;border-radius:4px;">Hoy</span>' : ''}
            </div>`;
        }).join('')
        : `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;padding-bottom:6px;">
                <span style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Guardia</span>
                <span style="font-size:11px;font-weight:800;color:#1e293b;">👮 ${listaRotacion[0] || '—'}</span>
           </div>`;

    const popup = `
        <div style="font-family:'DM Sans',sans-serif;min-width:240px;max-width:300px;">
            <div style="background:${puesto.armado ? '#dc2626' : '#16a34a'};padding:10px 14px;">
                <p style="color:white;font-size:11px;font-weight:900;margin:0;">${puesto.nombre}</p>
                <p style="color:rgba(255,255,255,0.75);font-size:9px;font-weight:700;margin:2px 0 0;text-transform:uppercase;">${puesto.tipo} · ${puesto.turno}</p>
            </div>
            <div style="padding:12px 14px;display:flex;flex-direction:column;gap:6px;">
                ${bloqueTurnoHoy}
                ${guardias.length > 1 || (puesto.rotacionCompleta && puesto.rotacionCompleta.length > 1)
                    ? `<div style="border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                           <p style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">Personal asignado al puesto</p>
                           ${guardiasPopup}
                       </div>`
                    : guardiasPopup}
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;padding-bottom:6px;">
                    <span style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Armado</span>
                    <span style="font-size:11px;font-weight:800;color:${puesto.armado?'#dc2626':'#16a34a'};">${puesto.armado ? '✅ SÍ · '+(puesto.arma||'') : '❌ NO'}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;padding-bottom:6px;">
                    <span style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Radio</span>
                    <span style="font-size:11px;font-weight:800;color:#1e293b;">${puesto.radio ? '📻 '+(puesto.radio_info||'Sí') : '— No'}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Días</span>
                    <span style="font-size:11px;font-weight:800;color:#1e293b;">📅 ${puesto.dias}</span>
                </div>
                ${puesto.obs ? `<div style="margin-top:4px;padding:6px 8px;background:#f8fafc;border-radius:8px;font-size:9px;color:#64748b;">${puesto.obs}</div>` : ''}
                ${guiasHTML}
                <a href="https://www.google.com/maps/search/?api=1&query=${puesto.lat},${puesto.lng}"
                   target="_blank" rel="noopener"
                   style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;padding:7px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-size:10px;font-weight:800;">
                    📍 Ver en Google Maps
                </a>
            </div>
        </div>`;

    marker.bindPopup(popup, { maxWidth:300, minWidth:240 });
    marker._puestoData = puesto;   // ← necesario para que los filtros funcionen
    if (abrirPopup) marker.openPopup();
    marcadoresMapa.push(marker);
    return marker;
}

// Toggle: mostrar / ocultar todos los puestos
function toggleTodosPuestos() {
    if (mostrandoTodos) {
        // Ocultar todos
        limpiarMarcadores();
        mostrandoTodos = false;
        document.querySelectorAll('.puesto-card').forEach(c => c.classList.remove('active'));
    } else {
        // Mostrar todos
        limpiarMarcadores();
        puestosActuales.forEach((puesto, i) => colocarMarcador(puesto, false));
        mostrandoTodos = true;
        // Fitear mapa para ver todos
        if (puestosActuales.length > 0) {
            const bounds = L.latLngBounds(puestosActuales.map(p => [p.lat, p.lng]));
            provMap.fitBounds(bounds, { padding: [50, 50] });
        }
    }
    actualizarBotonTodos();
}

function actualizarBotonTodos() {
    const btn = document.getElementById('btn-todos-puestos');
    if (!btn) return;
    const hay = puestosActuales.length > 0;
    btn.style.display = hay ? 'flex' : 'none';
    btn.innerHTML = mostrandoTodos
        ? `<span>🙈</span><span>Ocultar todos</span>`
        : `<span>🗺️</span><span>Ver todos (${puestosActuales.length})</span>`;
    btn.className = mostrandoTodos
        ? 'flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl transition-colors w-full justify-center bg-slate-200 hover:bg-slate-300 text-slate-700'
        : 'flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl transition-colors w-full justify-center bg-blue-600 hover:bg-blue-700 text-white';
}

// Estado del toggle "ver todos de la provincia" (todas las proyectos a la vez)
let mostrandoTodosProvincia = false;

// Ver/ocultar TODOS los puestos de TODOS los proyectos de la provincia actual
function toggleTodosPuestosProvincia() {
    const btn = document.getElementById('btn-todos-provincia');

    if (mostrandoTodosProvincia) {
        limpiarMarcadores();
        mostrandoTodosProvincia = false;
        mostrandoTodos = false;
        document.querySelectorAll('.acord-header').forEach(h => h.classList.remove('active'));
        document.querySelectorAll('.acord-body').forEach(b => b.classList.remove('open'));
        if (btn) {
            btn.innerHTML = '🗺️ Ver todos los puestos de la provincia';
            btn.className = 'w-full flex items-center justify-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl transition-colors bg-indigo-600 hover:bg-indigo-700 text-white mb-3';
        }
        return;
    }

    limpiarMarcadores();
    const todosLosPuestos = Object.values(puestosData[provinciaActual] || {}).flat();

    if (todosLosPuestos.length === 0) {
        alert('No hay puestos con coordenadas registradas en esta provincia todavía.');
        return;
    }

    todosLosPuestos.forEach(puesto => colocarMarcador(puesto, false));
    mostrandoTodosProvincia = true;

    const bounds = L.latLngBounds(todosLosPuestos.map(p => [p.lat, p.lng]));
    provMap.fitBounds(bounds, { padding: [50, 50] });

    if (btn) {
        btn.innerHTML = `🙈 Ocultar todos (${todosLosPuestos.length})`;
        btn.className = 'w-full flex items-center justify-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl transition-colors bg-slate-700 hover:bg-slate-800 text-white mb-3';
    }
}

// =====================================================================
// CAPTURA DEL MAPA REAL (con calles) usando html2canvas
// Muestra los pines necesarios, espera a que carguen los tiles, y toma
// una foto real del mapa Leaflet. Si algo falla (ej. CORS del servidor
// de mapas), devuelve null y el PDF usa el mapa esquemático como respaldo.
// =====================================================================
async function capturarMapaLeaflet(puestosAMostrar) {
    if (!provMap || typeof html2canvas === 'undefined') return null;
    if (!puestosAMostrar || puestosAMostrar.length === 0) return null;

    try {
        limpiarMarcadores();
        puestosAMostrar.forEach(p => colocarMarcador(p, false));

        const bounds = L.latLngBounds(puestosAMostrar.map(p => [p.lat, p.lng]));
        provMap.fitBounds(bounds, { padding: [40, 40] });

        // Esperar a que el mapa se reajuste y los tiles nuevos terminen de cargar
        await new Promise(resolve => {
            provMap.once('moveend', () => setTimeout(resolve, 900));
            setTimeout(resolve, 1400); // respaldo por si moveend no dispara
        });

        const mapEl = document.getElementById('prov-map');
        const canvas = await html2canvas(mapEl, {
            useCORS: true,
            allowTaint: false,
            logging: false,
            scale: 2
        });

        return canvas.toDataURL('image/jpeg', 0.92);
    } catch (e) {
        console.warn('⚠️ No se pudo capturar el mapa real, se usará el mapa esquemático:', e.message);
        return null;
    }
}

function limpiarMarcadores() {
    marcadoresMapa.forEach(m => provMap.removeLayer(m));
    marcadoresMapa = [];
}

// =====================================================================
// FILTROS DE ESTADO
// =====================================================================

function aplicarFiltro(tipo) {
    filtroActivo = tipo;

    // Actualizar estilo de botones
    ['todos','armado','desarmado','radio'].forEach(t => {
        const btn = document.getElementById(`f-${t}`);
        if (!btn) return;
        btn.className = tipo === t ? `filtro-btn on-${t}` : 'filtro-btn';
    });

    // Aplicar / quitar atenuado en marcadores
    marcadoresMapa.forEach(marker => {
        const puesto = marker._puestoData;
        if (!puesto) return;
        let visible = true;
        if (tipo === 'armado')    visible = puesto.armado === true || puesto.armado === 'Si';
        if (tipo === 'desarmado') visible = !(puesto.armado === true || puesto.armado === 'Si');
        if (tipo === 'radio')     visible = puesto.radio === true || puesto.radio === 'Si';
        const el = marker.getElement();
        if (el) {
            el.style.opacity      = visible ? '1' : '0.12';
            el.style.pointerEvents = visible ? '' : 'none';
        }
    });

    // Contador de visibles
    const total    = marcadoresMapa.length;
    if (total === 0) return;
    const visibles = marcadoresMapa.filter(m => {
        const p = m._puestoData;
        if (!p || tipo === 'todos') return true;
        if (tipo === 'armado')    return p.armado === true || p.armado === 'Si';
        if (tipo === 'desarmado') return !(p.armado === true || p.armado === 'Si');
        if (tipo === 'radio')     return p.radio === true  || p.radio  === 'Si';
    }).length;

    // Insertar/actualizar contador junto al botón PDF
    let counter = document.getElementById('filtro-counter');
    if (!counter) {
        counter = document.createElement('span');
        counter.id = 'filtro-counter';
        counter.style.cssText = 'font-size:9px;color:#94a3b8;font-weight:700;margin-left:2px;';
        const pdfBtn = document.querySelector('.pdf-btn');
        if (pdfBtn) pdfBtn.parentNode.insertBefore(counter, pdfBtn);
    }
    counter.textContent = tipo !== 'todos' ? `${visibles} de ${total}` : '';
}

// =====================================================================
// EXPORTAR PDF
// =====================================================================
// =====================================================================
// HELPERS DE REPORTES PDF — membrete con márgenes de 2.5cm, mapa esquemático
// =====================================================================
const MARGEN_PDF = 25; // 2.5 cm en mm (header y footer)

// Dibuja el membrete (encabezado 2.5cm) y el pie de página (2.5cm) en la página actual
function dibujarMembretePDF(doc, subtitulo, fechaHoy) {
    const W = 210, H = 297;
    const DARK = [15,15,15], ORANGE = [245,158,11];
    const LOGO_B64 = window._LOGO_B64 || '';

    // ── Encabezado (0 a 25mm) ──
    doc.setFillColor(209,213,219);
    doc.rect(0, 0, W, MARGEN_PDF, 'F');
    doc.setFillColor(...DARK);
    doc.triangle(60, MARGEN_PDF, W, 5, W, MARGEN_PDF, 'F');
    try { doc.addImage(LOGO_B64, 'PNG', W-34, 5, 22, 16); } catch(e) {}
    doc.setTextColor(30,30,30);
    doc.setFontSize(12); doc.setFont('helvetica','bold');
    doc.text('DEFEN CIA. LTDA.', 8, 12);
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105);
    doc.text(subtitulo, 8, 18);
    doc.setFontSize(6.5);
    doc.text(`Generado: ${fechaHoy}`, 8, 23);

    // ── Pie de página (últimos 25mm) ──
    const yFooter = H - MARGEN_PDF;
    doc.setDrawColor(...ORANGE); doc.setLineWidth(0.8);
    doc.line(14, yFooter + 4, W-14, yFooter + 4);
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105);
    doc.text('Dirección: Cdla. Álamos II Mz K Solar 09', W/2, yFooter + 9, {align:'center'});
    doc.text('Correo Electrónico: info@defen.com.ec  ·  Guayaquil - Ecuador', W/2, yFooter + 14, {align:'center'});
}

// Paleta de colores por índice de proyecto (para el mapa esquemático)
const PALETA_PROYECTOS = [
    [37,99,235], [22,163,74], [220,38,38], [217,119,6],
    [124,58,237], [219,39,119], [8,145,178], [101,63,241]
];

// Dibuja un "mapa esquemático" con los puestos ubicados según lat/lng real,
// coloreados por proyecto. No requiere internet ni depende de CORS — siempre funciona.
function dibujarMapaEsquematico(doc, y, puestosPorProyecto, W) {
    const alturaBox = 90;
    const xBox = 14, wBox = W - 28;

    doc.setFillColor(248,250,252);
    doc.roundedRect(xBox, y, wBox, alturaBox, 3, 3, 'F');
    doc.setDrawColor(226,232,240); doc.setLineWidth(0.3);
    doc.roundedRect(xBox, y, wBox, alturaBox, 3, 3, 'S');

    // Recolectar todos los puestos con coordenadas válidas
    const todos = [];
    Object.entries(puestosPorProyecto).forEach(([nombreProy, lista], idx) => {
        lista.forEach(p => {
            if (p.lat && p.lng) todos.push({ ...p, _proyIdx: idx % PALETA_PROYECTOS.length, _proyNombre: nombreProy });
        });
    });

    if (todos.length === 0) {
        doc.setFontSize(9); doc.setTextColor(148,163,184); doc.setFont('helvetica','italic');
        doc.text('Sin puestos con coordenadas registradas para graficar.', W/2, y + alturaBox/2, {align:'center'});
        return y + alturaBox + 8;
    }

    const lats = todos.map(p => p.lat), lngs = todos.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const padLat = (maxLat - minLat) * 0.15 || 0.01;
    const padLng = (maxLng - minLng) * 0.15 || 0.01;

    const areaX = xBox + 8, areaW = wBox - 16;
    const areaY = y + 8,   areaH = alturaBox - 16;

    const proyectar = (lat, lng) => {
        const px = areaX + ((lng - (minLng-padLng)) / ((maxLng+padLng) - (minLng-padLng))) * areaW;
        const py = areaY + areaH - ((lat - (minLat-padLat)) / ((maxLat+padLat) - (minLat-padLat))) * areaH;
        return [px, py];
    };

    todos.forEach(p => {
        const [px, py] = proyectar(p.lat, p.lng);
        const col = PALETA_PROYECTOS[p._proyIdx];
        doc.setFillColor(...col);
        doc.circle(px, py, 1.6, 'F');
        doc.setDrawColor(255,255,255); doc.setLineWidth(0.3);
        doc.circle(px, py, 1.6, 'S');
    });

    // Leyenda de proyectos (colores) debajo del recuadro
    const nombresProy = Object.keys(puestosPorProyecto);
    let legY = y + alturaBox + 6;
    let legX = xBox;
    doc.setFontSize(6.5); doc.setFont('helvetica','normal');
    nombresProy.forEach((nom, idx) => {
        const col = PALETA_PROYECTOS[idx % PALETA_PROYECTOS.length];
        if (legX > xBox + wBox - 50) { legX = xBox; legY += 5; }
        doc.setFillColor(...col);
        doc.circle(legX + 1.5, legY - 1.2, 1.4, 'F');
        doc.setTextColor(71,85,105);
        const texto = nom.length > 24 ? nom.slice(0,22)+'…' : nom;
        doc.text(texto, legX + 4.5, legY);
        legX += 50;
    });

    return legY + 6;
}

// =====================================================================
// REPORTE POR PROVINCIA — Resumen → Proyectos → Puestos → Mapa esquemático
// =====================================================================
async function exportarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const prov     = provinciaActual || document.getElementById('prov-nombre').textContent;
    const detalle  = detalleProvincias[prov] || {};
    const hoy      = new Date();
    const fechaHoy = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;
    const W = 210, H = 297;

    const DARK  = [15,23,42], GREEN = [22,163,74], RED = [220,38,38], GRAY = [241,245,249];

    dibujarMembretePDF(doc, `Reporte Operativo de Provincia — ${prov}`, fechaHoy);
    const didDrawPageProv = () => dibujarMembretePDF(doc, `Reporte Operativo de Provincia — ${prov}`, fechaHoy);

    let y = MARGEN_PDF + 8;

    // ── 1. RESUMEN ────────────────────────────────────────────
    doc.setTextColor(...DARK); doc.setFontSize(15); doc.setFont('helvetica','bold');
    doc.text(prov, 14, y); y += 8;

    doc.setFillColor(...GRAY);
    doc.roundedRect(14, y, W-28, 22, 3, 3, 'F');
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139);
    doc.text('N° TRÁMITE', 20, y+5);
    doc.text('VIGENCIA', 85, y+5);
    doc.text('ESTADO', 155, y+5);
    doc.setTextColor(...DARK); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text(detalle.tramite || 'Sin registro', 20, y+12);

    if (detalle.vigenciaInicio && detalle.vigenciaFin) {
        const dias = Math.round((new Date(detalle.vigenciaFin) - hoy) / 86400000);
        doc.text(`${formatFecha(detalle.vigenciaInicio)} → ${formatFecha(detalle.vigenciaFin)}`, 85, y+12);
        doc.setFontSize(8);
        doc.setTextColor(dias < 0 ? RED[0] : dias < 90 ? 161 : GREEN[0],
                         dias < 0 ? RED[1] : dias < 90 ? 98  : GREEN[1],
                         dias < 0 ? RED[2] : dias < 90 ? 7   : GREEN[2]);
        doc.text(`${dias < 0 ? 'VENCIDA' : dias + ' días restantes'}`, 85, y+18);
        doc.setTextColor(...DARK);
    } else {
        doc.setFontSize(9);
        doc.text(detalle.estadoTramite || '—', 85, y+12);
    }
    doc.setFontSize(9);
    const provInfo = data[prov] || {};
    doc.text(provInfo.estado || '—', 155, y+12);
    y += 28;

    if (detalle.supervisores && detalle.supervisores.length > 0) {
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139);
        doc.text('SUPERVISOR(ES) DE PROVINCIA', 14, y);
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(...DARK);
        doc.text(detalle.supervisores.join('  ·  '), 14, y+5);
        y += 12;
    }

    // ── Aplicar filtros globales activos a todo el reporte ──
    const todosNeutros  = Object.values(filtrosActivos).every(v => v === 'todos');
    const totFiltrados  = calcTotalesFiltrados(prov);
    const proyectosList = todosNeutros ? (detalle.proyectosList || []) : totFiltrados.proyectosList;

    if (!todosNeutros) {
        const chips = [];
        if (filtrosActivos.jornada  !== 'todos') chips.push(`Jornada: ${filtrosActivos.jornada}`);
        if (filtrosActivos.arma     !== 'todos') chips.push(`Arma: ${filtrosActivos.arma}`);
        if (filtrosActivos.radio    !== 'todos') chips.push(`Radio: ${filtrosActivos.radio}`);
        if (filtrosActivos.vence    !== 'todos') chips.push(`Vencimiento: ${filtrosActivos.vence}`);
        if (filtrosActivos.contrato !== 'todos') chips.push(`Contrato: ${filtrosActivos.contrato}`);
        doc.setFillColor(254,243,199);
        doc.roundedRect(14, y, W-28, 8, 2, 2, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(146,64,14);
        doc.text(`FILTROS ACTIVOS: ${chips.join('  ·  ')}`, 18, y+5.3);
        y += 12;
    }

    // ── 2. PROYECTOS (resumen de todos los que pasan el filtro) ──
    if (proyectosList.length > 0) {
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text(`PROYECTOS ACTIVOS (${proyectosList.length})`, 14, y); y += 5;

        doc.autoTable({
            startY: y,
            margin: { left:14, right:14, top:MARGEN_PDF+4, bottom:MARGEN_PDF+4 },
            didDrawPage: didDrawPageProv,
            headStyles: { fillColor:DARK, textColor:[255,255,255], fontSize:7.5, fontStyle:'bold', cellPadding:2.5 },
            head: [['Proyecto','Guardia(s)','Arma(s)','Puesto(s)','Finaliza','Supervisor(es)']],
            body: proyectosList.map(p => {
                const dias = p.fin ? Math.round((new Date(p.fin) - hoy)/86400000) : null;
                return [
                    p.nombre,
                    String(p.guardias),
                    String(p.armas),
                    String(p.puestos ?? '—'),
                    p.fin ? `${formatFecha(p.fin)}${dias!==null ? ' ('+(dias<0?'VENCIDO':dias+'d')+')' : ''}` : '—',
                    (p.supervisores && p.supervisores.length) ? p.supervisores.join(', ') : '—'
                ];
            }),
            styles: { fontSize:7.5, cellPadding:2.5, lineColor:[226,232,240], lineWidth:0.3 },
            alternateRowStyles: { fillColor:[248,250,252] },
            columnStyles: { 0:{fontStyle:'bold', cellWidth:38}, 1:{halign:'center',cellWidth:18}, 2:{halign:'center',cellWidth:16}, 3:{halign:'center',cellWidth:18} }
        });
        y = doc.lastAutoTable.finalY + 8;
    } else if (!todosNeutros) {
        doc.setFontSize(9); doc.setTextColor(148,163,184); doc.setFont('helvetica','italic');
        doc.text('Ningún proyecto de esta provincia cumple los filtros activos.', 14, y);
        y += 10;
    }

    // ── 3. DETALLE POR PUESTO — separado primero por proyecto, respetando filtros ──
    const puestosPorProyectoFiltrados = {};
    proyectosList.forEach(p => {
        const lista = puestosFiltrados(prov, p.nombre);
        if (lista.length > 0) puestosPorProyectoFiltrados[p.nombre] = lista;
    });

    if (Object.keys(puestosPorProyectoFiltrados).length > 0) {
        if (y > 240) { doc.addPage(); dibujarMembretePDF(doc, `Reporte Operativo de Provincia — ${prov}`, fechaHoy); y = MARGEN_PDF + 8; }
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('DETALLE POR PUESTO', 14, y); y += 7;

        proyectosList.forEach(p => {
            const puestos = puestosPorProyectoFiltrados[p.nombre] || [];
            if (puestos.length === 0) return;

            if (y > 250) { doc.addPage(); dibujarMembretePDF(doc, `Reporte Operativo de Provincia — ${prov}`, fechaHoy); y = MARGEN_PDF + 8; }

            // Nombre del proyecto como separador
            doc.setFillColor(...DARK);
            doc.roundedRect(14, y, W-28, 8, 2, 2, 'F');
            doc.setTextColor(255,255,255); doc.setFontSize(9.5); doc.setFont('helvetica','bold');
            doc.text(`${p.nombre}  ·  ${puestos.length} puesto(s)`, 18, y+5.5);
            y += 12;

            doc.autoTable({
                startY: y,
                margin: { left:14, right:14, top:MARGEN_PDF+4, bottom:MARGEN_PDF+4 },
                didDrawPage: didDrawPageProv,
                headStyles: { fillColor:[71,85,105], textColor:[255,255,255], fontSize:7, cellPadding:2.5 },
                head: [['Puesto','Guardia(s)','Tipo','Armado','Arma (serie)','Radio','Turno/Días']],
                body: puestos.map(pu => {
                    const gs = Array.isArray(pu.guardias) ? pu.guardias : (pu.guardia||'').split(',').map(g=>g.trim()).filter(Boolean);
                    return [
                        pu.nombre,
                        gs.join('\n'),
                        pu.tipo || '—',
                        pu.armado ? 'Sí' : 'No',
                        pu.armado ? (pu.arma || '—') : '—',
                        pu.radio ? (pu.radio_info || 'Sí') : 'No',
                        `${pu.turno||'—'}\n${pu.dias||''}`
                    ];
                }),
                styles: { fontSize:7, cellPadding:2.2, overflow:'linebreak', lineColor:[226,232,240], lineWidth:0.3 },
                alternateRowStyles: { fillColor:[248,250,252] },
                columnStyles: { 0:{cellWidth:28,fontStyle:'bold'}, 3:{halign:'center'}, 5:{cellWidth:26} }
            });
            y = doc.lastAutoTable.finalY + 9;
        });
    }

    // ── 4. MAPA CON LOS PUESTOS QUE CUMPLEN EL FILTRO (real con calles; esquemático como respaldo) ──
    const todosLosPuestosMapa = [];
    Object.values(puestosPorProyectoFiltrados).forEach(lista => todosLosPuestosMapa.push(...lista));

    if (todosLosPuestosMapa.length > 0) {
        if (y > 170) { doc.addPage(); dibujarMembretePDF(doc, `Reporte Operativo de Provincia — ${prov}`, fechaHoy); y = MARGEN_PDF + 8; }
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text(todosNeutros ? 'MAPA DE PUESTOS ACTIVOS' : 'MAPA DE PUESTOS (según filtro activo)', 14, y); y += 5;

        const imgMapa = await capturarMapaLeaflet(todosLosPuestosMapa);
        if (imgMapa) {
            const altoImg = 100;
            doc.addImage(imgMapa, 'JPEG', 14, y, W-28, altoImg);
            doc.setDrawColor(226,232,240); doc.setLineWidth(0.3);
            doc.rect(14, y, W-28, altoImg, 'S');
            y += altoImg + 6;
        } else {
            dibujarMapaEsquematico(doc, y, puestosPorProyectoFiltrados, W);
        }
    }

    // ── Numeración de páginas ──
    const totalPag = doc.getNumberOfPages();
    for (let i = 1; i <= totalPag; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5); doc.setTextColor(120,113,108);
        doc.text(`Página ${i} de ${totalPag}`, W-14, H-MARGEN_PDF+20, { align:'right' });
        doc.text('Documento confidencial · Uso interno', 14, H-MARGEN_PDF+20);
    }

    doc.save(`Reporte_${prov}_${fechaHoy.replace(/\//g,'-')}.pdf`);
}

// =====================================================================
// REPORTE POR PROYECTO/PUESTO — Resumen → Agentes/Armas/Radios/Puestos → Mapa
// =====================================================================
async function exportarPDFProyecto(nombreProyecto) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const prov     = provinciaActual;
    const detalle  = detalleProvincias[prov] || {};
    const proyecto = (detalle.proyectosList || []).find(p => p.nombre === nombreProyecto);
    const hoy      = new Date();
    const fechaHoy = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;
    const W = 210, H = 297;
    const DARK = [15,23,42], GREEN = [22,163,74], RED = [220,38,38], GRAY = [241,245,249];

    const subt = `Reporte de Proyecto — ${nombreProyecto}`;
    dibujarMembretePDF(doc, subt, fechaHoy);
    const didDrawPageProy = () => dibujarMembretePDF(doc, subt, fechaHoy);

    let y = MARGEN_PDF + 8;

    // ── 1. RESUMEN DEL PROYECTO ──
    doc.setTextColor(...DARK); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text(nombreProyecto, 14, y); y += 3;
    doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    doc.text(`${prov}`, 14, y+4); y += 10;

    const puestosTodos = (puestosData[prov] || {})[nombreProyecto] || [];
    const puestos       = puestosFiltrados(prov, nombreProyecto);
    const hayFiltroPuesto = filtrosActivos.jornada !== 'todos' || filtrosActivos.arma !== 'todos' || filtrosActivos.radio !== 'todos';
    const dias    = proyecto && proyecto.fin ? Math.round((new Date(proyecto.fin) - hoy)/86400000) : null;

    if (hayFiltroPuesto) {
        const chips = [];
        if (filtrosActivos.jornada !== 'todos') chips.push(`Jornada: ${filtrosActivos.jornada}`);
        if (filtrosActivos.arma    !== 'todos') chips.push(`Arma: ${filtrosActivos.arma}`);
        if (filtrosActivos.radio   !== 'todos') chips.push(`Radio: ${filtrosActivos.radio}`);
        doc.setFillColor(254,243,199);
        doc.roundedRect(14, y, W-28, 8, 2, 2, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(146,64,14);
        doc.text(`FILTROS ACTIVOS: ${chips.join('  ·  ')}  (mostrando ${puestos.length} de ${puestosTodos.length} puesto(s))`, 18, y+5.3);
        y += 12;
    }

    doc.setFillColor(...GRAY);
    doc.roundedRect(14, y, W-28, 22, 3, 3, 'F');
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139);
    doc.text('GUARDIA(S)', 20, y+5);
    doc.text('ARMA(S)', 65, y+5);
    doc.text('PUESTO(S)', 105, y+5);
    doc.text('FINALIZA', 150, y+5);
    doc.setTextColor(...DARK); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(String(proyecto?.guardias ?? '—'), 20, y+14);
    doc.text(String(proyecto?.armas ?? '—'), 65, y+14);
    doc.text(String(puestos.length), 105, y+14);
    doc.setFontSize(8.5);
    doc.setTextColor(dias===null ? 100 : dias<0?RED[0]:dias<=30?RED[0]:dias<=60?217:GREEN[0],
                     dias===null ? 116 : dias<0?RED[1]:dias<=30?RED[1]:dias<=60?119:GREEN[1],
                     dias===null ? 139 : dias<0?RED[2]:dias<=30?RED[2]:dias<=60?6:GREEN[2]);
    doc.text(proyecto?.fin ? `${formatFecha(proyecto.fin)} (${dias<0?'VENCIDO':dias+'d'})` : '—', 150, y+13);
    y += 28;

    if (proyecto?.supervisores && proyecto.supervisores.length > 0) {
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139);
        doc.text('SUPERVISOR(ES)', 14, y);
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(...DARK);
        doc.text(proyecto.supervisores.join('  ·  '), 14, y+5);
        y += 12;
    }

    // ── 2. DETALLE: AGENTES, ARMAS, RADIOS, PUESTOS ──
    if (puestos.length > 0) {
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text(`AGENTES · ARMAS · RADIOS · PUESTOS (${puestos.length})`, 14, y); y += 5;

        doc.autoTable({
            startY: y,
            margin: { left:14, right:14, top:MARGEN_PDF+4, bottom:MARGEN_PDF+4 },
            didDrawPage: didDrawPageProy,
            headStyles: { fillColor:DARK, textColor:[255,255,255], fontSize:7, cellPadding:2.5 },
            head: [['Puesto','Guardia(s)','Tipo','Armado','Arma (serie)','Radio','Turno/Días']],
            body: puestos.map(pu => {
                const gs = Array.isArray(pu.guardias) ? pu.guardias : (pu.guardia||'').split(',').map(g=>g.trim()).filter(Boolean);
                return [
                    pu.nombre,
                    gs.join('\n'),
                    pu.tipo || '—',
                    pu.armado ? 'Sí' : 'No',
                    pu.armado ? (pu.arma || '—') : '—',
                    pu.radio ? (pu.radio_info || 'Sí') : 'No',
                    `${pu.turno||'—'}\n${pu.dias||''}`
                ];
            }),
            styles: { fontSize:7, cellPadding:2.2, overflow:'linebreak', lineColor:[226,232,240], lineWidth:0.3 },
            alternateRowStyles: { fillColor:[248,250,252] },
            columnStyles: { 0:{cellWidth:28,fontStyle:'bold'}, 3:{halign:'center'}, 5:{cellWidth:26} }
        });
        y = doc.lastAutoTable.finalY + 10;
    } else {
        doc.setFontSize(9); doc.setTextColor(148,163,184); doc.setFont('helvetica','italic');
        doc.text('Este proyecto aún no tiene puestos con coordenadas registradas.', 14, y);
        y += 10;
    }

    // ── 3. MAPA DE PUESTOS DEL PROYECTO (real con calles; esquemático como respaldo) ──
    if (puestos.length > 0) {
        if (y > 170) { doc.addPage(); dibujarMembretePDF(doc, subt, fechaHoy); y = MARGEN_PDF + 8; }
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('MAPA DE PUESTOS DEL PROYECTO', 14, y); y += 5;

        const imgMapa = await capturarMapaLeaflet(puestos);
        if (imgMapa) {
            const altoImg = 100;
            doc.addImage(imgMapa, 'JPEG', 14, y, W-28, altoImg);
            doc.setDrawColor(226,232,240); doc.setLineWidth(0.3);
            doc.rect(14, y, W-28, altoImg, 'S');
            y += altoImg + 6;
        } else {
            dibujarMapaEsquematico(doc, y, { [nombreProyecto]: puestos }, W);
        }
    }

    // ── Numeración de páginas ──
    const totalPag = doc.getNumberOfPages();
    for (let i = 1; i <= totalPag; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5); doc.setTextColor(120,113,108);
        doc.text(`Página ${i} de ${totalPag}`, W-14, H-MARGEN_PDF+20, { align:'right' });
        doc.text('Documento confidencial · Uso interno', 14, H-MARGEN_PDF+20);
    }

    doc.save(`Reporte_${nombreProyecto.replace(/[^\w]+/g,'_')}_${fechaHoy.replace(/\//g,'-')}.pdf`);
}

function cerrarVistaProvincia() {
    document.getElementById('prov-modal').classList.remove('open');
    limpiarMarcadores();
    if (provMap) { provMap.remove(); provMap = null; }
    filtroActivo = 'todos';
    ['todos','armado','desarmado','radio'].forEach(t => {
        const b = document.getElementById(`f-${t}`);
        if (b) b.className = `filtro-btn${t==='todos' ? ' on-todos' : ''}`;
    });
}

// Cerrar con Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        cerrarVistaProvincia();
        if (document.getElementById('panel-filtros-global').classList.contains('open'))
            togglePanelFiltros();
    }
});

// =====================================================================
