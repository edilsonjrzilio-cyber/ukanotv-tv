/*
 * Motor de navegação espacial compacto, próprio -- substitui o foco nativo
 * do Compose (TvFocus.kt) / `focusable=true` da Roku (XML). Web não tem
 * isso de graça: o Controle Remoto da LG manda setas (37/38/39/40), OK
 * (13) e Voltar (461, código "mágico" da LG -- 8/Backspace no Simulador)
 * como keydown comuns, e cabe a nós mover o foco entre `.focusable`
 * visíveis calculando geometria (mesmo algoritmo usado por engines de TV:
 * filtra candidatos na direção pressionada, pontua por distância no eixo
 * principal + desalinhamento no eixo perpendicular, escolhe o menor).
 */
(function (global) {
  "use strict";

  var _current = null;
  var enabled = true;
  function rectOf(el) {
    return el.getBoundingClientRect();
  }
  function visible(el) {
    if (!el) return false;
    // offsetParent (não usado mais aqui) volta null pra QUALQUER elemento
    // position:fixed -- quirk real do DOM, nada a ver com "escondido"
    // (MDN: "Returns null... if the element has position: fixed"). Bug
    // real encontrado ao vivo: os botões Voltar de Filme/Série detalhe são
    // position:fixed (pra ficarem fixos durante a rolagem, ver
    // movieDetail.js/#md-back e seriesDetail.js/#sd-back) -- com foco
    // neles, visible() sempre voltava false mesmo com o botão bem ali na
    // tela, e move() tratava isso como "foco sumiu", reiniciando a busca
    // do zero (focusFirst) em vez de mover na direção pedida -- parecia
    // travado ou pulava direto pro primeiro item da tela (episódio),
    // nunca alcançando a aba de temporada no meio do caminho. display:none
    // (motivo de verdade pra excluir um elemento) já derruba width/height
    // pra 0 sozinho, então só o retângulo já basta.
    var r = rectOf(el);
    return r.width > 0 && r.height > 0;
  }
  function candidates(root) {
    var scope = root || document;
    return Array.prototype.filter.call(scope.querySelectorAll(".focusable"), function (el) {
      return visible(el) && !el.hasAttribute("disabled");
    });
  }

  // direction: "up" | "down" | "left" | "right"
  function bestCandidate(from, direction, root) {
    var fromRect = rectOf(from);
    var fromCx = fromRect.left + fromRect.width / 2;
    var fromCy = fromRect.top + fromRect.height / 2;
    var best = null;
    var bestScore = Infinity;
    candidates(root).forEach(function (el) {
      if (el === from) return;
      var r = rectOf(el);
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = cx - fromCx;
      var dy = cy - fromCy;
      var primary, perpendicular;
      if (direction === "right") {
        if (dx <= 1) return;
        primary = dx;
        perpendicular = Math.abs(dy);
      } else if (direction === "left") {
        if (dx >= -1) return;
        primary = -dx;
        perpendicular = Math.abs(dy);
      } else if (direction === "down") {
        if (dy <= 1) return;
        primary = dy;
        perpendicular = Math.abs(dx);
      } else if (direction === "up") {
        if (dy >= -1) return;
        primary = -dy;
        perpendicular = Math.abs(dx);
      } else return;

      // Desalinhamento pesa mais que distância pura -- sem isso, uma
      // fileira vizinha bem mais perto (mas desalinhada) ganhava de um
      // item na mesma fileira/coluna lógica, movimento parecia "errado".
      var score = primary + perpendicular * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return best;
  }
  function setFocus(el, opts) {
    if (!el || el === _current) {
      if (el) scrollIntoViewIfNeeded(el);
      return;
    }
    if (_current) _current.classList.remove("sn-focused");
    _current = el;
    el.classList.add("sn-focused");
    try {
      el.focus({
        preventScroll: true
      });
    } catch (e) {}
    scrollIntoViewIfNeeded(el);
    if (!(opts && opts.silent)) {
      el.dispatchEvent(new CustomEvent("sn:focus", {
        bubbles: true
      }));
    }
  }
  function scrollIntoViewIfNeeded(el) {
    var container = el.closest("[data-sn-scroll]");
    if (!container) return;
    var cr = container.getBoundingClientRect();
    var er = el.getBoundingClientRect();
    if (er.left < cr.left) container.scrollLeft -= cr.left - er.left + 24;else if (er.right > cr.right) container.scrollLeft += er.right - cr.right + 24;
    if (er.top < cr.top) container.scrollTop -= cr.top - er.top + 24;else if (er.bottom > cr.bottom) container.scrollTop += er.bottom - cr.bottom + 24;
  }
  function move(direction) {
    if (!enabled) return false;
    var root = _current ? _current.closest("[data-sn-root]") || document : document;
    var from = _current && visible(_current) ? _current : null;
    if (!from) {
      focusFirst(root);
      return true;
    }
    var next = bestCandidate(from, direction, root);
    if (next) setFocus(next);
    return !!next;
  }
  function focusFirst(root) {
    var list = candidates(root);
    var auto = list.find(function (el) {
      return el.hasAttribute("data-sn-autofocus");
    });
    setFocus(auto || list[0] || null);
  }

  // "sn:enter" é o ÚNICO caminho de ativação no app inteiro (sem mouse/
  // toque de verdade numa TV) -- NÃO chama target.click() aqui: um
  // <button> real com listener em "click" (ex.: Keyboard.key()) disparava
  // duas vezes pro mesmo toque de OK (bug real encontrado na auditoria).
  function activate(el) {
    var target = el || _current;
    if (!target) return;
    target.dispatchEvent(new CustomEvent("sn:enter", {
      bubbles: true
    }));
  }

  // Mapa de teclas do controle remoto webOS (e teclado, pro Simulador):
  // setas 37-40, OK/Enter 13, Voltar 461 (LG) / 10009 (alguns firmwares
  // antigos) / 8 Backspace (teclado do Simulador). Códigos dos botões
  // coloridos (Vermelho/Verde/Amarelo/Azul) são padrão do controle remoto
  // webOS/LG (incluindo o Magic Remote).
  var KEY = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACK_LG: 461,
    BACK_LG2: 10009,
    BACKSPACE: 8,
    RED: 403,
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406
  };

  // Segurar OK = favoritar nos cards de grade (MediaCard.kt usa
  // combinedClickable onLongClick) -- sem equivalente nativo de "long
  // press" num keydown de controle remoto. Usa um setTimeout de verdade
  // disparado no PRIMEIRO keydown, não contagem de keydowns repetidos:
  // nada garante que todo controle/firmware webOS repita o evento keydown
  // do SO enquanto a tecla fica pressionada (diferente de um teclado) --
  // contar repetições deixaria o favoritar não funcionando em controles
  // que só mandam 1 keydown + 1 keyup por toque, segurado ou não. Com
  // timer, funciona em qualquer um dos dois comportamentos.
  var LONG_PRESS_MS = 500;
  var enterIsDown = false;
  var longPressFired = false;
  var longPressTimer = null;

  // Ponto de extensão pro Player (seek direto nas setas ESQUERDA/DIREITA,
  // igual PlayerScreen.kt do Android/onKeyEvent) -- normalmente toda seta
  // move o FOCO entre .focusable (comportamento certo pro resto do app
  // inteiro), mas numa tela de vídeo faz mais sentido ESQUERDA/DIREITA
  // avançar/voltar na reprodução direto, sem precisar primeiro navegar até
  // um botão. Recebe o keydown cru; devolvendo true consome o evento e
  // pula o move()/ação normal de SN por baixo. Só 1 por vez (não pilha,
  // igual BackNav) -- só o Player usa isso hoje.
  var keyInterceptor = null;
  function onKeyDown(e) {
    if (!enabled) return;
    if (keyInterceptor && keyInterceptor(e)) {
      e.preventDefault();
      return;
    }
    switch (e.keyCode) {
      case KEY.LEFT:
        move("left");
        e.preventDefault();
        break;
      case KEY.RIGHT:
        move("right");
        e.preventDefault();
        break;
      case KEY.UP:
        move("up");
        e.preventDefault();
        break;
      case KEY.DOWN:
        move("down");
        e.preventDefault();
        break;
      case KEY.ENTER:
        if (!enterIsDown) {
          enterIsDown = true;
          longPressFired = false;
          var target = _current;
          longPressTimer = setTimeout(function () {
            longPressFired = true;
            if (target) target.dispatchEvent(new CustomEvent("sn:longpress", {
              bubbles: true
            }));
          }, LONG_PRESS_MS);
        }
        e.preventDefault();
        break;
      case KEY.BACK_LG:
      case KEY.BACK_LG2:
      case KEY.BACKSPACE:
        document.dispatchEvent(new CustomEvent("sn:back"));
        e.preventDefault();
        break;
      // Amarelo = favoritar, alternativa a segurar OK -- pedido explícito
      // (paridade com o asterisco do controle Roku, EpisodesScreen.brs/
      // ChannelRowItem.xml usam onKeyEvent("*") direto, sem depender de
      // duração de toque nenhuma). Segurar OK continua funcionando (não foi
      // removido), mas em controles/firmwares onde o keydown de OK não se
      // comporta do jeito esperado (ou a pessoa solta um pouco antes do
      // meio-segundo), isso dá um jeito 100% confiável e instantâneo de
      // fazer a MESMA ação -- dispara o mesmo evento "sn:longpress" que
      // segurar OK já dispara, reaproveitando toda a lógica de
      // favoritar/desfavoritar já existente em cada tela, sem duplicar
      // nada.
      case KEY.YELLOW:
        if (_current) _current.dispatchEvent(new CustomEvent("sn:longpress", {
          bubbles: true
        }));
        e.preventDefault();
        break;
    }
  }
  function onKeyUp(e) {
    if (e.keyCode === KEY.ENTER) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (enterIsDown && !longPressFired) activate();
      enterIsDown = false;
      longPressFired = false;
    }
  }
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);
  global.SN = {
    setFocus: setFocus,
    move: move,
    activate: activate,
    focusFirst: focusFirst,
    current: function current() {
      return _current;
    },
    setEnabled: function setEnabled(v) {
      enabled = v;
    },
    clear: function clear() {
      if (_current) _current.classList.remove("sn-focused");
      _current = null;
    },
    setKeyInterceptor: function setKeyInterceptor(fn) {
      keyInterceptor = fn;
    },
    clearKeyInterceptor: function clearKeyInterceptor() {
      keyInterceptor = null;
    }
  };
})(window);