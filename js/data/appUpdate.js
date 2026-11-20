/*
 * Versão Media Station X: o app é uma página no nosso servidor, então toda
 * abertura já pega a versão mais nova. Não existe aviso de atualização.
 * Mesma interface do js/data/appUpdate.js da Samsung (que este substitui no
 * build --msx). O build troca 1.0.16 MSX pela versão do app Samsung + data.
 */
(function (global) {
  "use strict";

  global.AppUpdate = {
    VERSION: "1.0.16 MSX",
    MESSAGE: "",
    check: function check() {},
    whenAvailable: function whenAvailable() {},
    available: function available() {
      return false;
    }
  };
})(window);