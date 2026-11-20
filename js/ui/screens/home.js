/*
 * Porta de tv-app/android/.../ui/home/HomeScreen.kt. Launcher de 4
 * cartões (sem sidebar, sem carregar catálogo aqui -- só navega).
 */
(function (global) {
  "use strict";

  var clockTimer = null;
  function fmtTime(d) {
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  var WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  var MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function fmtDate(d) {
    // 1ª letra maiúscula -- igual Clock() do Android
    // (dateFmt.format(now).replaceFirstChar{it.uppercase()}); "seg, 7 de
    // out" minúsculo (antes) não batia com o "Seg, 7 de out" do Android.
    var s = WEEKDAYS[d.getDay()] + ", " + d.getDate() + " de " + MONTHS[d.getMonth()];
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function accountStatusLabel(expiresAt) {
    if (!expiresAt) return "Conta conectada";
    var d = new Date(expiresAt);
    if (isNaN(d.getTime())) return "Conta conectada";
    var dd = String(d.getDate()).padStart(2, "0"),
      mm = String(d.getMonth() + 1).padStart(2, "0"),
      yyyy = d.getFullYear();
    // "Venceu em" (não "Teste gratuito expirado": o teste grátis não existe mais).
    return (d.getTime() < Date.now() ? "Venceu em " : "Ativo até ") + dd + "/" + mm + "/" + yyyy;
  }

  // cTint -- mesma fórmula do HomeTile do Android (HomeScreen.kt):
  // Brush.linearGradient(cStart a 22% de opacidade -> #0D0F14 sólido).
  // Antes o fundo aqui era um cinza-escuro liso igual pros 4, sem esse
  // toque de cor sutil de cada card (bug visual real apontado comparando
  // com o print do Android: "o fundo do card é uma cor normal nos outros
  // e mais transparente" -- na verdade faltava o degradê, não sobrava
  // transparência).
  var TILES = [{
    icon: "live",
    title: "TV ao vivo",
    subtitle: "Canais em tempo real",
    cStart: "#E11D48",
    cEnd: "#F97316",
    cTint: "rgba(225,29,72,0.22)",
    go: "live"
  }, {
    icon: "movie",
    title: "Filmes",
    subtitle: "Grandes sucessos",
    cStart: "#2563EB",
    cEnd: "#38BDF8",
    cTint: "rgba(37,99,235,0.22)",
    go: "movies"
  }, {
    icon: "series",
    title: "Séries",
    subtitle: "Suas séries favoritas",
    cStart: "#7C3AED",
    cEnd: "#C026D3",
    cTint: "rgba(124,58,237,0.22)",
    go: "series"
  }, {
    icon: "settings",
    title: "Ajustes",
    subtitle: "Configurações do app",
    cStart: "#475569",
    cEnd: "#64748B",
    cTint: "rgba(71,85,105,0.22)",
    go: "settings"
  }];
  function render() {
    var root = document.querySelector('.screen[data-screen="home"] .screen-content');
    var creds = SessionStore.loadCreds();
    var brandName = creds && creds.brand && creds.brand.brandName || "UKANOTV";
    var tilesHtml = TILES.map(function (t, i) {
      return (
        // Borda de foco na cor PRÓPRIA do card (--tile-color, por CSS
        // variable) -- igual HomeTile do Android (color=colorStart, não a
        // cor do tema). Sem isso, os 4 cards focavam todos na MESMA cor
        // (a do tema), perdendo a distinção visual vermelho/azul/roxo/
        // cinza que o Android tem de propósito, um por seção.
        '<button class="focusable home-tile" data-go="' + t.go + '" style="--tile-color:' + t.cStart + ";background:linear-gradient(165deg," + t.cTint + ',#0D0F14);"' + (i === 0 ? " data-sn-autofocus" : "") + '>' + '  <div class="home-tile-icon" style="background:linear-gradient(135deg,' + t.cStart + "," + t.cEnd + ');">' + Icon(t.icon) + "</div>" + '  <div class="home-tile-title">' + t.title + "</div>" + '  <div class="home-tile-subtitle">' + t.subtitle + "</div>" + "</button>"
      );
    }).join("");
    root.innerHTML =
    // padding-bottom maior que os outros lados -- pedido explícito: o
    // rodapé (versão/chave/mac/recarregar) ficava colado demais na
    // borda de baixo, mais embaixo do que nos apps Android/Roku.
    '<div style="display:flex;flex-direction:column;height:100%;padding:44px 64px 64px;">' + '  <div style="display:flex;align-items:center;">' + '    <div style="flex:1;">' + '      <div style="color:var(--accent);font-size:46px;font-weight:900;letter-spacing:1px;">' + brandName.toUpperCase() + "</div>" + '      <div style="color:#8B93A1;font-size:20px;font-weight:700;letter-spacing:3px;">MAIS QUE ENTRETENIMENTO</div>' + "    </div>" + '    <div style="display:flex;align-items:center;gap:26px;">' + '      <button class="focusable home-icon-btn" id="home-fav-btn">' + Icon("heart-outline") + "</button>" + '      <div style="width:1px;height:42px;background:rgba(255,255,255,0.15);"></div>' + '      <button class="focusable home-icon-btn" id="home-settings-btn">' + Icon("settings") + "</button>" + '      <div style="text-align:right;">' + '        <div id="home-clock-time" style="color:#fff;font-size:34px;font-weight:700;"></div>' + '        <div id="home-clock-date" style="color:#8B93A1;font-size:22.5px;"></div>' + "      </div>" + "    </div>" + "  </div>" + '  <div style="flex:1;display:flex;align-items:center;justify-content:center;">' + '    <div style="display:flex;gap:30px;">' + tilesHtml + "</div>" + "  </div>" +
    // Aviso de versão nova (escondido até a checagem achar uma): só
    // informa -- quem atualiza é o UKANOTV Instalador, no celular.
    '  <div id="home-update" style="display:none;align-self:center;align-items:center;gap:12px;margin-bottom:22px;padding:14px 28px;border-radius:999px;border:2px solid var(--accent);background:rgba(13,15,20,0.88);color:#fff;font-size:24px;font-weight:700;">' + '    <span style="color:var(--accent);display:flex;">' + Icon("refresh") + "</span>" + AppUpdate.MESSAGE + "  </div>" + '  <div style="display:flex;align-items:flex-end;">' + '    <div style="flex:1;">' + '      <div style="color:#E2E8F0;font-size:24px;font-weight:700;">Versão: ' + AppUpdate.VERSION + "</div>" + '      <div id="home-account-status" style="color:#9AA2B1;font-size:21.5px;"></div>' + "    </div>" + '    <button class="focusable" id="home-reload-btn" style="display:flex;align-items:center;gap:10px;padding:18px 32px;border-radius:12px;background:transparent;border:2px solid rgba(255,255,255,0.2);color:#fff;font-size:24px;font-weight:700;cursor:pointer;">' + Icon("refresh") + " Recarregar</button>" + '    <div style="flex:1;text-align:right;">' + '      <div style="color:#E2E8F0;font-size:21.5px;font-weight:600;">Chave do dispositivo: ' + DeviceIdentity.getDeviceCode() + "</div>" + '      <div style="color:#9AA2B1;font-size:21.5px;">Endereço Mac: ' + DeviceIdentity.getDeviceMac() + "</div>" + "    </div>" + "  </div>" + "</div>";
    if (!document.querySelector("#home-style")) {
      var style = document.createElement("style");
      style.id = "home-style";
      style.textContent =
      // Fundo tingido na cor do tema ao focar -- igual TopBarIconButton
      // do Android (withAlpha(accent,0.25f)), com o mesmo padrão
      // color-mix()+@supports already usado em cg-cat/live-row/
      // sd-episode-row nesta sessão pra engines webOS mais antigas
      // (Chromium <111) sem color-mix() de verdade.
      ".home-icon-btn{width:64px;height:64px;border-radius:50%;background:transparent;border:none;color:#CBD5E1;font-size:36px;cursor:pointer;}" +
      // !important no border -- sem isso, a regra genérica
      // .focusable.sn-focused (theme.css, também !important) desenhava
      // um anel de 3px por cima; TopBarIconButton do Android não tem
      // NENHUMA borda no foco, só o tingimento de fundo.
      ".home-icon-btn.sn-focused{background:color-mix(in srgb,var(--accent) 25%,transparent);color:var(--accent);border:none !important;}" + "@supports not (background: color-mix(in srgb, red, blue)) { .home-icon-btn.sn-focused{background:rgba(225,29,72,0.25);} }" +
      // height fixo em vez de aspect-ratio -- igual aos outros casos no
      // app, aspect-ratio só existe em Chromium 88+ e some em TVs LG
      // mais antigas; sem altura nenhuma definida, os 4 cards colapsavam
      // pra quase zero de altura (bug real reportado depois de logar:
      // "fico tudo bugado" no Início). Tamanho aumentado depois (pedido
      // explícito: fontes/cards pequenos demais) -- a tela renderiza
      // numa resolução virtual fixa (1920x1080, ver theme.css) que o
      // próprio webOS escala pra TV real, então aumentar aqui não quebra
      // em TVs de tamanho físico diferente, a escala cuida disso sozinha.
      // Sem background aqui -- cada tile define o próprio degradê inline
      // (style=, ver tilesHtml acima), específico da sua cor.
      ".home-tile{width:320px;height:348px;border-radius:20px;border:1px solid rgba(255,255,255,0.12);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;}" + ".home-tile.sn-focused{border-width:3px;border-color:var(--tile-color) !important;}" + ".home-tile-icon{width:88px;height:88px;border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:42px;}" + ".home-tile-title{color:#fff;font-size:27.5px;font-weight:900;margin-top:20px;}" + ".home-tile-subtitle{color:#9AA2B1;font-size:18.5px;margin-top:5px;}" +
      // withAlpha(accent,0.18) igual ReloadButton do Android -- mesmo
      // motivo/mesmo padrão color-mix()+@supports do botão de favoritos/
      // ajustes acima (era cinza neutro, não a cor do tema).
      "#home-reload-btn.sn-focused{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent);}" + "@supports not (background: color-mix(in srgb, red, blue)) { #home-reload-btn.sn-focused{background:rgba(225,29,72,0.18);} }";
      document.head.appendChild(style);
    }
    document.querySelector('.screen[data-screen="home"] .screen-bg').classList.add("home-tint");
    root.querySelectorAll("[data-go]").forEach(function (btn) {
      btn.addEventListener("sn:enter", function () {
        Router.go(btn.getAttribute("data-go"));
      });
    });
    root.querySelector("#home-fav-btn").addEventListener("sn:enter", function () {
      Router.go("favorites");
    });
    root.querySelector("#home-settings-btn").addEventListener("sn:enter", function () {
      Router.go("settings");
    });
    root.querySelector("#home-reload-btn").addEventListener("sn:enter", function () {
      global.App.reloadSession();
    });
    root.querySelector("#home-account-status").textContent = accountStatusLabel(creds && creds.customerExpiresAt);
    updateClock();
    clockTimer = setInterval(updateClock, 10000);
  }
  function updateClock() {
    var root = document.querySelector('.screen[data-screen="home"] .screen-content');
    if (!root) return;
    var now = new Date();
    var t = root.querySelector("#home-clock-time");
    var d = root.querySelector("#home-clock-date");
    if (t) t.textContent = fmtTime(now);
    if (d) d.textContent = fmtDate(now);
  }
  function mount() {
    render();
    AppUpdate.whenAvailable(function () {
      var el = document.querySelector("#home-update");
      if (el) el.style.display = "flex";
    });
    SN.focusFirst(document.querySelector('.screen[data-screen="home"]'));
    BackNav.bind(BackNav.exitApp);
  }
  function unmount() {
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }
  Router.register("home", {
    mount: mount,
    unmount: unmount
  });
})(window);