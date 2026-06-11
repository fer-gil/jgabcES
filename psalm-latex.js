/*
 * psalm-latex.js
 * Formatea salmos españoles para LaTeX y LilyPond usando el silabificador Spanish.
 * Input por línea: <preparatorias> | <texto>
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

  function parseInput(text) {
    var stanzas = [];
    var cur = null;
    String(text || '').split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) return;

      var stanza = line.match(/^::?\s*stanza\s+(\d+)\s*$/i) || line.match(/^@stanza\s+(\d+)\s*$/i);
      if (stanza) {
        cur = { number: parseInt(stanza[1], 10), lines: [] };
        stanzas.push(cur);
        return;
      }

      if (!cur) {
        cur = { number: 1, lines: [] };
        stanzas.push(cur);
      }

      var m = line.match(/^(\d+)\s*(?:\||\s)\s*(.+)$/);
      if (!m) {
        throw new Error('Línea sin número de preparatorias: "' + line + '"');
      }
      cur.lines.push({ prep: parseInt(m[1], 10), text: m[2] });
    });
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
      var wordEnd = i;
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

  function formatAll(text) {
    var stanzas = parseInput(text);
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
      latex.push('%');
    });

    return { latex: latex.join('\n'), lilypond: lily.join('\n') };
  }

  function copyText(id) {
    var el = byId(id);
    el.focus();
    el.select();
    document.execCommand('copy');
  }

  function run() {
    try {
      var result = formatAll(byId('psalmInput').value);
      byId('latexOutput').value = result.latex;
      byId('lilypondOutput').value = result.lilypond;
      byId('status').textContent = 'Listo.';
    } catch (e) {
      byId('status').textContent = 'Error: ' + e.message;
    }
  }

  window.PsalmLatexFormatter = { formatAll: formatAll, analyzeLine: analyzeLine };

  document.addEventListener('DOMContentLoaded', function () {
    byId('btnFormat').onclick = run;
    byId('btnCopyLatex').onclick = function () { copyText('latexOutput'); };
    byId('btnCopyLilypond').onclick = function () { copyText('lilypondOutput'); };
    run();
  });
})();
