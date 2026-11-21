import { Fragment, createElement } from 'react';

/**
 * A minimal markdown renderer: headings, bold, italic, code, lists, links.
 *
 * The output is React elements rather than an HTML string, so escaping is
 * handled by JSX — no dangerouslySetInnerHTML anywhere.
 */

const INLINE_PATTERNS = [
  { re: /`([^`]+)`/, node: (m) => createElement('code', { key: 'c' }, m[1]) },
  { re: /\*\*([^*]+)\*\*/, node: (m) => createElement('strong', { key: 'b' }, m[1]) },
  { re: /(^|[^*])\*([^*]+)\*/, node: (m) => [m[1], createElement('em', { key: 'i' }, m[2])] },
  {
    re: /\[([^\]]+)\]\(([^)]+)\)/,
    node: (m) =>
      createElement(
        'a',
        { key: 'a', href: m[2], rel: 'noreferrer noopener' },
        m[1]
      ),
  },
];

/** Render the inline spans of a single line of markdown. */
function renderInline(text) {
  // Find the earliest match among all patterns, and split around it. Repeat
  // until nothing matches — this preserves the original ordering.
  let rest = text;
  const out = [];
  let key = 0;

  while (rest) {
    let best = null;
    for (const pattern of INLINE_PATTERNS) {
      const m = pattern.re.exec(rest);
      if (m && (!best || m.index < best.m.index)) {
        best = { pattern, m };
      }
    }
    if (!best) {
      out.push(rest);
      break;
    }
    const { pattern, m } = best;
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const node = pattern.node(m);
    out.push(Array.isArray(node) ? node : node);
    rest = rest.slice(m.index + m[0].length);
    key += 1;
  }

  return out.map((part, i) =>
    typeof part === 'string' ? part : createElement(Fragment, { key: `f${i}` }, part)
  );
}

/** Split markdown into blocks and render each one. */
export default function Markdown({ text }) {
  const blocks = String(text ?? '').split(/\n{2,}/);
  const out = [];

  blocks.forEach((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(6, heading[1].length + 1);
      out.push(createElement(`h${level}`, { key: index }, renderInline(heading[2])));
      return;
    }

    if (/^```/.test(trimmed)) {
      const body = trimmed.replace(/^```[a-z]*\n?/, '').replace(/```$/, '');
      out.push(
        createElement(
          'pre',
          { key: index },
          createElement('code', null, body)
        )
      );
      return;
    }

    const lines = trimmed.split('\n');

    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      out.push(
        createElement(
          'ul',
          { key: index },
          lines.map((l, i) =>
            createElement('li', { key: i }, renderInline(l.replace(/^\s*[-*]\s+/, '')))
          )
        )
      );
      return;
    }

    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      out.push(
        createElement(
          'ol',
          { key: index },
          lines.map((l, i) =>
            createElement('li', { key: i }, renderInline(l.replace(/^\s*\d+[.)]\s+/, '')))
          )
        )
      );
      return;
    }

    out.push(
      createElement(
        'p',
        { key: index },
        trimmed.split('\n').map((line, i, arr) => (
          <Fragment key={i}>
            {renderInline(line)}
            {i < arr.length - 1 ? <br /> : null}
          </Fragment>
        ))
      )
    );
  });

  return createElement(Fragment, null, out);
}
