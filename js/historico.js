// ================================================================
// historico.js — Proyectos Finalizados (archivo histórico)
// Nunca se mezcla con los datos activos: es una sección aparte,
// alimentada por la "fotografía congelada" que se guarda al
// archivar un proyecto desde el mapa activo.
// ================================================================

let filtroHistoricoProvincia = [];

function abrirModalHistorico() {
    filtroHistoricoProvincia = [];
    document.getElementById('historico-modal').style.display = 'flex';
    renderFiltrosHistorico();
    renderListaHistorico();
}

function cerrarModalHistorico() {
    document.getElementById('historico-modal').style.display = 'none';
}

function renderFiltrosHistorico() {
    const bar = document.getElementById('historico-filtros-bar');
    const provincias = [...new Set(historicoProyectos.map(h => h.provincia).filter(Boolean))].sort();

    if (provincias.length === 0) {
        bar.innerHTML = '';
        return;
    }
    bar.innerHTML = `
        <span style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin-right:2px;">Provincia:</span>
        <button onclick="toggleFiltroHistorico('todos')" class="chip${filtroHistoricoProvincia.length===0?' active-amber':''}" style="font-size:9px;padding:3px 9px;">◉ Todas</button>
        ${provincias.map(p => {
            const activo = filtroHistoricoProvincia.includes(p);
            return `<button onclick="toggleFiltroHistorico('${p.replace(/'/g,"\\'")}')" class="chip${activo?' active-amber':''}" style="font-size:9px;padding:3px 9px;">${p}</button>`;
        }).join('')}
    `;
}

function toggleFiltroHistorico(valor) {
    if (valor === 'todos') {
        filtroHistoricoProvincia = [];
    } else {
        const idx = filtroHistoricoProvincia.indexOf(valor);
        if (idx > -1) filtroHistoricoProvincia.splice(idx, 1);
        else filtroHistoricoProvincia.push(valor);
    }
    renderFiltrosHistorico();
    renderListaHistorico();
}

function renderListaHistorico() {
    const cont = document.getElementById('historico-lista');
    const filtrados = historicoProyectos.filter(h =>
        filtroHistoricoProvincia.length === 0 || filtroHistoricoProvincia.includes(h.provincia)
    );

    document.getElementById('historico-modal-contador').textContent =
        `${filtrados.length} de ${historicoProyectos.length} proyecto(s) finalizado(s)`;

    if (filtrados.length === 0) {
        cont.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8;">
            <p style="font-size:32px;margin-bottom:8px;">📁</p>
            <p style="font-size:13px;font-weight:700;">Todavía no hay proyectos archivados</p>
            <p style="font-size:11px;margin-top:4px;">Cuando termines un proyecto, archívalo desde el mapa activo y aparecerá aquí con su historial completo.</p>
        </div>`;
        return;
    }

    // Agrupar por provincia
    const porProvincia = {};
    filtrados.forEach(h => {
        if (!porProvincia[h.provincia]) porProvincia[h.provincia] = [];
        porProvincia[h.provincia].push(h);
    });

    cont.innerHTML = Object.keys(porProvincia).sort().map(prov => `
        <div>
            <p style="font-size:11px;font-weight:900;color:#78350f;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">📍 ${prov}</p>
            <div style="display:flex;flex-direction:column;gap:6px;">
                ${porProvincia[prov].map((h, i) => {
                    const idx = historicoProyectos.indexOf(h);
                    return `
                    <div onclick="verDetalleHistorico(${idx})" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 14px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='#fef3c7'" onmouseout="this.style.background='#fffbeb'">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:12px;font-weight:800;color:#78350f;">${h.proyecto}</span>
                            <span style="font-size:9px;font-weight:700;color:#b45309;">Archivado: ${formatFecha(h.fechaArchivado)}</span>
                        </div>
                        <div style="display:flex;gap:12px;margin-top:4px;font-size:10px;color:#92400e;font-weight:600;">
                            <span>👮 ${h.snapshot.guardias} guardia(s)</span>
                            <span>🔫 ${h.snapshot.armas} arma(s)</span>
                            <span>📻 ${h.snapshot.radios} radio(s)</span>
                            <span>🏢 ${(h.snapshot.puestos||[]).length} puesto(s)</span>
                            ${h.finReal ? `<span>📅 Finalizó: ${formatFecha(h.finReal)}</span>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `).join('');
}

function verDetalleHistorico(idx) {
    const h = historicoProyectos[idx];
    if (!h) return;

    document.getElementById('historico-detalle-titulo').textContent = h.proyecto;
    document.getElementById('historico-detalle-subtitulo').textContent =
        `${h.provincia} · Archivado el ${formatFecha(h.fechaArchivado)}${h.supervisores.length ? ' · Supervisor(es): '+h.supervisores.join(', ') : ''}`;

    const puestos = h.snapshot.puestos || [];
    const cuerpo = document.getElementById('historico-detalle-cuerpo');

    if (puestos.length === 0) {
        cuerpo.innerHTML = `<p style="text-align:center;color:#94a3b8;font-size:12px;padding:20px;">Este proyecto no tenía puestos con detalle registrado al momento de archivarse.</p>`;
    } else {
        cuerpo.innerHTML = puestos.map(pu => {
            const tieneCoords = pu.lat && pu.lng;
            const armasDet = pu.armasDetalle || [];
            const radiosDet = pu.radiosDetalle || [];
            return `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;">
                <div style="display:flex;items-center;justify-content:space-between;gap:8px;">
                    <p style="font-size:12px;font-weight:800;color:#1e293b;margin-bottom:4px;">${pu.nombre}</p>
                    ${tieneCoords ? `<a href="https://www.google.com/maps/search/?api=1&query=${pu.lat},${pu.lng}" target="_blank" rel="noopener" style="font-size:9px;font-weight:800;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:999px;text-decoration:none;white-space:nowrap;">📍 Ver ubicación</a>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:6px;">
                    ${(pu.guardias||[]).length > 0
                        ? pu.guardias.map(g => `<span style="font-size:10px;color:#475569;font-weight:600;">👤 ${g}</span>`).join('')
                        : `<span style="font-size:10px;color:#94a3b8;font-style:italic;">Sin agentes registrados</span>`}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                    <span style="font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;background:#dbeafe;color:#1d4ed8;">${pu.tipo || '—'}</span>
                    ${!pu.armado ? `<span style="font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#64748b;">Sin arma</span>` : ''}
                    ${!pu.radio ? `<span style="font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#64748b;">Sin radio</span>` : ''}
                </div>
                ${armasDet.length > 0 ? `
                <div style="margin-bottom:4px;">
                    ${armasDet.map(a => `
                        <div style="font-size:9px;background:#fee2e2;color:#991b1b;border-radius:8px;padding:4px 8px;margin-bottom:3px;">
                            🔫 <strong>${a.tipo||'—'}</strong> ${a.marca||''} ${a.calibre||''} · Serie: ${a.serie||'—'} · ${a.clase||'—'}
                        </div>
                    `).join('')}
                </div>` : ''}
                ${radiosDet.length > 0 ? `
                <div>
                    ${radiosDet.map(r => `
                        <div style="font-size:9px;background:#ede9fe;color:#6d28d9;border-radius:8px;padding:4px 8px;margin-bottom:3px;">
                            📻 <strong>${r.modelo||'—'}</strong> · Serie: ${r.serie||'—'}
                        </div>
                    `).join('')}
                </div>` : ''}
            </div>`;
        }).join('');
    }

    document.getElementById('historico-detalle-modal').style.display = 'flex';
}

function cerrarDetalleHistorico() {
    document.getElementById('historico-detalle-modal').style.display = 'none';
}

// =====================================================================
// ARCHIVAR UN PROYECTO ACTIVO — congela su fotografía y lo mueve al
// histórico. Se llama desde los botones "🗄️ Archivar" de los proyectos
// activos (panel del mapa y acordeón de provincia).
// =====================================================================
async function archivarProyectoActivo(provincia, nombreProyecto) {
    if (typeof rolActual === 'function' && rolActual() !== 'admin') {
        alert('Solo el usuario Administrador puede archivar proyectos.');
        return;
    }
    const confirmar = confirm(
        `¿Archivar "${nombreProyecto}"?\n\n` +
        `Esto congelará una fotografía de sus guardias, armas, radios y puestos ` +
        `tal como están ahora, y el proyecto dejará de contar en todas las ` +
        `estadísticas activas del dashboard.\n\nEsta acción no se puede deshacer desde aquí.`
    );
    if (!confirmar) return;

    // Se vuelve a pedir la contraseña — el servidor la valida de nuevo antes
    // de archivar, para que esta acción no dependa solo del bloqueo visual
    const password = prompt('Confirma tu contraseña de Administrador para archivar este proyecto:');
    if (!password) return;
    const usuario = sessionStorage.getItem('defen_auth_usuario') || '';

    try {
        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ accion: 'archivar_proyecto', provincia, proyecto: nombreProyecto, usuario, password })
        });
        const json = await res.json();

        if (json.ok) {
            alert(`"${nombreProyecto}" fue archivado correctamente. Recargando datos...`);
            await cargarDatos();
        } else {
            alert('No se pudo archivar: ' + (json.mensaje || 'Error desconocido'));
        }
    } catch (e) {
        alert('No se pudo conectar con el servidor para archivar el proyecto.');
    }
}
