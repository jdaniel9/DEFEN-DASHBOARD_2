const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('project history is durable and imported through an audited RPC',()=>{
  const sql=read('supabase/migrations/202610180074_project_history_and_ope_table.sql');
  assert.match(sql,/create table if not exists public\.project_operational_history/i);
  assert.match(sql,/create or replace function public\.refresh_project_operational_history/i);
  assert.match(sql,/greatest\(coalesce\(v_existing\.personnel_count,0\),v_personnel\)/i);
  assert.match(sql,/greatest\(coalesce\(v_existing\.weapon_count,0\),v_weapons\)/i);
  assert.match(sql,/create or replace function public\.import_archived_project_history\(p_rows jsonb\)/i);
  assert.match(sql,/jsonb_array_length\(p_rows\)>1000/i);
  assert.match(sql,/source in \('SISTEMA','IMPORTADO'\)/i);
  assert.equal((sql.match(/coalesce\(\(select array_agg\(distinct x order by x\)/gi)||[]).length,6);
  assert.match(sql,/coalesce\(v_radio_types,'\{\}'::text\[\]\)/i);
});

test('OPE uses a selectable table, detail panel and Excel history workflow',()=>{
  const js=read('DEFEN-DASHBOARD-trabajo/js/operations-summary.js');
  const api=read('DEFEN-DASHBOARD-trabajo/js/supabase.js');
  const css=read('DEFEN-DASHBOARD-trabajo/css/main.css');
  const html=read('DEFEN-DASHBOARD-trabajo/index.html');
  assert.match(js,/class="ope-table"/);assert.match(js,/opeShowDetail/);assert.match(js,/TIPO DE ARMAMENTO/);assert.match(js,/TIPO DE RADIO/);assert.match(js,/NOMBRE DE LOS PUESTOS/);
  assert.match(js,/Plantilla_Historico_Proyectos_DEFEN\.xlsx/);assert.match(js,/opeImportHistory/);assert.match(js,/PROYECTOS_FINALIZADOS/);
  assert.match(api,/import_archived_project_history/);assert.match(css,/\.ope-head-actions button\{[^}]*pointer-events:auto/i);assert.match(css,/\.ope-table-wrap/);
  assert.match(html,/operations-summary\.js\?v=20261018-migracion74/);assert.match(html,/main\.css\?v=20261018-migracion74/);
});
