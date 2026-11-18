/*
 * Porta de tv-app/android/.../ui/player/PlayerScreen.kt -- <video> em tela
 * cheia + chrome de 2 barras (cima: voltar/zoom/favoritar; baixo: seek -10s/
 * play-pausa/seek +10s + selo AO VIVO ou tempo+progresso). webOS tem
 * suporte nativo a HLS no <video> em muitos modelos. Tentativas, variações
 * de formato, plano B da exportação M3U e reconexão com espera crescente
 * seguem o PlayerScreen.kt (ver startAttempt/onFailure).
 */
(function (global) {
  "use strict";

  var video = null;
  var hideTimer = null;
  var request = null;
  var triedFallback = false;
  var progressTimer = null;
  var tickTimer = null;
  var alternates = [];
  var altIndex = 0;
  var zoomLevel = 1; // 0=Ajustar(FIT) 1=Zoom(preenche, padrão) 2=Zoom+(preenche e escala mais)
  var isFavorite = false;

  // Troca de canal no ao vivo (pedido de 17/11, igual o Android): Baixo =
  // próximo canal da lista de onde ele foi aberto, Cima = anterior, dando a
  // volta nas pontas; CH+/CH- e os números do controle também. O nome
  // aparece na hora e o player novo só abre quando a pessoa para de apertar
  // (senão cada toque abria uma conexão com o provedor -- lição dos 26
  // saltos do avançar, 25/10).
  var ZAP_COMMIT_MS = 700;
  // CH+/CH-: 427/428 na Samsung (registradas em platform.js); 33/34 na LG
  // (versão Media Station X).
  var KEY_CH_UP = [427, 33];
  var KEY_CH_DOWN = [428, 34];
  var zapList = null;
  var zapTarget = -1;
  var zapTimer = null;
  var zapBadge = null;
  var channelEntry = null;
  // Todos os canais (pra digitar o número de qualquer categoria) e o mapa
  // número do servidor -> canal.
  var allLive = null;
  var liveByNumber = {
    map: {},
    max: 0
  };

  // Porta de PlayerScreen.kt/seekStepForRepeat -- segurar ESQUERDA/DIREITA
  // acelera (10s nos 2 primeiros repeats, 20s até o 6º, 40s depois). Usa
  // e.repeat (padrão web, não contagem própria) -- em controles/firmwares
  // webOS que não repetem o keydown sozinhos enquanto a tecla fica
  // pressionada, e.repeat nunca vem true e cada toque só dá o passo base
  // de 10s (degrada bem, não quebra).
  function seekStepForRepeat(count) {
    if (count > 6) return 40;
    if (count > 2) return 20;
    return 10;
  }
  var seekRepeatCount = {
    left: 0,
    right: 0
  };
  function render() {
    var root = document.querySelector('.screen[data-screen="player"] .screen-content');
    root.innerHTML = '<div style="position:relative;width:100%;height:100%;background:#000;overflow:hidden;">' + '  <video id="player-video" style="width:100%;height:100%;object-fit:contain;background:#000;" autoplay playsinline></video>' + '  <div id="player-spinner" style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:16px;font-weight:700;">Carregando…</div>' + '  <div id="player-topbar" style="position:absolute;left:0;right:0;top:0;padding:18px 24px;background:linear-gradient(rgba(0,0,0,0.75),transparent);display:flex;align-items:center;gap:14px;">' + '    <button class="focusable player-btn" id="player-back">' + Icon("back") + "</button>" + '    <div id="player-title" style="flex:1;color:#fff;font-size:16px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>' + '    <button class="focusable player-btn" id="player-zoom">' + Icon("fullscreen") + "</button>" + '    <button class="focusable player-btn" id="player-fav">' + Icon("heart-outline") + "</button>" + "  </div>" + '  <div id="player-osd" style="position:absolute;left:0;right:0;bottom:0;padding:18px 24px;background:linear-gradient(transparent,rgba(0,0,0,0.85));display:flex;flex-direction:column;gap:10px;">' + '    <div style="display:flex;align-items:center;gap:16px;">' + '      <button class="focusable player-btn" id="player-rew">' + Icon("rewind") + "</button>" + '      <button class="focusable player-btn player-btn-big" id="player-play" data-sn-autofocus>' + Icon("pause") + "</button>" + '      <button class="focusable player-btn" id="player-fwd">' + Icon("forward10") + "</button>" + '      <div id="player-live-badge" style="display:none;align-items:center;gap:6px;background:rgba(239,68,68,0.12);border-radius:20px;padding:5px 12px;">' + '        <span style="width:7px;height:7px;border-radius:50%;background:#EF4444;"></span>' + '        <span style="color:#FCA5A5;font-size:10px;font-weight:900;letter-spacing:1px;">AO VIVO</span>' + "      </div>" + '      <div id="player-time" style="color:#9A9AA5;font-size:12px;font-weight:600;flex:1;text-align:right;"></div>' + "    </div>" + '    <div id="player-progress-track" style="height:4px;border-radius:2px;background:rgba(255,255,255,0.2);">' + '      <div id="player-progress-fill" style="height:4px;border-radius:2px;background:var(--accent);width:0%;"></div>' + "    </div>" + "  </div>" +
    // Próximo episódio (só série, últimos 20s) -- ver updateNextCard.
    '  <div id="player-next">' + '    <div style="color:#fff;font-size:15px;font-weight:800;">Próximo episódio</div>' + '    <div id="player-next-name" style="color:#9A9AA5;font-size:13px;font-weight:600;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>' + '    <div id="player-next-count" style="color:var(--accent);font-size:13px;font-weight:800;margin-top:6px;"></div>' + "  </div>" + "</div>";
    if (!document.querySelector("#player-style")) {
      var style = document.createElement("style");
      style.id = "player-style";
      style.textContent = ".player-btn{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;color:#fff;font-size:18px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}" + ".player-btn-big{width:56px;height:56px;font-size:22px;}" +
      // Tingido 45% (não sólido) + ícone SEMPRE BRANCO no foco -- igual
      // ChromeButton do Android (withAlpha(accent,0.45f) + tint=White
      // quando focado, por cima de QUALQUER tint que o botão já tinha
      // parado -- zoom+ tingido ou coração vermelho). Antes ficava fundo
      // SÓLIDO + ícone preto, diferente do Android nos dois.
      ".player-btn.sn-focused{background:color-mix(in srgb,var(--accent) 45%,transparent) !important;color:#fff !important;}" + "@supports not (background: color-mix(in srgb, red, blue)) { .player-btn.sn-focused{background:rgba(225,29,72,0.45) !important;} }" +
      // Zoom+ fica tingido na cor do tema mesmo sem foco (indica o
      // estado "mais forte" do ciclo), igual o Fullscreen com tint do
      // Android quando isZoomPlus -- sem isso não dava pra saber em qual
      // dos 3 níveis o zoom estava só olhando o botão.
      "#player-zoom.zoom-plus{color:var(--accent);}" + "#player-fav.is-fav{color:#EF4444;}" +
      // Sempre com a borda do tema: o OK aciona o cartão direto (ver o
      // interceptador de teclas), então ele fica com cara de botão focado.
      "#player-next{display:none;position:absolute;right:24px;bottom:" + NEXT_CARD_BOTTOM_PX + "px;max-width:380px;min-width:240px;box-sizing:border-box;padding:14px 18px;background:rgba(0,0,0,0.8);border:3px solid var(--accent);border-radius:12px;cursor:pointer;}" + "#player-next.osd-up{bottom:" + NEXT_CARD_BOTTOM_OSD_PX + "px;}";
      document.head.appendChild(style);
    }
    video = root.querySelector("#player-video");
    // Na LG é o próprio <video>; na Samsung, o AVPlay com a mesma interface
    // (toca MKV/TS que o <video> não toca) -- ver js/lib/platform.js.
    if (global.Platform) video = Platform.fullscreenVideo(video);
    root.querySelector("#player-title").textContent = request.title || "";
    zapList = request.kind === "live" && request.channels && request.channels.length > 1 ? request.channels : null;
    zapTarget = -1;
    zapBadge = ChannelNumber.createBadge(root.firstElementChild, 84, false);
    allLive = null;
    liveByNumber = {
      map: {},
      max: 0
    };
    channelEntry = request.kind === "live" ? ChannelNumber.createEntry({
      maxNumber: function maxNumber() {
        return liveByNumber.max;
      },
      channelFor: function channelFor(n) {
        return liveByNumber.map[n] || null;
      },
      badge: zapBadge,
      onCommit: function onCommit(n) {
        var ch = liveByNumber.map[n];
        if (!ch || String(ch.streamId) === String(request.id)) return;
        var idx = -1;
        if (zapList) {
          for (var i = 0; i < zapList.length; i++) {
            if (String(zapList[i].streamId) === String(ch.streamId)) {
              idx = i;
              break;
            }
          }
        }
        zapBadge.show(ChannelNumber.pad3(n), ch.name, false);
        if (idx >= 0) {
          zapTarget = idx;
          openZapTarget(idx);
        } else {
          // Fora da lista de onde abriu: Cima/Baixo seguem pela lista
          // inteira, na ordem dos números, e Voltar cai em "Todos".
          openLiveChannel(ch, allLive, true);
        }
      }
    }) : null;
    root.querySelector("#player-back").addEventListener("sn:enter", goBack);
    root.querySelector("#player-rew").addEventListener("sn:enter", function () {
      seekBy(-10);
    });
    root.querySelector("#player-fwd").addEventListener("sn:enter", function () {
      seekBy(10);
    });
    root.querySelector("#player-play").addEventListener("sn:enter", togglePlay);
    root.querySelector("#player-zoom").addEventListener("sn:enter", cycleZoom);
    root.querySelector("#player-fav").addEventListener("sn:enter", toggleFavorite);
    // Magic Remote (ponteiro) / toque: clique no cartão também vai pro próximo.
    root.querySelector("#player-next").addEventListener("click", function () {
      if (nextCardSec !== -1) playNextEpisode();
    });

    // Sessão desta reprodução: todo evento/timer confere `s.alive` antes de
    // agir. Antes o desmonte fazia `video.src = ""`, que dispara um "error"
    // atrasado; ele chegava com o player já desmontado, deixava a trava
    // `recovering` ligada e a PRÓXIMA reprodução ficava em "Carregando…"
    // pra sempre.
    var s = sess = newSession();
    if (request.kind === "live") {
      // Lista inteira (já em memória depois do Ao vivo) pros números.
      var listCreds = SessionStore.loadCreds();
      if (listCreds) {
        XtreamApi.getLiveStreams(listCreds).then(function (list) {
          if (!s.alive) return;
          allLive = AdultGate.filterList(list || []);
          liveByNumber = ChannelNumber.indexByNumber(allLive);
        }).catch(function () {});
      }
    }
    video.addEventListener("playing", function () {
      if (s.alive) onPlaying(s);
    });
    video.addEventListener("waiting", function () {
      if (!s.alive) return;
      s.buffering = true;
      showSpinner(s.everPlayed ? "Reconectando…" : "Carregando…");
      updateNextCard(s);
    });
    video.addEventListener("timeupdate", function () {
      if (!s.alive) return;
      s.lastProgressAt = Date.now();
      if (request.kind !== "live" && video.currentTime > 0) {
        s.lastGoodTime = video.currentTime;
        if (video.duration > 0 && isFinite(video.duration)) s.lastDuration = video.duration;
      }
      if (request.kind === "series") updateNextCard(s);
    });
    video.addEventListener("error", function () {
      if (s.alive) onFailure(s);
    });
    video.addEventListener("ended", function () {
      if (s.alive) onEnded(s);
    });
    applyZoom();
    initFavorite();
    if (request.kind === "live") {
      root.querySelector("#player-live-badge").style.display = "flex";
      // Ao vivo não tem pra onde avançar/voltar: o salto pedia um trecho
      // que o servidor não tem mais e derrubava a conexão.
      root.querySelector("#player-rew").style.display = "none";
      root.querySelector("#player-fwd").style.display = "none";
      root.querySelector("#player-progress-track").style.display = "none";
    } else {
      // "Continuar assistindo" -- só filme/série. Salva progresso a cada 5s
      // enquanto toca (mesmos limiares 2%-95% do Roku, ver
      // ContinueWatching.onProgress); a retomada é feita em CADA tentativa
      // (startAttempt), não só na 1ª. Tempo/barra da UI só a cada 500ms,
      // igual o Android -- reescrever toda hora competia com o decode.
      progressTimer = setInterval(saveProgress, 5000);
      tickTimer = setInterval(updateTimeUi, 500);
    }

    // Variações de extensão (PlayerAlternates.kt) -- painéis às vezes
    // respondem em várias rotas mas só uma de fato toca. "Automático"
    // tenta a 1ª (ordem já é HLS-primeiro); força HLS/TS se configurado
    // em Ajustes > Reprodução (só se aplica a canal ao vivo).
    var raw = PlayerAlternates.buildPlayerAlternates(request.url);
    alternates = request.kind === "live" ? PlayerAlternates.applyLiveFormatPreference(raw, SessionStore.loadLiveFormat() || PlayerAlternates.LIVE_FORMAT_AUTO) : raw;
    if (!alternates.length) alternates = [request.url];
    altIndex = 0;

    // Travamento: buffering contínuo por mais de 30s depois de já ter
    // tocado conta como queda (servidor que aceita a conexão e para de
    // mandar dados) -- antes a roleta girava pra sempre.
    s.watchdog = setInterval(function () {
      if (!s.alive || !video || !s.playingNow || video.paused) return;
      if (Date.now() - s.lastProgressAt > STALL_LIMIT_MS) onFailure(s);
    }, 1000);
    initNextEpisode(s);
    startAttempt(s);
    document.addEventListener("keydown", onAnyKey);
    document.addEventListener("keyup", onAnyKeyUp);
    // Porta de PlayerScreen.kt/onKeyEvent -- ESQUERDA/DIREITA avançam/
    // voltam a reprodução DIRETO (sem precisar primeiro navegar até um
    // botão), exatamente como no Android ("As setas ESQUERDA/DIREITA
    // avançam/voltam 10s diretamente... sem depender de navegação de foco
    // entre botões"). Só quando o foco NÃO está na barra de cima (voltar/
    // zoom/favoritar) -- lá dentro a pessoa claramente quer NAVEGAR entre
    // os 3 botões, não buscar; interceptar ali deixaria voltar/favoritar
    // inalcançáveis pelo D-pad. Com o foco solto ou no play/pausa (o caso
    // comum: só assistindo e querendo adiantar), busca direto.
    SN.setKeyInterceptor(function (e) {
      if (handleMediaKey(e.keyCode)) return true;
      if (channelEntry) {
        var digit = ChannelNumber.digitOfKey(e.keyCode);
        if (digit !== null) {
          typeChannelDigit(digit);
          return true;
        }
        if (e.keyCode === 13 && channelEntry.active()) {
          channelEntry.commitNow();
          return true;
        }
      }
      if (zapList) {
        if (KEY_CH_UP.indexOf(e.keyCode) >= 0) {
          zap(1);
          return true;
        }
        if (KEY_CH_DOWN.indexOf(e.keyCode) >= 0) {
          zap(-1);
          return true;
        }
      }
      var cur = SN.current();
      var inTopbar = !!(cur && cur.closest && cur.closest("#player-topbar"));
      // Ao vivo: Cima/Baixo trocam de canal (fora da barra de cima, onde a
      // seta pra baixo volta pro ⏸).
      if (zapList && !inTopbar && (e.keyCode === 38 || e.keyCode === 40)) {
        zap(e.keyCode === 40 ? 1 : -1);
        return true;
      }
      if (e.keyCode === 13) {
        // O OK que pulou pro próximo episódio ainda está apertado: as
        // repetições dele (e o keyup) chegariam no player novo como "OK no
        // play/pausa" e pausavam o episódio que acabou de abrir.
        if (swallowEnterUntilKeyUp) return true;
        // Cartão do próximo na tela: OK vai pra ele na hora (fora da barra
        // de cima, onde a pessoa está navegando entre voltar/zoom/favoritar).
        if (nextCardSec !== -1 && !inTopbar) {
          swallowEnterUntilKeyUp = true;
          playNextEpisode();
          return true;
        }
        return false;
      }
      if (e.keyCode !== 37 && e.keyCode !== 39) return false;
      if (inTopbar) return false;
      // Ao vivo não tem avançar/voltar: esquerda/direita levam pra barra de
      // cima (zoom/favoritar), já que Cima/Baixo ficaram pra trocar de canal
      // -- igual o Android.
      if (request.kind === "live") {
        var zoomBtn = document.querySelector("#player-zoom");
        if (zoomBtn) SN.setFocus(zoomBtn);
        return true;
      }
      // Com o foco no ⏪/⏩ a seta MOVE o foco (volta pro ⏸). Antes buscava
      // com o foco em qualquer botão de baixo: quem chegava no ⏩ não
      // conseguia mais voltar pro pausar. Busca direto só com o foco no ⏸
      // ou solto, igual o Android (setas navegam com botão focado).
      if (cur && cur.id !== "player-play" && cur.closest && cur.closest("#player-osd")) return false;
      var dir = e.keyCode === 37 ? "left" : "right";
      if (!e.repeat) seekRepeatCount[dir] = 0;
      var step = seekStepForRepeat(seekRepeatCount[dir]);
      seekRepeatCount[dir]++;
      seekBy(dir === "left" ? -step : step);
      return true;
    });
    // bind (não push) -- Player é uma TELA de verdade no Router (não um
    // overlay temporário), então substitui o handler de quem chamou
    // (mesmo padrão de toda outra tela). Antes usava addEventListener
    // direto, deixando o handler da tela anterior (ex.: movieDetail)
    // ainda attached por baixo -- Voltar no Player disparava os DOIS,
    // navegando duas vezes (bug real encontrado na auditoria).
    // Voltar com número pela metade só desiste do número.
    BackNav.bind(function () {
      if (channelEntry && channelEntry.active()) {
        channelEntry.clear();
        return;
      }
      goBack();
    });
    showOsd();
    // Abre com o foco no ⏸: antes nenhum botão ficava marcado e o OK não
    // fazia nada até a pessoa apertar uma seta.
    focusPlayButton();
  }
  function focusPlayButton() {
    var play = document.querySelector("#player-play");
    if (play) SN.setFocus(play, {
      silent: true
    });
  }
  function currentZapIndex() {
    if (zapTarget >= 0) return zapTarget;
    for (var i = 0; i < zapList.length; i++) {
      if (String(zapList[i].streamId) === String(request.id)) return i;
    }
    return -1;
  }
  function zap(step) {
    if (!zapList) return;
    if (channelEntry) channelEntry.clear();
    var base = currentZapIndex();
    if (base < 0) return;
    var n = zapList.length;
    zapTarget = ((base + step) % n + n) % n;
    zapBadge.show(ChannelNumber.pad3(ChannelNumber.displayNumber(zapList[zapTarget], zapTarget)), zapList[zapTarget].name, false);
    if (zapTimer) clearTimeout(zapTimer);
    zapTimer = setTimeout(function () {
      zapTimer = null;
      openZapTarget(zapTarget);
    }, ZAP_COMMIT_MS);
  }
  function typeChannelDigit(digit) {
    if (zapTimer) {
      clearTimeout(zapTimer);
      zapTimer = null;
    }
    if (zapTarget >= 0) {
      zapTarget = -1;
      zapBadge.hide();
    }
    channelEntry.type(digit);
  }

  // Abre o canal pelo mesmo caminho do próximo episódio: Router.go desmonta
  // este player e monta um novo do zero. Voltar cai na lista com o canal
  // novo selecionado.
  function openZapTarget(idx) {
    openLiveChannel(zapList && zapList[idx], zapList, false);
  }

  // toAll: o canal veio de fora da lista de onde abriu (número digitado):
  // Voltar cai em "Todos", com ele selecionado.
  function openLiveChannel(ch, list, toAll) {
    var creds = SessionStore.loadCreds();
    if (!ch || !creds) return;
    var old = request.returnParams || {};
    var returnParams = {};
    Object.keys(old).forEach(function (k) {
      returnParams[k] = old[k];
    });
    if (old.restore) {
      var restore = {};
      Object.keys(old.restore).forEach(function (k) {
        restore[k] = old.restore[k];
      });
      restore.selectedId = ch.streamId;
      if (toAll) {
        restore.activeCategory = "all";
        restore.query = "";
      }
      returnParams.restore = restore;
    }
    Router.go("player", {
      kind: "live",
      id: ch.streamId,
      title: ch.name,
      poster: ch.streamIcon,
      url: XtreamApi.playableLiveUrl(creds, ch),
      returnTo: request.returnTo,
      returnParams: returnParams,
      channels: list
    });
  }

  // Porta de PlayerScreen.kt/zoomLevel -- 0=Ajustar(FIT, mostra a imagem
  // inteira, pode sobrar borda preta) / 1=Zoom (preenche a tela cortando o
  // excesso, padrão) / 2=Zoom+ (preenche E escala mais ainda, pra quem
  // quer cortar uma borda própria do stream). <video> não tem resizeMode
  // nativo tipo ExoPlayer -- object-fit:contain faz o papel do FIT,
  // object-fit:cover faz o papel do ZOOM, e Zoom+ é cover + um scale extra
  // por cima (mesmo truque do Android: RESIZE_MODE_ZOOM + Modifier.scale).
  function applyZoom() {
    if (!video) return;
    video.style.objectFit = zoomLevel === 0 ? "contain" : "cover";
    video.style.transform = zoomLevel === 2 ? "scale(1.15)" : "scale(1)";
    var btn = document.querySelector("#player-zoom");
    if (!btn) return;
    btn.innerHTML = Icon(zoomLevel > 0 ? "fullscreen-exit" : "fullscreen");
    btn.classList.toggle("zoom-plus", zoomLevel === 2);
  }
  function cycleZoom() {
    zoomLevel = (zoomLevel + 1) % 3;
    applyZoom();
    showOsd();
  }

  // Porta de PlayerScreen.kt/favKind+favRefId -- série favorita pela série-
  // mãe (nome/capa certos), não pelo episódio; filme/ao vivo pelo próprio
  // id. URL só faz sentido salvar pra filme/ao vivo (série reabre pela
  // grade normal, não tem "tocar direto" a partir do favorito).
  function favTarget() {
    if (request.kind === "series") return {
      kind: "series",
      id: request.seriesId,
      name: request.seriesName || request.title,
      cover: request.poster,
      url: null
    };
    return {
      kind: request.kind,
      id: request.id,
      name: request.title,
      cover: request.poster,
      url: request.url
    };
  }
  function initFavorite() {
    var t = favTarget();
    isFavorite = !!t.id && SessionStore.isFavorite(t.kind, t.id);
    updateFavoriteUi();
  }
  function updateFavoriteUi() {
    var btn = document.querySelector("#player-fav");
    if (!btn) return;
    btn.innerHTML = Icon(isFavorite ? "heart-filled" : "heart-outline");
    btn.classList.toggle("is-fav", isFavorite);
  }
  function toggleFavorite() {
    var t = favTarget();
    if (!t.id) return;
    isFavorite = SessionStore.toggleFavorite(t.kind, t);
    updateFavoriteUi();
    showOsd();
  }

  // Salto em duas etapas: enquanto a seta/⏩ está segurada (ou tocada
  // várias vezes seguidas) só a barra anda; o vídeo salta UMA vez, ao soltar
  // a tecla ou SEEK_COMMIT_DELAY_MS depois do último toque. Antes cada
  // repetição já mudava o currentTime: no Android o mesmo jeito deu 26
  // saltos em 2s, cada um reabrindo a conexão com o provedor e reiniciando
  // o decodificador, e um cliente teve o aparelho travado depois de avançar
  // 5-10 min (25/10).
  var SEEK_COMMIT_DELAY_MS = 600;
  var pendingSeek = null;
  var seekCommitTimer = null;
  function seekBy(deltaSeconds) {
    if (!video) return;
    // Ao vivo: esquerda/direita só mostram os controles (igual Android).
    if (request.kind === "live") {
      showOsd();
      return;
    }
    var target = (pendingSeek !== null ? pendingSeek : video.currentTime) + deltaSeconds;
    pendingSeek = video.duration > 0 ? Math.min(Math.max(0, target), video.duration) : Math.max(0, target);
    if (seekCommitTimer) clearTimeout(seekCommitTimer);
    seekCommitTimer = setTimeout(commitSeek, SEEK_COMMIT_DELAY_MS);
    updateTimeUi();
    showOsd();
  }
  function commitSeek() {
    if (seekCommitTimer) {
      clearTimeout(seekCommitTimer);
      seekCommitTimer = null;
    }
    if (pendingSeek === null || !video) return;
    var target = pendingSeek;
    pendingSeek = null;
    // Se o carregamento depois do salto cair, a reconexão continua daqui.
    if (sess) sess.lastGoodTime = target;
    video.currentTime = target;
  }
  function formatTime(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds || 0));
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor(totalSeconds % 3600 / 60);
    var s = totalSeconds % 60;
    var pad = function pad(n) {
      return String(n).padStart(2, "0");
    };
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  // Só roda pra filme/série (ver render(): tickTimer só é criado fora do
  // "live") -- Ao vivo mostra o selo "AO VIVO" fixo em vez de tempo/
  // progresso, não tem um "total" que faça sentido pro usuário.
  function updateTimeUi() {
    if (!video) return;
    var timeEl = document.querySelector("#player-time");
    var fillEl = document.querySelector("#player-progress-fill");
    // Com um salto na fila (ver seekBy), mostra o ponto pra onde vai.
    var pos = pendingSeek !== null ? pendingSeek : video.currentTime;
    if (timeEl) timeEl.textContent = formatTime(pos) + " / " + formatTime(video.duration);
    if (fillEl) fillEl.style.width = (video.duration > 0 ? Math.min(100, pos / video.duration * 100) : 0) + "%";
  }

  // Posição boa mais recente: durante uma reconexão o <video> está parado
  // e currentTime volta 0 -- salvar isso apagava a retomada do filme.
  function saveProgress() {
    if (!video || request.kind === "live") return;
    var s = sess;
    var playing = s && s.playingNow && video.duration > 0 && isFinite(video.duration);
    var position = playing ? video.currentTime : s ? s.lastGoodTime : 0;
    var duration = playing ? video.duration : s ? s.lastDuration : 0;
    if (!duration || !position) return;
    ContinueWatching.onProgress({
      id: request.id,
      kind: request.kind,
      name: request.title,
      icon: request.poster,
      seriesId: request.seriesId,
      seriesName: request.seriesName
    }, position, duration);
  }

  // ===== Tentativas e reconexão (mesma lógica do PlayerScreen.kt) =====
  var sess = null;
  // Espera entre reconexões depois de esgotar as variações -- mesmos
  // valores do Android (RECONNECT_BACKOFF_MS).
  var RECONNECT_BACKOFF_MS = [3000, 5000, 8000, 15000];
  var STALL_LIMIT_MS = 30000;
  function newSession() {
    return {
      alive: true,
      everPlayed: false,
      playingNow: false,
      buffering: false,
      failing: false,
      sameUrlRetries: 0,
      reconnectAttempt: 0,
      startedAt: Date.now(),
      playedAt: 0,
      // Última posição boa de filme/série: de onde CADA nova tentativa
      // retoma (antes só a 1ª retomava; uma queda no meio voltava pro 0).
      // Episódio já concluído começa do zero (pedido explícito): o ponto
      // salvo dele podia ser velho, perto do fim, e abria no fim e passava
      // direto pro próximo.
      lastGoodTime: request.kind !== "live" && request.resumePositionMs > 0 && !(request.kind === "series" && ContinueWatching.isCompleted(request.id, "series")) ? request.resumePositionMs / 1000 : 0,
      lastDuration: 0,
      lastProgressAt: Date.now(),
      attemptTimer: null,
      retryTimer: null,
      watchdog: null,
      stoppedHidden: false
    };
  }
  function showSpinner(text) {
    var spinner = document.querySelector("#player-spinner");
    if (!spinner) return;
    spinner.textContent = text || "Carregando…";
    spinner.style.display = "flex";
  }
  function hideSpinner() {
    var spinner = document.querySelector("#player-spinner");
    if (spinner) spinner.style.display = "none";
  }

  // Para o <video> sem disparar "error" (src = "" dispara).
  function stopVideo() {
    if (!video) return;
    try {
      video.pause();
      video.removeAttribute("src");
      video.load();
    } catch (e) {}
  }
  function startAttempt(s) {
    if (!s.alive || !video) return;
    clearTimeout(s.attemptTimer);
    clearTimeout(s.retryTimer);
    s.failing = false;
    s.playingNow = false;
    showSpinner(s.everPlayed ? "Reconectando…" : "Carregando…");
    updateNextCard(s);
    var seekTo = request.kind !== "live" ? s.lastGoodTime : 0;
    video.src = alternates[altIndex % alternates.length];
    if (seekTo > 0) {
      var _onMeta = function onMeta() {
        video.removeEventListener("loadedmetadata", _onMeta);
        if (s.alive) {
          try {
            video.currentTime = seekTo;
          } catch (e) {}
        }
      };
      video.addEventListener("loadedmetadata", _onMeta);
    }
    video.play().catch(function (e) {
      // AbortError = trocamos o src no meio (normal); falha de formato
      // costuma vir também pelo evento "error", que é quem trata.
      if (s.alive && e && e.name === "NotSupportedError") onFailure(s);
    });
    // Mais que o timeout de conexão da rede (mesmo motivo do Android):
    // abaixo disso a gente mesmo desistia de uma conexão só lenta.
    s.attemptTimer = setTimeout(function () {
      if (s.alive && !s.playingNow) onFailure(s);
    }, request.kind === "live" ? 22000 : 26000);
  }
  function onPlaying(s) {
    clearTimeout(s.attemptTimer);
    hideSpinner();
    s.everPlayed = true;
    s.playingNow = true;
    s.buffering = false;
    s.reconnectAttempt = 0;
    s.playedAt = Date.now();
    s.lastProgressAt = Date.now();
    updateNextCard(s);
    // 1ª vez que algo toca neste aparelho desde a instalação: "Já assistiu"
    // no painel na hora (ver js/data/appReport.js e App.heartbeatNow).
    if (global.AppReport && AppReport.markWatched() && global.App && App.heartbeatNow) App.heartbeatNow();
  }
  function onFailure(s) {
    if (!s.alive || s.failing) return;
    s.failing = true;
    s.playingNow = false;
    updateNextCard(s);
    clearTimeout(s.attemptTimer);
    var playedLong = s.playedAt && Date.now() - s.playedAt > 20000;
    if (playedLong) s.sameUrlRetries = 0;
    // Desde quando só falha (zera quando toca por um tempo) -- ver o limite
    // mais abaixo.
    if (playedLong) s.failingSince = 0;else if (!s.failingSince) s.failingSince = Date.now();
    // Caiu depois de tocar: tenta a MESMA url antes de mudar. Uma queda no
    // meio do vídeo quase sempre é da rede, não do formato -- pular pra
    // próxima variação trocava uma fonte que funcionava por outra que nem
    // existe.
    if (s.playedAt && s.sameUrlRetries < 1) {
      s.sameUrlRetries++;
      s.playedAt = 0;
      s.retryTimer = setTimeout(function () {
        startAttempt(s);
      }, 1000);
      return;
    }
    s.sameUrlRetries = 0;
    s.playedAt = 0;
    // Nunca chegou a tocar e passou do limite: para e avisa (sem deixar a
    // última tentativa rodando por trás da mensagem).
    // Filme/episódio que já tocou e parou de abrir (link que morreu no
    // provedor) também desiste: antes o limite valia só antes de tocar pela
    // 1ª vez e depois ficava em "Reconectando…" pra sempre. Ao vivo segue
    // tentando sem limite de propósito (o canal volta).
    var capMs = request.kind === "live" ? 70000 : 90000;
    if (!s.everPlayed && Date.now() - s.startedAt > capMs || request.kind !== "live" && s.failingSince && Date.now() - s.failingSince > capMs) {
      stopVideo();
      showPlaybackError();
      return;
    }
    altIndex++;
    if (altIndex % alternates.length !== 0) {
      startAttempt(s);
      return;
    }
    // Esgotou as variações. Ao vivo que NUNCA tocou: 1x o plano B da
    // exportação M3U (provedor que recusa a URL padrão). Se já tocou, a URL
    // vale e a queda é rede/provedor -- não baixa a exportação no meio do
    // canal (no Roku isso fechava o app, 20/10/2026). Depois, reconecta com
    // espera crescente.
    if (request.kind === "live" && !triedFallback && !s.everPlayed) {
      triedFallback = true;
      var creds = SessionStore.loadCreds();
      if (creds) {
        showSpinner("Carregando…");
        XtreamApi.resolveLiveUrlFromM3uExport(creds, request.id, request.title).then(function (altUrl) {
          if (!s.alive) return;
          if (altUrl && alternates.indexOf(altUrl) === -1) {
            alternates.push(altUrl);
            altIndex = alternates.length - 1;
            startAttempt(s);
            return;
          }
          scheduleReconnect(s);
        }).catch(function () {
          if (s.alive) scheduleReconnect(s);
        });
        return;
      }
    }
    scheduleReconnect(s);
  }
  function scheduleReconnect(s) {
    var delay = RECONNECT_BACKOFF_MS[Math.min(s.reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
    s.reconnectAttempt++;
    showSpinner(s.everPlayed ? "Reconectando…" : "Carregando…");
    s.retryTimer = setTimeout(function () {
      startAttempt(s);
    }, delay);
  }

  // Fim do stream: só perto do fim do filme/episódio é o fim de verdade
  // (marca assistido e fecha -- ou, em série com próximo episódio, já
  // emenda nele). No ao vivo, ou acabando antes da hora, é o provedor
  // cortando -- reconecta (antes o ao vivo fechava o player).
  function onEnded(s) {
    var duration = video && video.duration > 0 && isFinite(video.duration) ? video.duration : s.lastDuration;
    var position = Math.max(video ? video.currentTime : 0, s.lastGoodTime);
    if (request.kind !== "live") {
      if (isRealVodEnd(position, duration, s.lastEarlyEnd)) {
        if (nextEpisode) {
          playNextEpisode();
          return;
        }
        ContinueWatching.remove(request.id, request.kind);
        // Marca como concluído aqui também (não só via onProgress ao atingir
        // 95%) -- o "ended" pode chegar antes do próximo tick de 5s.
        ContinueWatching.markCompleted({
          id: request.id,
          kind: request.kind,
          seriesId: request.seriesId
        });
        goBack(true);
        return;
      }
      s.lastEarlyEnd = position;
    }
    onFailure(s);
  }

  // Fim sem erro de filme/episódio: é o fim de verdade? Antes só valia com
  // duração conhecida e 95% assistido; fora disso virava queda e ficava em
  // "Reconectando…" pra sempre no fim do filme. Também é fim quando, com
  // pelo menos 1 min de vídeo: a duração é desconhecida, ou o arquivo acabou
  // duas vezes seguidas no mesmo ponto (o arquivo do provedor termina ali).
  // Tempos em segundos. Mesma regra nos 6 apps (isRealVodEnd no Android).
  function isRealVodEnd(position, duration, lastEarlyEnd) {
    var known = duration > 0 && isFinite(duration);
    if (known && position >= duration * 0.95) return true;
    if (!(position >= 60)) return false;
    if (!known) return true;
    return typeof lastEarlyEnd === "number" && Math.abs(position - lastEarlyEnd) <= 5;
  }

  // ===== Próximo episódio (só série) =====
  // Pedido explícito: ao terminar um episódio, ir sozinho pro próximo (antes
  // tinha que voltar e escolher), e faltando uns 20s mostrar um cartão pra
  // pular na hora, porque muita gente não espera os créditos acabarem. O
  // próximo é o que vem logo depois na lista que a tela da série mostra
  // (seriesDetail.js manda ela em request.episodes, já na ordem da tela):
  // mesma temporada e, acabando, o 1º da temporada seguinte. Último
  // episódio = sem próximo, fica como antes (marca assistido e volta).
  var NEXT_CARD_THRESHOLD_SEC = 20;
  var NEXT_CARD_BOTTOM_PX = 24;
  var NEXT_CARD_BOTTOM_OSD_PX = 140; // acima da barra de baixo (~124px)
  var nextEpisode = null;
  // Segundos mostrados no cartão agora; -1 = cartão escondido. Só mexe no
  // DOM quando o número muda (o timeupdate chega várias vezes por segundo).
  var nextCardSec = -1;
  // Ver o interceptador de teclas: segura o OK que pulou de episódio até
  // a tecla ser solta.
  var swallowEnterUntilKeyUp = false;
  function findNextEpisode(episodes, currentId) {
    if (!episodes) return null;
    for (var i = 0; i < episodes.length; i++) {
      if (String(episodes[i].episodeId) === String(currentId)) return episodes[i + 1] || null;
    }
    return null;
  }
  function initNextEpisode(s) {
    nextEpisode = null;
    if (request.kind !== "series") return;
    if (request.episodes && request.episodes.length) {
      nextEpisode = findNextEpisode(request.episodes, request.id);
      return;
    }
    // Episódio aberto sem a lista (outra entrada que não a tela da série):
    // busca pelo seriesId em segundo plano, com a mesma função da tela da
    // série. Falhou = sem próximo, o player segue igual.
    var creds = SessionStore.loadCreds();
    if (!creds || !request.seriesId) return;
    XtreamApi.loadSeriesDetail(creds, request.seriesId).then(function (detail) {
      if (!s.alive) return;
      var eps = (detail && detail.episodes || []).slice().sort(function (a, b) {
        return a.season - b.season || a.episodeNumber - b.episodeNumber;
      });
      request.episodes = eps;
      nextEpisode = findNextEpisode(eps, request.id);
      updateNextCard(s);
    }).catch(function () {});
  }

  // Mostra/atualiza/esconde o cartão. Só com o vídeo tocando de fato (não
  // durante "Carregando…"/"Reconectando…") e duração conhecida; voltar pra
  // antes dos últimos 20s esconde de novo.
  function updateNextCard(s) {
    // Sessão velha (episódio anterior) nunca mexe no cartão do atual.
    if (!s.alive || s !== sess) return;
    var sec = -1;
    if (nextEpisode && s.playingNow && !s.buffering && video) {
      var duration = video.duration;
      if (duration > 0 && isFinite(duration)) {
        var remaining = duration - video.currentTime;
        if (remaining > 0 && remaining <= NEXT_CARD_THRESHOLD_SEC) sec = Math.ceil(remaining);
      }
    }
    if (sec === nextCardSec) return;
    var card = document.querySelector("#player-next");
    if (!card) return;
    if (sec === -1) {
      card.style.display = "none";
    } else {
      if (nextCardSec === -1) {
        var ep = nextEpisode;
        document.querySelector("#player-next-name").textContent = "T" + ep.season + " · E" + String(ep.episodeNumber).padStart(2, "0") + " · " + ep.name;
        card.style.display = "block";
      }
      document.querySelector("#player-next-count").textContent = "Começa em " + sec + "s";
    }
    nextCardSec = sec;
  }

  // Pelo cartão (OK/clique) ou no fim natural. O atual conta como concluído
  // nos dois casos; o próximo retoma de onde parou se já tinha progresso.
  // Router.go desmonta este player (unmount -> cleanup, sem salvar posição
  // por cima do "concluído") e monta o novo com o mesmo caminho de volta,
  // só que apontando pro episódio novo: Voltar cai na série, na temporada
  // dele, com o foco nele.
  function playNextEpisode() {
    var ep = nextEpisode;
    if (!ep || !request) return;
    ContinueWatching.remove(request.id, request.kind);
    ContinueWatching.markCompleted({
      id: request.id,
      kind: request.kind,
      seriesId: request.seriesId
    });
    var returnParams = {};
    var old = request.returnParams || {};
    Object.keys(old).forEach(function (k) {
      returnParams[k] = old[k];
    });
    returnParams.season = ep.season;
    returnParams.episodeId = ep.episodeId;
    Router.go("player", {
      kind: "series",
      id: ep.episodeId,
      title: ep.name,
      poster: ep.cover,
      url: ep.url,
      seriesId: request.seriesId,
      seriesName: request.seriesName,
      resumePositionMs: ContinueWatching.getPositionSec(ep.episodeId, "series") * 1000,
      returnTo: request.returnTo,
      returnParams: returnParams,
      episodes: request.episodes
    });
  }

  // TV mudou de app/entrou em espera: filme pausa e salva; ao vivo para de
  // baixar e reconecta na volta. Antes seguia tocando em segundo plano.
  function onVisibilityChange() {
    var s = sess;
    if (!s || !s.alive || !video) return;
    if (document.hidden) {
      if (request.kind === "live") {
        s.stoppedHidden = true;
        clearTimeout(s.attemptTimer);
        clearTimeout(s.retryTimer);
        s.playingNow = false;
        stopVideo();
      } else {
        saveProgress();
        video.pause();
        var playBtn = document.querySelector("#player-play");
        if (playBtn) playBtn.innerHTML = Icon("play");
      }
    } else if (s.stoppedHidden) {
      s.stoppedHidden = false;
      startAttempt(s);
    }
  }
  function teardown() {
    var s = sess;
    if (s) {
      s.alive = false;
      clearTimeout(s.attemptTimer);
      clearTimeout(s.retryTimer);
      clearInterval(s.watchdog);
    }
    sess = null;
    stopVideo();
  }
  function showPlaybackError() {
    // Aviso pro painel junto do próximo heartbeat (ver js/data/appReport.js).
    if (global.AppReport) AppReport.recordError("playback_failed");
    var spinner = document.querySelector("#player-spinner");
    if (!spinner) return;
    spinner.textContent = "Não foi possível reproduzir este conteúdo.";
    spinner.style.display = "flex";
  }
  function togglePlay() {
    if (!video) return;
    if (video.paused) {
      video.play();
      document.querySelector("#player-play").innerHTML = Icon("pause");
    } else {
      video.pause();
      document.querySelector("#player-play").innerHTML = Icon("play");
    }
    showOsd();
  }

  // Teclas de mídia do controle (registradas em platform.js). Sem isto a
  // TV entregava as teclas pro app e nada acontecia; o teste da loja
  // Samsung aperta Play/Pause/Stop/avançar/voltar no player.
  var MEDIA_KEY = {
    PLAY_PAUSE: 10252,
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    FAST_FORWARD: 417,
    REWIND: 412
  };
  var MEDIA_SEEK_SECONDS = 30;
  function handleMediaKey(keyCode) {
    switch (keyCode) {
      case MEDIA_KEY.PLAY_PAUSE:
        togglePlay();
        return true;
      case MEDIA_KEY.PLAY:
        if (video && video.paused) togglePlay();else showOsd();
        return true;
      case MEDIA_KEY.PAUSE:
        if (video && !video.paused) togglePlay();else showOsd();
        return true;
      case MEDIA_KEY.STOP:
        goBack();
        return true;
      case MEDIA_KEY.FAST_FORWARD:
        seekBy(MEDIA_SEEK_SECONDS);
        return true;
      case MEDIA_KEY.REWIND:
        seekBy(-MEDIA_SEEK_SECONDS);
        return true;
    }
    return false;
  }
  function onAnyKey() {
    showOsd();
  }
  // Zera o contador de aceleração da seta ao soltar -- sem isso, um toque
  // RÁPIDO logo depois de outro continuava contando como se a tecla
  // tivesse ficado segurada o tempo todo (e.repeat só é true enquanto o
  // SO considera "segurado", mas o contador em si só reseta explicitamente
  // aqui no keyup).
  function onAnyKeyUp(e) {
    if (e.keyCode === 37) seekRepeatCount.left = 0;
    if (e.keyCode === 39) seekRepeatCount.right = 0;
    // Soltou a seta/⏩/⏪: salta agora.
    if (e.keyCode === 37 || e.keyCode === 39 || e.keyCode === MEDIA_KEY.FAST_FORWARD || e.keyCode === MEDIA_KEY.REWIND) commitSeek();
    if (e.keyCode === 13) swallowEnterUntilKeyUp = false;
  }
  function showOsd() {
    var osd = document.querySelector("#player-osd");
    var topbar = document.querySelector("#player-topbar");
    if (!osd || !topbar) return;
    var nextCard = document.querySelector("#player-next");
    osd.style.display = "flex";
    topbar.style.display = "flex";
    // Cartão do próximo episódio sobe junto pra não ficar atrás da barra.
    if (nextCard) nextCard.classList.add("osd-up");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      osd.style.display = "none";
      topbar.style.display = "none";
      if (nextCard) nextCard.classList.remove("osd-up");
      // Controles sumiram: foco volta pro ⏸, igual o Android devolve o foco
      // pro vídeo. Antes ficava no botão escondido (ex.: ⏩) e o OK de
      // pausar avançava 10s.
      focusPlayButton();
    }, 5000);
  }

  // finished = fim natural (já marcado como assistido): não salva posição.
  function goBack(finished) {
    if (finished !== true) saveProgress();
    cleanup();
    Router.go(request.returnTo || "home", request.returnParams);
  }
  function cleanup() {
    // Fechou com um salto na fila: descarta.
    if (seekCommitTimer) {
      clearTimeout(seekCommitTimer);
      seekCommitTimer = null;
    }
    pendingSeek = null;
    // Saiu com uma troca de canal na fila: descarta.
    if (zapTimer) {
      clearTimeout(zapTimer);
      zapTimer = null;
    }
    if (channelEntry) {
      channelEntry.clear();
      channelEntry = null;
    }
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    teardown();
    document.removeEventListener("keydown", onAnyKey);
    document.removeEventListener("keyup", onAnyKeyUp);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    SN.clearKeyInterceptor();
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }
  function mount(params) {
    request = params;
    triedFallback = false;
    zoomLevel = 1;
    nextEpisode = null;
    nextCardSec = -1;
    render();
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  function unmount() {
    cleanup();
    video = null;
  }

  // Aviso de bloqueio do painel por cima (App.onSessionBlocked): para o
  // vídeo e as tentativas de reconexão na hora, e devolve as teclas pro
  // aviso. Sem isso o vídeo seguia (ou voltava) tocando atrás dele.
  // Seguro chamar com o player fechado.
  global.PlayerScreen = {
    stop: function stop() {
      cleanup();
    }
  };
  Router.register("player", {
    mount: mount,
    unmount: unmount
  });
})(window);