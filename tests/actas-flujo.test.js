const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

class Rango {
  constructor(hoja, fila, columna, filas, columnas) {
    Object.assign(this, { hoja, fila, columna, filas, columnas });
  }
  getValues() {
    return Array.from({ length: this.filas }, (_, i) =>
      Array.from({ length: this.columnas }, (_, j) => this.hoja.datos[this.fila - 1 + i]?.[this.columna - 1 + j] ?? '')
    );
  }
  setValues(valores) {
    valores.forEach((r, i) => r.forEach((v, j) => {
      const fi = this.fila - 1 + i, co = this.columna - 1 + j;
      while (this.hoja.datos.length <= fi) this.hoja.datos.push([]);
      while (this.hoja.datos[fi].length <= co) this.hoja.datos[fi].push('');
      this.hoja.datos[fi][co] = v;
    }));
    return this;
  }
  getValue() { return this.getValues()[0][0]; }
  setValue(valor) { return this.setValues([[valor]]); }
  clearContent() { return this.setValue(''); }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
}

class Hoja {
  constructor(nombre, datos = []) { this.nombre = nombre; this.datos = datos; }
  getName() { return this.nombre; }
  getLastRow() {
    for (let i = this.datos.length - 1; i >= 0; i--) if (this.datos[i].some(v => v !== '' && v !== undefined)) return i + 1;
    return 0;
  }
  getLastColumn() { return this.datos.reduce((m, r) => Math.max(m, r.length), 0); }
  getRange(f, c, nf = 1, nc = 1) { return new Rango(this, f, c, nf, nc); }
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
  setFrozenRows() {}
  deleteRows(inicio, cantidad) { this.datos.splice(inicio - 1, cantidad); }
}

const hoja = new Hoja('actas_armamento');
const hojaInventario = new Hoja('armamento_detalle', [[
  'codigo_arma','serie','clase','categoria','tipo','marca','calibre','estado','proyecto','provincia','puesto','ubicacion','url_guia_envio','url_guia_retorno'
],[
  'AR-1','SERIE-1','LETAL','MOVIL','PISTOLA','PRUEBA','9MM','Activo','PROYECTO ANTERIOR','GUAYAS','PUESTO ANTERIOR','PUESTO ANTERIOR','',''
]]);
const hojas = new Map([['actas_armamento', hoja], ['armamento_detalle', hojaInventario]]);
const ss = {
  getSheetByName(nombre) { return hojas.get(nombre) || null; },
  insertSheet(nombre) { const nueva = new Hoja(nombre); hojas.set(nombre, nueva); return nueva; }
};
const propiedades = new Map();
const contexto = vm.createContext({
  console, Set, Date, Number, String, Math,
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => propiedades.get(k) || null,
    setProperty: (k, v) => propiedades.set(k, v)
  }) },
  Session: { getScriptTimeZone: () => 'America/Guayaquil' },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (_alg, valor) => [...crypto.createHash('sha256').update(valor, 'utf8').digest()],
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
    base64Decode: valor => [...Buffer.from(valor, 'base64')],
    newBlob: (bytes, mime, nombre) => ({ bytes, mime, nombre }),
    getUuid: () => crypto.randomUUID(),
    formatDate: fecha => String(fecha.getFullYear())
  },
  DriveApp: {
    getFileById: () => ({ setTrashed() {} }),
    getFolderById: () => ({ createFile: blob => ({
      blob,
      getId: () => 'archivo-guia-1',
      getUrl: () => 'https://drive.google.com/file/d/archivo-guia-1/view',
      setTrashed() {}
    }) })
  },
  Logger: { log() {} }
});

vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'CODE.GS.txt'), 'utf8'), contexto);
contexto.validarSesionActas = () => ({ usuario: 'admin', rol: 'admin' });
contexto.jsonOut = valor => valor;
contexto.leerHoja = (_ss, nombre) => nombre === 'armamento_detalle' ? [{
  codigo_arma: 'AR-1', serie: 'SERIE-1', clase: 'LETAL', categoria: 'MOVIL',
  tipo: 'PISTOLA', marca: 'PRUEBA', calibre: '9MM', estado: 'ACTIVO'
}] : [];

const acta = {
  tipoActa: 'GUARDIA', fecha: '2026-08-15', ciudad: 'Guayaquil',
  receptorNombre: 'Juan Prueba', receptorCedula: '0912345678', receptorOrigen: 'registrado',
  cargo: '', proyecto: 'PROYECTO', provincia: 'GUAYAS', puesto: '',
  alimentadoras: 1, municiones: 5, permiso: 'ORIGINAL', comentario: '', novedad: '',
  supervisorNombre: 'Supervisor', supervisorCedula: '',
  armas: [{ codigoArma: 'AR-1', serie: 'SERIE-1' }]
};

const crear = contexto.crearActaArmamento;
const eliminar = contexto.eliminarUltimaActa;
const listarPendientes = contexto.listarGuiasPendientes;
const subsanar = contexto.subsanarGuiaActa;
const listarTransito = contexto.listarMovimientosTransito;
const confirmarLlegada = contexto.confirmarLlegadaArmas;
const iniciarRetorno = contexto.iniciarRetornoArmas;
const subsanarMovimiento = contexto.subsanarGuiaMovimiento;
const regularizar = contexto.regularizarArmas;
const registrarNovedad = contexto.registrarNovedadArma;
const iniciarRecuperacion = contexto.iniciarRecuperacionArma;
const listarHistorialMovimientos = contexto.listarHistorialMovimientos;
const eliminarMovimientoHistorial = contexto.eliminarMovimientoHistorial;
const reportarEstadoTecnico = contexto.reportarEstadoTecnicoArma;
const iniciarMantenimiento = contexto.iniciarMantenimientoArma;
const confirmarRecepcionArmero = contexto.confirmarRecepcionArmero;
const finalizarMantenimiento = contexto.finalizarMantenimientoArma;
const iniciarRetornoMantenimiento = contexto.iniciarRetornoMantenimiento;
const confirmarRetornoMantenimiento = contexto.confirmarRetornoMantenimiento;
const listarMantenimientos = contexto.listarMantenimientosArmamento;
const supervisoresMigrados = contexto.obtenerSupervisoresConfigurados(ss, [{ provincia:'GUAYAS', nombre:'PROYECTO SUPERVISADO', supervisores:'Supervisor Uno, Supervisor Dos' }]);
const hojaSupervisores = hojas.get('supervisores');
if (supervisoresMigrados.length !== 2 || !hojaSupervisores || hojaSupervisores.getLastRow() !== 3) throw new Error('No se creó o migró correctamente la hoja supervisores.');
const columnasSupervisores = contexto.estructuraHojaControl(hojaSupervisores).cols;
hojaSupervisores.datos[1][columnasSupervisores.cedula] = 912345678;
const supervisoresConfigurados = contexto.obtenerSupervisoresConfigurados(ss, []);
const supervisorUno = supervisoresConfigurados.find(s => s.nombre === 'Supervisor Uno');
if (!supervisorUno || supervisorUno.cedula !== '0912345678' || supervisorUno.provincia !== 'GUAYAS' || supervisorUno.proyecto !== 'PROYECTO SUPERVISADO') throw new Error('La hoja supervisores no normalizó cédula, provincia y proyecto.');
const primera = crear({ token: 'ok', idSolicitud: 'solicitud-00000001', acta });
if (!primera.ok || primera.reutilizada || hoja.getLastRow() !== 2) throw new Error('Falló la creación inicial.');
if (hoja.datos[0].length !== hoja.datos[1].length) throw new Error(`Encabezados (${hoja.datos[0].length}) y fila (${hoja.datos[1].length}) no coinciden.`);
let columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
if (hojaInventario.datos[1][columnasInventario.estado] !== 'Transito' || listarTransito({ token: 'ok' }).cantidad !== 1) throw new Error('El arma no pasó al estado Transito.');
if (!primera.pendienteSubsanar || listarPendientes({ token: 'ok' }).cantidad !== 1) throw new Error('No se registró la emergencia como pendiente de subsanar.');
const subsanada = subsanar({ token: 'ok', codigo: primera.codigo, guia: { nombre: 'guia.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-prueba').toString('base64') } });
if (!subsanada.ok || listarPendientes({ token: 'ok' }).cantidad !== 0) throw new Error('Falló la subsanación de la guía.');
contexto.validarSesionActas = () => ({ usuario: 'operaciones', rol: 'operaciones' });
const sinGuiaOperaciones = crear({ token: 'ok', idSolicitud: 'solicitud-ops-0001', acta });
if (sinGuiaOperaciones.ok || !String(sinGuiaOperaciones.mensaje).includes('obligatoria')) throw new Error('Operaciones pudo crear un acta sin guía.');
contexto.validarSesionActas = () => ({ usuario: 'admin', rol: 'admin' });
const llegada = confirmarLlegada({ token: 'ok', codigoActa: primera.codigo });
columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
if (!llegada.ok || hojaInventario.datos[1][columnasInventario.estado] !== 'Activo' || listarTransito({ token: 'ok' }).cantidad !== 0) throw new Error('Falló la confirmación de llegada.');
const llegadaRepetida = confirmarLlegada({ token: 'ok', codigoActa: primera.codigo });
if (!llegadaRepetida.ok || !llegadaRepetida.reutilizada) throw new Error('La confirmación repetida no fue idempotente.');

const repetida = crear({ token: 'ok', idSolicitud: 'solicitud-00000001', acta });
if (!repetida.ok || !repetida.reutilizada || repetida.codigo !== primera.codigo || hoja.getLastRow() !== 2) throw new Error('Falló la idempotencia.');

const conflicto = crear({ token: 'ok', idSolicitud: 'solicitud-00000002', acta });
if (!conflicto.requiereConfirmacion || hoja.getLastRow() !== 2) throw new Error('No se solicitó confirmación para reemplazar el acta vigente.');

const segunda = crear({ token: 'ok', idSolicitud: 'solicitud-00000002', confirmarInvalidacion: true, acta });
const columnas = contexto.columnasActas(hoja);
if (!segunda.ok || hoja.datos[1][columnas.estado_acta] !== 'INVALIDADA' || hoja.datos[2][columnas.estado_acta] !== 'VIGENTE') throw new Error('Falló la invalidación y reemplazo.');

const borrada = eliminar({ token: 'ok', codigo: segunda.codigo });
if (!borrada.ok || hoja.getLastRow() !== 2 || hoja.datos[1][columnas.estado_acta] !== 'VIGENTE') throw new Error('Falló la restauración al eliminar el reemplazo.');
columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
if (hojaInventario.datos[1][columnasInventario.estado] !== 'Activo' || hojaInventario.datos[1][columnasInventario.acta_vigente] !== primera.codigo) throw new Error('No se restauró el estado anterior del inventario al eliminar el acta.');

contexto.validarSesionActas = () => ({ usuario: 'operaciones', rol: 'operaciones' });
const retornoSinGuiaOps = iniciarRetorno({ token: 'ok', idSolicitud: 'retorno-ops-000001', series: ['SERIE-1'], destino: 'MANABI', fecha: '2026-08-16' });
if (retornoSinGuiaOps.ok || !String(retornoSinGuiaOps.mensaje).includes('obligatoria')) throw new Error('Operaciones pudo iniciar un retorno sin guía.');
contexto.validarSesionActas = () => ({ usuario: 'admin', rol: 'admin' });
const retorno = iniciarRetorno({ token: 'ok', idSolicitud: 'retorno-0000000001', series: ['SERIE-1'], destino: 'MANABI', fecha: '2026-08-16', observacion: 'Retorno de prueba' });
columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
if (!retorno.ok || hojaInventario.datos[1][columnasInventario.estado] !== 'Transito' || listarTransito({ token: 'ok' }).cantidad !== 1) throw new Error('Falló el inicio del retorno.');
const pendientesRetorno = listarPendientes({ token: 'ok' }).pendientes;
if (!pendientesRetorno.some(x => x.tipoPendiente === 'MOVIMIENTO' && x.loteId === retorno.loteId)) throw new Error('El retorno de emergencia no apareció pendiente de subsanar.');
const guiaRetorno = subsanarMovimiento({ token: 'ok', loteId: retorno.loteId, guia: { nombre: 'retorno.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-retorno').toString('base64') } });
if (!guiaRetorno.ok) throw new Error('Falló la subsanación de la guía de retorno.');
const recepcionRastrillo = confirmarLlegada({ token: 'ok', loteId: retorno.loteId });
columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
if (!recepcionRastrillo.ok || hojaInventario.datos[1][columnasInventario.estado] !== 'Rastrillo' || hojaInventario.datos[1][columnasInventario.proyecto] !== '' || hojaInventario.datos[1][columnasInventario.provincia] !== 'MANABI') throw new Error('Falló la recepción en el rastrillo.');
if (hoja.datos[1][columnas.estado_acta] !== 'FINALIZADA') throw new Error('El acta no quedó FINALIZADA después del retorno.');
const eliminaFinalizada = eliminar({ token: 'ok', codigo: primera.codigo });
columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
if (!eliminaFinalizada.ok || hojaInventario.datos[1][columnasInventario.estado] !== 'Activo' || hojaInventario.datos[1][columnasInventario.proyecto] !== 'PROYECTO ANTERIOR') throw new Error('No se restauró el origen al eliminar un acta finalizada.');

hojaInventario.datos[1][columnasInventario.url_guia_envio] = 'https://drive.google.com/file/d/guia-existente/view';
const solicitudRegularizacion = { token: 'ok', idSolicitud: 'regulariza-00000001', modo: 'LOTE', fecha: '2026-08-16', ciudad: 'Guayaquil', provincia: 'GUAYAS', proyecto: 'PROYECTO ANTERIOR', entregaNombre: 'Jefe de Operaciones', registros: [{ serie: 'SERIE-1', tipoActa: 'GUARDIA', responsableNombre: 'Supervisor Regularización', responsableCedula: '0912345678', cargo: 'SUPERVISOR', puesto: 'PUESTO ANTERIOR', alimentadoras: 1, municiones: 5 }] };
const regularizada = regularizar(solicitudRegularizacion);
columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
const columnasActaRegularizada = contexto.columnasActas(hoja);
if (!regularizada.ok || regularizada.codigos.length !== 1 || hojaInventario.datos[1][columnasInventario.estado] !== 'Activo' || hojaInventario.datos[1][columnasInventario.acta_vigente] !== regularizada.codigos[0]) throw new Error('Falló la regularización en lote.');
if (hoja.datos[1][columnasActaRegularizada.estado_documental] !== 'RESPALDO_EXISTENTE') throw new Error('No se reutilizó la guía existente durante la regularización.');
const regularizadaRepetida = regularizar(solicitudRegularizacion);
if (!regularizadaRepetida.ok || !regularizadaRepetida.reutilizada || hoja.getLastRow() !== 2) throw new Error('La regularización repetida creó duplicados.');
const crearFilaInventario = (codigo, serie) => { const fila = Array(hojaInventario.datos[0].length).fill(''); fila[columnasInventario.codigo_arma] = codigo; fila[columnasInventario.serie] = serie; fila[columnasInventario.clase] = 'LETAL'; fila[columnasInventario.categoria] = 'MOVIL'; fila[columnasInventario.tipo] = 'PISTOLA'; fila[columnasInventario.marca] = 'PRUEBA'; fila[columnasInventario.calibre] = '9MM'; fila[columnasInventario.estado] = 'Activo'; fila[columnasInventario.proyecto] = 'PROYECTO ANTERIOR'; fila[columnasInventario.provincia] = 'GUAYAS'; fila[columnasInventario.puesto] = 'PUESTO 2'; fila[columnasInventario.ubicacion] = 'PUESTO 2'; return fila; };
hojaInventario.datos.push(crearFilaInventario('AR-2', 'SERIE-2'), crearFilaInventario('AR-3', 'SERIE-3'));
const regularizacionIndividual = regularizar({ token: 'ok', idSolicitud: 'regulariza-ind-0001', modo: 'INDIVIDUAL', fecha: '2026-08-16', ciudad: 'Guayaquil', provincia: 'GUAYAS', proyecto: 'PROYECTO ANTERIOR', entregaNombre: 'Jefe de Operaciones', registros: [
  { serie: 'SERIE-2', tipoActa: 'GUARDIA', responsableNombre: 'Responsable Dos', responsableCedula: '0912345678', puesto: 'PUESTO 2', alimentadoras: 1, municiones: 5 },
  { serie: 'SERIE-3', tipoActa: 'CUSTODIO VIP', responsableNombre: 'Responsable Tres', responsableCedula: '0912345679', puesto: 'PUESTO 2', alimentadoras: 1, municiones: 10 }
] });
if (!regularizacionIndividual.ok || regularizacionIndividual.codigos.length !== 2 || new Set(regularizacionIndividual.codigos).size !== 2) throw new Error('Falló la regularización individual con consecutivos separados.');

const perdida = registrarNovedad({ token:'ok', idSolicitud:'novedad-perdida-0001', series:['SERIE-2'], tipo:'Perdida', fecha:'2026-08-16', observacion:'Denuncia de prueba' });
columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
const filaSerie2 = hojaInventario.datos.find(r => r[columnasInventario.serie] === 'SERIE-2');
if (!perdida.ok || filaSerie2[columnasInventario.estado] !== 'Perdida' || filaSerie2[columnasInventario.acta_vigente] !== regularizacionIndividual.codigos[0]) throw new Error('La pérdida no conservó la asignación y el acta vigente.');
const perdidaRepetida = registrarNovedad({ token:'ok', idSolicitud:'novedad-perdida-0001', series:['SERIE-2'], tipo:'Perdida', fecha:'2026-08-16' });
if (!perdidaRepetida.ok || !perdidaRepetida.reutilizada) throw new Error('La novedad repetida creó un movimiento duplicado.');
const recuperacion = iniciarRecuperacion({ token:'ok', idSolicitud:'recuperacion-0000001', series:['SERIE-2'], destino:'PICHINCHA', fecha:'2026-08-17', observacion:'Arma localizada' });
if (!recuperacion.ok || filaSerie2[columnasInventario.estado] !== 'Transito') throw new Error('La recuperación no pasó el arma a Transito.');
const loteRecuperacion = listarTransito({ token:'ok' }).movimientos.find(m => m.loteId === recuperacion.loteId);
if (!loteRecuperacion || loteRecuperacion.tipoMovimiento !== 'RECUPERACION') throw new Error('La recuperación no apareció como movimiento en tránsito.');
const llegadaRecuperada = confirmarLlegada({ token:'ok', loteId:recuperacion.loteId });
if (!llegadaRecuperada.ok || filaSerie2[columnasInventario.estado] !== 'Rastrillo' || filaSerie2[columnasInventario.provincia] !== 'PICHINCHA' || filaSerie2[columnasInventario.proyecto] !== '' || filaSerie2[columnasInventario.acta_vigente] !== '') throw new Error('La recepción del arma recuperada no terminó en Rastrillo.');
const filaActaRecuperada = hoja.datos.find(r => r[columnasActaRegularizada.codigo_acta] === regularizacionIndividual.codigos[0]);
if (!filaActaRecuperada || filaActaRecuperada[columnasActaRegularizada.estado_acta] !== 'FINALIZADA' || filaActaRecuperada[columnasActaRegularizada.motivo_finalizacion] !== 'RECUPERACIÓN Y RECEPCIÓN EN RASTRILLO') throw new Error('La recuperación no finalizó correctamente el acta vigente.');
const confiscada = registrarNovedad({ token:'ok', idSolicitud:'novedad-confisca-001', series:['SERIE-3'], tipo:'Confiscada', fecha:'2026-08-16', observacion:'Retenida por autoridad' });
const filaSerie3 = hojaInventario.datos.find(r => r[columnasInventario.serie] === 'SERIE-3');
if (!confiscada.ok || filaSerie3[columnasInventario.estado] !== 'Confiscada') throw new Error('Falló la declaración de arma confiscada.');
const historialCompleto = listarHistorialMovimientos({ token:'ok', pagina:1, limite:25 });
if (!historialCompleto.ok || historialCompleto.total < 6 || !historialCompleto.catalogos.tipos.includes('RECUPERACION') || !historialCompleto.catalogos.tipos.includes('CONFISCACION')) throw new Error('El historial no devolvió los movimientos y catálogos esperados.');
const historialSerie2 = listarHistorialMovimientos({ token:'ok', consulta:'SERIE-2', tipo:'RECUPERACION', provincia:'PICHINCHA', desde:'2026-08-17', hasta:'2026-08-17' });
if (!historialSerie2.ok || historialSerie2.total !== 1 || historialSerie2.movimientos[0].serie !== 'SERIE-2') throw new Error('Los filtros del historial no se aplicaron correctamente.');
const validarSesionGuardada = contexto.validarSesionActas;contexto.validarSesionActas = () => null;
const historialSinPermiso = listarHistorialMovimientos({ token:'sin-permiso' });contexto.validarSesionActas = validarSesionGuardada;
if (historialSinPermiso.ok) throw new Error('Un usuario sin permiso pudo consultar el historial de movimientos.');

// Mantenimiento local: conserva asignación y reactiva la misma acta.
const crearActaPruebaMantenimiento = (codigo,serie) => { const headers=hoja.datos[0],fila=Array(headers.length).fill(''),set=(n,v)=>{const i=headers.indexOf(n);if(i>=0)fila[i]=v;};set('codigo_acta',codigo);set('serie',serie);set('estado_acta','VIGENTE');set('fecha_acta','2026-08-18');return fila; };
const filaLocal = crearFilaInventario('AR-4','SERIE-4'); hojaInventario.datos.push(filaLocal); hoja.datos.push(crearActaPruebaMantenimiento('ACT-G-2026-000010','SERIE-4'));
columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
filaLocal[columnasInventario.acta_vigente]='ACT-G-2026-000010';filaLocal[columnasInventario.responsable_nombre]='RESPONSABLE LOCAL';
const novedadTecnica = reportarEstadoTecnico({token:'ok',serie:'SERIE-4',fecha:'2026-08-18',condicion:'MAL ESTADO',observacion:'Falla en mecanismo de alimentación'});
if(!novedadTecnica.ok||filaLocal[columnasInventario.bloqueada_asignacion]!=='SI'||filaLocal[columnasInventario.condicion_tecnica]!=='MAL ESTADO')throw new Error('No se bloqueó el arma con mala condición técnica.');
const colsActasMtto=contexto.columnasActas(hoja),filaActaLocal=hoja.datos.find(r=>r[colsActasMtto.codigo_acta]==='ACT-G-2026-000010');
if(filaActaLocal[colsActasMtto.estado_acta]!=='SUSPENDIDA_MANTENIMIENTO')throw new Error('La novedad técnica grave no suspendió el acta.');
const mttoLocal=iniciarMantenimiento({token:'ok',idSolicitud:'mtto-local-0001',serie:'SERIE-4',tipoServicio:'CORRECTIVO',modalidad:'LOCAL',armeroTipo:'INTERNO',armeroNombre:'ARMERO INTERNO',armeroUbicacion:'PROYECTO ANTERIOR',fecha:'2026-08-18',problema:'Falla en mecanismo de alimentación'});
if(!mttoLocal.ok||filaLocal[columnasInventario.estado]!=='Activo'||filaLocal[columnasInventario.condicion_tecnica]!=='EN MANTENIMIENTO')throw new Error('Falló el inicio del mantenimiento local.');
const finLocal=finalizarMantenimiento({token:'ok',idMantenimiento:mttoLocal.idMantenimiento,fecha:'2026-08-19',resultado:'APTA',diagnostico:'Limpieza y ajuste del mecanismo',observacion:'Prueba funcional satisfactoria'});
if(!finLocal.ok||filaLocal[columnasInventario.estado]!=='Activo'||filaLocal[columnasInventario.proyecto]!=='PROYECTO ANTERIOR'||filaLocal[columnasInventario.condicion_tecnica]!=='BUEN ESTADO'||filaLocal[columnasInventario.bloqueada_asignacion]!=='NO'||filaActaLocal[colsActasMtto.estado_acta]!=='VIGENTE')throw new Error('El mantenimiento local no restauró asignación, condición y acta.');

// Mantenimiento externo: guía de salida, recepción, reparación, guía de retorno y cierre en rastrillo.
const filaExterna=crearFilaInventario('AR-5','SERIE-5');hojaInventario.datos.push(filaExterna);hoja.datos.push(crearActaPruebaMantenimiento('ACT-G-2026-000011','SERIE-5'));filaExterna[columnasInventario.acta_vigente]='ACT-G-2026-000011';filaExterna[columnasInventario.responsable_nombre]='RESPONSABLE EXTERNO';
const pdfPrueba={nombre:'guia.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-mantenimiento').toString('base64')};
const externoSinGuia=iniciarMantenimiento({token:'ok',idSolicitud:'mtto-ext-sin-guia',serie:'SERIE-5',tipoServicio:'PREVENTIVO',modalidad:'EXTERNO',armeroTipo:'EXTERNO',armeroNombre:'TALLER AUTORIZADO',armeroUbicacion:'GUAYAQUIL',fecha:'2026-08-20',problema:'Inspección preventiva programada'});
if(externoSinGuia.ok)throw new Error('Se inició mantenimiento externo sin guía PDF.');
const mttoExterno=iniciarMantenimiento({token:'ok',idSolicitud:'mtto-ext-0001',serie:'SERIE-5',tipoServicio:'PREVENTIVO',modalidad:'EXTERNO',armeroTipo:'EXTERNO',armeroNombre:'TALLER AUTORIZADO',armeroUbicacion:'GUAYAQUIL',fecha:'2026-08-20',problema:'Inspección preventiva programada',guia:pdfPrueba});
if(!mttoExterno.ok||filaExterna[columnasInventario.estado]!=='Transito')throw new Error('Falló el envío externo a mantenimiento.');
const recepcionArmero=confirmarRecepcionArmero({token:'ok',idMantenimiento:mttoExterno.idMantenimiento,fecha:'2026-08-20'});
if(!recepcionArmero.ok||filaExterna[columnasInventario.estado]!=='Mantenimiento'||filaExterna[columnasInventario.condicion_tecnica]!=='EN DIAGNÓSTICO')throw new Error('Falló la recepción por el armero.');
const finExterno=finalizarMantenimiento({token:'ok',idMantenimiento:mttoExterno.idMantenimiento,fecha:'2026-08-21',resultado:'APTA',diagnostico:'Inspección, limpieza y prueba funcional',observacion:'Sin fallas'});
if(!finExterno.ok||filaExterna[columnasInventario.estado_mantenimiento]!=='REPARADA_PENDIENTE_RETORNO')throw new Error('Falló el resultado del mantenimiento externo.');
const retornoMtto=iniciarRetornoMantenimiento({token:'ok',idSolicitud:'mtto-ret-0001',idMantenimiento:mttoExterno.idMantenimiento,fecha:'2026-08-21',destino:'GUAYAS',guia:pdfPrueba});
if(!retornoMtto.ok||filaExterna[columnasInventario.estado]!=='Transito')throw new Error('Falló el retorno desde mantenimiento.');
const llegadaMtto=confirmarRetornoMantenimiento({token:'ok',idMantenimiento:mttoExterno.idMantenimiento,fecha:'2026-08-22'}),filaActaExterna=hoja.datos.find(r=>r[colsActasMtto.codigo_acta]==='ACT-G-2026-000011');
if(!llegadaMtto.ok||filaExterna[columnasInventario.estado]!=='Rastrillo'||filaExterna[columnasInventario.condicion_tecnica]!=='BUEN ESTADO'||filaExterna[columnasInventario.acta_vigente]!==''||filaActaExterna[colsActasMtto.estado_acta]!=='FINALIZADA')throw new Error('El retorno de mantenimiento no cerró inventario y acta correctamente.');
const mantenimientosRegistrados=listarMantenimientos({token:'ok'});
if(!mantenimientosRegistrados.ok||mantenimientosRegistrados.total<2||!mantenimientosRegistrados.mantenimientos.some(m=>m.estadoMantenimiento==='CERRADO'))throw new Error('El expediente de mantenimientos no quedó disponible.');

const hojaMovimientos = hojas.get('movimientos_armamento'), estructuraMovimientos = contexto.estructuraHojaControl(hojaMovimientos);
const filaAnulada = hojaMovimientos.datos.find(r => String(r[estructuraMovimientos.cols.estado_movimiento]||'') === 'ANULADO_POR_ELIMINACION');
if (!filaAnulada) throw new Error('No quedó un movimiento anulado disponible para probar la limpieza administrativa.');
const idMovimientoAnulado = String(filaAnulada[estructuraMovimientos.cols.id_movimiento]||''), filasMovimientosAntes = hojaMovimientos.getLastRow(), inventarioAntesBorrarHistorial = JSON.stringify(hojaInventario.datos);
contexto.validarSesionActas = () => ({ usuario:'operaciones', rol:'operaciones' });
const borradoPorOperaciones = eliminarMovimientoHistorial({ token:'ok', idMovimiento:idMovimientoAnulado, motivo:'Registro de prueba' });
if (borradoPorOperaciones.ok || hojaMovimientos.getLastRow() !== filasMovimientosAntes) throw new Error('Operaciones pudo borrar un movimiento del historial.');
contexto.validarSesionActas = () => ({ usuario:'admin', rol:'admin' });
const movimientoActual = String(filaSerie3[columnasInventario.id_movimiento_actual]||'');
const borradoMovimientoActual = eliminarMovimientoHistorial({ token:'ok', idMovimiento:movimientoActual, motivo:'Intento de prueba' });
if (borradoMovimientoActual.ok) throw new Error('Se permitió borrar un movimiento que todavía está vinculado al inventario.');
const borradoAdministrativo = eliminarMovimientoHistorial({ token:'ok', idMovimiento:idMovimientoAnulado, motivo:'Movimiento generado durante pruebas' });
if (!borradoAdministrativo.ok || hojaMovimientos.getLastRow() !== filasMovimientosAntes-1 || JSON.stringify(hojaInventario.datos) !== inventarioAntesBorrarHistorial) throw new Error('La eliminación administrativa no fue segura o modificó el inventario.');
const auditoriaBorrados = hojas.get('auditoria_eliminaciones_movimientos');
if (!auditoriaBorrados || auditoriaBorrados.getLastRow() !== 2 || !String(auditoriaBorrados.datos[1][1]||'').includes(idMovimientoAnulado)) throw new Error('No se registró la auditoría de la eliminación administrativa.');

console.log('OK creación inicial');
console.log('OK emergencia pendiente y subsanación de guía');
console.log('OK guía obligatoria para Operaciones');
console.log('OK salida EN TRÁNSITO y confirmación EN CAMPO');
console.log('OK solicitud repetida sin duplicado');
console.log('OK confirmación de reemplazo');
console.log('OK invalidación con nueva acta vigente');
console.log('OK restauración al eliminar la última acta');
console.log('OK restauración de inventario y movimiento al eliminar');
console.log('OK retorno individual a Rastrillo y acta FINALIZADA');
console.log('OK guía pendiente/subsanada en retorno');
console.log('OK guía obligatoria para Operaciones en retorno');
console.log('OK eliminación posterior a retorno restaura el origen inicial');
console.log('OK regularización en lote mantiene Activo y reutiliza guía');
console.log('OK regularización idempotente sin duplicados');
console.log('OK regularización individual genera un acta por arma');
console.log('OK pérdida conserva asignación y acta vigente');
console.log('OK novedad idempotente sin duplicados');
console.log('OK recuperación pasa por Transito y termina en Rastrillo');
console.log('OK recuperación finaliza el acta al confirmar recepción');
console.log('OK declaración de arma confiscada');
console.log('OK historial paginado con catálogos y filtros');
console.log('OK historial restringido a roles autorizados');
console.log('OK condición técnica y bloqueo de asignación');
console.log('OK mantenimiento local conserva asignación y reactiva acta');
console.log('OK mantenimiento externo con guías finaliza en Rastrillo');
console.log('OK eliminación de historial restringida a Administrador');
console.log('OK bloqueo de movimientos vigentes y auditoría de eliminaciones');
console.log('OK hoja supervisores creada y migrada sin depender de proyectos');
console.log('OK cédula de supervisor normalizada a 10 dígitos');
