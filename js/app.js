/*
 * Boot do app -- equivalente ao MainActivity/MainViewModel do Android
 * (versão inicial: decide Login vs Início a partir da sessão salva, dá
 * onLoggedIn/reloadSession/play pros screens chamarem). Heartbeat
 * periódico e ativação por dispositivo (trial/paid) entram numa próxima
 * passada, depois de validar o essencial no aparelho real.
 */
(function (global) {
  "use strict";

  // Porta de MainViewModel.HEARTBEAT_INTERVAL_MS -- confere a cada 20min
  // se o revendedor bloqueou o dispositivo/cliente, enquanto o app segue
  // aberto com uma sessão de revendedor ativa.
  var HEARTBEAT_INTERVAL_MS = 20 * 60 * 1000;
  var heartbeatTimer = null;
  var blockPending = false;

  // (A trava de ativação/teste por aparelho saiu: o painel não tem mais
  // esse sistema e cada login fazia 2 chamadas que sempre davam erro.)

  function showBootOverlay(msg) {
    var el = document.getElementById("boot-loading");
    if (!el) return;
    el.classList.remove("boot-done");
    var textEl = el.querySelector(".boot-text");
    if (textEl) textEl.textContent = msg;
  }
  var PREFETCH_LABEL = {
    live: "canais",
    vod: "filmes",
    series: "séries"
  };

  // Pedido explícito: "o conteúdo teria que já carregar antes de entrar no
  // início" -- Ao vivo/Filmes/Séries buscavam tudo na rede só quando a
  // pessoa abria aquela tela, travando por um instante. Pré-busca os 3
  // catálogos (XtreamApi.prefetchAll, com cache em memória) ENQUANTO a
  // tela de boot ainda está visível, e só sai dela quando os 3 terminam --
  // segunda rodada de teste no aparelho: deixar o prefetch continuar em
  // segundo plano (1ª tentativa, com timeout curto) deixava a Início
  // travada/com soluço, porque o trabalho pesado de verdade é fazer
  // JSON.parse() de milhares de itens, e isso rodava DEPOIS, enquanto a
  // pessoa já tava mexendo na tela. Melhor fazer esse trabalho todo aqui,
  // parado na tela de carregamento (onde soluçar não importa, não tem
  // D-pad pra responder ainda), com progresso REAL (contagem por tipo,
  // igual o VerifyingScreen.kt do Android) em vez de um spinner cego.
  // timeoutMs é só uma rede de segurança (provedor truly travado/offline),
  // não o caminho normal -- generoso de propósito.
  var PREFETCH_SAFETY_TIMEOUT_MS = 20000;
  function finishLogin(creds) {
    // Sessão nova (ou recarregada): um bloqueio de antes já foi tratado.
    blockPending = false;
    ensureWorkingServer(creds).then(function (current) {
      return prefetchCatalog(current).then(function (failed) {
        // Respondeu a conferência mas o catálogo não veio (bloqueio pela
        // metade, servidor instável): tenta os outros DNS também antes de
        // seguir com o catálogo faltando. Uma vez só.
        if (!failed || !hasAlternateDns(current) || navigator.onLine === false) return;
        return findWorkingDns(current).then(function (found) {
          if (found) return prefetchCatalog(adoptDns(found));
        });
      });
    }).catch(function () {}).then(function () {
      hideNoticeLater();
      // O aviso do painel ao trocar de DNS (adoptDns) pode ter encerrado a
      // sessão no meio: fica no aviso, sem abrir a Início por trás.
      if (blockPending) return;
      Router.go("home");
      startHeartbeatLoop();
      // Listas novas do painel (cadastradas depois do login) entram na sessão
      // sem precisar abrir Suas Listas, igual o Android e a Roku ao abrir.
      // Melhor esforço, em segundo plano, depois do catálogo.
      if (global.ListsScreen) setTimeout(function () {
        global.ListsScreen.refreshServers();
      }, 4000);
    });
  }

  // Resolve true se algum dos 3 catálogos falhou de verdade (não conta o
  // que só passou do prazo de segurança, que segue em segundo plano).
  function prefetchCatalog(creds) {
    showBootOverlay("Carregando catálogo…");
    var counts = {};
    var failed = false;
    var prefetch = XtreamApi.prefetchAll(creds, function (kind, list) {
      if (!list) failed = true;
      counts[kind] = list ? list.length : 0;
      // Já deixa cada item marcado como +18 ou não (fica guardado no item):
      // era o grosso da 1ª abertura de Filmes (~1,5 s na Samsung 2019) e
      // aqui a tela de carregamento ainda está na frente.
      if (list) AdultGate.filterList(list);
      var parts = ["live", "vod", "series"].filter(function (k) {
        return counts[k] != null;
      }).map(function (k) {
        return counts[k] + " " + PREFETCH_LABEL[k];
      });
      showBootOverlay(parts.join(" · ") + (parts.length < 3 ? "…" : ""));
    });
    var safety = new Promise(function (resolve) {
      setTimeout(resolve, PREFETCH_SAFETY_TIMEOUT_MS);
    });
    return Promise.race([prefetch, safety]).then(function () {
      return failed;
    });
  }
  function hasAlternateDns(creds) {
    return creds.mode === "xtream" && !!creds.alternateUrls && creds.alternateUrls.length > 0;
  }

  // Cliente do painel com mais de um servidor (Suas listas): dá pra trocar
  // sozinho pra outro. Só Xtream: a conferência é a mesma rápida dos DNS
  // (link M3U puro só dava pra conferir baixando a lista inteira).
  function hasOtherServers(creds) {
    return creds.mode === "xtream" && !!creds.resellerSlug && !!creds.servers && creds.servers.length > 1;
  }

  // Servidor com mais de um DNS, ou cliente com mais de um servidor:
  // confere o atual NESTE aparelho antes de baixar o catálogo e, sem
  // resposta, passa 1º pros outros DNS do mesmo servidor e depois pros
  // outros servidores do cliente. Pedido do usuário em 22/10 ("quando viu
  // que não deu sinal na 1ª DNS já tinha que testar a 2ª pra não dar falha
  // no catálogo"): um celular não carregava o catálogo com xc.sspkdns.com
  // bloqueado na internet dele, e o DNS adicional do mesmo servidor
  // funcionava. Mesma regra do Android (verifyAndFailover). Senha recusada
  // não troca de DNS (é igual em todos), mas tenta os outros servidores:
  // cada um tem a própria conta.
  function ensureWorkingServer(creds) {
    var otherServers = hasOtherServers(creds);
    if (!hasAlternateDns(creds) && !otherServers) return Promise.resolve(creds);
    showBootOverlay("Conectando ao servidor…");
    return XtreamApi.xtreamAuthCheck(creds, true).then(function (health) {
      if (health === "ok") return creds;
      var dns = health === "unknown" && hasAlternateDns(creds) ? findWorkingDns(creds) : Promise.resolve(null);
      return dns.then(function (found) {
        if (found) return adoptDns(found);
        if (!otherServers || navigator.onLine === false) return creds;
        showBootOverlay("Procurando outro servidor…");
        return findWorkingServer(creds).then(function (other) {
          return other ? adoptServer(creds, other) : creds;
        });
      });
    });
  }

  // Prazo de cada consulta ao painel aqui: o postJson espera até 35 s (e
  // tenta 2 vezes), parado na tela de carregamento.
  var SERVER_SWITCH_TIMEOUT_MS = 15000;

  // Os outros servidores do cliente (fora o atual), na ordem do painel: o
  // primeiro cujo link responder NESTE aparelho, já com a sessão montada
  // nele igual a troca em Suas listas. null se nenhum responder. Recusa do
  // painel (senha, conta, revendedor) ou painel fora do ar param a procura:
  // seria igual em todos. Nunca desloga ninguém (bloqueio é com o heartbeat).
  function findWorkingServer(creds) {
    var auth = PanelApi.serverSwitchAuth(creds);
    var others = creds.servers.filter(function (s) {
      return s && s.id && s.id !== creds.currentServerId;
    });
    function tryAt(i) {
      if (i >= others.length) return Promise.resolve(null);
      var serverId = others[i].id;
      var timer;
      var safety = new Promise(function (resolve, reject) {
        timer = setTimeout(function () {
          reject(new PanelApi.PanelError("panel_timeout"));
        }, SERVER_SWITCH_TIMEOUT_MS);
      });
      var ask = PanelApi.switchServer(creds.resellerSlug, auth.username, auth.password, serverId, auth.mac);
      return Promise.race([ask, safety]).then(function (result) {
        clearTimeout(timer);
        if (!result || !result.m3u_url) return tryAt(i + 1);
        var candidate = PanelApi.credsOnServer(creds, serverId, result);
        // Link M3U puro não dá pra conferir rápido; e o mesmo link do
        // servidor que não respondeu nem precisa conferir.
        var sameLink = PanelApi.sameDns(candidate.url, creds.url) && candidate.username === creds.username;
        if (candidate.mode !== "xtream" || sameLink) return tryAt(i + 1);
        return XtreamApi.xtreamAuthCheck(candidate, true).then(function (health) {
          return health === "ok" ? candidate : tryAt(i + 1);
        });
      }, function (e) {
        clearTimeout(timer);
        // Só "esse servidor não existe/não tem link" passa pro próximo.
        var code = e && e.code;
        return code === "server_not_found" || code === "server_unavailable" ? tryAt(i + 1) : null;
      });
    }
    return tryAt(0);
  }

  // Grava igual a troca em Suas listas (servidor atual, conta/link e DNS
  // do servidor novo) e zera o "Continuar assistindo", que apontava pro
  // servidor antigo. O catálogo já vem do novo (finishLogin).
  function adoptServer(old, found) {
    // Alguém saiu ou trocou de lista enquanto o painel respondia.
    if (!sameSession(SessionStore.loadCreds(), old)) return old;
    SessionStore.saveCreds(found);
    ContinueWatching.clearAll();
    showNotice(serverSwitchNotice(old, found));
    return found;
  }
  function serverSwitchNotice(old, found) {
    function labelOf(id) {
      var match = (old.servers || []).filter(function (s) {
        return s && id && s.id === id;
      })[0];
      return match && match.label ? String(match.label).trim() : "";
    }
    var oldLabel = labelOf(old.currentServerId);
    var newLabel = labelOf(found.currentServerId);
    return (oldLabel ? "O servidor " + oldLabel + " não respondeu." : "O servidor não respondeu.") + (newLabel ? " Trocamos pro servidor " + newLabel + "." : " Trocamos pra outro servidor.");
  }

  // Aviso rápido por cima da tela (ex.: troca sozinha de servidor). Aparece
  // já no carregamento e some 8 s depois de abrir a tela, igual o Android.
  // Só texto, sem .focusable: o controle continua na tela de trás.
  var NOTICE_MS = 8000;
  var noticeTimer = null;
  function showNotice(msg) {
    var el = document.getElementById("app-notice");
    if (!el) {
      el = document.createElement("div");
      el.id = "app-notice";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("visible");
    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }
  }
  function hideNoticeLater() {
    var el = document.getElementById("app-notice");
    if (!el || !el.classList.contains("visible")) return;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () {
      noticeTimer = null;
      el.classList.remove("visible");
    }, NOTICE_MS);
  }

  // Os outros DNS do mesmo servidor (alternateUrls), na ordem do painel: o
  // primeiro que responder NESTE aparelho, já com a conta montada nele.
  // null se nenhum responder.
  function findWorkingDns(creds) {
    if (creds.mode !== "xtream") return Promise.resolve(null);
    var list = (creds.alternateUrls || []).filter(function (dns) {
      return !PanelApi.sameDns(dns, creds.url);
    });
    function tryAt(i) {
      if (i >= list.length) return Promise.resolve(null);
      var candidate = PanelApi.credsOnDns(creds, list[i]);
      return XtreamApi.xtreamAuthCheck(candidate, true).then(function (health) {
        return health === "ok" ? candidate : tryAt(i + 1);
      });
    }
    return tryAt(0);
  }
  function adoptDns(creds) {
    SessionStore.saveCreds(creds);
    // Avisa o painel já, sem esperar o heartbeat de 20 min: ele grava esse
    // DNS no aparelho (por MAC) e manda ele primeiro no próximo login.
    if (creds.deviceId && creds.customerId) {
      PanelApi.deviceHeartbeat(creds.deviceId, creds.customerId, PanelApi.xtreamDnsBase(creds.url)).then(function (errorCode) {
        // O heartbeat entrega o "forçar logout" do painel uma vez só: não
        // pode ser engolido aqui.
        if (errorCode) onSessionBlocked(errorCode, creds);
      });
    }
    return creds;
  }

  // Chamado por login.js/lists.js (troca de lista) após salvar uma sessão
  // nova -- sempre "fresh" (concede trial se for a 1a vez que esse
  // dispositivo autocadastrado aparece).
  function onLoggedIn() {
    var creds = SessionStore.loadCreds();
    if (!creds) {
      Router.go("login");
      return;
    }
    finishLogin(creds);
  }

  // Pedido explícito: "Recarregar" não fazia nada perceptível (só
  // reconstruía a Início com os MESMOS dados locais, sem checar nada de
  // novo). Reaproveita a mesma verificação de boot() -- sessão salva +
  // ensureActivated contra o painel -- igual o Android faz (MainViewModel.
  // reload(): "resincroniza... exatamente como reabrir o app do início").
  // clearListCache força o catálogo pré-buscado de novo (não só repetir o
  // que já tava em memória, senão "recarregar" não buscaria nada novo de
  // verdade). Reexibe #boot-loading durante tudo isso pra dar feedback.
  function reloadSession() {
    showBootOverlay("Verificando sua sessão…");
    XtreamApi.clearListCache();
    verifySessionAndGo();
  }
  function play(request) {
    if (!request.returnTo) request.returnTo = Router.current();
    // Quem chama pode mandar os parâmetros de volta (ex.: série sem o
    // resumeEpisodeId, senão reabria o episódio sozinha ao voltar).
    if (!request.returnParams) request.returnParams = Router.currentParams();
    Router.go("player", onCurrentDns(request));
  }

  // Favoritos e a lista de episódios guardam o link inteiro, com o DNS da
  // época. Depois que o app trocou sozinho pra outro DNS do mesmo servidor
  // (findWorkingDns), esses links ainda apontavam pro DNS que não responde
  // neste aparelho -- troca pro DNS em uso. Mesma regra do Android.
  function onCurrentDns(request) {
    var c = SessionStore.loadCreds();
    if (!c || !hasAlternateDns(c)) return request;
    var current = PanelApi.xtreamDnsBase(c.url);
    var olds = c.alternateUrls.filter(function (u) {
      return !PanelApi.sameDns(u, current);
    });
    function rehost(url) {
      var m = /^(https?:\/\/[^/]+)(\/.*)$/i.exec(url || "");
      if (!m) return url;
      for (var i = 0; i < olds.length; i++) {
        if (PanelApi.sameDns(m[1], olds[i])) return current + m[2];
      }
      return url;
    }
    request.url = rehost(request.url);
    if (request.episodes) {
      request.episodes = request.episodes.map(function (ep) {
        return Object.assign({}, ep, {
          url: rehost(ep.url)
        });
      });
    }
    return request;
  }

  // Só se aplica a login por código de revendedor (deviceId/customerId/
  // resellerSlug, gravados no login) -- login M3U/Xtream direto não tem
  // revendedor/cliente pra checar contra. Melhor esforço: falha de rede
  // nunca desloga ninguém (PanelApi.deviceHeartbeat já devolve null nesse
  // caso).
  // skipRefresh: só o heartbeat, sem reconsultar a validade (aviso avulso,
  // ver heartbeatNow).
  function checkHeartbeat(skipRefresh) {
    if (blockPending) return;
    var creds = SessionStore.loadCreds();
    if (!creds || !creds.deviceId || !creds.customerId || !creds.resellerSlug) return;
    // DNS em uso neste aparelho: o painel guarda por MAC (ver deviceHeartbeat).
    var dns = creds.mode === "xtream" ? PanelApi.xtreamDnsBase(creds.url) || null : null;
    PanelApi.deviceHeartbeat(creds.deviceId, creds.customerId, dns).then(function (errorCode) {
      if (errorCode) {
        onSessionBlocked(errorCode, creds);
        return;
      }
      if (skipRefresh !== true) refreshCustomerExpiry(creds);
    });
  }

  // 1ª vez que algo toca neste aparelho (AppReport.markWatched, ver
  // player.js): avisa o painel já, sem esperar o heartbeat de 20 min ("Já
  // assistiu" na tela Clientes). Sem sessão de revendedor, não faz nada.
  function heartbeatNow() {
    checkHeartbeat(true);
  }
  function onSessionBlocked(errorCode, creds) {
    if (blockPending || !sameSession(SessionStore.loadCreds(), creds)) return;
    blockPending = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    // A pergunta "qual lista usar" não fica aberta embaixo do aviso: volta
    // a aparecer no próximo login, se ainda valer.
    ChoiceDialog.close();
    // Já apaga a sessão SALVA agora: o painel limpa o "Forçar logout"
    // assim que responde, e quem desligasse a TV com o aviso na tela
    // voltava logado normalmente.
    SessionStore.clearCreds();
    stopAllVideo();
    BlockedDialog.show(PanelApi.friendlyLoginError(errorCode));
  }

  // Ninguém continua assistindo atrás do aviso de bloqueio.
  function stopAllVideo() {
    // Player aberto: desmonta a reprodução (vídeo + tentativas de
    // reconexão). Na Samsung a tela cheia é o AVPlay, que não é um <video>:
    // o laço abaixo não achava ele e o filme seguia tocando atrás do aviso.
    if (global.PlayerScreen) PlayerScreen.stop();
    var videos = document.querySelectorAll("video");
    for (var i = 0; i < videos.length; i++) {
      try {
        videos[i].pause();
        videos[i].removeAttribute("src");
        videos[i].load();
      } catch (e) {}
    }
    // E o AVPlay direto, caso tenha ficado aberto por fora do player.
    if (global.Platform && Platform.stopVideo) Platform.stopVideo();
  }

  // Mesma sessão (ninguém saiu nem trocou de lista enquanto o painel
  // respondia) -- senão uma resposta atrasada regravava a sessão antiga,
  // até depois de "Sair da conta".
  function sameSession(a, b) {
    return !!a && !!b && a.deviceId === b.deviceId && a.url === b.url && a.username === b.username;
  }

  // Reconsulta a validade (expires_at) junto do heartbeat -- sem isso, uma
  // sessão com expires_at vazio/desatualizado no login nunca é atualizada
  // de novo depois (ex.: cliente renovou no painel).
  function refreshCustomerExpiry(creds) {
    // Sem senha do painel é sessão do MAC (de versão antiga, sem loginMac):
    // confere pelo MAC deste aparelho. A senha do SERVIDOR o painel recusa.
    var panelPassword = String(creds.panelPassword || "").trim();
    var mac = creds.loginMac || (!panelPassword ? String(DeviceIdentity.getDeviceMac() || "").trim() : "");
    var p = mac ? PanelApi.panelLoginByMac(creds.resellerSlug, mac) : PanelApi.panelLogin(creds.resellerSlug, creds.panelUsername || creds.username, panelPassword || creds.password);
    p.then(function (result) {
      var latest = SessionStore.loadCreds();
      if (!sameSession(latest, creds)) return;
      var changed = false;
      var newExpiry = result.customer && result.customer.expires_at;
      if (newExpiry && newExpiry !== latest.customerExpiresAt) {
        latest.customerExpiresAt = newExpiry;
        changed = true;
      }
      // Atualiza só a LISTA de DNS do servidor (o revendedor pode ter
      // incluído/excluído algum). O DNS em uso fica: o app pode estar noutro
      // DNS porque o do painel não responde aqui, e voltar pra ele baixava
      // o catálogo de novo pelo DNS bloqueado. A lista do painel é a do
      // servidor PADRÃO; com outro escolhido à mão, mantém a que já tinha.
      if (!latest.currentServerId || latest.currentServerId === result.current_server_id) {
        var list = PanelApi.dnsListFor(latest, result.m3u_url, result.alternate_urls);
        if (JSON.stringify(list || null) !== JSON.stringify(latest.alternateUrls || null)) {
          latest.alternateUrls = list;
          changed = true;
        }
      }
      // Listas deste aparelho em outros revendedores (campo ausente =
      // painel antigo, mantém o que tinha).
      var others = PanelApi.otherResellersFrom(result, latest.otherResellers || null);
      if (JSON.stringify(others || null) !== JSON.stringify(latest.otherResellers || null)) {
        latest.otherResellers = others;
        changed = true;
      }
      if (changed) {
        SessionStore.saveCreds(latest);
        checkListChoice();
      }
    }).catch(function () {});
  }

  // ===== Listas deste aparelho em outros revendedores =====
  // O mesmo MAC pode estar cadastrado em mais de um revendedor (cliente que
  // trocou de revendedor e o novo cadastrou o MAC também). Nenhum revendedor
  // apaga o cadastro do outro: quem escolhe a lista é o cliente, aqui. Suas
  // listas mostra as outras (trocar ou remover) e, a cada cadastro novo, o
  // app pergunta uma vez qual usar. Mesma regra do Android (MainViewModel.
  // pendingListChoice/answerListChoice/switchToOtherReseller).

  var switchingList = false;
  function otherListKey(o) {
    return SessionStore.otherListKey(o);
  }

  // 1º cadastro em outro revendedor que ainda não virou pergunta.
  function pendingListChoice(creds) {
    var seen = SessionStore.loadSeenOtherLists();
    var list = creds && creds.otherResellers || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].slug && seen.indexOf(otherListKey(list[i])) === -1) return list[i];
    }
    return null;
  }

  // Telas em que a pergunta pode aparecer. Nunca no Player (vídeo tocando)
  // nem no Login; Suas listas já mostra as outras listas; e Ao vivo/Filmes/
  // Séries/Favoritos/detalhes puxam o foco sozinhas quando o catálogo
  // termina de carregar (tirariam o foco do diálogo). A pergunta espera a
  // pessoa chegar na Início ou nos Ajustes (ver Router.onChange no fim).
  var LIST_CHOICE_SCREENS = {
    home: true,
    settings: true
  };
  function bootOverlayVisible() {
    var el = document.getElementById("boot-loading");
    return !!el && !el.classList.contains("boot-done");
  }
  function keyboardOpen() {
    var kb = document.getElementById("kb-overlay");
    return !!kb && kb.style.display === "flex";
  }

  // Mostra a pergunta se tiver cadastro novo e a pessoa estiver dentro do
  // app, sem vídeo, aviso de bloqueio, teclado ou carregamento na frente.
  function checkListChoice() {
    if (blockPending || switchingList || ChoiceDialog.isOpen() || keyboardOpen() || bootOverlayVisible()) return;
    if (!LIST_CHOICE_SCREENS[Router.current()]) return;
    var creds = SessionStore.loadCreds();
    var choice = pendingListChoice(creds);
    if (!choice) return;
    var otherBrand = PanelApi.otherResellerName(choice);
    var currentBrand = creds.brand && creds.brand.brandName && String(creds.brand.brandName).trim() || "a lista atual";
    ChoiceDialog.show({
      title: "Seu aparelho está em outra lista",
      message: otherBrand + " também cadastrou este aparelho. Qual lista você quer usar?\nDá pra trocar quando quiser em Suas listas.",
      buttons: [{
        label: "Usar " + otherBrand,
        accent: true,
        onSelect: function onSelect() {
          answerListChoice(choice, true);
        }
      }, {
        label: "Continuar com " + currentBrand,
        onSelect: function onSelect() {
          answerListChoice(choice, false);
        }
      }],
      // Foco começa em "Continuar" (um OK sem querer não troca a lista) e
      // Voltar = Continuar (dá pra trocar depois em Suas listas).
      focus: 1,
      back: 1
    });
  }

  // Qualquer resposta marca o cadastro como visto. Depois confere de novo
  // (pode ter outro cadastro ainda não visto).
  function answerListChoice(entry, use) {
    SessionStore.markOtherListSeen(otherListKey(entry));
    if (!use) {
      checkListChoice();
      return;
    }
    showBootOverlay("Trocando de lista…");
    switchToOtherReseller(entry.slug, null).then(function (switched) {
      if (!switched) hideBootOverlay();
    }).catch(function (e) {
      hideBootOverlay();
      showNotice(e && e.code ? PanelApi.friendlyLoginError(e.code) : "Não foi possível entrar nessa lista.");
      hideNoticeLater();
    });
  }
  function hideBootOverlay() {
    var el = document.getElementById("boot-loading");
    if (el) el.classList.add("boot-done");
  }

  // Troca pra lista deste aparelho em outro revendedor: é o login pelo MAC
  // com o código dele (sessão nova, com a marca e os servidores de lá),
  // montada igual ao login (LoginScreen.resellerSession), que também
  // registra o aparelho lá -- sem isso o heartbeat não roda e o painel
  // continua achando que a TV está no outro (a remoção da lista antiga
  // confere isso). `serverId` = um servidor dele escolhido em Suas listas
  // (null = o padrão). Resolve true se trocou, false se a sessão mudou no
  // meio (alguém saiu ou trocou de lista); erro do painel rejeita (PanelError).
  function switchToOtherReseller(slug, serverId) {
    var c = SessionStore.loadCreds();
    if (!c) return Promise.resolve(false);
    var mac = String(c.loginMac || DeviceIdentity.getDeviceMac() || "").trim();
    if (!mac) return Promise.reject(new PanelApi.PanelError("no_mac"));
    switchingList = true;
    return PanelApi.panelLoginByMac(slug, mac).then(function (result) {
      var username = result.customer && result.customer.username || "";
      return LoginScreen.resellerSession(slug, username, "", result, mac).then(function (fresh) {
        var wanted = !!serverId && serverId !== result.current_server_id && (result.servers || []).some(function (s) {
          return s && s.id === serverId;
        });
        if (!wanted) return fresh;
        // Servidor que não é o padrão de lá: troca pelo MAC, igual Suas
        // listas (PanelApi.serverSwitchAuth/credsOnServer).
        var auth = PanelApi.serverSwitchAuth(fresh);
        return PanelApi.switchServer(fresh.resellerSlug, auth.username, auth.password, serverId, auth.mac).then(function (sw) {
          return sw && sw.m3u_url ? PanelApi.credsOnServer(fresh, serverId, sw) : fresh;
        }, function () {
          // Fica no servidor padrão de lá; dá pra trocar depois.
          return fresh;
        });
      });
    }).then(function (fresh) {
      switchingList = false;
      if (!sameSession(SessionStore.loadCreds(), c)) return false;
      // (saveCreds marca como vista a lista de onde a pessoa saiu.)
      SessionStore.saveCreds(fresh);
      XtreamApi.clearListCache();
      ContinueWatching.clearAll();
      onLoggedIn();
      return true;
    }, function (e) {
      switchingList = false;
      throw e;
    });
  }
  function startHeartbeatLoop() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    blockPending = false;
    heartbeatTimer = setInterval(checkHeartbeat, HEARTBEAT_INTERVAL_MS);
    // Também logo ao abrir: antes a 1ª checagem só vinha 20 min depois de
    // cada abertura, e quem foi bloqueado/vencido seguia assistindo até lá.
    setTimeout(checkHeartbeat, 3000);
  }
  function verifySessionAndGo() {
    var creds = SessionStore.loadCreds();
    if (!creds) {
      Router.go("login");
      return;
    }
    finishLogin(creds);
  }
  function boot() {
    AppTheme.init();
    // Descanso de tela da TV etc. -- ver js/lib/platform.js.
    if (global.Platform) Platform.init();
    verifySessionAndGo();
    // Versão nova? (aviso na Início e nos Ajustes, ver js/data/appUpdate.js)
    AppUpdate.check();
  }
  global.App = {
    onLoggedIn: onLoggedIn,
    reloadSession: reloadSession,
    play: play,
    finishLogin: finishLogin,
    switchToOtherReseller: switchToOtherReseller,
    checkListChoice: checkListChoice,
    heartbeatNow: heartbeatNow
  };

  // A cada troca de tela: um diálogo que ficou aberto por trás fecha sem
  // resposta (pergunta de novo depois) e a pergunta "qual lista usar"
  // aparece se a pessoa chegou numa tela em que ela pode aparecer.
  Router.onChange(function () {
    if (ChoiceDialog.isOpen()) ChoiceDialog.close();
    checkListChoice();
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);