/*
 * Camada de plataforma da Samsung (Tizen) -- tudo que é próprio da TV
 * Samsung fica aqui; o resto do app veio do app LG (tv-app/lg), mas é uma
 * cópia independente (mexer num não altera o outro).
 *
 * APIs da Samsung usadas (carregadas por $WEBAPIS/webapis/webapis.js no
 * index.html e pelo objeto `tizen`, que a TV injeta sozinha):
 *   tizen.tvinputdevice  -- teclas de mídia/coloridas do controle
 *   tizen.application    -- sair do app
 *   webapis.appcommon    -- descanso de tela
 *   webapis.productinfo  -- DUID (id de hardware estável)
 *   webapis.avplay       -- player da TV (toca MKV/TS que o <video> não toca)
 * Fora da TV (navegador no PC, pra testar), cada uma cai num padrão que
 * funciona sem elas.
 */
(function (global) {
  "use strict";

  // Setas, OK e Voltar (10009) já chegam sem registro. As outras precisam
  // ser registradas, senão a TV fica com elas (amarelo = favoritar).
  var EXTRA_KEYS = ["MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop", "MediaFastForward", "MediaRewind", "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue", "ChannelUp", "ChannelDown"];
  function registerKeys() {
    var input = global.tizen && global.tizen.tvinputdevice;
    if (!input) return;
    for (var i = 0; i < EXTRA_KEYS.length; i++) {
      try {
        input.registerKey(EXTRA_KEYS[i]);
      } catch (e) {}
    }
  }

  // Mesmo pedido do app LG: a TV não pode escurecer/entrar no descanso de
  // tela com o app aberto.
  function preventScreenSaver() {
    try {
      var common = global.webapis && global.webapis.appcommon;
      if (common && common.setScreenSaver) common.setScreenSaver(common.AppCommonScreenSaverState.SCREEN_SAVER_OFF);
    } catch (e) {}
  }
  function init() {
    registerKeys();
    preventScreenSaver();
    // Voltar da TV pro app (a TV pode ter ligado o descanso de novo).
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) preventScreenSaver();
    });
  }

  // Sai do app pelo jeito certificado da Samsung (Voltar na Início/Login).
  function exitApp() {
    try {
      if (global.tizen && global.tizen.application) {
        global.tizen.application.getCurrentApplication().exit();
        return;
      }
    } catch (e) {}
    try {
      window.close();
    } catch (e) {}
  }

  // DUID: id da TV que não muda ao reinstalar o app -- o aparelho no painel
  // continua o mesmo (ver deviceIdentity.js).
  function stableDeviceSeed() {
    try {
      var info = global.webapis && global.webapis.productinfo;
      var duid = info && info.getDuid ? info.getDuid() : null;
      return duid ? "samsung:" + duid : null;
    } catch (e) {
      return null;
    }
  }

  // ===== Vídeo da tela cheia pelo AVPlay =====
  // Mesma interface que o player usa do <video> (src, play, pause,
  // currentTime, duration, paused, eventos playing/waiting/timeupdate/
  // error/ended/loadedmetadata, style.objectFit/transform pro zoom). O
  // AVPlay desenha ATRÁS da página: enquanto ele está ativo o <html> ganha
  // a classe "avplay-active" e o fundo do player fica transparente (ver
  // css/theme.css).
  function AvPlayVideo(placeholder, av) {
    var self = this;
    var listeners = {};
    var url = "";
    var state = "idle"; // idle | preparing | ready | playing | paused
    var wantPlay = true;
    var pendingSeek = null;
    var fit = "contain";
    var zoom = "scale(1)";
    var generation = 0;
    var surface = document.createElement("object");
    surface.setAttribute("type", "application/avplayer");
    surface.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
    placeholder.parentNode.insertBefore(surface, placeholder);
    placeholder.style.display = "none";
    function emit(type) {
      var list = (listeners[type] || []).slice();
      for (var i = 0; i < list.length; i++) {
        try {
          list[i]({
            type: type,
            target: self
          });
        } catch (e) {}
      }
    }
    function applyDisplayMode() {
      try {
        // "cover"/zoom: preenche a tela toda; "contain": proporção original.
        var fill = fit === "cover" || zoom !== "scale(1)";
        av.setDisplayMethod(fill ? "PLAYER_DISPLAY_MODE_FULL_SCREEN" : "PLAYER_DISPLAY_MODE_LETTER_BOX");
      } catch (e) {}
    }
    function close() {
      generation++;
      try {
        av.stop();
      } catch (e) {}
      try {
        av.close();
      } catch (e) {}
      state = "idle";
      document.documentElement.classList.remove("avplay-active");
    }
    function startPlay() {
      try {
        av.play();
        state = "playing";
        if (pendingSeek !== null) {
          var to = pendingSeek;
          pendingSeek = null;
          try {
            av.seekTo(Math.floor(to * 1000), function () {}, function () {});
          } catch (e) {}
        }
        emit("playing");
      } catch (e) {
        emit("error");
      }
    }
    function open() {
      close();
      if (!url) return;
      var myGen = generation;
      document.documentElement.classList.add("avplay-active");
      try {
        av.open(url);
        av.setListener({
          onbufferingstart: function onbufferingstart() {
            if (myGen === generation) emit("waiting");
          },
          onbufferingcomplete: function onbufferingcomplete() {
            if (myGen === generation && state === "playing") emit("playing");
          },
          oncurrentplaytime: function oncurrentplaytime() {
            if (myGen === generation) emit("timeupdate");
          },
          onstreamcompleted: function onstreamcompleted() {
            if (myGen !== generation) return;
            state = "paused";
            emit("ended");
          },
          onerror: function onerror() {
            if (myGen === generation) emit("error");
          },
          onevent: function onevent() {}
        });
        av.setDisplayRect(0, 0, 1920, 1080);
        applyDisplayMode();
        state = "preparing";
        av.prepareAsync(function () {
          if (myGen !== generation) return;
          state = "ready";
          emit("loadedmetadata");
          if (wantPlay) startPlay();
        }, function () {
          if (myGen === generation) emit("error");
        });
      } catch (e) {
        state = "idle";
        setTimeout(function () {
          if (myGen === generation) emit("error");
        }, 0);
      }
    }
    self.addEventListener = function (type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    };
    self.removeEventListener = function (type, fn) {
      var list = listeners[type];
      if (!list) return;
      var i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    };
    Object.defineProperty(self, "src", {
      get: function get() {
        return url;
      },
      set: function set(value) {
        url = value || "";
        wantPlay = true;
        pendingSeek = null;
        open();
      }
    });
    self.removeAttribute = function (name) {
      if (name !== "src") return;
      url = "";
      close();
    };
    self.load = function () {};
    self.play = function () {
      wantPlay = true;
      if (state === "paused") {
        try {
          av.play();
          state = "playing";
          emit("playing");
        } catch (e) {
          return Promise.reject(e);
        }
      } else if (state === "ready") {
        startPlay();
      }
      return Promise.resolve();
    };
    self.pause = function () {
      wantPlay = false;
      if (state === "playing") {
        try {
          av.pause();
          state = "paused";
        } catch (e) {}
      }
    };
    Object.defineProperty(self, "paused", {
      get: function get() {
        return state !== "playing";
      }
    });
    Object.defineProperty(self, "currentTime", {
      get: function get() {
        if (state === "idle" || state === "preparing") return pendingSeek || 0;
        try {
          return av.getCurrentTime() / 1000;
        } catch (e) {
          return 0;
        }
      },
      set: function set(sec) {
        if (state === "playing" || state === "paused") {
          try {
            av.seekTo(Math.floor(sec * 1000), function () {}, function () {});
          } catch (e) {}
        } else {
          pendingSeek = sec;
        }
      }
    });
    Object.defineProperty(self, "duration", {
      get: function get() {
        if (state === "idle" || state === "preparing") return NaN;
        try {
          var ms = av.getDuration();
          return ms > 0 ? ms / 1000 : NaN;
        } catch (e) {
          return NaN;
        }
      }
    });

    // O player muda style.objectFit/transform pro zoom -- vira o modo de
    // exibição do AVPlay.
    var style = {};
    Object.defineProperty(style, "objectFit", {
      get: function get() {
        return fit;
      },
      set: function set(v) {
        fit = v;
        applyDisplayMode();
      }
    });
    Object.defineProperty(style, "transform", {
      get: function get() {
        return zoom;
      },
      set: function set(v) {
        zoom = v;
        applyDisplayMode();
      }
    });
    self.style = style;
  }
  function fullscreenVideo(el) {
    var av = global.webapis && global.webapis.avplay;
    // Navegador comum (teste no PC): o próprio <video>.
    if (!av || !el || !el.parentNode) return el;
    return new AvPlayVideo(el, av);
  }
  global.Platform = {
    // Vai no registro do aparelho no painel (/device/auth, campo platform).
    name: global.tizen ? "tizen samsung" : "tizen sim",
    init: init,
    exitApp: exitApp,
    fullscreenVideo: fullscreenVideo,
    stableDeviceSeed: stableDeviceSeed
  };
})(window);