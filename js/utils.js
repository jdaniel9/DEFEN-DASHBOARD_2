// ================================================================
// utils.js — Funciones de utilidad: fechas, alertas, formato
// ================================================================

function parseFechaLocal(valor) {
    if (!valor) return null;

    if (valor instanceof Date) {
        if (Number.isNaN(valor.getTime())) return null;
        return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
    }

    const texto = String(valor).trim();
    // Apps Script puede devolver las fechas de Sheets como ISO completo
    // (2026-08-11T07:00:00.000Z). Tomamos la parte calendario sin aplicar
    // conversión de zona horaria para no cambiar accidentalmente el día.
    const fechaISO = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?=$|[T\s])/);
    if (fechaISO) {
        const [, anio, mes, dia] = fechaISO;
        const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    }

    const fecha = new Date(texto);
    if (Number.isNaN(fecha.getTime())) return null;
    fecha.setHours(0,0,0,0);
    return fecha;
}

function partesFechaSegura(valor) {
    if (!valor) return null;
    const texto = String(valor).trim();
    let partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?=$|[T\s])/);
    if (partes) return { anio: Number(partes[1]), mes: Number(partes[2]), dia: Number(partes[3]) };
    partes = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (partes) return { anio: Number(partes[3]), mes: Number(partes[2]), dia: Number(partes[1]) };
    const fecha = parseFechaLocal(valor);
    return fecha ? { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1, dia: fecha.getDate() } : null;
}

function diasRestantes(fechaStr) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const fin = parseFechaLocal(fechaStr);
    if (!fin) return null;
    return Math.round((fin - hoy) / 86400000);
}

function iconoTurno(tipo) {
    switch (tipo) {
        case 'Diurno':   return '☀️';
        case 'Tarde':    return '🌇';
        case 'Nocturno': return '🌙';
        case '24 Horas': return '🔄';
        default:         return '🕐';
    }
}

function alertaProyecto(dias) {
    if (!Number.isFinite(dias)) return { cls: 'badge-warn', label: 'SIN FECHA', desc: 'Revisar registro' };
    if (dias <= 30) return { cls: 'badge-danger', label: `⚠️ VENCE EN ${dias}d`, desc: 'Acción inmediata' };
    if (dias <= 60) return { cls: 'badge-warn',   label: `⏳ ${dias} días`,      desc: 'Pendiente de renovar' };
    return              { cls: 'badge-ok',         label: `✅ ${dias} días`,      desc: 'Vigente' };
}

function alertaVigencia(dias) {
    if (!Number.isFinite(dias)) return { cls: 'dias-warn', label: 'Fecha no disponible' };
    if (dias <= 0)  return { cls: 'dias-danger', label: 'VENCIDA' };
    if (dias <= 90) return { cls: 'dias-warn',   label: `${dias} días restantes` };
    return              { cls: 'dias-ok',         label: `${dias} días restantes` };
}

function formatFecha(str) {
    const fecha = partesFechaSegura(str);
    if (!fecha) return '—';
    return `${String(fecha.dia).padStart(2,'0')}/${String(fecha.mes).padStart(2,'0')}/${fecha.anio}`;
}

// Antepone una columna "N°" a cada fila de una tabla de reporte PDF
function numerarFilas(filas) {
    return filas.map((f, i) => [String(i + 1), ...f]);
}
