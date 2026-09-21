// Seguridad transversal del cliente. La autorización real permanece en RLS/RPC.
globalThis.DefenSecurity=(()=>{
  const buckets=new Map();
  const dangerous=/(<\s*\/?\s*(?:script|iframe|object|embed|svg|math|style|link|meta)\b|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|\bon[a-z]{3,}\s*=|\$\(|`|<\?|%3c\s*script|;\s*(?:drop|alter|truncate|grant|revoke)\s+)/i;
  const controls=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;
  function validateString(value,path='texto',max=10000){
    if(value.length>max)throw new Error(`${path}: excede ${max} caracteres.`);
    if(controls.test(value))throw new Error(`${path}: contiene caracteres de control no permitidos.`);
    if(dangerous.test(value))throw new Error(`${path}: contiene código o instrucciones no permitidas.`);
  }
  function validatePayload(value,path='solicitud',depth=0){
    if(depth>8)throw new Error('La solicitud supera la profundidad permitida.');
    if(value==null||typeof value==='number'||typeof value==='boolean')return;
    if(typeof value==='string'){validateString(value,path);return;}
    if(Array.isArray(value)){
      if(value.length>500)throw new Error(`${path}: contiene demasiados elementos.`);
      value.forEach((item,index)=>validatePayload(item,`${path}[${index}]`,depth+1));return;
    }
    if(typeof value==='object'){
      const entries=Object.entries(value);
      if(entries.length>200)throw new Error(`${path}: contiene demasiados campos.`);
      for(const [key,item] of entries){
        if(!/^[A-Za-z0-9_]{1,64}$/.test(key))throw new Error(`Nombre de campo inválido: ${key}`);
        validatePayload(item,`${path}.${key}`,depth+1);
      }
      return;
    }
    throw new Error(`${path}: tipo de dato no permitido.`);
  }
  function rateLimit(key,limit,windowSeconds){
    const now=Date.now(),windowMs=windowSeconds*1000;
    const recent=(buckets.get(key)||[]).filter(time=>now-time<windowMs);
    if(recent.length>=limit)throw new Error(`Demasiadas solicitudes. Espera ${Math.ceil((windowMs-(now-recent[0]))/1000)} segundos.`);
    recent.push(now);buckets.set(key,recent);
  }
  function rpc(name,payload){
    if(!/^[a-z][a-z0-9_]{1,62}$/.test(String(name||'')))throw new Error('Endpoint inválido.');
    const write=/^(create|save|set|update|delete|archive|register|change|start|complete|confirm|receive|attach|cancel|close|upsert|declare|report)_/.test(name);
    const attendanceEntry=name==='upsert_attendance_entry'||name==='delete_attendance_entry';
    rateLimit(`rpc:${name}`,attendanceEntry?300:(write?30:120),60);
    validatePayload(payload,`rpc.${name}`);
  }
  function validateElement(element){
    if(!(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement))return;
    if(['password','file','date','number','checkbox','radio'].includes(element.type))return;
    const max=Number(element.maxLength)>0?Number(element.maxLength):(element instanceof HTMLTextAreaElement?3000:300);
    validateString(String(element.value||''),element.name||element.id||'campo',max);
  }
  document.addEventListener('submit',event=>{
    try{event.target.querySelectorAll('input,textarea').forEach(validateElement);}
    catch(error){event.preventDefault();event.stopImmediatePropagation();alert(error.message);}
  },true);
  document.addEventListener('blur',event=>{
    try{validateElement(event.target);event.target.setCustomValidity?.('');}
    catch(error){event.target.setCustomValidity?.(error.message);event.target.reportValidity?.();}
  },true);
  return Object.freeze({validateString,validatePayload,rateLimit,rpc});
})();
