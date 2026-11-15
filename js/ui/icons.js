/*
 * Ícones em SVG inline (não emoji) -- emoji depende da fonte do sistema
 * pra desenhar; TVs mais antigas/algumas fontes webOS não têm a fonte de
 * emoji colorida instalada e mostram um quadradinho ("tofu") no lugar,
 * bem diferente dos ícones Material (Android) ou PNG customizados (Roku)
 * usados nos outros dois apps. SVG com stroke="currentColor" sempre
 * desenha igual em qualquer engine (suportado desde sempre) e herda a
 * cor do CSS, então focus/tema tingem o ícone automaticamente.
 */
(function (global) {
  "use strict";

  function svg(inner, viewBox) {
    return '<svg viewBox="' + (viewBox || "0 0 24 24") + '" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;">' + inner + "</svg>";
  }
  var ICONS = {
    back: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
    forward: svg('<path d="M5 12h14M12 5l7 7-7 7"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    sort: svg('<path d="M7 17V3M7 3L3 7M7 3l4 4M17 7v14M17 21l4-4M17 21l-4-4"/>'),
    "heart-outline": svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>'),
    "heart-filled": svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" fill="currentColor"/>'),
    key: svg('<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L19 4M15 7l2.5 2.5M18 4l2 2"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    "lock-open": svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>'),
    eye: svg('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>'),
    "eye-off": svg('<path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a13.2 13.2 0 0 1-3.2 3.9M6.3 6.3C3.7 7.9 2 10.8 1 12c0 0 4 7 11 7 1.4 0 2.7-.3 3.8-.7"/>'),
    play: svg('<path d="M6 3l15 9-15 9V3z" fill="currentColor" stroke="none"/>'),
    pause: svg('<rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none"/>'),
    rewind: svg('<path d="M11 19l-8-7 8-7v14z" fill="currentColor" stroke="none"/><path d="M22 19l-8-7 8-7v14z" fill="currentColor" stroke="none"/>'),
    forward10: svg('<path d="M13 5l8 7-8 7V5z" fill="currentColor" stroke="none"/><path d="M2 5l8 7-8 7V5z" fill="currentColor" stroke="none"/>'),
    logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/>'),
    check: svg('<path d="M20 6L9 17l-5-5"/>'),
    warning: svg('<path d="M12 2L1 21h22L12 2z"/><path d="M12 9v5M12 18h.01"/>'),
    "chevron-right": svg('<path d="M9 18l6-6-6-6"/>'),
    refresh: svg('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    live: svg('<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 3l4 4 4-4"/>'),
    movie: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 10h4M17 10h4M3 15h4M17 15h4"/>'),
    series: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 6V4h8v2"/>'),
    monitor: svg('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
    device: svg('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>'),
    backspace: svg('<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-7-7 7-7z"/><path d="M13 10l5 5M18 10l-5 5"/>'),
    keyboard: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h0M10 9h0M14 9h0M18 9h0M6 13h0M18 13h0M9 13h6" stroke-width="2.4"/>'),
    // Par usado no botão de zoom do Player (Fullscreen/FullscreenExit do
    // Android) -- cantos se afastando = "Zoom" (preenche cortando), cantos
    // se aproximando = "Ajustar" (encolhe de volta pro tamanho normal).
    fullscreen: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    "fullscreen-exit": svg('<path d="M9 3v4a2 2 0 0 1-2 2H3M15 3v4a2 2 0 0 0 2 2h4M9 21v-4a2 2 0 0 0-2-2H3M15 21v-4a2 2 0 0 1 2-2h4"/>')
  };
  function icon(name, extraStyle) {
    var markup = ICONS[name] || "";
    if (extraStyle) markup = markup.replace("style=\"", "style=\"" + extraStyle + ";");
    return markup;
  }
  global.Icon = icon;
})(window);