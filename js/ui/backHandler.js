/*
 * Helper pro botão físico Voltar do controle (SN dispara "sn:back" pro
 * keyCode 461, ver spatialnav.js) -- sem isso, só o botão "←" NA TELA
 * (via OK) funcionava; o botão de verdade do controle remoto não fazia
 * nada em nenhuma tela além do Player (bug real encontrado na auditoria,
 * teria falhado até a certificação da LG, que exige Voltar funcionando em
 * toda tela -- ver webostv.developer.lge.com/develop/guides/back-button).
 * Cada tela chama BackNav.bind(fn) no mount() e BackNav.unbind() no
 * unmount() -- só 1 handler ativo por vez, trocado a cada troca de tela.
 */
(function (global) {
  "use strict";

  // Pilha (não só 1 handler): um overlay modal (Keyboard, BlockedDialog)
  // precisa TOMAR o Voltar emprestado enquanto está aberto (fechar o
  // modal, não navegar a tela de trás) e DEVOLVER pro handler da tela de
  // baixo assim que fecha -- sem pilha, abrir o teclado em cima de
  // qualquer tela deixava os DOIS handlers (tela + teclado) escutando
  // "sn:back" ao mesmo tempo, cada Voltar fechando o teclado E navegando a
  // tela de baixo junto (bug real encontrado na auditoria). `bind()` (uso
  // normal de tela) troca a pilha inteira por só esse handler; `push()`/
  // `pop()` (uso de overlay modal) empilha/desempilha por cima sem perder
  // o de baixo.
  var stack = [];
  var activeHandler = null;
  function attach() {
    if (activeHandler) document.removeEventListener("sn:back", activeHandler);
    activeHandler = stack[stack.length - 1] || null;
    if (activeHandler) document.addEventListener("sn:back", activeHandler);
  }
  function bind(fn) {
    stack = [fn];
    attach();
  }
  function unbind() {
    stack = [];
    attach();
  }
  function push(fn) {
    stack.push(fn);
    attach();
  }
  function pop() {
    stack.pop();
    attach();
  }

  // Tira um handler específico, esteja onde estiver na pilha: um overlay
  // que fecha depois de a tela de baixo já ter trocado a pilha (bind, ex.:
  // mudou de tela por trás) não pode levar junto o Voltar da tela -- pop()
  // tiraria o de cima, que já não é o dele (ver ChoiceDialog).
  function remove(fn) {
    var i = stack.lastIndexOf(fn);
    if (i === -1) return;
    stack.splice(i, 1);
    attach();
  }

  // Sai do app de verdade -- chamado da Início/Login (telas "raiz", sem
  // pra onde voltar dentro do app). Cada TV tem o seu jeito certificado de
  // sair -- ver js/lib/platform.js.
  function exitApp() {
    if (global.Platform) {
      global.Platform.exitApp();
      return;
    }
    try {
      window.close();
    } catch (e) {}
  }
  global.BackNav = {
    bind: bind,
    unbind: unbind,
    push: push,
    pop: pop,
    remove: remove,
    exitApp: exitApp
  };
})(window);