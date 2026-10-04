const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8');
const start = source.indexOf('function resolverEstadoMapaProvincia');
const end = source.indexOf('// Procesa JSON de la API', start);
const context = { Date };
vm.runInNewContext(source.slice(start, end), context);

test('una agencia vigente sin proyectos se muestra naranja', () => {
  const result = context.resolverEstadoMapaProvincia(
    { tipo: 'AGENCIA', estado: 'VIGENTE', proyectos: 0, cat: 'active' },
    { estadoTramite: 'VIGENTE', vigenciaFin: '2099-12-31' }
  );
  assert.equal(result.cat, 'agency_only');
});

test('una agencia caducada se muestra roja aunque conserve categoria anterior', () => {
  const result = context.resolverEstadoMapaProvincia(
    { tipo: 'AGENCIA', estado: 'VIGENTE', proyectos: 0, cat: 'agency_only' },
    { estadoTramite: 'VENCIDO', vigenciaFin: '2020-01-01' }
  );
  assert.equal(result.cat, 'none');
  assert.equal(result.estado, 'AGENCIA CADUCADA');
});

test('una provincia con proyectos y agencia no caducada permanece activa', () => {
  const result = context.resolverEstadoMapaProvincia(
    { tipo: 'AGENCIA', estado: 'VIGENTE', proyectos: 2, cat: 'agency_only' },
    { estadoTramite: 'VIGENTE', vigenciaFin: '2099-12-31' }
  );
  assert.equal(result.cat, 'active');
});
