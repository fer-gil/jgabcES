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

  function parsePattern(value, language) {
    var result = String(value || '')
      .split(/[,\s]+/)
      .map(function (n) { return parseInt(n, 10); })
      .filter(function (n) { return Number.isFinite(n) && n >= 0; });
    if (!result.length) throw new Error(language === 'en' ? 'Enter a pattern such as 2,2,2,1.' : 'Escribe un patrón como 2,2,2,1.');
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

  function prepareLine(text, language) {
    if (language !== 'en') return { text: text, hints: [] };
    var words = /[A-Za-zÁÉÍÓÚÝáéíóúý\u0301]+(?:['’=][A-Za-zÁÉÍÓÚÝáéíóúý\u0301]+)*/g;
    var hints = [];
    var result = '';
    var last = 0;
    var match;
    while ((match = words.exec(text))) {
      result += text.slice(last, match.index);
      var hint = window.PsalmEnglish.parseWord(match[0]);
      result += hint.text;
      hints.push(hint);
      last = match.index + match[0].length;
    }
    return { text: result + text.slice(last), hints: hints };
  }

  function scanSyllables(text, language, hints) {
    var spans = [];
    var words = language === 'en'
      ? /[A-Za-z]+(?:['’][A-Za-z]+)*/g
      : /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;
    var match;
    var wordId = 0;
    while ((match = words.exec(text))) {
      var start = match.index;
      var word = match[0];
      var endLetters = start + word.length;
      var hint = hints && hints[wordId];
      var syllables = language === 'en'
        ? ((hint && hint.syllables) || window.PsalmEnglish.syllabify(word))
        : syllabifyWord(word);
      var stressed = language === 'en'
        ? window.PsalmEnglish.accentedIndex(word, syllables)
        : stressIndex(syllables);
      var explicit = -1;
      if (language === 'en' && hint && hint.accentOffset >= 0) {
        var offset = 0;
        syllables.forEach(function (syllable, index) {
          if (hint.accentOffset >= offset && hint.accentOffset < offset + syllable.length) explicit = index;
          offset += syllable.length;
        });
        if (explicit >= 0) stressed = explicit;
      }
      var pos = start;
      syllables.forEach(function (syllable, index) {
        spans.push({
          start: pos,
          end: pos + syllable.length,
          text: syllable,
          wordId: wordId,
          wordStart: start,
          wordEnd: endLetters,
          stressed: index === stressed,
          explicitAccent: index === explicit
        });
        pos += syllable.length;
      });
      wordId++;
    }
    return spans;
  }

  function lastAccent(text, spans, language) {
    if (!spans.length) return -1;
    if (language === 'en') {
      for (var explicit = spans.length - 1; explicit >= 0; explicit--) {
        if (spans[explicit].explicitAccent) return explicit;
      }
    }
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

  function analyzeCadence(text, prepCount, language, hints) {
    var spans = scanSyllables(text, language, hints);
    var accentIndex = lastAccent(text, spans, language);
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
    var wordTail = model.text.slice(accent.end, accent.wordEnd).replace(/~/g, ' ');
    var afterWord = model.text.slice(accent.wordEnd).replace(/~/g, ' ');
    var tail = ly(wordTail) + (/\s/.test(afterWord) ? ' "' + ly(afterWord) + '"' : ly(afterWord));
    var concat = '\\markup \\concat {\\bold "' + ly(accent.text) + '"' + tail;
    if (finalLine) concat += '\\hspace #0.5 \\respuestaRoja';
    concat += '}';
    out.push((accent.end < accent.wordEnd ? '\\salmodia ' : '') + concat);
    return out.join(' ');
  }

  function analyzeFlex(line, language, hints) {
    var marker = line.indexOf('†');
    if (marker < 0) return null;
    var left = line.slice(0, marker).replace(/\s+$/g, '');
    var right = line.slice(marker + 1).replace(/^\s+/g, '');
    var spans = scanSyllables(left, language, hints);
    var accentIndex = lastAccent(left, spans, language);
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

  function formatAll(text, patternValue, allStanzas, language) {
    language = language === 'en' ? 'en' : 'es';
    var pattern = parsePattern(patternValue, language);
    var stanzas = parseText(text, pattern);
    var latex = [];
    var lilyHeader = '\\set stanza = \\markup {\\with-color #red \\normal-text \\fontsize #-5 ';
    var lily = [lilyHeader + '1}', ''];

    stanzas.forEach(function (stanza, stanzaIndex) {
      if (allStanzas && stanzaIndex > 0) lily.push('', lilyHeader + (stanzaIndex + 1) + '}', '');
      stanza.forEach(function (line, lineIndex) {
        var prepared = prepareLine(line.text, language);
        var flex = analyzeFlex(prepared.text, language, prepared.hints);
        var lastLine = lineIndex === stanza.length - 1;
        var texLine;
        var lyLine;
        if (flex) {
          texLine = renderFlexTex(flex);
          lyLine = renderFlexLy(flex);
        } else {
          var model = analyzeCadence(prepared.text, line.prep, language, prepared.hints);
          texLine = renderRegularTex(model);
          lyLine = renderRegularLy(model, lastLine);
        }
        texLine = (lineIndex === 0 ? '% \\item ' : '% ') + texLine;
        if (!flex) {
          texLine += lastLine ? ' \\response' : '\\hemis';
          if (lastLine && stanzaIndex < stanzas.length - 1) texLine += ' \\vspace{1em}';
        }
        latex.push(texLine);
        if (allStanzas || stanzaIndex === 0) lily.push(lyLine);
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
      var allStanzas = id('allStanzasLilypond').checked;
      var language = id('textLanguage').value;
      var result = formatAll(id('psalmInput').value, id('prepPattern').value, allStanzas, language);
      id('allStanzasValue').textContent = allStanzas ? 'Yes' : 'No';
      id('lilypondLabel').textContent = allStanzas ? 'LilyPond output — all stanzas' : 'LilyPond output — first stanza only';
      id('latexOutput').value = result.latex;
      id('lilypondOutput').value = result.lilypond;
      id('englishHelp').style.display = language === 'en' ? '' : 'none';
      id('status').textContent = language === 'en'
        ? 'Ready. ' + result.stanzas.length + ' stanza(s).'
        : 'Listo. ' + result.stanzas.length + ' estrofa(s).';
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
    id('allStanzasLilypond').onchange = run;
    var spanishExample = id('psalmInput').defaultValue;
    var englishExample = 'The Lord is my shepherd;\nI shall not want.\n\nHe makes me lie down in green pastures;\nhe leads me beside still waters.';
    id('textLanguage').onchange = function () {
      var input = id('psalmInput');
      if (input.value === spanishExample || input.value === englishExample) {
        input.value = id('textLanguage').value === 'en' ? englishExample : spanishExample;
      }
      run();
    };
    id('psalmInput').oninput = run;
    id('btnCopyLatex').onclick = function () { copy('latexOutput'); };
    id('btnCopyLilypond').onclick = function () { copy('lilypondOutput'); };
    run();
  });
})();
