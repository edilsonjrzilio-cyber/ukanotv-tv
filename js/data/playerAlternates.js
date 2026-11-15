/*
 * Porta de tv-app/android/.../data/PlayerAlternates.kt -- gera variações
 * de extensão pra uma URL de stream Xtream (/live/, /movie/, /series/).
 * Painéis às vezes servem o mesmo conteúdo só numa extensão específica
 * mesmo respondendo por várias rotas -- sem isso, uma fonte "morta"
 * (404/travada) na 1ª extensão trava a reprodução pra sempre em vez de
 * tentar a próxima.
 */
(function (global) {
  "use strict";

  var LIVE_TS_RX = /^(\/live\/[^/]+\/[^/]+\/[^/.]+)\.(ts|mpegts|m2ts)$/i;
  var LIVE_HLS_RX = /^(\/live\/[^/]+\/[^/]+\/[^/.]+)\.m3u8$/i;
  var VOD_RX = /^(\/(?:movie|series)\/[^/]+\/[^/]+\/[^/.]+)\.([a-z0-9]{2,5})$/i;
  var VOD_EXTS = ["mp4", "mkv", "avi", "mov", "m4v", "ts", "m3u8"];
  var MAX_ALTERNATES = 16;
  var LIVE_FORMAT_AUTO = "auto",
    LIVE_FORMAT_HLS = "hls",
    LIVE_FORMAT_TS = "ts";
  function buildPlayerAlternates(rawUrl) {
    if (!rawUrl) return [];
    var result = [rawUrl];
    function add(u) {
      if (result.indexOf(u) < 0) result.push(u);
    }
    try {
      var u = new URL(rawUrl);
      var path = u.pathname;
      var m = LIVE_TS_RX.exec(path);
      if (m) add(rawUrl.replace(path, m[1] + ".m3u8"));
      m = LIVE_HLS_RX.exec(path);
      if (m) add(rawUrl.replace(path, m[1] + ".ts"));
      m = VOD_RX.exec(path);
      if (m) {
        var base = m[1],
          ext = m[2].toLowerCase();
        VOD_EXTS.forEach(function (alt) {
          if (alt !== ext) add(rawUrl.replace(path, base + "." + alt));
        });
      }
    } catch (e) {
      // URL malformada -- segue só com a original.
    }
    return result.slice(0, MAX_ALTERNATES);
  }

  // "Automático" mantém a ordem atual (HLS primeiro, cai pra TS sozinho);
  // forçar HLS ou TS restringe às URLs daquele formato -- pra painéis que
  // respondem nos dois formatos mas só um de fato funciona.
  function applyLiveFormatPreference(alternates, mode) {
    var filtered = alternates;
    if (mode === LIVE_FORMAT_HLS) filtered = alternates.filter(function (u) {
      return /\.m3u8$/i.test(u.split("?")[0]);
    });else if (mode === LIVE_FORMAT_TS) filtered = alternates.filter(function (u) {
      return /\.ts$/i.test(u.split("?")[0]);
    });
    return filtered.length ? filtered : alternates;
  }
  global.PlayerAlternates = {
    LIVE_FORMAT_AUTO: LIVE_FORMAT_AUTO,
    LIVE_FORMAT_HLS: LIVE_FORMAT_HLS,
    LIVE_FORMAT_TS: LIVE_FORMAT_TS,
    buildPlayerAlternates: buildPlayerAlternates,
    applyLiveFormatPreference: applyLiveFormatPreference
  };
})(window);