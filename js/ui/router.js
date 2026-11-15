/*
 * Router simples por nome de tela -- cada módulo em js/ui/screens/*.js
 * registra um objeto {mount(params), unmount()} via Router.register(name, obj).
 * Só uma tela ativa por vez (mesmo padrão de "um Composable troca o outro"
 * no Android, ou MainScene.brs trocando children na Roku).
 */
(function (global) {
  "use strict";

  var screens = {};
  var current = null;
  var currentParams = {};
  // Quem precisa saber que a tela mudou, depois de ela já estar montada
  // (ex.: a pergunta "qual lista usar" espera a pessoa chegar na Início ou
  // nos Ajustes, ver App.checkListChoice).
  var listeners = [];
  function register(name, impl) {
    screens[name] = impl;
  }
  function onChange(fn) {
    listeners.push(fn);
  }

  // currentParams fica guardado -- sem isso, voltar do Player pra uma
  // tela de detalhe (Filme/Série) com Router.go(request.returnTo) SEM os
  // params originais remontava a tela vazia (ex.: SeriesDetail sem
  // params.id não sabe mais qual série era -- bug real encontrado na
  // auditoria). App.play() usa currentParams() pra guardar junto do
  // returnTo, e o Player devolve os dois juntos no goBack().
  function go(name, params) {
    if (current && screens[current] && screens[current].unmount) {
      try {
        screens[current].unmount();
      } catch (e) {
        console.error(e);
      }
    }
    SN.clear();
    document.querySelectorAll(".screen").forEach(function (el) {
      el.classList.remove("active");
    });
    var el = document.querySelector('.screen[data-screen="' + name + '"]');
    if (el) el.classList.add("active");
    // Some com o overlay de boot (#boot-loading) na 1ª troca de tela de
    // verdade -- idempotente, não faz nada nas trocas seguintes.
    var bootLoading = document.getElementById("boot-loading");
    if (bootLoading) bootLoading.classList.add("boot-done");
    current = name;
    currentParams = params || {};
    if (screens[name] && screens[name].mount) {
      try {
        screens[name].mount(currentParams);
      } catch (e) {
        console.error(e);
      }
    }
    listeners.forEach(function (fn) {
      try {
        fn(name);
      } catch (e) {
        console.error(e);
      }
    });
  }
  function current_() {
    return current;
  }
  function currentParams_() {
    return currentParams;
  }
  global.Router = {
    register: register,
    go: go,
    current: current_,
    currentParams: currentParams_,
    onChange: onChange
  };
})(window);