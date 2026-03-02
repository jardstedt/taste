interface JobStatusBadgeProps {
  status: string;
  acceptedAt?: string | null;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  completed: { label: 'Completed', bg: 'rgba(45, 212, 191, 0.12)', fg: '#2DD4BF' },
  declined: { label: 'Declined', bg: 'rgba(239, 68, 68, 0.12)', fg: '#EF4444' },
  expired: { label: 'Expired', bg: 'rgba(251, 146, 60, 0.12)', fg: '#FB923C' },
  timeout: { label: 'Timed Out', bg: 'rgba(122, 118, 112, 0.12)', fg: '#7A7670' },
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
