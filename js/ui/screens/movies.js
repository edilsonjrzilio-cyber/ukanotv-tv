/* Porta de tv-app/android/.../ui/movies/MoviesScreen.kt via ContentGrid. */
(function (global) {
  "use strict";

  ContentGrid.create({
    screenName: "movies",
    title: "Filmes",
    kind: "movie",
    badge: "FILME",
    onOpen: function onOpen(item, _resumeEpisodeId, back) {
      Router.go("movieDetail", {
        id: item.streamId,
        back: back
      });
    }
  });
})(window);