import { linkify } from '../utils/format.js';

/** Renders text with http(s) URLs as clickable links. Safe: only http/https protocols. */
export function LinkifyText({ text }: { text: string }) {
  const segments = linkify(text);

  if (segments.length === 1 && segments[0].type === 'text') {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'link' ? (
          <a
            key={i}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {seg.value}
          </a>
        ) : (
          <span key={i}>{seg.value}</span>
        ),
      )}
    </>
  );
}
