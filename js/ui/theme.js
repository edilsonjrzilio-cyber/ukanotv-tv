/* Porta de tv-app/android/.../ui/common/Theme.kt -- presets selecionáveis
   em Ajustes, aplicados via data-theme na <html> (ver css/theme.css). */
(function (global) {
  "use strict";

  var PRESETS = [{
    id: "roxo",
    label: "Roxo"
  }, {
    id: "azul",
    label: "Azul"
  }, {
    id: "vermelho",
    label: "Vermelho"
  }, {
    id: "verde",
    label: "Verde"
  }, {
    id: "laranja",
    label: "Laranja"
  }, {
    id: "rosa",
    label: "Rosa"
  }, {
    id: "ciano",
    label: "Ciano"
  }, {
    id: "dourado",
    label: "Dourado"
  }];
  var DEFAULT_ID = "vermelho";
  function apply(id) {
    var preset = PRESETS.find(function (p) {
      return p.id === id;
    }) || PRESETS.find(function (p) {
      return p.id === DEFAULT_ID;
    });
    document.documentElement.setAttribute("data-theme", preset.id);
    return preset.id;
  }
  function init() {
    var saved = SessionStore.loadThemePreset();
    apply(saved || DEFAULT_ID);
  }
  function set(id) {
    var applied = apply(id);
    SessionStore.saveThemePreset(applied);
  }
  global.AppTheme = {
    PRESETS: PRESETS,
    DEFAULT_ID: DEFAULT_ID,
    init: init,
    set: set,
    current: function current() {
      return document.documentElement.getAttribute("data-theme") || DEFAULT_ID;
    }
  };
})(window);