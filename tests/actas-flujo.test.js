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
const primera = crear({ token: 'ok', idSolicitud: 'solicitud-00000001', acta });
if (!primera.ok || primera.reutilizada || hoja.getLastRow() !== 2) throw new Error('Falló la creación inicial.');
if (hoja.datos[0].length !== hoja.datos[1].length) throw new Error(`Encabezados (${hoja.datos[0].length}) y fila (${hoja.datos[1].length}) no coinciden.`);
let columnasInventario = contexto.estructuraHojaControl(hojaInventario).cols;
if (hojaInventario.datos[1][columnasInventario.estado] !== 'En Transito' || listarTransito({ token: 'ok' }).cantidad !== 1) throw new Error('El arma no pasó a EN TRÁNSITO.');
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

console.log('OK creación inicial');
console.log('OK emergencia pendiente y subsanación de guía');
console.log('OK guía obligatoria para Operaciones');
console.log('OK salida EN TRÁNSITO y confirmación EN CAMPO');
console.log('OK solicitud repetida sin duplicado');
console.log('OK confirmación de reemplazo');
console.log('OK invalidación con nueva acta vigente');
console.log('OK restauración al eliminar la última acta');
console.log('OK restauración de inventario y movimiento al eliminar');
