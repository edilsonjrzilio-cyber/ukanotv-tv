/* Porta de tv-app/android/.../ui/series/SeriesScreen.kt (SeriesDetailScreen). */
(function (global) {
  "use strict";

  var state = {
    episodes: null,
    groups: null,
    activeSeason: null,
    show: null,
    plot: null
  };

  // Temporadas em ordem numérica e episódios pelo número -- calculado UMA
  // vez por lista carregada e usado tanto pra desenhar quanto pra mandar a
  // lista pro player ("próximo episódio", ver player.js). Assim o próximo é
  // sempre o que aparece logo abaixo na tela, até com número repetido
  // (sort de engine antiga não é estável: ordenar de novo em outro lugar
  // podia trocar a ordem de dois episódios com o mesmo número).
  function groupEpisodes(episodes) {
    var bySeason = {};
    episodes.forEach(function (ep) {
      (bySeason[ep.season] = bySeason[ep.season] || []).push(ep);
    });
    var seasons = Object.keys(bySeason).map(Number).sort(function (a, b) {
      return a - b;
    });
    var ordered = [];
    seasons.forEach(function (s) {
      bySeason[s].sort(function (a, b) {
        return a.episodeNumber - b.episodeNumber;
      });
      ordered = ordered.concat(bySeason[s]);
    });
    return {
      bySeason: bySeason,
      seasons: seasons,
      ordered: ordered
    };
  }
  // Volta pra onde a série foi aberta (params.back: Séries na mesma
  // categoria com foco na série, ou Favoritos). Vai junto nos params de
  // volta do player, senão assistir um episódio perdia o caminho.
  var back = null;
  function goBack() {
    Router.go(back ? back.screen : "series", back ? back.params : undefined);
  }
  function render(creds) {
    var root = document.querySelector('.screen[data-screen="seriesDetail"] .screen-content');
    var show = state.show;
    var favs = SessionStore.getFavorites().series || [];
    var isFav = show && favs.indexOf(show.seriesId) >= 0;
    root.innerHTML = '<div style="height:100%;background:#050506;overflow-y:auto;" data-sn-scroll>' + '  <button class="focusable" id="sd-back" data-sn-autofocus style="position:fixed;top:28px;left:28px;background:rgba(255,255,255,0.08);border:none;color:#fff;font-size:20px;width:44px;height:44px;border-radius:50%;cursor:pointer;z-index:2;">' + Icon("back") + "</button>" + '  <div style="display:flex;gap:18px;padding:24px 24px 24px 90px;">' + '    <div style="width:110px;height:160px;border-radius:12px;overflow:hidden;background:#111827;flex-shrink:0;">' + (show && show.cover ? '<img src="' + show.cover + '" style="width:100%;height:100%;object-fit:cover;" />' : "") + "    </div>" + '    <div style="flex:1;max-width:760px;display:flex;flex-direction:column;gap:6px;">' + '      <span style="align-self:flex-start;background:var(--accent);color:#000;font-size:10px;font-weight:900;letter-spacing:1.4px;padding:4px 10px;border-radius:20px;">SÉRIE</span>' + '      <div style="color:#fff;font-size:22px;font-weight:900;">' + (show ? show.name : "Série") + "</div>" + '      <div id="sd-counts" style="color:#CBD5E1;font-size:13px;font-weight:600;"></div>' + '      <div style="color:#9A9AA5;font-size:12px;">' + (show && show.group || "") + "</div>" +
    // 3 linhas com "..." -- igual SeriesScreen.kt/SeriesDetailScreen
    // (maxLines=3). Só mostra se já carregou (Android também só renderiza
    // quando plot?.plot existe; sem sinopse, Android simplesmente não
    // desenha a linha, não mostra "carregando" nem "indisponível" aqui).
    '      <div id="sd-plot" style="color:#9A9AA5;font-size:13px;line-height:18px;margin-top:4px;display:' + (state.plot && state.plot.plot ? "-webkit-box" : "none") + ';-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;">' + (state.plot && state.plot.plot || "") + "</div>" + "    </div>" + '    <button class="focusable md-fav-btn" id="sd-fav" style="color:' + (isFav ? "#EF4444" : "#fff") + ';font-size:18px;">' + Icon(isFav ? "heart-filled" : "heart-outline") + "</button>" + "  </div>" + '  <div id="sd-seasons" style="display:flex;gap:8px;padding:0 24px;"></div>' + '  <div id="sd-episodes" style="display:flex;flex-direction:column;gap:8px;padding:14px 24px 40px;"></div>' + "</div>";
    if (!document.querySelector("#sd-style")) {
      var style = document.createElement("style");
      style.id = "sd-style";
      // Fundo tingido na cor do tema ao focar -- igual EpisodeRow/SeasonTab
      // do Android (withAlpha(accent,0.22f) na linha, borda accent só no
      // tab quando focado E NÃO ativo). Sem isso, a borda genérica
      // ".focusable.sn-focused" (theme.css) é a ÚNICA pista de foco --
      // perceptível, mas bem mais fraca que o destaque real do Android.
      style.textContent = ".sd-episode-row.sn-focused{background:color-mix(in srgb,var(--accent) 22%,transparent) !important;border-color:var(--accent) !important;}" + "@supports not (background: color-mix(in srgb, red, blue)) { .sd-episode-row.sn-focused{background:rgba(225,29,72,0.22) !important;} }" + ".sd-season-tab.sn-focused:not(.active){border-color:var(--accent) !important;}" +
      // Mesma regra de .md-fav-btn (movieDetail.js) duplicada aqui --
      // esta tela pode montar sem a outra ter montado antes (igual
      // ensureCardStyles() em contentGrid.js/favorites.js), então não dá
      // pra depender do <style> do outro arquivo já existir.
      ".md-fav-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.06);border:2px solid transparent;cursor:pointer;flex-shrink:0;}" + ".md-fav-btn.sn-focused{background:color-mix(in srgb,var(--accent) 35%,transparent) !important;border-color:var(--accent) !important;}" + "@supports not (background: color-mix(in srgb, red, blue)) { .md-fav-btn.sn-focused{background:rgba(225,29,72,0.35) !important;} }";
      document.head.appendChild(style);
    }
    root.querySelector("#sd-back").addEventListener("sn:enter", goBack);
    root.querySelector("#sd-fav").addEventListener("sn:enter", function () {
      if (!show) return;
      var nowFav = SessionStore.toggleFavorite("series", {
        id: show.seriesId,
        name: show.name,
        cover: show.cover
      });
      var btn = root.querySelector("#sd-fav");
      btn.innerHTML = Icon(nowFav ? "heart-filled" : "heart-outline");
      btn.style.color = nowFav ? "#EF4444" : "#fff";
    });
    renderEpisodes(creds);
  }
  function renderEpisodes(creds) {
    var seasonsEl = document.querySelector("#sd-seasons");
    var episodesEl = document.querySelector("#sd-episodes");
    var countsEl = document.querySelector("#sd-counts");
    if (!seasonsEl || !episodesEl) return;
    if (!state.episodes) {
      episodesEl.innerHTML = '<div style="color:var(--accent);">Carregando episódios…</div>';
      return;
    }
    if (!state.episodes.length) {
      episodesEl.innerHTML = '<div style="color:#9A9AA5;">Nenhum episódio encontrado.</div>';
      return;
    }
    if (!state.groups) state.groups = groupEpisodes(state.episodes);
    var bySeason = state.groups.bySeason;
    var seasons = state.groups.seasons;
    if (state.activeSeason === null || seasons.indexOf(state.activeSeason) < 0) state.activeSeason = seasons[0];
    if (countsEl) {
      countsEl.textContent = seasons.length + (seasons.length === 1 ? " temporada · " : " temporadas · ") + state.episodes.length + (state.episodes.length === 1 ? " episódio" : " episódios");
    }
    seasonsEl.innerHTML = "";
    if (seasons.length > 1) {
      seasons.forEach(function (s) {
        var tab = document.createElement("button");
        tab.className = "focusable sd-season-tab" + (s === state.activeSeason ? " active" : "");
        tab.textContent = "Temporada " + s;
        tab.style.cssText = "border-radius:20px;padding:8px 14px;font-size:12px;font-weight:700;border:2px solid transparent;cursor:pointer;" + (s === state.activeSeason ? "background:var(--accent);color:#000;" : "background:rgba(255,255,255,0.05);color:#9A9AA5;");
        tab.setAttribute("data-season", s);
        tab.addEventListener("sn:enter", function () {
          state.activeSeason = s;
          renderEpisodes(creds);
          var sameTab = document.querySelector('[data-season="' + s + '"]');
          if (sameTab) SN.setFocus(sameTab);
        });
        seasonsEl.appendChild(tab);
      });
    }
    var eps = bySeason[state.activeSeason] || [];
    episodesEl.innerHTML = "";
    // Carrega 1 vez só, fora do loop -- mesmo bug de performance real
    // encontrado e corrigido em contentGrid.js (ContinueWatching.
    // getProgress chamava load() de novo a cada episódio, cada load()
    // fazendo localStorage.getItem()+JSON.parse() do zero).
    var cw = ContinueWatching.load();
    eps.forEach(function (ep) {
      var row = buildEpisodeRow(ep, cw);
      playEpisode(ep, row);
      episodesEl.appendChild(row);
    });
  }
  function buildEpisodeRow(ep, cw) {
    var cwEntry = cw.find(function (e) {
      return e.id === ep.episodeId && e.kind === "series";
    });
    var progress = cwEntry && cwEntry.durationSec > 0 ? cwEntry.positionSec / cwEntry.durationSec : 0;
    // Concluído -- episódio terminado some de "em andamento" (ver
    // ContinueWatching.onProgress), então nunca teria barra de progresso;
    // mostra um check no lugar pra deixar claro "já assisti esse" (pedido
    // explícito: marcar visualmente o que já foi concluído).
    var watched = !cwEntry && ContinueWatching.isCompleted(ep.episodeId, "series");
    var row = document.createElement("div");
    row.className = "focusable sd-episode-row";
    row.setAttribute("data-episode-id", ep.episodeId);
    row.style.cssText = "border-radius:12px;padding:12px 14px;background:rgba(255,255,255,0.03);border:3px solid transparent;cursor:pointer;display:flex;flex-direction:column;gap:8px;";
    row.innerHTML = '<div style="display:flex;align-items:center;gap:14px;">' + '<span style="background:var(--accent);color:#000;font-size:11px;font-weight:900;padding:4px 10px;border-radius:8px;flex-shrink:0;">T' + ep.season + " · E" + String(ep.episodeNumber).padStart(2, "0") + "</span>" +
    // maxLines=2 + ellipsis -- igual EpisodeRow do Android, nome de
    // episódio longo não deveria empurrar a linha de tempo/botão.
    '<span style="flex:1;color:#fff;font-size:14px;font-weight:700;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;">' + ep.name + "</span>" + (
    // Texto "Concluído" (não só um ícone) e cor FIXA do Ukano (não
    // var(--accent), que muda com a marca do revendedor) -- mesma
    // paridade aplicada no Roku/Android: selo de status sempre
    // reconhecível, não decorativo.
    watched ? '<span style="background:#E11D48;color:#fff;font-size:11px;font-weight:900;padding:4px 10px;border-radius:50px;flex-shrink:0;">Concluído</span>' : "") + '<span style="color:var(--accent);font-size:18px;">' + Icon("play") + "</span>" + "</div>" + (progress > 0 ? '<div style="height:3px;border-radius:2px;background:rgba(255,255,255,0.15);"><div style="height:3px;border-radius:2px;background:var(--accent);width:' + Math.min(100, progress * 100) + '%;"></div></div>' : "");
    return row;
  }
  function playEpisode(ep, row) {
    row.addEventListener("sn:enter", function () {
      var resumeMs = ContinueWatching.getPositionSec(ep.episodeId, "series") * 1000;
      global.App.play({
        kind: "series",
        id: ep.episodeId,
        title: ep.name,
        poster: ep.cover,
        url: ep.url,
        seriesId: state.show ? state.show.seriesId : (Router.currentParams() || {}).id,
        seriesName: state.show ? state.show.name : null,
        resumePositionMs: resumeMs,
        returnTo: "seriesDetail",
        returnParams: {
          id: (Router.currentParams() || {}).id,
          season: ep.season,
          episodeId: ep.episodeId,
          back: back
        },
        // Lista na ordem da tela: o player acha o próximo episódio nela.
        episodes: state.groups ? state.groups.ordered : null
      });
    });
  }

  // Muda a cada mount/unmount: o catálogo que chega depois de a pessoa sair
  // da tela não desenha nem puxa o foco pra cá.
  var visit = 0;
  function mount(params) {
    back = params && params.back || null;
    var myVisit = ++visit;
    var creds = SessionStore.loadCreds();
    var root = document.querySelector('.screen[data-screen="seriesDetail"] .screen-content');
    root.innerHTML = '<div style="padding:60px;color:var(--accent);">Carregando…</div>';
    state = {
      episodes: null,
      groups: null,
      activeSeason: null,
      show: null,
      plot: null
    };
    // Voltar já vale no carregamento e no aviso de erro (antes só depois
    // de a série aparecer).
    BackNav.bind(goBack);
    if (!creds) return;

    // Série (cabeçalho) ou episódios que não carregaram: aviso com tentar
    // de novo/voltar no lugar do "Carregando…" eterno. Uma vez por visita.
    var failed = false;
    function onCatalogError() {
      if (myVisit !== visit || failed) return;
      failed = true;
      // Aviso pro painel no próximo heartbeat (ver js/data/appReport.js).
      if (global.AppReport) AppReport.recordError("catalog_failed");
      ContentGrid.showLoadError(root, "Não foi possível carregar esta série.", function () {
        mount(params);
      }, goBack);
    }
    function stale() {
      return myVisit !== visit || failed;
    }
    XtreamApi.getSeries(creds).then(function (list) {
      if (stale()) return;
      state.show = list.find(function (s) {
        return s.seriesId === params.id;
      }) || null;
      render(creds);
      if (!focusReturnedEpisode(params)) SN.focusFirst(document.querySelector('.screen[data-screen="seriesDetail"]'));
    }).catch(onCatalogError);
    XtreamApi.loadSeriesDetail(creds, params.id).then(function (detail) {
      if (stale()) return;
      state.episodes = detail.episodes;
      state.groups = groupEpisodes(detail.episodes);
      state.plot = detail.plot;
      // Sinopse chega depois do header já desenhado (render() já rodou,
      // via getSeries() acima) -- atualiza o elemento direto em vez de
      // re-renderizar a tela inteira, mesmo padrão de movieDetail.js com
      // #md-plot/getVodPlot.
      var plotEl = document.querySelector("#sd-plot");
      if (plotEl && detail.plot && detail.plot.plot) {
        plotEl.textContent = detail.plot.plot;
        plotEl.style.display = "-webkit-box";
      }
      // Abrir uma série a partir da categoria "Continuar" (ContentGrid)
      // toca direto o episódio em andamento, em vez de só abrir a lista de
      // temporadas e obrigar escolher de novo -- mesmo pedido/paridade do
      // Android (SeriesScreen.kt/continueEpisodeBySeriesId) e Roku
      // (EpisodesScreen.brs).
      if (params.resumeEpisodeId) {
        var ep = detail.episodes.find(function (e) {
          return e.episodeId === params.resumeEpisodeId;
        });
        if (ep) {
          state.activeSeason = ep.season;
          var resumeMs = ContinueWatching.getPositionSec(ep.episodeId, "series") * 1000;
          // Volta pra série SEM o resumeEpisodeId (e na temporada certa):
          // antes ele ia junto nos parâmetros de volta, e sair do player
          // remontava esta tela, que tocava o episódio de novo -- não dava
          // pra chegar na lista de episódios.
          global.App.play({
            kind: "series",
            id: ep.episodeId,
            title: ep.name,
            poster: ep.cover,
            url: ep.url,
            seriesId: params.id,
            seriesName: state.show ? state.show.name : null,
            resumePositionMs: resumeMs,
            returnTo: "seriesDetail",
            returnParams: {
              id: params.id,
              season: ep.season,
              episodeId: ep.episodeId,
              back: back
            },
            episodes: state.groups.ordered
          });
          return;
        }
      }
      if (params.season != null && detail.episodes.some(function (e) {
        return e.season === params.season;
      })) {
        state.activeSeason = params.season;
      }
      renderEpisodes(creds);
      focusReturnedEpisode(params);
    }).catch(onCatalogError);
  }

  // Voltando do player: foco no episódio que estava tocando (antes ia pra
  // seta de voltar no topo e precisava descer a lista de novo).
  function focusReturnedEpisode(params) {
    if (!params || !params.episodeId) return false;
    var row = document.querySelector('.screen[data-screen="seriesDetail"] [data-episode-id="' + params.episodeId + '"]');
    if (!row) return false;
    SN.setFocus(row);
    return true;
  }
  Router.register("seriesDetail", {
    mount: mount,
    unmount: function unmount() {
      visit++;
    }
  });
})(window);