/*
 * Porta de tv-app/android/.../ui/favorites/FavoritesScreen.kt -- painel
 * lateral por tipo (TV ao vivo/Filmes/Séries) + grade com os registros
 * completos guardados no momento de favoritar (ver SessionStore.toggleFavorite).
 */
(function (global) {
  "use strict";

  var KIND_ORDER = [["live", "TV ao vivo"], ["movie", "Filmes"], ["series", "Séries"]];
  var state = {
    activeKind: "live"
  };
  function render() {
    var root = document.querySelector('.screen[data-screen="favorites"] .screen-content');
    root.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;">' + ContentHeaderBar.html({
      title: "Favoritos"
    }) + '  <div style="flex:1;display:flex;overflow:hidden;">' +
    // 300px (era 240px) -- mesmo ajuste de contentGrid.js (Filmes/Séries),
    // pra ficar consistente entre as telas que usam esse mesmo painel.
    '    <div id="fav-categories" style="width:300px;background:rgba(11,11,16,0.9);overflow-y:auto;padding:12px 10px;display:flex;flex-direction:column;gap:8px;" data-sn-scroll></div>' +
    // repeat(8,1fr) fixo -- mesmo ajuste/mesmo motivo do contentGrid.js
    // (Filmes/Séries): no máximo 8 por linha, cartão maior, texto legível.
    // Flex com quebra (não display:grid): o navegador das Samsung até 2018
    // não tem grid. 8 por linha via largura fixa (ver #fav-grid no estilo).
    '    <div id="fav-grid" style="flex:1;overflow-y:auto;padding:24px;display:flex;flex-wrap:wrap;align-content:flex-start;align-items:flex-start;" data-sn-scroll></div>' + "  </div>" + "</div>";
    // .cg-cat/.cg-card (usadas abaixo) são injetadas por contentGrid.js,
    // mas só quando Filmes/Séries montam primeiro -- indo de Início direto
    // pro coração de Favoritos (sem nunca ter aberto Filmes/Séries antes),
    // essa tela ficava sem estilo nenhum (bug real do pente fino). Chama a
    // própria aqui, idempotente (ensureCardStyles já checa se existe).
    ContentGrid.ensureCardStyles();
    ContentHeaderBar.bind(root, function () {
      Router.go("home");
    });
  }
  function renderCategories() {
    var el = document.querySelector("#fav-categories");
    el.innerHTML = "";
    KIND_ORDER.forEach(function (pair) {
      var kind = pair[0],
        label = pair[1];
      var count = SessionStore.listFavorites(kind).length;
      var btn = document.createElement("button");
      btn.className = "focusable cg-cat" + (kind === state.activeKind ? " active" : "");
      btn.innerHTML = "<span>" + label + "</span><span>" + count + "</span>";
      btn.setAttribute("data-cat-id", kind);
      btn.addEventListener("sn:enter", function () {
        state.activeKind = kind;
        renderCategories();
        renderGrid();
        var sameCat = document.querySelector('[data-cat-id="' + kind + '"]');
        if (sameCat) SN.setFocus(sameCat);
      });
      el.appendChild(btn);
    });
  }
  function renderGrid() {
    var grid = document.querySelector("#fav-grid");
    var items = SessionStore.listFavorites(state.activeKind);
    var totalAll = KIND_ORDER.reduce(function (sum, p) {
      return sum + SessionStore.listFavorites(p[0]).length;
    }, 0);
    grid.innerHTML = "";
    if (!totalAll) {
      grid.innerHTML = '<div style="width:100%;text-align:center;padding:60px 0;color:#9A9AA5;"><div style="color:#fff;font-weight:700;font-size:16px;margin-bottom:6px;">Nenhum favorito ainda</div>Segure OK ou aperte o botão amarelo num card pra favoritar.</div>';
      return;
    }
    if (!items.length) {
      grid.innerHTML = '<div style="width:100%;text-align:center;padding:60px 0;color:#9A9AA5;">Nenhum favorito aqui ainda.</div>';
      return;
    }
    items.forEach(function (fav, index) {
      var card = document.createElement("div");
      card.className = "focusable cg-card";
      // 8 por linha com 14px entre eles (o que o grid fazia na LG).
      card.style.width = "calc((100% - 98px) / 8)";
      card.style.margin = "0 " + ((index + 1) % 8 === 0 ? "0" : "14px") + " 14px 0";
      // height fixo em px (não padding-top percentual) -- mesmo bug real
      // confirmado ao vivo e mesma correção de contentGrid.js: padding
      // percentual colapsa pra ~0 de altura quando o elemento é filho de
      // um item de grid nesse motor webOS específico. 276px = pôster (150%
      // de ~184px de coluna, 8 fixas, painel de 300px), 104px = 16:9 do
      // live. Recalculado junto com o aumento do painel de categorias
      // (240->300px) -- precisa acompanhar sempre que a largura do painel
      // ou #fav-grid mudar (mesmo valor de contentGrid.js/.cg-card
      // .cover-wrap, que usa a mesma largura de painel agora).
      var coverH = state.activeKind === "live" ? "104px" : "276px";
      // .fav-star fica DENTRO de .cover-wrap (não mais solta como filha
      // direta do card) -- contentGrid.js passou a ancorar selo/estrela/
      // progresso no .cover-wrap (pra acompanhar o pé da imagem, não o
      // card inteiro), então a estrela aqui precisa do mesmo wrapper pra
      // continuar posicionada certo (senão vira texto solto fora de lugar).
      card.innerHTML = '<div class="cover-wrap" style="height:' + coverH + ';"><img class="cover" src="' + (fav.cover || "") + '" loading="lazy" onerror="this.style.visibility=\'hidden\'" />' + '<div class="tags"><span class="fav-star">★</span></div>' + "</div>" + '<div class="cap">' + fav.name + "</div>";
      card.addEventListener("sn:enter", function () {
        // Volta pra cá, no mesmo tipo (antes a série voltava pra tela
        // Séries e o player caía em "TV ao vivo" aqui).
        if (state.activeKind === "series") {
          Router.go("seriesDetail", {
            id: fav.id,
            back: {
              screen: "favorites",
              params: {
                kind: "series"
              }
            }
          });
          return;
        }
        var kind = state.activeKind;
        // Link montado com o servidor/conta ATUAL (pelo item do catálogo):
        // o salvo no favorito apontava pro servidor da época e parava de
        // abrir depois de trocar de servidor ou de senha. Sem o item no
        // catálogo atual, cai no link salvo. Mesma regra do Android.
        currentUrl(kind, fav).then(function (url) {
          if (url) global.App.play({
            kind: kind,
            id: fav.id,
            title: fav.name,
            poster: fav.cover,
            url: url,
            returnTo: "favorites",
            returnParams: {
              kind: kind
            }
          });
        });
      });
      card.addEventListener("sn:longpress", function () {
        // Desfavoritar aqui SEMPRE tira o item da vista (é a própria lista
        // de favoritos) -- diferente de contentGrid.js, não dá pra
        // reachar o MESMO item depois. Foca o que ficou no mesmo lugar da
        // grade (ou o último, se a lista encolheu), em vez de deixar sem
        // foco nenhum até a próxima seta (mesmo bug da auditoria).
        SessionStore.toggleFavorite(state.activeKind, fav.id);
        renderCategories();
        renderGrid();
        var cards = document.querySelectorAll("#fav-grid .cg-card");
        var next = cards[Math.min(index, cards.length - 1)];
        if (next) SN.setFocus(next);
      });
      grid.appendChild(card);
    });
  }
  function currentUrl(kind, fav) {
    var creds = SessionStore.loadCreds();
    if (!creds) return Promise.resolve(fav.url || null);
    var list = kind === "live" ? XtreamApi.getLiveStreams(creds) : XtreamApi.getVod(creds);
    return list.then(function (items) {
      var item = (items || []).find(function (it) {
        return String(it.streamId) === String(fav.id);
      });
      if (!item) return fav.url || null;
      return kind === "live" ? XtreamApi.playableLiveUrl(creds, item) : XtreamApi.playableVodUrl(creds, item);
    }).catch(function () {
      return fav.url || null;
    });
  }
  function mount(params) {
    state.activeKind = params && params.kind || "live";
    render();
    renderCategories();
    renderGrid();
    SN.focusFirst(document.querySelector('.screen[data-screen="favorites"]'));
  }
  Router.register("favorites", {
    mount: mount,
    unmount: function unmount() {
      ContentHeaderBar.unbind();
    }
  });
})(window);