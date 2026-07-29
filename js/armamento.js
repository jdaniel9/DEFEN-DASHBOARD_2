// ================================================================
// armamento.js — Módulo interactivo de Armamento y Radios
// Tabla detallada + filtros multi-selección + reportes PDF
// ================================================================

// ── Estado de filtros del modal de armamento (multi-select) ──
let filtrosArmamento = { estado: [], tipo: [], clase: [], categoria: [], provincia: [], proyecto: [] };
let filtrosRadios    = { provincia: [], proyecto: [] };
let busquedaArmamento = '';
let busquedaRadios    = '';

// Columnas "sueltas" (sin grupo) — el grupo Fotos/Guías se arma aparte en el thead
const ARM_COLUMNAS = [
    { key:'codigoArma',      label:'Código' },
    { key:'serie',           label:'Serie' },
    { key:'clase',           label:'Clase' },
    { key:'tipo',            label:'Tipo' },
    { key:'marca',           label:'Marca' },
    { key:'calibre',         label:'Calibre' },
    { key:'categoria',       label:'Categoría' },
    { key:'fechaEmision',    label:'Emisión' },
    { key:'fechaExpiracion', label:'Expiración' },
    { key:'estado',          label:'Estado' },
    { key:'proyecto',        label:'Proyecto' },
    { key:'provincia',       label:'Provincia' },
    { key:'ubicacion',       label:'Ubicación' }
];

// ── Abrir modal de armamento, opcionalmente pre-filtrado por estado ──
function abrirModalArmamento(preset) {
    if (typeof usuarioPuedeVerArmamentoDetalle === 'function' && !usuarioPuedeVerArmamentoDetalle()) {
        alert('Tu perfil no tiene permiso para ver el detalle de armamento.');
        return;
    }
    filtrosArmamento = { estado: [], tipo: [], clase: [], categoria: [], provincia: [], proyecto: [] };
    busquedaArmamento = '';

    // Acepta un string simple (compatibilidad: solo estado) o un objeto
    // con varios filtros preseleccionados a la vez, ej: {estado:'activo', clase:'letal', tipo:'pistola'}
    if (typeof preset === 'string' && preset) {
        filtrosArmamento.estado = [preset];
    } else if (preset && typeof preset === 'object') {
        Object.keys(preset).forEach(k => {
            if (filtrosArmamento.hasOwnProperty(k) && preset[k]) filtrosArmamento[k] = [preset[k]];
        });
    }

    // Cerrar los desgloses inline si estaban abiertos
    ['desglose-en-campo','desglose-en-campo-letal','desglose-en-campo-noletal','desglose-rastrillo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    });

    document.getElementById('armamento-modal').style.display = 'flex';
    const buscador = document.getElementById('armamento-buscador');
    if (buscador) buscador.value = '';
    renderFiltrosArmamento();
    renderTablaArmamento();
}

function cerrarModalArmamento() {
    document.getElementById('armamento-modal').style.display = 'none';
}

// =====================================================================
// DESGLOSES INLINE — resumen numérico antes de abrir el detalle completo
// =====================================================================

// Rastrillo → desglosado por provincia/sede (Matriz, Sucursales, etc.)
function toggleDesgloseRastrillo() {
    const cont = document.getElementById('desglose-rastrillo');
    if (cont.style.display === 'block') { cont.style.display = 'none'; cont.innerHTML = ''; return; }

    const porProvincia = {};
    armamentoDetalle.forEach(a => {
        if (normalizarTexto(a.estado) !== 'rastrillo') return;
        const prov = a.provincia || 'SIN PROVINCIA';
        porProvincia[prov] = (porProvincia[prov] || 0) + 1;
    });

    const provincias = Object.keys(porProvincia).sort();
    cont.innerHTML = provincias.length === 0
        ? `<p style="font-size:10px;color:#94a3b8;font-style:italic;padding:6px 12px;">Sin armas en rastrillo registradas.</p>`
        : provincias.map(p => {
            const tipoSede = (data[p] && data[p].tipo) ? data[p].tipo.toUpperCase() : '';
            const etiqueta = tipoSede ? `${p} - ${tipoSede}` : p;
            return `
            <div onclick="event.stopPropagation(); abrirModalArmamento({estado:'rastrillo', provincia:'${normalizarTexto(p)}'})"
                 style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;margin-left:12px;border-left:2px solid #cbd5e1;cursor:pointer;border-radius:0 8px 8px 0;"
                 onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                <span style="font-size:10px;font-weight:700;color:#475569;">🏢 ${etiqueta}</span>
                <span style="font-size:11px;font-weight:900;color:#1e293b;">${porProvincia[p]}</span>
            </div>`;
        }).join('');
    cont.style.display = 'block';
}

// En Campo → nivel 1: Letal (AL) / No Letal (ANL)
function toggleDesgloseEnCampo() {
    const cont = document.getElementById('desglose-en-campo');
    if (cont.style.display === 'block') { cont.style.display = 'none'; cont.innerHTML = ''; return; }

    const activas = armamentoDetalle.filter(a => normalizarTexto(a.estado) === 'activo');
    const letales = activas.filter(a => {
        const c = normalizarTexto(a.clase).replace(/\s/g,'');
        return c.includes('letal') && !c.includes('noletal');
    }).length;
    const noLetales = activas.filter(a => normalizarTexto(a.clase).replace(/\s/g,'').includes('noletal')).length;
    const sinClasificar = activas.length - letales - noLetales;

    cont.innerHTML = `
        <div onclick="event.stopPropagation(); toggleDesgloseEnCampoClase('letal')"
             style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;margin-left:12px;border-left:2px solid #fca5a5;cursor:pointer;border-radius:0 8px 8px 0;"
             onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='transparent'">
            <span style="font-size:10px;font-weight:800;color:#b91c1c;">☠️ Letal (AL)</span>
            <span style="font-size:11px;font-weight:900;color:#991b1b;">${letales}</span>
        </div>
        <div id="desglose-en-campo-letal" style="display:none;"></div>

        <div onclick="event.stopPropagation(); toggleDesgloseEnCampoClase('noletal')"
             style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;margin-left:12px;border-left:2px solid #fde68a;cursor:pointer;border-radius:0 8px 8px 0;"
             onmouseover="this.style.background='#fffbeb'" onmouseout="this.style.background='transparent'">
            <span style="font-size:10px;font-weight:800;color:#92400e;">🛡️ No Letal (ANL)</span>
            <span style="font-size:11px;font-weight:900;color:#78350f;">${noLetales}</span>
        </div>
        <div id="desglose-en-campo-noletal" style="display:none;"></div>

        ${sinClasificar > 0 ? `<p style="font-size:9px;color:#94a3b8;font-style:italic;padding:4px 12px;">${sinClasificar} arma(s) sin clase registrada</p>` : ''}
    `;
    cont.style.display = 'block';
}

// En Campo → nivel 2: desglose por Tipo (Pistola, Revólver, Escopeta...) dentro de Letal/No Letal
function toggleDesgloseEnCampoClase(clase) {
    const contId = clase === 'letal' ? 'desglose-en-campo-letal' : 'desglose-en-campo-noletal';
    const cont = document.getElementById(contId);
    if (cont.style.display === 'block') { cont.style.display = 'none'; cont.innerHTML = ''; return; }

    const activas = armamentoDetalle.filter(a => {
        if (normalizarTexto(a.estado) !== 'activo') return false;
        const c = normalizarTexto(a.clase).replace(/\s/g,'');
        return clase === 'letal' ? (c.includes('letal') && !c.includes('noletal')) : c.includes('noletal');
    });

    // Por cada tipo, guardamos el valor de 'clase' EXACTO como aparece en tus
    // datos (ej. "No Letal") normalizado igual que lo hacen los chips del
    // filtro (con espacio incluido) — así el preset coincide de verdad
    const porTipo = {};
    const claseRealPorTipo = {};
    activas.forEach(a => {
        const t = a.tipo || 'Sin tipo';
        porTipo[t] = (porTipo[t] || 0) + 1;
        if (!claseRealPorTipo[t]) claseRealPorTipo[t] = normalizarTexto(a.clase);
    });

    const tipos = Object.keys(porTipo).sort();
    cont.innerHTML = tipos.length === 0
        ? `<p style="font-size:9px;color:#94a3b8;font-style:italic;padding:4px 12px 4px 24px;">Sin datos.</p>`
        : tipos.map(t => {
            const claseValor = (claseRealPorTipo[t] || '').replace(/'/g,"\\'");
            const tipoValor  = normalizarTexto(t).replace(/'/g,"\\'");
            return `
            <div onclick="event.stopPropagation(); abrirModalArmamento({estado:'activo', clase:'${claseValor}', tipo:'${tipoValor}'})"
                 style="display:flex;justify-content:space-between;align-items:center;padding:4px 12px 4px 24px;cursor:pointer;border-radius:8px;"
                 onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <span style="font-size:9px;font-weight:600;color:#64748b;">🔫 ${t}</span>
                <span style="font-size:10px;font-weight:800;color:#334155;">${porTipo[t]}</span>
            </div>`;
        }).join('');
    cont.style.display = 'block';
}

// Construye los chips de filtro dinámicamente a partir de los valores únicos presentes.
// El filtro de PROYECTO es dependiente: si hay provincia(s) seleccionada(s), solo
// muestra los proyectos que existen dentro de esas provincias (filtro en cascada)
function renderFiltrosArmamento() {
    const bar = document.getElementById('armamento-filtros-bar');
    const valoresUnicos = (campo) => [...new Set(armamentoDetalle.map(a => a[campo]).filter(Boolean))].sort();

    // Proyectos disponibles: SOLO se muestran una vez elegida al menos una
    // provincia — evita la lista larga y desordenada de todos los proyectos
    // del país cuando no hay ningún filtro aplicado todavía
    const provinciasElegidas = filtrosArmamento.provincia;
    const proyectosDisponibles = provinciasElegidas.length === 0 ? [] : [...new Set(
        armamentoDetalle
            .filter(a => provinciasElegidas.includes(normalizarTexto(a.provincia)))
            .map(a => a.proyecto)
            .filter(Boolean)
    )].sort();

    // Si cambiaron las provincias y algún proyecto seleccionado ya no aplica, lo quitamos
    filtrosArmamento.proyecto = filtrosArmamento.proyecto.filter(p =>
        proyectosDisponibles.some(pd => normalizarTexto(pd) === p)
    );

    const grupos = [
        { key:'estado',     label:'Estado',     valores:['activo','transito','rastrillo','perdida','confiscada'], colores:{activo:'active-green',transito:'active-blue',rastrillo:'active-slate',perdida:'active-red',confiscada:'active-amber'} },
        { key:'provincia',  label:'Provincia',  valores: valoresUnicos('provincia') },
        { key:'proyecto',   label:'Proyecto' + (provinciasElegidas.length > 0 ? ' (de la provincia elegida)' : ' — elige provincia primero'), valores: proyectosDisponibles },
        { key:'tipo',       label:'Tipo',       valores: valoresUnicos('tipo') },
        { key:'clase',      label:'Clase',      valores: valoresUnicos('clase') },
        { key:'categoria',  label:'Categoría',  valores: valoresUnicos('categoria') },
    ];

    bar.innerHTML = grupos.map(g => `
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
            <span style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin-right:2px;">${g.label}:</span>
            ${g.valores.length > 0 ? g.valores.map(v => {
                const valNorm = normalizarTexto(v);
                const activo = filtrosArmamento[g.key].includes(valNorm);
                const colorClass = g.colores && g.colores[valNorm] ? g.colores[valNorm] : 'active-blue';
                return `<button onclick="toggleFiltroArmamento('${g.key}','${valNorm}',this)"
                        class="chip ${activo ? colorClass : ''}" style="font-size:9px;padding:3px 9px;">${v}</button>`;
            }).join('') : `<span style="font-size:9px;color:#cbd5e1;font-style:italic;">— elige una provincia primero —</span>`}
        </div>
    `).join('<div style="width:100%;height:1px;background:#f1f5f9;margin:2px 0;"></div>');
}

function toggleFiltroArmamento(grupo, valor, btn) {
    const idx = filtrosArmamento[grupo].indexOf(valor);
    if (idx > -1) { filtrosArmamento[grupo].splice(idx, 1); }
    else { filtrosArmamento[grupo].push(valor); }
    renderFiltrosArmamento();
    renderTablaArmamento();
}

// Quita tildes y normaliza — para que "Tránsito" y "Transito" se traten igual
function normalizarTexto(s) {
    return String(s||'').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function armaPasaFiltros(a) {
    for (const grupo of Object.keys(filtrosArmamento)) {
        if (filtrosArmamento[grupo].length === 0) continue;
        const valorArma = normalizarTexto(a[grupo]);
        if (!filtrosArmamento[grupo].includes(valorArma)) return false;
    }
    if (busquedaArmamento) {
        const texto = normalizarTexto(busquedaArmamento);
        const campos = [a.codigoArma, a.serie, a.nDocumento, a.nombreRazon, a.marca, a.calibre,
                         a.categoria, a.proyecto, a.provincia, a.ubicacion, a.tipo, a.clase];
        const coincide = campos.some(c => normalizarTexto(c).includes(texto));
        if (!coincide) return false;
    }
    return true;
}

function buscarArmamento(valor) {
    busquedaArmamento = valor;
    renderTablaArmamento();
}

function obtenerArmasFiltradas() {
    return armamentoDetalle.filter(armaPasaFiltros);
}

function renderTablaArmamento() {
    const filtradas = obtenerArmasFiltradas();
    document.getElementById('armamento-modal-contador').textContent = `${filtradas.length} de ${armamentoDetalle.length} arma(s)`;

    // ── Fila 1 del thead: grupos (Fotos / GDLT) ──
    const theadGrupos = document.getElementById('armamento-thead-grupos');
    theadGrupos.innerHTML =
        `<th style="padding:4px 8px;"></th>` +
        ARM_COLUMNAS.map(() => `<th style="padding:4px 8px;"></th>`).join('') +
        `<th colspan="2" style="padding:4px 8px;text-align:center;background:#312e81;font-size:9px;letter-spacing:0.06em;">FOTOS</th>` +
        `<th colspan="2" style="padding:4px 8px;text-align:center;background:#3730a3;font-size:9px;letter-spacing:0.06em;">GDLT</th>` +
        `<th style="padding:4px 8px;"></th>`;

    // ── Fila 2 del thead: columnas reales ──
    const thead = document.getElementById('armamento-thead-row');
    thead.innerHTML = '<th style="padding:8px;">N°</th>'
        + ARM_COLUMNAS.map(c => `<th style="padding:8px;text-align:left;white-space:nowrap;">${c.label}</th>`).join('')
        + `<th style="padding:8px;white-space:nowrap;">Credencial</th>`
        + `<th style="padding:8px;white-space:nowrap;">Arma</th>`
        + `<th style="padding:8px;white-space:nowrap;">Envío</th>`
        + `<th style="padding:8px;white-space:nowrap;">Retorno</th>`
        + `<th style="padding:8px;white-space:nowrap;">Mapa</th>`;

    const tbody = document.getElementById('armamento-tbody');
    const badgeEstado = (e) => {
        const map = { activo:'#dcfce7;color:#15803d', transito:'#dbeafe;color:#1d4ed8', rastrillo:'#f1f5f9;color:#475569', perdida:'#fee2e2;color:#b91c1c', confiscada:'#fef3c7;color:#92400e' };
        const key = String(e||'').toLowerCase();
        const style = map[key] || '#f1f5f9;color:#475569';
        return `<span style="background:${style.split(';')[0]};color:${style.split(';')[1].replace('color:','')};font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;">${e||'—'}</span>`;
    };

    tbody.innerHTML = filtradas.map((a, i) => {
        const esActiva = normalizarTexto(a.estado) === 'activo';
        const tieneUbicacion = esActiva && a.puesto && a.provincia && a.proyecto;
        const puestoSeguro = (a.puesto||'').replace(/'/g,"\\'");
        const proyectoSeguro = (a.proyecto||'').replace(/'/g,"\\'");

        return `
        <tr style="border-bottom:1px solid #f1f5f9;${i%2===0?'background:#f8fafc;':''}">
            <td style="padding:6px 8px;text-align:center;color:#94a3b8;">${i+1}</td>
            <td style="padding:6px 8px;font-weight:700;">${a.codigoArma||'—'}</td>
            <td style="padding:6px 8px;">${a.serie||'—'}</td>
            <td style="padding:6px 8px;">${a.clase||'—'}</td>
            <td style="padding:6px 8px;">${a.tipo||'—'}</td>
            <td style="padding:6px 8px;">${a.marca||'—'}</td>
            <td style="padding:6px 8px;">${a.calibre||'—'}</td>
            <td style="padding:6px 8px;">${a.categoria||'—'}</td>
            <td style="padding:6px 8px;">${a.fechaEmision ? formatFecha(a.fechaEmision) : '—'}</td>
            <td style="padding:6px 8px;">${a.fechaExpiracion ? formatFecha(a.fechaExpiracion) : '—'}</td>
            <td style="padding:6px 8px;">${badgeEstado(a.estado)}</td>
            <td style="padding:6px 8px;">${a.proyecto||'—'}</td>
            <td style="padding:6px 8px;">${a.provincia||'—'}</td>
            <td style="padding:6px 8px;">${a.ubicacion||'—'}</td>
            <td style="padding:6px 8px;white-space:nowrap;">
                ${a.urlCredencial ? `<button onclick="verImagen('${a.urlCredencial}','Credencial · Serie ${a.serie||''}')" style="font-size:8px;font-weight:800;background:#ede9fe;color:#6d28d9;padding:2px 6px;border-radius:5px;border:none;cursor:pointer;">📇</button>` : '<span style="color:#e2e8f0;">—</span>'}
            </td>
            <td style="padding:6px 8px;white-space:nowrap;">
                ${a.urlImagenArma ? `<button onclick="verImagen('${a.urlImagenArma}','Foto del arma · Serie ${a.serie||''}')" style="font-size:8px;font-weight:800;background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:5px;border:none;cursor:pointer;">📷</button>` : '<span style="color:#e2e8f0;">—</span>'}
            </td>
            <td style="padding:6px 8px;white-space:nowrap;">
                ${a.urlGuiaEnvio ? `<a href="${a.urlGuiaEnvio}" target="_blank" style="font-size:8px;font-weight:800;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:5px;text-decoration:none;">📄</a>` : '<span style="color:#e2e8f0;">—</span>'}
            </td>
            <td style="padding:6px 8px;white-space:nowrap;">
                ${a.urlGuiaRetorno ? `<a href="${a.urlGuiaRetorno}" target="_blank" style="font-size:8px;font-weight:800;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:5px;text-decoration:none;">📄</a>` : '<span style="color:#e2e8f0;">—</span>'}
            </td>
            <td style="padding:6px 8px;white-space:nowrap;">
                ${tieneUbicacion
                    ? `<button onclick="cerrarModalArmamento(); mostrarArmaEnMapa('${a.provincia}','${proyectoSeguro}','${puestoSeguro}')"
                         style="font-size:8px;font-weight:800;background:#16a34a;color:white;padding:3px 7px;border-radius:5px;border:none;cursor:pointer;" title="Ver dónde está ubicada esta arma">
                         📍 Ver
                       </button>`
                    : '<span style="color:#e2e8f0;">—</span>'}
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="${ARM_COLUMNAS.length+6}" style="padding:20px;text-align:center;color:#94a3b8;">Sin resultados para este filtro.</td></tr>`;
}

// ── Lightbox de imágenes (credencial / foto del arma) ──
function verImagen(url, titulo) {
    if (!url) return;
    document.getElementById('lightbox-titulo').textContent = titulo || '';
    document.getElementById('lightbox-error').style.display = 'none';
    const img = document.getElementById('lightbox-img');
    img.style.display = 'block';

    // Si el formato principal falla, intenta un formato alternativo antes
    // de darse por vencido — algunos archivos responden mejor a uno u otro
    const match  = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = match ? match[1] : null;
    let intento  = 0;
    const formatos = fileId ? [
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
        `https://drive.google.com/uc?export=view&id=${fileId}`
    ] : [url];

    img.onerror = () => {
        intento++;
        if (intento < formatos.length) {
            img.src = formatos[intento];
        } else {
            img.style.display = 'none';
            document.getElementById('lightbox-error').style.display = 'block';
        }
    };
    img.src = formatos[0];
    document.getElementById('imagen-lightbox').style.display = 'flex';
}

function cerrarImagenLightbox() {
    document.getElementById('imagen-lightbox').style.display = 'none';
    document.getElementById('lightbox-img').src = '';
}

// ── Excel del inventario filtrado ──
function exportarExcelArmamento() {
    const filtradas = obtenerArmasFiltradas();
    if (filtradas.length === 0) { alert('No hay armas para exportar con este filtro.'); return; }

    const filas = filtradas.map((a, i) => ({
        'N°':            i + 1,
        'Código':        a.codigoArma || '',
        'N° Documento':  a.nDocumento || '',
        'Nombre/Razón':  a.nombreRazon || '',
        'Serie':         a.serie || '',
        'Clase':         a.clase || '',
        'Tipo':          a.tipo || '',
        'Marca':         a.marca || '',
        'Calibre':       a.calibre || '',
        'Categoría':     a.categoria || '',
        'Fecha Emisión':    a.fechaEmision    ? formatFecha(a.fechaEmision)    : '',
        'Fecha Expiración': a.fechaExpiracion ? formatFecha(a.fechaExpiracion) : '',
        'Estado':        a.estado || '',
        'Proyecto':      a.proyecto || '',
        'Provincia':     a.provincia || '',
        'Ubicación':     a.ubicacion || '',
        'Credencial':    a.urlCredencial || '',
        'Foto Arma':     a.urlImagenArma || ''
    }));

    const ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = Object.keys(filas[0]).map(k => ({ wch: Math.max(k.length + 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Armamento');

    const hoy = new Date();
    const fechaHoy = `${String(hoy.getDate()).padStart(2,'0')}-${String(hoy.getMonth()+1).padStart(2,'0')}-${hoy.getFullYear()}`;
    XLSX.writeFile(wb, `Inventario_Armamento_${fechaHoy}.xlsx`);
}

async function exportarPDFArmamento() {
    const filtradas = obtenerArmasFiltradas();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const W = 297, H = 210;
    const DARK=[15,23,42];
    const hoy = new Date();
    const fechaHoy = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;

    const filtrosTexto = Object.entries(filtrosArmamento)
        .filter(([,v]) => v.length > 0)
        .map(([k,v]) => `${k}: ${v.join('/')}`)
        .join('  ·  ') || 'Sin filtros (inventario completo)';

    dibujarMembretePDF(doc, `Inventario de Armamento — ${filtrosTexto}`, fechaHoy);
    let y = MARGEN_PDF + 8;

    doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
    doc.text(`Inventario de Armamento (${filtradas.length} arma(s))`, 14, y); y += 8;

    doc.autoTable({
        startY: y,
        margin: { left:10, right:10, top:MARGEN_PDF+4, bottom:MARGEN_PDF+4 },
        didDrawPage: () => dibujarMembretePDF(doc, `Inventario de Armamento — ${filtrosTexto}`, fechaHoy),
        head: [['N°','Código','Serie','Clase','Tipo','Marca','Calibre','Categoría','Emisión','Expiración','Estado','Proyecto','Provincia','Ubicación','Cred.','Foto']],
        body: numerarFilas(filtradas.map(a => [
            a.codigoArma||'—', a.serie||'—', a.clase||'—', a.tipo||'—', a.marca||'—', a.calibre||'—',
            a.categoria||'—', a.fechaEmision?formatFecha(a.fechaEmision):'—', a.fechaExpiracion?formatFecha(a.fechaExpiracion):'—',
            a.estado||'—', a.proyecto||'—', a.provincia||'—', a.ubicacion||'—',
            a.urlCredencial ? 'Sí' : '—', a.urlImagenArma ? 'Sí' : '—'
        ])),
        headStyles: { fillColor:DARK, textColor:[255,255,255], fontSize:6.5, cellPadding:2 },
        bodyStyles: { fontSize:6.5, cellPadding:1.8 },
        alternateRowStyles: { fillColor:[248,250,252] },
        columnStyles: { 0:{halign:'center'}, 14:{halign:'center'}, 15:{halign:'center'} }
    });

    const totalPag = doc.getNumberOfPages();
    for (let i=1;i<=totalPag;i++){
        doc.setPage(i);
        doc.setFontSize(6.5); doc.setTextColor(120,113,108);
        doc.text(`Página ${i} de ${totalPag}`, W-14, H-MARGEN_PDF+20, {align:'right'});
        doc.text('Documento confidencial · Uso interno', 14, H-MARGEN_PDF+20);
    }
    doc.save(`Inventario_Armamento_${fechaHoy.replace(/\//g,'-')}.pdf`);
}

// ================================================================
// RADIOS
// ================================================================
function abrirModalRadios() {
    if (typeof usuarioPuedeVerRadiosDetalle === 'function' && !usuarioPuedeVerRadiosDetalle()) {
        alert('Tu perfil no tiene permiso para ver el detalle de radios.');
        return;
    }
    filtrosRadios = { provincia: [], proyecto: [] };
    busquedaRadios = '';
    document.getElementById('radios-modal').style.display = 'flex';
    const buscador = document.getElementById('radios-buscador');
    if (buscador) buscador.value = '';
    renderFiltrosRadios();
    renderTablaRadios();
}
function cerrarModalRadios() {
    document.getElementById('radios-modal').style.display = 'none';
}

function renderFiltrosRadios() {
    const bar = document.getElementById('radios-filtros-bar');
    const valoresUnicos = (campo) => [...new Set(radiosDetalle.map(r => r[campo]).filter(Boolean))].sort();

    // Proyectos: solo se muestran una vez elegida al menos una provincia
    const provinciasElegidas = filtrosRadios.provincia;
    const proyectosDisponibles = provinciasElegidas.length === 0 ? [] : [...new Set(
        radiosDetalle
            .filter(r => provinciasElegidas.includes(r.provincia))
            .map(r => r.proyecto)
            .filter(Boolean)
    )].sort();

    // Si cambió la provincia y el proyecto elegido ya no aplica, lo quitamos
    filtrosRadios.proyecto = filtrosRadios.proyecto.filter(p => proyectosDisponibles.includes(p));

    const grupos = [
        { key:'provincia', label:'Provincia', valores: valoresUnicos('provincia') },
        { key:'proyecto',  label:'Proyecto' + (provinciasElegidas.length > 0 ? ' (de la provincia elegida)' : ' — elige provincia primero'), valores: proyectosDisponibles },
    ];
    bar.innerHTML = grupos.map(g => `
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
            <span style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin-right:2px;">${g.label}:</span>
            ${g.valores.length > 0 ? g.valores.map(v => {
                const activo = filtrosRadios[g.key].includes(v);
                return `<button onclick="toggleFiltroRadios('${g.key}','${v.replace(/'/g,"\\'")}')"
                        class="chip ${activo?'active-purple':''}" style="font-size:9px;padding:3px 9px;">${v}</button>`;
            }).join('') : `<span style="font-size:9px;color:#cbd5e1;font-style:italic;">— elige una provincia primero —</span>`}
        </div>
    `).join('<div style="width:100%;height:1px;background:#f1f5f9;margin:2px 0;"></div>');
}

function toggleFiltroRadios(grupo, valor) {
    const idx = filtrosRadios[grupo].indexOf(valor);
    if (idx > -1) filtrosRadios[grupo].splice(idx,1); else filtrosRadios[grupo].push(valor);
    renderFiltrosRadios();
    renderTablaRadios();
}

function radioPasaFiltros(r) {
    for (const grupo of Object.keys(filtrosRadios)) {
        if (filtrosRadios[grupo].length === 0) continue;
        if (!filtrosRadios[grupo].includes(r[grupo])) return false;
    }
    if (busquedaRadios) {
        const texto = normalizarTexto(busquedaRadios);
        const campos = [r.provincia, r.proyecto, r.puesto, r.modelo, r.serie];
        const coincide = campos.some(c => normalizarTexto(c).includes(texto));
        if (!coincide) return false;
    }
    return true;
}

function buscarRadios(valor) {
    busquedaRadios = valor;
    renderTablaRadios();
}

function obtenerRadiosFiltrados() { return radiosDetalle.filter(radioPasaFiltros); }

function renderTablaRadios() {
    const filtrados = obtenerRadiosFiltrados();
    document.getElementById('radios-modal-contador').textContent = `${filtrados.length} de ${radiosDetalle.length} radio(s)`;
    const tbody = document.getElementById('radios-tbody');

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8;">
            ${radiosDetalle.length === 0 ? 'No hay radios registrados en el sistema.' : 'No tiene radios con este filtro.'}
        </td></tr>`;
        return;
    }
    tbody.innerHTML = filtrados.map((r,i) => `
        <tr style="border-bottom:1px solid #f1f5f9;${i%2===0?'background:#f8fafc;':''}">
            <td style="padding:7px 8px;text-align:center;color:#94a3b8;">${i+1}</td>
            <td style="padding:7px 8px;">${r.provincia}</td>
            <td style="padding:7px 8px;">${r.proyecto}</td>
            <td style="padding:7px 8px;">${r.puesto||'—'}</td>
            <td style="padding:7px 8px;font-weight:700;">${r.modelo||'—'}</td>
            <td style="padding:7px 8px;">${r.serie||'—'}</td>
        </tr>
    `).join('');
}

// ── Excel de radios filtrados ──
function exportarExcelRadios() {
    const filtrados = obtenerRadiosFiltrados();
    if (filtrados.length === 0) { alert('No hay radios para exportar con este filtro.'); return; }

    const filas = filtrados.map((r, i) => ({
        'N°':        i + 1,
        'Provincia': r.provincia,
        'Proyecto':  r.proyecto,
        'Puesto':    r.puesto || '',
        'Modelo':    r.modelo || '',
        'Serie':     r.serie || ''
    }));

    const ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = Object.keys(filas[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Radios');

    const hoy = new Date();
    const fechaHoy = `${String(hoy.getDate()).padStart(2,'0')}-${String(hoy.getMonth()+1).padStart(2,'0')}-${hoy.getFullYear()}`;
    XLSX.writeFile(wb, `Inventario_Radios_${fechaHoy}.xlsx`);
}

async function exportarPDFRadios() {
    const filtrados = obtenerRadiosFiltrados();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const W = 210, H = 297, DARK=[15,23,42];
    const hoy = new Date();
    const fechaHoy = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;
    const subt = 'Inventario de Radios — Nacional';

    dibujarMembretePDF(doc, subt, fechaHoy);
    let y = MARGEN_PDF + 8;
    doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
    doc.text(`Inventario de Radios (${filtrados.length})`, 14, y); y += 8;

    if (filtrados.length === 0) {
        doc.setFontSize(10); doc.setTextColor(148,163,184); doc.setFont('helvetica','italic');
        doc.text('No hay radios registrados para el filtro seleccionado.', 14, y);
    } else {
        doc.autoTable({
            startY: y,
            margin: { left:14, right:14, top:MARGEN_PDF+4, bottom:MARGEN_PDF+4 },
            didDrawPage: () => dibujarMembretePDF(doc, subt, fechaHoy),
            head: [['N°','Provincia','Proyecto','Puesto','Modelo','Serie']],
            body: numerarFilas(filtrados.map(r => [r.provincia, r.proyecto, r.puesto||'—', r.modelo||'—', r.serie||'—'])),
            headStyles: { fillColor:[124,58,237], textColor:[255,255,255], fontSize:7.5, cellPadding:2.5 },
            bodyStyles: { fontSize:7.5, cellPadding:2.2 },
            alternateRowStyles: { fillColor:[248,250,252] },
            columnStyles: { 0:{halign:'center'} }
        });
    }

    const totalPag = doc.getNumberOfPages();
    for (let i=1;i<=totalPag;i++){
        doc.setPage(i);
        doc.setFontSize(6.5); doc.setTextColor(120,113,108);
        doc.text(`Página ${i} de ${totalPag}`, W-14, H-MARGEN_PDF+20, {align:'right'});
        doc.text('Documento confidencial · Uso interno', 14, H-MARGEN_PDF+20);
    }
    doc.save(`Inventario_Radios_${fechaHoy.replace(/\//g,'-')}.pdf`);
}
