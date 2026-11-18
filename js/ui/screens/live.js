/*
 * Porta de tv-app/android/.../ui/live/LiveScreen.kt. 3 colunas: categorias
 * | lista de canais | prévia (vídeo mudo + EPG). 1º OK seleciona/mostra
 * prévia, 2º OK no mesmo canal já selecionado toca em tela cheia.
 */
(function (global) {
  "use strict";

  var FAV_CATEGORY_ID = "__fav__";
  // FAV_CATEGORY_ID (não "all") -- igual Android (MainViewModel.kt:
  // _liveActiveCategory = MutableStateFlow(FAV_CATEGORY_ID)) e Roku: Ao
  // vivo abre sempre em Favoritos, mesmo vazio. Estava divergindo (abria em
  // "Todos") -- gap real encontrado comparando com o ViewModel do Android.
  var state = {
    channels: [],
    categories: [],
    activeCategory: FAV_CATEGORY_ID,
    selected: null,
    loading: true,
    failed: false,
    query: ""
  };
  var previewVideo = null;

  // Compilado uma vez só (não por canal) -- mesma lição do Android
  // (Categories.kt: recompilar regex por item media ~40s num catálogo
  // grande num TV box real) e do contentGrid.js nesta mesma sessão.
  var DIACRITICS_RX = /(?:[\u0300-\u036F\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7-\u05C9\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B53-\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ABD\u1ABF-\u1AF0\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA82C\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]|\uD800[\uDDFD\uDEE0\uDF76-\uDF7A]|\uD802[\uDE01-\uDE03\uDE05\uDE06\uDE0C-\uDE0F\uDE38-\uDE3A\uDE3F\uDEE5\uDEE6]|\uD803[\uDD24-\uDD27\uDD69-\uDD6D\uDEAB\uDEAC\uDECB-\uDECF\uDEF0-\uDEFF\uDF46-\uDF50\uDF82-\uDF85]|\uD804[\uDC01\uDC38-\uDC46\uDC70\uDC73\uDC74\uDC7F-\uDC81\uDCB3-\uDCB6\uDCB9\uDCBA\uDCC2\uDD00-\uDD02\uDD27-\uDD2B\uDD2D-\uDD34\uDD73\uDD80\uDD81\uDDB6-\uDDBE\uDDC9-\uDDCC\uDDCF\uDE2F-\uDE31\uDE34\uDE36\uDE37\uDE3E\uDE41\uDEDF\uDEE3-\uDEEA\uDF00\uDF01\uDF3B\uDF3C\uDF40\uDF66-\uDF6C\uDF70-\uDF74\uDFBB-\uDFC0\uDFCE\uDFD0\uDFD2\uDFE1\uDFE2]|\uD805[\uDC38-\uDC3F\uDC42-\uDC44\uDC46\uDC5E\uDCB3-\uDCB8\uDCBA\uDCBF\uDCC0\uDCC2\uDCC3\uDDB2-\uDDB5\uDDBC\uDDBD\uDDBF\uDDC0\uDDDC\uDDDD\uDE33-\uDE3A\uDE3D\uDE3F\uDE40\uDEAB\uDEAD\uDEB0-\uDEB5\uDEB7\uDF1D\uDF1F\uDF22-\uDF25\uDF27-\uDF2B]|\uD806[\uDC2F-\uDC37\uDC39\uDC3A\uDD3B\uDD3C\uDD3E\uDD43\uDDD4-\uDDD7\uDDDA\uDDDB\uDDE0\uDE01-\uDE0A\uDE33-\uDE38\uDE3B-\uDE3E\uDE47\uDE51-\uDE56\uDE59-\uDE5B\uDE8A-\uDE96\uDE98\uDE99\uDF60\uDF62-\uDF64\uDF66]|\uD807[\uDC30-\uDC36\uDC38-\uDC3D\uDC3F\uDC92-\uDCA7\uDCAA-\uDCB0\uDCB2\uDCB3\uDCB5\uDCB6\uDD31-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD45\uDD47\uDD90\uDD91\uDD95\uDD97\uDDF0\uDEF3\uDEF4\uDF00\uDF01\uDF36-\uDF3A\uDF40\uDF42\uDF5A]|\uD80D[\uDC40\uDC47-\uDC55]|\uD818[\uDD1E-\uDD29\uDD2D-\uDD2F]|\uD81A[\uDEF0-\uDEF4\uDF30-\uDF36]|\uD81B[\uDF4F\uDF8F-\uDF92\uDFE4]|\uD82F[\uDC9D\uDC9E]|\uD833[\uDF00-\uDF2D\uDF30-\uDF46]|\uD834[\uDD27\uDD28\uDD67-\uDD69\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44\uDE5B\uDE5C]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A\uDC8F\uDD30-\uDD36\uDEAE\uDEEC-\uDEEF]|\uD839[\uDCEC-\uDCEF\uDDEE\uDDEF\uDEE3\uDEE6\uDEEE\uDEEF\uDEF5]|\uD83A[\uDCD0-\uDCD6\uDD44-\uDD4A]|\uDB40[\uDD00-\uDDEF])+/g;
  // \p{L}\p{N}: categoria só com letras não latinas não vira "" (ver contentGrid.js).
  var NON_ALNUM_RX = /(?:[\0-\/:-@\[-`\{-\xA9\xAB-\xB1\xB4\xB6-\xB8\xBB\xBF\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u036F\u0375\u0378\u0379\u037E\u0380-\u0385\u0387\u038B\u038D\u03A2\u03F6\u0482-\u0489\u0530\u0557\u055A-\u055F\u0589\u058A\u058D-\u05CF\u05EB-\u05EE\u05F3-\u061F\u064B-\u065F\u066A-\u066D\u0670\u06D4\u06D6-\u06E4\u06E7-\u06ED\u06FD\u06FE\u0700-\u070F\u0711\u0730-\u074C\u07A6-\u07B0\u07B2-\u07BF\u07EB-\u07F3\u07F6-\u07F9\u07FB-\u07FF\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u083F\u0859-\u085F\u086B-\u086F\u0888\u0890-\u089F\u08CA-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962-\u0965\u0970\u0981-\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA-\u09BC\u09BE-\u09CD\u09CF-\u09DB\u09DE\u09E2-\u09E5\u09F2\u09F3\u09FA\u09FB\u09FD-\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A-\u0A58\u0A5D\u0A5F-\u0A65\u0A70\u0A71\u0A75-\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA-\u0ABC\u0ABE-\u0ACF\u0AD1-\u0ADF\u0AE2-\u0AE5\u0AF0-\u0AF8\u0AFA-\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A-\u0B3C\u0B3E-\u0B5B\u0B5E\u0B62-\u0B65\u0B70\u0B78-\u0B82\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BCF\u0BD1-\u0BE5\u0BF3-\u0C04\u0C0D\u0C11\u0C29\u0C3A-\u0C3C\u0C3E-\u0C57\u0C5B\u0C5E\u0C5F\u0C62-\u0C65\u0C70-\u0C77\u0C7F\u0C81-\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA-\u0CBC\u0CBE-\u0CDB\u0CDF\u0CE2-\u0CE5\u0CF0\u0CF3-\u0D03\u0D0D\u0D11\u0D3B\u0D3C\u0D3E-\u0D4D\u0D4F-\u0D53\u0D57\u0D62-\u0D65\u0D79\u0D80-\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DE5\u0DF0-\u0E00\u0E31\u0E34-\u0E3F\u0E47-\u0E4F\u0E5A-\u0E80\u0E83\u0E85\u0E8B\u0EA4\u0EA6\u0EB1\u0EB4-\u0EBC\u0EBE\u0EBF\u0EC5\u0EC7-\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F01-\u0F1F\u0F34-\u0F3F\u0F48\u0F6D-\u0F87\u0F8D-\u0FFF\u102B-\u103E\u104A-\u104F\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109F\u10C6\u10C8-\u10CC\u10CE\u10CF\u10FB\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B-\u1368\u137D-\u137F\u1390-\u139F\u13F6\u13F7\u13FE-\u1400\u166D\u166E\u1680\u169B-\u169F\u16EB-\u16ED\u16F9-\u16FF\u1712-\u171E\u1732-\u173F\u1752-\u175F\u176D\u1771-\u177F\u17B4-\u17D6\u17D8-\u17DB\u17DD-\u17DF\u17EA-\u17EF\u17FA-\u180F\u181A-\u181F\u1879-\u187F\u1885\u1886\u18A9\u18AB-\u18AF\u18F6-\u18FF\u191F-\u1945\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19FF\u1A17-\u1A1F\u1A55-\u1A7F\u1A8A-\u1A8F\u1A9A-\u1AA6\u1AA8-\u1B04\u1B34-\u1B44\u1B4D-\u1B4F\u1B5A-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BFF\u1C24-\u1C3F\u1C4A-\u1C4C\u1C7E\u1C7F\u1C8B-\u1C8F\u1CBB\u1CBC\u1CC0-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1CFB-\u1CFF\u1DC0-\u1DFF\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FBD\u1FBF-\u1FC1\u1FC5\u1FCD-\u1FCF\u1FD4\u1FD5\u1FDC-\u1FDF\u1FED-\u1FF1\u1FF5\u1FFD-\u206F\u2072\u2073\u207A-\u207E\u208A-\u208E\u20A0-\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A-\u245F\u249C-\u24E9\u2500-\u2775\u2794-\u2BFF\u2CE5-\u2CEA\u2CEF-\u2CF1\u2CF4-\u2CFC\u2CFE\u2CFF\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D70-\u2D7F\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF-\u2E2E\u2E30-\u3004\u3008-\u3020\u302A-\u3030\u3036\u3037\u303D-\u3040\u3097-\u309C\u30A0\u30FB\u3100-\u3104\u3130\u318F-\u3191\u3196-\u319F\u31C0-\u31EF\u3200-\u321F\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA48D-\uA4CF\uA4FE\uA4FF\uA60D-\uA60F\uA62C-\uA63F\uA66F-\uA67E\uA69E\uA69F\uA6F0-\uA716\uA720\uA721\uA789\uA78A\uA7DE-\uA7E1\uA7E3-\uA7F0\uA802\uA806\uA80B\uA823-\uA82F\uA836-\uA83F\uA874-\uA881\uA8B4-\uA8CF\uA8DA-\uA8F1\uA8F8-\uA8FA\uA8FC\uA8FF\uA926-\uA92F\uA947-\uA95F\uA97D-\uA983\uA9B3-\uA9CE\uA9DA-\uA9DF\uA9E5\uA9FF\uAA29-\uAA3F\uAA43\uAA4C-\uAA4F\uAA5A-\uAA5F\uAA77-\uAA79\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAC3-\uAADA\uAADE\uAADF\uAAEB-\uAAF1\uAAF5-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB5B\uAB6A\uAB6B\uAB6E\uAB6F\uABE3-\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uD7FF\uE000-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB1E\uFB29\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBB2-\uFBD2\uFD3E-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFC-\uFE6F\uFE75\uFEFD-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFFF]|\uD800[\uDC0C\uDC27\uDC3B\uDC3E\uDC4E\uDC4F\uDC5E-\uDC7F\uDCFB-\uDD06\uDD34-\uDD3F\uDD79-\uDD89\uDD8C-\uDE7F\uDE9D-\uDE9F\uDED1-\uDEE0\uDEFC-\uDEFF\uDF24-\uDF2C\uDF4B-\uDF4F\uDF76-\uDF7F\uDF9E\uDF9F\uDFC4-\uDFC7\uDFD0\uDFD6-\uDFFF]|\uD801[\uDC9E\uDC9F\uDCAA-\uDCAF\uDCD4-\uDCD7\uDCFC-\uDCFF\uDD28-\uDD2F\uDD64-\uDD6F\uDD7B\uDD8B\uDD93\uDD96\uDDA2\uDDB2\uDDBA\uDDBD-\uDDBF\uDDF4-\uDDFF\uDF37-\uDF3F\uDF56-\uDF5F\uDF68-\uDF7F\uDF86\uDFB1\uDFC0-\uDFFF]|\uD802[\uDC06\uDC07\uDC09\uDC36\uDC39-\uDC3B\uDC3D\uDC3E\uDC56\uDC57\uDC77\uDC78\uDC9F-\uDCA6\uDCB0-\uDCDF\uDCF3\uDCF6-\uDCFA\uDD1C-\uDD1F\uDD3A-\uDD3F\uDD5A-\uDD7F\uDDB8-\uDDBB\uDDD0\uDDD1\uDE01-\uDE0F\uDE14\uDE18\uDE36-\uDE3F\uDE49-\uDE5F\uDE7F\uDEA0-\uDEBF\uDEC8\uDEE5-\uDEEA\uDEF0-\uDEFF\uDF36-\uDF3F\uDF56\uDF57\uDF73-\uDF77\uDF92-\uDFA8\uDFB0-\uDFFF]|\uD803[\uDC49-\uDC7F\uDCB3-\uDCBF\uDCF3-\uDCF9\uDD24-\uDD2F\uDD3A-\uDD3F\uDD66-\uDD6E\uDD86-\uDE5F\uDE7F\uDEAA-\uDEAF\uDEB2-\uDEC1\uDEC8-\uDED8\uDEEF-\uDEFF\uDF28-\uDF2F\uDF46-\uDF50\uDF55-\uDF6F\uDF82-\uDFAF\uDFCC-\uDFDF\uDFF7-\uDFFF]|\uD804[\uDC00-\uDC02\uDC38-\uDC51\uDC70\uDC73\uDC74\uDC76-\uDC82\uDCB0-\uDCCF\uDCE9-\uDCEF\uDCFA-\uDD02\uDD27-\uDD35\uDD40-\uDD43\uDD45\uDD46\uDD48-\uDD4F\uDD73-\uDD75\uDD77-\uDD82\uDDB3-\uDDC0\uDDC5-\uDDCF\uDDDB\uDDDD-\uDDE0\uDDF5-\uDDFF\uDE12\uDE2C-\uDE3E\uDE41-\uDE7F\uDE87\uDE89\uDE8E\uDE9E\uDEA9-\uDEAF\uDEDF-\uDEEF\uDEFA-\uDF04\uDF0D\uDF0E\uDF11\uDF12\uDF29\uDF31\uDF34\uDF3A-\uDF3C\uDF3E-\uDF4F\uDF51-\uDF5C\uDF62-\uDF7F\uDF8A\uDF8C\uDF8D\uDF8F\uDFB6\uDFB8-\uDFD0\uDFD2\uDFD4-\uDFFF]|\uD805[\uDC35-\uDC46\uDC4B-\uDC4F\uDC5A-\uDC5E\uDC62-\uDC7F\uDCB0-\uDCC3\uDCC6\uDCC8-\uDCCF\uDCDA-\uDD7F\uDDAF-\uDDD7\uDDDC-\uDDFF\uDE30-\uDE43\uDE45-\uDE4F\uDE5A-\uDE7F\uDEAB-\uDEB7\uDEB9-\uDEBF\uDECA-\uDECF\uDEE4-\uDEFF\uDF1B-\uDF2F\uDF3C-\uDF3F\uDF47-\uDFFF]|\uD806[\uDC2C-\uDC9F\uDCF3-\uDCFE\uDD07\uDD08\uDD0A\uDD0B\uDD14\uDD17\uDD30-\uDD3E\uDD40\uDD42-\uDD4F\uDD5A-\uDD9F\uDDA8\uDDA9\uDDD1-\uDDE0\uDDE2\uDDE4-\uDDFF\uDE01-\uDE0A\uDE33-\uDE39\uDE3B-\uDE4F\uDE51-\uDE5B\uDE8A-\uDE9C\uDE9E-\uDEAF\uDEF9-\uDF09\uDF0B-\uDFBF\uDFE1-\uDFEF\uDFFA-\uDFFF]|\uD807[\uDC09\uDC2F-\uDC3F\uDC41-\uDC4F\uDC6D-\uDC71\uDC90-\uDCFF\uDD07\uDD0A\uDD31-\uDD45\uDD47-\uDD4F\uDD5A-\uDD5F\uDD66\uDD69\uDD8A-\uDD97\uDD99-\uDD9F\uDDAA-\uDDAF\uDDDC-\uDDDF\uDDEA-\uDDF0\uDDF2-\uDEDF\uDEF3-\uDF01\uDF03\uDF11\uDF34-\uDF4F\uDF5A-\uDFAF\uDFB1-\uDFBF\uDFD5-\uDFFF]|\uD808[\uDF9A-\uDFFF]|\uD809[\uDC70-\uDC74\uDD44-\uDD4F\uDE87-\uDFFF]|[\uD80A\uD812-\uD817\uD819\uD825-\uD82A\uD82D\uD82E\uD830-\uD832\uD836\uD83D\uD83F\uD87C\uD87D\uD87F\uD88E-\uD8B3\uD8C0-\uDBFF][\uDC00-\uDFFF]|\uD80B[\uDC00-\uDF8F\uDFF1-\uDFFF]|\uD80D[\uDC30-\uDC40\uDC47-\uDC5F]|\uD810[\uDFFB-\uDFFF]|\uD811[\uDE47-\uDFFF]|\uD818[\uDC00-\uDCFF\uDD1E-\uDD2F\uDD3A-\uDFFF]|\uD81A[\uDE39-\uDE3F\uDE5F\uDE6A-\uDE6F\uDEBF\uDECA-\uDECF\uDEEE-\uDEFF\uDF30-\uDF3F\uDF44-\uDF4F\uDF5A\uDF62\uDF78-\uDF7C\uDF90-\uDFFF]|\uD81B[\uDC00-\uDD3F\uDD6D-\uDD6F\uDD7A-\uDE3F\uDE97-\uDE9F\uDEB9\uDEBA\uDED4-\uDEFF\uDF4B-\uDF4F\uDF51-\uDF92\uDFA0-\uDFDF\uDFE2\uDFE4-\uDFF1\uDFF7-\uDFFF]|\uD823[\uDCDB-\uDCFE\uDD21-\uDD7F\uDDF3-\uDDFF]|\uD824[\uDD92-\uDD9F\uDDD3-\uDFFF]|\uD82B[\uDC00-\uDFEF\uDFF4\uDFFC\uDFFF]|\uD82C[\uDD29-\uDD31\uDD33-\uDD4F\uDD53\uDD54\uDD56-\uDD63\uDD69-\uDD6F\uDEFC-\uDFFF]|\uD82F[\uDC6B-\uDC6F\uDC7D-\uDC7F\uDC89-\uDC8F\uDC9A-\uDFFF]|\uD833[\uDC00-\uDCEF\uDCFA-\uDFFF]|\uD834[\uDC00-\uDEBF\uDED4-\uDEDF\uDEF4-\uDF5F\uDF79-\uDFFF]|\uD835[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA7\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3\uDFCC\uDFCD]|\uD837[\uDC00-\uDEFF\uDF82-\uDF8F\uDF97-\uDFCC]|\uD838[\uDC00-\uDC2F\uDC6E-\uDCFF\uDD2D-\uDD36\uDD3E\uDD3F\uDD4A-\uDD4D\uDD4F-\uDE8F\uDEAE-\uDEBF\uDEEC-\uDEEF\uDEFA-\uDFFF]|\uD839[\uDC00-\uDCCF\uDCEC-\uDCEF\uDCFA-\uDDCF\uDDEE\uDDEF\uDDFB-\uDEBF\uDEDF\uDEE3\uDEE6\uDEEE\uDEEF\uDEF5-\uDEFD\uDF00-\uDFDF\uDFE7\uDFEC\uDFEF\uDFFF]|\uD83A[\uDCC5\uDCC6\uDCD0-\uDCFF\uDD44-\uDD4A\uDD4C-\uDD4F\uDD5A-\uDFFF]|\uD83B[\uDC00-\uDC70\uDCAC\uDCB0\uDCB5-\uDD00\uDD2E\uDD3E-\uDDFF\uDE04\uDE20\uDE23\uDE25\uDE26\uDE28\uDE33\uDE38\uDE3A\uDE3C-\uDE41\uDE43-\uDE46\uDE48\uDE4A\uDE4C\uDE50\uDE53\uDE55\uDE56\uDE58\uDE5A\uDE5C\uDE5E\uDE60\uDE63\uDE65\uDE66\uDE6B\uDE73\uDE78\uDE7D\uDE7F\uDE8A\uDE9C-\uDEA0\uDEA4\uDEAA\uDEBC-\uDFFF]|\uD83C[\uDC00-\uDCFF\uDD0D-\uDFFF]|\uD83E[\uDC00-\uDFEF\uDFFA-\uDFFF]|\uD869[\uDEE0-\uDEFF]|\uD86E\uDC1F|\uD873[\uDEAE\uDEAF]|\uD87A[\uDFE1-\uDFEF]|\uD87B[\uDE5E-\uDFFF]|\uD87E[\uDE1E-\uDFFF]|\uD884[\uDF4B-\uDF4F]|\uD88D[\uDC7A-\uDFFF]|\uD8BF[\uDC40-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+/g;
  var EDGE_DASH_RX = /^-+|-+$/g;
  var CATEGORY_SEPARATOR_RX = /\s*(?:\||›|»|>)\s*/;
  // Porta de Categories.kt -- Ao vivo é o único dos 3 catálogos que também
  // fixa "Jogos do dia"/"Jogos 24h" no topo, além de Lançamentos.
  var LAUNCH_CATEGORY_RX = /\b(lan[cç]amentos?|estreias?|novidades)\b/i;
  var GAMES_CATEGORY_RX = /\bjogos?\b/i;
  function normalizeForMatch(v) {
    return (v || "").normalize("NFD").replace(DIACRITICS_RX, "").toLowerCase().trim();
  }
  // Porta de categoryLabel/categoryId (Categories.kt) -- sem isso, a MESMA
  // categoria do provedor formatada de jeitos ligeiramente diferentes
  // (acento, prefixo "Canais | ") virava duas abas separadas em vez de uma.
  function categoryLabel(raw) {
    var trimmed = (raw || "").trim();
    if (!trimmed) return "Sem categoria";
    var parts = trimmed.split(CATEGORY_SEPARATOR_RX).map(function (s) {
      return s.trim();
    }).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : trimmed;
  }
  // Guardado por nome de categoria do provedor: antes cada troca de
  // categoria tirava acento e rodava regex em todos os ~4 mil canais (duas
  // vezes), quase 1 s de tela congelada na TV Samsung.
  var categoryMemo = {};
  function categoryId(raw) {
    var key = raw == null ? "" : String(raw);
    if (categoryMemo[key] === undefined) {
      var stripped = categoryLabel(key).normalize("NFD").replace(DIACRITICS_RX, "").toLowerCase().replace(NON_ALNUM_RX, "-").replace(EDGE_DASH_RX, "");
      categoryMemo[key] = stripped || "sem-categoria";
    }
    return categoryMemo[key];
  }
  function buildCategories(channels, favIds) {
    var counts = {};
    var order = [];
    var labelById = {};
    channels.forEach(function (ch) {
      var id = categoryId(ch.group);
      if (!counts[id]) {
        counts[id] = 0;
        order.push(id);
        labelById[id] = categoryLabel(ch.group);
      }
      counts[id]++;
    });
    var cats = [{
      id: FAV_CATEGORY_ID,
      label: "Favoritos",
      count: favIds.length
    }];
    cats.push({
      id: "all",
      label: "Todos",
      count: channels.length
    });
    var realCats = order.map(function (id) {
      return {
        id: id,
        label: labelById[id],
        count: counts[id]
      };
    });
    realCats.sort(function (a, b) {
      return a.label.localeCompare(b.label, "pt-BR");
    });
    var pinned = realCats.filter(function (c) {
      return LAUNCH_CATEGORY_RX.test(c.label) || GAMES_CATEGORY_RX.test(c.label);
    });
    var rest = realCats.filter(function (c) {
      return !LAUNCH_CATEGORY_RX.test(c.label) && !GAMES_CATEGORY_RX.test(c.label);
    });
    return cats.concat(pinned, rest);
  }
  function filteredChannels() {
    if (state.query.trim()) {
      var q = normalizeForMatch(state.query);
      return state.channels.filter(function (ch) {
        if (ch._norm === undefined) ch._norm = normalizeForMatch(ch.name);
        return ch._norm.indexOf(q) >= 0;
      });
    }
    var favs = SessionStore.getFavorites().live || [];
    if (state.activeCategory === FAV_CATEGORY_ID) return state.channels.filter(function (ch) {
      return favs.indexOf(ch.streamId) >= 0;
    });
    if (state.activeCategory === "all") return state.channels;
    return state.channels.filter(function (ch) {
      return categoryId(ch.group) === state.activeCategory;
    });
  }

  // Estilo das linhas de canal (também usado pela tela Favoritos, em "TV ao
  // vivo", que pode abrir antes desta). Uma vez só.
  function ensureStyles() {
    if (document.querySelector("#live-style")) return;
    var style = document.createElement("style");
    style.id = "live-style";
    style.textContent =
    // min-width:0 + ellipsis no nome -- mesmo bug/mesma correção de
    // contentGrid.js nesta sessão: categoria com nome comprido estourava
    // a largura fixa de 280px do painel em vez de cortar com "...".
    ".live-cat{display:flex;align-items:center;gap:10px;min-width:0;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);color:#fff;font-size:13px;font-weight:700;cursor:pointer;text-align:left;}" + ".live-cat.active{background:var(--accent);color:#000;}" +
    // Sem tingimento de fundo no foco aqui (diferente de contentGrid.js)
    // -- LiveCategoryList.kt do Android só muda a BORDA no foco, o fundo
    // é só binário ativo/não-ativo. Ativo+focado ganha borda BRANCA
    // (antes sumia e o foco parecia ter desaparecido -- mesmo ajuste do
    // Android).
    ".live-cat.sn-focused{border-color:var(--accent);}" + ".live-cat.active.sn-focused{border-color:#fff !important;}" + ".live-cat .ic{flex-shrink:0;display:flex;color:#9AA2B1;}" + ".live-cat.active .ic{color:#000;}" +
    // Quebra em até 2 linhas (não mais 1 linha + "...") -- regra: nome
    // da categoria sempre aparece inteiro.
    ".live-cat .label{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" + ".live-cat .cnt{flex-shrink:0;background:rgba(255,255,255,0.1);border-radius:20px;padding:2px 8px;font-size:11px;color:#9AA2B1;}" + ".live-cat.active .cnt{background:rgba(0,0,0,0.2);color:#000;}" + ".live-cat .chev{flex-shrink:0;display:flex;color:#6B7280;}" + ".live-cat.active .chev{color:#000;}" + ".live-cat-divider{height:1px;background:rgba(255,255,255,0.12);margin:6px 0;}" +
    // Fundo tingido na cor do tema (não cinza chapado) ao focar/
    // selecionar -- igual ChannelRow.kt (withAlpha(accent,0.18f) pra
    // AMBOS "rowFocused || isSelected"). Vermelho FIXO só na borda de
    // "selecionado" (não var(--accent)) -- no Android esse vermelho é
    // hardcoded, propositalmente diferente da cor do tema, pra marcar
    // "canal com prévia aberta" como um estado visual à parte de
    // "categoria ativa" (que aí sim usa a cor do tema). Com tema
    // vermelho isso passa despercebido, mas com qualquer outro tema
    // (azul/verde/roxo/etc.) os dois ficavam se confundindo visualmente
    // antes dessa correção.
    ".live-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.03);border:2px solid transparent;cursor:pointer;}" + ".live-row.selected,.live-row.sn-focused{background:color-mix(in srgb,var(--accent) 18%,transparent);}" + "@supports not (background: color-mix(in srgb, red, blue)) { .live-row.selected,.live-row.sn-focused{background:rgba(225,29,72,0.18);} }" + ".live-row.selected{border-color:#E11D48 !important;}" +
    // Numero do canal (posicao na lista, nao um campo do provedor --
    // paridade com Android/Roku, pedido explicito). Largura fixa de 3
    // digitos pra nao empurrar o resto da linha quando o indice troca
    // de 2 pra 3 digitos.
    // 36px = 4 dígitos (o número do servidor passa de mil).
    ".live-row .num{width:36px;flex-shrink:0;color:#6B7280;font-size:12px;font-weight:500;}" + ".live-row .icon{width:40px;height:40px;border-radius:50%;background:#0B1220;display:flex;align-items:center;justify-content:center;color:#CBD5E1;font-weight:900;flex-shrink:0;overflow:hidden;}" + ".live-row .icon img{width:32px;height:32px;object-fit:contain;}" +
    // Nome + categoria empilhados (igual ChannelRow do Android) -- antes
    // só tinha o nome, fileira de canais ficava parecendo vazia demais
    // numa coluna larga (pedido explícito: "o meio dos canal bem
    // grande", ficava sem nada preenchendo o espaço).
    ".live-row .info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}" +
    // Mesma regra do nome da categoria -- nome do canal sempre inteiro,
    // quebra em até 2 linhas em vez de cortar.
    ".live-row .name{color:#fff;font-size:15px;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" + ".live-row .group{color:#9AA2B1;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" + ".live-row .heart{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.08);border:2px solid transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#6B7280;}" +
    // border-color sozinho não desenha nada sem border-style/width --
    // faltava o "border:2px solid transparent" base acima; sem ele,
    // esse border-color nunca tinha efeito nenhum (bug real: o anel
    // vermelho de foco no coração nunca aparecia, só o genérico
    // ".focusable.sn-focused" por baixo, na cor do TEMA, não vermelho).
    ".live-row .heart.sn-focused{background:rgba(239,68,68,0.25) !important;border-color:#EF4444 !important;}" + ".epg-row{border-radius:10px;padding:10px 14px;margin-top:8px;background:rgba(255,255,255,0.03);}" + ".epg-row.now{background:rgba(225,29,72,0.12);}";
    document.head.appendChild(style);
  }
  function render() {
    var root = document.querySelector('.screen[data-screen="live"] .screen-content');
    root.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;">' + ContentHeaderBar.html({
      title: "Canais",
      search: {
        value: state.query,
        placeholder: "Buscar canais…"
      }
    }) + '  <div style="flex:1;display:flex;overflow:hidden;">' +
    // Regra corrigida (pedido explícito, já replicada no app Windows):
    // categoria SEMPRE largura fixa; canais absorvem o espaço extra
    // (flex:1, "o que sobrar"); prévia SEMPRE largura fixa (320px),
    // presa no canto direito -- não cresce só porque sobrou mais
    // espaço numa tela grande (isso é que deixava "enorme"). Categoria
    // e canais continuam sempre mostrando o nome inteiro (quebra linha
    // em vez de cortar com "...").
    '    <div id="live-categories" style="width:330px;background:rgba(11,11,16,0.9);overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px;" data-sn-scroll></div>' +
    // Lista virtualizada (ver syncListWindow): só as linhas perto da área
    // visível existem no DOM, posicionadas por cima de um "miolo" com a
    // altura da lista inteira.
    '    <div id="live-list" style="flex:1;min-width:0;overflow-y:auto;position:relative;" data-sn-scroll><div id="live-list-inner" style="position:relative;"></div></div>' + '    <div id="live-preview" style="width:320px;flex-shrink:0;padding:16px;overflow-y:auto;" data-sn-scroll></div>' + "  </div>" + "</div>";
    ensureStyles();
    ContentHeaderBar.bind(root, function () {
      Router.go("home");
    }, {
      onSearchOpen: function onSearchOpen() {
        Keyboard.open({
          label: "Buscar canais",
          initialValue: state.query
        }).then(function (v) {
          if (v === null) return;
          state.query = v.trim();
          ContentHeaderBar.updateSearch(root, state.query);
          renderCategories();
          renderList();
        });
      }
    });
  }
  function renderCategories() {
    var el = document.querySelector("#live-categories");
    var favs = SessionStore.getFavorites().live || [];
    state.categories = buildCategories(state.channels, favs);
    el.innerHTML = "";
    state.categories.forEach(function (cat, i) {
      // Divisor depois de Favoritos (sempre o 1º) -- separa ela do resto em
      // vez de tudo junto numa lista só (pedido explícito/LiveCategoryList.kt:
      // "Favoritos separado do resto... ficou tudo junto" era o bug lá).
      if (i === 1) {
        var divider = document.createElement("div");
        divider.className = "live-cat-divider";
        el.appendChild(divider);
      }
      var btn = document.createElement("button");
      btn.className = "focusable live-cat" + (cat.id === state.activeCategory ? " active" : "");
      var icon = cat.id === FAV_CATEGORY_ID ? "heart-outline" : "live";
      btn.innerHTML = '<span class="ic">' + Icon(icon) + "</span>" + '<span class="label">' + cat.label + "</span>" + '<span class="cnt">' + cat.count + "</span>" + '<span class="chev">' + Icon("chevron-right") + "</span>";
      btn.setAttribute("data-cat-id", cat.id);
      btn.addEventListener("sn:enter", function () {
        state.activeCategory = cat.id;
        state.query = "";
        ContentHeaderBar.updateSearch(document.querySelector('.screen[data-screen="live"] .screen-content'), "");
        renderCategories();
        // Categoria nova começa do topo da lista.
        var listEl = document.querySelector("#live-list");
        if (listEl) listEl.scrollTop = 0;
        renderList();
        // Mesmo fix de foco -- depois de trocar categoria, o foco volta
        // sozinho pra categoria escolhida (igual Android: recompor só
        // atualiza o destaque, nunca "perde" o foco).
        var sameCat = document.querySelector('[data-cat-id="' + cat.id + '"]');
        if (sameCat) SN.setFocus(sameCat);
      });
      el.appendChild(btn);
    });
  }

  // ===== Lista de canais virtualizada =====
  // Antes TODOS os canais da categoria viravam linhas de verdade (em
  // "Todos", milhares, cada uma com 2 itens focáveis) e a navegação
  // espacial mede cada item focável a cada seta -- a TV congelava segundos
  // por tecla. Mesma técnica da grade de Filmes/Séries (contentGrid.js).
  var LIST_PAD_Y = 16,
    LIST_PAD_X = 20,
    ROW_H = 84,
    ROW_GAP = 6,
    ROW_STRIDE = ROW_H + ROW_GAP,
    LIST_BUFFER = 6;
  var vList = null; // { channels, favs, rendered: {idx: el} }

  function syncListWindow(centerIdx) {
    if (!vList) return;
    var list = document.querySelector("#live-list");
    var inner = document.querySelector("#live-list-inner");
    if (!list || !inner) return;
    var first = Math.floor((list.scrollTop - LIST_PAD_Y) / ROW_STRIDE) - LIST_BUFFER;
    var last = Math.ceil((list.scrollTop - LIST_PAD_Y + list.clientHeight) / ROW_STRIDE) + LIST_BUFFER;
    if (centerIdx != null) {
      first = Math.min(first, centerIdx - LIST_BUFFER);
      last = Math.max(last, centerIdx + LIST_BUFFER);
    }
    first = Math.max(0, first);
    last = Math.min(vList.channels.length - 1, last);
    var current = SN.current();
    Object.keys(vList.rendered).forEach(function (k) {
      var idx = Number(k);
      var row = vList.rendered[idx];
      if ((idx < first || idx > last) && row !== current && !(current && row.contains(current))) {
        row.remove();
        delete vList.rendered[idx];
      }
    });
    var fragment = document.createDocumentFragment();
    for (var i = first; i <= last; i++) {
      if (!vList.rendered[i]) {
        var row = createChannelRow(vList.channels[i], i);
        vList.rendered[i] = row;
        fragment.appendChild(row);
      }
    }
    inner.appendChild(fragment);
  }

  // Foca a linha de um canal, rolando até ela se precisar (ela pode ainda
  // não existir no DOM por causa da virtualização).
  function focusChannel(streamId, onHeart) {
    if (!vList) return false;
    var idx = -1;
    for (var i = 0; i < vList.channels.length; i++) {
      if (vList.channels[i].streamId === streamId) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return false;
    var list = document.querySelector("#live-list");
    var top = LIST_PAD_Y + idx * ROW_STRIDE;
    if (list && (top < list.scrollTop || top + ROW_H > list.scrollTop + list.clientHeight)) {
      list.scrollTop = Math.max(0, top - Math.floor((list.clientHeight - ROW_H) / 2));
    }
    syncListWindow(idx);
    var row = vList.rendered[idx];
    if (!row) return false;
    SN.setFocus(onHeart ? row.querySelector(".heart") : row);
    return true;
  }
  function renderList() {
    var inner = document.querySelector("#live-list-inner");
    var list = document.querySelector("#live-list");
    if (!inner || !list) return;
    var channels = filteredChannels();
    inner.innerHTML = "";
    inner.style.height = "";
    vList = null;
    if (state.loading) {
      inner.innerHTML = '<div style="color:#9A9AA5;padding:24px;">Carregando canais…</div>';
      return;
    }
    if (!channels.length) {
      // Catálogo que não carregou mostra o erro (antes "Nenhum canal nesta
      // categoria.", como se estivesse vazio).
      inner.innerHTML = state.failed ? '<div style="color:#FCA5A5;padding:24px;">Não foi possível carregar os canais. Volte e abra de novo pra tentar outra vez.</div>' : '<div style="color:#9A9AA5;padding:24px;">Nenhum canal nesta categoria.</div>';
      return;
    }
    vList = {
      channels: channels,
      favs: SessionStore.getFavorites().live || [],
      rendered: {}
    };
    inner.style.height = LIST_PAD_Y * 2 + channels.length * ROW_STRIDE - ROW_GAP + "px";
    if (list.scrollTop > LIST_PAD_Y * 2 + channels.length * ROW_STRIDE) list.scrollTop = 0;
    syncListWindow(null);
  }
  function createChannelRow(ch, idx) {
    var favs = vList.favs;
    {
      var toggleFav = function toggleFav() {
        var creds = SessionStore.loadCreds();
        SessionStore.toggleFavorite("live", {
          id: ch.streamId,
          name: ch.name,
          cover: ch.streamIcon,
          url: creds ? XtreamApi.playableLiveUrl(creds, ch) : null
        });
        renderList();
        // renderList() recria a lista -- sem isso, o foco ficava num
        // elemento morto depois de favoritar. Se o canal continua na lista
        // (ex.: "Todos"), volta pro coração dele; se sumiu (estava em
        // "Favoritos" e acabou de desfavoritar), cai pro 1º item.
        if (!focusChannel(ch.streamId, true)) SN.focusFirst(document.querySelector('.screen[data-screen="live"]'));
      };
      var row = document.createElement("div");
      row.className = "focusable live-row" + (state.selected && state.selected.streamId === ch.streamId ? " selected" : "");
      row.setAttribute("data-channel-id", ch.streamId);
      row.setAttribute("data-idx", String(idx));
      row.style.cssText = "position:absolute;left:" + LIST_PAD_X + "px;right:" + LIST_PAD_X + "px;top:" + (LIST_PAD_Y + idx * ROW_STRIDE) + "px;height:" + ROW_H + "px;box-sizing:border-box;";
      var isFav = favs.indexOf(ch.streamId) >= 0;
      // Número do servidor (17/11), o que se digita no controle.
      var num = ChannelNumber.pad3(ChannelNumber.displayNumber(ch, idx));
      row.innerHTML = '<div class="num">' + num + "</div>" + '<div class="icon">' + (ch.streamIcon ? '<img src="' + ch.streamIcon + '" />' : ch.name.charAt(0).toUpperCase()) + "</div>" + '<div class="info"><div class="name">' + ch.name + "</div>" + (ch.group ? '<div class="group">' + ch.group + "</div>" : "") + "</div>" +
      // #6B7280 (não "inherit") quando não favoritado -- igual
      // ChannelRow.kt (tint=Color(0xFF6B7280) no coração vazio); antes
      // herdava a cor branca do texto ao redor, mais chamativo do que
      // devia pra um ícone secundário sem estado nenhum.
      '<button class="focusable heart" tabindex="-1" style="color:' + (isFav ? "#EF4444" : "#6B7280") + ';">' + Icon(isFav ? "heart-filled" : "heart-outline") + "</button>";
      row.addEventListener("sn:enter", function () {
        selectOrPlay(ch);
      });
      row.querySelector(".heart").addEventListener("sn:enter", function (ev) {
        ev.stopPropagation();
        toggleFav();
      });
      // Segurar OK OU o botão AMARELO do controle com o CANAL (não só o
      // coração) focado também favorita -- pedido explícito/paridade com o
      // asterisco do Roku. Sem isso, só dava pra favoritar navegando até o
      // coração especificamente, um passo a mais que o Roku/Android não
      // exigem (lá, segurar OK no item inteiro já favorita, em qualquer
      // card/linha).
      row.addEventListener("sn:longpress", toggleFav);
      return row;
    }
  }
  function selectOrPlay(ch) {
    var creds = SessionStore.loadCreds();
    if (state.selected && state.selected.streamId === ch.streamId) {
      // Volta pra esta tela com a mesma categoria/busca e o canal
      // selecionado (antes voltava do zero, em Favoritos, sem foco no
      // canal que estava tocando -- mesma regra do Android).
      global.App.play({
        kind: "live",
        id: ch.streamId,
        title: ch.name,
        poster: ch.streamIcon,
        url: XtreamApi.playableLiveUrl(creds, ch),
        returnParams: {
          restore: {
            activeCategory: state.activeCategory,
            query: state.query,
            selectedId: ch.streamId
          }
        },
        // Lista aberta (categoria/busca) pra trocar de canal no player com
        // Cima/Baixo, CH+/CH- e os números do controle.
        channels: vList ? vList.channels : null
      });
      return;
    }
    state.selected = ch;
    // Só troca o destaque das linhas já desenhadas (não recria a lista).
    if (vList) {
      Object.keys(vList.rendered).forEach(function (k) {
        var r = vList.rendered[k];
        r.classList.toggle("selected", r.getAttribute("data-channel-id") === String(ch.streamId));
      });
    }
    renderPreview();
  }
  function renderPreview() {
    var el = document.querySelector("#live-preview");
    stopPreview();
    previewVideo = null;
    if (!state.selected) {
      el.innerHTML = '<div style="color:#6B7280;font-size:13px;">Selecione um canal pra ver a prévia.</div>';
      return;
    }
    var ch = state.selected;
    var creds = SessionStore.loadCreds();
    el.innerHTML = '<div style="color:#fff;font-size:16px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + ch.name + "</div>" + '<div style="color:#6B7280;font-size:11.5px;margin:4px 0 10px;">Selecione de novo pra assistir</div>' +
    // padding-top (56.25% = 9/16) em vez de aspect-ratio -- mesmo motivo
    // dos outros casos no app (Chromium 88+ só); wrapper relative +
    // vídeo absolute preenchendo, já que o vídeo é de largura fluida
    // (100% da coluna), não fixa.
    '<div style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;background:#000;overflow:hidden;">' + '<video id="live-preview-video" muted autoplay playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;"></video>' + "</div>" + '<div id="live-epg"></div>';
    var video = el.querySelector("#live-preview-video");
    previewVideo = video;
    try {
      video.src = XtreamApi.playableLiveUrl(creds, ch);
      video.play().catch(function () {});
    } catch (e) {}
    XtreamApi.getLiveEpgSchedule(creds, ch.streamId, 5).then(function (schedule) {
      if (!state.selected || state.selected.streamId !== ch.streamId) return;
      var epgEl = document.querySelector("#live-epg");
      if (!epgEl) return;
      var nowMs = Date.now();
      epgEl.innerHTML = schedule.map(function (entry) {
        // "Ao Vivo" só no que está passando AGORA: antes o 1º item ganhava
        // o selo sempre, mesmo começando horas depois.
        var isNow = entry.startMs <= nowMs && nowMs < entry.endMs;
        var progress = 0;
        if (isNow && entry.endMs > entry.startMs) progress = Math.min(1, Math.max(0, (Date.now() - entry.startMs) / (entry.endMs - entry.startMs)));
        var fmt = function fmt(ms) {
          var d = new Date(ms);
          return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        };
        return '<div class="epg-row' + (isNow ? " now" : "") + '">' + '  <div style="display:flex;align-items:center;gap:8px;">' + '    <span style="color:#9AA2B1;display:flex;flex-shrink:0;">' + Icon("live") + "</span>" + '    <span style="color:#fff;font-size:13px;font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + entry.title + "</span>" + '    <span style="font-size:10px;font-weight:900;padding:3px 10px;border-radius:20px;background:' + (isNow ? "rgba(239,68,68,0.2);color:#FCA5A5" : "rgba(22,163,74,0.13);color:#86EFAC") + ';">' + (isNow ? "Ao Vivo" : "Próximo") + "</span>" + "  </div>" + '  <div style="display:flex;justify-content:space-between;margin-top:6px;color:#9AA2B1;font-size:11px;">' + "    <span>" + fmt(entry.startMs) + " - " + fmt(entry.endMs) + "</span><span>" + Math.round(progress * 100) + "%</span>" + "  </div>" + (isNow ? '<div style="height:3px;border-radius:2px;background:rgba(255,255,255,0.2);margin-top:6px;"><div style="height:3px;border-radius:2px;background:var(--accent);width:' + progress * 100 + '%;"></div></div>' : "") + "</div>";
      }).join("");
    });
  }
  function stopPreview() {
    if (!previewVideo) return;
    try {
      previewVideo.pause();
      previewVideo.removeAttribute("src");
      previewVideo.load();
    } catch (e) {}
  }

  // ===== Número digitado no controle (pedido de cliente, 17/11) =====
  // O número do servidor (o do lado do nome), de qualquer categoria: vai
  // pro canal já com a prévia; OK nele abre em tela cheia, igual escolher
  // com as setas. Canal fora da categoria aberta: muda pra "Todos". Mesma
  // regra do Android (LiveScreen.kt).
  var listEntry = null;
  var byNumber = {
    map: {},
    max: 0
  };
  var BACK_KEYS = [461, 10009, 8];
  function goToChannelNumber(n) {
    var ch = byNumber.map[n];
    if (!ch) return;
    var inList = vList && vList.channels.some(function (c) {
      return c.streamId === ch.streamId;
    });
    if (!inList) {
      state.activeCategory = "all";
      state.query = "";
      ContentHeaderBar.updateSearch(document.querySelector('.screen[data-screen="live"] .screen-content'), "");
      renderCategories();
      renderList();
    }
    if (!(state.selected && state.selected.streamId === ch.streamId)) selectOrPlay(ch);
    focusChannel(ch.streamId);
  }

  // Na janela, antes da navegação (spatialnav.js escuta no document): o OK
  // com número digitado não pode chegar no canal focado (abriria ele).
  function onListKey(e) {
    if (!listEntry || !byNumber.max) return;
    var cur = SN.current();
    // Só com o foco nas categorias/lista/prévia: na busca e no teclado da
    // tela os números são texto.
    if (!cur || !cur.closest || !cur.closest('.screen[data-screen="live"] #live-categories, .screen[data-screen="live"] #live-list, .screen[data-screen="live"] #live-preview')) return;
    var digit = ChannelNumber.digitOfKey(e.keyCode);
    var consumed = false;
    if (digit !== null) {
      listEntry.type(digit);
      consumed = true;
    } else if (listEntry.active() && e.keyCode === 13) {
      listEntry.commitNow();
      consumed = true;
    } else if (listEntry.active() && BACK_KEYS.indexOf(e.keyCode) >= 0) {
      listEntry.clear();
      consumed = true;
    }
    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // TV mudou de app/entrou em espera: a prévia para de baixar o canal e
  // volta quando a tela aparece de novo.
  function onVisibilityChange() {
    if (document.hidden) {
      stopPreview();
      return;
    }
    if (state.selected) renderPreview();
  }
  function mount(params) {
    // Voltando do player: mesma categoria/busca e o canal que estava
    // tocando selecionado e focado (antes voltava do zero, em Favoritos).
    var restore = params && params.restore;
    // Reseta ANTES de render() -- render() já monta o chip de busca lendo
    // state.query; na ordem antiga (render() primeiro) isso ainda lia a
    // busca da visita ANTERIOR por um instante, só sumindo depois que as
    // linhas abaixo resetavam o state (bug pequeno encontrado relendo o
    // arquivo inteiro de novo com calma).
    state = {
      channels: [],
      categories: [],
      activeCategory: restore && restore.activeCategory || FAV_CATEGORY_ID,
      selected: null,
      loading: true,
      failed: false,
      query: restore && restore.query || ""
    };
    vList = null;
    render();
    var liveRoot = document.querySelector('.screen[data-screen="live"] .screen-content');
    byNumber = {
      map: {},
      max: 0
    };
    listEntry = ChannelNumber.createEntry({
      maxNumber: function maxNumber() {
        return byNumber.max;
      },
      channelFor: function channelFor(n) {
        return byNumber.map[n] || null;
      },
      badge: ChannelNumber.createBadge(liveRoot, 90, true),
      onCommit: goToChannelNumber
    });
    window.addEventListener("keydown", onListKey, true);
    var listEl = document.querySelector("#live-list");
    listEl.addEventListener("scroll", function () {
      if (vList) syncListWindow(null);
    });
    listEl.addEventListener("sn:focus", function (ev) {
      var idx = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-idx");
      if (idx == null && ev.target && ev.target.closest) {
        var row = ev.target.closest(".live-row");
        idx = row && row.getAttribute("data-idx");
      }
      if (vList && idx != null) syncListWindow(Number(idx));
    });
    document.addEventListener("visibilitychange", onVisibilityChange);
    renderCategories();
    renderList();
    renderPreview();
    // Entra com o foco na categoria ativa (antes ia pro topo, e a 1ª seta
    // pra baixo só chegava em Favoritos) -- mesmo ajuste do Android.
    var activeCat = document.querySelector('.screen[data-screen="live"] .live-cat.active');
    if (activeCat) SN.setFocus(activeCat);else SN.focusFirst(document.querySelector('.screen[data-screen="live"]'));
    var creds = SessionStore.loadCreds();
    if (!creds) return;
    XtreamApi.getLiveStreams(creds).then(function (channels) {
      state.channels = AdultGate.filterList(channels);
      state.loading = false;
      byNumber = ChannelNumber.indexByNumber(state.channels);
      if (restore && restore.selectedId != null) {
        state.selected = state.channels.find(function (c) {
          return c.streamId === restore.selectedId;
        }) || null;
      }
      var hadCatFocus = !SN.current() || !document.contains(SN.current()) || SN.current().classList && SN.current().classList.contains("live-cat");
      renderCategories();
      renderList();
      if (state.selected) {
        renderPreview();
        focusChannel(state.selected.streamId);
      } else if (hadCatFocus) {
        // As categorias foram redesenhadas: devolve o foco pra ativa.
        var activeCatEl = document.querySelector('.screen[data-screen="live"] .live-cat.active');
        if (activeCatEl) SN.setFocus(activeCatEl);
      }
    }).catch(function () {
      state.loading = false;
      state.failed = true;
      // Aviso pro painel no próximo heartbeat (ver js/data/appReport.js).
      if (global.AppReport) AppReport.recordError("catalog_failed");
      renderList();
    });
  }
  function unmount() {
    ContentHeaderBar.unbind();
    window.removeEventListener("keydown", onListKey, true);
    if (listEntry) {
      listEntry.clear();
      listEntry = null;
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
    stopPreview();
    previewVideo = null;
    vList = null;
  }
  global.LiveScreen = {
    ensureStyles: ensureStyles
  };
  Router.register("live", {
    mount: mount,
    unmount: unmount
  });
})(window);