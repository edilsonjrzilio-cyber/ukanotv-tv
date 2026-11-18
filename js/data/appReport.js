function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
/*
 * Avisos leves pro painel, junto do heartbeat (17/11): versão do app, se o
 * aparelho já abriu algum conteúdo ("Já assistiu" na tela Clientes, sem
 * dizer o quê) e quantas vezes cada tipo de falha apareceu desde o último
 * heartbeat que o painel recebeu. Tudo no localStorage: sobrevive a fechar
 * o app, e a falha de login de antes de o aparelho existir no painel espera
 * o 1º heartbeat depois de entrar. Quem manda é PanelApi.deviceHeartbeat.
 *
 * O painel recusa o heartbeat INTEIRO se um campo vier fora do formato
 * (tipo só com a-z/0-9/_, contagem de 1 a 1000, no máximo 20 tipos,
 * versão até 40 letras) -- e sem heartbeat o bloqueio pelo painel não
 * chega. Por isso tudo é conferido aqui antes de sair.
 */
(function (global) {
  "use strict";

  var WATCHED_KEY = "watched_v1";
  var ERRORS_KEY = "panel_error_counts_v1";
  var MAX_KINDS = 20;
  var MAX_COUNT = 1000;

  // Cópia em memória: com o localStorage recusando gravar (cheio), a 1ª vez
  // continuaria "1ª vez" a cada vídeo e cada um mandaria um heartbeat.
  var watchedMem = false;

  // A versão é a do aviso de atualização (js/data/appUpdate.js, que segue
  // o config.xml); na versão Media Station X vem com " MSX" no fim.
  function version() {
    return global.AppUpdate ? AppUpdate.VERSION : "";
  }
  function hasWatched() {
    if (watchedMem) return true;
    try {
      watchedMem = localStorage.getItem(WATCHED_KEY) === "1";
    } catch (e) {}
    return watchedMem;
  }

  // Algo começou a tocar neste aparelho. true só na 1ª vez desde a
  // instalação (quem chama manda um heartbeat na hora); nunca volta atrás.
  function markWatched() {
    if (hasWatched()) return false;
    watchedMem = true;
    try {
      localStorage.setItem(WATCHED_KEY, "1");
    } catch (e) {}
    return true;
  }
  function loadErrors() {
    try {
      var raw = JSON.parse(localStorage.getItem(ERRORS_KEY) || "{}");
      return raw && _typeof(raw) === "object" && !Array.isArray(raw) ? raw : {};
    } catch (e) {
      return {};
    }
  }
  function saveErrors(map) {
    try {
      if (Object.keys(map).length) localStorage.setItem(ERRORS_KEY, JSON.stringify(map));else localStorage.removeItem(ERRORS_KEY);
    } catch (e) {}
  }

  // Tipo no formato que o painel aceita (minúsculas, números e _).
  function cleanKind(kind) {
    return String(kind || "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 60);
  }

  // Tipos: playback_failed (o player desistiu e mostrou "Não foi possível
  // reproduzir"), catalog_failed (catálogo não carregou e a tela mostrou o
  // erro) e login_failed_<motivo> (ver loginFailureKind).
  function recordError(kind) {
    var k = cleanKind(kind);
    if (!k) return;
    var map = loadErrors();
    // Fila cheia (20 tipos): o tipo novo fica de fora até o próximo envio.
    if (!map[k] && Object.keys(map).length >= MAX_KINDS) return;
    map[k] = Math.min(MAX_COUNT, (Number(map[k]) || 0) + 1);
    saveErrors(map);
  }
  function pendingErrors() {
    var map = loadErrors();
    var out = [];
    Object.keys(map).forEach(function (k) {
      var kind = cleanKind(k);
      var count = Math.min(MAX_COUNT, Math.floor(Number(map[k]) || 0));
      if (kind && count >= 1 && out.length < MAX_KINDS) out.push({
        kind: kind,
        count: count
      });
    });
    return out;
  }

  // O painel recebeu: tira da fila só o que foi mandado (o que entrou
  // enquanto o heartbeat ia e vinha fica pro próximo).
  function clearSent(sent) {
    var map = loadErrors();
    (sent || []).forEach(function (e) {
      if (!map[e.kind]) return;
      var left = (Number(map[e.kind]) || 0) - e.count;
      if (left > 0) map[e.kind] = left;else delete map[e.kind];
    });
    saveErrors(map);
  }

  // Campos extras do heartbeat. `watched` vai sempre (true ou false).
  function heartbeatFields() {
    return {
      app_version: String(version() || "").trim().slice(0, 40),
      watched: hasWatched(),
      errors: pendingErrors()
    };
  }

  // Motivo da falha de login, pelo código do PanelApi. "network" = a TV
  // sem internet, ou uma resposta que não é do painel (portal/proxy da
  // rede no meio do caminho).
  var LOGIN_REASON = {
    panel_unreachable: "panel_unreachable",
    panel_timeout: "timeout",
    panel_bad_response: "network",
    invalid_credentials: "invalid_credentials",
    reseller_unavailable: "reseller_unavailable",
    reseller_expired: "reseller_unavailable",
    mac_not_found: "not_found",
    account_not_found: "not_found",
    not_found: "not_found",
    panel_server_error: "server_error"
  };
  function loginFailureKind(code) {
    if (code === "panel_unreachable" && navigator.onLine === false) return "login_failed_network";
    return "login_failed_" + (LOGIN_REASON[code] || "unknown");
  }
  function recordLoginFailure(code) {
    // Campo vazio no formulário não chegou a ser um login.
    if (code === "missing_credentials") return;
    recordError(loginFailureKind(code));
  }
  global.AppReport = {
    version: version,
    hasWatched: hasWatched,
    markWatched: markWatched,
    recordError: recordError,
    recordLoginFailure: recordLoginFailure,
    loginFailureKind: loginFailureKind,
    heartbeatFields: heartbeatFields,
    clearSent: clearSent
  };
})(window);