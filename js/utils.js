// ================================================================
// utils.js — Funciones de utilidad: fechas, alertas, formato
// ================================================================

function diasRestantes(fechaStr) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const fin = new Date(fechaStr); fin.setHours(0,0,0,0);
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
    if (dias <= 30) return { cls: 'badge-danger', label: `⚠️ VENCE EN ${dias}d`, desc: 'Acción inmediata' };
    if (dias <= 60) return { cls: 'badge-warn',   label: `⏳ ${dias} días`,      desc: 'Pendiente de renovar' };
    return              { cls: 'badge-ok',         label: `✅ ${dias} días`,      desc: 'Vigente' };
}

function alertaVigencia(dias) {
    if (dias <= 0)  return { cls: 'dias-danger', label: 'VENCIDA' };
    if (dias <= 90) return { cls: 'dias-warn',   label: `${dias} días restantes` };
    return              { cls: 'dias-ok',         label: `${dias} días restantes` };
}

function formatFecha(str) {
    if (!str) return '—';
    const [y,m,d] = String(str).split('-');
    return `${d}/${m}/${y}`;
}
