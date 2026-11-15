/*
 * Porta de tv-app/android/.../data/Panel.kt + PanelApi.kt. Mesmo backend
 * (PANEL_URL), mesmos endpoints, mesmos códigos de erro -- white-label,
 * painel fixo embutido, o cliente nunca vê essa URL.
 */
(function (global) {
  "use strict";

  var PANEL_URL = "https://ukanotv.com";
  var REQUEST_TIMEOUT_MS = 35000;
  function normalizePanel(url) {
    var s = (url || "").trim();
    if (!s) return "";
    var withScheme = /^https?:\/\//i.test(s) ? s : "https://" + s;
    return withScheme.replace(/\/+$/, "");
  }
  function PanelError(code, detail) {
    this.name = "PanelError";
    this.code = code;
    this.message = detail || code;
  }
  PanelError.prototype = Object.create(Error.prototype);
  function classifyFailure(e) {
    if (e && e.name === "AbortError") return new PanelError("panel_timeout");
    return new PanelError("panel_unreachable", e && e.message);
  }
  function isRetryable(e) {
    return e.code === "panel_timeout" || e.code === "panel_unreachable" || e.code === "panel_bad_response";
  }

  // POST com corpo JSON, tentando application/json primeiro e recaindo pra
  // text/plain numa 2a tentativa se a 1a falhar de forma "tentável de
  // novo" -- mesmas TV boxes/proxies que rejeitam o content-type silencio-
  // samente no Android podem existir aqui também.
  function postJson(url, bodyObj, allowRetry) {
    if (allowRetry === undefined) allowRetry = true;
    var bodyJson = JSON.stringify(bodyObj);
    function attempt(contentType) {
      var ctrl = new AbortController();
      var timer = setTimeout(function () {
        ctrl.abort();
      }, REQUEST_TIMEOUT_MS);
      var headers = {
        Accept: "application/json, text/plain, */*",
        "Cache-Control": "no-cache"
      };
      if (contentType) headers["Content-Type"] = contentType;
      return fetch(url, {
        method: "POST",
        headers: headers,
        body: bodyJson,
        signal: ctrl.signal
      }).then(function (res) {
        clearTimeout(timer);
        return res.text().then(function (text) {
          if (!text) throw new PanelError("panel_bad_response", "empty_body");
          var parsed;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            throw new PanelError("panel_bad_response", text.slice(0, 120));
          }
          if (!res.ok) {
            if (res.status >= 500) throw new PanelError("panel_server_error");
            // O painel responde recusas com 4xx + {"error": "..."}: antes
            // virava só "http_401" e a pessoa via uma mensagem genérica em
            // vez do motivo (senha errada, revendedor vencido...).
            throw new PanelError(parsed && typeof parsed.error === "string" && parsed.error || "http_" + res.status);
          }
          return parsed;
        });
      }).catch(function (e) {
        clearTimeout(timer);
        if (e instanceof PanelError) throw e;
        throw classifyFailure(e);
      });
    }
    return attempt("application/json").catch(function (e) {
      if (allowRetry && isRetryable(e)) return attempt("text/plain;charset=UTF-8");
      throw e;
    });
  }
  function getJson(url) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, REQUEST_TIMEOUT_MS);
    return fetch(url, {
      method: "GET",
      signal: ctrl.signal
    }).then(function (res) {
      clearTimeout(timer);
      return res.text().then(function (text) {
        var parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (e) {}
        if (!res.ok) throw new PanelError("panel_server_error");
        return parsed;
      });
    }).catch(function (e) {
      clearTimeout(timer);
      if (e instanceof PanelError) throw e;
      throw classifyFailure(e);
    });
  }
  function jsonBody(pairs) {
    var obj = {};
    Object.keys(pairs).forEach(function (k) {
      if (pairs[k] !== null && pairs[k] !== undefined) obj[k] = pairs[k];
    });
    return obj;
  }

  // MAC deste aparelho (o da tela). Com usuário e senha o painel não procura
  // por ele, só grava no cliente que ainda não tem MAC (e se couber no plano
  // do revendedor), pro revendedor ver o MAC de quem entrou digitando. Antes
  // não ia e o MAC ficava vazio no painel.
  function thisDeviceMac() {
    try {
      var mac = global.DeviceIdentity ? String(global.DeviceIdentity.getDeviceMac() || "").trim() : "";
      return mac.length >= 4 ? mac : null;
    } catch (e) {
      return null;
    }
  }

  // Modelo da TV pro painel (tela Dispositivos). Antes ia sempre "UKANOTV" e
  // o revendedor não sabia qual aparelho tinha entrado.
  // getRealModel dá o modelo da etiqueta (ex.: UN50RU7100GXZD); getModel,
  // o código interno. Os dois vêm do privilégio productinfo (config.xml).
  function tvModel() {
    try {
      var info = global.webapis && global.webapis.productinfo;
      if (!info) return null;
      var model = info.getRealModel && info.getRealModel() || info.getModel && info.getModel() || "";
      model = String(model).trim();
      return model ? model.slice(0, 100) : null;
    } catch (e) {
      return null;
    }
  }
  function deviceName() {
    var model = tvModel();
    return model ? "Samsung " + model : "TV Samsung";
  }
  function panelLogin(resellerSlug, username, password) {
    var url = normalizePanel(PANEL_URL) + "/api/public/customer/login";
    var body = jsonBody({
      reseller_slug: resellerSlug.trim(),
      username: username.trim(),
      password: password.trim(),
      mac: thisDeviceMac()
    });
    return postJson(url, body).then(function (res) {
      if (!res.ok) throw new PanelError(res.error || res.message || "invalid_credentials");
      return res;
    });
  }
  function panelLoginByMac(resellerSlug, mac) {
    var url = normalizePanel(PANEL_URL) + "/api/public/customer/login";
    var body = jsonBody({
      reseller_slug: resellerSlug && resellerSlug.trim() ? resellerSlug.trim() : null,
      mac: mac.trim()
    });
    return postJson(url, body).then(function (res) {
      if (!res.ok) throw new PanelError(res.error || res.message || "mac_not_found");
      return res;
    });
  }

  // Usuário e senha só vão juntos; sem um dos dois vai o MAC do login.
  // Quem entrou pelo MAC não tem senha do painel guardada e o painel
  // recusava a troca de servidor dele. Mesma regra do Android.
  function switchServer(resellerSlug, username, password, serverId, mac) {
    var url = normalizePanel(PANEL_URL) + "/api/public/customer/server";
    var user = (username || "").trim();
    var pass = (password || "").trim();
    var byPassword = !!user && !!pass;
    var body = jsonBody({
      reseller_slug: resellerSlug.trim(),
      username: byPassword ? user : null,
      password: byPassword ? pass : null,
      mac: byPassword ? null : mac && String(mac).trim() || null,
      server_id: serverId
    });
    return postJson(url, body).then(function (res) {
      if (!res.ok) throw new PanelError(res.error || "invalid_credentials");
      return res;
    });
  }

  // Usuário/senha do painel e MAC pra trocar de servidor (switchServer).
  // Quem entrou pelo MAC vai pelo MAC, com a senha vazia: antes ia a senha
  // da lista Xtream no lugar da do painel, e ele recusava.
  function serverSwitchAuth(creds) {
    return {
      username: creds.panelUsername || creds.username || "",
      password: creds.loginMac ? creds.panelPassword || "" : creds.panelPassword || creds.password || "",
      mac: creds.loginMac || null
    };
  }

  // Sessão no servidor `serverId` com a resposta do switchServer. Troca só
  // a conexão (servidor, usuário, senha, link) e os DNS, e mantém o resto da
  // sessão: antes a troca montava uma sessão nova e perdia deviceId/
  // customerId (o heartbeat parava: bloqueio no painel deixava de chegar),
  // loginMac e validade. Usada na troca em Suas listas e na troca sozinha ao
  // abrir o app (App.findWorkingServer). Mesma regra do Android.
  function credsOnServer(creds, serverId, result) {
    var auth = serverSwitchAuth(creds);
    var fresh = xtreamFromM3uUrl(result.m3u_url, auth.username, auth.password) || m3uCredsFromPanelUrl(result.m3u_url, auth.username, auth.password);
    return Object.assign({}, creds, {
      url: fresh.url,
      username: fresh.username,
      password: fresh.password,
      m3uUrl: fresh.m3uUrl,
      mode: fresh.mode,
      currentServerId: serverId,
      // DNS do servidor novo (os do anterior não valem mais).
      alternateUrls: result.alternate_urls || null
    });
  }

  // Recusas do /device/auth que valem como login negado: aparelho
  // bloqueado, limite de telas/aparelhos, revendedor ou cliente sem acesso.
  // Antes qualquer erro virava null e o login seguia sem deviceId -- e sem
  // deviceId não há heartbeat, então um aparelho bloqueado entrava e
  // assistia normalmente. Falha de rede continua resolvendo null (o login
  // segue). Mesma regra do Android.
  var DEVICE_AUTH_REJECTIONS = ["device_blocked", "too_many_devices", "reseller_device_limit", "reseller_expired", "reseller_unavailable"];
  function isDeviceAuthRejection(code) {
    code = code || "";
    return DEVICE_AUTH_REJECTIONS.indexOf(code) !== -1 || code.indexOf("account_") === 0 && code !== "account_not_found";
  }
  function postDeviceAuth(url, body) {
    return postJson(url, body, false).catch(function (e) {
      if (e && isDeviceAuthRejection(e.code)) throw e;
      return null;
    });
  }
  function registerDevice(resellerSlug, username, password, deviceUid, deviceCode, platform) {
    var url = normalizePanel(PANEL_URL) + "/api/public/device/auth";
    var body = jsonBody({
      reseller_slug: resellerSlug.trim(),
      username: username.trim(),
      password: password.trim(),
      // Só pro painel mostrar em Dispositivos: com usuário e senha o
      // servidor não usa o MAC pra achar o cliente.
      mac: thisDeviceMac(),
      device_uid: deviceUid,
      device_code: deviceCode,
      device_name: deviceName(),
      model: tvModel(),
      platform: platform,
      app_version: "1.0.0-lg"
    });
    return postDeviceAuth(url, body);
  }
  function registerDeviceByMac(resellerSlug, mac, deviceUid, deviceCode, platform) {
    var url = normalizePanel(PANEL_URL) + "/api/public/device/auth";
    var body = jsonBody({
      reseller_slug: resellerSlug.trim(),
      mac: mac.trim(),
      device_uid: deviceUid,
      device_code: deviceCode,
      device_name: deviceName(),
      model: tvModel(),
      platform: platform,
      app_version: "1.0.0-lg"
    });
    return postDeviceAuth(url, body);
  }

  // Listas deste aparelho em OUTROS revendedores (o mesmo MAC cadastrado lá
  // também), do `other_resellers` do login: [{slug, brand_name,
  // registered_at, servers: [{id, label}]}]. Painel antigo não manda o
  // campo: aí fica `keep` (o que a sessão já tinha). Lista vazia = não tem.
  // Mesma regra do Android.
  function otherResellersFrom(result, keep) {
    var list = result && result.other_resellers;
    if (!Array.isArray(list)) return keep === undefined ? null : keep;
    return list.filter(function (o) {
      return !!o && typeof o.slug === "string" && !!o.slug.trim();
    });
  }

  // Nome do outro revendedor na tela (sem marca, o código dele).
  function otherResellerName(o) {
    var name = o && o.brand_name ? String(o.brand_name).trim() : "";
    return name || o && o.slug || "";
  }

  // Tira deste aparelho a lista de outro revendedor (Suas listas ->
  // Remover). O painel só aceita de um aparelho que já entrou com esse MAC
  // (`deviceUid`, o mesmo do /device/auth) e nunca a lista em uso. O cliente
  // continua no painel daquele revendedor, só sem o MAC. Mesma regra do
  // Android (removeResellerList).
  function removeResellerList(mac, deviceUid, resellerSlug) {
    var url = normalizePanel(PANEL_URL) + "/api/public/customer/remove-reseller";
    var body = jsonBody({
      mac: String(mac || "").trim(),
      device_uid: deviceUid,
      reseller_slug: String(resellerSlug || "").trim()
    });
    return postJson(url, body, false).then(function (res) {
      if (!res || !res.ok) throw new PanelError(res && res.error || "panel_bad_response");
      return res;
    });
  }

  // null = sessão liberada (ou falha de rede -- melhor esforço, um blip não
  // encerra sessão de ninguém); qualquer outra string é o código de erro
  // do painel (device_blocked, reseller_expired, account_expired...).
  // `dns` = DNS que este aparelho está usando: o painel grava como o DNS
  // padrão deste aparelho (devices.preferred_dns) e manda ele primeiro no
  // próximo login (ver App.findWorkingDns). Mesma regra do Android.
  function deviceHeartbeat(deviceId, customerId, dns) {
    var url = normalizePanel(PANEL_URL) + "/api/public/device/heartbeat";
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, REQUEST_TIMEOUT_MS);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(jsonBody({
        device_id: deviceId,
        customer_id: customerId,
        dns: dns || null
      })),
      signal: ctrl.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (res.status !== 403 && res.status !== 404) return null;
      return res.text().then(function (text) {
        // Só conta o que o NOSSO painel respondeu (JSON com "error"): antes
        // qualquer 403 sem corpo legível (proxy, operadora) virava
        // "device_blocked" e tirava a pessoa da conta.
        var code = null;
        try {
          code = (JSON.parse(text) || {}).error || null;
        } catch (e) {
          return null;
        }
        if (!code) return null;
        // 404 not_found = o aparelho (ou o cliente) foi apagado no painel:
        // antes era ignorado e a sessão seguia pra sempre.
        if (res.status === 404) return code === "not_found" ? "account_not_found" : null;
        return code;
      });
    }).catch(function () {
      clearTimeout(timer);
      return null;
    });
  }
  function requestActivation(deviceUid, deviceMac, deviceCode, platform) {
    var url = normalizePanel(PANEL_URL) + "/api/public/device/activation";
    var body = jsonBody({
      device_uid: deviceUid,
      mac: deviceMac,
      device_code: deviceCode,
      device_name: "UKANOTV",
      platform: platform,
      app_version: "1.0.0-lg"
    });
    return postJson(url, body);
  }
  function checkActivationStatus(deviceUid) {
    var url = normalizePanel(PANEL_URL) + "/api/public/device/activation?device_uid=" + encodeURIComponent(deviceUid);
    return getJson(url);
  }
  function fetchAssignedPlaylists(deviceUid) {
    var url = normalizePanel(PANEL_URL) + "/api/public/device/playlist?device_uid=" + encodeURIComponent(deviceUid);
    return getJson(url).then(function (res) {
      return res && res.playlists || [];
    }).catch(function () {
      return [];
    });
  }
  function reportDevicePlaylist(deviceUid, mode, url, username, password, m3uUrl, label) {
    var endpoint = normalizePanel(PANEL_URL) + "/api/public/device/playlist";
    var body = jsonBody({
      device_uid: deviceUid,
      label: label || null,
      mode: mode,
      url: url || null,
      username: username || null,
      password: password || null,
      m3u_url: m3uUrl || null
    });
    return postJson(endpoint, body, false).catch(function () {
      return null;
    });
  }
  var BLOCKING_ERRORS = ["reseller_unavailable", "reseller_expired", "account_expired"];
  function isBlockingError(msg) {
    return BLOCKING_ERRORS.indexOf(msg) !== -1 || (msg || "").indexOf("account_") === 0;
  }
  function friendlyLoginError(msg) {
    switch (msg) {
      case "invalid_credentials":
        return "Código, usuário ou senha incorretos.";
      case "reseller_unavailable":
        return "Código inválido ou inativo.";
      case "reseller_expired":
        return "A licença deste revendedor expirou.";
      case "account_expired":
        return "Sua assinatura expirou.";
      case "device_blocked":
        return "Este dispositivo foi bloqueado pelo revendedor.";
      case "mac_not_found":
        return "Este aparelho não está cadastrado nesse código de revendedor.";
      case "force_logout":
        return "Sua sessão foi encerrada pelo revendedor. Entre novamente.";
      case "panel_timeout":
        return "O painel demorou demais para responder. Tente novamente em alguns segundos.";
      case "panel_unreachable":
        return "A TV tem internet, mas não conseguiu alcançar o painel do app. Tente novamente.";
      case "panel_bad_response":
        return "O painel respondeu em formato inválido para esta TV. Tente novamente ou atualize o app.";
      case "panel_server_error":
        return "O painel respondeu com falha temporária. Tente novamente em alguns segundos.";
      case "no_playlist_configured":
        return "Nenhuma lista vinculada à sua conta.";
      case "account_not_found":
        return "Esta conta foi removida pelo revendedor.";
      // Antes aparecia o código cru em inglês ("Conta: suspended").
      case "account_suspended":
        return "Sua conta está suspensa. Fale com o seu revendedor.";
      case "account_pending":
        return "Sua conta ainda não foi liberada pelo revendedor.";
      case "too_many_devices":
        return "Limite de telas ao mesmo tempo atingido. Feche o app em outro aparelho e tente de novo.";
      case "reseller_device_limit":
        return "O revendedor atingiu o limite de aparelhos do plano. Fale com o seu revendedor.";
      // Remover a lista de outro revendedor (Suas listas).
      case "list_in_use":
        return "Essa é a lista em uso. Troque pra outra antes de remover.";
      case "no_mac":
        return "Não foi possível identificar este aparelho.";
      case "device_not_recognized":
        return "Não deu pra confirmar este aparelho no painel. Feche e abra o app e tente de novo.";
      default:
        if ((msg || "").indexOf("account_") === 0) return "Sua conta não está liberada. Fale com o seu revendedor.";
        return "Não foi possível entrar. Tente novamente.";
    }
  }

  // Extrai usuário/senha de uma m3u_url (http://host:port/get.php?username=...&password=...).
  function xtreamFromM3uUrl(m3uUrl, fallbackUsername, fallbackPassword) {
    try {
      var u = new URL(m3uUrl);
      var username = u.searchParams.get("username") || fallbackUsername || null;
      var password = u.searchParams.get("password") || fallbackPassword || null;
      if (!username || !password) return null;
      var path = u.pathname.replace(/\/+$/, "").toLowerCase();
      var looksXtream = path.endsWith("/get.php") || path.endsWith("/player_api.php");
      if (!looksXtream) return null;
      var baseUrl = u.protocol + "//" + u.host;
      return {
        url: baseUrl,
        username: username,
        password: password,
        m3uUrl: m3uUrl,
        mode: "xtream"
      };
    } catch (e) {
      return null;
    }
  }
  function m3uCredsFromPanelUrl(m3uUrl, fallbackUsername, fallbackPassword) {
    var creds = xtreamFromM3uUrl(m3uUrl, fallbackUsername, fallbackPassword);
    if (creds) return creds;
    return {
      url: m3uUrl,
      username: fallbackUsername,
      password: fallbackPassword,
      m3uUrl: m3uUrl,
      mode: "m3u"
    };
  }

  // "http://host:porta" de um DNS Xtream (sem /get.php, query nem barra no
  // fim), igual ao normalizeXtreamBase do painel e ao xtreamDnsBase do Android.
  function xtreamDnsBase(url) {
    var base = String(url || "").trim().replace(/\/(?:get|player_api)\.php.*$/i, "").split("?")[0].replace(/\/+$/, "");
    return !base || /^https?:\/\//i.test(base) ? base : "http://" + base;
  }

  // Pra comparar DNS: sem diferença de maiúsculas nem da porta padrão
  // (new URL tira o ":80" do link do painel, o painel às vezes manda com).
  function dnsKey(url) {
    return xtreamDnsBase(url).toLowerCase().replace(/^(http:\/\/[^/]+):80$/, "$1").replace(/^(https:\/\/[^/]+):443$/, "$1");
  }
  function sameDns(a, b) {
    return dnsKey(a) === dnsKey(b);
  }

  // Sem repetidos e sem `exclude` (o DNS em uso), na ordem recebida.
  function dnsListWithout(list, exclude) {
    var out = [];
    var seen = {};
    seen[dnsKey(exclude)] = true;
    list.forEach(function (u) {
      var key = dnsKey(u);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(u);
    });
    return out;
  }

  // Mesma conta Xtream em outro DNS do MESMO servidor (cadastrado no painel
  // como DNS adicional). O DNS que sai entra na lista de alternativos -- se
  // o novo cair depois, dá pra voltar pra ele. Mesma regra do Android (onDns).
  function credsOnDns(creds, dns) {
    var base = xtreamDnsBase(dns);
    var exportPath = creds.m3uUrl ? /\/get\.php.*$/i.exec(creds.m3uUrl) : null;
    return Object.assign({}, creds, {
      url: base,
      m3uUrl: exportPath ? base + exportPath[0] : creds.m3uUrl,
      alternateUrls: dnsListWithout((creds.alternateUrls || []).concat([creds.url]), base)
    });
  }

  // Lista de DNS alternativos certa pra ESTA sessão depois de consultar o
  // painel de novo. Ele manda os outros DNS sem o que escolheu (m3u_url); se
  // o app já está noutro DNS do mesmo servidor, o do painel entra na lista e
  // o atual sai -- o DNS em uso nunca muda aqui. Resposta de outra conta
  // (outro servidor) mantém a lista que já tinha. Mesma regra do Android
  // (dnsListFor).
  function dnsListFor(creds, panelM3uUrl, panelAlternates) {
    if (!panelAlternates) return creds.alternateUrls || null;
    var target = panelM3uUrl ? xtreamFromM3uUrl(panelM3uUrl, null, null) : null;
    if (target && (target.username !== creds.username || target.password !== creds.password)) return creds.alternateUrls || null;
    return dnsListWithout(panelAlternates.concat(target ? [target.url] : []), creds.url);
  }
  global.PanelApi = {
    PANEL_URL: PANEL_URL,
    PanelError: PanelError,
    normalizePanel: normalizePanel,
    panelLogin: panelLogin,
    panelLoginByMac: panelLoginByMac,
    switchServer: switchServer,
    serverSwitchAuth: serverSwitchAuth,
    credsOnServer: credsOnServer,
    registerDevice: registerDevice,
    registerDeviceByMac: registerDeviceByMac,
    otherResellersFrom: otherResellersFrom,
    otherResellerName: otherResellerName,
    removeResellerList: removeResellerList,
    deviceHeartbeat: deviceHeartbeat,
    requestActivation: requestActivation,
    checkActivationStatus: checkActivationStatus,
    fetchAssignedPlaylists: fetchAssignedPlaylists,
    reportDevicePlaylist: reportDevicePlaylist,
    isBlockingError: isBlockingError,
    friendlyLoginError: friendlyLoginError,
    xtreamFromM3uUrl: xtreamFromM3uUrl,
    m3uCredsFromPanelUrl: m3uCredsFromPanelUrl,
    xtreamDnsBase: xtreamDnsBase,
    sameDns: sameDns,
    credsOnDns: credsOnDns,
    dnsListFor: dnsListFor
  };
})(window);