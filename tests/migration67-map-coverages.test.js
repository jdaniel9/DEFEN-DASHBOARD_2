const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const read = file => fs.readFileSync(file, 'utf8');
const sql = read(path.join(workspaceRoot, 'supabase', 'migrations', '202610120067_map_post_coverage_today.sql'));
const supabase = read(path.join(projectRoot, 'js', 'supabase.js'));
const data = read(path.join(projectRoot, 'js', 'data.js'));
const map = read(path.join(projectRoot, 'js', 'map.js'));
const province = read(path.join(projectRoot, 'js', 'province.js'));
const utils = read(path.join(projectRoot, 'js', 'utils.js'));
const html = read(path.join(projectRoot, 'index.html'));

test('migration 67 exposes the effective post of an active coverage', () => {
  for (const token of ['get_dashboard_post_coverage_today', 'attendance_coverages', 'attendance_extra_shifts', 'is_mobile_guard', "c.status='ACTIVE'"])
    assert.ok(sql.includes(token), `missing ${token}`);
});

test('dashboard associates coverage by post id and displays the mobile guard', () => {
  assert.match(supabase, /c\.post_id/);
  assert.match(supabase, /get_dashboard_post_coverage_today/);
  assert.match(data, /personalEnTurnoHoy/);
  assert.match(map, /SACAFRANCO CUBRIENDO/);
  assert.match(province, /SACAFRANCO CUBRIENDO/);
});

test('current shift uses Ecuador time and attendance codes', () => {
  assert.match(supabase, /America\/Guayaquil/);
  assert.match(supabase, /codigo === '4'/);
  assert.match(supabase, /codigo === '5'/);
  assert.match(utils, /includes\('NOCTURNO'\)/);
  assert.match(html, /province\.js\?v=20261014-migracion67/);
});
