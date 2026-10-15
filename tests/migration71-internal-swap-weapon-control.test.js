const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const project=path.resolve(__dirname,'..');
const root=path.resolve(project,'..');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read(path.join(root,'supabase','migrations','202610140071_internal_weapon_swap_and_daily_control.sql'));
const armamento=read(path.join(project,'js','armamento.js'));
const control=read(path.join(project,'js','weapon-control.js'));
const html=read(path.join(project,'index.html'));

test('internal swap is same-province, balanced, document-free and traceable',()=>{
  for(const token of ['internal_swap_project_weapons','v_province_a<>v_province_b','v_count<>jsonb_array_length(v_ids_b)',"'TRASLADO','NO_APLICA'",'weapon_internal_transfer_items','document_required'])
    assert.ok(sql.includes(token),`missing ${token}`);
  assert.match(armamento,/MISMA PROVINCIA/);
  assert.match(armamento,/MISMA CANTIDAD DE ARMAS/);
  assert.match(armamento,/NO SE SOLICITARÁ GUÍA/);
});

test('daily weapon control supports shifts and operational incidents',()=>{
  for(const token of ['weapon_daily_controls',"'D','T','N','DT','DN','TN','DTN'","'OK','NOVEDAD','DANADA','ROBADA','DECOMISADA'",'report_weapon_condition','declare_weapon_incident'])
    assert.ok(sql.includes(token),`missing ${token}`);
  assert.match(control,/CONTROL MENSUAL DE ARMAMENTO/);
  assert.match(control,/D · DIURNO/);
  assert.match(control,/T · TARDE/);
  assert.match(control,/N · NOCTURNO/);
  assert.match(control,/ROBADA/);
  assert.match(control,/DECOMISADA/);
});

test('new module is loaded and visible from the menu',()=>{
  assert.match(html,/abrirControlDiarioArmamento/);
  assert.match(html,/weapon-control\.js\?v=20261014-migracion71/);
  assert.match(html,/armamento\.js\?v=20261014-migracion71/);
});
