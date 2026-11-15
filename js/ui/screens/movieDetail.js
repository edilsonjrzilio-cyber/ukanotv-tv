/* Porta de tv-app/android/.../ui/movies/MovieDetailScreen.kt. */
(function (global) {
  "use strict";

  // Compilados uma vez só -- mesmo padrão aplicado em contentGrid.js/
  // live.js nesta sessão (ver nota lá: Android media ~40s recompilando
  // regex por item num catálogo grande; aqui é só 1 item por tela, mas
  // consistência com o resto do app).
  var DIACRITICS_RX = /(?:[\u0300-\u036F\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7-\u05C9\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B53-\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ABD\u1ABF-\u1AF0\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA82C\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]|\uD800[\uDDFD\uDEE0\uDF76-\uDF7A]|\uD802[\uDE01-\uDE03\uDE05\uDE06\uDE0C-\uDE0F\uDE38-\uDE3A\uDE3F\uDEE5\uDEE6]|\uD803[\uDD24-\uDD27\uDD69-\uDD6D\uDEAB\uDEAC\uDECB-\uDECF\uDEF0-\uDEFF\uDF46-\uDF50\uDF82-\uDF85]|\uD804[\uDC01\uDC38-\uDC46\uDC70\uDC73\uDC74\uDC7F-\uDC81\uDCB3-\uDCB6\uDCB9\uDCBA\uDCC2\uDD00-\uDD02\uDD27-\uDD2B\uDD2D-\uDD34\uDD73\uDD80\uDD81\uDDB6-\uDDBE\uDDC9-\uDDCC\uDDCF\uDE2F-\uDE31\uDE34\uDE36\uDE37\uDE3E\uDE41\uDEDF\uDEE3-\uDEEA\uDF00\uDF01\uDF3B\uDF3C\uDF40\uDF66-\uDF6C\uDF70-\uDF74\uDFBB-\uDFC0\uDFCE\uDFD0\uDFD2\uDFE1\uDFE2]|\uD805[\uDC38-\uDC3F\uDC42-\uDC44\uDC46\uDC5E\uDCB3-\uDCB8\uDCBA\uDCBF\uDCC0\uDCC2\uDCC3\uDDB2-\uDDB5\uDDBC\uDDBD\uDDBF\uDDC0\uDDDC\uDDDD\uDE33-\uDE3A\uDE3D\uDE3F\uDE40\uDEAB\uDEAD\uDEB0-\uDEB5\uDEB7\uDF1D\uDF1F\uDF22-\uDF25\uDF27-\uDF2B]|\uD806[\uDC2F-\uDC37\uDC39\uDC3A\uDD3B\uDD3C\uDD3E\uDD43\uDDD4-\uDDD7\uDDDA\uDDDB\uDDE0\uDE01-\uDE0A\uDE33-\uDE38\uDE3B-\uDE3E\uDE47\uDE51-\uDE56\uDE59-\uDE5B\uDE8A-\uDE96\uDE98\uDE99\uDF60\uDF62-\uDF64\uDF66]|\uD807[\uDC30-\uDC36\uDC38-\uDC3D\uDC3F\uDC92-\uDCA7\uDCAA-\uDCB0\uDCB2\uDCB3\uDCB5\uDCB6\uDD31-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD45\uDD47\uDD90\uDD91\uDD95\uDD97\uDDF0\uDEF3\uDEF4\uDF00\uDF01\uDF36-\uDF3A\uDF40\uDF42\uDF5A]|\uD80D[\uDC40\uDC47-\uDC55]|\uD818[\uDD1E-\uDD29\uDD2D-\uDD2F]|\uD81A[\uDEF0-\uDEF4\uDF30-\uDF36]|\uD81B[\uDF4F\uDF8F-\uDF92\uDFE4]|\uD82F[\uDC9D\uDC9E]|\uD833[\uDF00-\uDF2D\uDF30-\uDF46]|\uD834[\uDD27\uDD28\uDD67-\uDD69\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44\uDE5B\uDE5C]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A\uDC8F\uDD30-\uDD36\uDEAE\uDEEC-\uDEEF]|\uD839[\uDCEC-\uDCEF\uDDEE\uDDEF\uDEE3\uDEE6\uDEEE\uDEEF\uDEF5]|\uD83A[\uDCD0-\uDCD6\uDD44-\uDD4A]|\uDB40[\uDD00-\uDDEF])+/g;
  var TAG_4K_RX = /\b4k|uhd\b/;
  var TAG_HDR_RX = /\bhdr\b/;
  var TAG_LEG_RX = /\bleg(?:endado)?\b/;
  function detectQualityTags(name) {
    var n = (name || "").normalize("NFD").replace(DIACRITICS_RX, "").toLowerCase();
    var tags = [];
    if (TAG_4K_RX.test(n)) tags.push("4K");
    if (TAG_HDR_RX.test(n)) tags.push("HDR");
    if (TAG_LEG_RX.test(n)) tags.push("LEG");
    return tags;
  }
  function render(item, creds) {
    var root = document.querySelector('.screen[data-screen="movieDetail"] .screen-content');
    var favs = SessionStore.getFavorites().movie || [];
    var isFav = favs.indexOf(item.streamId) >= 0;
    var resumePositionMs = ContinueWatching.getPositionSec(item.streamId, "movie") * 1000;
    var tagsHtml = detectQualityTags(item.name).map(function (t) {
      return '<span style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:4px 10px;color:#fff;font-size:10px;font-weight:900;">' + t + "</span>";
    }).join("");
    root.innerHTML =
    // overflow-y:auto + data-sn-scroll -- faltava rolagem aqui (comparado
    // com seriesDetail.js, que já tinha). Sinopse/elenco/direção de filme
    // real às vezes é longo, cortava sem nenhum jeito de ver o resto
    // (bug real encontrado no pente fino).
    '<div style="display:flex;min-height:100%;background:#050506;padding:32px;gap:28px;overflow-y:auto;" data-sn-scroll>' + '  <div style="width:260px;height:390px;border-radius:12px;overflow:hidden;background:#111827;flex-shrink:0;">' + (item.streamIcon ? '<img src="' + item.streamIcon + '" style="width:100%;height:100%;object-fit:cover;" />' : "") + "  </div>" + '  <div style="max-width:760px;display:flex;flex-direction:column;gap:10px;">' + '    <div style="display:flex;gap:6px;align-items:center;">' + '      <span style="background:var(--accent);color:#000;font-size:10px;font-weight:900;letter-spacing:1.4px;padding:4px 10px;border-radius:20px;">FILME</span>' + tagsHtml + "    </div>" + '    <div style="display:flex;gap:10px;align-items:flex-start;">' + '      <div style="flex:1;color:#fff;font-size:24px;font-weight:900;">' + item.name + "</div>" + '      <button class="focusable md-fav-btn" id="md-fav" style="color:' + (isFav ? "#EF4444" : "#fff") + ';font-size:18px;">' + Icon(isFav ? "heart-filled" : "heart-outline") + "</button>" + "    </div>" + '    <button class="focusable" id="md-play" data-sn-autofocus style="align-self:flex-start;display:flex;align-items:center;gap:8px;background:var(--accent);color:#000;border:none;padding:14px 22px;border-radius:12px;font-size:15px;font-weight:900;cursor:pointer;margin-top:4px;">' + Icon("play") + " " + (resumePositionMs > 0 ? "Continuar assistindo" : "Assistir") + "</button>" + '    <div id="md-meta" style="color:#CBD5E1;font-size:13px;font-weight:600;"></div>' + '    <div style="color:#9A9AA5;font-size:12px;">' + (item.group || "") + "</div>" +
    // 4 linhas com "..." (não texto livre) -- igual MovieDetailScreen.kt
    // (maxLines=4, mesmo motivo do comentário lá: sinopse longa demais
    // empurrava o botão de assistir pra fora da área visível). -webkit-
    // line-clamp é suportado desde sempre nos engines WebKit/Chromium
    // que o webOS usa (apesar do prefixo, não é experimental há anos).
    '    <div id="md-plot" style="color:#D0D0D6;font-size:14px;line-height:20px;margin-top:4px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden;">Carregando sinopse…</div>' + '    <div id="md-cast" style="color:#9A9AA5;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;"></div>' + '    <div id="md-director" style="color:#9A9AA5;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>' + "  </div>" +
    // position:fixed (não absolute) -- agora que o container rola
    // (overflow-y:auto acima), um botão absolute ia rolar junto com o
    // conteúdo e sumir da tela. fixed trava na viewport sempre, igual
    // seriesDetail.js/#sd-back já fazia (mesmo padrão, zIndex por cima
    // do conteúdo rolado).
    '  <button class="focusable" id="md-back" style="position:fixed;top:28px;left:28px;background:rgba(255,255,255,0.08);border:none;color:#fff;font-size:20px;width:44px;height:44px;border-radius:50%;cursor:pointer;z-index:2;">' + Icon("back") + "</button>" + "</div>";
    if (!document.querySelector("#md-style")) {
      var style = document.createElement("style");
      style.id = "md-style";
      // Tingido 35% (não sólido) no foco -- igual FavoriteButton do
      // Android (bg 0x0FFFFFFF parado / withAlpha(accent,0.35f)+borda 2px
      // focado); antes esse botão não tinha estilo de foco PRÓPRIO
      // nenhum, só herdava o anel genérico de 3px sem nenhuma mudança de
      // fundo (foco quase imperceptível num botão tão pequeno).
      style.textContent = ".md-fav-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.06);border:2px solid transparent;cursor:pointer;flex-shrink:0;}" + ".md-fav-btn.sn-focused{background:color-mix(in srgb,var(--accent) 35%,transparent) !important;border-color:var(--accent) !important;}" + "@supports not (background: color-mix(in srgb, red, blue)) { .md-fav-btn.sn-focused{background:rgba(225,29,72,0.35) !important;} }";
      document.head.appendChild(style);
    }
    root.querySelector("#md-back").addEventListener("sn:enter", goBack);
    root.querySelector("#md-fav").addEventListener("sn:enter", function () {
      var nowFav = SessionStore.toggleFavorite("movie", {
        id: item.streamId,
        name: item.name,
        cover: item.streamIcon,
        url: XtreamApi.playableVodUrl(creds, item)
      });
      var btn = root.querySelector("#md-fav");
      btn.innerHTML = Icon(nowFav ? "heart-filled" : "heart-outline");
      btn.style.color = nowFav ? "#EF4444" : "#fff";
    });
    root.querySelector("#md-play").addEventListener("sn:enter", function () {
      global.App.play({
        kind: "movie",
        id: item.streamId,
        title: item.name,
        poster: item.streamIcon,
        url: XtreamApi.playableVodUrl(creds, item),
        resumePositionMs: resumePositionMs
      });
    });
    XtreamApi.getVodPlot(creds, item.streamId).then(function (plot) {
      var metaParts = [];
      if (plot && plot.genre) metaParts.push(plot.genre);
      if (plot && plot.releaseDate) metaParts.push(plot.releaseDate);
      root.querySelector("#md-meta").textContent = metaParts.join(" · ");
      root.querySelector("#md-plot").textContent = plot && plot.plot || "Sinopse não disponível.";
      if (plot && plot.cast) root.querySelector("#md-cast").textContent = "Elenco: " + plot.cast;
      if (plot && plot.director) root.querySelector("#md-director").textContent = "Direção: " + plot.director;
    });
  }

  // Volta pra onde o filme foi aberto (params.back, ver contentGrid.js),
  // na mesma categoria e com o foco no filme. O player volta pra cá com
  // os mesmos params (App.play usa Router.currentParams()), então o
  // caminho de volta sobrevive a assistir.
  var back = null;
  function goBack() {
    Router.go(back ? back.screen : "movies", back ? back.params : undefined);
  }
  function mount(params) {
    back = params && params.back || null;
    var creds = SessionStore.loadCreds();
    var root = document.querySelector('.screen[data-screen="movieDetail"] .screen-content');
    root.innerHTML = '<div style="padding:60px;color:var(--accent);">Carregando…</div>';
    if (!creds) return;
    XtreamApi.getVod(creds).then(function (list) {
      var item = list.find(function (it) {
        return it.streamId === params.id;
      });
      if (!item) {
        root.innerHTML = '<div style="padding:60px;color:#9A9AA5;">Filme não encontrado.</div>';
        return;
      }
      render(item, creds);
      SN.focusFirst(document.querySelector('.screen[data-screen="movieDetail"]'));
      BackNav.bind(goBack);
    });
  }
  Router.register("movieDetail", {
    mount: mount,
    unmount: function unmount() {}
  });
})(window);