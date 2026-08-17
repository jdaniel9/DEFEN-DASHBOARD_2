const fs = require('fs');
const path = require('path');
const vm = require('vm');

function extraerFuncion(codigo, nombre) {
  const inicio = codigo.indexOf(`function ${nombre}(`);
  if (inicio < 0) throw new Error(`No se encontró ${nombre}`);
  const llave = codigo.indexOf('{', inicio);
  let nivel = 0;
  for (let i = llave; i < codigo.length; i++) {
    if (codigo[i] === '{') nivel++;
    if (codigo[i] === '}' && --nivel === 0) return codigo.slice(inicio, i + 1);
  }
  throw new Error(`La función ${nombre} no está cerrada`);
}

class DocumentoFalso {
  constructor() {
    this.pagina = 1;
    this.rectangulos = [];
    this.textos = [];
    this.tablas = [];
    this.membretes = [];
    this.internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
  }
  addPage() { this.pagina++; }
  autoTable(config) {
    this.tablas.push({ pagina: this.pagina, ...config });
    const filas = (config.body || []).length;
    this.lastAutoTable = { finalY: config.startY + 8 + filas * 7 };
  }
  rect(x, y, w, h) { this.rectangulos.push({ pagina: this.pagina, x, y, w, h }); }
  text(valor, x, y) { this.textos.push({ pagina: this.pagina, valor: String(valor), x, y }); }
  setDrawColor() {} setLineWidth() {} setFontSize() {} setFont() {}
  setTextColor() {} setFillColor() {} line() {}
}

const raiz = path.join(__dirname, '..');
const actas = fs.readFileSync(path.join(raiz, 'js', 'actas.js'), 'utf8');
const contexto = vm.createContext({ console, Date, Number, String, Math });
vm.runInContext([
  extraerFuncion(actas, 'partesFechaActa'),
  extraerFuncion(actas, 'formatearFechaActa'),
  extraerFuncion(actas, 'fechaLargaEspanol'),
  extraerFuncion(actas, 'textoPDFMayusculas'),
  extraerFuncion(actas, 'dibujarFirmaGuardia'),
  extraerFuncion(actas, 'generarPDFGuardia')
].join('\n'), contexto);

const doc = new DocumentoFalso();
contexto.window = { jspdf: { jsPDF: function () { return doc; } } };
contexto.MARGEN_PDF = 25;
contexto.textoClaseActa = () => 'LETAL';
contexto.addImagenAjustada = () => false;
contexto.dibujarMembretePDF = (documento, subtitulo, fecha, opciones) => {
  documento.membretes.push({ pagina: documento.pagina, subtitulo, fecha, opciones });
};

const datos = {
  codigoActa: 'ACT-G-2026-000001',
  fecha: '2026-08-11T07:00:00.000Z',
  receptorNombre: 'Fredy Orlando Carrera Durazo',
  receptorCedula: '102246204',
  cargo: 'Supervisor de seguridad',
  proyecto: 'Proyecto prueba',
  modelo: 'Modelo prueba',
  alimentadoras: 1,
  municiones: 5,
  permiso: 'Permiso original',
  comentario: 'Sin comentarios',
  novedad: 'Ninguna',
  supervisorNombre: 'Efrain Patricio Arevalo Vintimilla',
  supervisorCedula: '102284197',
  armas: Array.from({ length: 4 }, (_, i) => ({
    clase: 'Letal', categoria: 'Fija', tipoArma: 'Pistola', marca: 'Marca prueba',
    calibre: '9 mm', serie: `serie-${i + 1}`
  }))
};

const generar = vm.runInContext('generarPDFGuardia', contexto);
generar(datos, datos.armas.map(() => ({})));

if (vm.runInContext("formatearFechaActa('2026-08-11T07:00:00.000Z')", contexto) !== '11/08/2026') {
  throw new Error('La fecha ISO completa no se formateó como 11/08/2026.');
}
if (doc.tablas[0].body[0][1] !== '11 DE AGOSTO DEL 2026') {
  throw new Error(`Fecha larga inesperada: ${doc.tablas[0].body[0][1]}`);
}
const valoresTexto = doc.tablas.flatMap(t => (t.body || []).flat()).filter(v => typeof v === 'string' && v !== '—');
if (valoresTexto.some(v => v !== v.toLocaleUpperCase('es-EC'))) {
  throw new Error('El contenido de las tablas del acta conserva texto en minúsculas.');
}
if (doc.textos.some(t => /sin imagen disponible/.test(t.valor))) {
  throw new Error('El texto de evidencia conserva minúsculas.');
}
if (doc.membretes.some(m => m.opciones?.mayusculas !== true)) {
  throw new Error('Una página del acta no activó el membrete en mayúsculas.');
}
const firmas = doc.rectangulos.filter(r => r.h === 29);
if (firmas.length !== 2 || firmas.some(f => f.y + f.h > 181)) {
  throw new Error('Las firmas invaden la zona reservada para el pie de página.');
}

console.log('OK fecha ISO completa sin NaN');
console.log('OK contenido del acta de Guardia en mayúsculas');
console.log('OK firmas dentro del límite de contenido');
