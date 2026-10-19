// Resumen OPE - prototipo móvil de consulta ejecutiva por proyecto.
const opeState={workspace:null,search:'',province:'',filters:{status:new Set(['ACTIVE']),contract:new Set(),schedule:new Set(),service:new Set(),arms:new Set()},loading:false};
const opeEsc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function opeCreate(){
  if(document.getElementById('ope-modal'))return;
  const m=document.createElement('div');m.id='ope-modal';m.className='ope-modal';
  m.innerHTML=`<div class="ope-shell"><header class="ope-head"><div><h2>RESUMEN OPE</h2><p>CONSULTA EJECUTIVA NACIONAL DE PROYECTOS</p></div><button onclick="opeLoad()">↻ ACTUALIZAR</button><button onclick="opeClose()">✕ CERRAR</button></header><main class="ope-body"><div id="ope-loading" class="ope-loading">CARGANDO RESUMEN OPERATIVO…</div><div id="ope-content" style="display:none"><section id="ope-kpis" class="ope-kpis"></section><section class="ope-search"><label>BUSCAR PROYECTO<input id="ope-search" list="ope-projects-list" placeholder="ESCRIBE EL NOMBRE DEL PROYECTO…" oninput="opeApply()"><datalist id="ope-projects-list"></datalist></label><label>PROVINCIA<select id="ope-province" onchange="opeApply()"><option value="">TODAS LAS PROVINCIAS</option></select></label><button onclick="opeClearFilters()">LIMPIAR FILTROS</button></section><section id="ope-filters" class="ope-filters"></section><div class="ope-results-head"><div><b id="ope-results-count">0 PROYECTOS</b><small id="ope-filter-note">FILTRO ACTUAL</small></div><div class="ope-view-note">TOCA UNA TARJETA PARA VER MÁS DETALLE</div></div><section id="ope-cards" class="ope-cards"></section></div></main></div>`;
  document.body.appendChild(m);
}

async function abrirResumenOpe(){
  if(typeof usuarioPuedeVerResumenOpe==='function'&&!usuarioPuedeVerResumenOpe())return alert('NO TIENES PERMISO PARA CONSULTAR EL RESUMEN OPE.');
  opeCreate();document.getElementById('ope-modal').style.display='flex';await opeLoad();
}
function opeClose(){const m=document.getElementById('ope-modal');if(m)m.style.display='none';}

async function opeLoad(){
  if(opeState.loading)return;opeState.loading=true;const loading=document.getElementById('ope-loading'),content=document.getElementById('ope-content');loading.style.display='block';loading.textContent='CARGANDO RESUMEN OPERATIVO…';content.style.display='none';
  try{const w=await supabaseCargarResumenOpe();if(!w||w.schema_version!==1)throw new Error('CONTRATO DEL RESUMEN OPE INCOMPATIBLE.');opeState.workspace=w;opePrepare();opeRender();loading.style.display='none';content.style.display='block';}catch(e){loading.textContent='NO SE PUDO CARGAR EL RESUMEN OPE: '+(e.message||e);}finally{opeState.loading=false;}
}

function opeSchedule(value){const v=String(value||'').toUpperCase();for(const h of ['24','12','10','8'])if(new RegExp(`(^|\\D)${h}(\\D|$)`).test(v))return `${h} HORAS`;return v&&v!=='SIN HORARIO'?'OTROS':'SIN HORARIO';}
function opeProjectServices(p){const values=(p.service_types||[]).map(x=>String(x||'OTRO').toUpperCase()),name=String(p.name||'').toUpperCase();if(name.includes('CUSTOD'))values.push('CUSTODIO');if(name.includes('DOTACION')||name.includes('DOTACIÓN'))values.push('DOTACION PERSONAL');return[...new Set(values)];}
function opeServices(){return[...new Set(['CUSTODIO','DOTACION PERSONAL',...(opeState.workspace?.projects||[]).flatMap(opeProjectServices)])].sort();}
function opeChip(group,value,label){const active=opeState.filters[group].has(value);return `<button class="ope-chip ${active?'active':''}" onclick="opeToggle('${group}','${encodeURIComponent(value)}')"><span>${active?'✓':'＋'}</span>${opeEsc(label||value)}</button>`;}

function opePrepare(){
  const ps=opeState.workspace.projects||[],provs=[...new Set(ps.map(p=>p.province).filter(Boolean))].sort();
  document.getElementById('ope-projects-list').innerHTML=ps.map(p=>`<option value="${opeEsc(p.name)}">${opeEsc(p.province)} · ${opeEsc(p.status==='ACTIVE'?'ACTIVO':'FINALIZADO')}</option>`).join('');
  document.getElementById('ope-province').innerHTML='<option value="">TODAS LAS PROVINCIAS</option>'+provs.map(x=>`<option value="${opeEsc(x)}">${opeEsc(x)}</option>`).join('');
  document.getElementById('ope-filters').innerHTML=`<div><b>ESTADO</b><span>${opeChip('status','ACTIVE','ACTIVOS')}${opeChip('status','ARCHIVED','FINALIZADOS')}</span></div><div><b>MODALIDAD</b><span>${opeChip('contract','ODC','ODC')}${opeChip('contract','CT','CT / LICITACIÓN')}${opeChip('contract','OTRO','OTROS')}</span></div><div><b>HORARIO</b><span>${['24 HORAS','12 HORAS','10 HORAS','8 HORAS','OTROS'].map(x=>opeChip('schedule',x,x)).join('')}</span></div><div><b>TIPO DE SERVICIO</b><span>${opeServices().map(x=>opeChip('service',x,x)).join('')||'<small>SIN TIPOS REGISTRADOS</small>'}</span></div><div><b>ARMAMENTO</b><span>${opeChip('arms','ARMADO','ARMADO')}${opeChip('arms','SIN ARMAS','SIN ARMAS')}${opeChip('arms','LETAL','ARMA LETAL')}${opeChip('arms','NO LETAL','NO LETAL')}</span></div>`;
}

function opeToggle(group,encoded){const value=decodeURIComponent(encoded),set=opeState.filters[group];set.has(value)?set.delete(value):set.add(value);opePrepare();document.getElementById('ope-province').value=opeState.province;document.getElementById('ope-search').value=opeState.search;opeRender();}
function opeClearFilters(){opeState.search='';opeState.province='';Object.values(opeState.filters).forEach(s=>s.clear());opeState.filters.status.add('ACTIVE');opePrepare();document.getElementById('ope-search').value='';document.getElementById('ope-province').value='';opeRender();}
function opeApply(){opeState.search=(document.getElementById('ope-search')?.value||'').trim().toUpperCase();opeState.province=document.getElementById('ope-province')?.value||'';opeRender();}
function opeAny(set,values){return!set.size||values.some(v=>set.has(v));}
function opeRows(){
  return(opeState.workspace?.projects||[]).filter(p=>{
    const schedules=(p.schedules||[]).map(opeSchedule),services=opeProjectServices(p),w=p.weapons||{},arms=[];
    if((p.armed_posts||0)>0||w.total>0)arms.push('ARMADO');else arms.push('SIN ARMAS');if(w.lethal>0)arms.push('LETAL');if(w.non_lethal>0)arms.push('NO LETAL');
    return(!opeState.search||[p.name,p.province,p.service_location].some(x=>String(x||'').toUpperCase().includes(opeState.search)))&&(!opeState.province||p.province===opeState.province)&&opeAny(opeState.filters.status,[p.status])&&opeAny(opeState.filters.contract,[p.contract_code])&&opeAny(opeState.filters.schedule,schedules)&&opeAny(opeState.filters.service,services)&&opeAny(opeState.filters.arms,arms);
  });
}
function opeDate(v){if(!v)return'NO REGISTRADA';const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return d.toLocaleDateString('es-EC',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();}
function opeRemaining(p){const end=p.status==='ARCHIVED'?(p.actual_end_date||p.planned_end_date):p.planned_end_date;if(!end)return'SIN FECHA DE FINALIZACIÓN';const today=new Date(`${opeState.workspace.today}T12:00:00`),d=new Date(`${String(end).slice(0,10)}T12:00:00`),n=Math.ceil((d-today)/86400000);if(p.status==='ARCHIVED')return`FINALIZÓ EL ${opeDate(end)}`;return n>0?`FALTAN ${n} DÍAS`:n===0?'FINALIZA HOY':`VENCIDO HACE ${Math.abs(n)} DÍAS`;}
function opeDuration(p){if(!p.start_date)return'—';const end=p.actual_end_date||p.planned_end_date||opeState.workspace.today,a=new Date(`${p.start_date}T12:00:00`),b=new Date(`${String(end).slice(0,10)}T12:00:00`),months=Math.max(0,Math.round((b-a)/2629800000));return months<1?`${Math.max(1,Math.ceil((b-a)/86400000))} DÍAS`:`${months} MESES`;}

function opeRender(){
  const w=opeState.workspace;if(!w)return;const all=w.projects||[],rows=opeRows(),s=w.summary||{},real=rows.reduce((n,p)=>n+(p.real_personnel||0),0),posts=rows.reduce((n,p)=>n+(p.posts||0),0),weapons=rows.reduce((n,p)=>n+(p.weapons?.total||0),0);
  document.getElementById('ope-kpis').innerHTML=[['PROYECTOS ACTIVOS',s.active||0,'green'],['FINALIZADOS',s.archived||0,'slate'],['PERSONAL REAL',s.personnel_real||0,'blue'],['PUESTOS ACTIVOS',s.posts_active||0,'amber'],['ARMAS EN PROYECTOS',s.weapons_project||0,'red'],['RESULTADOS FILTRADOS',rows.length,'violet']].map(k=>`<div class="${k[2]}"><span>${k[0]}</span><b>${k[1]}</b></div>`).join('');
  document.getElementById('ope-results-count').textContent=`${rows.length} PROYECTO(S) · ${real} PERSONAS · ${posts} PUESTOS · ${weapons} ARMAS`;document.getElementById('ope-filter-note').textContent=rows.length===all.length?'VISTA NACIONAL COMPLETA':'RESULTADO DE LOS FILTROS SELECCIONADOS';
  document.getElementById('ope-cards').innerHTML=rows.map(p=>{const req=p.required_personnel||0,actual=p.real_personnel||0,delta=actual-req,w=p.weapons||{},services=opeProjectServices(p).join(' · ')||'SIN TIPO',schedules=[...new Set((p.schedules||[]).map(opeSchedule))].join(' · ')||'SIN HORARIO';return `<details class="ope-card ${p.status==='ACTIVE'?'active':'archived'}"><summary><div class="ope-card-title"><span>${opeEsc(p.contract_code||'OTRO')}</span><div><h3>${opeEsc(p.name)}</h3><p>📍 ${opeEsc(p.province)} · ${opeEsc(p.service_location||'SIN UBICACIÓN DETALLADA')}</p></div><em>${p.status==='ACTIVE'?'ACTIVO':'FINALIZADO'}</em></div><div class="ope-card-numbers"><div><small>PERSONAL REAL</small><b>${actual}<i>/ ${req||'—'}</i></b></div><div><small>PUESTOS</small><b>${p.posts||0}</b></div><div><small>ARMAS</small><b>${w.total||0}</b></div><div><small>TIEMPO</small><b>${opeEsc(opeDuration(p))}</b></div></div><div class="ope-card-tags"><span>◷ ${opeEsc(schedules)}</span><span>🛡 ${opeEsc(services)}</span>${(p.armed_posts||0)>0?'<span class="armed">ARMADO</span>':'<span>SIN PUESTOS ARMADOS</span>'}</div><div class="ope-card-deadline ${p.status==='ACTIVE'&&String(opeRemaining(p)).includes('VENCIDO')?'danger':''}">${opeEsc(opeRemaining(p))}</div></summary><div class="ope-card-detail"><section><h4>VIGENCIA</h4><p><b>INICIO:</b> ${opeEsc(opeDate(p.start_date))}<br><b>FIN PLANIFICADO:</b> ${opeEsc(opeDate(p.planned_end_date))}<br><b>FIN REAL:</b> ${opeEsc(opeDate(p.actual_end_date))}</p></section><section><h4>DOTACIÓN</h4><p><b>REQUERIDA:</b> ${req}<br><b>REAL:</b> ${actual}<br><b>DIFERENCIA:</b> <span class="${delta<0?'bad':'good'}">${delta>0?'+':''}${delta}</span></p></section><section><h4>ARMAMENTO</h4><div class="ope-weapon-boxes"><span><b>${w.total||0}</b>TOTAL</span><span><b>${w.lethal||0}</b>LETAL</span><span><b>${w.non_lethal||0}</b>NO LETAL</span></div></section><section><h4>OPERACIÓN</h4><p><b>SUPERVISOR:</b> ${opeEsc((p.supervisors||[]).join(', ')||'NO ASIGNADO')}<br><b>PUESTOS ARMADOS:</b> ${p.armed_posts||0}<br><b>TIPOS:</b> ${opeEsc(services)}</p></section></div></details>`;}).join('')||'<div class="ope-empty">NO EXISTEN PROYECTOS QUE COINCIDAN CON LOS FILTROS.</div>';
}
