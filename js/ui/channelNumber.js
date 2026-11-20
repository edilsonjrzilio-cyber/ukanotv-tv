/*
 * Troca de canal no ao vivo: quadro do topo (número + nome) e número
 * digitado no controle -- porta de ui/common/ChannelNumberEntry.kt do
 * Android (pedido de cliente, 17/11). O número é o que o SERVIDOR manda
 * (`num`, o mesmo dos outros apps e de todas as casas), o que aparece do
 * lado do canal na lista; vale em qualquer categoria. Vai sozinho quando a
 * pessoa para de digitar, ou na hora com OK; com todos os dígitos possíveis
 * (maior número 4116 = 4 dígitos) vai quase na hora.
 */
(function (global) {
  "use strict";

  var COMMIT_MS = 1800;
  var FULL_MS = 400;
  var INVALID_MS = 1500;

  // Teclas 0-9 do controle (e do teclado numérico, pra testar no PC).
  function digitOfKey(keyCode) {
    if (keyCode >= 48 && keyCode <= 57) return keyCode - 48;
    if (keyCode >= 96 && keyCode <= 105) return keyCode - 96;
    return null;
  }
  function pad3(n) {
    var s = String(n);
    while (s.length < 3) s = "0" + s;
    return s;
  }

  // fixed=true: preso na tela (lista com rolagem); senão absoluto no pai.
  function createBadge(parent, topPx, fixed) {
    var el = document.createElement("div");
    el.className = "ch-badge";
    el.style.cssText = "display:none;position:" + (fixed ? "fixed" : "absolute") + ";left:50%;top:" + topPx + "px;" + "-webkit-transform:translateX(-50%);transform:translateX(-50%);z-index:50;align-items:center;" + "padding:12px 22px;border-radius:14px;background:rgba(0,0,0,0.85);border:2px solid var(--accent);" + "max-width:640px;box-sizing:border-box;white-space:nowrap;";
    el.innerHTML = '<span class="ch-badge-num" style="color:var(--accent);font-size:26.5px;font-weight:900;flex-shrink:0;"></span>' + '<span class="ch-badge-name" style="margin-left:14px;color:#fff;font-size:26.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;"></span>';
    parent.appendChild(el);
    return {
      show: function show(num, name, dim) {
        el.querySelector(".ch-badge-num").textContent = num;
        var nameEl = el.querySelector(".ch-badge-name");
        nameEl.textContent = name || "";
        nameEl.style.display = name ? "" : "none";
        nameEl.style.color = dim ? "#9A9AA5" : "#fff";
        el.style.display = "flex";
      },
      hide: function hide() {
        el.style.display = "none";
      }
    };
  }

  // Número pra mostrar/digitar: o do servidor ou, sem ele (catálogo salvo
  // antes desta versão), a posição na lista.
  function displayNumber(ch, idx) {
    return ch && ch.num > 0 ? ch.num : idx + 1;
  }

  // Mapa número -> canal de uma lista.
  function indexByNumber(list) {
    var map = {};
    var max = 0;
    (list || []).forEach(function (ch, i) {
      var n = displayNumber(ch, i);
      if (!map[n]) map[n] = ch;
      if (n > max) max = n;
    });
    return {
      map: map,
      max: max
    };
  }

  // opts: { maxNumber(), channelFor(n) -> canal ou null, onCommit(n), badge }
  function createEntry(opts) {
    var typed = "";
    var invalid = false;
    var timer = null;
    function maxDigits() {
      return String(Math.max(1, opts.maxNumber())).length;
    }
    function target() {
      var n = parseInt(typed, 10);
      return n > 0 && opts.channelFor(n) ? n : -1;
    }
    function paint() {
      var label = typed;
      var max = maxDigits();
      while (label.length < max) label += "_";
      var n = target();
      var name = invalid ? "Canal não existe nesta lista" : n > 0 ? opts.channelFor(n).name : "";
      opts.badge.show(label, name, invalid);
    }
    function clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      var was = typed;
      typed = "";
      invalid = false;
      if (was) opts.badge.hide();
    }
    function finish() {
      timer = null;
      if (invalid || !typed) return;
      var n = target();
      if (n < 0) {
        invalid = true;
        paint();
        timer = setTimeout(clear, INVALID_MS);
        return;
      }
      typed = "";
      opts.badge.hide();
      opts.onCommit(n);
    }
    return {
      type: function type(digit) {
        if (opts.maxNumber() <= 0) return;
        if (typed.length >= maxDigits() || invalid) {
          typed = "";
          invalid = false;
        }
        typed += String(digit);
        paint();
        if (timer) clearTimeout(timer);
        timer = setTimeout(finish, typed.length >= maxDigits() ? FULL_MS : COMMIT_MS);
      },
      // OK com número digitado: vai agora, sem esperar.
      commitNow: function commitNow() {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        finish();
      },
      clear: clear,
      active: function active() {
        return typed !== "";
      }
    };
  }
  global.ChannelNumber = {
    digitOfKey: digitOfKey,
    pad3: pad3,
    displayNumber: displayNumber,
    indexByNumber: indexByNumber,
    createBadge: createBadge,
    createEntry: createEntry
  };
})(window);