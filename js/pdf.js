// ================================================================
// pdf.js — Generador PDF global con membrete DEFEN CIA. LTDA.
// Respeta los filtros globales activos en todas sus secciones.
// ================================================================

// ── Helpers de filtrado, compartidos por todas las secciones ──

// Proyectos de una provincia que pasan los filtros globales activos
function proyectosFiltradosProvincia(n) {
    const todosNeutros = !Object.keys(filtrosActivos).some(g => grupoActivo(g));
    if (todosNeutros) return (detalleProvincias[n] && detalleProvincias[n].proyectosList) || [];
    return calcTotalesFiltrados(n).proyectosList || [];
}

// Nombres de puesto (en mayúsculas) de una provincia que pasan los
// filtros de jornada/arma/radio activos — usado para recortar armamento/radios
function puestosQuePasanFiltro(n) {
    const hayFiltro = grupoActivo('jornada') || grupoActivo('arma') || grupoActivo('radio');
    const todos = Object.values(puestosData[n] || {}).flat();
    if (!hayFiltro) return new Set(todos.map(p => (p.nombre||'').toUpperCase().trim()));
    return new Set(todos.filter(p => {
        if (grupoActivo('jornada')) {
            const tipo = (p.tipo||'').toLowerCase().replace(/\s/g,'');
            if (!filtrosActivos.jornada.some(j => tipo.includes(j))) return false;
        }
        const armado   = p.armado === true || String(p.armado).toLowerCase() === 'si';
        const conRadio = p.radio  === true || String(p.radio).toLowerCase()  === 'si';
        if (grupoActivo('arma')  && !filtrosActivos.arma.some(v => (v==='armado'&&armado)||(v==='desarmado'&&!armado))) return false;
        if (grupoActivo('radio') && !filtrosActivos.radio.some(v => (v==='conradio'&&conRadio)||(v==='sinradio'&&!conRadio))) return false;
        return true;
    }).map(p => (p.nombre||'').toUpperCase().trim()));
}

async function generarPDFGlobal() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const MARGEN_PDF = 25; // 2.5 cm — encabezado y pie de página
    const hoy = new Date();
    const fh  = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;

    const DARK  = [15,23,42];
    const BLUE  = [37,99,235];
    const GREEN = [22,163,74];
    const RED   = [220,38,38];
    const AMB   = [217,119,6];
    const GRAY  = [241,245,249];
    const LGRAY = [248,250,252];
    const ORANGE = [245,158,11];
    const PURPLE = [124,58,237];

    const inc = {
        resumen:    document.getElementById('pdf-resumen')?.checked,
        contrato:   document.getElementById('pdf-contrato')?.checked ?? true,
        armamento:  document.getElementById('pdf-armamento')?.checked,
        radios:     document.getElementById('pdf-radios')?.checked,
        personal:   document.getElementById('pdf-personal')?.checked,
        proyectos:  document.getElementById('pdf-proyectos')?.checked,
        tramites:   document.getElementById('pdf-tramites')?.checked,
        puestos:    document.getElementById('pdf-puestos')?.checked,
    };

    const LOGO_B64 = window._LOGO_B64 || '';
    let paginaUsada = false;

    // ── Membrete orientación-agnóstico: usa el tamaño REAL de la página
    // actual (detecta automáticamente si es horizontal u vertical) ──
    const encabezado = (titulo) => {
        if (paginaUsada) doc.addPage();
        paginaUsada = true;
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();

        doc.setFillColor(209,213,219);
        doc.rect(0, 0, W, MARGEN_PDF, 'F');
        doc.setFillColor(15,15,15);
        doc.triangle(60, MARGEN_PDF, W, 5, W, MARGEN_PDF, 'F');
        try { doc.addImage(LOGO_B64, 'PNG', W-34, 5, 22, 16); } catch(e) {}
        doc.setTextColor(30,30,30);
        doc.setFontSize(12); doc.setFont('helvetica','bold');
        doc.text('DEFEN CIA. LTDA.', 8, 12);
        doc.setFontSize(7.5); doc.setFont('helvetica','normal');
        doc.setTextColor(71,85,105);
        doc.text(titulo, 8, 18);
        doc.setFontSize(6.5);
        doc.text(`Generado: ${fh}`, 8, 23);

        const yFooter = H - MARGEN_PDF;
        doc.setDrawColor(...ORANGE);
        doc.setLineWidth(0.8);
        doc.line(14, yFooter+4, W-14, yFooter+4);
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105);
        doc.text('Dirección: Cdla. Álamos II Mz K Solar 09', W/2, yFooter+9, {align:'center'});
        doc.text('Correo Electrónico: info@defen.com.ec  ·  Guayaquil - Ecuador', W/2, yFooter+14, {align:'center'});
    };

    // Cambia de orientación de página (para la sección de Armamento, más ancha)
    const encabezadoOrientado = (titulo, orientacion) => {
        doc.addPage('a4', orientacion);
        paginaUsada = true;
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        doc.setFillColor(209,213,219);
        doc.rect(0, 0, W, MARGEN_PDF, 'F');
        doc.setFillColor(15,15,15);
        doc.triangle(60, MARGEN_PDF, W, 5, W, MARGEN_PDF, 'F');
        try { doc.addImage(LOGO_B64, 'PNG', W-34, 5, 22, 16); } catch(e) {}
        doc.setTextColor(30,30,30);
        doc.setFontSize(12); doc.setFont('helvetica','bold');
        doc.text('DEFEN CIA. LTDA.', 8, 12);
        doc.setFontSize(7.5); doc.setFont('helvetica','normal');
        doc.setTextColor(71,85,105);
        doc.text(titulo, 8, 18);
        doc.setFontSize(6.5);
        doc.text(`Generado: ${fh}`, 8, 23);
        const yFooter = H - MARGEN_PDF;
        doc.setDrawColor(...ORANGE); doc.setLineWidth(0.8);
        doc.line(14, yFooter+4, W-14, yFooter+4);
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105);
        doc.text('Dirección: Cdla. Álamos II Mz K Solar 09', W/2, yFooter+9, {align:'center'});
        doc.text('Correo Electrónico: info@defen.com.ec  ·  Guayaquil - Ecuador', W/2, yFooter+14, {align:'center'});
    };

    let y = 0;

    const encabezadoMini = () => {
        if (paginaUsada) doc.addPage();
        paginaUsada = true;
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        doc.setFillColor(15,15,15); doc.rect(0,0,W,MARGEN_PDF*0.6,'F');
        try { doc.addImage(LOGO_B64, 'PNG', W-20, 2, 14, 10); } catch(e) {}
        doc.setTextColor(220,220,220); doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.text('DEFEN CIA. LTDA. — Reporte Operativo Nacional', 8, 10);
        doc.text(fh, W-26, 10, {align:'right'});
        const yFooter = H - MARGEN_PDF;
        doc.setDrawColor(...ORANGE); doc.setLineWidth(0.8);
        doc.line(14, yFooter+4, W-14, yFooter+4);
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105);
        doc.text('Dirección: Cdla. Álamos II Mz K Solar 09', W/2, yFooter+9, {align:'center'});
        doc.text('Correo Electrónico: info@defen.com.ec  ·  Guayaquil - Ecuador', W/2, yFooter+14, {align:'center'});
    };

    const didDrawPageHook = (data) => {
        if (data.pageNumber > 1) {
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            doc.setFillColor(15,15,15); doc.rect(0,0,W,MARGEN_PDF*0.6,'F');
            try { doc.addImage(LOGO_B64, 'PNG', W-20, 2, 14, 10); } catch(e) {}
            doc.setTextColor(220,220,220); doc.setFontSize(7); doc.setFont('helvetica','normal');
            doc.text('DEFEN CIA. LTDA. — Reporte Operativo Nacional', 8, 10);
            doc.text(fh, W-26, 10, {align:'right'});
            const yFooter = H - MARGEN_PDF;
            doc.setDrawColor(...ORANGE); doc.setLineWidth(0.8);
            doc.line(14, yFooter+4, W-14, yFooter+4);
            doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105);
            doc.text('Dirección: Cdla. Álamos II Mz K Solar 09', W/2, yFooter+9, {align:'center'});
            doc.text('Correo Electrónico: info@defen.com.ec  ·  Guayaquil - Ecuador', W/2, yFooter+14, {align:'center'});
        }
    };

    // Provincias que pasan el filtro Y tienen al menos un proyecto que también pasa
    const provsActivas = Object.keys(data)
        .filter(n => data[n].proyectos > 0 && proyectosFiltradosProvincia(n).length > 0)
        .sort();

    const W210 = 210; // ancho estándar vertical, usado en cálculos de layout de esta función

    // ════════════════════════════════════════════════
    // SECCIÓN 1 — RESUMEN EJECUTIVO
    // ════════════════════════════════════════════════
    if (inc.resumen) {
        encabezado('Reporte Operativo Nacional — Resumen Ejecutivo');
        y = 33;

        let totalG=0, totalA=0, totalPu=0, totalPr=0;
        provsActivas.forEach(n => {
            proyectosFiltradosProvincia(n).forEach(p => {
                totalG  += Number(p.guardias)||0;
                totalA  += Number(p.armas)   ||0;
                totalPu += Number(p.puestos) ||0;
                totalPr++;
            });
        });

        const kpis = [
            ['Guardia(s)',  totalG,  BLUE],
            ['Arma(s)',     totalA,  RED],
            ['Puesto(s)',   totalPu, GREEN],
            ['Proyecto(s)', totalPr, AMB],
        ];
        const bw = (W210-28)/4 - 3;
        kpis.forEach(([lbl, val, col], i) => {
            const x = 14 + i*(bw+4);
            doc.setFillColor(...GRAY); doc.roundedRect(x, y, bw, 18, 2, 2, 'F');
            doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(...col);
            doc.text(String(val), x+bw/2, y+11, {align:'center'});
            doc.setFontSize(6);  doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
            doc.text(lbl.toUpperCase(), x+bw/2, y+16, {align:'center'});
        });
        y += 24;

        doc.autoTable({
            startY: y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
            head: [['N°','Provincia','Tipo','Estado','Guardia(s)','Arma(s)','Puesto(s)','Proy.']],
            body: numerarFilas(provsActivas.map(n => {
                const inf = data[n];
                let g=0,a=0,pu=0;
                const proys = proyectosFiltradosProvincia(n);
                proys.forEach(p => { g+=Number(p.guardias)||0; a+=Number(p.armas)||0; pu+=Number(p.puestos)||0; });
                return [n, inf.tipo, inf.estado, g, a, pu, proys.length];
            })),
            headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
            bodyStyles:{fontSize:7,cellPadding:2},
            alternateRowStyles:{fillColor:LGRAY},
            columnStyles:{0:{halign:'center'},1:{fontStyle:'bold'},4:{halign:'center'},5:{halign:'center'},6:{halign:'center'},7:{halign:'center'}}
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 1B — RESUMEN POR TIPO DE CONTRATO (ODC / CT / BROW / CUST)
    // ════════════════════════════════════════════════
    if (inc.contrato) {
        encabezado('Resumen por Tipo de Contrato'); y = 33;

        const categorias = {
            ODC:  { g:0, a:0, pu:0, pr:0 },
            CT:   { g:0, a:0, pu:0, pr:0 },
            BROW: { g:0, a:0, pu:0, pr:0 },
            CUST: { g:0, a:0, pu:0, pr:0 },
            'SIN CLASIFICAR': { g:0, a:0, pu:0, pr:0 }
        };
        const globalT = { g:0, a:0, pu:0, pr:0 };

        provsActivas.forEach(n => {
            proyectosFiltradosProvincia(n).forEach(p => {
                const cat = (p.tipoContrato || '').toUpperCase().trim();
                const key = ['ODC','CT','BROW','CUST'].includes(cat) ? cat : 'SIN CLASIFICAR';
                categorias[key].g  += Number(p.guardias)||0;
                categorias[key].a  += Number(p.armas)   ||0;
                categorias[key].pu += Number(p.puestos) ||0;
                categorias[key].pr++;
                globalT.g += Number(p.guardias)||0;
                globalT.a += Number(p.armas)   ||0;
                globalT.pu+= Number(p.puestos) ||0;
                globalT.pr++;
            });
        });

        // KPIs por categoría (tarjetas de color)
        const coloresCat = { ODC:AMB, CT:GREEN, BROW:PURPLE, CUST:[71,85,105], 'SIN CLASIFICAR':[148,163,184] };
        const claves = ['ODC','CT','BROW','CUST','SIN CLASIFICAR'];
        const bwc = (W210-28)/5 - 2.5;
        claves.forEach((k,i) => {
            const x = 14 + i*(bwc+3);
            doc.setFillColor(...GRAY); doc.roundedRect(x,y,bwc,20,2,2,'F');
            doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...coloresCat[k]);
            doc.text(String(categorias[k].g), x+bwc/2, y+10, {align:'center'});
            doc.setFontSize(5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
            doc.text(k, x+bwc/2, y+15, {align:'center'});
            doc.setFontSize(4.5);
            doc.text(`${categorias[k].pr} proy.`, x+bwc/2, y+18.5, {align:'center'});
        });
        y += 26;

        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
        doc.text('Detalle por categoría de contrato', 14, y); y += 5;

        doc.autoTable({
            startY: y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
            head: [['Categoría','Guardia(s)','Arma(s)','Puesto(s)','Proyecto(s)']],
            body: claves.map(k => [k, categorias[k].g, categorias[k].a, categorias[k].pu, categorias[k].pr]),
            foot: [['GLOBAL', globalT.g, globalT.a, globalT.pu, globalT.pr]],
            headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:8,fontStyle:'bold',cellPadding:3},
            footStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontSize:9,fontStyle:'bold',cellPadding:3},
            bodyStyles:{fontSize:8,cellPadding:2.5}, alternateRowStyles:{fillColor:LGRAY},
            columnStyles:{0:{fontStyle:'bold'},1:{halign:'center'},2:{halign:'center'},3:{halign:'center'},4:{halign:'center'}}
        });
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 2 — ARMAMENTO GLOBAL (mismo formato que el módulo de Armamento)
    // ════════════════════════════════════════════════
    if (inc.armamento) {
        encabezadoOrientado('Inventario de Armamento — Nacional', 'landscape');
        const Wl = doc.internal.pageSize.getWidth();
        y = 33;

        const armObj = armamento || {};
        const kpisArm = [
            ['Global',      armObj.global||0,      DARK],
            ['En Campo',    armObj.enCampo||0,     RED],
            ['En Tránsito', armObj.enTransito||0,  BLUE],
            ['Rastrillo',   armObj.rastrillo||0,   [71,85,105]],
            ['Pérdida/Rob.',armObj.perdida||0,     [220,38,38]],
            ['Confiscada',  armObj.confiscada||0,  AMB],
        ];
        const bwA = (Wl-28)/6 - 2;
        kpisArm.forEach(([lbl,val,col],i) => {
            const x = 14 + i*(bwA+2.4);
            doc.setFillColor(...GRAY); doc.roundedRect(x,y,bwA,16,2,2,'F');
            doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...col);
            doc.text(String(val), x+bwA/2, y+10, {align:'center'});
            doc.setFontSize(5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
            doc.text(lbl.toUpperCase(), x+bwA/2, y+14.5, {align:'center'});
        });
        y += 22;

        // Recortar armamentoDetalle según provincias y puestos que pasan el filtro
        const armamentoFiltrado = (armamentoDetalle || []).filter(a => {
            if (!provsActivas.includes(a.provincia)) return false;
            const puestosOk = puestosQuePasanFiltro(a.provincia);
            if (a.puesto && puestosOk.size >= 0) {
                return puestosOk.has((a.puesto||'').toUpperCase().trim());
            }
            return true;
        });

        if (armamentoFiltrado.length > 0) {
            doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
            doc.text(`Inventario detallado (${armamentoFiltrado.length} arma(s))`, 14, y); y += 5;

            doc.autoTable({
                startY: y, margin:{left:10,right:10,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                head: [['N°','Código','Serie','Clase','Tipo','Marca','Calibre','Categoría','Emisión','Expiración','Estado','Proyecto','Provincia','Ubicación']],
                body: numerarFilas(armamentoFiltrado.map(a => [
                    a.codigoArma||'—', a.serie||'—', a.clase||'—', a.tipo||'—', a.marca||'—', a.calibre||'—',
                    a.categoria||'—', a.fechaEmision?formatFecha(a.fechaEmision):'—', a.fechaExpiracion?formatFecha(a.fechaExpiracion):'—',
                    a.estado||'—', a.proyecto||'—', a.provincia||'—', a.ubicacion||'—'
                ])),
                headStyles:{fillColor:RED,textColor:[255,255,255],fontSize:6.5,fontStyle:'bold',cellPadding:2},
                bodyStyles:{fontSize:6.5,cellPadding:1.8}, alternateRowStyles:{fillColor:LGRAY},
                columnStyles:{0:{halign:'center'}}
            });
        } else {
            doc.setFontSize(9); doc.setTextColor(100,116,139);
            doc.text('No hay armas registradas para los filtros activos.', 14, y);
        }
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 3 — RADIOS GLOBAL (mismo formato que el módulo de Radios)
    // ════════════════════════════════════════════════
    if (inc.radios) {
        encabezado('Inventario de Radios — Nacional'); y = 33;

        const radiosFiltrados = (radiosDetalle || []).filter(r => {
            if (!provsActivas.includes(r.provincia)) return false;
            const puestosOk = puestosQuePasanFiltro(r.provincia);
            if (r.puesto) return puestosOk.has((r.puesto||'').toUpperCase().trim());
            return true;
        });

        doc.setFillColor(...GRAY); doc.roundedRect(14,y,W210-28,14,2,2,'F');
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...PURPLE);
        doc.text(`Total radios registrados: ${radiosFiltrados.length}`, W210/2, y+9, {align:'center'});
        y += 18;

        if (radiosFiltrados.length > 0) {
            doc.autoTable({
                startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                head:[['N°','Provincia','Proyecto','Puesto','Modelo','Serie']],
                body: numerarFilas(radiosFiltrados.map(r => [r.provincia, r.proyecto, r.puesto||'—', r.modelo||'—', r.serie||'—'])),
                headStyles:{fillColor:PURPLE,textColor:[255,255,255],fontSize:7.5,fontStyle:'bold',cellPadding:2.5},
                bodyStyles:{fontSize:7.5,cellPadding:2.2}, alternateRowStyles:{fillColor:LGRAY},
                columnStyles:{0:{halign:'center'}}
            });
        } else {
            doc.setFontSize(9); doc.setTextColor(100,116,139);
            doc.text('No hay radios registrados para los filtros activos.', 14, y+8);
        }
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 4 — PERSONAL / NÓMINA GLOBAL
    // ════════════════════════════════════════════════
    if (inc.personal) {
        encabezado('Nómina de Personal Operativo — Nacional'); y = 33;
        const filas = [];
        provsActivas.forEach(n => {
            const proyOk = new Set(proyectosFiltradosProvincia(n).map(p => p.nombre.toUpperCase().trim()));
            Object.entries(puestosData[n] || {}).forEach(([proyecto, puestosList]) => {
                if (!proyOk.has(proyecto.toUpperCase().trim())) return;
                const puestosOk = puestosFiltrados(n, proyecto);
                puestosOk.forEach(pu => {
                    const gs = Array.isArray(pu.guardias)
                        ? pu.guardias
                        : (pu.guardia||'').split(',').map(g=>g.trim()).filter(Boolean);
                    gs.forEach((g,i) => {
                        filas.push([n, proyecto, pu.nombre, g,
                            i===0 ? 'Turno actual' : 'Rotación',
                            pu.armado===true||String(pu.armado).toLowerCase()==='si' ? 'Sí':'No',
                            pu.tipo||'—', pu.dias||'—']);
                    });
                });
            });
        });

        doc.setFillColor(...GRAY); doc.roundedRect(14,y,W210-28,14,2,2,'F');
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...BLUE);
        doc.text(`Total personal registrado: ${filas.length} agente(s)`, W210/2, y+9, {align:'center'});
        y += 18;

        if (filas.length > 0) {
            doc.autoTable({
                startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                head:[['N°','Provincia','Proyecto','Puesto','Guardia','Rol','Armado','Jornada','Días']],
                body: numerarFilas(filas),
                headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:6,fontStyle:'bold',cellPadding:2},
                bodyStyles:{fontSize:6,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
                columnStyles:{0:{halign:'center'},6:{halign:'center'},1:{fontStyle:'bold'}}
            });
        } else {
            doc.setFontSize(9); doc.setTextColor(100,116,139);
            doc.text('No hay personal registrado para los filtros activos.',14,y+8);
        }
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 5 — PROYECTOS POR PROVINCIA (agrupado, un bloque por provincia)
    // ════════════════════════════════════════════════
    if (inc.proyectos) {
        encabezado('Proyectos Activos por Provincia'); y = 33;

        provsActivas.forEach(n => {
            const proys = proyectosFiltradosProvincia(n);
            if (proys.length === 0) return;

            if (y > 250) { doc.addPage(); encabezadoMini(); y = MARGEN_PDF*0.6 + 8; }

            // Encabezado de provincia (mini stat box a modo de "ficha")
            doc.setFillColor(...DARK);
            doc.roundedRect(14, y, W210-28, 10, 2, 2, 'F');
            doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold');
            doc.text(`📍 ${n}`, 18, y+6.5);
            let gT=0,aT=0; proys.forEach(p=>{gT+=Number(p.guardias)||0;aT+=Number(p.armas)||0;});
            doc.setFontSize(7.5); doc.setFont('helvetica','normal');
            doc.text(`${proys.length} proyecto(s) · ${gT} guardia(s) · ${aT} arma(s)`, W210-18, y+6.5, {align:'right'});
            y += 13;

            doc.autoTable({
                startY: y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                head: [['N°','Proyecto','G.','A.','Pu.','Fin','Días','Estado']],
                body: numerarFilas(proys.map(p => {
                    const d   = diasRestantes(p.fin);
                    const est = d <= 30 ? 'CRÍTICO' : d <= 60 ? 'ALERTA' : 'OK';
                    return [p.nombre, p.guardias, p.armas, p.puestos??'—',
                        p.fin ? formatFecha(p.fin) : '—', `${d < 0 ? 'VENCIDO' : d+'d'}`, est];
                })),
                headStyles:{fillColor:[71,85,105],textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
                bodyStyles:{fontSize:7,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
                columnStyles:{0:{halign:'center'},2:{halign:'center'},3:{halign:'center'},4:{halign:'center'},6:{halign:'center'},7:{halign:'center',fontStyle:'bold'}},
                didParseCell: (d) => {
                    if (d.section === 'body' && d.column.index === 7) {
                        const v = d.cell.raw;
                        if (v === 'CRÍTICO') d.cell.styles.textColor = RED;
                        else if (v === 'ALERTA') d.cell.styles.textColor = AMB;
                        else if (v === 'OK') d.cell.styles.textColor = GREEN;
                    }
                }
            });
            y = doc.lastAutoTable.finalY + 8;
        });
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 6 — ESTADO DE TRÁMITES (con semaforización)
    // ════════════════════════════════════════════════
    if (inc.tramites) {
        encabezado('Estado de Trámites por Provincia'); y = 33;
        const filas = Object.keys(data).sort().map(n => {
            const det = detalleProvincias[n];
            if (!det) return null;
            let diasV = '—', estadoV = '—';
            if (det.vigenciaFin) {
                const d = Math.round((new Date(det.vigenciaFin) - hoy)/86400000);
                diasV   = d < 0 ? 'VENCIDA' : `${d}d`;
                estadoV = d < 0 ? 'VENCIDA' : d < 90 ? 'POR VENCER' : 'VIGENTE';
            } else if (det.estadoTramite) {
                estadoV = det.estadoTramite;
            }
            return [n, det.tramite||'Sin registro',
                det.vigenciaInicio ? formatFecha(det.vigenciaInicio) : '—',
                det.vigenciaFin    ? formatFecha(det.vigenciaFin)    : '—',
                diasV, estadoV];
        }).filter(Boolean);

        doc.autoTable({
            startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
            head:[['N°','Provincia','N° Trámite','Inicio','Fin','Días','Estado']],
            body: numerarFilas(filas),
            headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
            bodyStyles:{fontSize:7,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
            columnStyles:{0:{halign:'center'},5:{halign:'center'},6:{halign:'center',fontStyle:'bold'}},
            didParseCell: (d) => {
                if (d.section === 'body' && d.column.index === 6) {
                    const v = d.cell.raw;
                    if (v === 'VIGENTE')     d.cell.styles.textColor = GREEN;
                    else if (v === 'POR VENCER') d.cell.styles.textColor = AMB;
                    else if (v === 'VENCIDA')    d.cell.styles.textColor = RED;
                }
            }
        });

        y = doc.lastAutoTable.finalY + 8;
        if (y > 260) { doc.addPage(); encabezadoMini(); y = MARGEN_PDF*0.6 + 8; }
        doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
        doc.text('🟢 Vigente     🟡 Por vencer (menos de 90 días)     🔴 Vencida', 14, y);
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 7 — DETALLE DE PUESTOS POR PROVINCIA
    // (combina, para CADA provincia filtrada: resumen + proyectos +
    //  detalle por puesto agrupado por proyecto + mapa esquemático —
    //  el mismo contenido del reporte individual "por provincia", todo
    //  junto en un solo documento)
    // ════════════════════════════════════════════════
    if (inc.puestos) {
        provsActivas.forEach((n, idxProv) => {
            const det   = detalleProvincias[n] || {};
            const proys = proyectosFiltradosProvincia(n);
            if (proys.length === 0) return;

            encabezado(`Detalle de Puestos — ${n}`);
            y = 33;

            // ── Resumen de la provincia ──
            doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
            doc.text(n, 14, y); y += 7;

            doc.setFillColor(...GRAY);
            doc.roundedRect(14, y, W210-28, 18, 3, 3, 'F');
            doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139);
            doc.text('N° TRÁMITE', 20, y+5);
            doc.text('VIGENCIA', 90, y+5);
            doc.text('SUPERVISOR(ES)', 150, y+5);
            doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...DARK);
            doc.text(det.tramite || 'Sin registro', 20, y+12);
            doc.text(det.vigenciaFin ? `${formatFecha(det.vigenciaInicio)} - ${formatFecha(det.vigenciaFin)}` : (det.estadoTramite || '—'), 90, y+12);
            doc.text((det.supervisores && det.supervisores.length) ? det.supervisores.slice(0,2).join(', ') : '—', 150, y+12, { maxWidth: 45 });
            y += 24;

            // ── Tabla de proyectos de esta provincia ──
            doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
            doc.text(`PROYECTOS (${proys.length})`, 14, y); y += 5;
            doc.autoTable({
                startY: y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                head: [['N°','Proyecto','G.','A.','Pu.','Fin','Supervisor(es)']],
                body: numerarFilas(proys.map(p => [
                    p.nombre, p.guardias, p.armas, p.puestos??'—',
                    p.fin ? formatFecha(p.fin) : '—',
                    (p.supervisores && p.supervisores.length) ? p.supervisores.join(', ') : '—'
                ])),
                headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
                bodyStyles:{fontSize:7,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
                columnStyles:{0:{halign:'center'},2:{halign:'center'},3:{halign:'center'},4:{halign:'center'}}
            });
            y = doc.lastAutoTable.finalY + 8;

            // ── Detalle por puesto, agrupado por proyecto ──
            const puestosPorProyectoFiltrados = {};
            proys.forEach(p => {
                const lista = puestosFiltrados(n, p.nombre);
                if (lista.length > 0) puestosPorProyectoFiltrados[p.nombre] = lista;
            });

            if (Object.keys(puestosPorProyectoFiltrados).length > 0) {
                if (y > 245) { doc.addPage(); encabezadoMini(); y = MARGEN_PDF*0.6 + 8; }
                doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
                doc.text('DETALLE POR PUESTO', 14, y); y += 6;

                proys.forEach(p => {
                    const puestos = puestosPorProyectoFiltrados[p.nombre] || [];
                    if (puestos.length === 0) return;
                    if (y > 250) { doc.addPage(); encabezadoMini(); y = MARGEN_PDF*0.6 + 8; }

                    doc.setFillColor(71,85,105);
                    doc.roundedRect(14, y, W210-28, 7, 2, 2, 'F');
                    doc.setTextColor(255,255,255); doc.setFontSize(8.5); doc.setFont('helvetica','bold');
                    doc.text(`${p.nombre} · ${puestos.length} puesto(s)`, 18, y+5);
                    y += 10;

                    doc.autoTable({
                        startY: y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                        head: [['N°','Puesto','Guardia(s)','Tipo','Armado','Arma','Radio']],
                        body: numerarFilas(puestos.map(pu => {
                            const gs = Array.isArray(pu.guardias) ? pu.guardias : (pu.guardia||'').split(',').map(g=>g.trim()).filter(Boolean);
                            return [pu.nombre, gs.join(', ')||'—', pu.tipo||'—',
                                pu.armado?'Sí':'No', pu.armado?(pu.arma||'—'):'—',
                                pu.radio?(pu.radio_info||'Sí'):'No'];
                        })),
                        headStyles:{fillColor:[100,116,139],textColor:[255,255,255],fontSize:6.5,cellPadding:2},
                        bodyStyles:{fontSize:6.5,cellPadding:1.8,overflow:'linebreak'}, alternateRowStyles:{fillColor:LGRAY},
                        columnStyles:{0:{halign:'center'},3:{halign:'center'}}
                    });
                    y = doc.lastAutoTable.finalY + 6;
                });
            }

            // ── Mapa esquemático de la provincia ──
            if (Object.keys(puestosPorProyectoFiltrados).length > 0) {
                if (y > 175) { doc.addPage(); encabezadoMini(); y = MARGEN_PDF*0.6 + 8; }
                doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
                doc.text('MAPA DE PUESTOS', 14, y); y += 5;
                dibujarMapaEsquematico(doc, y, puestosPorProyectoFiltrados, W210);
            }
        });

        if (provsActivas.every(n => proyectosFiltradosProvincia(n).length === 0)) {
            encabezado('Detalle de Puestos por Provincia'); y = 33;
            doc.setFontSize(10); doc.setTextColor(100,116,139);
            doc.text('No hay puestos para mostrar con los filtros activos.', 14, y);
        }
    }

    // ── Número de página dentro del pie de página de 2.5cm ──
    const totalPag = doc.getNumberOfPages();
    for (let i=1; i<=totalPag; i++) {
        doc.setPage(i);
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        doc.setFontSize(6.5); doc.setTextColor(120,113,108);
        doc.text(`Página ${i} de ${totalPag}`, W-14, H-MARGEN_PDF+20, {align:'right'});
        doc.text('Documento confidencial · Uso interno', 14, H-MARGEN_PDF+20);
    }

    const fn = `ReporteNacional_${fh.replace(/\//g,'-')}.pdf`;
    doc.save(fn);
}
