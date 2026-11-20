/*
 * Porta de tv-app/android/.../ui/common/ContentHeader.kt -- cabeçalho
 * usado em Ao vivo/Filmes/Séries/Favoritos/Suas Listas: voltar + título à
 * esquerda, relógio à direita (atualiza sozinho a cada 10s, igual o
 * Android). Ajustes NÃO usa isso (lá é só um título simples, sem
 * ContentHeader, mesmo no Android original).
 */
(function (global) {
  "use strict";

  var WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  function fmtClock(d) {
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function fmtDate(d) {
    // 1ª letra maiúscula -- mesmo bug/mesma correção já feita em home.js
    // (Clock() do Android sempre capitaliza via replaceFirstChar); esta é
    // uma implementação de relógio SEPARADA (cabeçalho de Ao vivo/Filmes/
    // Séries/Favoritos/Listas, não o da Início), então tinha o mesmo
    // problema duplicado em outro lugar do código.
    var s = WEEKDAYS[d.getDay()] + ", " + String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (!document.querySelector("#content-header-style")) {
    var style = document.createElement("style");
    style.id = "content-header-style";
    style.textContent =
    // Fundo tingido 30% (não sólido) mantendo o ÍCONE SEMPRE BRANCO --
    // igual BackButton do Android (tint=Color.White fixo, só o fundo
    // muda no foco). Antes o fundo ficava SÓLIDO na cor do tema E o
    // ícone virava preto -- duas mudanças que o Android não faz aqui
    // (ele só preenche sólido+texto preto em botões de AÇÃO primária,
    // não neste botão secundário de voltar).
    ".ch-back{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}" +
    // border-width:0 -- cancela a borda genérica de 3px que
    // .focusable.sn-focused (theme.css) desenharia por baixo; o
    // BackButton do Android não tem NENHUMA borda, só o tingimento do
    // fundo acima.
    ".ch-back.sn-focused{background:color-mix(in srgb,var(--accent) 30%,transparent);color:#fff;border-width:0 !important;}" + "@supports not (background: color-mix(in srgb, red, blue)) { .ch-back.sn-focused{background:rgba(225,29,72,0.3);} }" + ".ch-clock-time{color:#fff;font-size:20px;font-weight:700;}" + ".ch-clock-date{color:#8B93A1;font-size:14px;}" +
    // Chip de busca CENTRALIZADO -- igual SearchChip do Android
    // (ContentHeader.kt): fica entre o título e o relógio, não mais um
    // botão solto no canto direito junto do resto. Vira campo de texto
    // só com Enter/OK explícito (aqui, abre o teclado próprio do app) --
    // mesma lógica/mesmo motivo do Android ("só NAVEGAR até o campo com
    // D-pad já abria o teclado sozinho, atrapalhando quem só queria se
    // mover").
    // Aumentado (era min-width:260/max:360/height:40/font:13) -- pedido
    // explícito: "poderia ser maior pra ficar mais bonito".
    ".ch-search{display:flex;align-items:center;gap:10px;min-width:340px;max-width:460px;height:52px;padding:0 18px;border-radius:12px;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.1);color:#8B93A1;font-size:20px;cursor:pointer;flex-shrink:0;}" + ".ch-search .ic{flex-shrink:0;display:flex;font-size:24px;color:#8B93A1;}" + ".ch-search .txt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;}" + ".ch-search.has-query{color:#fff;background:color-mix(in srgb,var(--accent) 18%,transparent);border-color:var(--accent);}" + ".ch-search.has-query .ic,.ch-search.has-query .txt{color:#fff;}" + ".ch-search.sn-focused{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 22%,transparent);}" + "@supports not (background: color-mix(in srgb, red, blue)) { .ch-search.has-query,.ch-search.sn-focused{background:rgba(225,29,72,0.2);} }";
    document.head.appendChild(style);
  }

  // opts: { title, trailingHtml, search: {value, placeholder} (opcional --
  // sem isso, nenhum chip de busca aparece, igual ContentHeader(query=null)
  // do Android pras telas que não precisam, ex. Favoritos) }
  // Devolve o HTML do cabeçalho -- quem chama injeta no topo da tela e
  // depois chama ContentHeaderBar.bind(rootEl, onBack, {onSearchOpen}) pra
  // ligar os eventos (voltar + relógio + busca).
  function html(opts) {
    var searchHtml = "";
    if (opts.search) {
      var q = opts.search.value || "";
      searchHtml = '<button class="focusable ch-search' + (q ? " has-query" : "") + '" id="ch-search" data-placeholder="' + escapeHtml(opts.search.placeholder || "Buscar…") + '">' + '  <span class="ic">' + Icon("search") + "</span>" + '  <span class="txt">' + (q ? escapeHtml(q) : opts.search.placeholder || "Buscar…") + "</span>" + "</button>";
    }
    return '<div class="screen-header" style="padding:20px 40px;">' + '  <div style="display:flex;align-items:center;gap:16px;flex:1;min-width:0;">' + '    <button class="focusable ch-back" id="ch-back">' + Icon("back") + "</button>" + '    <div class="title" style="letter-spacing:normal;text-transform:none;font-size:25.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + opts.title + "</div>" + "  </div>" + searchHtml + '  <div style="display:flex;align-items:center;gap:16px;flex:1;justify-content:flex-end;min-width:0;">' + (opts.trailingHtml || "") + '    <div style="text-align:right;flex-shrink:0;">' + '      <div class="ch-clock-time" id="ch-clock-time"></div>' + '      <div class="ch-clock-date" id="ch-clock-date"></div>' + "    </div>" + "  </div>" + "</div>";
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Atualiza o texto/estado do chip de busca sem re-renderizar o
  // cabeçalho inteiro -- chamado toda vez que a busca muda (mesmo papel do
  // antigo updateSearchLabel() que cada tela duplicava por conta própria).
  function updateSearch(root, value) {
    var btn = root.querySelector("#ch-search");
    if (!btn) return;
    var txt = btn.querySelector(".txt");
    var hasQuery = !!(value && value.trim());
    if (txt) txt.textContent = hasQuery ? value : btn.getAttribute("data-placeholder") || "Buscar…";
    btn.classList.toggle("has-query", hasQuery);
  }
  var timer = null;
  function tick(root) {
    var now = new Date();
    var t = root.querySelector("#ch-clock-time");
    var d = root.querySelector("#ch-clock-date");
    if (t) t.textContent = fmtClock(now);
    if (d) d.textContent = fmtDate(now);
  }

  // Liga o botão voltar NA TELA (clique/OK) E o botão físico Voltar do
  // controle (BackNav, ver backHandler.js) com a MESMA função -- os dois
  // precisam fazer igual, sem isso só um dos dois funcionava. Também
  // inicia o relógio e o chip de busca (se a tela passou opts.search em
  // html()). Chamar DEPOIS de inserir o html() no DOM.
  // extra: { onSearchOpen(currentValue) } -- só usado se a tela tem busca.
  function bind(root, onBack, extra) {
    if (timer) clearInterval(timer);
    var backBtn = root.querySelector("#ch-back");
    if (backBtn) backBtn.addEventListener("sn:enter", onBack);
    var searchBtn = root.querySelector("#ch-search");
    if (searchBtn && extra && extra.onSearchOpen) {
      searchBtn.addEventListener("sn:enter", function () {
        extra.onSearchOpen();
      });
    }
    BackNav.bind(onBack);
    tick(root);
    timer = setInterval(function () {
      tick(root);
    }, 10000);
  }
  function unbind() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
  global.ContentHeaderBar = {
    html: html,
    bind: bind,
    unbind: unbind,
    updateSearch: updateSearch
  };
})(window);