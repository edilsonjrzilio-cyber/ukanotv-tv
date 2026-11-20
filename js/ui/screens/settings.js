/* Porta de tv-app/android/.../ui/settings/SettingsScreen.kt. Modo quiosque
   fica de fora -- é uma API específica do Android (Device Owner), sem
   equivalente no webOS. Atualização do app também -- a loja da LG já
   cuida disso sozinha, mesma decisão já tomada pro Roku. */
(function (global) {
  "use strict";

  var FORMAT_LABELS = {
    auto: "Automático",
    hls: "HLS",
    ts: "TS"
  };

  // PIN errado não tinha NENHUM aviso antes (bug real da auditoria: a
  // pessoa digitava errado e nada acontecia, parecia travado). Toast
  // simples, some sozinho -- não precisa de um modal/overlay pra isso.
  function showPinError(msg) {
    var el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = "position:absolute;bottom:40px;left:50%;transform:translateX(-50%);background:#EF4444;color:#fff;" + "padding:12px 22px;border-radius:10px;font-size:18.5px;font-weight:700;z-index:70;";
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2200);
  }
  function render() {
    var root = document.querySelector('.screen[data-screen="settings"] .screen-content');
    var themeButtons = AppTheme.PRESETS.map(function (p) {
      var active = p.id === AppTheme.current();
      return '<button class="focusable theme-dot' + (active ? " active" : "") + '" data-theme-id="' + p.id + '" title="' + p.label + '">' + (active ? Icon("check") : "") + "</button>";
    }).join("");
    var creds = SessionStore.loadCreds();
    var currentFormat = SessionStore.loadLiveFormat() || PlayerAlternates.LIVE_FORMAT_AUTO;
    var formatButtons = ["auto", "hls", "ts"].map(function (f) {
      return '<button class="focusable fmt-btn' + (f === currentFormat ? " active" : "") + '" data-fmt="' + f + '">' + FORMAT_LABELS[f] + "</button>";
    }).join("");
    var servers = creds && creds.servers || [];
    root.innerHTML =
    // Header + conteúdo embrulhados juntos numa coluna flex (mesmo padrão
    // de live.js/contentGrid.js) -- sem isso, o conteúdo (flex:1 +
    // min-height:0 + overflow-y:auto) não tem como saber "o que sobra"
    // depois do cabeçalho pra rolar certo. Várias seções empilhadas
    // (Conta/Suas Listas/Reprodução/Tema/+18/Sair) chegam perto do limite
    // da tela sem rolagem nenhuma; sem isso, "Sair da conta" podia ficar
    // impossível de alcançar dependendo do tanto de servidor cadastrado
    // (bug em potencial encontrado no pente fino, mesmo padrão de
    // seriesDetail.js/movieDetail.js).
    '<div style="display:flex;flex-direction:column;height:100%;">' + '<div class="screen-header"><div class="title">Ajustes</div></div>' + '<div style="flex:1;min-height:0;overflow-y:auto;padding:32px 40px;display:flex;flex-direction:column;gap:28px;max-width:720px;" data-sn-scroll>' + '  <button class="focusable" id="settings-back" data-sn-autofocus style="align-self:flex-start;background:rgba(255,255,255,0.08);border:2px solid transparent;color:#fff;padding:10px 18px;border-radius:10px;font-size:18.5px;cursor:pointer;">' + Icon("back") + " Voltar</button>" + '  <div>' + '    <div class="settings-label">Conta</div>' + '    <div class="settings-info-row"><span>MAC</span><span>' + DeviceIdentity.getDeviceMac() + "</span></div>" + '    <div class="settings-info-row"><span>Device</span><span>' + DeviceIdentity.getDeviceCode() + "</span></div>" + '    <div class="settings-info-row"><span>Servidor</span><span>' + (creds && creds.url || "—") + "</span></div>" + '    <div class="settings-info-row"><span>Versão do app</span><span>' + AppUpdate.VERSION + "</span></div>" + '    <p id="settings-update" style="display:' + (AppUpdate.available() ? "block" : "none") + ';color:var(--accent);font-size:18.5px;font-weight:700;margin:10px 0 0;">' + AppUpdate.MESSAGE + "</p>" + "  </div>" + '  <button class="focusable settings-btn" id="settings-lists">' + Icon("list") + " Suas Listas" + (servers.length > 1 ? " (" + servers.length + " servidores)" : "") + "</button>" + '  <div>' + '    <div class="settings-label">Reprodução</div>' + '    <p style="color:#9A9AA5;font-size:16px;margin:0 0 10px;">Formato dos canais ao vivo. Automático tenta HLS e cai pra TS sozinho se falhar.</p>' + '    <div style="display:flex;gap:10px;">' + formatButtons + "</div>" + "  </div>" + '  <div>' + '    <div style="color:#fff;font-size:20px;font-weight:800;margin-bottom:10px;">Tema</div>' + '    <p style="color:#9A9AA5;font-size:16px;margin:0 0 10px;">A cor padrão vem do painel do revendedor — escolha outra aqui se preferir.</p>' + '    <div style="display:flex;gap:10px;flex-wrap:wrap;">' + themeButtons + "</div>" + "  </div>" +
    // Verde quando já desbloqueado (não a mesma cor roxa de sempre) --
    // igual accent=#3FD188 do Android quando adultUnlocked, pra marcar
    // visualmente "já ativo" nesse botão específico.
    '  <button class="focusable settings-btn' + (AdultGate.isUnlocked() ? " active-green" : "") + '" id="settings-adult">' + (AdultGate.isUnlocked() ? Icon("lock-open") + " Bloquear conteúdo adulto" : Icon("lock") + " Desbloquear conteúdo adulto") + "</button>" + '  <button class="focusable" id="settings-logout" style="text-align:left;background:rgba(239,68,68,0.1);border:2px solid rgba(239,68,68,0.3);color:#FCA5A5;padding:16px 18px;border-radius:12px;font-size:20px;font-weight:700;cursor:pointer;">' + Icon("logout") + " Sair da conta</button>" + "</div>" + "</div>";
    if (!document.querySelector("#settings-style")) {
      var style = document.createElement("style");
      style.id = "settings-style";
      style.textContent = ".theme-dot{width:40px;height:40px;border-radius:50%;border:3px solid transparent;cursor:pointer;color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;}" + ".theme-dot.active{border-color:#fff;}" + ".theme-dot.sn-focused{border-color:#fff;transform:scale(1.1);}" + '.theme-dot[data-theme-id="roxo"]{background:#8B5CF6;}' + '.theme-dot[data-theme-id="azul"]{background:#2563EB;}' + '.theme-dot[data-theme-id="vermelho"]{background:#E11D48;}' + '.theme-dot[data-theme-id="verde"]{background:#16A34A;}' + '.theme-dot[data-theme-id="laranja"]{background:#F97316;}' + '.theme-dot[data-theme-id="rosa"]{background:#DB2777;}' + '.theme-dot[data-theme-id="ciano"]{background:#0891B2;}' + '.theme-dot[data-theme-id="dourado"]{background:#CA8A04;}' + ".settings-label{color:#fff;font-size:20px;font-weight:800;margin-bottom:10px;}" + ".settings-info-row{display:flex;justify-content:space-between;color:#9A9AA5;font-size:17.5px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);}" + ".settings-info-row span:last-child{color:#E2E8F0;font-weight:700;}" + ".settings-btn{display:block;width:100%;text-align:left;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.1);color:#fff;padding:14px 18px;border-radius:12px;font-size:18.5px;font-weight:700;cursor:pointer;margin-top:8px;}" + ".settings-btn:first-child{margin-top:0;}" +
      // #6C5CE7 fixo (não var(--accent)) -- igual SettingsButton/
      // LiveFormatOption do Android: a tela de Ajustes usa uma cor
      // PRÓPRIA, sempre a mesma, independente do tema escolhido pelo
      // usuário (que é justamente escolhido AQUI). lists.js já seguia
      // essa regra corretamente; aqui ainda usava a cor dinâmica do
      // tema, uma inconsistência real dentro do próprio app.
      ".settings-btn.sn-focused{border-color:#6C5CE7;background:rgba(108,92,231,0.35);}" + ".settings-btn.active-green{border-color:rgba(63,209,136,0.5);}" + ".settings-btn.active-green.sn-focused{border-color:#3FD188;background:rgba(63,209,136,0.35);}" + ".fmt-btn{background:rgba(255,255,255,0.05);border:2px solid transparent;color:#fff;padding:10px 18px;border-radius:10px;font-size:17.5px;font-weight:700;cursor:pointer;}" + ".fmt-btn.active{background:#6C5CE7;color:#000;}" + ".fmt-btn.sn-focused{border-color:#6C5CE7;background:rgba(108,92,231,0.35);}" + ".fmt-btn.active.sn-focused{background:#6C5CE7;border-color:#fff;}";
      document.head.appendChild(style);
    }
    root.querySelector("#settings-back").addEventListener("sn:enter", function () {
      Router.go("home");
    });
    root.querySelector("#settings-lists").addEventListener("sn:enter", function () {
      Router.go("lists");
    });
    root.querySelector("#settings-adult").addEventListener("sn:enter", function () {
      if (AdultGate.isUnlocked()) {
        AdultGate.lock();
        render();
        var btn = document.querySelector("#settings-adult");
        if (btn) SN.setFocus(btn);
        return;
      }
      Keyboard.open({
        label: "PIN de conteúdo adulto"
      }).then(function (pin) {
        if (pin === null) return;
        if (!AdultGate.tryUnlock(pin)) {
          showPinError("PIN incorreto.");
          return;
        }
        render();
        var btn2 = document.querySelector("#settings-adult");
        if (btn2) SN.setFocus(btn2);
      });
    });
    root.querySelector("#settings-logout").addEventListener("sn:enter", function () {
      SessionStore.clearCreds();
      ContinueWatching.clearAll();
      LoginScreen.skipAutoMacOnce();
      Router.go("login");
    });
    // As duas eram bugs reais encontrados na auditoria: o botão de formato
    // chamava SN.focusFirst depois de render() -- isso pula pro PRIMEIRO
    // focável da tela (o botão Voltar!), não de volta pro botão de
    // formato que a pessoa acabou de escolher (um 2º OK sem querer saía
    // da tela). E o seletor de tema nem chamava render() -- a cor mudava
    // em tudo (CSS custom property global), mas o ✓ ficava preso no tema
    // antigo até a pessoa sair e voltar pra esta tela.
    root.querySelectorAll(".fmt-btn").forEach(function (btn) {
      btn.addEventListener("sn:enter", function () {
        var fmt = btn.getAttribute("data-fmt");
        SessionStore.saveLiveFormat(fmt);
        render();
        var same = document.querySelector('[data-fmt="' + fmt + '"]');
        if (same) SN.setFocus(same);
      });
    });
    root.querySelectorAll(".theme-dot").forEach(function (btn) {
      btn.addEventListener("sn:enter", function () {
        var id = btn.getAttribute("data-theme-id");
        AppTheme.set(id);
        render();
        var same = document.querySelector('[data-theme-id="' + id + '"]');
        if (same) SN.setFocus(same);
      });
    });
  }
  function mount() {
    render();
    AppUpdate.whenAvailable(function () {
      var el = document.querySelector("#settings-update");
      if (el) el.style.display = "block";
    });
    SN.focusFirst(document.querySelector('.screen[data-screen="settings"]'));
    BackNav.bind(function () {
      Router.go("home");
    });
  }
  Router.register("settings", {
    mount: mount,
    unmount: function unmount() {}
  });
})(window);