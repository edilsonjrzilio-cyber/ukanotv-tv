/*
 * Versão do app que abre DENTRO do Media Station X (MSX), pedido de
 * 15/11/2026. O cliente instala o MSX pela loja oficial da TV (Samsung, LG
 * e outras), digita o nosso endereço em Settings > Start Parameter, e o MSX
 * troca a página dele por esta (link:replace, ver msx/abrir.json).
 *
 * A página continua rodando dentro do app do MSX na TV. Por isso:
 *   - na Samsung, o webapis.js da TV costuma estar disponível (AVPlay, DUID)
 *     e o js/lib/platform.js da Samsung (carregado antes deste) já usa;
 *   - na LG, o PalmSystem do webOS está disponível (js/lib/webOSTV.js);
 *   - em qualquer outro (navegador, Android do MSX), cai no <video> comum.
 *
 * Este arquivo só ajusta o que muda em relação ao app Samsung instalado:
 * o nome da plataforma no painel, sair do app e o descanso de tela da LG.
 */
(function (global) {
  "use strict";

  var base = global.Platform || {};
  var isSamsung = !!(global.tizen || global.webapis && global.webapis.avplay);
  var isLg = !isSamsung && !!global.PalmSystem;

  // Mesmo pedido do app LG: a TV não pode escurecer com o app aberto.
  // Chamada da LG pra recusar o descanso de tela (ver tv-app/lg/js/app.js).
  function lgPreventScreenSaver() {
    if (!global.webOS || !global.webOS.service) return;
    try {
      global.webOS.service.request("luna://com.webos.service.tvpower", {
        method: "power/registerScreenSaverRequest",
        parameters: {
          subscribe: true,
          clientName: "ukanotv"
        },
        subscribe: true,
        onSuccess: function onSuccess(res) {
          if (res && res.state === "Active") {
            global.webOS.service.request("luna://com.webos.service.tvpower", {
              method: "power/responseScreenSaverRequest",
              parameters: {
                clientName: "ukanotv",
                ack: false,
                timestamp: res.timestamp
              }
            });
          }
        },
        onFailure: function onFailure() {}
      });
    } catch (e) {}
  }

  // Voltar do controle na LG dentro do MSX (bug de 15/11: em Filmes, Voltar
  // pedia pra sair do app em vez de voltar pra Início). O app do MSX na LG
  // não liga o "disableBackHistoryAPI" (o nosso app da LG liga), então a TV
  // não manda a tecla 461 pra página: ela faz "voltar a página"
  // (history.back) e, sem página anterior, mostra o "sair do app?".
  // Solução: sempre deixar uma página anterior falsa (pushState). Quando a
  // TV volta pra ela (popstate), é o Voltar do controle: recoloca a falsa e
  // manda o mesmo "sn:back" que a tecla 461 manda (spatialnav.js).
  // Se a TV mandar a tecla E voltar a página no mesmo toque, só vale um.
  var DEDUP_MS = 700;
  var lastKeyBack = 0;
  var lastPopBack = 0;
  var exiting = false;
  function pushGuard() {
    try {
      global.history.pushState({
        ukanoBack: true
      }, "");
    } catch (e) {}
  }
  function lgBackViaHistory() {
    if (!global.history || typeof global.history.pushState !== "function") return;
    // Na fase de captura da window: roda antes do spatialnav (document).
    global.addEventListener("keydown", function (e) {
      if (e.keyCode !== 461) return;
      if (Date.now() - lastPopBack < DEDUP_MS) {
        e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        return;
      }
      lastKeyBack = Date.now();
    }, true);
    global.addEventListener("popstate", function () {
      if (exiting) {
        // O platformBack voltou a página em vez de mostrar o "sair do app?".
        try {
          window.close();
        } catch (e) {}
        return;
      }
      pushGuard();
      if (Date.now() - lastKeyBack < DEDUP_MS) return;
      lastPopBack = Date.now();
      document.dispatchEvent(new CustomEvent("sn:back"));
    });
    pushGuard();
  }
  function init() {
    if (base.init) base.init();
    if (isLg) {
      lgPreventScreenSaver();
      lgBackViaHistory();
    }
  }

  // Voltar na Início/Login: fecha o MSX inteiro, pelo jeito de cada TV.
  function exitApp() {
    if (isSamsung && base.exitApp) {
      base.exitApp();
      return;
    }
    try {
      if (global.webOS && typeof global.webOS.platformBack === "function") {
        // O popstate que vier logo depois é do próprio platformBack (ver
        // lgBackViaHistory), não um Voltar novo.
        exiting = true;
        setTimeout(function () {
          exiting = false;
        }, 1500);
        global.webOS.platformBack();
        return;
      }
    } catch (e) {}
    try {
      window.close();
    } catch (e) {}
  }
  global.Platform = {
    // Vai no registro do aparelho (/device/auth, campo platform). Começa com
    // "tizen"/"webos" pro painel mostrar "TV Samsung"/"TV LG" sem mudança lá.
    name: isSamsung ? "tizen msx" : isLg ? "webos msx" : "msx",
    init: init,
    exitApp: exitApp,
    fullscreenVideo: base.fullscreenVideo || function (el) {
      return el;
    },
    // Samsung: DUID, se a TV deixar o MSX ler (o MAC fica o mesmo ao
    // reinstalar). LG e outros: MAC gerado e guardado (deviceIdentity.js).
    stableDeviceSeed: base.stableDeviceSeed || function () {
      return null;
    },
    isMsx: true
  };
})(window);