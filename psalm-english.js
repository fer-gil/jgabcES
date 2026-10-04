window.PsalmEnglish = (function () {
  'use strict';

  var BREAKS = {
    alleluia: [2, 4, 6],
    glory: [3],
    glorious: [3, 5],
    hallelujah: [3, 5, 7],
    heaven: [4],
    heavens: [4],
    holy: [2],
    jerusalem: [2, 4, 6],
    mercy: [3],
    redeemer: [2, 6],
    righteousness: [5, 9],
    singing: [4],
    spirit: [4]
  };
  var STRESS = {
    alleluia: 2,
    almighty: 1,
    everlasting: 2,
    faithfulness: 0,
    glorious: 0,
    hallelujah: 2,
    holiness: 0,
    jerusalem: 2,
    merciful: 0,
    righteousness: 0,
    wonderful: 0
  };

  function splitAt(word, cuts) {
    var result = [];
    var start = 0;
    cuts.forEach(function (cut) {
      result.push(word.slice(start, cut));
      start = cut;
    });
    result.push(word.slice(start));
    return result;
  }

  function fallback(word) {
    var groups = [];
    var i = 0;
    while (i < word.length) {
      if (!/[aeiouy]/i.test(word.charAt(i))) { i++; continue; }
      var start = i;
      while (i < word.length && /[aeiouy]/i.test(word.charAt(i))) i++;
      groups.push({ start: start, end: i });
    }
    if (groups.length > 1 && (/e$/i.test(word) || /es$/i.test(word)) &&
        !/[ly]es?$/i.test(word) && !/(?:[sxz]|ch|sh)es$/i.test(word)) groups.pop();
    if (groups.length < 2) return [word];
    var cuts = [];
    for (var g = 0; g < groups.length - 1; g++) {
      var between = groups[g + 1].start - groups[g].end;
      cuts.push(groups[g].end + (between > 1 ? between - 1 : 0));
    }
    return splitAt(word, cuts).filter(Boolean);
  }

  function syllabify(word) {
    var lower = word.toLowerCase();
    if (BREAKS[lower]) return splitAt(word, BREAKS[lower]);
    var hypher = window.Hypher && window.Hypher.languages && window.Hypher.languages.en;
    var chunks = hypher ? hypher.hyphenate(word) : [word];
    var result = [];
    chunks.forEach(function (chunk) {
      result = result.concat(fallback(chunk));
    });
    return result.length ? result : [word];
  }

  function accentedIndex(word, syllables) {
    if (syllables.length < 2) return 0;
    var known = STRESS[word.toLowerCase()];
    if (typeof known === 'number' && known < syllables.length) return known;
    return syllables.length - 2;
  }

  function parseWord(token) {
    var text = '';
    var cuts = [];
    var accentOffset = -1;
    for (var i = 0; i < token.length; i++) {
      var ch = token.charAt(i);
      if (ch === '=') {
        if (text.length && cuts[cuts.length - 1] !== text.length) cuts.push(text.length);
        continue;
      }
      if (ch === '\u0301') {
        if (text.length) accentOffset = text.length - 1;
        continue;
      }
      var decomposed = ch.normalize('NFD');
      if (decomposed.indexOf('\u0301') >= 0) accentOffset = text.length;
      text += decomposed.replace(/\u0301/g, '').normalize('NFC');
    }
    return {
      text: text,
      syllables: cuts.length ? splitAt(text, cuts) : null,
      accentOffset: accentOffset
    };
  }

  return { syllabify: syllabify, accentedIndex: accentedIndex, parseWord: parseWord };
})();
