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
    const fechaISO = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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
    if (!str) return '—';
    const [y,m,d] = String(str).split('-');
    return `${d}/${m}/${y}`;
}

// Antepone una columna "N°" a cada fila de una tabla de reporte PDF
function numerarFilas(filas) {
    return filas.map((f, i) => [String(i + 1), ...f]);
}
