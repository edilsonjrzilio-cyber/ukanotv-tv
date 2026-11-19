/*
 * Porta de tv-app/android/.../data/M3uParser.kt. Mesma lógica de
 * classificação live/movie/series e agrupamento de episódios soltos por
 * nome-base de série.
 */
(function (global) {
  "use strict";

  var ATTR_RX_CACHE = {};
  function attribute(line, name) {
    if (!ATTR_RX_CACHE[name]) {
      ATTR_RX_CACHE[name] = new RegExp(name + "=(?:\"([^\"]*)\"|'([^']*)'|([^\\s,]+))", "i");
    }
    var m = ATTR_RX_CACHE[name].exec(line);
    if (!m) return null;
    return m[1] || m[2] || m[3] || null;
  }
  function logoFromExtinf(line) {
    return attribute(line, "tvg-logo") || attribute(line, "series-logo") || attribute(line, "tvg-cover") || attribute(line, "cover") || attribute(line, "poster") || attribute(line, "movie-image") || attribute(line, "logo");
  }
  var DIACRITICS_MATCH_RX = /(?:[\u0300-\u036F\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7-\u05C9\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B53-\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ABD\u1ABF-\u1AF0\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA82C\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]|\uD800[\uDDFD\uDEE0\uDF76-\uDF7A]|\uD802[\uDE01-\uDE03\uDE05\uDE06\uDE0C-\uDE0F\uDE38-\uDE3A\uDE3F\uDEE5\uDEE6]|\uD803[\uDD24-\uDD27\uDD69-\uDD6D\uDEAB\uDEAC\uDECB-\uDECF\uDEF0-\uDEFF\uDF46-\uDF50\uDF82-\uDF85]|\uD804[\uDC01\uDC38-\uDC46\uDC70\uDC73\uDC74\uDC7F-\uDC81\uDCB3-\uDCB6\uDCB9\uDCBA\uDCC2\uDD00-\uDD02\uDD27-\uDD2B\uDD2D-\uDD34\uDD73\uDD80\uDD81\uDDB6-\uDDBE\uDDC9-\uDDCC\uDDCF\uDE2F-\uDE31\uDE34\uDE36\uDE37\uDE3E\uDE41\uDEDF\uDEE3-\uDEEA\uDF00\uDF01\uDF3B\uDF3C\uDF40\uDF66-\uDF6C\uDF70-\uDF74\uDFBB-\uDFC0\uDFCE\uDFD0\uDFD2\uDFE1\uDFE2]|\uD805[\uDC38-\uDC3F\uDC42-\uDC44\uDC46\uDC5E\uDCB3-\uDCB8\uDCBA\uDCBF\uDCC0\uDCC2\uDCC3\uDDB2-\uDDB5\uDDBC\uDDBD\uDDBF\uDDC0\uDDDC\uDDDD\uDE33-\uDE3A\uDE3D\uDE3F\uDE40\uDEAB\uDEAD\uDEB0-\uDEB5\uDEB7\uDF1D\uDF1F\uDF22-\uDF25\uDF27-\uDF2B]|\uD806[\uDC2F-\uDC37\uDC39\uDC3A\uDD3B\uDD3C\uDD3E\uDD43\uDDD4-\uDDD7\uDDDA\uDDDB\uDDE0\uDE01-\uDE0A\uDE33-\uDE38\uDE3B-\uDE3E\uDE47\uDE51-\uDE56\uDE59-\uDE5B\uDE8A-\uDE96\uDE98\uDE99\uDF60\uDF62-\uDF64\uDF66]|\uD807[\uDC30-\uDC36\uDC38-\uDC3D\uDC3F\uDC92-\uDCA7\uDCAA-\uDCB0\uDCB2\uDCB3\uDCB5\uDCB6\uDD31-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD45\uDD47\uDD90\uDD91\uDD95\uDD97\uDDF0\uDEF3\uDEF4\uDF00\uDF01\uDF36-\uDF3A\uDF40\uDF42\uDF5A]|\uD80D[\uDC40\uDC47-\uDC55]|\uD818[\uDD1E-\uDD29\uDD2D-\uDD2F]|\uD81A[\uDEF0-\uDEF4\uDF30-\uDF36]|\uD81B[\uDF4F\uDF8F-\uDF92\uDFE4]|\uD82F[\uDC9D\uDC9E]|\uD833[\uDF00-\uDF2D\uDF30-\uDF46]|\uD834[\uDD27\uDD28\uDD67-\uDD69\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44\uDE5B\uDE5C]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A\uDC8F\uDD30-\uDD36\uDEAE\uDEEC-\uDEEF]|\uD839[\uDCEC-\uDCEF\uDDEE\uDDEF\uDEE3\uDEE6\uDEEE\uDEEF\uDEF5]|\uD83A[\uDCD0-\uDCD6\uDD44-\uDD4A]|\uDB40[\uDD00-\uDDEF])+/g;
  var PUNCT_TO_SPACE_RX = /[_()\[\]{}]+/g;
  var EXTRA_SPACES_RX = /\s+/g;
  var EXPLICIT_SERIES_RX = /\b(?:series?|seriados?|episode|episodio)\b/;
  var EXPLICIT_MOVIE_RX = /\b(?:movie|movies?|filmes?|vod)\b/;
  var EXPLICIT_LIVE_RX = /\b(?:live|canais?|channel|tv)\b/;
  var GROUP_SEPARATOR_RX = /\s*(?:\||›|»|>)\s*/;
  var GROUP_LIVE_RX = /\b(?:canais?|ao vivo|live|iptv|tv|esportes?|noticias?)\b/;
  var GROUP_MOVIE_RX = /\b(?:filmes?|movies?|vod|cinema|cine|lancamentos?)\b/;
  var GROUP_SERIES_RX = /\b(?:series?|seriados?|temporadas?|season|anime|animes|doramas?|novelas?)\b/;
  var GROUP_FIRST_SERIES_RX = /^(series?|seriados?|temporadas?|season)\b/;
  var GROUP_FIRST_MOVIE_RX = /^(filmes?|movies?|cinema|cine|lancamentos?)\b/;
  var EPISODE_PATTERN_RX = /\b(?:[st]\d{1,2}\s*(?:ep|e|x)\s*\d{1,3}|\d{1,2}x\d{1,3}|temporada\s*\d+|episodio\s*\d+)\b/;
  var SERIES_URL_RX = /\b(?:series?|temporadas?|season)\b/;
  var VIDEO_EXTENSION_RX = /\.(mp4|mkv|avi|mov|m4v|webm)(?:$|[?#])/i;
  var SERIES_NAME_RX = /\b(?:series?|seriados?|temporadas?|season)\b/;
  var MOVIE_NAME_RX = /\b(?:filmes?|movies?|vod|cinema|cine)\b/;
  function normalizeForMatch(value) {
    return value.normalize("NFD").replace(DIACRITICS_MATCH_RX, "").toLowerCase().replace(PUNCT_TO_SPACE_RX, " ").replace(EXTRA_SPACES_RX, " ").trim();
  }
  function explicitKind(line) {
    var value = attribute(line, "tvg-type") || attribute(line, "content-type") || attribute(line, "type");
    if (!value) return null;
    var n = normalizeForMatch(value);
    if (EXPLICIT_SERIES_RX.test(n)) return "series";
    if (EXPLICIT_MOVIE_RX.test(n)) return "movie";
    if (EXPLICIT_LIVE_RX.test(n)) return "live";
    return null;
  }
  function pathKind(url) {
    var path;
    try {
      path = new URL(url).pathname.toLowerCase();
    } catch (e) {
      path = url.toLowerCase();
    }
    if (path.indexOf("/series/") !== -1) return "series";
    if (path.indexOf("/movie/") !== -1) return "movie";
    if (path.indexOf("/live/") !== -1) return "live";
    return null;
  }
  function groupKind(group) {
    if (!group || !group.trim()) return null;
    var normalized = normalizeForMatch(group);
    var first = normalizeForMatch(group.split(GROUP_SEPARATOR_RX)[0] || group);
    var live = GROUP_LIVE_RX.test(normalized);
    var movie = GROUP_MOVIE_RX.test(normalized);
    var series = GROUP_SERIES_RX.test(normalized);
    if (live) return "live";
    if (movie && series) {
      if (GROUP_FIRST_SERIES_RX.test(first)) return "series";
      if (GROUP_FIRST_MOVIE_RX.test(first)) return "movie";
      return null;
    }
    if (series) return "series";
    if (movie) return "movie";
    return null;
  }
  function classify(name, group, url) {
    var pk = pathKind(url);
    if (pk) return pk;
    var normalizedName = normalizeForMatch(name);
    var normalizedUrl = normalizeForMatch(url);
    if (EPISODE_PATTERN_RX.test(normalizedName)) return "series";
    if (SERIES_URL_RX.test(normalizedUrl)) return "series";
    var gk = groupKind(group);
    if (gk) return gk;
    if (VIDEO_EXTENSION_RX.test(url)) return "movie";
    if (SERIES_NAME_RX.test(normalizedName)) return "series";
    if (MOVIE_NAME_RX.test(normalizedName)) return "movie";
    return "live";
  }

  // Título de um #EXTINF: o texto depois da 1ª vírgula FORA de aspas.
  // Antes pegava a 1ª vírgula da linha, e vírgula dentro de atributo é
  // comum (group-title="Ação, Aventura") -- o título virava um pedaço dos
  // atributos. Mesma regra do Android (m3uExtinfTitle).
  function extinfTitle(line) {
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (ch === '"') inQuotes = !inQuotes;else if (ch === "," && !inQuotes) return line.slice(i + 1).trim();
    }
    return "";
  }

  // Id estável de um item: hash do próprio link (2 hashes de 32 bits, pra
  // não colidir numa lista de 50 mil itens). Antes era o número da linha --
  // qualquer canal novo no topo deslocava todos os ids na próxima vez, e
  // favoritos/"Continuar" passavam a apontar pro item vizinho.
  function stableItemId(url) {
    var h1 = 0x811c9dc5,
      h2 = 5381;
    for (var i = 0; i < url.length; i++) {
      var c = url.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193);
      h2 = (h2 << 5) + h2 + c | 0;
    }
    return "m" + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }
  function parseM3U(text) {
    var items = [];
    var groupIntern = {};
    var current = null; // {name, logo, group}
    var kind = null;
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.indexOf("#EXTINF") === 0) {
        var name = extinfTitle(line) || (attribute(line, "tvg-name") || "").trim() || "Sem nome";
        var rawGroup = attribute(line, "group-title");
        var group = rawGroup ? groupIntern[rawGroup] || (groupIntern[rawGroup] = rawGroup) : null;
        current = {
          name: name,
          logo: logoFromExtinf(line),
          group: group
        };
        kind = explicitKind(line);
        continue;
      }
      if (line.charAt(0) === "#" || !current) continue;
      var itemKind = kind || classify(current.name, current.group, line);
      items.push({
        id: stableItemId(line),
        name: current.name,
        logo: current.logo,
        group: current.group,
        url: line,
        kind: itemKind
      });
      current = null;
    }
    return items;
  }
  var EPISODE_SXXEXX_RX = /^(.*?)[\s._-]+S(\d{1,2})\s*E(\d{1,3})\b.*$/i;
  var EPISODE_NXN_RX = /^(.*?)[\s._-]+(\d{1,2})x(\d{1,3})\b.*$/i;
  var EPISODE_TEMPORADA_RX = /^(.*?)[\s._-]+Temporada\s*(\d{1,2})[\s._-]*Epis[oó]dio\.?\s*(\d{1,3})\b.*$/i;
  var EPISODE_BARE_EP_RX = /^(.*?)[\s._-]+Ep(?:is[oó]dio)?\.?\s*(\d{1,3})\b.*$/i;
  function clean(base) {
    return base.trim().replace(/^[-|._]+|[-|._]+$/g, "").trim();
  }
  function parseM3uEpisodeMarker(rawName) {
    var name = (rawName || "").trim();
    var m = EPISODE_SXXEXX_RX.exec(name);
    if (m) {
      var base = clean(m[1]),
        season = parseInt(m[2], 10),
        ep = parseInt(m[3], 10);
      if (base && !isNaN(season) && !isNaN(ep)) return {
        baseName: base,
        season: season,
        episodeNumber: ep
      };
    }
    m = EPISODE_NXN_RX.exec(name);
    if (m) {
      base = clean(m[1]);
      season = parseInt(m[2], 10);
      ep = parseInt(m[3], 10);
      if (base && !isNaN(season) && !isNaN(ep)) return {
        baseName: base,
        season: season,
        episodeNumber: ep
      };
    }
    m = EPISODE_TEMPORADA_RX.exec(name);
    if (m) {
      base = clean(m[1]);
      season = parseInt(m[2], 10);
      ep = parseInt(m[3], 10);
      if (base && !isNaN(season) && !isNaN(ep)) return {
        baseName: base,
        season: season,
        episodeNumber: ep
      };
    }
    m = EPISODE_BARE_EP_RX.exec(name);
    if (m) {
      base = clean(m[1]);
      ep = parseInt(m[2], 10);
      if (base && !isNaN(ep)) return {
        baseName: base,
        season: 1,
        episodeNumber: ep
      };
    }
    return null;
  }
  function normalizeM3uSeriesName(value) {
    return normalizeForMatch(value);
  }
  function hashCode(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return h;
  }
  function m3uSeriesGroupId(normalizedBaseName) {
    return "m3u-" + (hashCode(normalizedBaseName) >>> 0).toString(16);
  }

  // ---- Procura de 1 canal na exportação completa (link alternativo) ----
  // Lê em pedaços enquanto baixa e PARA no canal ou no fim do Ao vivo, sem
  // guardar nada. Antes baixava a exportação INTEIRA (Filmes e Séries
  // juntos: 92 MB num provedor real) com res.text() + parseM3U de tudo, e a
  // TV ficava sem memória (no Roku o app fechava sozinho, 20/10/2026). Mesma
  // regra do Android (resolveLiveUrlFromM3uExport) e do Roku (M3uParser.brs).
  var EXPORT_TIMEOUT_MS = 45000;
  // Teto de texto lido: o Ao vivo costuma acabar em 1-5 MB, e no XHR o
  // responseText fica todo na memória até abortar.
  var EXPORT_MAX_CHARS = 16 * 1024 * 1024;
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // 1º pelo id no fim da URL (.../usuario/senha/<id>.ts, o mesmo id do
  // player_api), senão pelo nome (título ou tvg-name, sem diferenciar
  // maiúscula). Ao vivo = linha que não é /movie/ nem /series/: painel XUI
  // exporta o Ao vivo SEM "/live/" (http://host:80/usuario/senha/535120.ts).
  function newExportScan(streamId, channelName) {
    var id = streamId == null ? "" : String(streamId).trim();
    return {
      idRx: id ? new RegExp("/" + escapeRegExp(id) + "(?:\\.[a-z0-9]+)?$", "i") : null,
      target: (channelName || "").trim().toLowerCase(),
      pendingExtinf: null,
      seenLive: false,
      found: null,
      byName: null,
      done: false,
      rest: ""
    };
  }

  // `chunk` pode cortar uma linha no meio: o pedaço final fica em scan.rest
  // até o próximo (ou até `final`).
  function scanExportText(scan, chunk, final) {
    var lines = (scan.rest + chunk).split("\n");
    scan.rest = final ? "" : lines.pop();
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf("#EXTINF") === 0) {
        scan.pendingExtinf = line;
        continue;
      }
      if (!line || line.charAt(0) === "#") continue;
      var lower = line.toLowerCase();
      if (lower.indexOf("/movie/") !== -1 || lower.indexOf("/series/") !== -1) {
        // O Xtream exporta Ao vivo primeiro: passou dele, não tem mais o que achar.
        if (scan.seenLive) {
          scan.done = true;
          return;
        }
      } else {
        scan.seenLive = true;
        if (scan.pendingExtinf !== null) {
          if (scan.idRx && scan.idRx.test(line)) {
            scan.found = line;
            return;
          }
          if (!scan.byName && scan.target && extinfNameIs(scan.pendingExtinf, scan.target)) scan.byName = line;
        }
      }
      scan.pendingExtinf = null;
    }
  }
  function extinfNameIs(extinf, target) {
    if (extinfTitle(extinf).toLowerCase() === target) return true;
    return (attribute(extinf, "tvg-name") || "").trim().toLowerCase() === target;
  }

  // Promise<string|null>, nunca rejeita e sempre responde em até 45s.
  // fetch lendo o corpo em streaming quando a TV tem (o fetch de polyfill
  // não tem `body` e baixaria tudo antes de devolver); senão XHR lendo o
  // responseText a cada progresso (esse cresce até abortar).
  function findLiveInExport(exportUrl, streamId, channelName) {
    var scan = newExportScan(streamId, channelName);
    var job = {
      stopped: false,
      abort: function abort() {}
    };
    var canStream = typeof fetch === "function" && typeof TextDecoder === "function" && typeof Response !== "undefined" && "body" in Response.prototype;
    var work = (canStream ? scanByFetch : scanByXhr)(exportUrl, scan, job);
    var timer;
    var timeout = new Promise(function (resolve) {
      timer = setTimeout(resolve, EXPORT_TIMEOUT_MS);
    });
    var stop = function stop() {
      clearTimeout(timer);
      job.stopped = true;
      // No Chromium 47 (Samsung 2017) o reader.cancel() joga "the given
      // value is not a Promise" mesmo cancelando: não pode perder o link
      // já achado por causa disso.
      try {
        job.abort();
      } catch (e) {/* download já parado */}
      return scan.found || scan.byName || null;
    };
    return Promise.race([work, timeout]).then(stop, stop);
  }
  function scanByFetch(url, scan, job) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    job.abort = function () {
      if (controller) controller.abort();
    };
    var init = {
      headers: {
        Accept: "audio/x-mpegurl, text/plain, */*"
      }
    };
    if (controller) init.signal = controller.signal;
    return fetch(url, init).then(function (res) {
      if (job.stopped || !res.ok) return;
      if (!res.body || !res.body.getReader) {
        job.abort();
        return scanByXhr(url, scan, job);
      }
      var reader = res.body.getReader();
      job.abort = function () {
        if (controller) controller.abort();
        var p = reader.cancel();
        if (p && p.catch) p.catch(function () {});
      };
      var decoder = new TextDecoder("utf-8");
      var chars = 0;
      var _pump = function pump() {
        return reader.read().then(function (r) {
          if (job.stopped) return;
          if (r.done) {
            scanExportText(scan, decoder.decode(), true);
            return;
          }
          var text = decoder.decode(r.value, {
            stream: true
          });
          chars += text.length;
          scanExportText(scan, text, false);
          if (scan.found || scan.done || chars > EXPORT_MAX_CHARS) return;
          return _pump();
        });
      };
      return _pump();
    });
  }
  function scanByXhr(url, scan, job) {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      var seen = 0,
        settled = false;
      var finish = function finish() {
        if (settled) return;
        settled = true;
        try {
          xhr.abort();
        } catch (e) {/* já terminou */}
        resolve();
      };
      job.abort = finish;
      var readNew = function readNew(final) {
        var text = xhr.responseText || "";
        scanExportText(scan, text.slice(seen), final);
        seen = text.length;
      };
      xhr.open("GET", url, true);
      xhr.setRequestHeader("Accept", "audio/x-mpegurl, text/plain, */*");
      xhr.onprogress = function () {
        if (settled) return;
        if (xhr.status !== 200) {
          finish();
          return;
        }
        readNew(false);
        if (scan.found || scan.done || seen > EXPORT_MAX_CHARS) finish();
      };
      xhr.onload = function () {
        if (!settled && xhr.status === 200) readNew(true);
        finish();
      };
      xhr.onerror = finish;
      xhr.onabort = finish;
      xhr.send();
    });
  }

  // Só a ÚLTIMA lista lida (a da conta atual), e uma busca em andamento por
  // vez: Ao vivo/Filmes/Séries pedem a lista ao mesmo tempo na abertura, e
  // antes cada um baixava e lia a lista inteira (uma de 50MB ficava 3x na
  // memória da TV).
  var playlistCache = null; // { key, at, items }
  var inflight = null; // { key, promise }
  var CACHE_TTL_MS = 5 * 60 * 1000;
  function loadPlaylistItems(creds) {
    var targetUrl = creds.m3uUrl || creds.url;
    var cacheKey = creds.username + "|" + targetUrl;
    if (playlistCache && playlistCache.key === cacheKey && Date.now() - playlistCache.at < CACHE_TTL_MS) {
      return Promise.resolve(playlistCache.items);
    }
    if (inflight && inflight.key === cacheKey) return inflight.promise;

    // Mesmo teto de 4 min do catálogo Xtream (XtreamApi.fetchTextCapped): lista
    // que chega aos poucos não prende a tela pra sempre.
    var cap = global.XtreamApi && XtreamApi.fetchTextCapped;
    var promise = (cap ? cap(targetUrl, "audio/x-mpegurl, text/plain, */*", XtreamApi.REQUEST_CAP_MS).catch(function (e) {
      var m = /failed: (\d+)/.exec(e && e.message || "");
      throw new Error(m ? "Falha ao carregar a lista (HTTP " + m[1] + ")." : e && e.message === "timeout" ? "A lista demorou demais para chegar." : e && e.message || "Falha ao carregar a lista.");
    }) : fetch(targetUrl, {
      headers: {
        Accept: "audio/x-mpegurl, text/plain, */*"
      }
    }).then(function (res) {
      if (!res.ok) throw new Error("Falha ao carregar a lista (HTTP " + res.status + ").");
      return res.text();
    })).then(function (text) {
      var items = parseM3U(text);
      if (!items.length) throw new Error("Nenhum conteúdo encontrado na lista.");
      playlistCache = {
        key: cacheKey,
        at: Date.now(),
        items: items
      };
      return items;
    });
    inflight = {
      key: cacheKey,
      promise: promise
    };
    var clear = function clear() {
      if (inflight && inflight.promise === promise) inflight = null;
    };
    promise.then(clear, clear);
    return promise;
  }
  global.M3uParser = {
    parseM3U: parseM3U,
    parseM3uEpisodeMarker: parseM3uEpisodeMarker,
    normalizeM3uSeriesName: normalizeM3uSeriesName,
    m3uSeriesGroupId: m3uSeriesGroupId,
    loadPlaylistItems: loadPlaylistItems,
    findLiveInExport: findLiveInExport
  };
})(window);