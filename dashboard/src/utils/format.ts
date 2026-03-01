/** "trust_evaluation" → "Trust Evaluation" */
export function formatOffering(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** "0xAbCdEf123456" → "0xA...456" */
export function truncateAddress(addr: string | null): string {
  if (!addr) return '???';
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 3)}...${addr.slice(-3)}`;
}

/**
 * Split text into segments of plain text and https/http URLs.
 * Only http(s) URLs are linkified — no javascript:, data:, or other protocols.
 */
export function linkify(text: string): { type: 'text' | 'link'; value: string }[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]},]+/g;
  const segments: { type: 'text' | 'link'; value: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'link', value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

/** Format a non-string JSON value for human-readable display */
function formatJsonValue(v: unknown): string {
  if (Array.isArray(v)) {
    // Array of objects with id+description (e.g. option_ranking options)
    if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null && 'id' in v[0] && 'description' in v[0]) {
      return v.map((item: Record<string, unknown>) => `${item.id}: ${item.description}`).join('\n');
    }
    // Array of primitives
    if (v.every(item => typeof item === 'string' || typeof item === 'number')) {
      return v.join(', ');
    }
  }
  return JSON.stringify(v);
}

/** Label overrides for known JSON keys that need friendlier display names */
const LABEL_OVERRIDES: Record<string, string> = {
  videoUrl: 'Content URL',
};

/** Parse a JSON description string into key-value pairs for display */
export function parseDescription(desc: string | null): { isJson: boolean; pairs: [string, string][]; raw: string } {
  if (!desc) return { isJson: false, pairs: [], raw: '' };
  const trimmed = desc.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      const pairs: [string, string][] = [];
      for (const [k, v] of Object.entries(obj)) {
        const label = LABEL_OVERRIDES[k]
          ?? k.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()
               .replace(/\b\w/g, c => c.toUpperCase());
        const value = typeof v === 'string' ? v : formatJsonValue(v);
        pairs.push([label, value]);
      }
      return { isJson: true, pairs, raw: trimmed };
    } catch {
      // Not valid JSON
    }
  }
  return { isJson: false, pairs: [], raw: trimmed };
}
