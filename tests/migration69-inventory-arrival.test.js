const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const project=path.resolve(__dirname,'..');
const root=path.resolve(project,'..');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read(path.join(root,'supabase','migrations','202610140069_receive_weapon_batch_from_inventory.sql'));
const auth=read(path.join(project,'js','auth.js'));
const supabase=read(path.join(project,'js','supabase.js'));
const armamento=read(path.join(project,'js','armamento.js'));
const html=read(path.join(project,'index.html'));

test('inventory reception resolves and receives the current batch',()=>{
  assert.match(sql,/w\.current_movement_id/);
  assert.match(sql,/m\.movement_status='EN_TRANSITO'/);
  assert.match(sql,/public\.receive_weapon_batch/);
  assert.match(sql,/INVENTARIO_ARMAMENTO/);
});

test('arrival button is available only to authorized roles',()=>{
  assert.match(auth,/usuarioPuedeConfirmarLlegadaArmamento/);
  assert.match(auth,/\['admin','operaciones'\]/);
  assert.match(supabase,/receive_current_weapon_batch/);
  assert.match(armamento,/Llegó al destino/);
  assert.match(armamento,/todas las armas pendientes pertenecientes al mismo lote/);
  assert.match(html,/armamento\.js\?v=20261014-migracion69/);
});
