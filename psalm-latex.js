/*
 * psalm-latex.js
 * Formatea salmos españoles para LaTeX y LilyPond usando el silabificador Spanish.
 * Input normal: texto por estrofas, separadas por línea en blanco.
 * Patrón global: caja prepPattern, por ejemplo 2,2,2,1.
 * Override opcional por línea: 0| texto, 1| texto, etc.
 */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  function escapeTex(s) {
    return String(s || '')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([{}#$%&_])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  function escapeLyString(s) {
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

    if (!pattern.length) {
      throw new Error('El patrón de preparatorias está vacío. Usa algo como 2,2,2,1.');
    }
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
      var prep;
      var textLine;
      if (override) {
        prep = parseInt(override[1], 10);
        textLine = override[2];
      } else {
        prep = pattern[lineInStanza % pattern.length];
        textLine = line;
      }

      current.lines.push({ prep: prep, text: textLine, lineNumber: lineInStanza + 1 });
      lineInStanza++;
    });

    pushCurrentStanza(stanzas, current);
    return stanzas;
  }

  function syllableSpans(line) {
    if (!window.Spanish || !Spanish.syllabify || !Spanish.accentedIndex) {
      throw new Error('No se encontró Spanish.syllabify(). Revisa que es-syllable.js cargue antes que psalm-latex.js.');
    }

    var spans = [];
    var i = 0;
    while (i < line.length) {
      while (i < line.length && !isWordChar(line.charAt(i))) i++;
      if (i >= line.length) break;

      var start = i;
      while (i < line.length && isWordChar(line.charAt(i))) i++;
      while (i < line.length && /[^\sA-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(line.charAt(i))) i++;
      var end = i;

      var wordWithPunct = line.slice(start, end);
      var sylls = Spanish.syllabify(wordWithPunct);
      var accentIdx = Spanish.accentedIndex(sylls);
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

  function analyzeLine(line, prepCount) {
    var spans = syllableSpans(line);
    if (!spans.length) return [{ text: line, kind: 'plain' }];

    var accentIndex = -1;
    for (var i = spans.length - 1; i >= 0; i--) {
      if (spans[i].isLastWord && spans[i].accentInWord) {
        accentIndex = i;
        break;
      }
    }
    if (accentIndex < 0) accentIndex = spans.length - 1;

    var prepStart = Math.max(0, accentIndex - prepCount);
    var marks = [];
    for (var j = prepStart; j < accentIndex; j++) marks.push({ start: spans[j].start, end: spans[j].end, kind: 'prep' });
    marks.push({ start: spans[accentIndex].start, end: spans[accentIndex].end, kind: 'accent' });

    marks.sort(function (a, b) { return a.start - b.start; });

    var tokens = [];
    var cursor = 0;
    marks.forEach(function (mark) {
      if (mark.start > cursor) tokens.push({ kind: 'plain', text: line.slice(cursor, mark.start) });
      tokens.push({ kind: mark.kind, text: line.slice(mark.start, mark.end) });
      cursor = mark.end;
    });
    if (cursor < line.length) tokens.push({ kind: 'plain', text: line.slice(cursor) });
    return tokens.filter(function (t) { return t.text.length > 0; });
  }

  function mergeAdjacent(tokens) {
    var out = [];
    tokens.forEach(function (t) {
      var last = out[out.length - 1];
      if (last && last.kind === t.kind) last.text += t.text;
      else out.push({ kind: t.kind, text: t.text });
    });
    return out;
  }

  function renderLatexLine(tokens) {
    return mergeAdjacent(tokens).map(function (t) {
      if (t.kind === 'prep') return '\\textit{' + escapeTex(t.text) + '}';
      if (t.kind === 'accent') return '\\textbf{' + escapeTex(t.text) + '}';
      return escapeTex(t.text);
    }).join('');
  }

  function renderLilypondLine(tokens, finalLine) {
    var out = [];
    mergeAdjacent(tokens).forEach(function (t) {
      if (t.kind === 'plain') {
        if (t.text) out.push('\\salmodia "' + escapeLyString(t.text) + '"');
      } else if (t.kind === 'prep') {
        t.text.trim().split(/\s+/).filter(Boolean).forEach(function (word) {
          out.push('\\markup \\italic ' + escapeLyMarkupWord(word));
        });
      } else if (t.kind === 'accent') {
        out.push('\\markup \\concat {\\bold "' + escapeLyString(t.text) + '"}');
      }
    });

    if (finalLine) out.push('\\respuestaRoja');
    return out.join(' ');
  }

  function formatAll(text, patternText) {
    var pattern = parsePattern(patternText);
    var stanzas = parseInput(text, pattern);
    var latex = [];
    var lily = ['\\set stanza = \\markup {\\with-color #red \\normal-text \\fontsize #-5 1}', ''];

    stanzas.forEach(function (stanza, stanzaIndex) {
      stanza.lines.forEach(function (line, lineIndex) {
        var tokens = analyzeLine(line.text, line.prep);
        var isFinalLine = lineIndex === stanza.lines.length - 1;

        var texLine = renderLatexLine(tokens);
        texLine = (lineIndex === 0 ? '% \\item ' : '% ') + texLine;
        texLine += isFinalLine ? ' \\response' : '\\hemis';
        if (isFinalLine && stanzaIndex < stanzas.length - 1) texLine += ' \\vspace{1em}';
        latex.push(texLine);

        if (stanzaIndex === 0) lily.push(renderLilypondLine(tokens, isFinalLine));
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

  window.PsalmLatexFormatter = {
    formatAll: formatAll,
    analyzeLine: analyzeLine,
    parseInput: parseInput,
    parsePattern: parsePattern
  };

  document.addEventListener('DOMContentLoaded', function () {
    byId('btnFormat').onclick = run;
    byId('prepPattern').oninput = run;
    byId('psalmInput').oninput = run;
    byId('btnCopyLatex').onclick = function () { copyText('latexOutput'); };
    byId('btnCopyLilypond').onclick = function () { copyText('lilypondOutput'); };
    run();
  });
})();
