// ================================================================
// armamento-fotos.js — Carga masiva de fotos / credenciales de armas
//   El sistema reconoce el arma por la SERIE (o el código) escrita en el
//   nombre del archivo: "TL409-23A00369.jpg", "SERIE TL409 23A00369.png"…
//   Flujo: elegir tipo → elegir archivos o carpeta → revisar coincidencias
//   → subir. Usa el mismo proceso que la carga individual (reduce la
//   imagen, la guarda en el almacenamiento privado y la registra).
// ================================================================
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clave = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const FORMATOS = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_ARCHIVOS = 500;
  const estado = { tipo: 'photo', reemplazar: false, filas: [], subiendo: false, cancelar: false };

  const ESTADOS = {
    NUEVA: { texto: 'SE SUBIRÁ', clase: 'ok' },
    REEMPLAZA: { texto: 'REEMPLAZARÁ LA ACTUAL', clase: 'aviso' },
    YA_TIENE: { texto: 'YA TIENE · SE OMITE', clase: 'gris' },
    SIN_COINCIDENCIA: { texto: 'NO SE ENCONTRÓ LA SERIE', clase: 'error' },
    VARIAS: { texto: 'COINCIDE CON VARIAS ARMAS', clase: 'error' },
    DUPLICADO: { texto: 'OTRO ARCHIVO YA VA A ESTA ARMA', clase: 'error' },
    FORMATO: { texto: 'FORMATO NO VÁLIDO (JPG, PNG O WEBP)', clase: 'error' },
    GRANDE: { texto: 'SUPERA 20 MB', clase: 'error' },
    SUBIDA: { texto: '✓ GUARDADA', clase: 'ok' },
    FALLO: { texto: 'ERROR', clase: 'error' }
  };

  const tieneEvidencia = (a, tipo) => (tipo === 'credential' ? Boolean(a.rutaCredencial || a.urlCredencial) : Boolean(a.rutaImagenArma || a.urlImagenArma));

  // Busca el arma cuyo número de serie (o código) aparece en el nombre del archivo
  function buscarArma(nombreArchivo) {
    const base = clave(String(nombreArchivo).replace(/\.[^.]+$/, '').replace(/^(SERIE|CREDENCIAL|FOTO|ARMA)[\s_-]*/i, ''));
    const completa = clave(String(nombreArchivo).replace(/\.[^.]+$/, ''));
    if (!base) return { estado: 'SIN_COINCIDENCIA' };
    const candidatas = [];
    (armamentoDetalle || []).forEach((a) => {
      for (const campo of [a.serie, a.codigoArma]) {
        const k = clave(campo);
        if (k.length < 4) continue;
        if (base === k || completa === k) { candidatas.push({ a, largo: 1000 + k.length }); return; }
        if (completa.includes(k)) { candidatas.push({ a, largo: k.length }); return; }
      }
    });
    if (!candidatas.length) return { estado: 'SIN_COINCIDENCIA' };
    const mejor = Math.max(...candidatas.map((c) => c.largo));
    const ganadoras = [...new Map(candidatas.filter((c) => c.largo === mejor).map((c) => [c.a.idArma, c.a])).values()];
    if (ganadoras.length > 1) return { estado: 'VARIAS', opciones: ganadoras };
    return { arma: ganadoras[0] };
  }

  function clasificar() {
    const usadas = new Set();
    estado.filas.forEach((f) => {
      if (['SUBIDA', 'FALLO'].includes(f.estado)) return;
      f.arma = null; f.mensaje = '';
      if (!FORMATOS.includes(String(f.archivo.type || '').toLowerCase())) { f.estado = 'FORMATO'; return; }
      if (f.archivo.size > 20 * 1024 * 1024) { f.estado = 'GRANDE'; return; }
      const r = buscarArma(f.archivo.name);
      if (!r.arma) { f.estado = r.estado; f.mensaje = r.opciones ? r.opciones.map((a) => a.serie).slice(0, 3).join(' · ') : ''; return; }
      f.arma = r.arma;
      if (usadas.has(r.arma.idArma)) { f.estado = 'DUPLICADO'; return; }
      usadas.add(r.arma.idArma);
      f.estado = tieneEvidencia(r.arma, estado.tipo) ? (estado.reemplazar ? 'REEMPLAZA' : 'YA_TIENE') : 'NUEVA';
    });
  }

  const porSubir = () => estado.filas.filter((f) => ['NUEVA', 'REEMPLAZA'].includes(f.estado));

  function render() {
    const cuerpo = document.getElementById('cf-cuerpo');
    if (!cuerpo) return;
    clasificarSiCorresponde();
    const n = (e) => estado.filas.filter((f) => f.estado === e).length;
    const errores = estado.filas.filter((f) => ESTADOS[f.estado]?.clase === 'error').length;
    const sinFoto = (armamentoDetalle || []).filter((a) => !tieneEvidencia(a, estado.tipo)).length;
    const nombreTipo = estado.tipo === 'credential' ? 'CREDENCIAL' : 'FOTO DEL ARMA';
    cuerpo.innerHTML = `
      <section><h4>1. QUÉ VAS A SUBIR</h4>
        <div class="cf-opciones">
          <label><input type="radio" name="cf-tipo" value="photo" ${estado.tipo === 'photo' ? 'checked' : ''} ${estado.subiendo ? 'disabled' : ''} onchange="cambiarTipoCargaFotos(this.value)"> 📷 FOTO DEL ARMA</label>
          <label><input type="radio" name="cf-tipo" value="credential" ${estado.tipo === 'credential' ? 'checked' : ''} ${estado.subiendo ? 'disabled' : ''} onchange="cambiarTipoCargaFotos(this.value)"> 📇 CREDENCIAL</label>
          <label class="cf-check"><input type="checkbox" ${estado.reemplazar ? 'checked' : ''} ${estado.subiendo ? 'disabled' : ''} onchange="cambiarReemplazoCargaFotos(this.checked)"> REEMPLAZAR LAS QUE YA TIENEN ${nombreTipo}</label>
        </div>
        <p class="cf-ayuda">HOY HAY <b>${sinFoto}</b> ARMA(S) SIN ${nombreTipo}. EL NOMBRE DE CADA ARCHIVO DEBE CONTENER LA <b>SERIE</b> (O EL CÓDIGO) DEL ARMA, POR EJEMPLO <code>TL409-23A00369.jpg</code> O <code>SERIE TL409 23A00369.png</code>.</p>
      </section>
      <section><h4>2. ELIGE LAS IMÁGENES</h4>
        <div class="cf-botones">
          <label class="cf-archivo">🖼 ELEGIR IMÁGENES<input type="file" accept="image/jpeg,image/png,image/webp" multiple ${estado.subiendo ? 'disabled' : ''} onchange="agregarArchivosCargaFotos(this)"></label>
          <label class="cf-archivo">📁 ELEGIR UNA CARPETA<input type="file" webkitdirectory multiple ${estado.subiendo ? 'disabled' : ''} onchange="agregarArchivosCargaFotos(this)"></label>
          ${estado.filas.length && !estado.subiendo ? '<button class="cf-limpiar" onclick="limpiarCargaFotos()">QUITAR TODO</button>' : ''}
        </div>
      </section>
      ${estado.filas.length ? `<section><h4>3. REVISIÓN (${estado.filas.length} ARCHIVO(S))</h4>
        <div class="cf-resumen">
          <span class="ok"><b>${n('NUEVA') + n('REEMPLAZA')}</b> SE SUBIRÁN</span>
          ${n('REEMPLAZA') ? `<span class="aviso"><b>${n('REEMPLAZA')}</b> REEMPLAZAN</span>` : ''}
          ${n('YA_TIENE') ? `<span class="gris"><b>${n('YA_TIENE')}</b> SE OMITEN</span>` : ''}
          ${errores ? `<span class="error"><b>${errores}</b> CON PROBLEMAS</span>` : ''}
          ${n('SUBIDA') ? `<span class="ok"><b>${n('SUBIDA')}</b> GUARDADAS</span>` : ''}
        </div>
        <div id="cf-progreso" class="cf-progreso" style="display:${estado.subiendo ? '' : 'none'}"><div></div><small></small></div>
        <div class="cf-tabla-wrap"><table class="cf-tabla"><thead><tr><th>ARCHIVO</th><th>ARMA</th><th>ESTADO</th></tr></thead><tbody>
          ${estado.filas.map((f) => `<tr class="${ESTADOS[f.estado]?.clase || ''}"><td>${esc(f.archivo.name)}</td>
            <td>${f.arma ? `<b>${esc(f.arma.serie)}</b><small>${esc([f.arma.codigoArma, f.arma.tipo, f.arma.proyecto || f.arma.ubicacion].filter(Boolean).join(' · '))}</small>` : '—'}</td>
            <td>${esc(ESTADOS[f.estado]?.texto || f.estado)}${f.mensaje ? `<small>${esc(f.mensaje)}</small>` : ''}</td></tr>`).join('')}
        </tbody></table></div></section>` : ''}`;
    const boton = document.getElementById('cf-subir');
    const total = porSubir().length;
    boton.disabled = estado.subiendo || !total;
    boton.textContent = estado.subiendo ? 'SUBIENDO…' : `SUBIR ${total} ${estado.tipo === 'credential' ? 'CREDENCIAL(ES)' : 'FOTO(S)'}`;
    document.getElementById('cf-cancelar').textContent = estado.subiendo ? 'DETENER' : 'CERRAR';
  }
  let pendienteClasificar = true;
  function clasificarSiCorresponde() { if (pendienteClasificar) { clasificar(); pendienteClasificar = false; } }
  const reclasificar = () => { pendienteClasificar = true; render(); };

  window.abrirCargaFotosArmamento = function () {
    if (typeof backendUsaSupabase === 'function' && !backendUsaSupabase()) return alert('LA CARGA MASIVA REQUIERE SUPABASE.');
    if (typeof usuarioPuedeGestionarEvidenciasArmamento !== 'function' || !usuarioPuedeGestionarEvidenciasArmamento()) return alert('NO TIENES PERMISO PARA GESTIONAR FOTOS Y CREDENCIALES DEL ARMA.');
    if (!(armamentoDetalle || []).length) return alert('ABRE PRIMERO EL INVENTARIO DE ARMAMENTO.');
    document.querySelectorAll('.armamento-accion-grupo[open]').forEach((d) => d.removeAttribute('open'));
    estado.filas = []; estado.subiendo = false; estado.cancelar = false; pendienteClasificar = true;
    document.getElementById('cf-modal')?.remove();
    const capa = document.createElement('div');
    capa.id = 'cf-modal';
    capa.className = 'ae-modal';
    capa.innerHTML = `<div class="ae-card cf-card">
      <header><div><h3>📷 CARGA MASIVA DE FOTOS</h3><p>EL ARMA SE RECONOCE POR LA SERIE EN EL NOMBRE DEL ARCHIVO</p></div><button onclick="cerrarCargaFotosArmamento()">✕</button></header>
      <div class="ae-cuerpo" id="cf-cuerpo"></div>
      <footer><button class="ae-cancelar" id="cf-cancelar" onclick="cerrarCargaFotosArmamento()">CERRAR</button><button class="ae-guardar" id="cf-subir" onclick="subirCargaFotosArmamento()">SUBIR</button></footer>
    </div>`;
    document.body.appendChild(capa);
    render();
  };

  window.cerrarCargaFotosArmamento = function () {
    if (estado.subiendo) {
      if (confirm('¿DETENER LA CARGA? LAS FOTOS YA GUARDADAS SE CONSERVAN.')) estado.cancelar = true;
      return;
    }
    document.getElementById('cf-modal')?.remove();
  };
  window.cambiarTipoCargaFotos = function (tipo) { estado.tipo = tipo === 'credential' ? 'credential' : 'photo'; reclasificar(); };
  window.cambiarReemplazoCargaFotos = function (valor) { estado.reemplazar = Boolean(valor); reclasificar(); };
  window.limpiarCargaFotos = function () { estado.filas = []; reclasificar(); };
  window.agregarArchivosCargaFotos = function (input) {
    const nuevos = [...(input.files || [])].filter((f) => !f.name.startsWith('.'));
    input.value = '';
    const ya = new Set(estado.filas.map((f) => `${f.archivo.name}|${f.archivo.size}`));
    nuevos.forEach((archivo) => { if (!ya.has(`${archivo.name}|${archivo.size}`)) estado.filas.push({ archivo, estado: '', arma: null }); });
    if (estado.filas.length > MAX_ARCHIVOS) {
      alert(`SE ADMITEN HASTA ${MAX_ARCHIVOS} ARCHIVOS POR CARGA. SE CONSERVARON LOS PRIMEROS ${MAX_ARCHIVOS}.`);
      estado.filas = estado.filas.slice(0, MAX_ARCHIVOS);
    }
    reclasificar();
  };

  window.subirCargaFotosArmamento = async function () {
    const lista = porSubir();
    if (!lista.length || estado.subiendo) return;
    const reemplazos = lista.filter((f) => f.estado === 'REEMPLAZA').length;
    if (!confirm(`SE SUBIRÁN ${lista.length} ARCHIVO(S)${reemplazos ? `, ${reemplazos} REEMPLAZANDO LA IMAGEN ACTUAL` : ''}. ¿CONTINUAR?`)) return;
    estado.subiendo = true; estado.cancelar = false;
    render();
    const tipo = estado.tipo;
    let hechas = 0;
    for (const f of lista) {
      if (estado.cancelar) break;
      const barra = document.querySelector('#cf-progreso > div'), texto = document.querySelector('#cf-progreso small');
      if (barra) barra.style.width = `${Math.round((hechas / lista.length) * 100)}%`;
      if (texto) texto.textContent = `SUBIENDO ${hechas + 1} DE ${lista.length}: ${f.archivo.name}`;
      const anterior = tipo === 'credential' ? f.arma.rutaCredencial : f.arma.rutaImagenArma;
      let rutaNueva = '', registrada = false;
      try {
        const preparada = await prepararEvidenciaArmamento(f.archivo);
        rutaNueva = await supabaseSubirEvidenciaArmamento(preparada, f.arma.idArma, tipo);
        const r = await supabaseRegistrarEvidenciaArmamento(f.arma.idArma, tipo, rutaNueva);
        if (!r?.ok) throw new Error('SUPABASE NO CONFIRMÓ EL REGISTRO');
        registrada = true;
        if (anterior && anterior !== rutaNueva) { try { await supabaseEliminarEvidenciaArmamento(anterior); } catch (_) { f.mensaje = 'LA IMAGEN ANTERIOR QUEDÓ PENDIENTE DE LIMPIEZA'; } }
        if (tipo === 'credential') f.arma.rutaCredencial = rutaNueva; else f.arma.rutaImagenArma = rutaNueva;
        f.estado = 'SUBIDA';
      } catch (e) {
        if (rutaNueva && !registrada) { try { await supabaseEliminarEvidenciaArmamento(rutaNueva); } catch (_) {} }
        f.estado = 'FALLO'; f.mensaje = e.message || String(e);
      }
      hechas++;
      const fila = [...document.querySelectorAll('.cf-tabla tbody tr')][estado.filas.indexOf(f)];
      if (fila) { fila.className = ESTADOS[f.estado].clase; fila.lastElementChild.innerHTML = `${esc(ESTADOS[f.estado].texto)}${f.mensaje ? `<small>${esc(f.mensaje)}</small>` : ''}`; }
    }
    estado.subiendo = false;
    const ok = estado.filas.filter((f) => f.estado === 'SUBIDA').length, fallos = estado.filas.filter((f) => f.estado === 'FALLO').length;
    try { invalidarWorkspaceArmamentoSupabase(); await cargarWorkspaceArmamentoSupabase(true); renderFiltrosArmamento(); renderTablaArmamento(); } catch (_) {}
    render();
    alert(`CARGA TERMINADA: ${ok} GUARDADA(S)${fallos ? ` · ${fallos} CON ERROR (REVISA LA LISTA)` : ''}${estado.cancelar ? ' · DETENIDA ANTES DE TERMINAR' : ''}.`);
  };
})();
