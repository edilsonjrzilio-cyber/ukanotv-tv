function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
/*
 * Porta de tv-app/android/.../data/XtreamApi.kt. Mesmo caminho DIRETO
 * (sem proxy do painel) -- chamadas batem direto no player_api.php do
 * provedor.
 */
(function (global) {
  "use strict";

  function normalizeUrl(url) {
    var u = (url || "").trim();
    if (!/^https?:\/\//i.test(u)) u = "http://" + u;
    u = u.replace(/\/get\.php.*$/i, "").replace(/\/player_api\.php.*$/i, "").replace(/\?.*$/, "").replace(/\/+$/, "");
    return u;
  }
  function encodeSeg(v) {
    return encodeURIComponent((v || "").trim());
  }
  function numericIdString(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return String(Math.trunc(value));
    return String(value).split(".0")[0];
  }
  function apiBase(creds) {
    return normalizeUrl(creds.url) + "/player_api.php?username=" + encodeSeg(creds.username) + "&password=" + encodeSeg(creds.password);
  }

  // 25/11: o Aura recusava parte dos pedidos por excesso (429, e 503 nos
  // canais) e aceitava o mesmo pedido segundos depois. O app tratava a recusa
  // como servidor fora: trocava de DNS/servidor, ou o catálogo "não
  // carregava". Recusa por excesso espera um pouco e pede de novo (até 2
  // vezes); o prazo de quem chama continua valendo por cima.
  var BUSY_RETRY_MS = [2500, 4000];
  // Um pedido por vez ao servidor da lista (25/11, medido na LG): a entrada
  // disparava 6 pedidos juntos (canais, filmes, séries + as 3 categorias),
  // logo depois das conferências, e o Aura recusava vários na hora (429 em
  // 0,1 s) -- o catálogo "não carregava" e a tela ficava girando, enquanto
  // um app que pede uma coisa de cada vez abria normal. A fila vale pra tudo
  // que passa por aqui; o próximo só sai quando o anterior respondeu.
  var queueTail = Promise.resolve();
  function fetchQueued(url, options) {
    var run = function run() {
      if (options && options.signal && options.signal.aborted) return Promise.reject(new Error("aborted"));
      return fetch(url, options);
    };
    var mine = queueTail.then(run, run);
    queueTail = mine.then(function () {}, function () {});
    return mine;
  }
  function fetchRetryBusy(url, options, attempt) {
    attempt = attempt || 0;
    return fetchQueued(url, options).then(function (res) {
      if (res.status !== 429 && res.status !== 503 || attempt >= BUSY_RETRY_MS.length) return res;
      if (options && options.signal && options.signal.aborted) return res;
      return new Promise(function (resolve) {
        setTimeout(resolve, BUSY_RETRY_MS[attempt]);
      }).then(function () {
        return fetchRetryBusy(url, options, attempt + 1);
      });
    });
  }

  // Teto do pedido inteiro (19/11): sem ele, servidor que manda o catálogo aos
  // poucos deixava o pedido aberto pra sempre e Ao vivo/Filmes/Séries ficavam
  // em "carregando" até fechar o app (clientes presos ~20 min). Passou do teto
  // = erro: a tela mostra a falha e a próxima abertura tenta de novo. Mesmo
  // teto do Android (callTimeout de 4 min).
  var REQUEST_CAP_MS = 4 * 60 * 1000;
  function fetchTextCapped(url, accept, capMs) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer;
    var cap = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        if (ctrl) {
          try {
            ctrl.abort();
          } catch (e) {}
        }
        reject(new Error("timeout"));
      }, capMs);
    });
    var request = fetchRetryBusy(url, {
      headers: {
        Accept: accept
      },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error("Xtream request failed: " + res.status);
      return res.text();
    });
    return Promise.race([request, cap]).then(function (text) {
      clearTimeout(timer);
      return text;
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }
  function getJson(url) {
    return fetchTextCapped(url, "application/json, text/plain, */*", REQUEST_CAP_MS);
  }

  // Conferência de DNS antes de baixar o catálogo (ver App.ensureWorkingServer):
  // DNS bloqueado pela operadora costuma ficar "pendurado" até o prazo da
  // própria TV, e cada DNS testado custava esse tempo todo. Mesmo prazo do
  // Android (quickCheckClient).
  var QUICK_CHECK_TIMEOUT_MS = 10000;
  function getJsonQuick(url) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer;
    var timeout = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error("timeout"));
      }, QUICK_CHECK_TIMEOUT_MS);
    });
    var request = fetchRetryBusy(url, {
      headers: {
        Accept: "application/json, text/plain, */*"
      },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error("Xtream request failed: " + res.status);
      return res.text();
    });
    return Promise.race([request, timeout]).then(function (text) {
      clearTimeout(timer);
      return text;
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }
  function callAction(creds, action, params) {
    params = params || {};
    var base = apiBase(creds);
    var sep = base.indexOf("?") >= 0 ? "&" : "?";
    var qs = "action=" + encodeSeg(action);
    Object.keys(params).forEach(function (k) {
      qs += "&" + k + "=" + encodeSeg(params[k]);
    });
    return getJson(base + sep + qs);
  }
  function firstText() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }
  var COVER_JUNK_RX = /^(?:null|undefined|none|n\/a|-|0|false)$/i;
  var DATA_OR_BLOB_URL_RX = /^(?:data:image\/|blob:)/i;
  var HTTP_URL_RX = /^https?:\/\//i;
  var TMDB_PATH_RX = /^\/t\/p\//i;
  var IMAGE_FILENAME_RX = /^\/[^/]+\.(?:jpe?g|png|webp)(?:[?#].*)?$/i;
  function sanitizeCover(raw, sourceUrl) {
    var trimmed = (raw || "").toString().trim();
    if (!trimmed || COVER_JUNK_RX.test(trimmed)) return "";
    if (DATA_OR_BLOB_URL_RX.test(trimmed)) return trimmed;
    try {
      if (trimmed.indexOf("//") === 0) return "https:" + trimmed;
      if (HTTP_URL_RX.test(trimmed)) return trimmed;
      if (TMDB_PATH_RX.test(trimmed)) return "https://image.tmdb.org" + trimmed;
      if (IMAGE_FILENAME_RX.test(trimmed)) return "https://image.tmdb.org/t/p/w500" + trimmed;
      if (trimmed.charAt(0) === "/" && sourceUrl) return new URL(trimmed, normalizeUrl(sourceUrl)).toString();
      return "";
    } catch (e) {
      return "";
    }
  }

  // ServerHealth: "ok" | "invalid_credentials" | "unknown"
  // quick = prazo curto (conferência de DNS, ver getJsonQuick).
  function healthFromText(text) {
    var map;
    try {
      map = JSON.parse(text);
    } catch (e) {
      return "unknown";
    }
    // Resposta de um pedido com "action" (ver abaixo): lista = conta aceita.
    if (Array.isArray(map)) return "ok";
    var info = map && map.user_info;
    if (!info) return "unknown";
    var auth = info.auth;
    var authOk = auth === 1 || auth === "1";
    var status = (info.status || "").toString().toLowerCase();
    return authOk && (status === "" || status === "active") ? "ok" : "invalid_credentials";
  }
  // Na página do Media Station (20/11, medido numa LG): o servidor responde
  // o pedido de login (sem "action") SEM liberar a página (CORS), e a TV
  // barra na hora; os pedidos com "action" passam. A conferência dava sempre
  // "sem resposta" e a troca sozinha de DNS/servidor nunca funcionava ali.
  // Falhou sem ser por prazo: confere de novo pela lista de categorias.
  function xtreamAuthCheck(creds, quick) {
    var get = quick ? getJsonQuick : getJson;
    var byCategories = function byCategories() {
      return get(apiBase(creds) + "&action=get_live_categories").then(healthFromText, function () {
        return "unknown";
      });
    };
    // 25/11: o Aura respondia o pedido de login com 200 e corpo VAZIO, e os
    // pedidos com "action" (categorias, canais) normalmente. A conferência
    // dava "sem resposta" com o servidor funcionando: o app trocava de DNS,
    // caía no Reserva e baixava o catálogo de novo a cada abertura, enquanto
    // outros apps tocavam normal. Resposta que não dá pra ler também confere
    // pela lista de categorias.
    return get(apiBase(creds)).then(function (text) {
      var health = healthFromText(text);
      return health === "unknown" ? byCategories() : health;
    }, function (e) {
      if (e && e.message === "timeout") return "unknown";
      return byCategories();
    });
  }
  function isServerHealthy(creds) {
    if (creds.mode === "xtream") return xtreamAuthCheck(creds);
    var raw = (creds.m3uUrl || creds.url || "").trim();
    if (!raw) return Promise.resolve("unknown");
    var target = /^https?:\/\//i.test(raw) ? raw : "http://" + raw;
    return fetch(target).then(function (res) {
      return res.ok ? "ok" : "unknown";
    }).catch(function () {
      return "unknown";
    });
  }
  function fetchCategoryMap(creds, action) {
    return callAction(creds, action).then(function (text) {
      var list;
      try {
        list = JSON.parse(text);
      } catch (e) {
        return {};
      }
      var map = {};
      (list || []).forEach(function (c) {
        map[(c.category_id || "").toString()] = c.category_name || "";
      });
      return map;
    }).catch(function () {
      return {};
    });
  }

  // Cache em memória (vive só enquanto o app tá aberto) de getLiveStreams/
  // getVod/getSeries -- pedido explícito: Ao vivo/Filmes/Séries demoravam
  // (buscava na rede do zero toda vez que a tela abria), travando por um
  // instante. App.boot()/reloadSession() agora pré-busca os 3 durante a
  // tela "Verificando sua sessão…" (prefetchAll), então quando a pessoa
  // entra em qualquer uma dessas telas pela 1ª vez o dado já está pronto.
  var listCache = {};
  // Lista anterior de cada chave enquanto a nova é buscada (Recarregar):
  // se a busca nova falhar, as telas continuam com a que já tinha, em vez
  // de ficarem vazias.
  var staleCache = {};
  // A chave não leva o DNS: trocar de DNS dentro do mesmo servidor é a mesma
  // conta e o mesmo catálogo (antes a troca jogava o catálogo fora e baixava
  // os 3 de novo). Lista direta (sem servidor do painel) segue pelo endereço.
  function listCacheKey(creds, kind) {
    return kind + "|" + (creds.mode || "xtream") + "|" + (creds.currentServerId || creds.url || creds.m3uUrl || "") + "|" + (creds.username || "");
  }

  // ===== Catálogo guardado na TV (25/11) =====
  // Antes o app baixava canais, filmes e séries inteiros (uns 23 MB, 6
  // pedidos) em TODA abertura. Servidor que limita pedidos por minuto (o
  // Aura devolvia 429) recusava parte deles e a tela ficava girando sem
  // entrar, enquanto app que guarda o catálogo no aparelho abria em
  // segundos. Agora cada lista fica guardada (IndexedDB) e a abertura usa a
  // guardada: canais valem 3 horas, filmes e séries 7 dias (mesma regra do
  // Android desde a v69). "Recarregar" baixa tudo de novo. Se o servidor
  // não responder, vale a guardada, de qualquer idade.
  var DISK_DB = "ukanotv-catalogo";
  var DISK_STORE = "listas";
  var DISK_MAX_AGE_MS = {
    live: 3 * 3600 * 1000,
    vod: 7 * 24 * 3600 * 1000,
    series: 7 * 24 * 3600 * 1000
  };
  var forceNet = {};
  var diskDb = null;
  function diskOpen() {
    if (diskDb) return diskDb;
    diskDb = new Promise(function (resolve) {
      try {
        var rq = global.indexedDB.open(DISK_DB, 1);
        rq.onupgradeneeded = function () {
          rq.result.createObjectStore(DISK_STORE);
        };
        rq.onsuccess = function () {
          resolve(rq.result);
        };
        rq.onerror = function () {
          resolve(null);
        };
        rq.onblocked = function () {
          resolve(null);
        };
      } catch (e) {
        resolve(null);
      }
    });
    return diskDb;
  }
  // { at, json } ou null. Nunca rejeita.
  function diskGet(key) {
    return diskOpen().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var rq = db.transaction(DISK_STORE, "readonly").objectStore(DISK_STORE).get(key);
          rq.onsuccess = function () {
            resolve(rq.result && rq.result.json ? rq.result : null);
          };
          rq.onerror = function () {
            resolve(null);
          };
        } catch (e) {
          resolve(null);
        }
      });
    });
  }
  // Melhor esforço. Guarda só a lista desta conta: apaga as do mesmo tipo
  // de outras contas/servidores, pra não encher a memória da TV.
  function diskPut(key, kind, list) {
    if (!list || !list.length) return;
    var json;
    try {
      json = JSON.stringify(list);
    } catch (e) {
      return;
    }
    diskOpen().then(function (db) {
      if (!db) return;
      try {
        var store = db.transaction(DISK_STORE, "readwrite").objectStore(DISK_STORE);
        var keys = store.getAllKeys ? store.getAllKeys() : null;
        if (keys) keys.onsuccess = function () {
          (keys.result || []).forEach(function (k) {
            if (k !== key && String(k).indexOf(kind + "|") === 0) store.delete(k);
          });
        };
        store.put({
          at: Date.now(),
          json: json
        }, key);
      } catch (e) {}
    });
  }
  // Quando a lista guardada deste tipo foi baixada (ms), ou 0.
  function savedAt(creds, kind) {
    return diskGet(listCacheKey(creds, kind)).then(function (saved) {
      return saved ? saved.at : 0;
    });
  }
  function cachedList(kind, creds, fetchFn) {
    var key = listCacheKey(creds, kind);
    if (listCache[key]) return listCache[key];
    // Trocou de servidor/lista: larga o catálogo da conta anterior (antes
    // ficavam todos em memória, um por servidor já usado).
    Object.keys(listCache).forEach(function (k) {
      if (k.indexOf(kind + "|") === 0 && k !== key) delete listCache[k];
    });
    var stale = staleCache[key];
    var p = diskGet(key).then(function (saved) {
      var fromDisk = function fromDisk() {
        return JSON.parse(saved.json);
      };
      var forced = forceNet[kind];
      delete forceNet[kind];
      if (saved && !forced && Date.now() - saved.at < DISK_MAX_AGE_MS[kind]) {
        try {
          return fromDisk();
        } catch (e) {}
      }
      return fetchFn().then(function (list) {
        diskPut(key, kind, list);
        return list;
      }, function (e) {
        // Servidor não respondeu: a guardada, mesmo antiga, é melhor que nada.
        if (saved && !stale) {
          try {
            return fromDisk();
          } catch (e2) {}
        }
        throw e;
      });
    }).then(function (list) {
      delete staleCache[key];
      return list;
    }, function (e) {
      delete listCache[key];
      if (stale) {
        listCache[key] = stale;
        return stale;
      }
      throw e;
    });
    listCache[key] = p;
    return p;
  }
  // Chamado por App.reloadSession() -- "Recarregar" deve buscar dado NOVO
  // do provedor, não repetir o que já estava em memória nem o guardado.
  function clearListCache() {
    staleCache = listCache;
    listCache = {};
    forceNet = {
      live: true,
      vod: true,
      series: true
    };
  }

  // Lista do catálogo. Resposta que não é lista (página de erro, JSON
  // quebrado, conta vencida no provedor) era tratada como catálogo vazio
  // "carregado com sucesso" e ficava em cache; agora é erro (a tela tenta
  // de novo na próxima vez e o Recarregar mantém o catálogo anterior).
  function parseCatalogList(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error("bad_catalog");
    }
    if (Array.isArray(parsed)) return parsed;
    // Alguns painéis mandam o catálogo como objeto {"0": {...}, "1": {...}}.
    if (parsed && _typeof(parsed) === "object" && !parsed.user_info) {
      var values = Object.keys(parsed).map(function (k) {
        return parsed[k];
      });
      if (values.length && values.every(function (v) {
        return v && _typeof(v) === "object";
      })) return values;
      if (!values.length) return [];
    }
    throw new Error("bad_catalog");
  }
  function getLiveStreams(creds) {
    return cachedList("live", creds, function () {
      return fetchLiveStreamsNet(creds);
    });
  }
  function fetchLiveStreamsNet(creds) {
    // `num` = número do canal que o servidor manda (17/11: o mesmo dos
    // outros apps e de todas as casas, o que aparece na lista e se digita no
    // controle). M3U não tem: vale a posição na lista. Igual o Android.
    if (creds.mode === "m3u") {
      return M3uParser.loadPlaylistItems(creds).then(function (items) {
        return items.filter(function (it) {
          return it.kind === "live";
        }).map(function (it, i) {
          return {
            streamId: it.id,
            name: it.name,
            streamIcon: it.logo || "",
            categoryId: it.group || "",
            categoryName: it.group,
            group: it.group,
            url: it.url,
            num: i + 1
          };
        });
      });
    }
    return Promise.all([callAction(creds, "get_live_streams"), fetchCategoryMap(creds, "get_live_categories")]).then(function (r) {
      var text = r[0],
        categoryMap = r[1];
      var raw = parseCatalogList(text);
      var out = [];
      (raw || []).forEach(function (item) {
        var id = numericIdString(item.stream_id);
        if (!id) return;
        var categoryId = (item.category_id || "").toString();
        var group = firstText(item.category_name, categoryMap[categoryId], categoryId);
        out.push({
          streamId: id,
          name: firstText(item.name) || "Canal",
          streamIcon: sanitizeCover(item.stream_icon, creds.url),
          categoryId: categoryId,
          categoryName: group,
          group: group,
          num: parseInt(item.num, 10) || 0
        });
      });
      return numberChannels(out);
    });
  }

  // Na ordem do número. Servidor que não manda o número (ou manda
  // repetido): numera pela ordem em que ele mandou, que é a mesma do `num`.
  function numberChannels(list) {
    var seen = {};
    var ok = list.every(function (ch) {
      if (!(ch.num > 0) || seen[ch.num]) return false;
      seen[ch.num] = true;
      return true;
    });
    if (!ok) {
      list.forEach(function (ch, i) {
        ch.num = i + 1;
      });
      return list;
    }
    return list.slice().sort(function (a, b) {
      return a.num - b.num;
    });
  }
  function extensionFromUrl(url, fallback) {
    fallback = fallback || "mp4";
    if (!url) return fallback;
    var m = /\.([a-z0-9]{2,5})(?:$|[?#])/i.exec(url);
    return m ? m[1].toLowerCase() : fallback;
  }
  function getVod(creds) {
    return cachedList("vod", creds, function () {
      return fetchVodNet(creds);
    });
  }
  function fetchVodNet(creds) {
    if (creds.mode === "m3u") {
      return M3uParser.loadPlaylistItems(creds).then(function (items) {
        return items.filter(function (it) {
          return it.kind === "movie";
        }).map(function (it) {
          return {
            streamId: it.id,
            name: it.name,
            streamIcon: it.logo || "",
            categoryId: it.group || "",
            categoryName: it.group,
            group: it.group,
            containerExtension: extensionFromUrl(it.url),
            url: it.url
          };
        });
      });
    }
    return Promise.all([callAction(creds, "get_vod_streams"), fetchCategoryMap(creds, "get_vod_categories")]).then(function (r) {
      var text = r[0],
        categoryMap = r[1];
      var raw = parseCatalogList(text);
      var out = [];
      (raw || []).forEach(function (item) {
        var id = numericIdString(item.stream_id);
        if (!id) return;
        var categoryId = (item.category_id || "").toString();
        var group = firstText(item.category_name, categoryMap[categoryId], categoryId);
        out.push({
          streamId: id,
          name: firstText(item.name) || "Filme",
          streamIcon: sanitizeCover(item.stream_icon, creds.url),
          categoryId: categoryId,
          categoryName: group,
          group: group,
          rating: item.rating != null ? String(item.rating) : null,
          containerExtension: item.container_extension,
          added: item.added
        });
      });
      return out;
    });
  }
  function getSeries(creds) {
    return cachedList("series", creds, function () {
      return fetchSeriesNet(creds);
    });
  }
  function fetchSeriesNet(creds) {
    if (creds.mode === "m3u") {
      return M3uParser.loadPlaylistItems(creds).then(function (items) {
        var series = items.filter(function (it) {
          return it.kind === "series";
        });
        var firstItemByKey = {};
        var order = [];
        var displayNameByKey = {};
        series.forEach(function (item) {
          var marker = M3uParser.parseM3uEpisodeMarker(item.name);
          var key = marker ? M3uParser.normalizeM3uSeriesName(marker.baseName) : "single-" + item.id;
          if (!firstItemByKey[key]) {
            firstItemByKey[key] = item;
            order.push(key);
            displayNameByKey[key] = marker ? marker.baseName : item.name;
          }
        });
        return order.map(function (key) {
          var item = firstItemByKey[key];
          return {
            seriesId: M3uParser.m3uSeriesGroupId(key),
            name: displayNameByKey[key] || item.name,
            cover: sanitizeCover(item.logo, creds.url),
            categoryId: item.group || "",
            categoryName: item.group,
            group: item.group
          };
        });
      });
    }
    return Promise.all([callAction(creds, "get_series"), fetchCategoryMap(creds, "get_series_categories")]).then(function (r) {
      var showsText = r[0],
        categoryMap = r[1];
      var shows = parseCatalogList(showsText);
      return (shows || []).map(function (show, index) {
        var categoryId = (show.category_id || "").toString();
        var group = firstText(show.category_name, categoryMap[categoryId], categoryId);
        var cover = sanitizeCover(firstText(show.cover, show.cover_big, show.cover_path, show.movie_image, show.poster, show.poster_path, show.backdrop_path, show.stream_icon), creds.url);
        return {
          seriesId: numericIdString(show.series_id) || "series-" + index,
          name: firstText(show.name) || "Série",
          cover: cover,
          categoryId: categoryId,
          categoryName: group,
          group: group,
          rating: show.rating != null ? String(show.rating) : null,
          lastModified: show.last_modified != null ? String(show.last_modified) : null
        };
      });
    });
  }
  function loadSeriesEpisodes(creds, showId) {
    if (creds.mode === "m3u") {
      return M3uParser.loadPlaylistItems(creds).then(function (items) {
        var series = items.filter(function (it) {
          return it.kind === "series";
        });
        var out = [];
        series.forEach(function (item) {
          var marker = M3uParser.parseM3uEpisodeMarker(item.name);
          var key = marker ? M3uParser.normalizeM3uSeriesName(marker.baseName) : "single-" + item.id;
          if (M3uParser.m3uSeriesGroupId(key) !== showId) return;
          var season = marker ? marker.season : 1;
          var episodeNumber = marker ? marker.episodeNumber : 1;
          var label = marker ? marker.baseName + " S" + pad2(season) + "E" + pad2(episodeNumber) : item.name;
          out.push({
            episodeId: item.id,
            name: label,
            cover: sanitizeCover(item.logo, creds.url),
            url: item.url,
            season: season,
            episodeNumber: episodeNumber
          });
        });
        out.sort(function (a, b) {
          return a.season - b.season || a.episodeNumber - b.episodeNumber;
        });
        return out;
      });
    }
    return callAction(creds, "get_series_info", {
      series_id: showId
    }).then(function (text) {
      return parseSeriesEpisodes(text, creds);
    }).catch(function () {
      return [];
    });
  }
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  var EPISODE_NUMBER_ONLY_RX = /^(?:s\d{1,3}\s*[-.x]?\s*e\d{1,4}|(?:epis[oó]dio|episode|ep\.?|cap[ií]tulo)\s*\d{1,4}|\d{1,4})$/i;
  function parseSeriesEpisodes(text, creds) {
    var info;
    try {
      info = JSON.parse(text);
    } catch (e) {
      return [];
    }
    var episodesBySeason = info && info.episodes;
    if (!episodesBySeason) return [];
    var showName = firstText(info.info && info.info.name) || "Série";
    var showCover = firstText(info.info && info.info.cover, info.info && info.info.movie_image);
    var out = [];
    var seen = {};
    // "episodes" vem como {"1": [...], "2": [...]} na maioria dos painéis,
    // mas alguns mandam lista de listas ([[...], [...]]) -- aí a temporada
    // vem no próprio episódio. Mesmo tratamento do Android.
    var groups = Array.isArray(episodesBySeason) ? episodesBySeason.map(function (list) {
      return {
        key: null,
        list: list
      };
    }) : Object.keys(episodesBySeason).map(function (k) {
      return {
        key: k,
        list: episodesBySeason[k]
      };
    });
    groups.forEach(function (g) {
      var list = Array.isArray(g.list) ? g.list : g.list && _typeof(g.list) === "object" ? [g.list] : [];
      list.forEach(function (ep) {
        if (!ep || _typeof(ep) !== "object") return;
        var episodeId = numericIdString(ep.id);
        // Mesmo episódio listado 2x: tira o repetido.
        if (!episodeId || seen[episodeId]) return;
        seen[episodeId] = true;
        var season = parseInt(g.key != null ? g.key : ep.season, 10);
        if (isNaN(season)) season = parseInt(ep.season, 10);
        if (isNaN(season)) season = 1;
        var episodeNumber = parseInt(ep.episode_num != null ? ep.episode_num : ep.episode, 10);
        if (isNaN(episodeNumber)) episodeNumber = 1;
        var title = firstText(ep.title);
        var cover = sanitizeCover(firstText(showCover, ep.info && ep.info.movie_image, ep.info && ep.info.cover, ep.movie_image, ep.cover), creds.url);
        var ext = (ep.container_extension || "mp4").replace(/^\./, "") || "mp4";
        // Título que já traz o nome da série vale sozinho; título que é só
        // a numeração ("S01 E01", "Episódio 3") não entra -- virava
        // "Série S01E01 - S01 E01". Mesma regra do Android.
        var label = title && title.toLowerCase().indexOf(showName.toLowerCase()) !== -1 ? title : showName + " S" + pad2(season) + "E" + pad2(episodeNumber) + (title && !EPISODE_NUMBER_ONLY_RX.test(title) ? " - " + title : "");
        out.push({
          episodeId: episodeId,
          name: label,
          cover: cover,
          url: seriesEpisodeUrl(creds, episodeId, ext),
          season: season,
          episodeNumber: episodeNumber
        });
      });
    });
    out.sort(function (a, b) {
      return a.season - b.season || a.episodeNumber - b.episodeNumber;
    });
    return out;
  }
  function toPlotInfo(map) {
    if (!map) return null;
    function s() {
      for (var i = 0; i < arguments.length; i++) {
        var v = map[arguments[i]];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    }
    var plot = s("plot", "description"),
      cast = s("cast"),
      director = s("director"),
      genre = s("genre");
    if (!plot && !cast && !director && !genre) return null;
    return {
      plot: plot,
      cast: cast,
      director: director,
      genre: genre,
      releaseDate: s("releaseDate", "releasedate", "release_date"),
      duration: s("duration")
    };
  }
  function getSeriesPlot(creds, showId) {
    if (creds.mode === "m3u") return Promise.resolve(null);
    return callAction(creds, "get_series_info", {
      series_id: showId
    }).then(function (text) {
      var map;
      try {
        map = JSON.parse(text);
      } catch (e) {
        return null;
      }
      return toPlotInfo(map && map.info);
    }).catch(function () {
      return null;
    });
  }
  function loadSeriesDetail(creds, showId) {
    if (creds.mode === "m3u") return loadSeriesEpisodes(creds, showId).then(function (eps) {
      return {
        episodes: eps,
        plot: null
      };
    });
    return callAction(creds, "get_series_info", {
      series_id: showId
    }).then(function (text) {
      var episodes = parseSeriesEpisodes(text, creds);
      var map;
      try {
        map = JSON.parse(text);
      } catch (e) {
        map = null;
      }
      return {
        episodes: episodes,
        plot: toPlotInfo(map && map.info)
      };
    }).catch(function () {
      return {
        episodes: [],
        plot: null
      };
    });
  }
  function getVodPlot(creds, streamId) {
    if (creds.mode === "m3u") return Promise.resolve(null);
    return callAction(creds, "get_vod_info", {
      vod_id: streamId
    }).then(function (text) {
      var map;
      try {
        map = JSON.parse(text);
      } catch (e) {
        return null;
      }
      return toPlotInfo(map && map.info);
    }).catch(function () {
      return null;
    });
  }
  function base64DecodeUtf8(input) {
    try {
      return decodeURIComponent(escape(atob(input)));
    } catch (e) {
      return "";
    }
  }
  function getShortEpg(creds, streamId) {
    if (creds.mode === "m3u") return Promise.resolve(null);
    return callAction(creds, "get_short_epg", {
      stream_id: streamId,
      limit: "1"
    }).then(function (text) {
      var res;
      try {
        res = JSON.parse(text);
      } catch (e) {
        return null;
      }
      var listing = res && res.epg_listings && res.epg_listings[0];
      if (!listing) return null;
      var title = listing.title ? base64DecodeUtf8(listing.title).trim() : "";
      if (!title) return null;
      var description = listing.description ? base64DecodeUtf8(listing.description).trim() : null;
      return {
        title: title,
        description: description || null,
        start: listing.start,
        end: listing.end
      };
    }).catch(function () {
      return null;
    });
  }

  // Instante do item do EPG: pelo timestamp Unix (segundos) quando vier --
  // "start"/"end" vêm no fuso do PAINEL, e lidos como hora local da TV a
  // programação aparecia deslocada em horas. Sem timestamp, cai no texto
  // (assume painel e TV no mesmo fuso, como antes). Mesma regra do Android.
  function epgTimeMs(timestamp, text) {
    var seconds = parseInt(timestamp, 10);
    if (seconds > 0) return seconds * 1000;
    return parseEpgDate(text);
  }
  function parseEpgDate(s) {
    // "yyyy-MM-dd HH:mm:ss", lido como horário local da TV.
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  }
  function getLiveEpgSchedule(creds, streamId, limit) {
    limit = limit || 5;
    if (creds.mode === "m3u") return Promise.resolve([]);
    return callAction(creds, "get_short_epg", {
      stream_id: streamId,
      limit: String(limit)
    }).then(function (text) {
      var res;
      try {
        res = JSON.parse(text);
      } catch (e) {
        return [];
      }
      var out = [];
      (res && res.epg_listings || []).forEach(function (listing) {
        var title = listing.title ? base64DecodeUtf8(listing.title).trim() : "";
        var start = epgTimeMs(listing.start_timestamp, listing.start);
        var end = epgTimeMs(listing.stop_timestamp, listing.end);
        if (!title || start == null || end == null) return;
        out.push({
          title: title,
          startMs: start,
          endMs: end
        });
      });
      return out;
    }).catch(function () {
      return [];
    });
  }
  function liveStreamUrl(creds, id) {
    return normalizeUrl(creds.url) + "/live/" + encodeSeg(creds.username) + "/" + encodeSeg(creds.password) + "/" + id + ".m3u8";
  }
  function vodStreamUrl(creds, id, ext) {
    var safeExt = (ext || "mp4").replace(/^\./, "") || "mp4";
    return normalizeUrl(creds.url) + "/movie/" + encodeSeg(creds.username) + "/" + encodeSeg(creds.password) + "/" + id + "." + safeExt;
  }
  function seriesEpisodeUrl(creds, episodeId, ext) {
    var safeExt = (ext || "mp4").replace(/^\./, "") || "mp4";
    return normalizeUrl(creds.url) + "/series/" + encodeSeg(creds.username) + "/" + encodeSeg(creds.password) + "/" + episodeId + "." + safeExt;
  }
  function playableLiveUrl(creds, channel) {
    return channel.url && channel.url.trim() || liveStreamUrl(creds, channel.streamId);
  }
  function playableVodUrl(creds, item) {
    return item.url && item.url.trim() || vodStreamUrl(creds, item.streamId, item.containerExtension || "mp4");
  }

  // Lê a exportação em pedaços e para no canal (M3uParser.findLiveInExport).
  // Antes passava pelo loadPlaylistItems: baixava e guardava a exportação
  // inteira, Filmes e Séries juntos.
  function resolveLiveUrlFromM3uExport(creds, streamId, channelName) {
    if (creds.mode !== "xtream") return Promise.resolve(null);
    var exportUrl = normalizeUrl(creds.url) + "/get.php?username=" + encodeSeg(creds.username) + "&password=" + encodeSeg(creds.password) + "&type=m3u_plus&output=ts";
    return M3uParser.findLiveInExport(exportUrl, streamId, channelName).catch(function () {
      return null;
    });
  }

  // Dispara os 3 em paralelo e some com o próprio erro -- melhor esforço:
  // é só um "esquenta" do cache, se um provedor falhar a tela de destino
  // (live.js/movieDetail.js/...) tenta de novo sozinha na hora, normal.
  // onItem(kind, list) -- opcional -- é chamado a cada um dos 3 que
  // termina, pra quem chamou (App.finishLogin) mostrar progresso real em
  // vez de um spinner genérico parado.
  function prefetchAll(creds, onItem) {
    function track(kind, promise) {
      return promise.then(function (list) {
        if (onItem) onItem(kind, list);
        return list;
      }).catch(function () {
        if (onItem) onItem(kind, null);
      });
    }
    return Promise.all([track("live", getLiveStreams(creds)), track("vod", getVod(creds)), track("series", getSeries(creds))]);
  }
  global.XtreamApi = {
    normalizeUrl: normalizeUrl,
    sanitizeCover: sanitizeCover,
    xtreamAuthCheck: xtreamAuthCheck,
    isServerHealthy: isServerHealthy,
    fetchTextCapped: fetchTextCapped,
    REQUEST_CAP_MS: REQUEST_CAP_MS,
    getLiveStreams: getLiveStreams,
    getVod: getVod,
    getSeries: getSeries,
    prefetchAll: prefetchAll,
    clearListCache: clearListCache,
    savedAt: savedAt,
    loadSeriesEpisodes: loadSeriesEpisodes,
    getSeriesPlot: getSeriesPlot,
    loadSeriesDetail: loadSeriesDetail,
    getVodPlot: getVodPlot,
    getShortEpg: getShortEpg,
    getLiveEpgSchedule: getLiveEpgSchedule,
    liveStreamUrl: liveStreamUrl,
    vodStreamUrl: vodStreamUrl,
    seriesEpisodeUrl: seriesEpisodeUrl,
    playableLiveUrl: playableLiveUrl,
    playableVodUrl: playableVodUrl,
    resolveLiveUrlFromM3uExport: resolveLiveUrlFromM3uExport
  };
})(window);