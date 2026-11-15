/* Porta de tv-app/android/.../data/Adult.kt -- mesma regex, mesmo PIN
   fixo, desbloqueio só em memória (reseta a cada reabertura do app). */
(function (global) {
  "use strict";

  var ADULT_PIN = "0000";
  // Limites por "não é letra/número" em vez de \b: com \b, "+18" e "18+"
  // nunca casavam ao lado de espaço/início/fim (os dois lados da fronteira
  // são não-palavra) -- "Canais +18", "Filmes 18+" passavam sem PIN. Sem
  // lookbehind de propósito: o navegador das TVs LG mais antigas não tem.
  // Roda sobre o texto minúsculo e sem acento ("Eróticos" casa). Mesma
  // regra do Adult.kt (Android).
  var ADULT_REGEX = /(?:^|[^a-z0-9])(xxx|porn|porno|adult[oa]s?|adult|hentai|sexy?|erotic[oa]s?|18\+|\+18|nsfw|playboy|brazzers|onlyfans)(?![a-z0-9])/;
  function fold(value) {
    var s = String(value).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s;
  }
  function isAdult() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] && ADULT_REGEX.test(fold(arguments[i]))) return true;
    }
    return false;
  }

  // Resultado guardado no próprio item e, pra categoria (que se repete em
  // milhares de itens), por nome: antes cada abertura de Filmes refazia a
  // checagem (minúsculas + tirar acento + regex) nos 30 mil filmes, e a
  // tela ficava ~4 s congelada na TV Samsung.
  var groupMemo = {};
  function isAdultGroup(value) {
    if (!value) return false;
    var key = String(value);
    if (groupMemo[key] === undefined) groupMemo[key] = isAdult(key);
    return groupMemo[key];
  }
  function isAdultContent(item) {
    if (item._adult !== undefined) return item._adult;
    var adult = isAdultGroup(item.group) || isAdultGroup(item.categoryName) || isAdult(item.name);
    item._adult = adult;
    return adult;
  }
  var unlocked = false;
  global.AdultGate = {
    isUnlocked: function isUnlocked() {
      return unlocked;
    },
    tryUnlock: function tryUnlock(pin) {
      var ok = pin === ADULT_PIN;
      if (ok) unlocked = true;
      return ok;
    },
    lock: function lock() {
      unlocked = false;
    },
    filterList: function filterList(items) {
      return unlocked ? items : items.filter(function (it) {
        return !isAdultContent(it);
      });
    }
  };
  global.isAdultContent = isAdultContent;
})(window);