/* Porta de tv-app/android/.../ui/series/SeriesScreen.kt via ContentGrid. */
(function (global) {
  "use strict";

  ContentGrid.create({
    screenName: "series",
    title: "Séries",
    kind: "series",
    badge: "SÉRIE",
    onOpen: function onOpen(show, resumeEpisodeId, back) {
      Router.go("seriesDetail", {
        id: show.seriesId,
        resumeEpisodeId: resumeEpisodeId || null,
        back: back
      });
    }
  });
})(window);