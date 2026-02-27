interface JobStatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  completed: { label: 'Completed', bg: '#D1FAE5', fg: '#065F46' },
  cancelled: { label: 'Declined', bg: '#FEE2E2', fg: '#991B1B' },
  timeout: { label: 'Timed Out', bg: '#F3F4F6', fg: '#6B7280' },
};

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const style = STATUS_STYLES[status];
  if (!style) return null;

  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      background: style.bg,
      color: style.fg,
      whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  );
}
