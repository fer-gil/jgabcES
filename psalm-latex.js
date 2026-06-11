/*
 * psalm-latex.js
 * Formatea salmos españoles para LaTeX y LilyPond usando reglas de silabeo español.
 * Input normal: texto por estrofas, separadas por línea en blanco.
 * Patrón global: caja prepPattern, por ejemplo 2,2,2,1.
 * Override opcional por línea: 0| texto, 1| texto, etc.
 * Sinalefa manual: se~acaba => se\tie acaba en LaTeX y cuenta se+a como una unidad preparatoria.
 */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  var VOWELS = 'aeiouáéíóúüAEIOUÁÉÍÓÚÜ';
  var ACCENTED = 'áéíóúÁÉÍÓÚ';
  var STRONG = 'aeoáéóAEOÁÉÓ';
  var WEAK_ACC = 'íúÍÚ';

  function isVowel(ch) { return VOWELS.indexOf(ch) >= 0; }
  function isAccented(ch) { return ACCENTED.indexOf(ch) >= 0; }
  function isStrong(ch) { return STRONG.indexOf(ch) >= 0; }
  function isWeakAcc(ch) { return WEAK_ACC.indexOf(ch) >= 0; }

  function escapeTex(s) {
    return String(s || '')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/~/g, '\\tie ')
      .replace(/([{}#$%&_])/g, '\\$1')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  function escapeLyString(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function escapeLyMarkupBare(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function escapeLyMarkupWord(s) {
    s = String(s || '');
    if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡.,;:!?'-]+$/.test(s)) return s;
    return '"' + escapeLyString(s) + '"';
  }

  function isWordChar(ch) {
    return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(ch);
  }

  function parsePattern(patternText) {
    var pattern = String(patternText || '')
      .split(/[,\s]+/)
      .map(function (n) { return parseInt(n, 10); })
      .filter(function (n) { return !isNaN(n) && n >= 0; });

    if (!pattern.length) throw new Error('El patrón de preparatorias está vacío. Usa algo como 2,2,2,1.');
    return pattern;
  }

  function pushCurrentStanza(stanzas, current) {
    if (current && current.lines.length) stanzas.push(current);
  }

  function parseInput(text, pattern) {
    var stanzas = [];
    var current = { number: 1, lines: [] };
    var stanzaNumber = 1;
    var lineInStanza = 0;

    String(text || '').split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();

      if (!line) {
        pushCurrentStanza(stanzas, current);
        stanzaNumber += current.lines.length ? 1 : 0;
        current = { number: stanzaNumber, lines: [] };
        lineInStanza = 0;
        return;
      }

      var stanza = line.match(/^::?\s*stanza\s+(\d+)\s*$/i) || line.match(/^@stanza\s+(\d+)\s*$/i);
      if (stanza) {
        pushCurrentStanza(stanzas, current);
        stanzaNumber = parseInt(stanza[1], 10);
        current = { number: stanzaNumber, lines: [] };
        lineInStanza = 0;
        return;
      }

      var override = line.match(/^(\d+)\s*\|\s*(.+)$/);
      var prep = override ? parseInt(override[1], 10) : pattern[lineInStanza % pattern.length];
      var textLine = override ? override[2] : line;

      current.lines.push({ prep: prep, text: textLine, lineNumber: lineInStanza + 1 });
      lineInStanza++;
    });

    pushCurrentStanza(stanzas, current);
    return stanzas;
  }

  function formsDiphthong(a, b) {
    if (isWeakAcc(a) || isWeakAcc(b)) return false;
    if (isStrong(a) && isStrong(b)) return false;
    return true;
  }

  function isInseparableCluster(c1, c2) {
    var a = String(c1 || '').toLowerCase();
    var b = String(c2 || '').toLowerCase();
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

  function stripTrailingPunctuation(word) {
    var m = String(word || '').match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*)$/);
    return m ? { clean: m[1], punct: m[2] || '' } : { clean: word, punct: '' };
  }

  function syllabifyWord(wordWithPunct) {
    var parts = stripTrailingPunctuation(wordWithPunct);
    var word = parts.clean;
    var punct = parts.punct;
    if (!word) return [wordWithPunct];
    if (word.indexOf('=') >= 0) return word.split('=').map(function (s, i, arr) { return i === arr.length - 1 ? s + punct : s; });

    var groups = vowelGroups(word);
    if (!groups.length) return [wordWithPunct];
    if (groups.length === 1) return [word + punct];

    var cuts = [0];
    for (var g = 0; g < groups.length - 1; g++) {
      var prev = groups[g];
      var next = groups[g + 1];
      var consStart = prev.end;
      var consEnd = next.start;
      var cons = word.slice(consStart, consEnd);
      var cut;

      if (cons.length === 0) cut = prev.end;
      else if (cons.length === 1) cut = consStart;
      else if (cons.length === 2) cut = isInseparableCluster(cons.charAt(0), cons.charAt(1)) ? consStart : consStart + 1;
      else cut = isInseparableCluster(cons.charAt(cons.length - 2), cons.charAt(cons.length - 1)) ? consEnd - 2 : consStart + 1;

      cuts.push(cut);
    }
    cuts.push(word.length);

    var sylls = [];
    for (var i = 0; i < cuts.length - 1; i++) sylls.push(word.slice(cuts[i], cuts[i + 1]));
    sylls[sylls.length - 1] += punct;
    return sylls.filter(function (s) { return s.length > 0; });
  }

  function accentedIndex(sylls) {
    if (!sylls || !sylls.length) return 0;
    if (sylls.length === 1) return 0;
    for (var i = 0; i < sylls.length; i++) {
      for (var j = 0; j < sylls[i].length; j++) if (isAccented(sylls[i].charAt(j))) return i;
    }
    var last = sylls[sylls.length - 1].replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
    var ch = last ? last.charAt(last.length - 1).toLowerCase() : '';
    return (isVowel(ch) || ch === 'n' || ch === 's') ? sylls.length - 2 : sylls.length - 1;
  }

  function syllableSpans(line) {
    var spans = [];
    var i = 0;
    while (i < line.length) {
      while (i < line.length && !isWordChar(line.charAt(i))) i++;
      if (i >= line.length) break;

      var start = i;
      while (i < line.length && isWordChar(line.charAt(i))) i++;
      while (i < line.length && /[^\s~A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(line.charAt(i))) i++;
      var end = i;

      var wordWithPunct = line.slice(start, end);
      var sylls = syllabifyWord(wordWithPunct);
      var accentIdx = accentedIndex(sylls);
      var pos = start;

      sylls.forEach(function (syl, idx) {
        var sylStart = pos;
        var sylEnd = pos + syl.length;
        spans.push({
          start: sylStart,
          end: sylEnd,
          text: line.slice(sylStart, sylEnd),
          wordStart: start,
          wordEnd: end,
          isLastWord: false,
          accentInWord: idx === accentIdx
        });
        pos = sylEnd;
      });
    }

    if (spans.length) {
      var lastWordStart = spans[spans.length - 1].wordStart;
      spans.forEach(function (s) { s.isLastWord = s.wordStart === lastWordStart; });
    }
    return spans;
  }

  function makeUnits(line, spans) {
    var units = [];
    spans.forEach(function (span, spanIndex) {
      var lastUnit = units[units.length - 1];
      var joiner = lastUnit ? line.slice(spans[lastUnit.spanIndices[lastUnit.spanIndices.length - 1]].end, span.start) : '';
      if (lastUnit && joiner.indexOf('~') >= 0) {
        lastUnit.spanIndices.push(spanIndex);
        lastUnit.end = span.end;
      } else {
        units.push({ spanIndices: [spanIndex], start: span.start, end: span.end });
      }
    });
    return units;
  }

  function analyzeLine(line, prepCount) {
    var spans = syllableSpans(line);
    if (!spans.length) return { line: line, spans: [], units: [], prepUnitIndices: [], accentSpanIndex: -1, tokens: [{ text: line, kind: 'plain' }] };

    var units = makeUnits(line, spans);
    var accentSpanIndex = -1;
    for (var i = spans.length - 1; i >= 0; i--) {
      if (spans[i].isLastWord && spans[i].accentInWord) { accentSpanIndex = i; break; }
    }
    if (accentSpanIndex < 0) accentSpanIndex = spans.length - 1;

    var accentUnitIndex = 0;
    units.forEach(function (u, idx) { if (u.spanIndices.indexOf(accentSpanIndex) >= 0) accentUnitIndex = idx; });

    var prepStart = Math.max(0, accentUnitIndex - prepCount);
    var prepUnitIndices = [];
    for (var u = prepStart; u < accentUnitIndex; u++) prepUnitIndices.push(u);

    var marks = [];
    prepUnitIndices.forEach(function (unitIndex) {
      units[unitIndex].spanIndices.forEach(function (spanIndex) {
        marks.push({ start: spans[spanIndex].start, end: spans[spanIndex].end, kind: 'prep' });
      });
    });
    marks.push({ start: spans[accentSpanIndex].start, end: spans[accentSpanIndex].end, kind: 'accent' });
    marks.sort(function (a, b) { return a.start - b.start; });

    var tokens = [];
    var cursor = 0;
    marks.forEach(function (mark) {
      if (mark.start > cursor) tokens.push({ kind: 'plain', text: line.slice(cursor, mark.start) });
      tokens.push({ kind: mark.kind, text: line.slice(mark.start, mark.end) });
      cursor = mark.end;
    });
    if (cursor < line.length) tokens.push({ kind: 'plain', text: line.slice(cursor) });

    return { line: line, spans: spans, units: units, prepUnitIndices: prepUnitIndices, accentSpanIndex: accentSpanIndex, tokens: tokens.filter(function (t) { return t.text.length > 0; }) };
  }

  function isJoinerText(s) { return /^[\s~]+$/.test(s || ''); }

  function renderLatexLine(analysis) {
    var tokens = analysis.tokens;
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.kind !== 'prep') {
        if (t.kind === 'accent') out.push('\\textbf{' + escapeTex(t.text) + '}');
        else out.push(escapeTex(t.text));
        continue;
      }
      var prepText = t.text;
      while (i + 2 < tokens.length && tokens[i + 1].kind === 'plain' && isJoinerText(tokens[i + 1].text) && tokens[i + 2].kind === 'prep') {
        prepText += tokens[i + 1].text + tokens[i + 2].text;
        i += 2;
      }
      out.push('\\textit{' + escapeTex(prepText) + '}');
    }
    return out.join('');
  }

  function renderPrepUnitLily(line, spans, unit) {
    var parts = [];
    unit.spanIndices.forEach(function (spanIndex, idx) {
      var span = spans[spanIndex];
      var nextSpan = spans[unit.spanIndices[idx + 1]];
      var suffix = nextSpan ? ' --' : '';
      parts.push('\\markup \\italic ' + escapeLyMarkupWord(span.text.replace(/[.,;:!?]+$/g, '')) + suffix);
    });
    return parts.join(' ');
  }

  function renderLilypondLine(analysis, finalLine) {
    var line = analysis.line;
    var spans = analysis.spans;
    if (!spans.length) return '\\salmodia "' + escapeLyString(line) + '"' + (finalLine ? ' \\respuestaRoja' : '');

    var out = [];
    var cursor = 0;

    analysis.prepUnitIndices.forEach(function (unitIndex) {
      var unit = analysis.units[unitIndex];
      var before = line.slice(cursor, unit.start);
      if (before && !isJoinerText(before)) out.push('\\salmodia "' + escapeLyString(before.replace(/\s+$/g, '')) + '"');
      out.push(renderPrepUnitLily(line, spans, unit));
      cursor = unit.end;
    });

    var accent = spans[analysis.accentSpanIndex];
    var beforeAccent = line.slice(cursor, accent.start);
    if (beforeAccent && !isJoinerText(beforeAccent)) out.push('\\salmodia "' + escapeLyString(beforeAccent.replace(/\s+$/g, '')) + '"');

    var post = line.slice(accent.end).replace(/~/g, ' ');
    var inside = '\\bold "' + escapeLyString(accent.text) + '"' + escapeLyMarkupBare(post);
    if (finalLine) inside += '\\hspace #0.5 \\respuestaRoja';
    out.push('\\markup \\concat {' + inside + '}');

    return out.join(' ');
  }

  function formatAll(text, patternText) {
    var pattern = parsePattern(patternText);
    var stanzas = parseInput(text, pattern);
    var latex = [];
    var lily = ['\\set stanza = \\markup {\\with-color #red \\normal-text \\fontsize #-5 1}', ''];

    stanzas.forEach(function (stanza, stanzaIndex) {
      stanza.lines.forEach(function (line, lineIndex) {
        var analysis = analyzeLine(line.text, line.prep);
        var isFinalLine = lineIndex === stanza.lines.length - 1;

        var texLine = renderLatexLine(analysis);
        texLine = (lineIndex === 0 ? '% \\item ' : '% ') + texLine;
        texLine += isFinalLine ? ' \\response' : '\\hemis';
        if (isFinalLine && stanzaIndex < stanzas.length - 1) texLine += ' \\vspace{1em}';
        latex.push(texLine);

        if (stanzaIndex === 0) lily.push(renderLilypondLine(analysis, isFinalLine));
      });
      if (stanza.lines.length) latex.push('%');
    });

    return { latex: latex.join('\n'), lilypond: lily.join('\n'), stanzas: stanzas };
  }

  function copyText(id) {
    var el = byId(id);
    el.focus();
    el.select();
    document.execCommand('copy');
  }

  function run() {
    try {
      var result = formatAll(byId('psalmInput').value, byId('prepPattern').value);
      byId('latexOutput').value = result.latex;
      byId('lilypondOutput').value = result.lilypond;
      byId('status').textContent = 'Listo. ' + result.stanzas.length + ' estrofa(s).';
    } catch (e) {
      byId('status').textContent = 'Error: ' + e.message;
    }
  }

  window.PsalmLatexFormatter = { formatAll: formatAll, analyzeLine: analyzeLine, parseInput: parseInput, parsePattern: parsePattern, syllabifyWord: syllabifyWord };

  document.addEventListener('DOMContentLoaded', function () {
    byId('btnFormat').onclick = run;
    byId('prepPattern').oninput = run;
    byId('psalmInput').oninput = run;
    byId('btnCopyLatex').onclick = function () { copyText('latexOutput'); };
    byId('btnCopyLilypond').onclick = function () { copyText('lilypondOutput'); };
    run();
  });
})();
