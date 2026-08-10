// Inicializamos jsPDF desde la variable global inyectada en el HTML
const { jsPDF } = window.jspdf;

// Función para mostrar mensajes de error sutiles en el modal
function mostrarError(mensaje) {
    const notif = document.getElementById('actaNotificacion');
    notif.innerText = mensaje;
    notif.style.display = 'block';
    setTimeout(() => { notif.style.display = 'none'; }, 4000);
}

function abrirModalActa() {
    document.getElementById('modalActaArmamento').style.display = 'block';
    document.getElementById('actaNotificacion').style.display = 'none';
    cargarSelectArmas();
}

function cerrarModalActa() {
    document.getElementById('modalActaArmamento').style.display = 'none';
}

function cambiarTipoActa() {
    const tipo = document.getElementById('actaTipo').value;
    const divSupervisor = document.getElementById('divSupervisor');
    const cargoRecibe = document.getElementById('actaCargoRecibe');
    
    if(tipo === 'guardia') {
        divSupervisor.style.display = 'block';
        cargoRecibe.value = 'GUARDIA DE SEGURIDAD';
    } else {
        divSupervisor.style.display = 'none';
        cargoRecibe.value = 'Custodio VIP';
    }
}

function cargarSelectArmas() {
    const select = document.getElementById('actaArmaSeleccionada');
    select.innerHTML = '';
    
    // Reemplaza estadoGlobal.armamento por tu variable real del sistema
    const armas = typeof estadoGlobal !== 'undefined' && estadoGlobal.armamento ? estadoGlobal.armamento : []; 
    
    if (armas.length === 0) {
        let option = document.createElement('option');
        option.text = "ARMA DE PRUEBA - PISTOLA CEONIC (Serie: TL409-23A00330)";
        option.dataset.datos = JSON.stringify({
            tipo: "PISTOLA", clase: "ARMA LETAL", categoria: "VIGILANCIA MOVIL", 
            calibre: "9 MM", marca: "CEONIC", serie: "TL409-23A00330",
            urlImagenArma: null, urlCredencial: null
        });
        select.appendChild(option);
    } else {
        armas.forEach(arma => {
            let option = document.createElement('option');
            option.value = arma.serie; 
            option.text = `${arma.tipo} - ${arma.marca} (Serie: ${arma.serie}) - Cal: ${arma.calibre}`;
            option.dataset.datos = JSON.stringify(arma);
            select.appendChild(option);
        });
    }
}

function prepararYGenerarActa() {
    const btn = document.getElementById('btnGenerarPDF');
    const select = document.getElementById('actaArmaSeleccionada');
    
    if(!select.options[select.selectedIndex] || !select.options[select.selectedIndex].dataset.datos) {
        mostrarError("Por favor, seleccione un arma válida.");
        return;
    }

    if (!document.getElementById('actaNombreRecibe').value || !document.getElementById('actaCedulaRecibe').value) {
        mostrarError("Por favor, complete al menos el nombre y la cédula de quien recibe.");
        return;
    }
    
    btn.innerText = 'Cargando Imágenes...';
    btn.disabled = true;
    
    const armaInfo = JSON.parse(select.options[select.selectedIndex].dataset.datos);
    
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function(imagenesBase64) {
                generarPDF(armaInfo, imagenesBase64);
                restaurarBoton();
            })
            .withFailureHandler(function(err) {
                mostrarError("Error al obtener imágenes. Generando acta sin imágenes...");
                setTimeout(() => {
                    generarPDF(armaInfo, { armaBase64: null, credencialBase64: null });
                    restaurarBoton();
                }, 2000);
            })
            .obtenerImagenesArmaBase64(armaInfo.urlImagenArma, armaInfo.urlCredencial);
    } else {
        console.warn("Entorno local detectado. Generando sin imágenes de Drive.");
        generarPDF(armaInfo, { armaBase64: null, credencialBase64: null });
        restaurarBoton();
    }
}

function restaurarBoton() {
    const btn = document.getElementById('btnGenerarPDF');
    btn.innerText = 'Generar PDF';
    btn.disabled = false;
    cerrarModalActa();
}

function generarPDF(arma, imagenes) {
    const tipoActa = document.getElementById('actaTipo').value;
    const mesNombres = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const hoy = new Date();
    
    const datosForm = {
        nombreRecibe: document.getElementById('actaNombreRecibe').value.toUpperCase(),
        cedulaRecibe: document.getElementById('actaCedulaRecibe').value,
        cargoRecibe: document.getElementById('actaCargoRecibe').value.toUpperCase(),
        proyecto: document.getElementById('actaProyecto').value.toUpperCase(),
        municiones: document.getElementById('actaMuniciones').value,
        novedades: document.getElementById('actaNovedades').value.toUpperCase(),
        dia: hoy.getDate(),
        mes: mesNombres[hoy.getMonth()],
        anio: hoy.getFullYear()
    };

    if (tipoActa === 'custodio') {
        generarActaCustodio(arma, imagenes, datosForm);
    } else {
        generarActaGuardia(arma, imagenes, datosForm);
    }
}

function generarActaCustodio(arma, imgs, form) {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Encabezado
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("DEFEN CIA LTDA", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("GUAYAQUIL – ECUADOR", 105, 27, { align: "center" });
    doc.setFontSize(14);
    doc.text("ACTA DE ENTREGA, RECEPCIÓN Y USO DE ARMAMENTO", 105, 36, { align: "center" });
    
    // Número de Codificación dinámico
    doc.setFontSize(10);
    doc.text(`NO.:0${form.dia}-${(new Date().getMonth()+1).toString().padStart(2, '0')}-${form.anio}_01`, 105, 42, { align: "center" });

    // Cuerpo del texto
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    const p1 = `En la ciudad de Guayaquil, a los ${form.dia} días del mes de ${form.mes} del año ${form.anio}, se suscribe la presente ACTA DE ENTREGA, RECEPCIÓN Y USO DE ARMAMENTO, mediante la cual se deja constancia de la entrega de un Arma tipo ${arma.tipo || 'pistola'}, clase “${arma.clase || 'arma letal'}”, categoría “${arma.categoria || 'vigilancia móvil'}”, calibre ${arma.calibre || '9 MM'} marca ${arma.marca || 'CEONIC'} perteneciente a la compañía de seguridad DEFEN CIA. LTDA., debidamente identificado con el número de serie ${arma.serie || 'N/A'}.`;
    
    const p2 = `El Sr. ${form.nombreRecibe} con CI. ${form.cedulaRecibe}, de ahora en adelante denominado como “${form.cargoRecibe}”, declara haber recibido el equipo en buenas condiciones de funcionamiento, comprometiéndose a su correcta utilización, custodia y conservación durante el tiempo que permanezca bajo su responsabilidad. Cabe recalcar que el departamento de Operaciones dispone evidencia fotográfica del estado del mismo.`;
    
    const p3 = `En tal virtud, el custodio recibe el equipo para el cumplimiento de sus funciones laborales, comprometiéndose a utilizarlo, custodiarlo y conservarlo de manera adecuada, conforme a los protocolos internos y a las instrucciones impartidas por la empresa. En caso de pérdida, daño, deterioro o cualquier otro desperfecto que afecte al equipo entregado, la empresa llevará a cabo las investigaciones correspondientes, con el objeto de determinar las causas, circunstancias y eventuales responsabilidades derivadas del hecho. Si como resultado de dichas actuaciones se estableciere que la responsabilidad es imputable al custodio, este asumirá las consecuencias administrativas a que hubiere lugar, de conformidad con lo previsto en el Código del Trabajo, la normativa interna vigente y demás disposiciones aplicables.`;
    
    const p4 = `Asimismo, el custodio se compromete a no manipular, alterar o intervenir técnicamente el equipo sin la debida autorización, y a reportar de manera inmediata cualquier novedad o falla que se presente durante su uso.\n\nPara constancia de lo anterior, las partes firman el presente documento en señal de aceptación y conformidad.`;

    const arrP1 = doc.splitTextToSize(p1, 170);
    const arrP2 = doc.splitTextToSize(p2, 170);
    const arrP3 = doc.splitTextToSize(p3, 170);
    const arrP4 = doc.splitTextToSize(p4, 170);
    
    let y = 52;
    doc.text(arrP1, 20, y, { align: "justify" }); y += (arrP1.length * 5) + 4;
    doc.text(arrP2, 20, y, { align: "justify" }); y += (arrP2.length * 5) + 4;
    doc.text(arrP3, 20, y, { align: "justify" }); y += (arrP3.length * 5) + 4;
    doc.text(arrP4, 20, y, { align: "justify" }); y += (arrP4.length * 5) + 6;

    // Tabla
    doc.setFont("helvetica", "bold");
    doc.text("Arma de dotación:", 20, y); y += 6;
    
    doc.setFontSize(8);
    doc.setFillColor(230, 230, 230);
    doc.rect(20, y, 170, 8, 'F');
    doc.rect(20, y, 170, 16); 
    doc.line(20, y + 8, 190, y + 8); 
    
    doc.text("N°", 22, y + 5);
    doc.text("CLASE", 30, y + 5);
    doc.text("CATEGORÍA", 55, y + 5);
    doc.text("TIPO", 85, y + 5);
    doc.text("MARCA", 105, y + 5);
    doc.text("CALIBRE", 125, y + 5);
    doc.text("SERIE", 145, y + 5);
    doc.text("MUNIC.", 175, y + 5);

    doc.setFont("helvetica", "normal");
    doc.text("1", 22, y + 13);
    doc.text(arma.clase || 'ARMA LETAL', 30, y + 13);
    doc.text(arma.categoria || 'VIG. MOVIL', 55, y + 13);
    doc.text(arma.tipo || 'PISTOLA', 85, y + 13);
    doc.text(arma.marca || 'CEONIC', 105, y + 13);
    doc.text(arma.calibre || '9 MM', 125, y + 13);
    doc.text(arma.serie || 'N/A', 145, y + 13);
    doc.text(form.municiones.toString(), 175, y + 13);
    y += 22;

    // Imágenes
    if(imgs.armaBase64) doc.addImage(imgs.armaBase64, 'JPEG', 30, y, 60, 45);
    if(imgs.credencialBase64) doc.addImage(imgs.credencialBase64, 'JPEG', 100, y, 80, 45);
    
    y += 50;
    
    const pFinal = `En fe de lo cual, y habiendo leído íntegramente el contenido del presente documento, las partes intervinientes ratifican su conformidad con cada una de las cláusulas aquí establecidas, firmando en dos ejemplares de igual tenor y valor legal, en la ciudad de Guayaquil, a los ${form.dia} días del mes de ${form.mes} del año ${form.anio}.`;
    const arrPFinal = doc.splitTextToSize(pFinal, 170);
    doc.text(arrPFinal, 20, y, { align: "justify" });
    
    // Firmas
    y += 30;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(form.cargoRecibe, 105, y, { align: "center" });
    doc.text("_________________________________", 105, y + 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${form.nombreRecibe}`, 105, y + 12, { align: "center" });
    doc.text(`Ci.: ${form.cedulaRecibe}`, 105, y + 18, { align: "center" });

    doc.save(`006_Acta_Custodio_${form.cedulaRecibe}.pdf`);
}

function generarActaGuardia(arma, imgs, form) {
    const doc = new jsPDF('l', 'mm', 'a4'); // Horizontal
    const supNombre = document.getElementById('actaNombreEntrega').value.toUpperCase();
    const supCedula = document.getElementById('actaCedulaEntrega').value;

    doc.setFillColor(60, 60, 60);
    doc.rect(10, 10, 277, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("DEFEN CIA. LTDA. - ACTA DE RECEPCIÓN DE DOTACIONES", 148, 22, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    
    doc.rect(10, 30, 277, 24); 
    
    doc.setFont("helvetica", "bold");
    doc.text("FECHA", 12, 35); doc.setFont("helvetica", "normal"); doc.text(`${form.dia} de ${form.mes} del ${form.anio}`, 40, 35);
    doc.setFont("helvetica", "bold");
    doc.text("CATEGORÍA", 140, 35); doc.setFont("helvetica", "normal"); doc.text(`ARMAMENTO - ${arma.clase || 'NO LETAL'}`, 170, 35);
    
    doc.setFont("helvetica", "bold");
    doc.text("NOMBRE", 12, 43); doc.setFont("helvetica", "normal"); doc.text(form.nombreRecibe, 40, 43);
    doc.setFont("helvetica", "bold");
    doc.text("CÉDULA", 140, 43); doc.setFont("helvetica", "normal"); doc.text(form.cedulaRecibe, 170, 43);
    
    doc.setFont("helvetica", "bold");
    doc.text("CARGO", 12, 51); doc.setFont("helvetica", "normal"); doc.text(form.cargoRecibe, 40, 51);
    doc.setFont("helvetica", "bold");
    doc.text("ÁREA / PROYECTO", 140, 51); doc.setFont("helvetica", "normal"); doc.text(form.proyecto, 175, 51);

    doc.setFillColor(200, 200, 200);
    doc.rect(10, 60, 277, 8, 'F');
    doc.rect(10, 60, 277, 16); 
    doc.line(10, 68, 287, 68); 
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("CANT.", 12, 65);
    doc.text("CLASE", 25, 65);
    doc.text("VIGILANCIA", 55, 65);
    doc.text("TIPO", 80, 65);
    doc.text("MARCA", 100, 65);
    doc.text("CALIBRE", 120, 65);
    doc.text("SERIE", 140, 65);
    doc.text("APTA/NO", 175, 65);
    doc.text("MUNICIONES", 195, 65);
    doc.text("COMENTARIO / NOVEDAD", 220, 65);
    
    doc.setFont("helvetica", "normal");
    doc.text("1", 15, 73);
    doc.text(arma.clase || 'NO LETAL', 25, 73);
    doc.text(arma.categoria || 'FIJA', 55, 73);
    doc.text(arma.tipo || 'PISTOLA', 80, 73);
    doc.text(arma.marca || 'CEONIC', 100, 73);
    doc.text(arma.calibre || '9 MM', 120, 73);
    doc.text(arma.serie || 'N/A', 140, 73);
    doc.text("APTA", 178, 73);
    doc.text(form.municiones.toString(), 203, 73);
    
    let comentario = form.novedades !== 'N/A' ? form.novedades : "SE ENTREGA PERMISO ORIGINAL";
    doc.text(comentario, 220, 73);

    if(imgs.armaBase64) doc.addImage(imgs.armaBase64, 'JPEG', 30, 90, 80, 55);
    if(imgs.credencialBase64) doc.addImage(imgs.credencialBase64, 'JPEG', 150, 90, 95, 55);

    doc.setFontSize(9);
    
    doc.setFont("helvetica", "bold");
    doc.text("ENTREGA", 50, 175, { align: "center" });
    doc.text("___________________________________", 50, 185, { align: "center" });
    doc.text("SUPERVISOR", 50, 190, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${supNombre}`, 50, 195, { align: "center" });
    doc.text(`CI: ${supCedula}`, 50, 200, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.text("RECIBE", 230, 175, { align: "center" });
    doc.text("___________________________________", 230, 185, { align: "center" });
    doc.text("AGENTE DE SEGURIDAD", 230, 190, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${form.nombreRecibe}`, 230, 195, { align: "center" });
    doc.text(`CI: ${form.cedulaRecibe}`, 230, 200, { align: "center" });

    doc.save(`Acta_Guardia_${form.cedulaRecibe}.pdf`);
}
