/*
 * Grade de conteúdo reutilizável (Filmes/Séries) -- porta de
 * MoviesScreen.kt/SeriesScreen.kt: sidebar de categorias (Continuar +
 * Favoritos + Recém adicionados + categorias reais do provedor) + grade
 * de cards. Segurar OK favorita (mesmo gesto do MediaCard.kt); OK normal
 * abre.
 */
(function (global) {
  "use strict";

  var CONTINUE_ID = "__continue__";
  var FAV_ID = "__fav__";
  var RECENT_ID = "__recent__";
  var ALL_ID = "__all__";

  // Regex compilados UMA VEZ só (não a cada item) -- mesma lição já tirada
  // no Android (Categories.kt): um literal de regex em JS também é
  // reconstruído a cada avaliação, e normalizeForMatch/detectQualityTags
  // rodam por ITEM (até centenas por render, e são chamados nos outros
  // pontos de busca/filtro do app inteiro também). No Android isso media
  // ~40s num TV box real pra só montar as categorias de um catálogo
  // grande -- mesma classe de bug, resolvida do mesmo jeito.
  var DIACRITICS_RX = /(?:[\u0300-\u036F\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7-\u05C9\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B53-\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ABD\u1ABF-\u1AF0\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA82C\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]|\uD800[\uDDFD\uDEE0\uDF76-\uDF7A]|\uD802[\uDE01-\uDE03\uDE05\uDE06\uDE0C-\uDE0F\uDE38-\uDE3A\uDE3F\uDEE5\uDEE6]|\uD803[\uDD24-\uDD27\uDD69-\uDD6D\uDEAB\uDEAC\uDECB-\uDECF\uDEF0-\uDEFF\uDF46-\uDF50\uDF82-\uDF85]|\uD804[\uDC01\uDC38-\uDC46\uDC70\uDC73\uDC74\uDC7F-\uDC81\uDCB3-\uDCB6\uDCB9\uDCBA\uDCC2\uDD00-\uDD02\uDD27-\uDD2B\uDD2D-\uDD34\uDD73\uDD80\uDD81\uDDB6-\uDDBE\uDDC9-\uDDCC\uDDCF\uDE2F-\uDE31\uDE34\uDE36\uDE37\uDE3E\uDE41\uDEDF\uDEE3-\uDEEA\uDF00\uDF01\uDF3B\uDF3C\uDF40\uDF66-\uDF6C\uDF70-\uDF74\uDFBB-\uDFC0\uDFCE\uDFD0\uDFD2\uDFE1\uDFE2]|\uD805[\uDC38-\uDC3F\uDC42-\uDC44\uDC46\uDC5E\uDCB3-\uDCB8\uDCBA\uDCBF\uDCC0\uDCC2\uDCC3\uDDB2-\uDDB5\uDDBC\uDDBD\uDDBF\uDDC0\uDDDC\uDDDD\uDE33-\uDE3A\uDE3D\uDE3F\uDE40\uDEAB\uDEAD\uDEB0-\uDEB5\uDEB7\uDF1D\uDF1F\uDF22-\uDF25\uDF27-\uDF2B]|\uD806[\uDC2F-\uDC37\uDC39\uDC3A\uDD3B\uDD3C\uDD3E\uDD43\uDDD4-\uDDD7\uDDDA\uDDDB\uDDE0\uDE01-\uDE0A\uDE33-\uDE38\uDE3B-\uDE3E\uDE47\uDE51-\uDE56\uDE59-\uDE5B\uDE8A-\uDE96\uDE98\uDE99\uDF60\uDF62-\uDF64\uDF66]|\uD807[\uDC30-\uDC36\uDC38-\uDC3D\uDC3F\uDC92-\uDCA7\uDCAA-\uDCB0\uDCB2\uDCB3\uDCB5\uDCB6\uDD31-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD45\uDD47\uDD90\uDD91\uDD95\uDD97\uDDF0\uDEF3\uDEF4\uDF00\uDF01\uDF36-\uDF3A\uDF40\uDF42\uDF5A]|\uD80D[\uDC40\uDC47-\uDC55]|\uD818[\uDD1E-\uDD29\uDD2D-\uDD2F]|\uD81A[\uDEF0-\uDEF4\uDF30-\uDF36]|\uD81B[\uDF4F\uDF8F-\uDF92\uDFE4]|\uD82F[\uDC9D\uDC9E]|\uD833[\uDF00-\uDF2D\uDF30-\uDF46]|\uD834[\uDD27\uDD28\uDD67-\uDD69\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44\uDE5B\uDE5C]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A\uDC8F\uDD30-\uDD36\uDEAE\uDEEC-\uDEEF]|\uD839[\uDCEC-\uDCEF\uDDEE\uDDEF\uDEE3\uDEE6\uDEEE\uDEEF\uDEF5]|\uD83A[\uDCD0-\uDCD6\uDD44-\uDD4A]|\uDB40[\uDD00-\uDDEF])+/g;
  var TAG_4K_RX = /\b4k|uhd\b/;
  var TAG_HDR_RX = /\bhdr\b/;
  var TAG_LEG_RX = /\bleg(?:endado)?\b/;
  // \p{L}\p{N} (não a-z0-9): categoria só com letras não latinas (árabe,
  // cirílico...) virava "" e todas se fundiam em "Sem categoria" (mesmo
  // ajuste do Categories.kt).
  var NON_ALNUM_RX = /(?:[\0-\/:-@\[-`\{-\xA9\xAB-\xB1\xB4\xB6-\xB8\xBB\xBF\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u036F\u0375\u0378\u0379\u037E\u0380-\u0385\u0387\u038B\u038D\u03A2\u03F6\u0482-\u0489\u0530\u0557\u055A-\u055F\u0589\u058A\u058D-\u05CF\u05EB-\u05EE\u05F3-\u061F\u064B-\u065F\u066A-\u066D\u0670\u06D4\u06D6-\u06E4\u06E7-\u06ED\u06FD\u06FE\u0700-\u070F\u0711\u0730-\u074C\u07A6-\u07B0\u07B2-\u07BF\u07EB-\u07F3\u07F6-\u07F9\u07FB-\u07FF\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u083F\u0859-\u085F\u086B-\u086F\u0888\u0890-\u089F\u08CA-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962-\u0965\u0970\u0981-\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA-\u09BC\u09BE-\u09CD\u09CF-\u09DB\u09DE\u09E2-\u09E5\u09F2\u09F3\u09FA\u09FB\u09FD-\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A-\u0A58\u0A5D\u0A5F-\u0A65\u0A70\u0A71\u0A75-\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA-\u0ABC\u0ABE-\u0ACF\u0AD1-\u0ADF\u0AE2-\u0AE5\u0AF0-\u0AF8\u0AFA-\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A-\u0B3C\u0B3E-\u0B5B\u0B5E\u0B62-\u0B65\u0B70\u0B78-\u0B82\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BCF\u0BD1-\u0BE5\u0BF3-\u0C04\u0C0D\u0C11\u0C29\u0C3A-\u0C3C\u0C3E-\u0C57\u0C5B\u0C5E\u0C5F\u0C62-\u0C65\u0C70-\u0C77\u0C7F\u0C81-\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA-\u0CBC\u0CBE-\u0CDB\u0CDF\u0CE2-\u0CE5\u0CF0\u0CF3-\u0D03\u0D0D\u0D11\u0D3B\u0D3C\u0D3E-\u0D4D\u0D4F-\u0D53\u0D57\u0D62-\u0D65\u0D79\u0D80-\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DE5\u0DF0-\u0E00\u0E31\u0E34-\u0E3F\u0E47-\u0E4F\u0E5A-\u0E80\u0E83\u0E85\u0E8B\u0EA4\u0EA6\u0EB1\u0EB4-\u0EBC\u0EBE\u0EBF\u0EC5\u0EC7-\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F01-\u0F1F\u0F34-\u0F3F\u0F48\u0F6D-\u0F87\u0F8D-\u0FFF\u102B-\u103E\u104A-\u104F\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109F\u10C6\u10C8-\u10CC\u10CE\u10CF\u10FB\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B-\u1368\u137D-\u137F\u1390-\u139F\u13F6\u13F7\u13FE-\u1400\u166D\u166E\u1680\u169B-\u169F\u16EB-\u16ED\u16F9-\u16FF\u1712-\u171E\u1732-\u173F\u1752-\u175F\u176D\u1771-\u177F\u17B4-\u17D6\u17D8-\u17DB\u17DD-\u17DF\u17EA-\u17EF\u17FA-\u180F\u181A-\u181F\u1879-\u187F\u1885\u1886\u18A9\u18AB-\u18AF\u18F6-\u18FF\u191F-\u1945\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19FF\u1A17-\u1A1F\u1A55-\u1A7F\u1A8A-\u1A8F\u1A9A-\u1AA6\u1AA8-\u1B04\u1B34-\u1B44\u1B4D-\u1B4F\u1B5A-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BFF\u1C24-\u1C3F\u1C4A-\u1C4C\u1C7E\u1C7F\u1C8B-\u1C8F\u1CBB\u1CBC\u1CC0-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1CFB-\u1CFF\u1DC0-\u1DFF\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FBD\u1FBF-\u1FC1\u1FC5\u1FCD-\u1FCF\u1FD4\u1FD5\u1FDC-\u1FDF\u1FED-\u1FF1\u1FF5\u1FFD-\u206F\u2072\u2073\u207A-\u207E\u208A-\u208E\u20A0-\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A-\u245F\u249C-\u24E9\u2500-\u2775\u2794-\u2BFF\u2CE5-\u2CEA\u2CEF-\u2CF1\u2CF4-\u2CFC\u2CFE\u2CFF\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D70-\u2D7F\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF-\u2E2E\u2E30-\u3004\u3008-\u3020\u302A-\u3030\u3036\u3037\u303D-\u3040\u3097-\u309C\u30A0\u30FB\u3100-\u3104\u3130\u318F-\u3191\u3196-\u319F\u31C0-\u31EF\u3200-\u321F\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA48D-\uA4CF\uA4FE\uA4FF\uA60D-\uA60F\uA62C-\uA63F\uA66F-\uA67E\uA69E\uA69F\uA6F0-\uA716\uA720\uA721\uA789\uA78A\uA7DE-\uA7E1\uA7E3-\uA7F0\uA802\uA806\uA80B\uA823-\uA82F\uA836-\uA83F\uA874-\uA881\uA8B4-\uA8CF\uA8DA-\uA8F1\uA8F8-\uA8FA\uA8FC\uA8FF\uA926-\uA92F\uA947-\uA95F\uA97D-\uA983\uA9B3-\uA9CE\uA9DA-\uA9DF\uA9E5\uA9FF\uAA29-\uAA3F\uAA43\uAA4C-\uAA4F\uAA5A-\uAA5F\uAA77-\uAA79\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAC3-\uAADA\uAADE\uAADF\uAAEB-\uAAF1\uAAF5-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB5B\uAB6A\uAB6B\uAB6E\uAB6F\uABE3-\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uD7FF\uE000-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB1E\uFB29\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBB2-\uFBD2\uFD3E-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFC-\uFE6F\uFE75\uFEFD-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFFF]|\uD800[\uDC0C\uDC27\uDC3B\uDC3E\uDC4E\uDC4F\uDC5E-\uDC7F\uDCFB-\uDD06\uDD34-\uDD3F\uDD79-\uDD89\uDD8C-\uDE7F\uDE9D-\uDE9F\uDED1-\uDEE0\uDEFC-\uDEFF\uDF24-\uDF2C\uDF4B-\uDF4F\uDF76-\uDF7F\uDF9E\uDF9F\uDFC4-\uDFC7\uDFD0\uDFD6-\uDFFF]|\uD801[\uDC9E\uDC9F\uDCAA-\uDCAF\uDCD4-\uDCD7\uDCFC-\uDCFF\uDD28-\uDD2F\uDD64-\uDD6F\uDD7B\uDD8B\uDD93\uDD96\uDDA2\uDDB2\uDDBA\uDDBD-\uDDBF\uDDF4-\uDDFF\uDF37-\uDF3F\uDF56-\uDF5F\uDF68-\uDF7F\uDF86\uDFB1\uDFC0-\uDFFF]|\uD802[\uDC06\uDC07\uDC09\uDC36\uDC39-\uDC3B\uDC3D\uDC3E\uDC56\uDC57\uDC77\uDC78\uDC9F-\uDCA6\uDCB0-\uDCDF\uDCF3\uDCF6-\uDCFA\uDD1C-\uDD1F\uDD3A-\uDD3F\uDD5A-\uDD7F\uDDB8-\uDDBB\uDDD0\uDDD1\uDE01-\uDE0F\uDE14\uDE18\uDE36-\uDE3F\uDE49-\uDE5F\uDE7F\uDEA0-\uDEBF\uDEC8\uDEE5-\uDEEA\uDEF0-\uDEFF\uDF36-\uDF3F\uDF56\uDF57\uDF73-\uDF77\uDF92-\uDFA8\uDFB0-\uDFFF]|\uD803[\uDC49-\uDC7F\uDCB3-\uDCBF\uDCF3-\uDCF9\uDD24-\uDD2F\uDD3A-\uDD3F\uDD66-\uDD6E\uDD86-\uDE5F\uDE7F\uDEAA-\uDEAF\uDEB2-\uDEC1\uDEC8-\uDED8\uDEEF-\uDEFF\uDF28-\uDF2F\uDF46-\uDF50\uDF55-\uDF6F\uDF82-\uDFAF\uDFCC-\uDFDF\uDFF7-\uDFFF]|\uD804[\uDC00-\uDC02\uDC38-\uDC51\uDC70\uDC73\uDC74\uDC76-\uDC82\uDCB0-\uDCCF\uDCE9-\uDCEF\uDCFA-\uDD02\uDD27-\uDD35\uDD40-\uDD43\uDD45\uDD46\uDD48-\uDD4F\uDD73-\uDD75\uDD77-\uDD82\uDDB3-\uDDC0\uDDC5-\uDDCF\uDDDB\uDDDD-\uDDE0\uDDF5-\uDDFF\uDE12\uDE2C-\uDE3E\uDE41-\uDE7F\uDE87\uDE89\uDE8E\uDE9E\uDEA9-\uDEAF\uDEDF-\uDEEF\uDEFA-\uDF04\uDF0D\uDF0E\uDF11\uDF12\uDF29\uDF31\uDF34\uDF3A-\uDF3C\uDF3E-\uDF4F\uDF51-\uDF5C\uDF62-\uDF7F\uDF8A\uDF8C\uDF8D\uDF8F\uDFB6\uDFB8-\uDFD0\uDFD2\uDFD4-\uDFFF]|\uD805[\uDC35-\uDC46\uDC4B-\uDC4F\uDC5A-\uDC5E\uDC62-\uDC7F\uDCB0-\uDCC3\uDCC6\uDCC8-\uDCCF\uDCDA-\uDD7F\uDDAF-\uDDD7\uDDDC-\uDDFF\uDE30-\uDE43\uDE45-\uDE4F\uDE5A-\uDE7F\uDEAB-\uDEB7\uDEB9-\uDEBF\uDECA-\uDECF\uDEE4-\uDEFF\uDF1B-\uDF2F\uDF3C-\uDF3F\uDF47-\uDFFF]|\uD806[\uDC2C-\uDC9F\uDCF3-\uDCFE\uDD07\uDD08\uDD0A\uDD0B\uDD14\uDD17\uDD30-\uDD3E\uDD40\uDD42-\uDD4F\uDD5A-\uDD9F\uDDA8\uDDA9\uDDD1-\uDDE0\uDDE2\uDDE4-\uDDFF\uDE01-\uDE0A\uDE33-\uDE39\uDE3B-\uDE4F\uDE51-\uDE5B\uDE8A-\uDE9C\uDE9E-\uDEAF\uDEF9-\uDF09\uDF0B-\uDFBF\uDFE1-\uDFEF\uDFFA-\uDFFF]|\uD807[\uDC09\uDC2F-\uDC3F\uDC41-\uDC4F\uDC6D-\uDC71\uDC90-\uDCFF\uDD07\uDD0A\uDD31-\uDD45\uDD47-\uDD4F\uDD5A-\uDD5F\uDD66\uDD69\uDD8A-\uDD97\uDD99-\uDD9F\uDDAA-\uDDAF\uDDDC-\uDDDF\uDDEA-\uDDF0\uDDF2-\uDEDF\uDEF3-\uDF01\uDF03\uDF11\uDF34-\uDF4F\uDF5A-\uDFAF\uDFB1-\uDFBF\uDFD5-\uDFFF]|\uD808[\uDF9A-\uDFFF]|\uD809[\uDC70-\uDC74\uDD44-\uDD4F\uDE87-\uDFFF]|[\uD80A\uD812-\uD817\uD819\uD825-\uD82A\uD82D\uD82E\uD830-\uD832\uD836\uD83D\uD83F\uD87C\uD87D\uD87F\uD88E-\uD8B3\uD8C0-\uDBFF][\uDC00-\uDFFF]|\uD80B[\uDC00-\uDF8F\uDFF1-\uDFFF]|\uD80D[\uDC30-\uDC40\uDC47-\uDC5F]|\uD810[\uDFFB-\uDFFF]|\uD811[\uDE47-\uDFFF]|\uD818[\uDC00-\uDCFF\uDD1E-\uDD2F\uDD3A-\uDFFF]|\uD81A[\uDE39-\uDE3F\uDE5F\uDE6A-\uDE6F\uDEBF\uDECA-\uDECF\uDEEE-\uDEFF\uDF30-\uDF3F\uDF44-\uDF4F\uDF5A\uDF62\uDF78-\uDF7C\uDF90-\uDFFF]|\uD81B[\uDC00-\uDD3F\uDD6D-\uDD6F\uDD7A-\uDE3F\uDE97-\uDE9F\uDEB9\uDEBA\uDED4-\uDEFF\uDF4B-\uDF4F\uDF51-\uDF92\uDFA0-\uDFDF\uDFE2\uDFE4-\uDFF1\uDFF7-\uDFFF]|\uD823[\uDCDB-\uDCFE\uDD21-\uDD7F\uDDF3-\uDDFF]|\uD824[\uDD92-\uDD9F\uDDD3-\uDFFF]|\uD82B[\uDC00-\uDFEF\uDFF4\uDFFC\uDFFF]|\uD82C[\uDD29-\uDD31\uDD33-\uDD4F\uDD53\uDD54\uDD56-\uDD63\uDD69-\uDD6F\uDEFC-\uDFFF]|\uD82F[\uDC6B-\uDC6F\uDC7D-\uDC7F\uDC89-\uDC8F\uDC9A-\uDFFF]|\uD833[\uDC00-\uDCEF\uDCFA-\uDFFF]|\uD834[\uDC00-\uDEBF\uDED4-\uDEDF\uDEF4-\uDF5F\uDF79-\uDFFF]|\uD835[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA7\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3\uDFCC\uDFCD]|\uD837[\uDC00-\uDEFF\uDF82-\uDF8F\uDF97-\uDFCC]|\uD838[\uDC00-\uDC2F\uDC6E-\uDCFF\uDD2D-\uDD36\uDD3E\uDD3F\uDD4A-\uDD4D\uDD4F-\uDE8F\uDEAE-\uDEBF\uDEEC-\uDEEF\uDEFA-\uDFFF]|\uD839[\uDC00-\uDCCF\uDCEC-\uDCEF\uDCFA-\uDDCF\uDDEE\uDDEF\uDDFB-\uDEBF\uDEDF\uDEE3\uDEE6\uDEEE\uDEEF\uDEF5-\uDEFD\uDF00-\uDFDF\uDFE7\uDFEC\uDFEF\uDFFF]|\uD83A[\uDCC5\uDCC6\uDCD0-\uDCFF\uDD44-\uDD4A\uDD4C-\uDD4F\uDD5A-\uDFFF]|\uD83B[\uDC00-\uDC70\uDCAC\uDCB0\uDCB5-\uDD00\uDD2E\uDD3E-\uDDFF\uDE04\uDE20\uDE23\uDE25\uDE26\uDE28\uDE33\uDE38\uDE3A\uDE3C-\uDE41\uDE43-\uDE46\uDE48\uDE4A\uDE4C\uDE50\uDE53\uDE55\uDE56\uDE58\uDE5A\uDE5C\uDE5E\uDE60\uDE63\uDE65\uDE66\uDE6B\uDE73\uDE78\uDE7D\uDE7F\uDE8A\uDE9C-\uDEA0\uDEA4\uDEAA\uDEBC-\uDFFF]|\uD83C[\uDC00-\uDCFF\uDD0D-\uDFFF]|\uD83E[\uDC00-\uDFEF\uDFFA-\uDFFF]|\uD869[\uDEE0-\uDEFF]|\uD86E\uDC1F|\uD873[\uDEAE\uDEAF]|\uD87A[\uDFE1-\uDFEF]|\uD87B[\uDE5E-\uDFFF]|\uD87E[\uDE1E-\uDFFF]|\uD884[\uDF4B-\uDF4F]|\uD88D[\uDC7A-\uDFFF]|\uD8BF[\uDC40-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+/g;
  // TV com navegador antigo (Samsung 2015/2016) não tem Intl -- cai numa
  // comparação simples em vez de travar a tela inteira.
  var PT_BR_COLLATOR = typeof Intl !== "undefined" && Intl.Collator ? new Intl.Collator("pt-BR") : {
    compare: function compare(a, b) {
      a = String(a).toLowerCase();
      b = String(b).toLowerCase();
      return a < b ? -1 : a > b ? 1 : 0;
    }
  };
  var EDGE_DASH_RX = /^-+|-+$/g;
  // Separador comum em nome de categoria vindo de provedor de verdade
  // (ex.: "Filmes | Ação", "Filmes › Ação") -- pega só o ÚLTIMO trecho.
  var CATEGORY_SEPARATOR_RX = /\s*(?:\||›|»|>)\s*/;
  // Porta de Categories.kt: LAUNCH_CATEGORY_RX -- mesmo padrão usado pra
  // fixar a categoria de Lançamentos/Estreias no topo em vez de deixá-la
  // espalhada em ordem alfabética normal.
  var LAUNCH_CATEGORY_RX = /\b(lan[cç]amentos?|estreias?|novidades)\b/i;
  function normalizeForMatch(v) {
    return (v || "").normalize("NFD").replace(DIACRITICS_RX, "").toLowerCase().trim();
  }

  // Porta de Categories.kt (categoryLabel/categoryId/buildCategoryOptions/
  // pinMatchingCategoriesFirst) -- sem isso, a MESMA categoria do provedor
  // formatada de jeitos ligeiramente diferentes (acento, "Ação" vs "ACAO",
  // ou um prefixo "Filmes | ") virava DUAS abas separadas na sidebar em vez
  // de uma só (gap real encontrado comparando com as regras do Android,
  // depois do pedido "coloca todas as regras que tinha na Roku e Android").
  function categoryLabel(raw) {
    var trimmed = (raw || "").trim();
    if (!trimmed) return "Sem categoria";
    var parts = trimmed.split(CATEGORY_SEPARATOR_RX).map(function (s) {
      return s.trim();
    }).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : trimmed;
  }
  function categoryId(raw) {
    var label = categoryLabel(raw);
    var stripped = label.normalize("NFD").replace(DIACRITICS_RX, "").toLowerCase().replace(NON_ALNUM_RX, "-").replace(EDGE_DASH_RX, "");
    return stripped || "sem-categoria";
  }
  // Por nome de categoria do provedor (algumas centenas), não por item:
  // categoryId() tira acento e roda regex, e chamar isso nos 30 mil
  // filmes a cada troca de categoria travava a TV Samsung por segundos.
  var categoryMemo = {};
  function categoryIdCached(raw) {
    var key = raw == null ? "" : String(raw);
    if (!categoryMemo[key]) categoryMemo[key] = {
      id: categoryId(key),
      label: categoryLabel(key)
    };
    return categoryMemo[key];
  }

  // Selos de qualidade a partir do nome -- porta simplificada de
  // detectQualityTags (4K/HDR/Legendado), mesmos padrões de texto comuns
  // nos títulos dos provedores.
  function detectQualityTags(name) {
    var n = normalizeForMatch(name);
    var tags = [];
    if (TAG_4K_RX.test(n)) tags.push("4K");
    if (TAG_HDR_RX.test(n)) tags.push("HDR");
    if (TAG_LEG_RX.test(n)) tags.push("LEG");
    return tags;
  }

  // CSS de .cg-cat/.cg-card compartilhado -- favorites.js também usa essas
  // duas classes (mesma grade de cards, mesmo visual de categoria) mas não
  // passa necessariamente por create()/renderShell() primeiro. Bug real
  // encontrado no pente fino: antes esse <style> só era injetado aqui
  // dentro de renderShell(), que só roda quando Filmes/Séries montam -- ir
  // de Início direto pro coração de Favoritos (sem nunca ter aberto Filmes/
  // Séries antes) deixava a grade/categorias de Favoritos SEM estilo
  // nenhum. Exportado pra favorites.js chamar a própria independente da
  // ordem de navegação.
  function ensureCardStyles() {
    if (document.querySelector("#cg-style")) return;
    var style = document.createElement("style");
    style.id = "cg-style";
    style.textContent =
    // min-width:0 no botão + no nome (flex:1) + ellipsis -- sem isso,
    // categoria com nome comprido (comum em provedor de verdade, ex.
    // "Filmes - Heróis Sem Limites (Marvel & DC)") estourava a
    // largura fixa de 240px do painel em vez de cortar com "...",
    // desalinhando a barra inteira (bug real: "painel das categorias
    // tá muito bugado"). count com flex-shrink:0 pra nunca espremer.
    ".cg-cat{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);color:#F1F5F9;font-size:16px;font-weight:700;cursor:pointer;text-align:left;}" + ".cg-cat span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
    // Contagem num tom mais apagado que o rótulo (não a mesma cor) --
    // igual CategoryRow do Android (count usa muted/#64748B inativo,
    // preto 70% ativo, nunca a MESMA cor sólida do texto principal).
    ".cg-cat span:last-child{flex-shrink:0;color:#64748B;}" + ".cg-cat.active span:last-child{color:rgba(0,0,0,0.7);}" + ".cg-cat.active{background:var(--accent);color:#000;}" +
    // 3 estados de verdade igual CategoryStrip.kt (Android): ativo
    // (sólido) / focado-mas-não-ativo (tingido 35% + borda) / nenhum
    // (sutil) -- antes só tinha 2 (ativo e uma borda sem fundo
    // nenhum no foco), faltava o tingimento do meio. Ativo+focado ganha
    // borda BRANCA (antes sumia e o foco parecia ter desaparecido --
    // mesmo ajuste do Android).
    ".cg-cat.sn-focused{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 35%,transparent);}" + "@supports not (background: color-mix(in srgb, red, blue)) { .cg-cat.sn-focused{background:rgba(225,29,72,0.35);} }" + ".cg-cat.active.sn-focused{border-color:#fff !important;background:var(--accent);}" + ".cg-card{position:relative;border-radius:14px;overflow:hidden;background:#111827;border:2px solid rgba(255,255,255,0.06);cursor:pointer;}" + ".cg-card.sn-focused{border:3px solid var(--accent);transform:scale(1.06);}" +
    // height FIXO em px (não padding-top:150%) -- bug real confirmado ao
    // vivo: o "padding trick" (que funciona em CSS normal) colapsa pra
    // quase 0 de altura quando o elemento é filho de um grid item nesse
    // motor webOS específico (padding percentual não resolve direito
    // contra a largura do item de grid em algumas versões antigas de
    // Chromium -- bug de engine conhecido nessa combinação específica,
    // não do nosso CSS). Como a grade agora é sempre 8 colunas fixas
    // (não mais auto-fill responsivo), dá pra calcular o px exato: tela
    // 1920 - painel 300 - padding 48 = 1572px úteis; 8 colunas + 7 gaps
    // de 14px = (1572-98)/8 ≈ 184px de coluna; 150% disso ≈ 276px.
    // Recalculado quando o painel de categorias passou de 240 pra
    // 300px -- esse valor TEM que acompanhar PAD/COLS/GAP/largura do
    // painel lá em cima, senão a capa fica levemente fora de proporção
    // (não quebra, só distorce um pouco) em relação à largura real da
    // coluna calculada em JS (ver colW em renderGrid()).
    ".cg-card .cover-wrap{position:relative;width:100%;height:276px;background:#1a1f2b;}" + ".cg-card .cover{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;display:block;}" + ".cg-card .badge{position:absolute;top:8px;left:8px;background:var(--accent);color:#000;font-size:10px;font-weight:900;padding:3px 8px;border-radius:20px;}" +
    // Coluna no canto oposto ao selo -- estrela de favorito + selos de
    // qualidade (4K/HDR/LEG) empilhados, igual MediaCard.kt. Antes só a
    // estrela existia; detectQualityTags() já era chamado em
    // renderGrid() mas o resultado nunca ia pro HTML do card (bug real:
    // selo calculado e jogado fora).
    ".cg-card .tags{position:absolute;top:8px;right:8px;display:flex;flex-direction:column;align-items:flex-end;gap:3px;}" +
    // Cor padrão do Ukano (não mais dourado) -- pedido explícito,
    // mesma paridade aplicada no Roku/Android.
    ".cg-card .fav-star{color:#E11D48;font-size:14px;}" + ".cg-card .tag{background:rgba(0,0,0,0.8);color:#fff;font-size:9px;font-weight:900;padding:2px 5px;border-radius:4px;}" +
    // Ancorada no .cover-wrap (não no card inteiro) -- com a grade
    // responsiva (grid-template-columns:auto-fill,minmax(130px,1fr)), um
    // "bottom" fixo em pixels relativo ao CARD desalinhava com o fim da
    // capa conforme a largura real do card mudava; aqui sempre encosta
    // no pé da imagem, que é onde o Android desenha (align(BottomStart)
    // dentro do Box da imagem, não do card).
    ".cg-card .progress-track{position:absolute;left:4px;right:4px;bottom:3px;height:3px;border-radius:2px;background:rgba(255,255,255,0.4);}" + ".cg-card .progress-fill{height:3px;border-radius:2px;background:var(--accent);}" +
    // Selo de "assistido" -- canto inferior esquerdo da capa, círculo
    // sólido com check, igual ao estilo do selo de qualidade (fundo
    // escuro semi-transparente) mas com a cor do tema pra se destacar
    // como um estado "positivo" (concluído), não só mais uma etiqueta.
    // Cor FIXA do Ukano (não var(--accent)) -- mesma paridade do Roku/Android.
    ".cg-card .watched-badge{position:absolute;left:6px;bottom:6px;width:20px;height:20px;border-radius:50%;background:#E11D48;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;}" +
    // -webkit-line-clamp:2 (não só min-height) -- igual minLines=maxLines=2
    // do Android: título de 1 linha ainda reserva a altura de 2 (fica com
    // espaço vazio embaixo, de propósito) E título longo corta com "..." em
    // vez de estourar -- os dois garantem a MESMA altura de legenda pra
    // qualquer card da mesma fileira. min-height sozinho (antes) só
    // cobria o caso "curto", não o caso "longo estourando".
    // Pedido explícito, confirmado ao vivo na TV: 12px/32px ficava ilegível
    // vendo do sofá. min-height recalculado pro mesmo invariante de 2
    // linhas sempre reservadas (15px * 1.3 de line-height * 2 linhas).
    ".cg-card .cap{background:rgba(0,0,0,0.55);padding:8px 10px;color:#E2E8F0;font-size:15px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:40px;}";
    document.head.appendChild(style);
  }

  // Virtualização da grade -- mesma ideia do LazyVerticalGrid (Android)/
  // componente de lista nativo do Roku: só os cards perto da área visível
  // viram elementos de DOM de verdade; o resto nem existe até rolar perto.
  // Sem isso, 300 cards reais na tela (bug real testado ao vivo: travava
  // de verdade com catálogo grande, catálogo pequeno "ajustava" normal)
  // custam caro de 2 jeitos: o layout/paint inicial de 300 elementos de
  // uma vez, E o motor de navegação espacial (spatialnav.js/candidates())
  // que faz getBoundingClientRect() em CADA .focusable visível a CADA
  // tecla de seta -- com 300 cards, isso é 300 cálculos de geometria por
  // tecla apertada, não só na entrada da tela.
  var COLS = 8,
    GAP = 14,
    PAD = 24,
    COVER_H = 288,
    CAP_H = 48,
    ROW_H = COVER_H + CAP_H + GAP;
  var BUFFER_ROWS = 2;
  function create(opts) {
    // opts: { screenName, title, kind ("movie"|"series"), badge, searchPlaceholder,
    //         onOpen(item, resumeEpisodeId, back) } -- back = { screen, params } pra voltar
    var state = {
      items: [],
      loading: true,
      failed: false,
      activeCategory: FAV_ID,
      query: "",
      sort: "recent"
    };
    var vState = null; // { items, favs, cw, colW, totalRows, rendered: {idx: el} } -- ver renderGrid()/syncWindow()
    // Referências cacheadas na própria TELA (não document.querySelector("#id")
    // global) -- Filmes e Séries usam ContentGrid.create() cada um com o
    // MESMO id (#cg-grid/#cg-categories/#cg-count/#cg-search/#cg-sort)
    // dentro do seu próprio .screen[data-screen=...]. Bug real grave
    // encontrado ao vivo: document.querySelector("#cg-grid") sem escopo
    // sempre acha o PRIMEIRO elemento com esse id no documento inteiro
    // (Filmes vem antes de Séries no index.html) -- visitar Filmes e DEPOIS
    // Séries fazia renderGrid()/renderCategories() de Séries escreverem
    // dentro do #cg-grid ESCONDIDO de Filmes, deixando a tela de Séries
    // (ativa, visível) vazia pra sempre, "travada" sem erro nenhum no
    // console. Cada instância de create() (uma por tela) guarda a própria
    // referência aqui, setada 1x em renderShell(), nunca mais re-buscada
    // pelo documento inteiro.
    var els = {};
    function fetchItems(creds) {
      return opts.kind === "movie" ? XtreamApi.getVod(creds) : XtreamApi.getSeries(creds);
    }
    function itemId(it) {
      return opts.kind === "movie" ? it.streamId : it.seriesId;
    }
    function itemCover(it) {
      return opts.kind === "movie" ? it.streamIcon : it.cover;
    }
    function itemAddedTs(it) {
      if (opts.kind === "movie" && it.added) {
        var n = parseInt(it.added, 10);
        return isNaN(n) ? 0 : n;
      }
      if (opts.kind === "series" && it.lastModified) {
        var n2 = parseInt(it.lastModified, 10);
        return isNaN(n2) ? 0 : n2;
      }
      return 0;
    }

    // ids (streamId ou seriesId) com progresso salvo -- pra série, cada
    // ENTRADA de continue-watching é por episódio (kind:"series"), não
    // por show, então agrupa pelo campo seriesId gravado no player
    // (ver player.js/ContinueWatching.onProgress).
    function continueIds() {
      var cw = ContinueWatching.load();
      if (opts.kind === "movie") {
        return cw.filter(function (it) {
          return it.kind === "movie";
        }).map(function (it) {
          return it.id;
        });
      }
      // Série fica em "Continuar" tanto com episódio EM ANDAMENTO quanto
      // com pelo menos 1 episódio já CONCLUÍDO -- pedido explícito: quem
      // terminou de assistir 1 episódio normalmente quer ver o próximo
      // depois; antes a série sumia de "Continuar" assim que o episódio
      // atual terminava (ele é removido do "em andamento" nesse momento),
      // ficando ruim pra achar o próximo episódio de novo.
      var inProgress = cw.filter(function (it) {
        return it.kind === "series" && it.seriesId;
      }).map(function (it) {
        return it.seriesId;
      });
      var completed = ContinueWatching.completedSeriesIds();
      var all = inProgress.concat(completed);
      return all.filter(function (id, i) {
        return all.indexOf(id) === i;
      });
    }

    // Tudo que depende só do catálogo é calculado UMA vez quando ele chega
    // (e reaproveitado ao voltar do detalhe, se o catálogo e o +18 não
    // mudaram): categoria e data de cada item, a lista já ordenada por
    // recentes, os 300 recentes e as categorias com contagem. Trocar de
    // categoria vira só um filtro, sem ordenar nem tirar acento de nada.
    // Medido na TV Samsung 2019 antes disso: 4-7 s de tela congelada ao
    // abrir Filmes, trocar categoria ou voltar do detalhe.
    var prepared = null; // { src, unlocked, items, recent, recentTop, az, realCats }
    function prepare(list) {
      var unlocked = AdultGate.isUnlocked();
      if (prepared && prepared.src === list && prepared.unlocked === unlocked) return prepared;
      var items = AdultGate.filterList(list);
      var counts = {};
      var order = [];
      var labelById = {};
      items.forEach(function (it) {
        if (it._cat === undefined) {
          var c = categoryIdCached(it.group);
          it._cat = c.id;
          it._catLabel = c.label;
          it._ts = itemAddedTs(it);
        }
        if (!counts[it._cat]) {
          counts[it._cat] = 0;
          order.push(it._cat);
          labelById[it._cat] = it._catLabel;
        }
        counts[it._cat]++;
      });
      // Ordem estável (desempate pela posição original): filtrar esta lista
      // já ordenada dá o mesmo resultado que ordenar cada filtro.
      var recent = items.map(function (it, i) {
        return {
          it: it,
          i: i
        };
      });
      recent.sort(function (a, b) {
        return b.it._ts - a.it._ts || a.i - b.i;
      });
      recent = recent.map(function (x) {
        return x.it;
      });
      var realCats = order.map(function (id) {
        return {
          id: id,
          label: labelById[id],
          count: counts[id]
        };
      });
      realCats.sort(function (a, b) {
        return PT_BR_COLLATOR.compare(a.label, b.label);
      });
      prepared = {
        src: list,
        unlocked: unlocked,
        items: items,
        recent: recent,
        az: null,
        realCats: realCats,
        // Mesmo limite da grade (os 300 mais novos).
        recentTop: recent.filter(function (it) {
          return it._ts > 0;
        }).slice(0, 300)
      };
      return prepared;
    }
    // A-Z só quando alguém pede (ordenar 30 mil nomes com acento é caro).
    function sortedAz() {
      if (!prepared.az) {
        prepared.az = prepared.items.slice();
        prepared.az.sort(function (a, b) {
          return PT_BR_COLLATOR.compare(a.name, b.name);
        });
      }
      return prepared.az;
    }
    function itemNorm(it) {
      if (it._norm === undefined) it._norm = normalizeForMatch(it.name);
      return it._norm;
    }
    function buildCategories() {
      var favs = SessionStore.getFavorites()[opts.kind] || [];
      var continuing = continueIds();
      var recentCount = prepared ? prepared.recentTop.length : 0;
      var cats = [{
        id: CONTINUE_ID,
        label: Icon("refresh") + " Continuar",
        count: continuing.length
      }, {
        id: FAV_ID,
        label: Icon("heart-filled") + " Favoritos",
        count: favs.length
      }, {
        id: RECENT_ID,
        label: Icon("plus") + " Recém adicionados",
        count: recentCount
      }, {
        id: ALL_ID,
        label: "Todos",
        count: prepared ? prepared.items.length : 0
      }];
      // Fixa (não duplica) a categoria REAL cujo nome bate com Lançamentos/
      // Estreias/Novidades logo depois das sintéticas, em vez de deixá-la
      // espalhada em ordem alfabética normal -- mesma regra de
      // pinMatchingCategoriesFirst (Categories.kt).
      var realCats = prepared ? prepared.realCats : [];
      var launch = realCats.filter(function (c) {
        return LAUNCH_CATEGORY_RX.test(c.label);
      });
      var rest = realCats.filter(function (c) {
        return !LAUNCH_CATEGORY_RX.test(c.label);
      });
      return cats.concat(launch, rest);
    }
    function filteredItems() {
      var favs = SessionStore.getFavorites()[opts.kind] || [];
      var continuing = continueIds();
      // Filtra ANTES de ordenar (não o catálogo inteiro) -- bug real
      // encontrado testando no aparelho: com o catálogo pré-carregado
      // (cache já pronto), ordenar todo o acervo (às vezes dezenas de
      // milhares de itens, localeCompare é caro) toda vez que a grade
      // renderiza travava a tela bem na hora de entrar em Filmes/Séries.
      // Filtrar primeiro reduz pra um subconjunto pequeno (categoria/
      // favoritos/busca) antes do sort caro -- mesmo resultado final,
      // muito mais barato.
      if (!prepared) return [];
      // A base já vem ordenada (prepare()/sortedAz()): filtrar mantém a
      // ordem, então nenhuma troca de categoria precisa ordenar de novo.
      var base = state.sort === "az" ? sortedAz() : prepared.recent;
      function idSet(ids) {
        var set = {};
        ids.forEach(function (id) {
          set[id] = true;
        });
        return set;
      }
      if (state.query.trim()) {
        var q = normalizeForMatch(state.query);
        return base.filter(function (it) {
          return itemNorm(it).indexOf(q) >= 0;
        });
      }
      if (state.activeCategory === CONTINUE_ID) {
        var cont = idSet(continuing);
        return base.filter(function (it) {
          return cont[itemId(it)] === true;
        });
      }
      if (state.activeCategory === FAV_ID) {
        var fav = idSet(favs);
        return base.filter(function (it) {
          return fav[itemId(it)] === true;
        });
      }
      // Só "Recém adicionados" tem limite (os 300 mais novos, igual o
      // Android). A grade é virtualizada (só desenha o que está visível),
      // então "Todos" e as categorias grandes vão inteiras.
      if (state.activeCategory === RECENT_ID) {
        if (state.sort !== "az") return prepared.recentTop;
        var top = idSet(prepared.recentTop.map(itemId));
        return base.filter(function (it) {
          return top[itemId(it)] === true;
        });
      }
      if (state.activeCategory === ALL_ID) return base;
      var cat = state.activeCategory;
      return base.filter(function (it) {
        return it._cat === cat;
      });
    }
    function renderShell() {
      var root = document.querySelector('.screen[data-screen="' + opts.screenName + '"] .screen-content');
      root.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;">' + ContentHeaderBar.html({
        title: opts.title,
        search: {
          value: state.query,
          placeholder: "Buscar " + opts.title.toLowerCase() + "…"
        },
        trailingHtml: opts.kind === "movie" ? '<button class="focusable" id="cg-sort" style="background:rgba(255,255,255,0.06);border:2px solid transparent;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;cursor:pointer;flex-shrink:0;">' + Icon("sort") + " " + (state.sort === "az" ? "A-Z" : "Recentes") + "</button>" : ""
      }) + '  <div style="flex:1;display:flex;overflow:hidden;">' +
      // 300px (era 240px) -- pedido explícito: painel estreito demais
      // pra TV. colW do grid (ver renderGrid()) é calculado a partir da
      // largura real que sobra, então aumentar aqui não precisa de
      // nenhum ajuste manual na grade -- ela se adapta sozinha.
      '    <div id="cg-categories" style="width:300px;background:rgba(11,11,16,0.9);overflow-y:auto;padding:12px 10px;display:flex;flex-direction:column;gap:8px;" data-sn-scroll></div>' + '    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">' + '      <div class="screen-header"><div class="title" id="cg-count" style="letter-spacing:2.5px;"></div><div class="hint">Segure OK ou aperte o botão amarelo pra favoritar</div></div>' +
      // 8 colunas fixas (COLS no topo do arquivo) -- pedido explícito: no
      // máximo 8 por linha, cartão bem maior, espaço de verdade pro
      // texto. position:relative (não display:grid) -- a grade
      // virtualizada posiciona cada card com position:absolute calculado
      // à mão (ver createCard()/syncWindow() abaixo), não CSS Grid.
      '      <div id="cg-grid" style="flex:1;overflow-y:auto;position:relative;" data-sn-scroll></div>' + "    </div>" + "  </div>" + "</div>";
      ensureCardStyles();

      // Cacheia TUDO escopado dentro de `root` (não document.querySelector
      // global) -- ver comentário grande em `els` lá em cima.
      els.root = root;
      els.grid = root.querySelector("#cg-grid");
      els.categories = root.querySelector("#cg-categories");
      els.count = root.querySelector("#cg-count");
      els.sort = root.querySelector("#cg-sort");

      // Listeners de rolagem/foco anexados UMA VEZ aqui (renderShell() só
      // roda 1x por mount) -- renderGrid() é chamado várias vezes depois
      // (trocar categoria/busca/ordenação) reaproveitando o MESMO #cg-grid,
      // então anexar isso lá dentro empilharia um listener a mais a cada
      // troca (bug de vazamento que criaria sync() duplicado/triplicado
      // com o tempo).
      els.grid.addEventListener("scroll", function () {
        if (vState) syncWindow(null);
      });
      els.grid.addEventListener("sn:focus", function (ev) {
        var idx = ev.target.getAttribute("data-idx");
        if (vState && idx !== null) syncWindow(Math.floor(Number(idx) / COLS));
      });
      ContentHeaderBar.bind(root, function () {
        Router.go("home");
      }, {
        onSearchOpen: function onSearchOpen() {
          Keyboard.open({
            label: "Buscar " + opts.title.toLowerCase(),
            initialValue: state.query
          }).then(function (v) {
            if (v === null) return;
            state.query = v.trim();
            ContentHeaderBar.updateSearch(els.root, state.query);
            renderCategories();
            renderGrid();
          });
        }
      });
      if (els.sort) els.sort.addEventListener("sn:enter", function () {
        state.sort = state.sort === "az" ? "recent" : "az";
        els.sort.innerHTML = Icon("sort") + " " + (state.sort === "az" ? "A-Z" : "Recentes");
        renderGrid();
      });
    }
    function renderCategories() {
      var el = els.categories;
      if (!el) return;
      var cats = buildCategories();
      el.innerHTML = "";
      cats.forEach(function (cat) {
        var btn = document.createElement("button");
        btn.className = "focusable cg-cat" + (cat.id === state.activeCategory && !state.query ? " active" : "");
        btn.innerHTML = "<span>" + cat.label + "</span><span>" + cat.count + "</span>";
        btn.setAttribute("data-cat-id", cat.id);
        btn.addEventListener("sn:enter", function () {
          state.activeCategory = cat.id;
          state.query = "";
          ContentHeaderBar.updateSearch(els.root, "");
          renderCategories();
          renderGrid();
          // Mesmo fix de foco de live.js -- sem isso, trocar categoria
          // perdia o foco igualzinho (o bug mais visível da auditoria,
          // já que é a ação mais comum em Filmes/Séries). Escopado em
          // els.categories (não document inteiro) -- Filmes e Séries podem
          // ter a MESMA data-cat-id (ex. "__fav__"), mesmo bug de colisão
          // de id do #cg-grid.
          var sameCat = els.categories.querySelector('[data-cat-id="' + cat.id + '"]');
          if (sameCat) SN.setFocus(sameCat);
        });
        el.appendChild(btn);
      });
    }

    // Cria o elemento de UM card (index = posição dele na lista inteira,
    // usado pra calcular linha/coluna e pra achar progresso/favorito só
    // dele). Extraído do antigo loop de renderGrid() -- agora é chamado
    // sob demanda por syncWindow(), não de uma vez pra todos os itens.
    function createCard(it, index) {
      var id = itemId(it);
      var isFav = vState.favs.indexOf(id) >= 0;
      var tags = detectQualityTags(it.name);
      var progress = 0;
      var watched = false;
      if (opts.kind === "movie") {
        var cwEntry = vState.cw.find(function (e) {
          return e.id === id && e.kind === "movie";
        });
        if (cwEntry && cwEntry.durationSec > 0) progress = cwEntry.positionSec / cwEntry.durationSec;
        // Selo de "assistido" -- pedido explícito: marcar visualmente o
        // que já foi concluído, não só o que está em andamento (que já
        // tinha a barra de progresso). Só filme aqui -- série mostra isso
        // por EPISÓDIO (ver seriesDetail.js), não faz sentido marcar o
        // card da série inteira como "assistida" de uma vez.
        watched = ContinueWatching.isCompleted(id, "movie");
      }
      var row = Math.floor(index / COLS),
        col = index % COLS;
      var card = document.createElement("div");
      card.className = "focusable cg-card";
      card.tabIndex = -1;
      card.setAttribute("data-item-id", id);
      card.setAttribute("data-idx", index);
      card.style.position = "absolute";
      card.style.left = PAD + col * (vState.colW + GAP) + "px";
      card.style.top = PAD + row * ROW_H + "px";
      card.style.width = vState.colW + "px";
      card.innerHTML = '<div class="cover-wrap"><img class="cover" src="' + (itemCover(it) || "") + '" loading="lazy" onerror="this.style.visibility=\'hidden\'" />' + '<span class="badge">' + opts.badge + "</span>" + (isFav || tags.length ? '<div class="tags">' + (isFav ? '<span class="fav-star">★</span>' : "") + tags.map(function (t) {
        return '<span class="tag">' + t + "</span>";
      }).join("") + "</div>" : "") + (watched ? '<span class="watched-badge">' + Icon("check") + "</span>" : "") + (progress > 0 ? '<div class="progress-track"><div class="progress-fill" style="width:' + Math.min(100, progress * 100) + '%;"></div></div>' : "") + "</div>" + '<div class="cap">' + it.name + "</div>";
      card.addEventListener("sn:enter", function () {
        // "De onde veio": o detalhe (e o player depois dele) devolve isso
        // ao voltar, e mount() reabre na mesma categoria/busca/ordem com o
        // foco neste card. Antes a tela recomeçava em Favoritos.
        var back = {
          screen: opts.screenName,
          params: {
            restore: {
              activeCategory: state.activeCategory,
              query: state.query,
              sort: state.sort,
              selectedId: id
            }
          }
        };
        if (opts.kind === "series") {
          var entry = vState.cw.find(function (e) {
            return e.kind === "series" && e.seriesId === id;
          });
          opts.onOpen(it, entry ? entry.id : null, back);
        } else {
          opts.onOpen(it, null, back);
        }
      });
      card.addEventListener("sn:longpress", function () {
        var creds = SessionStore.loadCreds();
        var url = creds && opts.kind === "movie" ? XtreamApi.playableVodUrl(creds, it) : null;
        SessionStore.toggleFavorite(opts.kind, {
          id: id,
          name: it.name,
          cover: itemCover(it),
          url: url
        });
        // Recria só ESTE card (não a janela inteira) -- reflete a
        // estrela/contagem de Favoritos sem precisar re-sincronizar os
        // outros cards já renderizados. Mesmo cuidado de sempre devolver
        // o foco pro mesmo item (bug da auditoria original).
        vState.favs = SessionStore.getFavorites()[opts.kind] || [];
        card.remove();
        var fresh = createCard(it, index);
        vState.rendered[index] = fresh;
        if (els.grid) els.grid.appendChild(fresh);
        SN.setFocus(fresh);
        renderCategories();
      });
      return card;
    }

    // Garante que os cards entre [startRow,endRow] (+ o que já tiver sido
    // pedido via centerRow, ex.: a linha que acabou de ganhar foco) existem
    // de verdade no DOM, e remove os que ficaram longe demais da área
    // visível -- nunca remove o card com foco atual, mesmo que ele tenha
    // saído da janela calculada (evita SN.current() apontar pra um
    // elemento desconectado do documento).
    function syncWindow(centerRow) {
      if (!vState) return;
      var grid = els.grid;
      if (!grid) return;
      var viewportH = grid.clientHeight;
      var scrollTop = grid.scrollTop;
      var firstVisibleRow = Math.floor((scrollTop - PAD) / ROW_H);
      var lastVisibleRow = Math.ceil((scrollTop - PAD + viewportH) / ROW_H);
      var startRow = Math.max(0, firstVisibleRow - BUFFER_ROWS);
      var endRow = Math.min(vState.totalRows - 1, lastVisibleRow + BUFFER_ROWS);
      if (centerRow !== null && centerRow !== undefined) {
        startRow = Math.min(startRow, Math.max(0, centerRow - BUFFER_ROWS));
        endRow = Math.max(endRow, Math.min(vState.totalRows - 1, centerRow + BUFFER_ROWS));
      }
      var startIdx = startRow * COLS;
      var endIdx = Math.min(vState.items.length - 1, (endRow + 1) * COLS - 1);
      var current = SN.current();
      Object.keys(vState.rendered).forEach(function (k) {
        var idx = Number(k);
        if ((idx < startIdx || idx > endIdx) && vState.rendered[idx] !== current) {
          vState.rendered[idx].remove();
          delete vState.rendered[idx];
        }
      });
      var fragment = document.createDocumentFragment();
      for (var i = startIdx; i <= endIdx; i++) {
        if (!vState.rendered[i]) {
          var card = createCard(vState.items[i], i);
          vState.rendered[i] = card;
          fragment.appendChild(card);
        }
      }
      grid.appendChild(fragment);
    }
    function renderGrid() {
      var grid = els.grid;
      var countEl = els.count;
      if (!grid) return;
      if (state.loading) {
        grid.innerHTML = '<div style="color:#9A9AA5;">Carregando…</div>';
        if (countEl) countEl.textContent = opts.title.toUpperCase();
        vState = null;
        return;
      }
      var items = filteredItems();
      if (countEl) countEl.textContent = opts.title.toUpperCase() + "  ·  " + items.length;
      grid.innerHTML = "";
      grid.style.height = "";
      if (!items.length) {
        // Catálogo que não carregou mostra o erro (antes "Nada por aqui
        // ainda.", como se a lista estivesse vazia).
        grid.innerHTML = state.failed ? '<div style="color:#FCA5A5;">Não foi possível carregar o catálogo. Volte e abra de novo pra tentar outra vez.</div>' : '<div style="color:#9A9AA5;">Nada por aqui ainda.</div>';
        vState = null;
        return;
      }

      // clientWidth já inclui o padding (24px cada lado) -- o conteúdo
      // útil pras colunas é isso menos os 2 paddings.
      var contentW = grid.clientWidth - PAD * 2;
      var colW = (contentW - (COLS - 1) * GAP) / COLS;
      var totalRows = Math.ceil(items.length / COLS);
      vState = {
        items: items,
        favs: SessionStore.getFavorites()[opts.kind] || [],
        cw: ContinueWatching.load(),
        colW: colW,
        totalRows: totalRows,
        rendered: {}
      };
      // Altura total explícita -- sem isso o contêiner (agora
      // position:relative, sem display:grid) não tem como saber quão alto
      // ficar, já que todo card é position:absolute (fora do fluxo normal,
      // não "empurra" altura nenhuma sozinho). É isso que faz a barra de
      // rolagem representar a lista INTEIRA mesmo só uns poucos cards
      // existindo de verdade no DOM a cada momento.
      grid.style.height = PAD * 2 + totalRows * ROW_H - GAP + "px";
      syncWindow(0);
    }

    // Voltando do detalhe: rola a grade até o card que foi aberto e foca
    // nele. false se ele não está mais na lista (ex.: saiu dos favoritos).
    function focusItem(id) {
      if (!vState || !els.grid) return false;
      var idx = -1;
      for (var i = 0; i < vState.items.length; i++) if (itemId(vState.items[i]) === id) {
        idx = i;
        break;
      }
      if (idx < 0) return false;
      var row = Math.floor(idx / COLS);
      els.grid.scrollTop = Math.max(0, PAD + (row - 1) * ROW_H);
      syncWindow(row);
      var card = vState.rendered[idx];
      if (!card) return false;
      SN.setFocus(card);
      return true;
    }
    function mount(params) {
      var restore = params && params.restore || null;
      state.items = [];
      state.loading = true;
      state.failed = false;
      state.activeCategory = restore && restore.activeCategory || FAV_ID;
      state.query = restore && restore.query || "";
      state.sort = restore && restore.sort || "recent";
      renderShell();
      renderCategories();
      renderGrid();
      // Entra com o foco na categoria ativa (mesmo ajuste do Android).
      var activeCat = document.querySelector('.screen[data-screen="' + opts.screenName + '"] .cg-cat.active');
      if (activeCat) SN.setFocus(activeCat);else SN.focusFirst(document.querySelector('.screen[data-screen="' + opts.screenName + '"]'));
      // Categoria restaurada que é do provedor só aparece depois do
      // catálogo: até lá o foco fica na seta de voltar, e isso também
      // conta como "o usuário não mexeu".
      var focusAtMount = SN.current();
      var creds = SessionStore.loadCreds();
      if (!creds) return;
      fetchItems(creds).then(function (items) {
        state.items = prepare(items).items;
        state.loading = false;
        // NÃO cai pra "Recém adicionados" com Favoritos vazio -- pedido
        // explícito pra bater com Android/Roku: os dois abrem sempre em
        // Favoritos, mesmo vazio (ver comentário em MoviesScreen.kt:
        // "catálogo inteiro cai visualmente vazio/travado... mas foi assim
        // que pediram"). Esse fallback aqui era uma divergência real do
        // comportamento dos outros dois apps, não pedida pelo usuário.
        var cur = SN.current();
        var hadCatFocus = !cur || !document.contains(cur) || cur === focusAtMount || cur.classList && cur.classList.contains("cg-cat");
        renderCategories();
        renderGrid();
        if (restore && restore.selectedId != null && hadCatFocus && focusItem(restore.selectedId)) return;
        // As categorias foram redesenhadas: devolve o foco pra ativa.
        var activeCat = document.querySelector('.screen[data-screen="' + opts.screenName + '"] .cg-cat.active');
        if (hadCatFocus && activeCat) SN.setFocus(activeCat);
      }).catch(function () {
        state.loading = false;
        state.failed = true;
        // Aviso pro painel no próximo heartbeat (ver js/data/appReport.js).
        if (global.AppReport) AppReport.recordError("catalog_failed");
        renderGrid();
      });
    }
    Router.register(opts.screenName, {
      mount: mount,
      unmount: function unmount() {
        ContentHeaderBar.unbind();
      }
    });
  }

  // Detalhe de Filme/Série cujo catálogo não carregou: aviso com "Tentar de
  // novo" (foco começa nele) e "Voltar". Antes a tela ficava em
  // "Carregando…" pra sempre. root = .screen-content da tela.
  function showLoadError(root, message, onRetry, onBack) {
    var btn = "display:flex;align-items:center;gap:8px;border:none;padding:14px 22px;border-radius:12px;font-size:15px;font-weight:900;cursor:pointer;";
    root.innerHTML = '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#050506;text-align:center;padding:0 60px;">' + '  <div style="font-size:34px;color:#EF4444;margin-bottom:14px;">' + Icon("warning") + "</div>" + '  <div style="color:#fff;font-size:20px;font-weight:800;">' + message + "</div>" + '  <div style="color:#9A9AA5;font-size:14px;margin-top:8px;">Confira a internet e tente de novo.</div>' + '  <div style="display:flex;gap:14px;margin-top:24px;">' + '    <button class="focusable" data-load-error="retry" style="' + btn + 'background:var(--accent);color:#000;">' + Icon("refresh") + " Tentar de novo</button>" + '    <button class="focusable" data-load-error="back" style="' + btn + 'background:rgba(255,255,255,0.08);color:#fff;">' + Icon("back") + " Voltar</button>" + "  </div>" + "</div>";
    var retry = root.querySelector('[data-load-error="retry"]');
    retry.addEventListener("sn:enter", onRetry);
    root.querySelector('[data-load-error="back"]').addEventListener("sn:enter", onBack);
    SN.setFocus(retry);
  }
  global.ContentGrid = {
    create: create,
    ensureCardStyles: ensureCardStyles,
    showLoadError: showLoadError
  };
})(window);