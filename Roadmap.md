# jgabcES Roadmap

## Goal

Expand jgabcES into a bilingual/trilingual chant preparation toolkit for Latin, English, and Spanish, with shared language handling, improved tone catalogs, priest prayer tools, and a modernized interface.

## Phase 1 — Stabilize shared language support

- Centralize language selection: Latin, English, Spanish.
- Share Spanish syllabification across Psalm Tone Tool, Readings Tool, and future tools.
- Use Hypher Spanish patterns when available.
- Keep manual syllable breaks with `=`.
- Add test cases:
  - Dios
  - Señor
  - victoria
  - maravillas
  - Jerusalén
  - aleluya
  - Espíritu
  - bendición

## Phase 2 — Refactor tone data

- Move tone definitions out of individual page scripts.
- Create shared tone modules:
  - `js/tones/psalm-tones.js`
  - `js/tones/reading-tones.js`
  - `js/tones/priest-tones.js`
- Group tone selectors by source:
  - Current jgabc tones
  - Antiphonale Romanum
  - Custom tones
- Preserve existing custom tone behavior.

## Phase 3 — Add Antiphonale Romanum tones

- Add psalm tones from the Antiphonale Romanum.
- Include simple and solemn variants where applicable.
- Add metadata:
  - source
  - mode
  - use case
  - language compatibility
  - solemn/simple
- Add preview examples for each tone.

## Phase 4 — Priest Prayers Tool

Create a new tool:

```text
priest-prayers.html
