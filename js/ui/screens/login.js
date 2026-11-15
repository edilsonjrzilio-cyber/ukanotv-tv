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
    root.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">' + '  <div id="login-checking" style="display:none;color:var(--accent);font-size:20px;font-weight:700;">Entrando…</div>' + '  <div id="login-form-wrap" style="width:640px;">' + '    <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;">' + '      <div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,var(--accent),var(--accent-soft));display:flex;align-items:center;justify-content:center;font-size:26px;color:#000;">' + Icon("play") + "</div>" + '      <div style="color:var(--accent);font-size:26px;font-weight:900;letter-spacing:2px;margin-top:10px;">' + APP_TITLE + "</div>" + '      <div style="color:var(--muted);font-size:13px;font-weight:700;letter-spacing:3px;margin-top:4px;">MAIS QUE ENTRETENIMENTO</div>' + "    </div>" + '    <div style="display:flex;gap:14px;margin-bottom:18px;">' + '      <div class="login-info-card" style="flex:1;"><div class="login-info-label">' + Icon("monitor") + " MAC</div><div class=\"login-info-value\" id=\"login-mac\">…</div></div>" + '      <div class="login-info-card" style="flex:1;"><div class="login-info-label">' + Icon("device") + " Device</div><div class=\"login-info-value\" id=\"login-code\">…</div></div>" + "    </div>" + '    <div style="display:flex;flex-direction:column;gap:14px;">' + '      <button class="focusable login-field" id="field-code" data-sn-autofocus></button>' + '      <button class="focusable login-field" id="field-username"></button>' + '      <button class="focusable login-field" id="field-password"></button>' + '      <div id="login-error" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:10px 14px;color:#FCA5A5;font-size:15px;"></div>' + '      <button class="focusable" id="login-submit" style="height:58px;border-radius:12px;background:var(--accent);color:#fff;font-size:18px;font-weight:800;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;">' + Icon("play") + "<span>Entrar</span>" + Icon("forward") + "</button>" + "    </div>" + "  </div>" + "</div>";
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
      style.textContent = ".login-info-card{background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;}" + ".login-info-label{color:var(--subtext);font-size:13px;font-weight:700;}" + ".login-info-value{color:#fff;font-size:16px;font-weight:800;margin-top:2px;}" + ".login-field{height:58px;border-radius:12px;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.1);color:#fff;font-size:17px;text-align:left;padding:0 18px;cursor:pointer;}" + ".login-field.sn-focused{border-color:var(--accent);}" + ".login-field .fl{color:var(--subtext);font-size:12px;display:block;}" + ".login-field .fv{font-weight:700;}";
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
  function showError(msg) {
    elements.error.textContent = msg;
    elements.error.style.display = msg ? "block" : "none";
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
  function tryMacLogin(mac) {
    return PanelApi.panelLoginByMac(null, mac).then(function (result) {
      return finishResellerLogin(null, result.customer && result.customer.username || "", "", result, mac);
    }).then(function () {
      return true;
    }).catch(function (e) {
      // Aparelho bloqueado/limite de telas no registro: mostra o motivo no
      // formulário (antes caía nele mudo, sem explicar nada).
      var code = e && e.code;
      if (code && code !== "mac_not_found" && code.indexOf("panel_") !== 0 && code.indexOf("http_") !== 0) {
        showError(PanelApi.friendlyLoginError(code));
      }
      return false;
    });
  }
  function submit() {
    if (elements.submit.disabled) return;
    showError(null);
    elements.submit.disabled = true;
    elements.submit.innerHTML = "Entrando…";
    var mac = DeviceIdentity.getDeviceMac();
    var p;
    if (!state.username.trim() || !state.password.trim()) {
      p = mac ? PanelApi.panelLoginByMac(state.code, mac).then(function (result) {
        return finishResellerLogin(state.code, result.customer && result.customer.username || "", "", result, mac);
      }) : Promise.reject(new PanelApi.PanelError("invalid_credentials", "Preencha usuário e senha."));
    } else {
      p = PanelApi.panelLogin(state.code, state.username, state.password).then(function (result) {
        return finishResellerLogin(state.code, state.username, state.password, result, null);
      });
    }
    p.then(function () {
      global.App.onLoggedIn();
    }).catch(function (e) {
      var code = e && e.code || e && e.message || "unknown_error";
      showError(PanelApi.friendlyLoginError(code));
    }).finally(function () {
      elements.submit.disabled = false;
      elements.submit.innerHTML = Icon("play") + "<span>Entrar</span>" + Icon("forward");
    });
  }
  function mount() {
    render();
    BackNav.bind(BackNav.exitApp);
    elements.mac.textContent = DeviceIdentity.getDeviceMac();
    elements.code.textContent = DeviceIdentity.getDeviceCode();
    var mac = DeviceIdentity.getDeviceMac();
    var skip = _skipAutoMacOnce;
    _skipAutoMacOnce = false;
    if (mac && !skip) {
      elements.checking.style.display = "block";
      elements.formWrap.style.display = "none";
      tryMacLogin(mac).then(function (ok) {
        if (ok) {
          global.App.onLoggedIn();
          return;
        }
        elements.checking.style.display = "none";
        elements.formWrap.style.display = "block";
        SN.focusFirst(document.querySelector('.screen[data-screen="login"]'));
      });
    } else {
      SN.focusFirst(document.querySelector('.screen[data-screen="login"]'));
    }
  }
  function unmount() {}
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