// ================================================================
// reporte-gerencia.js — Reporte mensual de vencimientos para gerencia
//   Desde el panel "Vencimientos" genera, con los mismos datos:
//     · IMAGEN (PNG) lista para enviar por WhatsApp o correo
//     · PDF con el membrete de la empresa
//     · EXCEL con presentación gerencial
//   Secciones: proyectos (activación / desactivación / días para
//   culminar), agencias y sucursales (vigencia del permiso) y, si hay,
//   credenciales de armas.
// ================================================================
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
  const hoyIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  // Colores por urgencia (texto, fondo) — mismos en imagen, PDF y Excel
  const TONOS = {
    concluido: ['37474F', 'CFD8DC'],
    vencido: ['FFFFFF', 'D32F2F'],
    urgente: ['C62828', 'F4CCCC'],
    pronto: ['B45309', 'FCE5CD'],
    proximo: ['7F6000', 'FFF2CC'],
    sin: ['475569', 'E2E8F0']
  };

  function estadoDias(item, tipo) {
    if (item.kind === 'OFICINA_SIN_PERMISO') return { texto: 'SIN PERMISO', tono: 'vencido' };
    if (item.days === null || item.days === undefined) return { texto: 'SIN FECHA', tono: 'sin' };
    const d = Number(item.days);
    if (d < 0) return tipo === 'PROYECTO' ? { texto: 'CONCLUIDO', tono: 'concluido' } : { texto: `VENCIDO (${Math.abs(d)} D)`, tono: 'vencido' };
    if (d === 0) return { texto: 'HOY', tono: tipo === 'PROYECTO' ? 'urgente' : 'vencido' };
    return { texto: String(d), tono: d <= 15 ? 'urgente' : d <= 30 ? 'pronto' : 'proximo' };
  }

  function datos() {
    const d = typeof obtenerDatosVencimientos === 'function' ? obtenerDatosVencimientos() : null;
    if (!d) throw new Error('PRIMERO SE DEBEN CARGAR LOS VENCIMIENTOS.');
    const items = d.items || [];
    const porFecha = (a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')) || String(a.title).localeCompare(String(b.title), 'es');
    const proyectos = items.filter((i) => i.kind === 'PROYECTO' || i.kind === 'PROYECTO_CONCLUIDO').sort(porFecha)
      .map((i, n) => ({ n: n + 1, odc: i.code || '—', entidad: i.title, provincia: i.province || i.detail || '—', inicio: fecha(i.start), fin: fecha(i.date), guardias: i.guards ?? '—', dias: estadoDias(i, 'PROYECTO') }));
    const sinFecha = items.filter((i) => i.kind === 'PROYECTO_SIN_FECHA').map((i) => i.title);
    const oficinas = items.filter((i) => i.kind === 'OFICINA' || i.kind === 'OFICINA_SIN_PERMISO').sort(porFecha)
      .map((i, n) => ({ n: n + 1, provincia: i.province || '—', oficina: i.title, tipo: i.office_type || '—', permiso: i.permit_number || '—', inicio: fecha(i.start), fin: fecha(i.date), dias: estadoDias(i, 'OFICINA') }));
    const armas = items.filter((i) => i.kind === 'ARMA').sort(porFecha)
      .map((i, n) => ({ n: n + 1, codigo: i.code || '—', serie: i.serial || '—', ubicacion: [i.project, i.location].filter(Boolean).join(' · ') || '—', inicio: fecha(i.start), fin: fecha(i.date), dias: estadoDias(i, 'ARMA') }));
    return { dias: d.days || 60, corte: fecha(d.today || hoyIso()), corteIso: String(d.today || hoyIso()), secciones: d.sections || {}, proyectos, sinFecha, oficinas, armas };
  }

  const SECCIONES = (r) => [
    r.secciones.projects && {
      titulo: 'PROYECTOS DEFEN CIA. LTDA. (FECHA DE ACTIVACIÓN Y DESACTIVACIÓN)',
      columnas: ['N°', 'ODC', 'ENTIDAD', 'PROVINCIA', 'GUARDIAS', 'FECHA ACTIVACIÓN', 'FECHA DESACTIVACIÓN', 'DÍAS PARA CULMINAR'],
      anchos: [5, 22, 34, 16, 10, 14, 15, 15],
      filas: r.proyectos.map((p) => [p.n, p.odc, p.entidad, p.provincia, p.guardias, p.inicio, p.fin, p.dias]),
      vacio: 'NINGÚN PROYECTO FINALIZA EN EL PERIODO.',
      nota: r.sinFecha.length ? `PROYECTOS ACTIVOS SIN FECHA DE DESACTIVACIÓN REGISTRADA: ${r.sinFecha.join(', ')}.` : ''
    },
    r.secciones.offices && {
      titulo: 'AGENCIAS Y SUCURSALES (VIGENCIA DEL PERMISO DE FUNCIONAMIENTO)',
      columnas: ['N°', 'PROVINCIA', 'OFICINA', 'TIPO', 'N° PERMISO', 'VIGENTE DESDE', 'VENCE', 'DÍAS PARA VENCER'],
      anchos: [5, 18, 28, 12, 20, 14, 13, 15],
      filas: r.oficinas.map((o) => [o.n, o.provincia, o.oficina, o.tipo, o.permiso, o.inicio, o.fin, o.dias]),
      vacio: 'NINGÚN PERMISO DE AGENCIA VENCE EN EL PERIODO.'
    },
    r.secciones.weapons && r.armas.length && {
      titulo: 'CREDENCIALES DE ARMAS (PERMISO DE PORTE)',
      columnas: ['N°', 'CÓDIGO', 'SERIE', 'UBICACIÓN', 'EMISIÓN', 'VENCE', 'DÍAS PARA VENCER'],
      anchos: [5, 16, 22, 36, 13, 13, 15],
      filas: r.armas.map((a) => [a.n, a.codigo, a.serie, a.ubicacion, a.inicio, a.fin, a.dias])
    }
  ].filter(Boolean);

  const nombreArchivo = (r, ext) => `VENCIMIENTOS_DEFEN_${r.corteIso}.${ext}`;
  const tituloGeneral = 'REPORTE DE VENCIMIENTOS';
  const subtitulo = (r) => `CORTE AL ${r.corte} · VENCIDOS Y PRÓXIMOS ${r.dias} DÍAS`;

  // ── Imagen (PNG) ───────────────────────────────────────────────
  async function imagen(r) {
    if (typeof html2canvas !== 'function') throw new Error('NO SE ENCONTRÓ EL GENERADOR DE IMÁGENES.');
    const hoja = document.createElement('div');
    hoja.className = 'rg-hoja';
    hoja.innerHTML = `
      <div class="rg-cabecera"><img src="img/logo.png" alt=""><div><b>DEFEN CIA. LTDA.</b><h1>${tituloGeneral}</h1><p>${esc(subtitulo(r))}</p></div></div>
      ${SECCIONES(r).map((s) => `
        <table class="rg-tabla"><caption>${esc(s.titulo)}</caption>
          <thead><tr>${s.columnas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${s.filas.length ? s.filas.map((f) => `<tr>${f.map((v, i) => i === f.length - 1
            ? `<td class="rg-dias" style="color:#${TONOS[v.tono][0]};background:#${TONOS[v.tono][1]}">${esc(v.texto)}</td>`
            : `<td class="${i === 2 ? 'rg-izq' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${s.columnas.length}" class="rg-vacio">${esc(s.vacio || 'SIN REGISTROS')}</td></tr>`}</tbody>
        </table>${s.nota ? `<p class="rg-nota">${esc(s.nota)}</p>` : ''}`).join('')}
      <div class="rg-leyenda"><span style="background:#F4CCCC;color:#C62828">≤ 15 DÍAS</span><span style="background:#FCE5CD;color:#B45309">16 A 30 DÍAS</span><span style="background:#FFF2CC;color:#7F6000">31 DÍAS O MÁS</span><span style="background:#D32F2F;color:#fff">VENCIDO / SIN PERMISO</span><span style="background:#CFD8DC;color:#37474F">CONCLUIDO</span><small>GENERADO DESDE DEFEN DASHBOARD</small></div>`;
    document.body.appendChild(hoja);
    try {
      await Promise.all([...hoja.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));
      const canvas = await html2canvas(hoja, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const blob = await new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('NO SE PUDO CREAR LA IMAGEN.'))), 'image/png'));
      let copiada = false;
      try { if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); copiada = true; } } catch (_) {}
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = nombreArchivo(r, 'png');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return copiada ? 'IMAGEN DESCARGADA Y COPIADA: YA PUEDES PEGARLA (CTRL+V) EN WHATSAPP O EN EL CORREO.' : 'IMAGEN DESCARGADA.';
    } finally { hoja.remove(); }
  }

  // ── PDF ───────────────────────────────────────────────────────
  function pdf(r) {
    if (!window.jspdf?.jsPDF) throw new Error('NO SE ENCONTRÓ EL GENERADOR PDF.');
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margen = typeof MARGEN_PDF === 'number' ? MARGEN_PDF : 25;
    const membrete = () => { if (typeof dibujarMembretePDF === 'function') dibujarMembretePDF(doc, `${tituloGeneral} · ${subtitulo(r)}`, r.corte, { mayusculas: true }); };
    membrete();
    let y = margen + 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(15, 23, 42);
    doc.text(tituloGeneral, 14, y); y += 6;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
    doc.text(subtitulo(r), 14, y); y += 7;
    const rgb = (hex) => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    SECCIONES(r).forEach((s) => {
      if (y > 165) { doc.addPage(); membrete(); y = margen + 8; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
      doc.text(s.titulo, 14, y); y += 3;
      doc.autoTable({
        startY: y,
        head: [s.columnas],
        body: s.filas.length ? s.filas.map((f) => f.map((v, i) => (i === f.length - 1 ? v.texto : v))) : [[{ content: s.vacio || 'SIN REGISTROS', colSpan: s.columnas.length, styles: { halign: 'center', fontStyle: 'italic' } }]],
        margin: { left: 14, right: 14, top: margen + 5, bottom: margen + 4 },
        headStyles: { fillColor: rgb('37474F'), textColor: [255, 255, 255], fontSize: 7.5, halign: 'center', valign: 'middle' },
        styles: { fontSize: 7.5, cellPadding: 2, halign: 'center', valign: 'middle', lineColor: rgb('B0BEC5'), lineWidth: 0.15 },
        alternateRowStyles: { fillColor: rgb('ECEFF1') },
        columnStyles: { 2: { halign: 'left' } },
        didParseCell: (h) => {
          if (h.section !== 'body' || !s.filas.length || h.column.index !== s.columnas.length - 1) return;
          const v = s.filas[h.row.index]?.[s.columnas.length - 1];
          if (!v) return;
          h.cell.styles.fillColor = rgb(TONOS[v.tono][1]); h.cell.styles.textColor = rgb(TONOS[v.tono][0]); h.cell.styles.fontStyle = 'bold';
        },
        didDrawPage: membrete
      });
      y = doc.lastAutoTable.finalY + 4;
      if (s.nota) { doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105); doc.text(doc.splitTextToSize(s.nota, 265), 14, y + 2); y += 6; }
      y += 6;
    });
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) { doc.setPage(p); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139); doc.text(`PÁGINA ${p} DE ${total}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 5, { align: 'right' }); }
    doc.save(nombreArchivo(r, 'pdf'));
    return 'PDF DESCARGADO.';
  }

  // ── Excel (con estilos propios) ─────────────────────────────────
  function excel(r) {
    if (!window.XLSX) throw new Error('NO SE ENCONTRÓ EL GENERADOR EXCEL.');
    const X = XLSX, ws = {}, merges = [], filas = [];
    const ancho = 8;
    const linea = { style: 'thin', color: { rgb: 'B0BEC5' } };
    const bordes = { top: linea, bottom: linea, left: linea, right: linea };
    let f = 0;
    const poner = (fila, col, v, s) => { ws[X.utils.encode_cell({ r: fila, c: col })] = { t: typeof v === 'number' ? 'n' : 's', v: v ?? '', s }; };
    const fusion = (fila, alto) => { merges.push({ s: { r: fila, c: 0 }, e: { r: fila, c: ancho - 1 } }); filas[fila] = { hpt: alto }; };
    poner(f, 0, 'DEFEN CIA. LTDA. — ' + tituloGeneral, { font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '1F2937' } }, alignment: { horizontal: 'center', vertical: 'center' } });
    for (let c = 1; c < ancho; c++) poner(f, c, '', { fill: { patternType: 'solid', fgColor: { rgb: '1F2937' } } });
    fusion(f, 30); f++;
    poner(f, 0, subtitulo(r), { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '37474F' } }, alignment: { horizontal: 'center' } });
    fusion(f, 18); f += 2;
    SECCIONES(r).forEach((s) => {
      poner(f, 0, s.titulo, { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '1F2937' } }, fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: bordes });
      for (let c = 1; c < ancho; c++) poner(f, c, '', { fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } }, border: bordes });
      fusion(f, 22); f++;
      s.columnas.forEach((col, c) => poner(f, c, col, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '37474F' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: bordes }));
      filas[f] = { hpt: 30 }; f++;
      if (!s.filas.length) { poner(f, 0, s.vacio || 'SIN REGISTROS', { font: { name: 'Calibri', sz: 10, italic: true }, alignment: { horizontal: 'center' }, border: bordes }); merges.push({ s: { r: f, c: 0 }, e: { r: f, c: s.columnas.length - 1 } }); f++; }
      s.filas.forEach((fila, i) => {
        const fondo = i % 2 ? undefined : { patternType: 'solid', fgColor: { rgb: 'ECEFF1' } };
        fila.forEach((v, c) => {
          const dias = c === fila.length - 1;
          const estilo = { font: { name: 'Calibri', sz: 10, bold: dias, color: { rgb: dias ? TONOS[v.tono][0] : '1F2937' } }, alignment: { horizontal: c === 2 ? 'left' : 'center', vertical: 'center' }, border: bordes };
          if (dias) estilo.fill = { patternType: 'solid', fgColor: { rgb: TONOS[v.tono][1] } }; else if (fondo) estilo.fill = fondo;
          poner(f, c, dias ? v.texto : v, estilo);
        });
        filas[f] = { hpt: 20 }; f++;
      });
      if (s.nota) { poner(f, 0, s.nota, { font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '475569' } }, alignment: { wrapText: true } }); fusion(f, 28); f++; }
      f++;
    });
    poner(f, 0, `GENERADO EL ${fecha(hoyIso())} DESDE DEFEN DASHBOARD`, { font: { name: 'Calibri', sz: 8, italic: true, color: { rgb: '94A3B8' } } });
    ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: f, c: ancho - 1 } });
    ws['!merges'] = merges;
    ws['!rows'] = filas;
    ws['!cols'] = [5, 22, 34, 16, 12, 15, 15, 17].map((wch) => ({ wch }));
    const libro = X.utils.book_new();
    X.utils.book_append_sheet(libro, ws, 'VENCIMIENTOS');
    X.writeFile(libro, nombreArchivo(r, 'xlsx'));
    return 'EXCEL DESCARGADO.';
  }

  window.generarReporteGerenciaVencimientos = async function (formato) {
    try {
      const r = datos();
      const mensaje = formato === 'pdf' ? pdf(r) : formato === 'excel' ? excel(r) : await imagen(r);
      if (formato === 'imagen') alert(mensaje);
    } catch (e) {
      alert(`NO SE PUDO GENERAR EL REPORTE: ${e.message || e}`);
    }
  };
})();
