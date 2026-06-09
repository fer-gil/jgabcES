/**
 * es-syllable.js
 * Módulo de silabeo y detección de acento tónico para español.
 * Diseñado para integrarse en el fork de jgabc (bbloomf/jgabc).
 *
 * USO EN jgabc:
 *   1. Incluir este archivo en psalmtone.html / transcriber.html:
 *        <script src="es-syllable.js"></script>
 *   2. En psalmtone.js, donde se detecta el idioma (cbEnglish / selLanguage),
 *      añadir una rama para español que llame a:
 *        Spanish.syllabify(word)       → array de sílabas
 *        Spanish.accentedIndex(sylls)  → índice de la sílaba tónica
 *
 * COMPATIBILIDAD: ES5+ (sin dependencias externas)
 */

var Spanish = (function () {

  // ─── Constantes ──────────────────────────────────────────────────────────────

  // Vocales simples (sin tilde)
  var VOWELS     = 'aeiouáéíóúüAEIOUÁÉÍÓÚÜ';
  // Vocales que llevan tilde ortográfica (siempre tónicas)
  var ACCENTED   = 'áéíóúÁÉÍÓÚ';
  // Vocales fuertes (forman núcleo silábico propio al encontrarse con otra vocal)
  var STRONG     = 'aeoáéóAEOÁÉÓ';
  // Vocales débiles (pueden formar diptongo con fuertes, o hiato si llevan tilde)
  var WEAK       = 'iuüIUÜ';
  // Débiles con tilde → hiato (rompen el diptongo)
  var WEAK_ACC   = 'íúÍÚ';

  // ─── Utilidades de carácter ───────────────────────────────────────────────────

  function isVowel(ch)      { return VOWELS.indexOf(ch)   >= 0; }
  function isStrong(ch)     { return STRONG.indexOf(ch)   >= 0; }
  function isWeak(ch)       { return WEAK.indexOf(ch)     >= 0; }
  function isWeakAcc(ch)    { return WEAK_ACC.indexOf(ch) >= 0; }
  function isAccented(ch)   { return ACCENTED.indexOf(ch) >= 0; }
  function isConsonant(ch)  { return /[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/.test(ch) && !isVowel(ch); }

  /** Elimina la tilde ortográfica de una vocal */
  function stripAccent(ch) {
    return ch.replace(/[áÁ]/g,'a').replace(/[àÀ]/g,'a')
             .replace(/[éÉ]/g,'e').replace(/[èÈ]/g,'e')
             .replace(/[íÍ]/g,'i').replace(/[ìÌ]/g,'i')
             .replace(/[óÓ]/g,'o').replace(/[òÒ]/g,'o')
             .replace(/[úÚü]/g,'u').replace(/[ùÙÜ]/g,'u');
  }

  // ─── Diptongos e hiatos ───────────────────────────────────────────────────────

  /**
   * Determina si dos vocales consecutivas forman diptongo (true)
   * o hiato (false).
   *
   * Diptongo: fuerte+débil, débil+fuerte, débil+débil — sin tilde en la débil.
   * Hiato:    fuerte+fuerte, débil_tónica+cualquiera, cualquiera+débil_tónica.
   */
  function formsDiphthong(v1, v2) {
    // Débil con tilde → siempre hiato
    if (isWeakAcc(v1) || isWeakAcc(v2)) return false;
    // Dos fuertes → hiato
    if (isStrong(v1) && isStrong(v2))   return false;
    // Débil+débil o fuerte+débil o débil+fuerte → diptongo
    return true;
  }

  // ─── Grupos consonánticos inseparables ───────────────────────────────────────

  /**
   * Devuelve true si c1+c2 son un grupo consonántico que nunca se separa
   * (pr, br, tr, dr, cr, gr, fr, pl, bl, cl, gl, fl).
   * Estos grupos siempre van con la vocal siguiente.
   */
  function isInseparableCluster(c1, c2) {
    var c1l = c1.toLowerCase();
    var c2l = c2.toLowerCase();
    var stops  = 'pbtdcgf';
    var liquids = 'rl';
    return stops.indexOf(c1l) >= 0 && liquids.indexOf(c2l) >= 0;
  }

  // ─── Silabeo ─────────────────────────────────────────────────────────────────

  /**
   * syllabify(word) → string[]
   *
   * Divide una palabra en sílabas siguiendo las reglas de la RAE:
   *   - V-V: hiato → sílabas separadas; diptongo → misma sílaba
   *   - V-CV: la consonante va con la vocal siguiente
   *   - V-CCV: si inseparable → ambas con la vocal siguiente; si no → primera con la anterior
   *   - V-CCCV: los dos últimos (si forman grupo inseparable) van con la vocal siguiente
   *
   * Soporta el uso de '=' como separador silábico manual (igual que jgabc).
   * Ej: "di=fí=cil" respeta esos cortes en lugar de calcularlo.
   */
  function syllabify(word) {
    // Corte manual con '='
    if (word.indexOf('=') >= 0) {
      return word.split('=');
    }

    // Limpiamos signos de puntuación finales para el análisis,
    // pero los conservamos en la última sílaba.
    var punct = '';
    var clean = word;
    var trailingMatch = word.match(/([^a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+)$/);
    if (trailingMatch) {
      punct = trailingMatch[1];
      clean = word.slice(0, word.length - punct.length);
    }

    if (clean.length === 0) return [word];

    var letters = clean.split('');
    var n = letters.length;
    var sylls = [];
    var current = '';

    var i = 0;
    while (i < n) {
      var ch = letters[i];

      if (isVowel(ch)) {
        current += ch;
        i++;

        // Mirar si la siguiente también es vocal
        if (i < n && isVowel(letters[i])) {
          if (formsDiphthong(ch, letters[i])) {
            // Diptongo: añadir la segunda vocal a la sílaba actual
            current += letters[i];
            i++;
            // Triptongo: si la siguiente también es débil sin tilde
            if (i < n && isVowel(letters[i]) && isWeak(letters[i]) && !isWeakAcc(letters[i])) {
              current += letters[i];
              i++;
            }
          }
          // Si hiato: la vocal siguiente empieza sílaba nueva (no hacemos nada aquí)
        }

        // Acumular consonantes siguientes hasta la próxima vocal
        var cons = [];
        var j = i;
        while (j < n && isConsonant(letters[j])) {
          cons.push(letters[j]);
          j++;
        }

        // Decidir cuántas consonantes van con la sílaba actual
        if (cons.length === 0) {
          // Sin consonantes tras la vocal: cerrar sílaba si hay vocal siguiente
          if (j < n && isVowel(letters[j])) {
            // La sílaba actual termina en vocal, la siguiente empieza con vocal
            // → ya se cerró (hiato o nueva sílaba)
          }
          // Si no hay más letras: la sílaba actual es la última
        } else if (cons.length === 1) {
          // Una consonante → va con la sílaba siguiente
          sylls.push(current);
          current = '';
        } else if (cons.length === 2) {
          if (isInseparableCluster(cons[0], cons[1])) {
            // Ambas van con la sílaba siguiente
            sylls.push(current);
            current = '';
          } else {
            // La primera va con la sílaba actual
            current += cons[0];
            i++; // consumir esa consonante
            sylls.push(current);
            current = '';
            i += (cons.length - 1); // consumir el resto ya lo hará el loop externo
            continue;
          }
        } else if (cons.length >= 3) {
          // Tres o más consonantes:
          // Si las dos últimas forman grupo inseparable → solo la primera va con la sílaba anterior
          if (isInseparableCluster(cons[cons.length-2], cons[cons.length-1])) {
            current += cons[0];
            i++;
          } else {
            // Las dos primeras van con la sílaba anterior si no forman grupo inseparable
            current += cons[0];
            i++;
          }
          sylls.push(current);
          current = '';
          continue;
        }

      } else {
        // Es consonante: añadir a la sílaba actual
        current += ch;
        i++;
      }
    }

    if (current.length > 0) {
      sylls.push(current);
    }

    // Restaurar puntuación en la última sílaba
    if (punct && sylls.length > 0) {
      sylls[sylls.length - 1] += punct;
    }

    // Guardia: si el algoritmo falló y devolvió array vacío, devolver la palabra entera
    return sylls.length > 0 ? sylls : [word];
  }

  // ─── Detección del acento tónico ─────────────────────────────────────────────

  /**
   * accentedIndex(syllables) → number
   *
   * Dado un array de sílabas (resultado de syllabify), devuelve el índice
   * (base 0) de la sílaba tónica.
   *
   * Reglas (en orden de prioridad):
   *   1. Si alguna sílaba contiene vocal con tilde → esa es la tónica.
   *   2. Si la palabra termina en vocal, 'n' o 's' (sin contar puntuación)
   *      → acento en la penúltima sílaba.
   *   3. En cualquier otro caso → acento en la última sílaba.
   *
   * Casos especiales cubiertos:
   *   - Monosílabos → índice 0 (siempre).
   *   - Palabras con tilde en débil dentro de diptongo (hiato) → regla 1.
   */
  function accentedIndex(syllables) {
    if (!syllables || syllables.length === 0) return 0;
    if (syllables.length === 1) return 0;

    // Regla 1: tilde explícita
    for (var i = 0; i < syllables.length; i++) {
      var syll = syllables[i];
      for (var j = 0; j < syll.length; j++) {
        if (isAccented(syll[j])) return i;
      }
    }

    // Regla 2 y 3: sin tilde
    // Obtener el último carácter significativo (ignorar puntuación)
    var last = syllables[syllables.length - 1];
    var lastClean = last.replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/g, '');
    var lastChar = lastClean.length > 0
      ? lastClean[lastClean.length - 1].toLowerCase()
      : '';

    // ¿Termina en vocal, n, o s?
    var endsInVowelNS = isVowel(lastChar) || lastChar === 'n' || lastChar === 's';

    if (endsInVowelNS) {
      // Penúltima
      return syllables.length - 2;
    } else {
      // Última
      return syllables.length - 1;
    }
  }

  // ─── API pública ─────────────────────────────────────────────────────────────

  /**
   * syllabifyLine(text) → Array de objetos { text, isAccented, syllables }
   *
   * Procesa una línea completa de texto y devuelve un array de palabras,
   * cada una con sus sílabas y cuál es la tónica. Útil para psalmtone.js.
   *
   * Ejemplo:
   *   Spanish.syllabifyLine("El Señor es mi pastor")
   *   → [
   *       { word: "El",      sylls: ["El"],          accentIdx: 0 },
   *       { word: "Señor",   sylls: ["Se","ñor"],    accentIdx: 1 },
   *       { word: "es",      sylls: ["es"],           accentIdx: 0 },
   *       { word: "mi",      sylls: ["mi"],           accentIdx: 0 },
   *       { word: "pastor",  sylls: ["pas","tor"],    accentIdx: 1 },
   *     ]
   */
  function syllabifyLine(text) {
    var words = text.split(/\s+/).filter(function(w){ return w.length > 0; });
    return words.map(function(word) {
      var sylls = syllabify(word);
      var idx   = accentedIndex(sylls);
      return { word: word, sylls: sylls, accentIdx: idx };
    });
  }

  /**
   * lastAccentedSyllableIndex(syllables) → number
   *
   * Alias semántico de accentedIndex, para uso explícito en el contexto
   * de salmodia (buscamos el acento de la ÚLTIMA palabra de la frase).
   */
  function lastAccentedSyllableIndex(syllables) {
    return accentedIndex(syllables);
  }

  /**
   * preparatorySyllables(syllables, accentIdx) → { prep: string[], accent: string, post: string[] }
   *
   * Divide las sílabas de la última palabra en:
   *   prep:   sílabas ANTES del acento (las preparatorias)
   *   accent: la sílaba tónica
   *   post:   sílabas DESPUÉS del acento (postónicas, se ignoran en salmodia)
   */
  function preparatorySyllables(syllables, accentIdx) {
    return {
      prep:   syllables.slice(0, accentIdx),
      accent: syllables[accentIdx] || '',
      post:   syllables.slice(accentIdx + 1)
    };
  }

  // Exponer API pública
  return {
    syllabify:                   syllabify,
    accentedIndex:               accentedIndex,
    syllabifyLine:               syllabifyLine,
    lastAccentedSyllableIndex:   lastAccentedSyllableIndex,
    preparatorySyllables:        preparatorySyllables,
    // Utilidades expuestas para tests
    isVowel:       isVowel,
    isAccented:    isAccented,
    formsDiphthong: formsDiphthong
  };

})();


// ─── Tests rápidos (comentar en producción) ───────────────────────────────────
/*
(function runTests() {
  var cases = [
    // [palabra, sílabas esperadas, índice tónico esperado]
    ['pastor',     ['pas','tor'],           1],
    ['Señor',      ['Se','ñor'],            1],
    ['leales',     ['lea','les'],           0],  // le-A-les: tónica en 'lea' (contiene 'a' tónica)
    ['bondades',   ['bon','da','des'],      1],
    ['derecho',    ['de','re','cho'],       1],
    ['frontera',   ['fron','te','ra'],      1],
    ['mensaje',    ['men','sa','je'],       1],
    ['velozmente', ['ve','loz','men','te'], 2],
    ['fuertes',    ['fuer','tes'],          0],
    ['confían',    ['con','fí','an'],       1],
    ['hambre',     ['ham','bre'],           0],
    ['israel',     ['is','ra','el'],        2],
    ['Jerusalén',  ['Je','ru','sa','lén'],  3],
    ['alabarlo',   ['a','la','bar','lo'],   2],
    ['proyectos',  ['pro','yec','tos'],     1],
  ];

  var passed = 0; var failed = 0;
  cases.forEach(function(c) {
    var word = c[0], expectedSylls = c[1], expectedIdx = c[2];
    var sylls = Spanish.syllabify(word);
    var idx   = Spanish.accentedIndex(sylls);
    var ok = JSON.stringify(sylls) === JSON.stringify(expectedSylls) && idx === expectedIdx;
    if (ok) {
      passed++;
    } else {
      failed++;
      console.warn('FAIL:', word,
        '| got:', sylls, 'idx:', idx,
        '| expected:', expectedSylls, 'idx:', expectedIdx);
    }
  });
  console.log('Tests: ' + passed + ' passed, ' + failed + ' failed.');
})();
*/
