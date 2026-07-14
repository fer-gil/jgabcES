(function () {
  'use strict';

  var LETTER = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;
  var VOWELS = 'aeiouáéíóúüAEIOUÁÉÍÓÚÜ';
  var ACCENTED = 'áéíóúÁÉÍÓÚ';
  var STRONG = 'aeoáéóAEOÁÉÓ';
  var WEAK_ACC = 'íúÍÚ';

  function id(name) { return document.getElementById(name); }
  function isLetter(ch) { return !!ch && LETTER.test(ch); }
  function isVowel(ch) { return VOWELS.indexOf(ch) >= 0; }
  function isAccented(ch) { return ACCENTED.indexOf(ch) >= 0; }
  function isStrong(ch) { return STRONG.indexOf(ch) >= 0; }
  function isWeakAcc(ch) { return WEAK_ACC.indexOf(ch) >= 0; }

  function tex(s) {
    return String(s || '')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/~/g, '\\tie ')
      .replace(/([{}#$%&_])/g, '\\$1')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  function ly(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function lyAtom(s) {
    s = String(s || '');
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡.,;:!?'-]+$/.test(s) ? s : '"' + ly(s) + '"';
  }

  function parsePattern(value) {
    var result = String(value || '')
      .split(/[,\s]+/)
      .map(function (n) { return parseInt(n, 10); })
      .filter(function (n) { return Number.isFinite(n) && n >= 0; });
    if (!result.length) throw new Error('Escribe un patrón como 2,2,2,1.');
    return result;
  }

  function parseText(value, pattern) {
    var stanzas = [];
    var stanza = [];
    String(value || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) {
        if (stanza.length) stanzas.push(stanza);
        stanza = [];
        return;
      }
      var override = line.match(/^(\d+)\s*\|\s*(.+)$/);
      stanza.push({
        text: override ? override[2] : line,
        prep: override ? parseInt(override[1], 10) : pattern[stanza.length % pattern.length]
      });
    });
    if (stanza.length) stanzas.push(stanza);
    return stanzas;
  }

  function formsDiphthong(a, b) {
    if (isWeakAcc(a) || isWeakAcc(b)) return false;
    return !(isStrong(a) && isStrong(b));
  }

  function inseparable(a, b) {
    a = String(a || '').toLowerCase();
    b = String(b || '').toLowerCase();
    if (a + b === 'ch' || a + b === 'll' || a + b === 'rr') return true;
    return 'pbtdcgf'.indexOf(a) >= 0 && 'rl'.indexOf(b) >= 0;
  }

  function vowelGroups(word) {
    var groups = [];
    var i = 0;
    while (i < word.length) {
      if (!isVowel(word.charAt(i))) { i++; continue; }
      var start = i;
      var end = i + 1;
      while (end < word.length && isVowel(word.charAt(end)) && formsDiphthong(word.charAt(end - 1), word.charAt(end))) end++;
      groups.push({ start: start, end: end });
      i = end;
    }
    return groups;
  }

  function syllabifyWord(word) {
    var groups = vowelGroups(word);
    if (groups.length < 2) return [word];
    var cuts = [0];
    for (var g = 0; g < groups.length - 1; g++) {
      var a = groups[g];
      var b = groups[g + 1];
      var cs = a.end;
      var ce = b.start;
      var consonants = word.slice(cs, ce);
      var cut;
      if (!consonants.length) cut = a.end;
      else if (consonants.length === 1) cut = cs;
      else if (consonants.length === 2) cut = inseparable(consonants[0], consonants[1]) ? cs : cs + 1;
      else cut = inseparable(consonants[consonants.length - 2], consonants[consonants.length - 1]) ? ce - 2 : cs + 1;
      cuts.push(cut);
    }
    cuts.push(word.length);
    var out = [];
    for (var i = 0; i < cuts.length - 1; i++) out.push(word.slice(cuts[i], cuts[i + 1]));
    return out.filter(Boolean);
  }

  function stressIndex(syllables) {
    if (syllables.length < 2) return 0;
    for (var i = 0; i < syllables.length; i++) {
      for (var j = 0; j < syllables[i].length; j++) if (isAccented(syllables[i][j])) return i;
    }
    var last = syllables[syllables.length - 1];
    var ch = last.charAt(last.length - 1).toLowerCase();
    return isVowel(ch) || ch === 'n' || ch === 's' ? syllables.length - 2 : syllables.length - 1;
  }

  function scanSyllables(text) {
    var spans = [];
    var i = 0;
    var wordId = 0;
    while (i < text.length) {
      while (i < text.length && !isLetter(text[i])) i++;
      if (i >= text.length) break;
      var start = i;
      while (i < text.length && isLetter(text[i])) i++;
      var endLetters = i;
      var word = text.slice(start, endLetters);
      var syllables = syllabifyWord(word);
      var stressed = stressIndex(syllables);
      var pos = start;
      syllables.forEach(function (syllable, index) {
        spans.push({
          start: pos,
          end: pos + syllable.length,
          text: syllable,
          wordId: wordId,
          wordStart: start,
          wordEnd: endLetters,
          stressed: index === stressed
        });
        pos += syllable.length;
      });
      wordId++;
    }
    return spans;
  }

  function lastAccent(text, spans) {
    if (!spans.length) return -1;
    var lastWord = spans[spans.length - 1].wordId;
    for (var i = spans.length - 1; i >= 0; i--) {
      if (spans[i].wordId === lastWord && spans[i].stressed) return i;
    }
    return spans.length - 1;
  }

  function makeUnits(text, spans) {
    var units = [];
    spans.forEach(function (span, index) {
      var previous = units[units.length - 1];
      if (previous) {
        var previousSpan = spans[previous.spans[previous.spans.length - 1]];
        var between = text.slice(previousSpan.end, span.start);
        if (between.indexOf('~') >= 0) {
          previous.spans.push(index);
          previous.end = span.end;
          previous.sinalefa = true;
          return;
        }
      }
      units.push({ start: span.start, end: span.end, spans: [index], sinalefa: false });
    });
    return units;
  }

  function analyzeCadence(text, prepCount) {
    var spans = scanSyllables(text);
    var accentIndex = lastAccent(text, spans);
    if (accentIndex < 0) return { text: text, spans: [], units: [], prepUnits: [], accentIndex: -1 };
    var units = makeUnits(text, spans);
    var accentUnit = 0;
    units.forEach(function (unit, index) {
      if (unit.spans.indexOf(accentIndex) >= 0) accentUnit = index;
    });
    var firstPrep = Math.max(0, accentUnit - prepCount);
    return {
      text: text,
      spans: spans,
      units: units,
      prepUnits: units.slice(firstPrep, accentUnit),
      accentIndex: accentIndex,
      accentUnit: accentUnit
    };
  }

  function renderRegularTex(model) {
    if (model.accentIndex < 0) return tex(model.text);
    var accent = model.spans[model.accentIndex];
    var prepStart = model.prepUnits.length ? model.prepUnits[0].start : accent.start;
    var prefix = model.text.slice(0, prepStart);
    var prep = model.text.slice(prepStart, accent.start);
    var trailing = (prep.match(/\s+$/) || [''])[0];
    if (trailing) prep = prep.slice(0, -trailing.length);
    var tail = model.text.slice(accent.end);
    var accentText = accent.text;
    if (accent.end === accent.wordEnd) {
      var punctuation = (tail.match(/^[,.;:!?]+/) || [''])[0];
      if (punctuation) { accentText += punctuation; tail = tail.slice(punctuation.length); }
    }
    return tex(prefix) +
      (prep ? '\\textit{' + tex(prep) + '}' : '') + tex(trailing) +
      '\\textbf{' + tex(accentText) + '}' + tex(tail);
  }

  function prefixContinuesWord(text, cut) {
    return cut > 0 && cut < text.length && isLetter(text[cut - 1]) && isLetter(text[cut]);
  }

  function unitContinuesWord(model, unit) {
    var lastSpanIndex = unit.spans[unit.spans.length - 1];
    var span = model.spans[lastSpanIndex];
    var next = model.spans[lastSpanIndex + 1];
    return !!next && next.wordId === span.wordId;
  }

  function renderSinalefa(model, unit) {
    var pieces = [];
    unit.spans.forEach(function (spanIndex, index) {
      if (index) pieces.push('\\hspace #0.5 \\sinalefa \\hspace #0.5');
      pieces.push('\\italic ' + lyAtom(model.spans[spanIndex].text));
    });
    return '\\markup \\concat {' + pieces.join(' ') + '}' + (unitContinuesWord(model, unit) ? ' --' : '');
  }

  function renderPrepUnit(model, unit) {
    if (unit.sinalefa) return renderSinalefa(model, unit);
    var spanIndex = unit.spans[0];
    var span = model.spans[spanIndex];
    var next = model.spans[spanIndex + 1];
    var hyphen = next && next.wordId === span.wordId && spanIndex < model.accentIndex ? ' --' : '';
    return '\\markup \\italic ' + lyAtom(span.text) + hyphen;
  }

  function renderRegularLy(model, finalLine) {
    if (model.accentIndex < 0) return '\\salmodia "' + ly(model.text) + '"';
    var accent = model.spans[model.accentIndex];
    var prepStart = model.prepUnits.length ? model.prepUnits[0].start : accent.start;
    var prefix = model.text.slice(0, prepStart).replace(/\s+$/g, '');
    var out = [];
    if (prefix) out.push('\\salmodia "' + ly(prefix) + '"' + (prefixContinuesWord(model.text, prepStart) ? ' --' : ''));
    model.prepUnits.forEach(function (unit) { out.push(renderPrepUnit(model, unit)); });
    var tail = model.text.slice(accent.end).replace(/~/g, ' ');
    var concat = '\\markup \\concat {\\bold "' + ly(accent.text) + '"' + ly(tail);
    if (finalLine) concat += '\\hspace #0.5 \\respuestaRoja';
    concat += '}';
    out.push(concat);
    return out.join(' ');
  }

  function analyzeFlex(line) {
    var marker = line.indexOf('†');
    if (marker < 0) return null;
    var left = line.slice(0, marker).replace(/\s+$/g, '');
    var right = line.slice(marker + 1).replace(/^\s+/g, '');
    var spans = scanSyllables(left);
    var accentIndex = lastAccent(left, spans);
    return { left: left, right: right, spans: spans, accentIndex: accentIndex };
  }

  function renderFlexTex(flex) {
    if (flex.accentIndex < 0) return tex(flex.left) + ' †' + (flex.right ? ' ' + tex(flex.right) : '');
    var accent = flex.spans[flex.accentIndex];
    var prefix = flex.left.slice(0, accent.start);
    var tail = flex.left.slice(accent.end);
    return tex(prefix) + '\\textbf{' + tex(accent.text) + '}' +
      (tail ? '\\underline{' + tex(tail) + '}' : '') + ' †' +
      (flex.right ? ' ' + tex(flex.right) : '');
  }

  function renderFlexLy(flex) {
    if (flex.accentIndex < 0) return '\\salmodia "' + ly(flex.left) + '" \\markup "†"';
    var accent = flex.spans[flex.accentIndex];
    var prefix = flex.left.slice(0, accent.start).replace(/\s+$/g, '');
    var tail = flex.left.slice(accent.end);
    var out = [];
    if (prefix) out.push('\\salmodia "' + ly(prefix) + '"');
    var concat = '\\markup \\concat {\\bold "' + ly(accent.text) + '"';
    if (tail) concat += '\\underline "' + ly(tail) + '"';
    concat += '\\hspace #0.5 "†"}';
    out.push(concat);
    if (flex.right) out.push('\\salmodia "' + ly(flex.right) + '"');
    return out.join(' ');
  }

  function formatAll(text, patternValue) {
    var pattern = parsePattern(patternValue);
    var stanzas = parseText(text, pattern);
    var latex = [];
    var lily = ['\\set stanza = \\markup {\\with-color #red \\normal-text \\fontsize #-5 1}', ''];

    stanzas.forEach(function (stanza, stanzaIndex) {
      stanza.forEach(function (line, lineIndex) {
        var flex = analyzeFlex(line.text);
        var lastLine = lineIndex === stanza.length - 1;
        var texLine;
        var lyLine;
        if (flex) {
          texLine = renderFlexTex(flex);
          lyLine = renderFlexLy(flex);
        } else {
          var model = analyzeCadence(line.text, line.prep);
          texLine = renderRegularTex(model);
          lyLine = renderRegularLy(model, lastLine);
        }
        texLine = (lineIndex === 0 ? '% \\item ' : '% ') + texLine;
        if (!flex) {
          texLine += lastLine ? ' \\response' : '\\hemis';
          if (lastLine && stanzaIndex < stanzas.length - 1) texLine += ' \\vspace{1em}';
        }
        latex.push(texLine);
        if (stanzaIndex === 0) lily.push(lyLine);
      });
      latex.push('%');
    });

    return { latex: latex.join('\n'), lilypond: lily.join('\n'), stanzas: stanzas };
  }

  function copy(name) {
    var element = id(name);
    element.focus();
    element.select();
    document.execCommand('copy');
  }

  function run() {
    try {
      var result = formatAll(id('psalmInput').value, id('prepPattern').value);
      id('latexOutput').value = result.latex;
      id('lilypondOutput').value = result.lilypond;
      id('status').textContent = 'Listo. ' + result.stanzas.length + ' estrofa(s).';
    } catch (error) {
      id('status').textContent = 'Error: ' + error.message;
    }
  }

  window.PsalmModernFormatter = {
    formatAll: formatAll,
    analyzeCadence: analyzeCadence,
    analyzeFlex: analyzeFlex,
    syllabifyWord: syllabifyWord
  };

  document.addEventListener('DOMContentLoaded', function () {
    id('btnFormat').onclick = run;
    id('prepPattern').oninput = run;
    id('psalmInput').oninput = run;
    id('btnCopyLatex').onclick = function () { copy('latexOutput'); };
    id('btnCopyLilypond').onclick = function () { copy('lilypondOutput'); };
    run();
  });
})();
