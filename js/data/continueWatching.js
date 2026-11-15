/*
 * "Continuar assistindo" (só filme/série -- Ao vivo não tem esse
 * conceito) -- porta 1:1 de tv-app/roku/source/ContinueWatchingStore.brs
 * (mesma API, mesmos limiares), usando localStorage em vez de
 * roRegistrySection. Lista única, mais recente primeiro, limitada a 30
 * itens. Chave composta (kind, id) -- um filme e um episódio de série com
 * o MESMO id numérico (provedores diferentes não garantem não colidir
 * entre vod/series) não se sobrescrevem.
 */
(function (global) {
  "use strict";

  var KEY = "continue_watching_v1";
  var MAX_ITEMS = 30;
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }
  function upsert(entry) {
    var list = load();
    var updated = [entry];
    list.forEach(function (it) {
      var sameItem = it.id === entry.id && it.kind === entry.kind;
      if (!sameItem && updated.length < MAX_ITEMS) updated.push(it);
    });
    save(updated);
  }
  function remove(id, kind) {
    save(load().filter(function (it) {
      return !(it.id === id && it.kind === kind);
    }));
  }
  function getPositionSec(id, kind) {
    var found = load().find(function (it) {
      return it.id === id && it.kind === kind;
    });
    return found ? found.positionSec : 0;
  }
  function getProgress(id, kind) {
    var found = load().find(function (it) {
      return it.id === id && it.kind === kind;
    });
    if (!found || !found.durationSec || found.durationSec <= 0) return 0;
    return found.positionSec / found.durationSec;
  }

  // Chamar ao trocar de conta/lista/servidor (logout, ativar outra lista
  // em Suas Listas) -- "continuar assistindo" guarda o id direto do
  // catálogo de um provedor específico; sem limpar, trocar de conta deixa
  // a lista com título de um provedor diferente. Favoritos fica de fora
  // de propósito (mesmo comportamento combinado do Android/Roku).
  function clearAll() {
    save([]);
  }

  // Limiares em PORCENTAGEM (2%/95%), não segundos fixos -- mesmo valor
  // do Android/Roku: um filme de 2h só é removido de "continuar
  // assistindo" faltando ~6min pro fim, e só começa a salvar depois de
  // uns bons minutos de reprodução de verdade.
  function onProgress(entry, posSec, durSec) {
    if (!posSec || !durSec || durSec <= 0) return;
    var pct = posSec / durSec;
    if (pct >= 0.95) {
      remove(entry.id, entry.kind);
      markCompleted(entry);
      return;
    }
    if (pct <= 0.02) return;
    // Revendo um episódio concluído: deixa de ser concluído e passa a
    // guardar onde parou (pedido explícito) -- só fica concluído de novo
    // terminando ou pulando pro próximo.
    if (entry.kind === "series") unmarkCompleted(entry.id, entry.kind);
    upsert(Object.assign({}, entry, {
      positionSec: posSec,
      durationSec: durSec
    }));
  }

  // Histórico de "já assistido até o fim" -- SEPARADO de "continuar
  // assistindo" (que só guarda o que está EM ANDAMENTO e é removido assim
  // que termina, ver onProgress acima). Pedido explícito: 1) marcar
  // visualmente episódio/filme já concluído (não só os em andamento), 2)
  // série não pode sumir de "Continuar" só porque a pessoa terminou o
  // episódio atual -- quem assistiu 1 episódio provavelmente quer ver o
  // próximo depois, então a série continua aparecendo ali mesmo sem
  // episódio ATIVO em andamento no momento.
  var COMPLETED_KEY = "completed_watch_v1";
  var MAX_COMPLETED = 500;
  function loadCompleted() {
    try {
      var raw = localStorage.getItem(COMPLETED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function saveCompleted(list) {
    try {
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  // entry: {id, kind, seriesId (opcional, só episódio de série)}
  function markCompleted(entry) {
    var list = loadCompleted();
    if (list.some(function (it) {
      return it.id === entry.id && it.kind === entry.kind;
    })) return;
    list.unshift({
      id: entry.id,
      kind: entry.kind,
      seriesId: entry.seriesId || null
    });
    if (list.length > MAX_COMPLETED) list = list.slice(0, MAX_COMPLETED);
    saveCompleted(list);
  }
  function unmarkCompleted(id, kind) {
    var list = loadCompleted();
    var kept = list.filter(function (it) {
      return !(it.id === id && it.kind === kind);
    });
    if (kept.length !== list.length) saveCompleted(kept);
  }
  function isCompleted(id, kind) {
    return loadCompleted().some(function (it) {
      return it.id === id && it.kind === kind;
    });
  }

  // ids de série (não de episódio) que têm PELO MENOS 1 episódio já
  // concluído -- usado por contentGrid.js pra manter a série em
  // "Continuar" mesmo sem episódio em andamento agora.
  function completedSeriesIds() {
    var ids = [];
    loadCompleted().forEach(function (it) {
      if (it.kind === "series" && it.seriesId && ids.indexOf(it.seriesId) < 0) ids.push(it.seriesId);
    });
    return ids;
  }
  global.ContinueWatching = {
    load: load,
    upsert: upsert,
    remove: remove,
    getPositionSec: getPositionSec,
    getProgress: getProgress,
    clearAll: clearAll,
    onProgress: onProgress,
    markCompleted: markCompleted,
    isCompleted: isCompleted,
    completedSeriesIds: completedSeriesIds
  };
})(window);