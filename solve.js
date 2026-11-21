// A fast drop-in for csv-reader 1.0.0, make.fun's own CSV reader: run(input) returns csv-reader's answer
// {columns, rows, errors} for every input {text, header}, read in one pass, left to right. Where the reference
// builds each field a character at a time, this reader cuts fields out with slice() between structural
// characters and keeps the per-character work to a tight scan for the next comma, quote or line break.
//
// The reading policy is csv-reader's own, followed exactly:
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside a quoted field a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled, "" inside it one quote, and
//     each CRLF or lone CR inside it read as LF; what follows its closing quote, up to the next comma or line
//     break, is appended as it stands (quote_junk, when the field ends and anything was appended); a quote
//     that never closes is a literal character, and the text after it is read again as unquoted
//     (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the records after it (every
//     record when header is false), each padded with "" (short_row, with fields: its count) or cut (long_row,
//     with extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts on (every LF, CRLF and lone CR
//     inside a quoted field counted), row its record's index in rows, null for the header, in the order met.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to the next.

/** How a field ended: at a comma (the record goes on), at a line break or at the end of the text. */
const COMMA = 0;
const BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const len = text.length;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended, and how many characters an unquoted read kept.
  let fValue = '';
  let fEnded = END;
  let fAdded = 0;

  // Reads unquoted characters onto `initial` up to the next comma or line break: a CR not followed by LF is
  // dropped (stray_cr). Sets fValue, fEnded and fAdded (the characters kept past `initial`).
  function readUnquoted(initial) {
    let chunks = null; // the field's pieces, once a stray CR cuts it
    let segStart = pos;
    let added = 0;
    for (;;) {
      let i = pos;
      while (i < len) {
        const c = text.charCodeAt(i);
        if (c === 44 || c === 10 || c === 13) break;
        i += 1;
      }
      if (i >= len) {
        const tail = text.slice(segStart);
        added += tail.length;
        fValue = chunks === null ? (initial === '' ? tail : initial + tail) : initial + chunks.join('') + tail;
        fEnded = END;
        fAdded = added;
        pos = len;
        return;
      }
      const c = text.charCodeAt(i);
      if (c === 44 || c === 10 || (c === 13 && text.charCodeAt(i + 1) === 10)) {
        const piece = text.slice(segStart, i);
        added += piece.length;
        fValue = chunks === null ? (initial === '' ? piece : initial + piece) : initial + chunks.join('') + piece;
        fAdded = added;
        if (c === 44) {
          fEnded = COMMA;
          pos = i + 1;
        } else {
          fEnded = BREAK;
          pos = i + (c === 13 ? 2 : 1);
          line += 1;
        }
        return;
      }
      // A CR not followed by LF: dropped (stray_cr), and the field goes on.
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      const piece = text.slice(segStart, i);
      added += piece.length;
      if (chunks === null) chunks = [piece];
      else chunks.push(piece);
      pos = i + 1;
      segStart = pos;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue and fEnded.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let chunks = null; // the value's pieces, once a CR or a doubled quote cuts it
    let segStart = pos;
    for (;;) {
      let i = pos;
      while (i < len) {
        const c = text.charCodeAt(i);
        if (c === 34 || c === 13) break;
        if (c === 10) line += 1;
        i += 1;
      }
      if (i >= len) {
        // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        readUnquoted('"');
        return;
      }
      if (text.charCodeAt(i) === 13) {
        // CRLF and a lone CR inside quotes are each one LF.
        const piece = text.slice(segStart, i);
        if (chunks === null) chunks = [piece, '\n'];
        else chunks.push(piece, '\n');
        line += 1;
        pos = text.charCodeAt(i + 1) === 10 ? i + 2 : i + 1;
        segStart = pos;
        continue;
      }
      if (text.charCodeAt(i + 1) === 34) {
        // A doubled quote is one quote in the value.
        const piece = text.slice(segStart, i);
        if (chunks === null) chunks = [piece, '"'];
        else chunks.push(piece, '"');
        pos = i + 2;
        segStart = pos;
        continue;
      }
      // The closing quote.
      const piece = text.slice(segStart, i);
      const value = chunks === null ? piece : chunks.join('') + piece;
      pos = i + 1;
      if (pos >= len) {
        fValue = value;
        fEnded = END;
        return;
      }
      const d = text.charCodeAt(pos);
      if (d === 44) {
        pos += 1;
        fValue = value;
        fEnded = COMMA;
        return;
      }
      if (d === 10) {
        pos += 1;
        line += 1;
        fValue = value;
        fEnded = BREAK;
        return;
      }
      if (d === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fValue = value;
        fEnded = BREAK;
        return;
      }
      // What follows the closing quote is appended as it stands, up to the next comma or line break.
      readUnquoted(value);
      if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    for (;;) {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
      if (fEnded !== COMMA) break;
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
