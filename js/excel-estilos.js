// ================================================================
// excel-estilos.js — Presentación gerencial para TODOS los Excel
//   Requiere la librería xlsx-js-style (misma API que SheetJS, pero
//   guarda estilos). Al descargar cualquier Excel del sistema se aplica:
//   encabezado oscuro con texto blanco, bordes, filas alternadas, anchos
//   de columna ajustados, filtros y altura de encabezado.
//   Las hojas que ya traen estilos propios no se modifican.
// ================================================================
(function () {
  if (!window.XLSX || !XLSX.utils) return;
  const X = XLSX;
  const COLOR = { encabezado: '37474F', textoEncabezado: 'FFFFFF', alterna: 'ECEFF1', borde: 'B0BEC5', titulo: '1F2937' };
  const linea = { style: 'thin', color: { rgb: COLOR.borde } };
  const BORDES = { top: linea, bottom: linea, left: linea, right: linea };
  const FUENTE = { name: 'Calibri', sz: 10, color: { rgb: '1F2937' } };

  const ESTILO_ENCABEZADO = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: COLOR.textoEncabezado } },
    fill: { patternType: 'solid', fgColor: { rgb: COLOR.encabezado } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: BORDES
  };

  const tieneEstilos = (ws) => Object.keys(ws).some((k) => k[0] !== '!' && ws[k] && ws[k].s);
  const texto = (c) => (c == null || c.v == null ? '' : c.t === 'd' ? '0000-00-00' : String(c.w ?? c.v));

  function estilizarHoja(ws) {
    if (!ws || !ws['!ref'] || tieneEstilos(ws)) return;
    const r = X.utils.decode_range(ws['!ref']);
    const columnas = r.e.c - r.s.c + 1;
    const filas = r.e.r - r.s.r + 1;
    const celda = (f, c) => ws[X.utils.encode_cell({ r: f, c })];

    // Hoja de instrucciones (una sola columna): primera fila como título
    if (columnas === 1) {
      for (let f = r.s.r; f <= r.e.r; f++) {
        const c = celda(f, r.s.c); if (!c) continue;
        c.s = f === r.s.r
          ? { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: COLOR.encabezado } }, alignment: { vertical: 'center' } }
          : { font: FUENTE, alignment: { vertical: 'center', wrapText: true } };
      }
      ws['!rows'] = ws['!rows'] || []; ws['!rows'][r.s.r] = { hpt: 24 };
      return;
    }

    // Anchos: se calculan solo si la hoja no los definió
    const anchos = [];
    for (let c = r.s.c; c <= r.e.c; c++) {
      let max = 0;
      for (let f = r.s.r; f <= Math.min(r.e.r, r.s.r + 400); f++) max = Math.max(max, texto(celda(f, c)).length);
      anchos.push(Math.min(48, Math.max(9, max + 2)));
    }
    if (!ws['!cols']) ws['!cols'] = anchos.map((wch) => ({ wch }));

    const encabezado = r.s.r;
    for (let f = r.s.r; f <= r.e.r; f++) {
      for (let c = r.s.c; c <= r.e.c; c++) {
        const ref = X.utils.encode_cell({ r: f, c });
        let x = ws[ref];
        if (!x) { x = ws[ref] = { t: 's', v: '' }; }
        if (f === encabezado) { x.s = JSON.parse(JSON.stringify(ESTILO_ENCABEZADO)); continue; }
        const ancho = (ws['!cols'][c - r.s.c] || {}).wch || anchos[c - r.s.c];
        const corto = x.t === 'n' || x.t === 'd' || x.t === 'b' || texto(x).length <= 14 || ancho <= 12;
        x.s = {
          font: FUENTE,
          fill: (f - encabezado) % 2 === 0 ? { patternType: 'solid', fgColor: { rgb: COLOR.alterna } } : undefined,
          alignment: { horizontal: corto ? 'center' : 'left', vertical: 'center', wrapText: texto(x).length > 60 },
          border: BORDES
        };
        if (!x.s.fill) delete x.s.fill;
      }
    }
    ws['!rows'] = ws['!rows'] || [];
    ws['!rows'][encabezado] = { hpt: 30 };
    if (filas > 1 && !ws['!autofilter'] && !(ws['!merges'] || []).length) {
      ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: encabezado, c: r.s.c }, e: { r: r.e.r, c: r.e.c } }) };
    }
  }

  function estilizarLibro(libro) {
    if (!libro || !libro.Sheets) return libro;
    try {
      (libro.SheetNames || []).forEach((n) => estilizarHoja(libro.Sheets[n]));
      libro.Props = Object.assign({ Company: 'DEFEN CIA. LTDA.', Author: 'DEFEN Dashboard' }, libro.Props || {});
    } catch (e) { console.warn('Estilos de Excel:', e); }
    return libro;
  }
  window.estilizarLibroExcel = estilizarLibro;

  ['writeFile', 'writeFileXLSX'].forEach((nombre) => {
    const original = X[nombre];
    if (typeof original !== 'function') return;
    X[nombre] = function (libro, archivo, opciones) {
      return original.call(this, estilizarLibro(libro), archivo, Object.assign({ cellStyles: true }, opciones || {}));
    };
  });
})();
