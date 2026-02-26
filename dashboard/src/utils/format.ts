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
