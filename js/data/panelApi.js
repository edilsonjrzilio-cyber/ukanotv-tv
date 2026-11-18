/*
 * Porta de tv-app/android/.../data/Panel.kt + PanelApi.kt. Mesmo backend
 * (PANEL_URL), mesmos endpoints, mesmos códigos de erro -- white-label,
 * painel fixo embutido, o cliente nunca vê essa URL.
 */
(function (global) {
  "use strict";

  var PANEL_URL = "https://ukanotv.com";
  // Caminho reserva até o painel (17/11): ukanolink.com só repassa
  // /api/public/* pro painel (Worker na Cloudflare, código em
  // infra/ukanolink-worker.js), com os mesmos caminhos. Caso real: uma rede
  // que não alcançava o endereço do ukanotv.com ("No route to host"), com
  // MAC e lista certos. Ver panelFetch.
  var PANEL_FALLBACK_URL = "https://ukanolink.com";
  // 3º caminho (18/11), fora da Cloudflare: o painel e o ukanolink.com estão
  // os dois na Cloudflare, então uma rede que barre a Cloudflare derruba os
  // dois juntos. Este repassa /api/public/* pro painel pela Vercel (projeto
  // ukanotv-ponte, infra/ponte-vercel/vercel.json), com os mesmos caminhos.
  var PANEL_FALLBACK2_URL = "https://ukanotv-ponte.vercel.app";
  // Ordem fixa das tentativas (o que funcionou por último vai na frente).
  var PANEL_BASES = [PANEL_URL, PANEL_FALLBACK_URL, PANEL_FALLBACK2_URL];
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

  // O detalhe leva o tipo do erro junto (ex.: "TypeError: Failed to fetch",
  // "AbortError: sem resposta em 8 s"): a tela de entrada mostra embaixo da
  // frase amigável, pra dar pra achar a causa por uma foto da tela. Mesma
  // regra do Android (failureDetail).
  function failureDetail(e) {
    if (!e) return "";
    return ((e.name || "Error") + (e.message ? ": " + e.message : "")).slice(0, 160);
  }
  function classifyFailure(e) {
    if (e && e.name === "AbortError") return new PanelError("panel_timeout", failureDetail(e));
    return new PanelError("panel_unreachable", failureDetail(e));
  }
  function isRetryable(e) {
    return e.code === "panel_timeout" || e.code === "panel_unreachable" || e.code === "panel_bad_response";
  }

  // ===== Caminho reserva (porta de data/PanelFailover.kt do Android) =====
  // Quando a CONEXÃO com um endereço falha (sem rota, DNS, recusada, tempo
  // esgotado), o mesmo pedido vai pelo próximo da lista. Resposta do painel vale e não
  // troca (403/404/503 incluídos) -- só 5xx vindo de um reserva tenta os outros
  // também (pode ser o repasse falhando). O que funcionou fica guardado, com
  // a data, e vai primeiro nas próximas chamadas: não paga a espera do
  // caminho ruim a cada vez.
  var PANEL_HOST_KEY = "panel_host_v1";
  // Cada tentativa que não é a última tem prazo de 20 s; sem resposta, vai pra próxima.
  // O login pelo painel leva 3,4-7 s (medido em 17/11) e mais numa TV com
  // rede lenta: com 8 s (antes) a TV desistia do direto à toa e passava a
  // usar o reserva (Cloudflare, com teto diário). Erro de rede imediato
  // (sem rota) troca na hora.
  var FIRST_TRY_TIMEOUT_MS = 20000;
  // Reserva guardado há mais de 24 h: tenta o direto primeiro de novo (a
  // rede pode ter voltado ao normal); se falhar, o reserva responde e é
  // gravado de novo.
  var PRIMARY_RECHECK_MS = 24 * 60 * 60 * 1000;
  function loadPreferredHost() {
    try {
      var saved = JSON.parse(localStorage.getItem(PANEL_HOST_KEY) || "null");
      if (saved && PANEL_BASES.indexOf(saved.base) >= 0) return saved;
    } catch (e) {}
    return {
      base: PANEL_URL,
      at: 0
    };
  }
  function reserveExpired(saved) {
    if (saved.base === PANEL_URL) return false;
    var age = Date.now() - (Number(saved.at) || 0);
    // age < 0: o relógio da TV voltou (acertou a hora depois de gravar).
    return age > PRIMARY_RECHECK_MS || age < 0;
  }
  function hostOrder() {
    var saved = loadPreferredHost();
    var first = reserveExpired(saved) ? PANEL_URL : saved.base;
    return [first].concat(PANEL_BASES.filter(function (b) {
      return b !== first;
    }));
  }

  // Grava quem respondeu se mudou o preferido, ou se era a reconferência
  // das 24 h e o reserva ganhou de novo (data nova).
  function rememberHost(base) {
    var saved = loadPreferredHost();
    if (saved.base === base && !reserveExpired(saved)) return;
    try {
      localStorage.setItem(PANEL_HOST_KEY, JSON.stringify({
        base: base,
        at: Date.now()
      }));
    } catch (e) {}
  }

  // fetch com prazo. O prazo vira AbortError (panel_timeout em
  // classifyFailure) com o tempo no detalhe; sem AbortController (TV
  // antiga) o pedido só fica sem resposta e a gente segue.
  function fetchWithTimeout(url, init, timeoutMs) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var opts = Object.assign({}, init);
    if (ctrl) opts.signal = ctrl.signal;
    var timer = null;
    var deadline = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        var err = new Error("sem resposta em " + Math.round(timeoutMs / 1000) + " s");
        err.name = "AbortError";
        // Rejeita antes de abortar: o erro que sai é este, com o tempo.
        reject(err);
        if (ctrl) {
          try {
            ctrl.abort();
          } catch (e) {}
        }
      }, timeoutMs);
    });
    return Promise.race([fetch(url, opts), deadline]).then(function (res) {
      clearTimeout(timer);
      return res;
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  // Pedido ao painel pelo caminho (/api/public/...), em cada endereço na
  // ordem de hostOrder. Resolve com a resposta de quem respondeu; se nenhum
  // respondeu, rejeita com a falha do 1º (o preferido: é ela que diz por
  // que o painel não responde nesta rede), igual o Android.
  function panelFetch(path, init, timeoutMs) {
    var order = hostOrder();
    var limit = timeoutMs || REQUEST_TIMEOUT_MS;
    var firstFailure = null;
    var reserveAnswer = null;
    function tryAt(i) {
      if (i >= order.length) return reserveAnswer ? Promise.resolve(reserveAnswer) : Promise.reject(firstFailure);
      var base = order[i];
      var last = i === order.length - 1;
      return fetchWithTimeout(base + path, init, last ? limit : Math.min(FIRST_TRY_TIMEOUT_MS, limit)).then(function (res) {
        if (res.status >= 500 && base !== PANEL_URL && !last) {
          // Os outros também não responderem: fica valendo esta resposta.
          if (!reserveAnswer) reserveAnswer = res;
          return tryAt(i + 1);
        }
        rememberHost(base);
        return res;
      }, function (e) {
        if (!firstFailure) firstFailure = e;
        return tryAt(i + 1);
      });
    }
    return tryAt(0);
  }

  // POST com corpo JSON, tentando application/json primeiro e recaindo pra
  // text/plain numa 2a tentativa se a 1a falhar de forma "tentável de
  // novo" -- mesmas TV boxes/proxies que rejeitam o content-type silencio-
  // samente no Android podem existir aqui também.
  function postJson(path, bodyObj, allowRetry) {
    if (allowRetry === undefined) allowRetry = true;
    var bodyJson = JSON.stringify(bodyObj);
    function attempt(contentType) {
      var headers = {
        Accept: "application/json, text/plain, */*",
        "Cache-Control": "no-cache"
      };
      if (contentType) headers["Content-Type"] = contentType;
      return panelFetch(path, {
        method: "POST",
        headers: headers,
        body: bodyJson
      }).then(function (res) {
        return res.text().then(function (text) {
          // Painel fora do ar (5xx) antes de olhar o corpo: a página de
          // erro de um proxy no meio (502/504 em HTML) virava "formato
          // inválido" em vez de "falha temporária".
          if (res.status >= 500) throw new PanelError("panel_server_error", "http_" + res.status);
          if (!text) throw new PanelError("panel_bad_response", "empty_body");
          var parsed;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            throw new PanelError("panel_bad_response", text.slice(0, 120));
          }
          if (!res.ok) {
            // O painel responde recusas com 4xx + {"error": "..."}: antes
            // virava só "http_401" e a pessoa via uma mensagem genérica em
            // vez do motivo (senha errada, revendedor vencido...).
            throw new PanelError(parsed && typeof parsed.error === "string" && parsed.error || "http_" + res.status);
          }
          return parsed;
        });
      }).catch(function (e) {
        if (e instanceof PanelError) throw e;
        throw classifyFailure(e);
      });
    }
    return attempt("application/json").catch(function (e) {
      if (allowRetry && isRetryable(e)) return attempt("text/plain;charset=UTF-8");
      throw e;
    });
  }
  function getJson(path) {
    return panelFetch(path, {
      method: "GET"
    }).then(function (res) {
      return res.text().then(function (text) {
        var parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (e) {}
        if (!res.ok) throw new PanelError("panel_server_error", "http_" + res.status);
        return parsed;
      });
    }).catch(function (e) {
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

  // Versão do app no registro do aparelho (tela Dispositivos), a mesma do
  // heartbeat. Antes ia sempre "1.0.0-lg".
  function appVersion() {
    var v = global.AppReport ? String(AppReport.version() || "").trim() : "";
    return v ? v.slice(0, 40) : null;
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
    var path = "/api/public/customer/login";
    var body = jsonBody({
      reseller_slug: resellerSlug.trim(),
      username: username.trim(),
      password: password.trim(),
      mac: thisDeviceMac()
    });
    return postJson(path, body).then(function (res) {
      if (!res.ok) throw new PanelError(res.error || res.message || "invalid_credentials");
      return res;
    });
  }
  function panelLoginByMac(resellerSlug, mac) {
    var path = "/api/public/customer/login";
    var body = jsonBody({
      reseller_slug: resellerSlug && resellerSlug.trim() ? resellerSlug.trim() : null,
      mac: mac.trim()
    });
    return postJson(path, body).then(function (res) {
      if (!res.ok) throw new PanelError(res.error || res.message || "mac_not_found");
      return res;
    });
  }

  // Usuário e senha só vão juntos; sem um dos dois vai o MAC do login.
  // Quem entrou pelo MAC não tem senha do painel guardada e o painel
  // recusava a troca de servidor dele. Mesma regra do Android.
  function switchServer(resellerSlug, username, password, serverId, mac) {
    var path = "/api/public/customer/server";
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
    return postJson(path, body).then(function (res) {
      if (!res.ok) throw new PanelError(res.error || "invalid_credentials");
      return res;
    });
  }

  // Usuário/senha do painel e MAC pra trocar de servidor (switchServer).
  // Quem entrou pelo MAC vai pelo MAC, com a senha vazia: antes ia a senha
  // da lista Xtream no lugar da do painel, e ele recusava.
  // Sessão do MAC de versão antiga (sem loginMac e sem senha do painel) vai
  // pelo MAC deste aparelho: antes ia a senha do SERVIDOR e o painel recusava
  // a troca de lista (caso real de 18/11, LG pelo Media Station X).
  function serverSwitchAuth(creds) {
    var panelPassword = String(creds.panelPassword || "").trim();
    var mac = creds.loginMac || (!panelPassword && global.DeviceIdentity ? String(DeviceIdentity.getDeviceMac() || "").trim() : "") || null;
    return {
      username: creds.panelUsername || creds.username || "",
      password: mac ? panelPassword : panelPassword || creds.password || "",
      mac: mac
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
  function postDeviceAuth(path, body) {
    return postJson(path, body, false).catch(function (e) {
      if (e && isDeviceAuthRejection(e.code)) throw e;
      return null;
    });
  }
  function registerDevice(resellerSlug, username, password, deviceUid, deviceCode, platform) {
    var path = "/api/public/device/auth";
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
      app_version: appVersion()
    });
    return postDeviceAuth(path, body);
  }
  function registerDeviceByMac(resellerSlug, mac, deviceUid, deviceCode, platform) {
    var path = "/api/public/device/auth";
    var body = jsonBody({
      reseller_slug: resellerSlug.trim(),
      mac: mac.trim(),
      device_uid: deviceUid,
      device_code: deviceCode,
      device_name: deviceName(),
      model: tvModel(),
      platform: platform,
      app_version: appVersion()
    });
    return postDeviceAuth(path, body);
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
    var path = "/api/public/customer/remove-reseller";
    var body = jsonBody({
      mac: String(mac || "").trim(),
      device_uid: deviceUid,
      reseller_slug: String(resellerSlug || "").trim()
    });
    return postJson(path, body, false).then(function (res) {
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
    var path = "/api/public/device/heartbeat";
    // Avisos leves (17/11, ver js/data/appReport.js): versão do app, se o
    // aparelho já abriu algum conteúdo (vai sempre) e as falhas desde o
    // último heartbeat que o painel recebeu.
    var report = global.AppReport ? AppReport.heartbeatFields() : {};
    var sentErrors = report.errors && report.errors.length ? report.errors : null;
    var body = jsonBody({
      device_id: deviceId,
      customer_id: customerId,
      dns: dns || null,
      app_version: report.app_version || null,
      watched: typeof report.watched === "boolean" ? report.watched : null,
      errors: sentErrors
    });
    function delivered() {
      if (sentErrors && global.AppReport) AppReport.clearSent(sentErrors);
    }
    return panelFetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      // Recebido: as falhas mandadas saem da fila.
      if (res.ok) delivered();
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
        // 403 do painel (bloqueio, conta...) já gravou os avisos antes de
        // conferir o bloqueio: não manda de novo no próximo login.
        delivered();
        return code;
      });
    }).catch(function () {
      return null;
    });
  }
  function requestActivation(deviceUid, deviceMac, deviceCode, platform) {
    var path = "/api/public/device/activation";
    var body = jsonBody({
      device_uid: deviceUid,
      mac: deviceMac,
      device_code: deviceCode,
      device_name: "UKANOTV",
      platform: platform,
      app_version: appVersion()
    });
    return postJson(path, body);
  }
  function checkActivationStatus(deviceUid) {
    var path = "/api/public/device/activation?device_uid=" + encodeURIComponent(deviceUid);
    return getJson(path);
  }
  function fetchAssignedPlaylists(deviceUid) {
    var path = "/api/public/device/playlist?device_uid=" + encodeURIComponent(deviceUid);
    return getJson(path).then(function (res) {
      return res && res.playlists || [];
    }).catch(function () {
      return [];
    });
  }
  function reportDevicePlaylist(deviceUid, mode, url, username, password, m3uUrl, label) {
    var path = "/api/public/device/playlist";
    var body = jsonBody({
      device_uid: deviceUid,
      label: label || null,
      mode: mode,
      url: url || null,
      username: username || null,
      password: password || null,
      m3u_url: m3uUrl || null
    });
    return postJson(path, body, false).catch(function () {
      return null;
    });
  }
  var BLOCKING_ERRORS = ["reseller_unavailable", "reseller_expired", "account_expired"];
  function isBlockingError(msg) {
    return BLOCKING_ERRORS.indexOf(msg) !== -1 || (msg || "").indexOf("account_") === 0;
  }
  function friendlyLoginError(msg) {
    switch (msg) {
      // Só quando o painel disse que é isso (401 invalid_credentials).
      case "invalid_credentials":
        return "Código, usuário ou senha incorretos.";
      // Formulário sem usuário/senha num aparelho sem MAC: não chegou a ir
      // pro painel (antes aparecia "incorretos").
      case "missing_credentials":
        return "Preencha usuário e senha.";
      case "reseller_unavailable":
        return "Código inválido ou inativo.";
      case "reseller_expired":
        return "A licença deste revendedor expirou.";
      case "account_expired":
        return "Sua assinatura expirou.";
      case "device_blocked":
        return "Este dispositivo foi bloqueado pelo revendedor.";
      // Sem código digitado o painel procura o MAC em todos os revendedores:
      // "nesse código" não fazia sentido.
      case "mac_not_found":
        return "Este aparelho (MAC) não está cadastrado no revendedor. Confira com ele o MAC que aparece na tela.";
      case "force_logout":
        return "Sua sessão foi encerrada pelo revendedor. Entre novamente.";
      case "panel_timeout":
        return "O painel demorou demais para responder. Tente novamente em alguns segundos.";
      case "panel_unreachable":
        // navigator.onLine false = a TV mesmo está sem rede (Wi-Fi/cabo).
        if (navigator.onLine === false) return "A TV está sem internet. Confira o Wi-Fi ou o cabo de rede e tente de novo.";
        return "A TV tem internet, mas não conseguiu alcançar o painel do app. Tente novamente.";
      case "panel_bad_response":
        return "O painel respondeu em formato inválido para esta TV. Tente novamente ou atualize o app.";
      case "panel_server_error":
        return "O painel está fora do ar no momento (falha temporária). Tente novamente em alguns minutos.";
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

  // Detalhe técnico pra ir embaixo da frase amigável, só nas falhas de
  // conexão (sem rota, tempo esgotado, resposta que não é do painel); ""
  // nas outras.
  var CONNECTION_FAILURES = ["panel_unreachable", "panel_timeout", "panel_bad_response"];
  function connectionDetail(e) {
    if (!e || CONNECTION_FAILURES.indexOf(e.code) === -1) return "";
    var detail = String(e.message || "");
    return detail && detail !== e.code ? detail : "";
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
    panelFetch: panelFetch,
    connectionDetail: connectionDetail,
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