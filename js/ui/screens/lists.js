/*
 * Porta de tv-app/android/.../ui/lists/ListsScreen.kt -- Suas Listas:
 * servidores do revendedor, listas deste aparelho em outros revendedores
 * (trocar/remover), listas salvas (código de revendedor, adiciona via
 * Keyboard), backup/voltar, trocar lista ativa.
 */
(function (global) {
  "use strict";

  var state = {
    switching: false,
    removing: false,
    error: null,
    lists: []
  };
  // Linhas de "Outras listas deste aparelho" desenhadas agora: data-row-id
  // -> { other, serverId } (ver render).
  var otherRows = {};
  // Re-render pedido enquanto um diálogo estava aberto (ver render).
  var renderPending = false;
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Nome do revendedor na frente do servidor ("JzPlay · BRPRO"): o mesmo
  // aparelho pode ter listas de mais de um revendedor. Mesma regra do Android.
  function withBrand(brand, server) {
    return brand ? brand + " · " + server : server;
  }
  function kindLabel(kind) {
    if (kind === "m3u") return "Link M3U";
    if (kind === "xtream") return "Xtream";
    return "Código de revendedor";
  }
  function currentAccountLabel(creds) {
    if (creds.resellerSlug) return "Revendedor: " + creds.resellerSlug;
    if (creds.mode === "xtream") return creds.url || "Xtream: " + creds.username;
    return "Lista M3U";
  }

  // Mesma lógica de MainViewModel.credsFromEntry -- as 3 formas de login
  // (M3U/Xtream/código de revendedor) reconstroem XtreamCreds a partir de
  // uma CustomListEntry salva.
  function credsFromEntry(entry) {
    if (entry.kind === "m3u") {
      var url = (entry.m3uUrl || "").trim();
      if (!url) return Promise.reject(new Error("Link M3U vazio."));
      var fromM3u = PanelApi.xtreamFromM3uUrl(url, null, null);
      return Promise.resolve(fromM3u || {
        url: url,
        username: "",
        password: "",
        m3uUrl: url,
        mode: "m3u"
      });
    }
    if (entry.kind === "xtream") {
      var xurl = (entry.url || "").trim(),
        xuser = (entry.username || "").trim(),
        xpass = (entry.password || "").trim();
      if (!xurl || !xuser || !xpass) return Promise.reject(new Error("Preencha servidor, usuário e senha."));
      return Promise.resolve({
        url: xurl,
        username: xuser,
        password: xpass,
        mode: "xtream"
      });
    }
    // "panel" -- código de revendedor salvo
    var code = (entry.code || "").trim(),
      username = (entry.username || "").trim(),
      password = (entry.password || "").trim();
    return PanelApi.panelLogin(code, username, password).then(function (result) {
      var m3uUrl = result.m3u_url;
      if (!m3uUrl) return Promise.reject(new PanelApi.PanelError("no_playlist_configured"));
      var creds = PanelApi.xtreamFromM3uUrl(m3uUrl, username, password) || PanelApi.m3uCredsFromPanelUrl(m3uUrl, username, password);
      var slug = result.reseller && result.reseller.slug || code.toLowerCase();
      creds.panelUrl = PanelApi.PANEL_URL;
      creds.resellerSlug = slug;
      creds.panelUsername = username;
      creds.panelPassword = password;
      creds.brand = result.reseller ? {
        brandName: result.reseller.brand_name,
        primaryColor: result.reseller.primary_color,
        secondaryColor: result.reseller.secondary_color
      } : null;
      creds.servers = result.servers || null;
      creds.currentServerId = result.current_server_id || null;
      creds.alternateUrls = result.alternate_urls || null;
      creds.customerExpiresAt = result.customer && result.customer.expires_at;
      creds.isUnregistered = !!(result.customer && result.customer.is_unregistered);
      creds.otherResellers = PanelApi.otherResellersFrom(result);
      // Registra o aparelho igual ao login normal: sem deviceId essa conta
      // ficava sem heartbeat (bloqueio/vencimento no painel não chegavam).
      var platform = window.Platform ? Platform.name : "webos sim";
      return PanelApi.registerDevice(slug, username, password, DeviceIdentity.getDeviceUid(), DeviceIdentity.getDeviceCode(), platform).then(function (deviceAuth) {
        creds.deviceId = deviceAuth && deviceAuth.device && deviceAuth.device.id;
        creds.customerId = result.customer && result.customer.id || deviceAuth && deviceAuth.customer && deviceAuth.customer.id;
        return creds;
      });
    });
  }

  // A sessão salva ainda é a mesma que a requisição começou a consultar
  // (ninguém saiu nem trocou no meio): senão uma resposta atrasada gravava
  // a sessão antiga de volta -- até depois de "Sair da conta".
  function sameSession(a, b) {
    return !!a && !!b && a.url === b.url && a.username === b.username && a.password === b.password && a.activeCustomListId === b.activeCustomListId;
  }
  function switchToCustomList(entry) {
    var current = SessionStore.loadCreds();
    // Lista que já está ativa: antes baixava o catálogo inteiro de novo.
    if (current && current.activeCustomListId === entry.id) return;
    state.switching = true;
    state.error = null;
    render();
    var backupPromise = current && !current.activeCustomListId ? Promise.resolve(SessionStore.saveResellerBackup(current)) : Promise.resolve();
    backupPromise.then(function () {
      return credsFromEntry(entry);
    }).then(function (newCreds) {
      newCreds.activeCustomListId = entry.id;
      SessionStore.saveCreds(newCreds);
      ContinueWatching.clearAll();
      state.switching = false;
      global.App.onLoggedIn();
    }).catch(function (e) {
      state.switching = false;
      state.error = e && e.code ? PanelApi.friendlyLoginError(e.code) : e && e.message || "Não foi possível entrar nessa lista.";
      render();
    });
  }
  function switchBackToReseller() {
    var backup = SessionStore.loadResellerBackup();
    if (!backup) return;
    SessionStore.saveCreds(backup);
    ContinueWatching.clearAll();
    global.App.onLoggedIn();
  }
  function switchServer(serverId) {
    var c = SessionStore.loadCreds();
    if (!c || !c.resellerSlug) return;
    // Servidor que já está ativo: não troca nem apaga o progresso.
    if (serverId === c.currentServerId) return;
    // Quem entrou pelo MAC troca pelo MAC (ver PanelApi.serverSwitchAuth).
    var auth = PanelApi.serverSwitchAuth(c);
    state.switching = true;
    state.error = null;
    render();
    PanelApi.switchServer(c.resellerSlug, auth.username, auth.password, serverId, auth.mac).then(function (result) {
      if (!result.m3u_url) throw new PanelApi.PanelError("no_playlist_configured");
      if (!sameSession(SessionStore.loadCreds(), c)) {
        state.switching = false;
        return;
      }
      // Só a conexão e os DNS mudam (ver PanelApi.credsOnServer).
      SessionStore.saveCreds(PanelApi.credsOnServer(c, serverId, result));
      ContinueWatching.clearAll();
      state.switching = false;
      global.App.onLoggedIn();
    }).catch(function (e) {
      state.switching = false;
      state.error = e && e.code ? PanelApi.friendlyLoginError(e.code) : "Não foi possível trocar de servidor.";
      render();
    });
  }

  // Linha de "Outras listas deste aparelho": entra na lista desse outro
  // revendedor (login pelo MAC com o código dele, ver
  // App.switchToOtherReseller). `serverId` = servidor dele escolhido aqui.
  function switchToOtherReseller(slug, serverId) {
    if (state.switching || state.removing) return;
    var thisVisit = visit;
    state.switching = true;
    state.error = null;
    render();
    global.App.switchToOtherReseller(slug, serverId).then(function (switched) {
      state.switching = false;
      // Trocou: o App já está carregando a lista nova. Senão a sessão mudou
      // no meio e só tira o "Trocando…".
      if (!switched && thisVisit === visit) render();
    }).catch(function (e) {
      state.switching = false;
      if (thisVisit !== visit) return;
      state.error = e && e.code ? PanelApi.friendlyLoginError(e.code) : "Não foi possível entrar nessa lista.";
      render();
    });
  }

  // "Remover" numa linha de outro revendedor: confirma antes. Foco em
  // Cancelar e Voltar = Cancelar, igual o Android.
  function confirmRemoveOther(other) {
    if (state.switching || state.removing) return;
    var name = PanelApi.otherResellerName(other);
    ChoiceDialog.show({
      title: "Remover " + name + " deste aparelho?",
      message: "As listas de " + name + " saem deste aparelho. Pra voltar, é só pedir pra " + name + " cadastrar ele de novo.",
      row: true,
      buttons: [{
        label: "Cancelar",
        onSelect: renderIfPending
      }, {
        label: "Remover",
        accent: true,
        onSelect: function onSelect() {
          removeOtherReseller(other);
        }
      }],
      focus: 0,
      back: 0
    });
  }

  // Tira deste aparelho a lista de outro revendedor. Nenhum revendedor
  // apaga o outro: só o cliente, por aqui. Mesma regra do Android
  // (MainViewModel.removeOtherReseller).
  function removeOtherReseller(other) {
    var c = SessionStore.loadCreds();
    if (!c) return;
    var thisVisit = visit;
    var mac = String(c.loginMac || DeviceIdentity.getDeviceMac() || "").trim();
    state.removing = true;
    state.error = null;
    render();
    // device_uid = o mesmo id que o login manda no /device/auth: o painel só
    // aceita a remoção de um aparelho que já entrou com esse MAC.
    var p = mac ? PanelApi.removeResellerList(mac, DeviceIdentity.getDeviceUid(), other.slug) : Promise.reject(new PanelApi.PanelError("no_mac"));
    p.then(function () {
      var latest = SessionStore.loadCreds();
      if (latest && latest.otherResellers) {
        latest.otherResellers = latest.otherResellers.filter(function (o) {
          return o && o.slug !== other.slug;
        });
        SessionStore.saveCreds(latest);
      }
      state.removing = false;
      if (thisVisit === visit) render();
    }).catch(function (e) {
      state.removing = false;
      if (thisVisit !== visit) return;
      // Só esses dois têm mensagem própria; o resto (inclusive painel fora
      // do ar) não é a mensagem genérica de login.
      var code = e && e.code;
      state.error = code === "list_in_use" || code === "device_not_recognized" ? PanelApi.friendlyLoginError(code) : "Não foi possível remover essa lista.";
      render();
    });
  }
  function renderIfPending() {
    if (renderPending) render();
  }

  // Reconfirma servers/current_server_id do revendedor (login de código) --
  // melhor esforço, nunca quebra a tela se o painel estiver fora do ar.
  function refreshResellerServers() {
    var c = SessionStore.loadCreds();
    if (!c || !c.resellerSlug) return Promise.resolve();
    // Com senha do PAINEL guardada (entrou com código + usuário + senha),
    // reconfere com ela. Sem ela, é sessão do MAC: reconfere pelo MAC de login
    // ou, em sessão de versão antiga que ainda não guardava o loginMac, pelo
    // MAC deste aparelho (o mesmo que entrou). Antes caía na senha do
    // SERVIDOR (c.password, a do link), o painel recusava e as listas novas
    // nunca apareciam (caso real de 18/11, LG pelo Media Station X).
    var username = c.panelUsername || c.username;
    var panelPassword = String(c.panelPassword || "").trim();
    var mac = String(c.loginMac || "").trim() || (panelPassword ? "" : String(DeviceIdentity.getDeviceMac() || "").trim());
    var p = panelPassword && username && !c.loginMac ? PanelApi.panelLogin(c.resellerSlug, username, panelPassword) : mac ? PanelApi.panelLoginByMac(c.resellerSlug, mac) : Promise.resolve(null);
    return p.then(function (result) {
      if (!result) return;
      var latest = SessionStore.loadCreds();
      if (!sameSession(latest, c)) return;
      // Sessão do MAC e o painel respondeu OUTRO cliente: o MAC foi passado
      // pra outro cadastro (ou a sessão é de antes de guardar o cliente).
      // Refaz a sessão nesse cadastro, igual entrar de novo pelo MAC (registra
      // o aparelho lá). Antes a TV seguia no cadastro antigo: o novo aparecia
      // como "nunca entrou" e o padrão trocado no painel não chegava (caso
      // real de 18/11, LG pelo Media Station X).
      var outroCliente = result.customer && result.customer.id && result.customer.id !== latest.customerId;
      if (outroCliente && !panelPassword && global.App && global.App.switchToOtherReseller) {
        return global.App.switchToOtherReseller(latest.resellerSlug, null).catch(function () {});
      }
      var mudouConexao = false;
      // Sessão do MAC de versão antiga confirmada pelo MAC: guarda o loginMac,
      // pra troca de lista e as próximas conferências irem pelo MAC.
      if (!latest.loginMac && mac && !panelPassword) latest.loginMac = mac;
      // Listas deste aparelho em outros revendedores (campo ausente = painel
      // antigo, mantém o que tinha).
      latest.otherResellers = PanelApi.otherResellersFrom(result, latest.otherResellers || null);
      if (result.servers) {
        latest.servers = result.servers;
        // Mantém o servidor escolhido aqui enquanto ele existir: o painel
        // sempre responde o PADRÃO, e sobrescrever marcava o servidor errado
        // como ativo ("★") na tela.
        var keep = latest.currentServerId && result.servers.some(function (s) {
          return s.id === latest.currentServerId;
        });
        if (!keep && result.m3u_url && result.current_server_id) {
          // O servidor em uso não está mais na lista do painel (foi tirado,
          // ou a sessão é de antes dela): passa pro PADRÃO de verdade, com a
          // conexão dele. Antes só punha a ★ no padrão e seguia na conexão
          // antiga, e tocar nele em Suas Listas não fazia nada, porque já
          // constava como o atual (caso real de 18/11, LG pelo Media Station X).
          var noPadrao = PanelApi.credsOnServer(latest, result.current_server_id, result);
          mudouConexao = noPadrao.url !== latest.url || noPadrao.username !== latest.username || noPadrao.password !== latest.password || noPadrao.m3uUrl !== latest.m3uUrl;
          latest = noPadrao;
        } else {
          if (!keep) latest.currentServerId = result.current_server_id || latest.currentServerId;
          // A lista de DNS do painel é a do servidor PADRÃO; com outro servidor
          // escolhido à mão, mantém a que já tinha.
          if (!keep || latest.currentServerId === result.current_server_id) {
            latest.alternateUrls = PanelApi.dnsListFor(latest, result.m3u_url, result.alternate_urls);
          }
        }
      }
      SessionStore.saveCreds(latest);
      // Conexão nova: recarrega o catálogo dela (igual trocar em Suas Listas).
      if (mudouConexao && global.App) {
        ContinueWatching.clearAll();
        global.App.onLoggedIn();
      }
    }).catch(function () {});
  }
  function reportCustomList(entry) {
    if (entry.kind === "panel" || entry.serverId) return;
    var deviceUid = DeviceIdentity.getDeviceUid();
    PanelApi.reportDevicePlaylist(deviceUid, entry.kind, entry.url, entry.username, entry.password, entry.m3uUrl, entry.label).then(function (result) {
      if (result) SessionStore.updateCustomList(Object.assign({}, entry, {
        serverId: result.id
      }));
    });
  }
  function pullNewAssignedPlaylists() {
    var deviceUid = DeviceIdentity.getDeviceUid();
    return PanelApi.fetchAssignedPlaylists(deviceUid).then(function (remote) {
      var known = {};
      SessionStore.getCustomLists().forEach(function (l) {
        if (l.serverId) known[l.serverId] = true;
      });
      remote.forEach(function (playlist) {
        if (known[playlist.id]) return;
        var valid = playlist.mode === "m3u" ? !!playlist.m3u_url : !!(playlist.url && playlist.username);
        if (!valid) return;
        SessionStore.addCustomList({
          label: playlist.label && playlist.label.trim() || "Lista do site",
          kind: playlist.mode,
          url: playlist.url,
          username: playlist.username,
          password: playlist.password,
          m3uUrl: playlist.m3u_url,
          serverId: playlist.id
        });
      });
    });
  }
  function syncListsWithSite() {
    var creds = SessionStore.loadCreds();
    if (creds && creds.resellerSlug) return refreshResellerServers();
    return pullNewAssignedPlaylists().then(function () {
      SessionStore.getCustomLists().filter(function (l) {
        return l.kind !== "panel" && !l.serverId;
      }).forEach(reportCustomList);
    });
  }
  function render() {
    // render() é chamado de VÁRIOS lugares -- não só mount() (ex.: depois
    // do sync em segundo plano terminar, depois de trocar/remover lista,
    // em erro) -- sem guardar/restaurar o foco por linha, cada uma dessas
    // chamadas puxava o foco de volta pro topo da tela NO MEIO da pessoa
    // navegando (bug real da auditoria, mesma classe do live.js/
    // contentGrid.js, só que aqui o re-render podia disparar sozinho a
    // qualquer momento, não só em resposta a um clique direto).
    // Com um diálogo aberto (confirmação de Remover) fica pra quando ele
    // fechar: redesenhar agora trocava o Voltar da pilha (ContentHeaderBar.
    // bind) e tirava o foco de dentro do diálogo.
    if (global.ChoiceDialog && ChoiceDialog.isOpen()) {
      renderPending = true;
      return;
    }
    renderPending = false;
    var focusedRowId = null;
    // A linha inteira (closest): com o foco no "Remover" de uma linha, o
    // foco volta pra ela, não pro topo da tela.
    var focusedRow = SN.current() && SN.current().closest("[data-row-id]");
    if (focusedRow) focusedRowId = focusedRow.getAttribute("data-row-id");
    var root = document.querySelector('.screen[data-screen="lists"] .screen-content');
    var creds = SessionStore.loadCreds();
    var hasBackup = !!SessionStore.loadResellerBackup();
    var resellerServers = creds && creds.servers || [];
    var activeEntry = state.lists.find(function (l) {
      return creds && l.id === creds.activeCustomListId;
    });
    // Marca da sessão na frente de cada servidor (sem nome, o código).
    var brand = creds ? creds.brand && creds.brand.brandName && String(creds.brand.brandName).trim() || creds.resellerSlug || "" : "";
    var rows = "";
    if (hasBackup) rows += listRowHtml("backup", "Voltar pra conta anterior", "Restaura a conta de antes da última troca de lista", false, true);
    if (resellerServers.length) {
      rows += '<div style="color:#9A9AA5;font-size:12px;font-weight:700;margin-top:6px;">Servidores do seu plano</div>';
      resellerServers.forEach(function (s) {
        rows += listRowHtml("server:" + s.id, esc(withBrand(brand, s.label)), kindLabel(s.kind), s.id === creds.currentServerId, false);
      });
    }
    // O mesmo MAC cadastrado em outro revendedor (cliente que trocou de
    // revendedor): o cliente troca pra lista de lá ou tira ela daqui. Uma
    // linha por servidor de lá (sem servidores, uma linha só com o nome).
    otherRows = {};
    var others = creds && creds.otherResellers || [];
    if (others.length) {
      rows += '<div style="color:#9A9AA5;font-size:12px;font-weight:700;margin-top:6px;">Outras listas deste aparelho</div>';
      others.forEach(function (other) {
        var name = PanelApi.otherResellerName(other);
        var servers = other.servers && other.servers.length ? other.servers : [null];
        servers.forEach(function (server) {
          var rowId = "other:" + encodeURIComponent(other.slug) + ":" + (server ? encodeURIComponent(server.id) : "");
          otherRows[rowId] = {
            other: other,
            serverId: server ? server.id : null
          };
          rows += listRowHtml(rowId, esc(server ? withBrand(name, server.label) : name), "Outro revendedor", false, true);
        });
      });
    }
    if (!activeEntry && creds && !resellerServers.length) {
      rows += listRowHtml("current", currentAccountLabel(creds), "Conta atual", true, false);
    }
    if (!state.lists.length) {
      rows += '<div style="color:#9A9AA5;font-size:13px;">Nenhuma lista salva ainda. Adicione uma pra trocar rápido depois.</div>';
    } else {
      state.lists.forEach(function (entry) {
        rows += listRowHtml("list:" + entry.id, entry.label, kindLabel(entry.kind), activeEntry && activeEntry.id === entry.id, true);
      });
    }

    // Header + conteúdo embrulhados numa coluna flex + flex:1/min-height:0/
    // overflow-y:auto no conteúdo -- faltava rolagem aqui (mesma classe de
    // bug encontrada e corrigida em settings.js/movieDetail.js nesta
    // revisão); com servidores do revendedor + várias listas salvas +
    // backup, as últimas linhas podiam ficar inalcançáveis pelo D-pad.
    root.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;">' + ContentHeaderBar.html({
      title: "Suas Listas",
      trailingHtml: (state.switching ? '<span style="color:var(--accent);font-size:13px;margin-right:12px;">Trocando…</span>' : "") + (state.removing ? '<span style="color:var(--accent);font-size:13px;margin-right:12px;">Removendo…</span>' : "") + '<button class="focusable" id="lists-add" style="background:rgba(108,92,231,0.18);border:2px solid #6C5CE7;color:#fff;padding:8px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;">' + Icon("plus") + " Adicionar lista</button>"
    }) + '<div style="flex:1;min-height:0;overflow-y:auto;padding:32px;display:flex;flex-direction:column;gap:12px;max-width:640px;" data-sn-scroll>' + (state.error ? '<div style="color:#FF6B6B;font-size:12px;">' + state.error + "</div>" : "") + rows + "</div>" + "</div>";
    ContentHeaderBar.bind(root, function () {
      Router.go("settings");
    });
    root.querySelector("#lists-add").addEventListener("sn:enter", openAddDialog);
    root.querySelectorAll("[data-row-id]").forEach(function (el) {
      var id = el.getAttribute("data-row-id");
      el.addEventListener("sn:enter", function () {
        onRowClick(id);
      });
      var removeBtn = el.querySelector("[data-remove]");
      if (removeBtn) removeBtn.addEventListener("sn:enter", function (ev) {
        ev.stopPropagation();
        if (id.indexOf("other:") === 0) {
          if (otherRows[id]) confirmRemoveOther(otherRows[id].other);
          return;
        }
        SessionStore.removeCustomList(id.replace("list:", ""));
        refresh();
      });
    });
    var restored = focusedRowId && document.querySelector('[data-row-id="' + focusedRowId + '"]');
    if (restored) SN.setFocus(restored);else SN.focusFirst(document.querySelector('.screen[data-screen="lists"]'));
  }
  function listRowHtml(id, title, subtitle, active, removable) {
    return '<div class="focusable lists-row' + (active ? " active" : "") + '" data-row-id="' + id + '">' + '  <div><div style="color:#fff;font-size:14px;font-weight:700;">' + (active ? "★ " : "") + title + "</div>" + '  <div style="color:#9A9AA5;font-size:11px;">' + subtitle + "</div></div>" + (removable ? '<button class="focusable" data-remove style="background:transparent;border:none;color:#FF6B6B;font-size:12px;font-weight:700;cursor:pointer;">Remover</button>' : "") + "</div>";
  }
  function onRowClick(id) {
    if (id === "backup") {
      switchBackToReseller();
      return;
    }
    if (id.indexOf("server:") === 0) {
      switchServer(id.slice(7));
      return;
    }
    if (id.indexOf("other:") === 0) {
      var other = otherRows[id];
      if (other) switchToOtherReseller(other.other.slug, other.serverId);
      return;
    }
    if (id.indexOf("list:") === 0) {
      var entry = state.lists.find(function (l) {
        return l.id === id.slice(5);
      });
      if (entry) switchToCustomList(entry);
    }
  }
  function openAddDialog() {
    var label = "",
      code = "",
      username = "",
      password = "";
    Keyboard.open({
      label: "Nome da lista (opcional)",
      initialValue: label
    }).then(function (v) {
      if (v === null) return;
      label = v;
      return Keyboard.open({
        label: "Código de revendedor",
        initialValue: code
      });
    }).then(function (v) {
      if (v === null || v === undefined) return;
      code = v;
      return Keyboard.open({
        label: "Usuário",
        initialValue: username
      });
    }).then(function (v) {
      if (v === null || v === undefined) return;
      username = v;
      return Keyboard.open({
        label: "Senha",
        initialValue: password
      });
    }).then(function (v) {
      if (v === null || v === undefined) return;
      password = v;
      var entry = SessionStore.addCustomList({
        label: label || "Código " + code,
        kind: "panel",
        code: code.trim(),
        username: username.trim(),
        password: password.trim()
      });
      reportCustomList(entry);
      refresh();
    });
  }
  function refresh() {
    state.lists = SessionStore.getCustomLists();
    render();
  }
  if (!document.querySelector("#lists-style")) {
    var style = document.createElement("style");
    style.id = "lists-style";
    style.textContent = ".lists-row{display:flex;align-items:center;justify-content:space-between;background:#17171C;border:2px solid transparent;border-radius:10px;padding:13px 16px;cursor:pointer;}" + ".lists-row.active{background:rgba(108,92,231,0.22);}" + ".lists-row.sn-focused{border-color:#6C5CE7;}";
    document.head.appendChild(style);
  }

  // Visita atual da tela: a resposta do site que chega depois de a pessoa
  // já ter saído não redesenha mais (antes redesenhava e ainda tomava o
  // botão Voltar da tela atual -- Voltar na Início ia pra Ajustes).
  var visit = 0;
  function mount() {
    var thisVisit = ++visit;
    state = {
      switching: false,
      removing: false,
      error: null,
      lists: SessionStore.getCustomLists()
    };
    render();
    syncListsWithSite().then(function () {
      if (thisVisit === visit) refresh();
    });
  }
  Router.register("lists", {
    mount: mount,
    unmount: function unmount() {
      visit++;
      ContentHeaderBar.unbind();
    }
  });
  // O app chama ao abrir (app.js): servidor novo cadastrado no painel depois
  // do login aparece em Ajustes e Suas Listas sem precisar abrir esta tela.
  global.ListsScreen = {
    refreshServers: refreshResellerServers
  };
})(window);