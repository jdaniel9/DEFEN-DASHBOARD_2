const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/supabase.js', 'utf8');
const loadAdapter = new Function(`${source}\nreturn adaptarSnapshotSupabase;`);
const adaptar = loadAdapter();

const snapshot = {
  schema_version: 2,
  generated_at: '2026-09-03T12:00:00Z',
  profile: { username: 'admin', role: 'admin' },
  weapon_summary: { global: 5, en_campo: 2, en_transito: 1, rastrillo: 1, perdida_robada: 1, confiscada: 0 },
  radio_summary: { global: 1, assigned: 1, warehouse: 0, maintenance: 0, lost: 0 },
  provinces: [{
    id: 10, name: 'GUAYAS', map_x: 35.3, map_y: 49.5, office_type: 'MATRIZ',
    operational_status: 'VIGENTE', map_category: 'active', guards: 1, weapons: 2,
    posts: 1, projects: 1, vacancies: 0, rastrillo_weapons: 1,
    procedures: { procedure_number: 'TRA-1', status: 'VIGENTE' }
  }],
  projects: [{
    id: 'project-1', name: 'PROYECTO UNO', province: 'GUAYAS', guards: 1, weapons: 2,
    radios: 1, vacancies: 0, planned_end_date: '2026-12-31', contract_type: 'ODC',
    documents: [{ type: 'CONTRATO', url: 'https://example.test/contrato' }],
    supervisors: [{ full_name: 'SUPERVISOR UNO' }],
    posts: [{ id: 'post-1', name: 'PUESTO UNO', latitude: -2.1, longitude: -79.9,
      service_type: '24 HORAS', armed: true, has_radio: true, shift_label: 'D/N',
      service_days: 'LUNES/DOMINGO', observation: '' }]
  }],
  attendance_today: [{ post_id: 'post-1', post_name: 'PUESTO UNO', full_name: 'GUARDIA UNO',
    counts_as_on_duty: true, code_label: 'DIURNO' }],
  attendance_novelties: [{ assignment_id: 'assignment-1', full_name: 'GUARDIA UNO', province: 'GUAYAS',
    project: 'PROYECTO UNO', post: 'PUESTO UNO', date: '2026-09-03', type: 'FALTA_INJUSTIFICADA' }],
  personnel_warnings: [{ date: '2026-09-03', personnel_name: 'GUARDIA UNO', province: 'GUAYAS',
    project: 'PROYECTO UNO', post: 'PUESTO UNO', reason: 'PRUEBA', type: 'VERBAL' }],
  project_history: [{ province: 'PICHINCHA', project: 'ANTERIOR', archived_at: '2026-08-01T00:00:00Z',
    actual_end_date: '2026-07-31', snapshot: { guards: 2, weapons: 1, radios: 0, posts: [] } }]
};

const result = adaptar(snapshot);

assert.equal(result.__meta__.backend, 'supabase');
assert.equal(result.__armamento__.global, 5);
assert.equal(result.GUAYAS.proyectosList.length, 1);
assert.equal(result.GUAYAS.proyectosList[0].urlDocumento, 'https://example.test/contrato');
assert.equal(result.__puestos__[0].nombre_puesto, 'PUESTO UNO');
assert.equal(result.__puestos__[0].radio, 'SI');
assert.equal(result.__asistencia__['PUESTO UNO'].enTurno, 'GUARDIA UNO');
assert.equal(result.__novedades__.faltas[0].diasInjustificados[0], 3);
assert.equal(result.__llamados__[0].tipo_llamado, 'VERBAL');
assert.equal(result.__historico__[0].proyecto, 'ANTERIOR');

console.log('Adaptador Supabase -> dashboard actual: pruebas correctas.');
