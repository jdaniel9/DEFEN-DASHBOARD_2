// Parche 63 - navegación compacta y accesible del encabezado.
(function () {
  function elementosMenu() {
    return {
      boton: document.getElementById('module-menu-toggle'),
      panel: document.getElementById('module-menu-panel')
    };
  }

  window.alternarMenuModulos = function (event) {
    event?.stopPropagation();
    const { boton, panel } = elementosMenu();
    if (!boton || !panel) return;
    const abrir = panel.hidden;
    panel.hidden = !abrir;
    boton.setAttribute('aria-expanded', String(abrir));
    document.body.classList.toggle('module-menu-open', abrir);
    if (abrir) panel.querySelector('button:not([style*="display: none"])')?.focus({ preventScroll: true });
  };

  window.cerrarMenuModulos = function () {
    const { boton, panel } = elementosMenu();
    if (!boton || !panel || panel.hidden) return;
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('module-menu-open');
  };

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.module-menu')) window.cerrarMenuModulos();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      const { boton, panel } = elementosMenu();
      if (panel && !panel.hidden) {
        window.cerrarMenuModulos();
        boton?.focus();
      }
    }
  });
})();
