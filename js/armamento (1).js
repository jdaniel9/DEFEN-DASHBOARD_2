// ================================================================
// armamento.js — Módulo interactivo de Armamento y Radios
// Tabla detallada + filtros multi-selección + reportes PDF
// ================================================================

// ── Estado de filtros del modal de armamento (multi-select) ──
let filtrosArmamento = { estado: [], tipo: [], clase: [], categoria: [], provincia: [] };
let filtrosRadios    = { provincia: [], proyecto: [] };

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
    { key:'ubicacion',       label:'Ubicación' },
    { key:'guias',           label:'Guías' }
];

// ── Abrir modal de armamento, opcionalmente pre-filtrado por estado ──
function abrirModalArmamento(estadoPreseleccionado) {
    filtrosArmamento = { estado: [], tipo: [], clase: [], categoria: [], provincia: [] };
    if (estadoPreseleccionado) filtrosArmamento.estado = [estadoPreseleccionado];

    document.getElementById('armamento-modal').style.display = 'flex';
    renderFiltrosArmamento();
    renderTablaArmamento();
}

function cerrarModalArmamento() {
    document.getElementById('armamento-modal').style.display = 'none';
}

// Construye los chips de filtro dinámicamente a partir de los valores únicos presentes
function renderFiltrosArmamento() {
    const bar = document.getElementById('armamento-filtros-bar');
    const valoresUnicos = (campo) => [...new Set(armamentoDetalle.map(a => a[campo]).filter(Boolean))].sort();

    const grupos = [
        { key:'estado',     label:'Estado',     valores:['activo','transito','rastrillo','perdida','confiscada'], colores:{activo:'active-green',transito:'active-blue',rastrillo:'active-slate',perdida:'active-red',confiscada:'active-amber'} },
        { key:'tipo',       label:'Tipo',       valores: valoresUnicos('tipo') },
        { key:'clase',      label:'Clase',      valores: valoresUnicos('clase') },
        { key:'categoria',  label:'Categoría',  valores: valoresUnicos('categoria') },
        { key:'provincia',  label:'Provincia',  valores: valoresUnicos('provincia') },
    ];

    bar.innerHTML = grupos.map(g => `
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
            <span style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin-right:2px;">${g.label}:</span>
            ${g.valores.map(v => {
                const valNorm = normalizarTexto(v);
                const activo = filtrosArmamento[g.key].includes(valNorm);
                const colorClass = g.colores && g.colores[valNorm] ? g.colores[valNorm] : 'active-blue';
                return `<button onclick="toggleFiltroArmamento('${g.key}','${valNorm}',this)"
                        class="chip ${activo ? colorClass : ''}" style="font-size:9px;padding:3px 9px;">${v}</button>`;
            }).join('')}
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
    return true;
}

function obtenerArmasFiltradas() {
    return armamentoDetalle.filter(armaPasaFiltros);
}

function renderTablaArmamento() {
    const filtradas = obtenerArmasFiltradas();
    document.getElementById('armamento-modal-contador').textContent = `${filtradas.length} de ${armamentoDetalle.length} arma(s)`;

    const thead = document.getElementById('armamento-thead-row');
    thead.innerHTML = '<th style="padding:8px;">N°</th>' + ARM_COLUMNAS.map(c => `<th style="padding:8px;text-align:left;white-space:nowrap;">${c.label}</th>`).join('');

    const tbody = document.getElementById('armamento-tbody');
    const badgeEstado = (e) => {
        const map = { activo:'#dcfce7;color:#15803d', transito:'#dbeafe;color:#1d4ed8', rastrillo:'#f1f5f9;color:#475569', perdida:'#fee2e2;color:#b91c1c', confiscada:'#fef3c7;color:#92400e' };
        const key = String(e||'').toLowerCase();
        const style = map[key] || '#f1f5f9;color:#475569';
        return `<span style="background:${style.split(';')[0]};color:${style.split(';')[1].replace('color:','')};font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;">${e||'—'}</span>`;
    };

    tbody.innerHTML = filtradas.map((a, i) => `
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
                ${a.urlGuiaEnvio   ? `<a href="${a.urlGuiaEnvio}" target="_blank" style="font-size:8px;font-weight:800;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:5px;text-decoration:none;margin-right:3px;">Envío</a>` : ''}
                ${a.urlGuiaRetorno ? `<a href="${a.urlGuiaRetorno}" target="_blank" style="font-size:8px;font-weight:800;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:5px;text-decoration:none;">Retorno</a>` : ''}
            </td>
        </tr>
    `).join('') || `<tr><td colspan="${ARM_COLUMNAS.length+1}" style="padding:20px;text-align:center;color:#94a3b8;">Sin resultados para este filtro.</td></tr>`;
}

// ── PDF del inventario filtrado ──
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
        head: [['N°','Código','Serie','Clase','Tipo','Marca','Calibre','Categoría','Emisión','Expiración','Estado','Proyecto','Provincia','Ubicación']],
        body: numerarFilas(filtradas.map(a => [
            a.codigoArma||'—', a.serie||'—', a.clase||'—', a.tipo||'—', a.marca||'—', a.calibre||'—',
            a.categoria||'—', a.fechaEmision?formatFecha(a.fechaEmision):'—', a.fechaExpiracion?formatFecha(a.fechaExpiracion):'—',
            a.estado||'—', a.proyecto||'—', a.provincia||'—', a.ubicacion||'—'
        ])),
        headStyles: { fillColor:DARK, textColor:[255,255,255], fontSize:6.5, cellPadding:2 },
        bodyStyles: { fontSize:6.5, cellPadding:1.8 },
        alternateRowStyles: { fillColor:[248,250,252] },
        columnStyles: { 0:{halign:'center'} }
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
    filtrosRadios = { provincia: [], proyecto: [] };
    document.getElementById('radios-modal').style.display = 'flex';
    renderFiltrosRadios();
    renderTablaRadios();
}
function cerrarModalRadios() {
    document.getElementById('radios-modal').style.display = 'none';
}

function renderFiltrosRadios() {
    const bar = document.getElementById('radios-filtros-bar');
    const valoresUnicos = (campo) => [...new Set(radiosDetalle.map(r => r[campo]).filter(Boolean))].sort();
    const grupos = [
        { key:'provincia', label:'Provincia', valores: valoresUnicos('provincia') },
        { key:'proyecto',  label:'Proyecto',  valores: valoresUnicos('proyecto') },
    ];
    bar.innerHTML = grupos.map(g => `
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
            <span style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin-right:2px;">${g.label}:</span>
            ${g.valores.map(v => {
                const activo = filtrosRadios[g.key].includes(v);
                return `<button onclick="toggleFiltroRadios('${g.key}','${v.replace(/'/g,"\\'")}')"
                        class="chip ${activo?'active-purple':''}" style="font-size:9px;padding:3px 9px;">${v}</button>`;
            }).join('')}
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
    return true;
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
