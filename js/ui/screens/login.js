/*
 * Porta de tv-app/android/.../ui/login/LoginScreen.kt + LoginViewModel.kt.
 * Coluna única centralizada: logo, MAC/Device, código+usuário+senha,
 * Entrar. Tenta login automático por MAC antes de mostrar o formulário
 * (pedido explícito: "só sai e entra de novo" pra MAC já cadastrado pelo
 * revendedor). M3U/Xtream direto moraram pra Ajustes > Suas Listas.
 */
(function (global) {
  "use strict";

  var APP_TITLE = "UKANOTV";
  var state = {
    code: "",
    username: "",
    password: ""
  };
  var elements = {};
  var _skipAutoMacOnce = false; // consumida uma vez após "Sair da conta" (ver settings.js)

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function render() {
    var root = document.querySelector('.screen[data-screen="login"] .screen-content');
    root.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">' + '  <div id="login-checking" style="display:none;color:var(--accent);font-size:26.5px;font-weight:700;">Entrando…</div>' + '  <div id="login-form-wrap" style="width:640px;">' + '    <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;">' + '      <div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,var(--accent),var(--accent-soft));display:flex;align-items:center;justify-content:center;font-size:31px;color:#000;">' + Icon("play") + "</div>" + '      <div style="color:var(--accent);font-size:31px;font-weight:900;letter-spacing:2px;margin-top:10px;">' + APP_TITLE + "</div>" + '      <div style="color:var(--muted);font-size:17.5px;font-weight:700;letter-spacing:3px;margin-top:4px;">MAIS QUE ENTRETENIMENTO</div>' + "    </div>" + '    <div style="display:flex;gap:14px;margin-bottom:18px;">' + '      <div class="login-info-card" style="flex:1;"><div class="login-info-label">' + Icon("monitor") + " MAC</div><div class=\"login-info-value\" id=\"login-mac\">…</div></div>" + '      <div class="login-info-card" style="flex:1;"><div class="login-info-label">' + Icon("device") + " Device</div><div class=\"login-info-value\" id=\"login-code\">…</div></div>" + "    </div>" + '    <div style="display:flex;flex-direction:column;gap:14px;">' + '      <button class="focusable login-field" id="field-code" data-sn-autofocus></button>' + '      <button class="focusable login-field" id="field-username"></button>' + '      <button class="focusable login-field" id="field-password"></button>' + '      <div id="login-error" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:10px 14px;color:#FCA5A5;font-size:20px;"></div>' + '      <button class="focusable" id="login-submit" style="height:58px;border-radius:12px;background:var(--accent);color:#fff;font-size:24px;font-weight:800;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;">' + Icon("play") + "<span>Entrar</span>" + Icon("forward") + "</button>" + "    </div>" + "  </div>" + "</div>";
    elements.checking = root.querySelector("#login-checking");
    elements.formWrap = root.querySelector("#login-form-wrap");
    elements.mac = root.querySelector("#login-mac");
    elements.code = root.querySelector("#login-code");
    elements.fieldCode = root.querySelector("#field-code");
    elements.fieldUsername = root.querySelector("#field-username");
    elements.fieldPassword = root.querySelector("#field-password");
    elements.error = root.querySelector("#login-error");
    elements.submit = root.querySelector("#login-submit");
    if (!document.querySelector("#login-style")) {
      var style = document.createElement("style");
      style.id = "login-style";
      style.textContent = ".login-info-card{background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;}" + ".login-info-label{color:var(--subtext);font-size:17.5px;font-weight:700;}" + ".login-info-value{color:#fff;font-size:21.5px;font-weight:800;margin-top:2px;}" + ".login-field{height:58px;border-radius:12px;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.1);color:#fff;font-size:22.5px;text-align:left;padding:0 18px;cursor:pointer;}" + ".login-field.sn-focused{border-color:var(--accent);}" + ".login-field .fl{color:var(--subtext);font-size:16px;display:block;}" + ".login-field .fv{font-weight:700;}" +
      // Detalhe técnico da falha de conexão, embaixo da frase (ver showError).
      ".login-detail{margin-top:6px;font-size:16px;opacity:0.75;word-break:break-word;}";
      document.head.appendChild(style);
    }
    syncFields();
    bindEvents();
  }
  function syncFields() {
    elements.fieldCode.innerHTML = '<span class="fl">' + Icon("key") + " Código de revendedor</span><span class=\"fv\">" + (state.code || "Digite o código") + "</span>";
    elements.fieldUsername.innerHTML = '<span class="fl">' + Icon("user") + " Usuário</span><span class=\"fv\">" + (state.username || "Digite seu usuário") + "</span>";
    elements.fieldPassword.innerHTML = '<span class="fl">' + Icon("lock") + " Senha</span><span class=\"fv\">" + (state.password || "Digite sua senha") + "</span>";
  }
  function bindEvents() {
    elements.fieldCode.addEventListener("sn:enter", function () {
      Keyboard.open({
        label: "Código de revendedor",
        initialValue: state.code
      }).then(function (v) {
        if (v !== null) {
          state.code = v.trim();
          syncFields();
        }
      });
    });
    elements.fieldUsername.addEventListener("sn:enter", function () {
      Keyboard.open({
        label: "Usuário",
        initialValue: state.username
      }).then(function (v) {
        if (v !== null) {
          state.username = v.trim();
          syncFields();
        }
      });
    });
    elements.fieldPassword.addEventListener("sn:enter", function () {
      Keyboard.open({
        label: "Senha",
        initialValue: state.password
      }).then(function (v) {
        if (v !== null) {
          state.password = v.trim();
          syncFields();
        }
      });
    });
    elements.submit.addEventListener("sn:enter", submit);
  }

  // msg = frase amigável; detail = detalhe técnico (menor, embaixo, entre
  // parênteses); info = aviso neutro (cinza) em vez de erro (vermelho).
  function showError(msg, detail, info) {
    var box = elements.error;
    box.innerHTML = "";
    if (!msg) {
      box.style.display = "none";
      return;
    }
    box.style.background = info ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.1)";
    box.style.borderColor = info ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.25)";
    box.style.color = info ? "#CBD5E1" : "#FCA5A5";
    var main = document.createElement("div");
    main.textContent = msg;
    box.appendChild(main);
    if (detail) {
      var small = document.createElement("div");
      small.className = "login-detail";
      small.textContent = "(Detalhe: " + detail + ")";
      box.appendChild(small);
    }
    box.style.display = "block";
  }

  // Causa real da falha (frase por tipo, ver PanelApi.friendlyLoginError)
  // e, nas falhas de conexão com o painel, o detalhe técnico embaixo -- pra
  // dar pra achar a causa por uma foto da tela (mesma regra do Android).
  function showLoginError(e) {
    var code = e && e.code || e && e.message || "unknown_error";
    showError(PanelApi.friendlyLoginError(code), PanelApi.connectionDetail(e), false);
  }

  // Monta a sessão de um login no painel (código + usuário e senha, ou MAC)
  // e registra o aparelho nesse revendedor, sem salvar. A troca pra lista
  // deste aparelho em outro revendedor (Suas listas e a pergunta "qual lista
  // usar", ver App.switchToOtherReseller) usa esta mesma montagem: é o login
  // pelo MAC com o código daquele revendedor.
  function resellerSession(slug, username, password, result, loginMac) {
    var m3uUrl = result.m3u_url;
    if (!m3uUrl) return Promise.reject(new PanelApi.PanelError("no_playlist_configured"));
    // A grafia do painel primeiro: o digitado ("JZ") passava no login mas
    // não registrava o aparelho em versões antigas do painel.
    var resolvedSlug = result.reseller && result.reseller.slug && result.reseller.slug.trim() || slug && slug.trim().toLowerCase();
    if (!resolvedSlug) return Promise.reject(new PanelApi.PanelError("panel_bad_response"));
    var deviceUid = DeviceIdentity.getDeviceUid();
    var deviceCode = DeviceIdentity.getDeviceCode();
    var platform = window.Platform ? Platform.name : "webos sim";
    var authPromise = loginMac ? PanelApi.registerDeviceByMac(resolvedSlug, loginMac, deviceUid, deviceCode, platform) : PanelApi.registerDevice(resolvedSlug, username, password, deviceUid, deviceCode, platform);
    return authPromise.then(function (deviceAuth) {
      var creds = PanelApi.xtreamFromM3uUrl(m3uUrl, username, password) || PanelApi.m3uCredsFromPanelUrl(m3uUrl, username, password);
      creds.panelUrl = PanelApi.PANEL_URL;
      creds.resellerSlug = resolvedSlug;
      creds.panelUsername = (username || "").trim();
      creds.panelPassword = (password || "").trim();
      creds.brand = result.reseller ? {
        brandName: result.reseller.brand_name,
        primaryColor: result.reseller.primary_color,
        secondaryColor: result.reseller.secondary_color
      } : null;
      creds.servers = result.servers || null;
      creds.currentServerId = result.current_server_id || null;
      // Os outros DNS do servidor atual (playlists.server_url + extra_dns),
      // sem o que está em uso: o app testa esses sozinho quando o DNS atual
      // não responde NESTE aparelho (ver App.findWorkingDns).
      creds.alternateUrls = result.alternate_urls || null;
      creds.deviceId = deviceAuth && deviceAuth.device && deviceAuth.device.id;
      creds.customerId = result.customer && result.customer.id || deviceAuth && deviceAuth.customer && deviceAuth.customer.id;
      creds.loginMac = loginMac || null;
      creds.customerExpiresAt = result.customer && result.customer.expires_at;
      creds.isUnregistered = !!(result.customer && result.customer.is_unregistered);
      // Listas deste aparelho em outros revendedores (Suas listas e a
      // pergunta "qual lista usar", ver App.checkListChoice).
      creds.otherResellers = PanelApi.otherResellersFrom(result);
      return creds;
    });
  }
  function finishResellerLogin(slug, username, password, result, loginMac) {
    return resellerSession(slug, username, password, result, loginMac).then(function (creds) {
      SessionStore.saveCreds(creds);
      return creds;
    });
  }

  // ===== Login pelo MAC sozinho (17/11) =====
  // Ao abrir a tela e, enquanto ela está aberta, a cada 8 s e quando o app
  // volta a aparecer: quem acabou de ter o MAC cadastrado pelo revendedor
  // entra sem fazer nada. Não tenta com o teclado aberto, com algo digitado
  // no formulário (login à mão) nem com o Entrar em andamento; nem nesta
  // visita depois de "Sair da conta"/aviso de bloqueio (skipAutoMacOnce),
  // senão a pessoa voltava sozinha pra conta de que acabou de sair.
  var AUTO_MAC_MS = 8000;
  // Muda a cada mount/unmount: resposta de uma visita anterior é ignorada.
  var visit = 0;
  // Muda a cada Entrar: a resposta atrasada de uma tentativa automática
  // não passa por cima do login à mão.
  var manualSeq = 0;
  var auto = {
    enabled: false,
    timer: null,
    busy: false,
    lastFailKind: null
  };
  var NOT_REGISTERED_HINT = "Este aparelho ainda não está cadastrado. Quando o revendedor cadastrar o MAC acima, o app entra sozinho. Se preferir, entre com código, usuário e senha.";
  function keyboardOpen() {
    var kb = document.getElementById("kb-overlay");
    return !!kb && kb.style.display === "flex";
  }
  function typedSomething() {
    return !!(state.code || state.username || state.password);
  }

  // Uma tentativa pelo MAC, sem código (o painel acha o revendedor). Só
  // grava a sessão se ainda vale (mesma visita, sem Entrar no meio).
  // Resolve true se entrou; na falha mostra o motivo no formulário.
  function runMacLogin(mac) {
    var myVisit = visit;
    var mySeq = manualSeq;
    // O estado DESTA visita (o mount cria outro): uma resposta atrasada não
    // mexe no "ocupado" da visita seguinte.
    var mine = auto;
    mine.busy = true;
    return PanelApi.panelLoginByMac(null, mac).then(function (result) {
      return resellerSession(null, result.customer && result.customer.username || "", "", result, mac);
    }).then(function (creds) {
      mine.busy = false;
      if (myVisit !== visit || mySeq !== manualSeq) return false;
      SessionStore.saveCreds(creds);
      mine.enabled = false;
      global.App.onLoggedIn();
      return true;
    }, function (e) {
      mine.busy = false;
      if (myVisit !== visit || mySeq !== manualSeq) return false;
      showAutoFailure(e);
      return false;
    });
  }
  function showAutoFailure(e) {
    var code = e && e.code || "unknown_error";
    // A cada 8 s vem o mesmo motivo de novo: pro painel conta uma vez só
    // por motivo, por visita à tela.
    var kind = AppReport.loginFailureKind(code);
    if (kind !== auto.lastFailKind) {
      auto.lastFailKind = kind;
      AppReport.recordLoginFailure(code);
    }
    // MAC ainda não cadastrado é o normal de quem vai entrar digitando:
    // aviso neutro, não erro.
    if (code === "mac_not_found") {
      showError(NOT_REGISTERED_HINT, "", true);
      return;
    }
    showLoginError(e);
  }
  function scheduleAutoMac() {
    if (auto.timer) {
      clearTimeout(auto.timer);
      auto.timer = null;
    }
    if (auto.enabled) auto.timer = setTimeout(autoMacTick, AUTO_MAC_MS);
  }
  function autoMacTick() {
    auto.timer = null;
    if (!auto.enabled) return;
    var mac = DeviceIdentity.getDeviceMac();
    if (!mac) return;
    if (auto.busy || elements.submit.disabled || keyboardOpen() || typedSomething() || document.hidden) {
      scheduleAutoMac();
      return;
    }
    runMacLogin(mac).then(function (ok) {
      if (!ok) scheduleAutoMac();
    });
  }

  // Voltou pro app (estava em outro app/em espera): tenta já, o revendedor
  // pode ter cadastrado nesse meio tempo.
  function onVisibilityChange() {
    if (document.hidden || !auto.enabled || auto.busy) return;
    if (auto.timer) {
      clearTimeout(auto.timer);
      auto.timer = null;
    }
    autoMacTick();
  }
  function submit() {
    if (elements.submit.disabled) return;
    showError(null);
    manualSeq++;
    elements.submit.disabled = true;
    elements.submit.innerHTML = "Entrando…";
    var mac = DeviceIdentity.getDeviceMac();
    var p;
    if (!state.username.trim() || !state.password.trim()) {
      p = mac ? PanelApi.panelLoginByMac(state.code, mac).then(function (result) {
        return finishResellerLogin(state.code, result.customer && result.customer.username || "", "", result, mac);
      }) : Promise.reject(new PanelApi.PanelError("missing_credentials", "Preencha usuário e senha."));
    } else {
      p = PanelApi.panelLogin(state.code, state.username, state.password).then(function (result) {
        return finishResellerLogin(state.code, state.username, state.password, result, null);
      });
    }
    p.then(function () {
      auto.enabled = false;
      global.App.onLoggedIn();
    }).catch(function (e) {
      var code = e && e.code || e && e.message || "unknown_error";
      // Aviso pro painel no próximo heartbeat (ver js/data/appReport.js).
      AppReport.recordLoginFailure(code);
      showLoginError(e);
    }).finally(function () {
      elements.submit.disabled = false;
      elements.submit.innerHTML = Icon("play") + "<span>Entrar</span>" + Icon("forward");
    });
  }
  function mount() {
    visit++;
    auto = {
      enabled: false,
      timer: null,
      busy: false,
      lastFailKind: null
    };
    render();
    BackNav.bind(BackNav.exitApp);
    elements.mac.textContent = DeviceIdentity.getDeviceMac();
    elements.code.textContent = DeviceIdentity.getDeviceCode();
    var mac = DeviceIdentity.getDeviceMac();
    var skip = _skipAutoMacOnce;
    _skipAutoMacOnce = false;
    var screenEl = document.querySelector('.screen[data-screen="login"]');
    if (mac && !skip) {
      auto.enabled = true;
      document.addEventListener("visibilitychange", onVisibilityChange);
      elements.checking.style.display = "block";
      elements.formWrap.style.display = "none";
      var myVisit = visit;
      runMacLogin(mac).then(function (ok) {
        if (ok || myVisit !== visit) return;
        elements.checking.style.display = "none";
        elements.formWrap.style.display = "block";
        SN.focusFirst(screenEl);
        scheduleAutoMac();
      });
    } else {
      SN.focusFirst(screenEl);
    }
  }
  function unmount() {
    visit++;
    auto.enabled = false;
    if (auto.timer) {
      clearTimeout(auto.timer);
      auto.timer = null;
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }
  global.LoginScreen = {
    skipAutoMacOnce: function skipAutoMacOnce() {
      _skipAutoMacOnce = true;
    },
    resellerSession: resellerSession
  };
  Router.register("login", {
    mount: mount,
    unmount: unmount
  });
})(window);