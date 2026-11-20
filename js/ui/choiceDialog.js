/*
 * Diálogo de escolha por controle remoto (título, texto e botões) por cima
 * da tela atual -- porta de ListChoiceDialog.kt e do RemoveOtherListDialog
 * (ListsScreen.kt) do Android. Usado pela pergunta "qual lista usar" (outro
 * revendedor cadastrou este aparelho, ver App.checkListChoice) e pela
 * confirmação de "Remover" em Suas listas. Mesmo padrão do BlockedDialog e
 * do Keyboard: escopo de navegação próprio (data-sn-root, o foco não escapa
 * pra tela de trás) e o Voltar emprestado (BackNav) enquanto está aberto.
 */
(function (global) {
  "use strict";

  var overlay = null;
  var opened = null; // opções do diálogo aberto (null = fechado)
  var triggerEl = null;
  function build() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "choice-overlay";
    overlay.setAttribute("data-sn-root", "");
    // Abaixo do aviso de bloqueio (z-index 60): ele sempre ganha.
    overlay.style.cssText = "position:absolute;top:0;right:0;bottom:0;left:0;z-index:55;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);";
    overlay.innerHTML = '<div id="choice-box" style="width:560px;background:#111318;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:28px;">' + '  <div id="choice-title" style="color:#fff;font-size:26.5px;font-weight:800;line-height:33.5px;"></div>' + '  <div id="choice-msg" style="color:#CBD5E1;font-size:20px;line-height:26.5px;margin-top:10px;white-space:pre-line;"></div>' + '  <div id="choice-buttons" style="margin-top:22px;"></div>' + "</div>";
    document.body.appendChild(overlay);
    if (!document.querySelector("#choice-style")) {
      var style = document.createElement("style");
      style.id = "choice-style";
      style.textContent = ".choice-btn{display:block;width:100%;margin-top:10px;padding:14px 18px;border-radius:10px;border:2px solid transparent;background:#26262E;color:#fff;font-size:20px;font-weight:800;cursor:pointer;}" + ".choice-btn:first-child{margin-top:0;}" + ".choice-btn.accent{background:var(--accent);color:#000;}" + ".choice-btn.sn-focused{border-color:#fff;transform:scale(1.03);}" +
      // Botões lado a lado (confirmação de Remover, igual o Android).
      ".choice-row .choice-btn{display:inline-block;width:auto;margin:0 10px 0 0;padding:12px 24px;}";
      document.head.appendChild(style);
    }
    return overlay;
  }

  // opts: { title, message, buttons: [{ label, accent, onSelect }],
  //         focus: índice do botão com o foco ao abrir,
  //         back: índice do botão que o Voltar aciona,
  //         row: botões lado a lado (senão um embaixo do outro) }
  function show(opts) {
    build();
    if (opened) close();
    opened = opts;
    triggerEl = SN.current();
    overlay.querySelector("#choice-box").style.textAlign = opts.row ? "left" : "center";
    overlay.querySelector("#choice-title").textContent = opts.title || "";
    overlay.querySelector("#choice-msg").textContent = opts.message || "";
    var wrap = overlay.querySelector("#choice-buttons");
    wrap.className = opts.row ? "choice-row" : "";
    wrap.innerHTML = "";
    var focusEl = null;
    (opts.buttons || []).forEach(function (b, i) {
      var btn = document.createElement("button");
      btn.className = "focusable choice-btn" + (b.accent ? " accent" : "");
      // textContent: nome de revendedor vem do painel, não vira HTML.
      btn.textContent = b.label;
      btn.addEventListener("sn:enter", function () {
        choose(i);
      });
      wrap.appendChild(btn);
      if (i === (opts.focus || 0)) focusEl = btn;
    });
    overlay.style.display = "flex";
    // push (não bind): Voltar responde o diálogo e, ao fechar, o da tela de
    // baixo volta sozinho.
    BackNav.push(onBack);
    SN.clear();
    if (focusEl) SN.setFocus(focusEl);else SN.focusFirst(overlay);
  }
  function choose(i) {
    var opts = opened;
    if (!opts) return;
    close();
    var b = opts.buttons[i];
    if (b && b.onSelect) b.onSelect();
  }
  function onBack() {
    if (opened) choose(opened.back != null ? opened.back : 0);
  }

  // Fecha sem responder nada (ex.: a tela mudou por trás, aviso de
  // bloqueio). O foco só volta pra tela se ainda estava no diálogo -- se a
  // tela de trás já trocou e pôs o foco dela, fica onde está.
  function close() {
    if (!opened) return;
    opened = null;
    overlay.style.display = "none";
    BackNav.remove(onBack);
    var cur = SN.current();
    if (!cur || overlay.contains(cur)) {
      SN.clear();
      var activeScreen = document.querySelector(".screen.active");
      if (triggerEl && activeScreen && activeScreen.contains(triggerEl)) SN.setFocus(triggerEl);else if (activeScreen) SN.focusFirst(activeScreen);
    }
    triggerEl = null;
    overlay.querySelector("#choice-buttons").innerHTML = "";
  }
  global.ChoiceDialog = {
    show: show,
    close: close,
    isOpen: function isOpen() {
      return !!opened;
    }
  };
})(window);