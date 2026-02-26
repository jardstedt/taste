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

/** Parse a JSON description string into key-value pairs for display */
export function parseDescription(desc: string | null): { isJson: boolean; pairs: [string, string][]; raw: string } {
  if (!desc) return { isJson: false, pairs: [], raw: '' };
  const trimmed = desc.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      const pairs: [string, string][] = [];
      for (const [k, v] of Object.entries(obj)) {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();
        const value = typeof v === 'string' ? v : JSON.stringify(v);
        pairs.push([label, value]);
      }
      return { isJson: true, pairs, raw: trimmed };
    } catch {
      // Not valid JSON
    }
  }
  return { isJson: false, pairs: [], raw: trimmed };
}
