// ================================================================
// pdf.js — Generador PDF global con membrete DEFEN CIA. LTDA.
// ================================================================

async function generarPDFGlobal() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const W   = 210;
    const H   = 297;
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

    // ── Opciones seleccionadas ──
    const inc = {
        resumen:    document.getElementById('pdf-resumen')?.checked,
        armamento:  document.getElementById('pdf-armamento')?.checked,
        radios:     document.getElementById('pdf-radios')?.checked,
        personal:   document.getElementById('pdf-personal')?.checked,
        proyectos:  document.getElementById('pdf-proyectos')?.checked,
        tramites:   document.getElementById('pdf-tramites')?.checked,
        puestos:    document.getElementById('pdf-puestos')?.checked,
    };

    // ── Logo DEFEN CIA. LTDA. en base64 ──
    const LOGO_B64 = window._LOGO_B64 || ''; // cargado en config desde img/logo.png;

    // ── Bandera: ¿ya se usó alguna página? ──
    // jsPDF crea automáticamente la página 1 al instanciar.
    // Solo llamamos addPage() en la 2da sección en adelante.
    let paginaUsada = false;

    // Encabezado tipo membrete — franja diagonal negra + logo arriba derecha
    const encabezado = (titulo) => {
        if (paginaUsada) doc.addPage();
        paginaUsada = true;

        // ── Encabezado (banda de 25mm) ──
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

        // ── Pie de página (banda de 25mm) ──
        const yFooter = H - MARGEN_PDF;
        doc.setDrawColor(...ORANGE);
        doc.setLineWidth(0.8);
        doc.line(14, yFooter+4, W-14, yFooter+4);
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105);
        doc.text('Dirección: Cdla. Álamos II Mz K Solar 09', W/2, yFooter+9, {align:'center'});
        doc.text('Correo Electrónico: info@defen.com.ec  ·  Guayaquil - Ecuador', W/2, yFooter+14, {align:'center'});
    };

    // Helper línea separadora
    const linea = (y) => {
        doc.setDrawColor(226,232,240);
        doc.line(14, y, W-14, y);
    };

    let y = 0;

    const encabezadoMini = () => {
        if (paginaUsada) doc.addPage();
        paginaUsada = true;
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

    const saltoSiNecesario = (espacio) => {
        if (y + espacio > (H - MARGEN_PDF - 5)) { encabezadoMini(); y = MARGEN_PDF*0.6 + 6; }
    };

    // Hook reutilizable: si autoTable crea una página nueva por desborde,
    // dibuja el membrete mini en esa página automáticamente
    const didDrawPageHook = (data) => {
        if (data.pageNumber > 1) {
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

    // Recoger provincias activas filtradas
    const provsActivas = Object.keys(data)
        .filter(n => provinciaPassaFiltros(n) && data[n].proyectos > 0)
        .sort();

    // ════════════════════════════════════════════════
    // SECCIÓN 1 — RESUMEN EJECUTIVO
    // ════════════════════════════════════════════════
    if (inc.resumen) {
        encabezado('Reporte Operativo Nacional — Resumen Ejecutivo');
        y = 33;

        // KPIs
        let totalG=0, totalA=0, totalPu=0, totalPr=0;
        provsActivas.forEach(n => {
            const det = detalleProvincias[n];
            if (det && det.proyectosList) det.proyectosList.forEach(p => {
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
        const bw = (W-28)/4 - 3;
        kpis.forEach(([lbl, val, col], i) => {
            const x = 14 + i*(bw+4);
            doc.setFillColor(...GRAY); doc.roundedRect(x, y, bw, 18, 2, 2, 'F');
            doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(...col);
            doc.text(String(val), x+bw/2, y+11, {align:'center'});
            doc.setFontSize(6);  doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
            doc.text(lbl.toUpperCase(), x+bw/2, y+16, {align:'center'});
        });
        y += 24;

        // Tabla provincias
        doc.autoTable({
            startY: y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
            head: [['Provincia','Tipo','Estado','Guardia(s)','Arma(s)','Puesto(s)','Proy.']],
            body: provsActivas.map(n => {
                const inf = data[n];
                const det = detalleProvincias[n];
                let g=0,a=0,pu=0;
                if (det && det.proyectosList) det.proyectosList.forEach(p => {
                    g+=Number(p.guardias)||0; a+=Number(p.armas)||0; pu+=Number(p.puestos)||0;
                });
                return [n, inf.tipo, inf.estado, g, a, pu, inf.proyectos];
            }),
            headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
            bodyStyles:{fontSize:7,cellPadding:2},
            alternateRowStyles:{fillColor:LGRAY},
            columnStyles:{0:{fontStyle:'bold'},3:{halign:'center'},4:{halign:'center'},5:{halign:'center'},6:{halign:'center'}}
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 2 — ARMAMENTO GLOBAL
    // ════════════════════════════════════════════════
    if (inc.armamento) {
        encabezado('Inventario de Armamento — Nacional'); y = 33;

        // KPIs de armamento
        const kpisArm = [
            ['Global',      armamento.global||0,      [15,23,42]],
            ['En Campo',    armamento.enCampo||0,     RED],
            ['Rastrillo',   armamento.rastrillo||0,   [37,99,235]],
            ['Pérdida/Rob.',armamento.perdida||0,     [220,38,38]],
            ['Confiscada',  armamento.confiscada||0,  [217,119,6]],
        ];
        const bwA = (W-28)/5 - 2;
        kpisArm.forEach(([lbl,val,col],i) => {
            const x = 14 + i*(bwA+2.5);
            doc.setFillColor(...GRAY); doc.roundedRect(x,y,bwA,16,2,2,'F');
            doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(...col);
            doc.text(String(val), x+bwA/2, y+10, {align:'center'});
            doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
            doc.text(lbl.toUpperCase(), x+bwA/2, y+14.5, {align:'center'});
        });
        y += 22;

        // Usar armamento_detalle si está disponible
        if (armamentoDetalle && armamentoDetalle.length > 0) {
            doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
            doc.text('Inventario detallado por arma:', 14, y); y += 5;

            doc.autoTable({
                startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                head:[['Provincia','Proyecto','Puesto','Serie','Tipo','Modalidad','Clase']],
                body: armamentoDetalle
                    .filter(a => provsActivas.includes(a.provincia) || provsActivas.length===0)
                    .map(a => [a.provincia||'—', a.proyecto||'—', a.puesto||'—',
                               a.serie||'—', a.tipo||'—', a.modalidad||'—', a.clase||'—']),
                headStyles:{fillColor:RED,textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
                bodyStyles:{fontSize:6.5,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
                columnStyles:{6:{halign:'center'}}
            });
        } else {
            // Fallback: resumen por proyecto
            const filas = [];
            provsActivas.forEach(n => {
                const det = detalleProvincias[n];
                if (!det || !det.proyectosList) return;
                det.proyectosList.forEach(p => {
                    if (p.armas > 0) filas.push([n, p.nombre, p.armas,
                        '— Completa la hoja armamento_detalle en Excel']);
                });
            });
            if (filas.length > 0) {
                doc.autoTable({
                    startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                    head:[['Provincia','Proyecto','Arma(s)','Detalle']],
                    body: filas,
                    headStyles:{fillColor:RED,textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
                    bodyStyles:{fontSize:7,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
                    columnStyles:{2:{halign:'center',cellWidth:16}}
                });
            }
        }
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 3 — RADIOS GLOBAL
    // ════════════════════════════════════════════════
    if (inc.radios) {
        encabezado('Inventario de Radios — Nacional'); y = 33;
        const filas = [];
        provsActivas.forEach(n => {
            const puestosP = Object.values(puestosData[n] || {}).flat();
            puestosP.forEach(pu => {
                const conRadio = pu.radio === true || String(pu.radio).toLowerCase() === 'si';
                if (conRadio) filas.push([n, pu.nombre, pu.radio_info || 'TH510', pu.guardia || '—']);
            });
        });

        doc.setFillColor(...GRAY); doc.roundedRect(14,y,W-28,14,2,2,'F');
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(124,58,237);
        doc.text(`Total radios registrados: ${filas.length}`, W/2, y+9, {align:'center'});
        y += 18;

        if (filas.length > 0) {
            doc.autoTable({
                startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                head:[['Provincia','Puesto','Modelo/Serie','Guardia asignado']],
                body: filas,
                headStyles:{fillColor:[124,58,237],textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
                bodyStyles:{fontSize:7,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY}
            });
        } else {
            doc.setFontSize(9); doc.setTextColor(100,116,139);
            doc.text('No hay radios registrados en los puestos cargados.',14,y+8);
        }
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 4 — PERSONAL / NÓMINA GLOBAL
    // ════════════════════════════════════════════════
    if (inc.personal) {
        encabezado('Nómina de Personal Operativo — Nacional'); y = 33;
        const filas = [];
        provsActivas.forEach(n => {
            Object.entries(puestosData[n] || {}).forEach(([proyecto, puestosList]) => {
                puestosList.forEach(pu => {
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

        doc.setFillColor(...GRAY); doc.roundedRect(14,y,W-28,14,2,2,'F');
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...BLUE);
        doc.text(`Total personal registrado: ${filas.length} agente(s)`, W/2, y+9, {align:'center'});
        y += 18;

        if (filas.length > 0) {
            doc.autoTable({
                startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                head:[['Provincia','Proyecto','Puesto','Guardia','Rol','Armado','Jornada','Días']],
                body: filas,
                headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:6,fontStyle:'bold',cellPadding:2},
                bodyStyles:{fontSize:6,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
                columnStyles:{5:{halign:'center'},0:{fontStyle:'bold'}}
            });
        } else {
            doc.setFontSize(9); doc.setTextColor(100,116,139);
            doc.text('No hay personal registrado en los puestos cargados.',14,y+8);
        }
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 5 — PROYECTOS POR PROVINCIA
    // ════════════════════════════════════════════════
    if (inc.proyectos) {
        encabezado('Proyectos Activos por Provincia'); y = 33;
        const filas = [];
        provsActivas.forEach(n => {
            const det = detalleProvincias[n];
            if (!det || !det.proyectosList) return;
            det.proyectosList.forEach(p => {
                const d   = diasRestantes(p.fin);
                const est = d <= 30 ? 'CRÍTICO' : d <= 60 ? 'ALERTA' : 'OK';
                filas.push([n, p.nombre, p.guardias, p.armas, p.puestos??'—',
                    p.fin ? formatFecha(p.fin) : '—', `${d < 0 ? 'VENCIDO' : d+'d'}`, est]);
            });
        });

        doc.autoTable({
            startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
            head:[['Provincia','Proyecto','G.','A.','Pu.','Fin','Días','Estado']],
            body: filas,
            headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
            bodyStyles:{fontSize:7,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
            columnStyles:{2:{halign:'center'},3:{halign:'center'},4:{halign:'center'},6:{halign:'center'},7:{halign:'center',fontStyle:'bold'}},
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 7) {
                    const v = data.cell.raw;
                    if (v === 'CRÍTICO') data.cell.styles.textColor = RED;
                    else if (v === 'ALERTA') data.cell.styles.textColor = AMB;
                    else if (v === 'OK') data.cell.styles.textColor = GREEN;
                }
            }
        });
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 6 — ESTADO DE TRÁMITES
    // ════════════════════════════════════════════════
    if (inc.tramites) {
        encabezado('Estado de Trámites por Provincia'); y = 33;
        const filas = Object.keys(data).sort().map(n => {
            const det = detalleProvincias[n];
            if (!det) return null;
            const ti = det;
            let diasV = '—', estadoV = '—';
            if (ti.vigenciaFin) {
                const d = Math.round((new Date(ti.vigenciaFin) - hoy)/86400000);
                diasV   = d < 0 ? 'VENCIDA' : `${d}d`;
                estadoV = d < 0 ? 'VENCIDA' : d < 90 ? 'POR VENCER' : 'VIGENTE';
            } else if (ti.estadoTramite) {
                estadoV = ti.estadoTramite;
            }
            return [n, ti.tramite||'Sin registro',
                ti.vigenciaInicio ? formatFecha(ti.vigenciaInicio) : '—',
                ti.vigenciaFin    ? formatFecha(ti.vigenciaFin)    : '—',
                diasV, estadoV];
        }).filter(Boolean);

        doc.autoTable({
            startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
            head:[['Provincia','N° Trámite','Inicio','Fin','Días','Estado']],
            body: filas,
            headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:7,fontStyle:'bold',cellPadding:2.5},
            bodyStyles:{fontSize:7,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
            columnStyles:{4:{halign:'center'},5:{halign:'center'}}
        });
    }

    // ════════════════════════════════════════════════
    // SECCIÓN 7 — PUESTOS OPERATIVOS
    // ════════════════════════════════════════════════
    if (inc.puestos) {
        encabezado('Detalle de Puestos Operativos'); y = 33;
        const filas = [];
        provsActivas.forEach(n => {
            Object.entries(puestosData[n] || {}).forEach(([proyecto, lista]) => {
                lista.forEach(pu => {
                    const gs = Array.isArray(pu.guardias)
                        ? pu.guardias.join(', ')
                        : (pu.guardia||'—');
                    filas.push([n, proyecto, pu.nombre, gs,
                        pu.tipo||'—',
                        pu.armado===true||String(pu.armado).toLowerCase()==='si'?'Sí':'No',
                        pu.radio===true||String(pu.radio).toLowerCase()==='si'?'Sí':'No',
                        pu.turno||'—', pu.dias||'—']);
                });
            });
        });

        if (filas.length > 0) {
            doc.autoTable({
                startY:y, margin:{left:14,right:14,bottom:29,top:19}, didDrawPage: didDrawPageHook,
                head:[['Prov.','Proyecto','Puesto','Guardia(s)','Jornada','Arma','Radio','Turno','Días']],
                body: filas,
                headStyles:{fillColor:DARK,textColor:[255,255,255],fontSize:6,fontStyle:'bold',cellPadding:2},
                bodyStyles:{fontSize:6,cellPadding:2}, alternateRowStyles:{fillColor:LGRAY},
                columnStyles:{5:{halign:'center'},6:{halign:'center'}}
            });
        } else {
            doc.setFontSize(9); doc.setTextColor(100,116,139);
            doc.text('No hay puestos con coordenadas registradas aún.',14,y+8);
        }
    }

    // ── Número de página dentro del pie de página de 2.5cm ──
    const total = doc.getNumberOfPages();
    for (let i=1; i<=total; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5); doc.setTextColor(120,113,108);
        doc.text(`Página ${i} de ${total}`, W-14, H-MARGEN_PDF+20, {align:'right'});
        doc.text('Documento confidencial · Uso interno', 14, H-MARGEN_PDF+20);
    }

    const fn = `ReporteNacional_${fh.replace(/\//g,'-')}.pdf`;
    doc.save(fn);
}
