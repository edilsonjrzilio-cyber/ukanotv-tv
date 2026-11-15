/*
 * Teclado virtual em tela cheia, navegável por D-pad -- equivalente ao
 * KeyboardEntryScreen.brs/xml da Roku (controle remoto de TV não tem
 * teclado físico de verdade; o Simulador webOS tem, mas o controle/Magic
 * Remote real não). Chamado via Keyboard.open({...}), devolve o texto
 * digitado por Promise.
 */
(function (global) {
  "use strict";

  // Teclado nativo da Roku (roSGNode "Keyboard") já vem com símbolos de
  // graça; o meu, feito do zero pro webOS, precisava dessa linha extra --
  // sem ela não dava pra digitar usuário/senha/nome de lista com ponto,
  // arroba, traço etc. (comum em credenciais de provedor Xtream).
  // zxcv + símbolos juntos numa fileira só -- pedido explícito: tava alto
  // demais (6 fileiras), largar o painel um pouco mais pra caber e ganhar
  // uma fileira de altura a menos. Cada fileira é uma lista de GRUPOS (não
  // só uma string) pra poder abrir um respiro visual entre letras e
  // símbolos nessa última -- juntos sem separação nenhuma ficava uma
  // sequência só, confusa (bug de organização apontado depois de testar).
  var ROWS_LETTERS = [["1234567890"], ["qwertyuiop"], ["asdfghjkl"], ["zxcvbnm", ".@-_:/"]];
  var overlay = null;
  var resolveFn = null;
  var currentValue = "";
  var shiftOn = false;
  var triggerEl = null;
  function build() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "kb-overlay";
    overlay.setAttribute("data-sn-root", "");
    overlay.style.cssText = "position:absolute;top:0;right:0;bottom:0;left:0;z-index:50;display:none;" + "background:rgba(2,2,4,0.88);align-items:center;justify-content:center;";

    // Largura calculada pro conteúdo de verdade -- a fileira mais larga é
    // a de zxcv+símbolos junta (13 teclas de 48px + divisor + vãos =
    // ~737px) depois de juntar duas fileiras numa só pra ganhar uma
    // fileira de altura a menos (pedido explícito: "tem 6 [fileiras], dá
    // pra deixar uns 4" -- alargar o painel pra caber, baixar a altura).
    overlay.innerHTML = '<div style="width:800px;background:linear-gradient(165deg,#12141c,#0A0A0C);border:1px solid rgba(255,255,255,0.08);' + 'border-radius:22px;padding:22px 26px;box-shadow:0 40px 100px rgba(0,0,0,0.6);">' + '  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' + '    <span style="color:var(--accent);font-size:13px;display:flex;">' + Icon("keyboard") + "</span>" + '    <div id="kb-label" style="color:#CBD5E1;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:2px;"></div>' + "  </div>" + '  <div id="kb-preview" style="min-height:44px;display:flex;align-items:center;background:rgba(255,255,255,0.045);' + 'border:2px solid var(--accent);border-radius:12px;padding:0 16px;color:#fff;font-size:18px;font-weight:700;' + 'margin-bottom:16px;overflow:hidden;white-space:nowrap;box-shadow:inset 0 2px 8px rgba(0,0,0,0.25);"></div>' +
    // Sem align-items:center -- pedido explícito: "tem que ser tudo
    // alinhado/retinho". Cada fileira vira full-width (stretch, padrão
    // de flex-direction:column) e cada tecla dela usa flex:1 (ver
    // key()), preenchendo a largura toda de forma proporcional -- é
    // assim que teclado de celular de verdade alinha fileiras com
    // número diferente de teclas nas MESMAS bordas esquerda/direita,
    // em vez de cada uma ficar um tamanho natural diferente.
    '  <div id="kb-rows" style="display:flex;flex-direction:column;gap:7px;"></div>' + '  <div id="kb-actions" style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;"></div>' + "</div>";
    document.body.appendChild(overlay);
    if (!document.querySelector("#kb-style")) {
      var style = document.createElement("style");
      style.id = "kb-style";
      style.textContent =
      // Keycap com leve degradê + sombra (profundidade de tecla de
      // verdade, não só um retângulo liso) -- pedido explícito: deixar
      // mais bonito depois de corrigir o foco. scale(1.08) no foco
      // (mesmo gesto tátil do MediaCard.kt em Filmes/Séries) -- antes só
      // a borda mudava, sem nenhum "chá" de profundidade.
      // flex:1 -- cada tecla estica pra dividir a largura toda da
      // fileira igualmente (não um tamanho fixo), é isso que faz
      // fileiras com número diferente de teclas (10/10/9/13) começarem
      // e terminarem exatamente na mesma borda esquerda/direita.
      ".kb-key{flex:1 1 0;height:48px;padding:0 6px;border-radius:10px;display:flex;align-items:center;justify-content:center;" + "background:linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03));" + "color:#F1F5F9;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,0.3);" + "transition:transform 120ms ease,border-color 120ms ease,background 120ms ease;}" + ".kb-key.sn-focused{transform:scale(1.1);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 35%,transparent),color-mix(in srgb,var(--accent) 15%,transparent));}" +
      // Fallback sem color-mix() pra TVs mais antigas (ver nota de
      // compatibilidade no resto do app) -- cor fixa em vez de
      // derivada do accent, perde só a tonalidade exata do tema.
      "@supports not (background: color-mix(in srgb, red, blue)) { .kb-key.sn-focused{background:rgba(225,29,72,0.28);} }" + ".kb-key-special{background:linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015));color:#9AA2B1;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;}" + ".kb-key-special svg{width:15px;height:15px;}" + ".kb-action{height:40px;padding:0 18px;border-radius:20px;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;}" + ".kb-action-cancel{background:transparent;color:#9AA2B1;}" + ".kb-action-cancel.sn-focused{color:#fff;}" + ".kb-action-confirm{background:linear-gradient(135deg,var(--accent),var(--accent-soft));color:#000;}" + ".kb-action-confirm.sn-focused{transform:scale(1.05);}";
      document.head.appendChild(style);
    }
    return overlay;
  }
  function key(label, value, extraClass) {
    var el = document.createElement("button");
    el.className = "focusable kb-key" + (extraClass ? " " + extraClass : "");
    el.innerHTML = label;
    el.addEventListener("sn:enter", function () {
      onKeyPress(value);
    });
    el.addEventListener("click", function () {
      onKeyPress(value);
    });
    return el;
  }
  function onKeyPress(value) {
    if (value === "__BACK__") {
      currentValue = currentValue.slice(0, -1);
    } else if (value === "__SPACE__") {
      currentValue += " ";
    } else if (value === "__SHIFT__") {
      shiftOn = !shiftOn;
      renderRows();
      return;
    } else if (value === "__CLEAR__") {
      currentValue = "";
    } else if (value === "__DONE__") {
      close(currentValue);
      return;
    } else if (value === "__CANCEL__") {
      close(null);
      return;
    } else {
      currentValue += shiftOn ? value.toUpperCase() : value;
    }
    updatePreview();
  }
  function updatePreview() {
    var preview = overlay.querySelector("#kb-preview");
    preview.textContent = currentValue || " ";
  }
  function renderRows() {
    var rowsEl = overlay.querySelector("#kb-rows");
    rowsEl.innerHTML = "";
    ROWS_LETTERS.forEach(function (groups) {
      var rowEl = document.createElement("div");
      rowEl.style.cssText = "display:flex;gap:8px;align-items:center;";
      groups.forEach(function (group, gi) {
        if (gi > 0) {
          // Respiro visual entre grupos (ex.: letras | símbolos) dentro da
          // mesma fileira -- sem isso virava uma sequência só, sem
          // separação nenhuma entre "...bnm" e "...@-_:/".
          var divider = document.createElement("div");
          divider.style.cssText = "flex:0 0 auto;width:1px;align-self:stretch;background:rgba(255,255,255,0.1);margin:0 4px;";
          rowEl.appendChild(divider);
        }
        group.split("").forEach(function (ch) {
          rowEl.appendChild(key(shiftOn ? ch.toUpperCase() : ch, ch));
        });
      });
      rowsEl.appendChild(rowEl);
    });
    var lastRow = document.createElement("div");
    lastRow.style.cssText = "display:flex;gap:8px;";
    lastRow.appendChild(key(shiftOn ? "ABC" : "abc", "__SHIFT__", "kb-key-special"));
    var space = key("espaço", "__SPACE__", "kb-key-special");
    space.style.minWidth = "320px";
    lastRow.appendChild(space);
    lastRow.appendChild(key(Icon("backspace"), "__BACK__", "kb-key-special"));
    lastRow.appendChild(key("limpar", "__CLEAR__", "kb-key-special"));
    rowsEl.appendChild(lastRow);
  }
  function renderActions() {
    var actions = overlay.querySelector("#kb-actions");
    actions.innerHTML = "";
    var cancel = key(Icon("close") + "<span>Cancelar</span>", "__CANCEL__");
    cancel.className = "focusable kb-action kb-action-cancel";
    var done = key(Icon("check") + "<span>Confirmar</span>", "__DONE__");
    done.className = "focusable kb-action kb-action-confirm";
    actions.appendChild(cancel);
    actions.appendChild(done);
  }
  function close(result) {
    overlay.style.display = "none";
    SN.setEnabled(true);
    BackNav.pop();
    // Bug real: o teclado tem o próprio escopo de navegação (data-sn-root).
    // Sem isso, SN.current() ficava apontando pra uma tecla que acabou de
    // sumir (display:none) -- move() então procurava a PRÓXIMA tecla ainda
    // dentro desse mesmo escopo agora oculto/vazio, achava nada, e travava
    // pra sempre (controle remoto parava de responder depois de fechar
    // qualquer teclado). Limpa o foco e devolve pra tela ativa de baixo.
    SN.clear();
    // Volta pro campo que abriu o teclado (ex.: fechou editando "Senha" ->
    // foco continua em "Senha", não pula pro primeiro campo da tela).
    // offsetParent checa se ainda está visível/na tela (ex.: não mudou de
    // tela enquanto o teclado tava aberto) antes de tentar focar nele.
    var activeScreen = document.querySelector(".screen.active");
    if (triggerEl && triggerEl.offsetParent && activeScreen && activeScreen.contains(triggerEl)) {
      SN.setFocus(triggerEl);
    } else if (activeScreen) {
      SN.focusFirst(activeScreen);
    }
    triggerEl = null;
    if (resolveFn) {
      resolveFn(result);
      resolveFn = null;
    }
  }
  function onBack() {
    close(null);
  }

  // opts: { label, initialValue } -- pedido explícito: senha sempre
  // visível em texto puro no teclado (sem mascarar com • nem botão de
  // mostrar/esconder) -- controle remoto não tem como "colar" senha
  // errada escondida, e mostrar sempre é mais simples/direto de conferir
  // o que foi digitado na tela da TV.
  function open(opts) {
    opts = opts || {};
    build();
    triggerEl = SN.current();
    currentValue = opts.initialValue || "";
    shiftOn = false;
    overlay.querySelector("#kb-label").textContent = opts.label || "";
    renderRows();
    renderActions();
    updatePreview();
    overlay.style.display = "flex";
    // push/pop (não bind) -- o teclado é um overlay TEMPORÁRIO em cima da
    // tela de baixo; Voltar aqui tem que fechar só ele (onBack), devolvendo
    // o Voltar da tela de baixo sozinho quando fecha, sem perder qual era.
    BackNav.push(onBack);
    SN.clear();
    SN.focusFirst(overlay);
    return new Promise(function (resolve) {
      resolveFn = resolve;
    });
  }
  global.Keyboard = {
    open: open
  };
})(window);