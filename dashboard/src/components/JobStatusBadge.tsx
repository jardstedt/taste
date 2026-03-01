interface JobStatusBadgeProps {
  status: string;
  acceptedAt?: string | null;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  completed: { label: 'Completed', bg: '#D1FAE5', fg: '#065F46' },
  declined: { label: 'Declined', bg: '#FEE2E2', fg: '#991B1B' },
  expired: { label: 'Expired', bg: '#FEF3C7', fg: '#92400E' },
  timeout: { label: 'Timed Out', bg: '#F3F4F6', fg: '#6B7280' },
};

export function JobStatusBadge({ status, acceptedAt }: JobStatusBadgeProps) {
  let key = status;
  if (status === 'cancelled') {
    key = acceptedAt ? 'declined' : 'expired';
  }

  const style = STATUS_STYLES[key];
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
