// ================================================================
// novedades.js — Reporte de Novedades de Personal
// Ingresos · Salidas · Faltas Injustificadas (F) · Faltas Justificadas (PM)
// · Llamados de Atención — con corte Semanal o Mensual
// ================================================================

// Calcula el rango de días [inicio, fin] del mes actual según el periodo elegido.
// "semanal" = últimos 7 días calendario (incluyendo hoy).
// "mensual" = del día 1 del mes actual hasta hoy.
// NOTA: la hoja 'asistencia' solo representa el mes en curso (columnas 1-31),
// así que si "semanal" cruza al mes anterior, esos días no estarán disponibles.
function calcularRangoNovedades(periodo) {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    let diaInicio;
    if (periodo === 'semanal') {
        diaInicio = Math.max(1, diaHoy - 6);
    } else {
        diaInicio = 1;
    }
    return { diaInicio, diaFin: diaHoy, hoy };
}

// Convierte "YYYY-MM-DD" a Date, o null
function parseFechaISO(str) {
    return parseFechaLocal(str);
}

// Filtra ingresos/salidas/faltas/llamados según el periodo elegido —
// compartido entre el generador de PDF y el de Excel
function obtenerNovedadesFiltradas(periodo) {
    const { diaInicio, diaFin, hoy } = calcularRangoNovedades(periodo);
    const anio = hoy.getFullYear(), mes = hoy.getMonth();
    const fechaDesde = new Date(anio, mes, diaInicio);
    const fechaHasta = new Date(anio, mes, diaFin, 23, 59, 59);

    const fechaHoyStr = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;
    const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const etiquetaPeriodo = periodo === 'semanal'
        ? `Semanal — ${String(diaInicio).padStart(2,'0')} al ${String(diaFin).padStart(2,'0')} de ${nombresMes[mes]} ${anio}`
        : `Mensual — ${nombresMes[mes]} ${anio} (hasta el ${String(diaFin).padStart(2,'0')})`;

    const ingresosPeriodo = (novedadesPersonal.ingresos || []).filter(r => {
        const f = parseFechaISO(r.fecha);
        return f && f >= fechaDesde && f <= fechaHasta;
    });
    const salidasPeriodo = (novedadesPersonal.salidas || []).filter(r => {
        const f = parseFechaISO(r.fecha);
        return f && f >= fechaDesde && f <= fechaHasta;
    });
    const faltasPeriodo = (novedadesPersonal.faltas || []).map(r => ({
        ...r,
        diasInjustificados: (r.diasInjustificados||[]).filter(d => d >= diaInicio && d <= diaFin),
        diasJustificados:   (r.diasJustificados||[]).filter(d => d >= diaInicio && d <= diaFin)
    })).filter(r => r.diasInjustificados.length > 0 || r.diasJustificados.length > 0);
    const llamadosPeriodo = (llamadosAtencion || []).filter(r => {
        const f = parseFechaISO(r.fecha);
        return f && f >= fechaDesde && f <= fechaHasta;
    });

    return { ingresosPeriodo, salidasPeriodo, faltasPeriodo, llamadosPeriodo, etiquetaPeriodo, fechaHoyStr, hoy };
}

async function generarReporteNovedades() {
    const periodo = document.getElementById('novedades-periodo')?.value || 'semanal';
    const { ingresosPeriodo, salidasPeriodo, faltasPeriodo, llamadosPeriodo, etiquetaPeriodo, fechaHoyStr } = obtenerNovedadesFiltradas(periodo);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const W = 210, H = 297;
    const DARK=[15,23,42], RED=[220,38,38], AMB=[217,119,6], GREEN=[22,163,74], LGRAY=[248,250,252];

    const subt = `Reporte de Novedades de Personal — ${etiquetaPeriodo}`;
    dibujarMembretePDF(doc, subt, fechaHoyStr);
    const didDrawPageNov = () => dibujarMembretePDF(doc, subt, fechaHoyStr);

    let y = MARGEN_PDF + 8;
    doc.setTextColor(...DARK); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('Novedades de Personal', 14, y); y += 6;
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    doc.text(etiquetaPeriodo, 14, y); y += 10;

    // ── KPIs resumen ──
    const kpis = [
        ['Ingresos',  ingresosPeriodo.length, GREEN],
        ['Salidas',   salidasPeriodo.length,  [71,85,105]],
        ['Faltas Injust.', faltasPeriodo.reduce((s,r)=>s+r.diasInjustificados.length,0), RED],
        ['Faltas Justif.', faltasPeriodo.reduce((s,r)=>s+r.diasJustificados.length,0), AMB],
        ['Llamados At.', llamadosPeriodo.length, [124,58,237]],
    ];
    const bw = (W-28)/5 - 2.5;
    kpis.forEach(([lbl,val,col],i) => {
        const x = 14 + i*(bw+3);
        doc.setFillColor(...LGRAY); doc.roundedRect(x,y,bw,16,2,2,'F');
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...col);
        doc.text(String(val), x+bw/2, y+10, {align:'center'});
        doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
        doc.text(lbl.toUpperCase(), x+bw/2, y+14.5, {align:'center'});
    });
    y += 22;

    const tablaSeccion = (titulo, filas, columnas, colorHead) => {
        if (filas.length === 0) return;
        if (y > 245) { doc.addPage(); dibujarMembretePDF(doc, subt, fechaHoyStr); y = MARGEN_PDF + 8; }
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text(`${titulo} (${filas.length})`, 14, y); y += 5;
        doc.autoTable({
            startY: y,
            margin: { left:14, right:14, top:MARGEN_PDF+4, bottom:MARGEN_PDF+4 },
            didDrawPage: didDrawPageNov,
            headStyles:{halign:'center',valign:'middle', fillColor: colorHead, textColor:[255,255,255], fontSize:7, cellPadding:2.5 },
            head: [['N°', ...columnas]],
            body: numerarFilas(filas),
            styles:{halign:'center',valign:'middle', fontSize:7, cellPadding:2.2, overflow:'linebreak', lineColor:[226,232,240], lineWidth:0.3 },
            alternateRowStyles: { fillColor: LGRAY },
            columnStyles: { 0:{halign:'center', cellWidth:8} }
        });
        y = doc.lastAutoTable.finalY + 8;
    };

    // ── 1. Nuevos ingresos (agrupados/clasificados por proyecto) ──
    tablaSeccion(
        'NUEVOS INGRESOS',
        ingresosPeriodo
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [formatFecha(r.fecha), r.nombre, r.cedula||'—', r.puesto, r.proyecto||'—', r.provincia||'—']),
        ['Fecha','Nombre','Cédula','Puesto','Proyecto','Provincia'],
        GREEN
    );

    // ── 2. Salidas ──
    tablaSeccion(
        'SALIDAS',
        salidasPeriodo
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [formatFecha(r.fecha), r.nombre, r.cedula||'—', r.puesto, r.proyecto||'—', r.provincia||'—']),
        ['Fecha','Nombre','Cédula','Puesto','Proyecto','Provincia'],
        [71,85,105]
    );

    // ── 3. Faltas injustificadas ──
    tablaSeccion(
        'FALTAS INJUSTIFICADAS (F)',
        faltasPeriodo
            .filter(r => r.diasInjustificados.length > 0)
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [r.nombre, r.cedula||'—', r.puesto, r.proyecto||'—', r.provincia||'—', String(r.diasInjustificados.length), r.diasInjustificados.join(', ')]),
        ['Nombre','Cédula','Puesto','Proyecto','Provincia','N°','Días'],
        RED
    );

    // ── 4. Faltas justificadas ──
    tablaSeccion(
        'FALTAS JUSTIFICADAS (PM)',
        faltasPeriodo
            .filter(r => r.diasJustificados.length > 0)
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [r.nombre, r.cedula||'—', r.puesto, r.proyecto||'—', r.provincia||'—', String(r.diasJustificados.length), r.diasJustificados.join(', ')]),
        ['Nombre','Cédula','Puesto','Proyecto','Provincia','N°','Días'],
        AMB
    );

    // ── 5. Llamados de atención ──
    tablaSeccion(
        'LLAMADOS DE ATENCIÓN',
        llamadosPeriodo
            .sort((a,b) => (a.proyecto||'').localeCompare(b.proyecto||''))
            .map(r => [formatFecha(r.fecha), r.nombre_guardia||'—', r.puesto||'—', r.proyecto||'—', r.motivo||'—', r.tipo_llamado||'—', r.registrado_por||'—']),
        ['Fecha','Guardia','Puesto','Proyecto','Motivo','Tipo','Registrado por'],
        [124,58,237]
    );

    if (ingresosPeriodo.length===0 && salidasPeriodo.length===0 && faltasPeriodo.length===0 && llamadosPeriodo.length===0) {
        doc.setFontSize(10); doc.setTextColor(148,163,184); doc.setFont('helvetica','italic');
        doc.text('No hay novedades registradas en el periodo seleccionado.', 14, y);
    }

    // ── Numeración de páginas ──
    const totalPag = doc.getNumberOfPages();
    for (let i=1; i<=totalPag; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5); doc.setTextColor(120,113,108);
        doc.text(`Página ${i} de ${totalPag}`, W-14, H-MARGEN_PDF+20, {align:'right'});
        doc.text('Documento confidencial · Uso interno', 14, H-MARGEN_PDF+20);
    }

    doc.save(`Novedades_Personal_${periodo}_DEFEN_${fechaHoyStr.replace(/\//g,'-')}.pdf`);
}

// =====================================================================
// EXCEL — Novedades de Personal (mismas secciones que el PDF, en hojas separadas)
// =====================================================================
function generarExcelNovedades() {
    const periodo = document.getElementById('novedades-periodo')?.value || 'semanal';
    const { ingresosPeriodo, salidasPeriodo, faltasPeriodo, llamadosPeriodo, fechaHoyStr } = obtenerNovedadesFiltradas(periodo);

    if (!ingresosPeriodo.length && !salidasPeriodo.length && !faltasPeriodo.length && !llamadosPeriodo.length) {
        alert('No hay novedades registradas en el periodo seleccionado.');
        return;
    }

    const wb = XLSX.utils.book_new();
    const agregarHoja = (nombre, filas) => {
        if (filas.length === 0) return;
        const ws = XLSX.utils.json_to_sheet(filas);
        ws['!cols'] = Object.keys(filas[0]).map(k => ({ wch: Math.max(k.length+2, 14) }));
        XLSX.utils.book_append_sheet(wb, ws, nombre);
    };

    agregarHoja('Ingresos', ingresosPeriodo.map((r,i) => ({
        'N°': i+1, 'Fecha': formatFecha(r.fecha), 'Nombre': r.nombre, 'Cédula': r.cedula||'',
        'Puesto': r.puesto, 'Proyecto': r.proyecto||'', 'Provincia': r.provincia||''
    })));

    agregarHoja('Salidas', salidasPeriodo.map((r,i) => ({
        'N°': i+1, 'Fecha': formatFecha(r.fecha), 'Nombre': r.nombre, 'Cédula': r.cedula||'',
        'Puesto': r.puesto, 'Proyecto': r.proyecto||'', 'Provincia': r.provincia||''
    })));

    agregarHoja('Faltas Injustificadas', faltasPeriodo.filter(r=>r.diasInjustificados.length>0).map((r,i) => ({
        'N°': i+1, 'Nombre': r.nombre, 'Cédula': r.cedula||'', 'Puesto': r.puesto,
        'Proyecto': r.proyecto||'', 'Provincia': r.provincia||'',
        'N° Faltas': r.diasInjustificados.length, 'Días': r.diasInjustificados.join(', ')
    })));

    agregarHoja('Faltas Justificadas', faltasPeriodo.filter(r=>r.diasJustificados.length>0).map((r,i) => ({
        'N°': i+1, 'Nombre': r.nombre, 'Cédula': r.cedula||'', 'Puesto': r.puesto,
        'Proyecto': r.proyecto||'', 'Provincia': r.provincia||'',
        'N° Faltas': r.diasJustificados.length, 'Días': r.diasJustificados.join(', ')
    })));

    agregarHoja('Llamados de Atención', llamadosPeriodo.map((r,i) => ({
        'N°': i+1, 'Fecha': formatFecha(r.fecha), 'Guardia': r.nombre_guardia||'', 'Puesto': r.puesto||'',
        'Proyecto': r.proyecto||'', 'Motivo': r.motivo||'', 'Tipo': r.tipo_llamado||'', 'Registrado por': r.registrado_por||''
    })));

    XLSX.writeFile(wb, `Novedades_Personal_${periodo}_DEFEN_${fechaHoyStr.replace(/\//g,'-')}.xlsx`);
}
