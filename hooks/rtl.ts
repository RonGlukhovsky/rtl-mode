// Display-only bidi rewrite of markdown text: every line that holds Hebrew
// gets its direction from the majority of its letters, with explicit
// embeddings around the runs of the other direction.

export const RLM = '‏'
export const LRM = '‎'
export const RLE = '‫'
export const LRE = '‪'
export const PDF = '‬'

const HE = 'א-תיִ-ﭏ'
const EN = 'A-Za-zÀ-ɏ'
const isHe = (c: string | undefined) => c !== undefined && new RegExp(`[${HE}]`).test(c)
const hasHe = (s: string) => new RegExp(`[${HE}]`).test(s)

type Segment =
  | { kind: 'text' | 'code' | 'link'; raw: string }
  | { kind: 'quote'; raw: string; open: string; inner: string; close: string }

const QUOTES: Record<string, string> = { '"': '"', '“': '”', '„': '“', '«': '»' }

function count(s: string) {
  return {
    he: (s.match(new RegExp(`[${HE}]`, 'g')) ?? []).length,
    en: (s.match(new RegExp(`[${EN}]`, 'g')) ?? []).length,
  }
}

// A `"` between two Hebrew letters is a gershayim (צה"ל), not a quote mark.
function isGershayim(s: string, i: number) {
  return s[i] === '"' && isHe(s[i - 1]) && isHe(s[i + 1])
}

function codeSpanEnd(s: string, i: number): number | undefined {
  let n = 0
  while (s[i + n] === '`') n++
  for (let j = i + n; j < s.length; ) {
    if (s[j] !== '`') {
      j++
      continue
    }
    let m = 0
    while (s[j + m] === '`') m++
    if (m === n) return j + m
    j += m
  }
  return undefined
}

export function tokenize(s: string): Segment[] {
  const out: Segment[] = []
  let text = ''
  const push = (seg: Segment) => {
    if (text) out.push({ kind: 'text', raw: text })
    text = ''
    out.push(seg)
  }
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    const rest = s.slice(i)
    if (c === '`') {
      const end = codeSpanEnd(s, i)
      if (end !== undefined) {
        push({ kind: 'code', raw: s.slice(i, end) })
        i = end
        continue
      }
      let n = 0
      while (s[i + n] === '`') n++
      text += s.slice(i, i + n)
      i += n
      continue
    }
    const link =
      rest.match(/^!?\[[^\]\n]*\]\([^)\n]*\)/) ??
      rest.match(/^<https?:\/\/[^>\s]+>/) ??
      (/\w/.test(s[i - 1] ?? '') ? null : rest.match(/^https?:\/\/[^\s<>()"]+/))
    if (link) {
      push({ kind: 'link', raw: link[0] })
      i += link[0].length
      continue
    }
    const close = QUOTES[c]
    if (close !== undefined && !isGershayim(s, i)) {
      let j = i + 1
      while (j < s.length && (s[j] !== close || isGershayim(s, j))) j++
      if (j < s.length && j > i + 1) {
        push({ kind: 'quote', raw: s.slice(i, j + 1), open: c, inner: s.slice(i + 1, j), close })
        i = j + 1
        continue
      }
    }
    text += c
    i++
  }
  if (text) out.push({ kind: 'text', raw: text })
  return out
}

// Whether a line's content reads right to left: by the letters outside
// quotes, code spans and links, or by all of them when those are all it has.
export function isRtl(segments: Segment[]) {
  const plain = segments.filter(seg => seg.kind === 'text').map(seg => seg.raw).join('')
  let { he, en } = count(plain)
  if (he + en === 0) ({ he, en } = count(segments.map(seg => seg.raw).join('')))
  return he >= en
}

// A Hebrew run inside English: Hebrew letters and whatever lies between them
// short of a Latin letter, with the punctuation that closes it.
const HE_RUN = new RegExp(`[${HE}](?:[^${EN}]*[${HE}])?[.,!?:;…׃׳״]*`, 'g')

export function rewriteContent(content: string): string {
  if (!hasHe(content) || content.startsWith(RLM) || content.startsWith(LRM)) return content
  const segments = tokenize(content)
  if (isRtl(segments)) {
    return (
      RLM +
      RLE +
      segments.map(seg => (seg.kind === 'code' && !hasHe(seg.raw) ? LRE + seg.raw + PDF : seg.raw)).join('')
    )
  }
  return (
    LRM +
    LRE +
    segments
      .map(seg => {
        if (seg.kind === 'quote') {
          const { he, en } = count(seg.inner)
          return he > en ? seg.open + RLE + seg.inner + PDF + seg.close : seg.raw
        }
        if (seg.kind === 'text') return seg.raw.replace(HE_RUN, run => RLE + run + PDF)
        return seg.raw
      })
      .join('')
  )
}

// Markdown's line markers: blockquote, heading, bullet, number, task box.
const MARKER = /^(?:[ \t]+|>|#{1,6}(?=[ \t]|$)|[-*+](?=[ \t])|\d{1,9}[.)](?=[ \t])|\[[ xX]\](?=[ \t]))/

export function splitPrefix(line: string): [string, string] {
  let i = 0
  for (;;) {
    const m = line.slice(i).match(MARKER)
    if (!m) break
    i += m[0].length
  }
  return [line.slice(0, i), line.slice(i)]
}

function splitCells(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  for (let i = 0; i < line.length; ) {
    const c = line[i]!
    if (c === '\\' && line[i + 1] === '|') {
      cell += '\\|'
      i += 2
    } else if (c === '`') {
      const end = codeSpanEnd(line, i) ?? i + 1
      cell += line.slice(i, end)
      i = end
    } else if (c === '|') {
      cells.push(cell)
      cell = ''
      i++
    } else {
      cell += c
      i++
    }
  }
  cells.push(cell)
  return cells
}

function rewriteCell(cell: string) {
  const lead = cell.match(/^\s*/)![0]
  return lead + rewriteContent(cell.slice(lead.length))
}

export function rewriteLine(line: string): string {
  if (!hasHe(line)) return line
  if (/^\s*\|/.test(line)) return splitCells(line).map(rewriteCell).join('|')
  const [prefix, content] = splitPrefix(line)
  return prefix + rewriteContent(content)
}

export function rewriteText(text: string): string {
  let fence: { char: string; length: number } | undefined
  return text
    .split('\n')
    .map(line => {
      const m = line.match(/^\s*(`{3,}|~{3,})/)
      if (fence) {
        if (m && m[1]![0] === fence.char && m[1]!.length >= fence.length) fence = undefined
        return line
      }
      if (m) {
        fence = { char: m[1]![0]!, length: m[1]!.length }
        return line
      }
      return rewriteLine(line)
    })
    .join('\n')
}

export const GUIDANCE = [
  'The person reads this session with right-to-left display on. Format your text so it renders well:',
  '- When you answer in Hebrew: begin every line (including list items, headings and table cells) with a Hebrew word;',
  '  put spaces around English words; never join English to Hebrew with a hyphen (write "קובץ ה JSON", not "קובץ ה-JSON");',
  '  put every command, file path, identifier and code fragment in backticks.',
  '- When you answer in English: write as usual, and put any Hebrew text inside double quotes.',
].join('\n')
