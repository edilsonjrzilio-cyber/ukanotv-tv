/* Porta de tv-app/android/.../ui/common/BlockedSessionDialog.kt -- aviso
   de sessão encerrada pelo revendedor (heartbeat bloqueado) ou conta
   vencida. Só desloga de verdade quando a pessoa confirma "Entendi". */
(function (global) {
  "use strict";

  var overlay = null;
  function build() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "blocked-overlay";
    overlay.setAttribute("data-sn-root", "");
    overlay.style.cssText = "position:absolute;top:0;right:0;bottom:0;left:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);";
    overlay.innerHTML = '<div style="width:560px;background:#111318;border:1px solid rgba(239,68,68,0.3);border-radius:16px;padding:28px;text-align:center;">' + '  <div style="font-size:35px;margin-bottom:10px;color:#EF4444;">' + Icon("warning") + "</div>" + '  <div id="blocked-msg" style="color:#fff;font-size:21.5px;font-weight:700;line-height:29px;margin-bottom:22px;"></div>' + '  <button class="focusable" id="blocked-ok" data-sn-autofocus style="background:var(--accent);color:#000;border:none;padding:12px 28px;border-radius:10px;font-size:18.5px;font-weight:900;cursor:pointer;">Entendi</button>' + "</div>";
    document.body.appendChild(overlay);
    return overlay;
  }
  function show(message) {
    build();
    overlay.querySelector("#blocked-msg").textContent = message;
    overlay.style.display = "flex";
    SN.setEnabled(true);
    SN.clear();
    SN.focusFirst(overlay);
    overlay.querySelector("#blocked-ok").addEventListener("sn:enter", onConfirm, {
      once: true
    });
    // Voltar aqui confirma igual o botão "Entendi" -- não deixa escapar
    // pra tela de trás com uma sessão já encerrada pelo painel.
    BackNav.push(onConfirm);
  }
  function onConfirm() {
    overlay.style.display = "none";
    BackNav.pop();
    // Remove explicitamente (não só confiar no {once:true} do clique) --
    // onConfirm também é chamado via Voltar (BackNav.push acima), e nesse
    // caminho o listener {once:true} do botão nunca dispara sozinho pra
    // se auto-remover; sem isso, mostrar o diálogo de novo depois
    // acumulava mais um listener no mesmo botão a cada vez.
    overlay.querySelector("#blocked-ok").removeEventListener("sn:enter", onConfirm);
    SessionStore.clearCreds();
    ContinueWatching.clearAll();
    // Sem isso o login automático por MAC entrava de novo na mesma conta
    // logo depois do aviso (mesmo motivo do "Sair da conta").
    if (global.LoginScreen && LoginScreen.skipAutoMacOnce) LoginScreen.skipAutoMacOnce();
    Router.go("login");
  }
  global.BlockedDialog = {
    show: show
  };
})(window);