/*
 * Porta de tv-app/android/.../data/SessionStore.kt. localStorage é
 * síncrono (sem DataStore/coroutines aqui), então a API fica mais simples
 * -- mesmas chaves/formato conceitual, tudo em JSON.
 */
(function (global) {
  "use strict";

  var KEY = {
    CREDS: "xtream_creds_v1",
    CUSTOM_LISTS: "custom_lists_v1",
    RESELLER_BACKUP: "reseller_creds_backup_v1",
    THEME_PRESET: "theme_preset_v1",
    LIVE_FORMAT: "live_format_v1",
    FAVORITES: "favorites_v1",
    ADULT_PIN: "adult_pin_v1",
    SEEN_OTHER_LISTS: "seen_other_reseller_lists_v1"
  };
  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  // Chave de um cadastro deste aparelho em outro revendedor (item de
  // other_resellers) no conjunto "já visto" (ver markOtherListSeen).
  function otherListKey(o) {
    return o.slug + "|" + (o.registered_at || "");
  }
  function slugOf(value) {
    return String(value || "").trim().toLowerCase();
  }
  var SessionStore = {
    saveCreds: function saveCreds(creds) {
      // Trocou de revendedor (Outras listas, lista salva, "voltar pra conta
      // anterior"): a sessão nova traz em other_resellers a lista de onde a
      // pessoa acabou de sair, com uma chave nunca vista -- sem isso a
      // pergunta "{marca} também cadastrou este aparelho" aparecia logo
      // depois da troca. Quem escolheu sair dela já conhece. Login depois de
      // sair da conta (sem sessão anterior) não marca nada.
      var previous = SessionStore.loadCreds();
      var before = slugOf(previous && previous.resellerSlug);
      if (before && creds && slugOf(creds.resellerSlug) && slugOf(creds.resellerSlug) !== before) {
        (creds.otherResellers || []).forEach(function (o) {
          if (o && slugOf(o.slug) === before) SessionStore.markOtherListSeen(otherListKey(o));
        });
      }
      writeJson(KEY.CREDS, creds);
    },
    loadCreds: function loadCreds() {
      return readJson(KEY.CREDS, null);
    },
    // Sair da conta apaga também o "voltar pra conta anterior": antes ele
    // sobrevivia ao logout e, depois de entrar com outra conta, "voltar"
    // restaurava a conta de antes. (Quem troca de lista usa saveCreds.)
    clearCreds: function clearCreds() {
      try {
        localStorage.removeItem(KEY.CREDS);
        localStorage.removeItem(KEY.RESELLER_BACKUP);
      } catch (e) {}
    },
    getCustomLists: function getCustomLists() {
      return readJson(KEY.CUSTOM_LISTS, []);
    },
    addCustomList: function addCustomList(entry) {
      var created = Object.assign({}, entry, {
        id: "custom_" + Date.now() + "_" + Math.floor(Math.random() * 1000000)
      });
      writeJson(KEY.CUSTOM_LISTS, SessionStore.getCustomLists().concat([created]));
      return created;
    },
    removeCustomList: function removeCustomList(id) {
      writeJson(KEY.CUSTOM_LISTS, SessionStore.getCustomLists().filter(function (l) {
        return l.id !== id;
      }));
    },
    updateCustomList: function updateCustomList(entry) {
      writeJson(KEY.CUSTOM_LISTS, SessionStore.getCustomLists().map(function (l) {
        return l.id === entry.id ? entry : l;
      }));
    },
    saveResellerBackup: function saveResellerBackup(creds) {
      writeJson(KEY.RESELLER_BACKUP, creds);
    },
    loadResellerBackup: function loadResellerBackup() {
      return readJson(KEY.RESELLER_BACKUP, null);
    },
    saveThemePreset: function saveThemePreset(id) {
      localStorage.setItem(KEY.THEME_PRESET, id);
    },
    loadThemePreset: function loadThemePreset() {
      return localStorage.getItem(KEY.THEME_PRESET);
    },
    saveLiveFormat: function saveLiveFormat(mode) {
      localStorage.setItem(KEY.LIVE_FORMAT, mode);
    },
    loadLiveFormat: function loadLiveFormat() {
      return localStorage.getItem(KEY.LIVE_FORMAT);
    },
    // Favoritos organizados por tipo -- { live: {id: {id,name,cover,url}}, ... }
    // -- espelha FavoritesScreen.kt/CatalogRepository.observeFavorites():
    // guarda o registro inteiro (não só o id) pra Favoritos poder listar
    // nome/capa/url sem precisar recarregar o catálogo inteiro de novo.
    getFavoritesRaw: function getFavoritesRaw() {
      return readJson(KEY.FAVORITES, {
        live: {},
        movie: {},
        series: {}
      });
    },
    // Compat: devolve só os ids por tipo (usado pelas grades pra saber se
    // UM item já está favoritado, sem precisar do registro inteiro).
    getFavorites: function getFavorites() {
      var raw = SessionStore.getFavoritesRaw();
      var out = {};
      ["live", "movie", "series"].forEach(function (k) {
        out[k] = Object.keys(raw[k] || {});
      });
      return out;
    },
    // item: {id, name, cover, url} -- url opcional (série não tem url própria).
    toggleFavorite: function toggleFavorite(type, item) {
      var id = typeof item === "string" ? item : item.id;
      var raw = SessionStore.getFavoritesRaw();
      if (!raw[type]) raw[type] = {};
      var nowFav;
      if (raw[type][id]) {
        delete raw[type][id];
        nowFav = false;
      } else {
        raw[type][id] = typeof item === "string" ? {
          id: id
        } : item;
        nowFav = true;
      }
      writeJson(KEY.FAVORITES, raw);
      return nowFav;
    },
    isFavorite: function isFavorite(type, id) {
      var raw = SessionStore.getFavoritesRaw();
      return !!(raw[type] && raw[type][id]);
    },
    listFavorites: function listFavorites(type) {
      var raw = SessionStore.getFavoritesRaw();
      var map = raw[type] || {};
      return Object.keys(map).map(function (id) {
        return map[id];
      });
    },
    saveAdultPin: function saveAdultPin(pin) {
      localStorage.setItem(KEY.ADULT_PIN, pin);
    },
    loadAdultPin: function loadAdultPin() {
      return localStorage.getItem(KEY.ADULT_PIN);
    },
    // Cadastros deste aparelho em outros revendedores que já viraram a
    // pergunta "qual lista usar" (slug|registered_at): pergunta uma vez só
    // por cadastro. Fica fora da sessão de propósito (clearCreds não apaga),
    // sobrevive a sair da conta e trocar de lista. Guarda as 50 últimas.
    // Mesma regra do Android.
    otherListKey: otherListKey,
    loadSeenOtherLists: function loadSeenOtherLists() {
      var list = readJson(KEY.SEEN_OTHER_LISTS, []);
      return Array.isArray(list) ? list : [];
    },
    markOtherListSeen: function markOtherListSeen(key) {
      var list = SessionStore.loadSeenOtherLists().filter(function (k) {
        return k !== key;
      });
      list.push(key);
      writeJson(KEY.SEEN_OTHER_LISTS, list.slice(-50));
    }
  };
  global.SessionStore = SessionStore;
})(window);