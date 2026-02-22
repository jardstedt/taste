import { useNavigate } from 'react-router-dom';
import type { Job } from '../types/index.js';
import { OFFERING_LABELS } from '../types/index.js';

interface RequestQueueProps {
  jobs: Job[];
  loading: boolean;
  onRefresh: () => void;
}

export function RequestQueue({ jobs, loading, onRefresh }: RequestQueueProps) {
  const navigate = useNavigate();

  if (loading) {
    return <p className="text-grey">Loading pending requests...</p>;
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Pending Requests</h2>
        <button onClick={onRefresh} className="btn btn-primary btn-sm">Refresh</button>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          No pending requests. New jobs will appear here when AI agents request human judgment.
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {jobs.map(job => (
            <div
              key={job.id}
              onClick={() => navigate(`/dashboard/job/${job.id}`)}
              className={`job-card ${job.status === 'assigned' ? 'job-card-assigned' : 'job-card-pending'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-sm">
                  <span className="chip">{OFFERING_LABELS[job.offeringType]}</span>
                  <span className="text-sm text-grey">${job.priceUsdc.toFixed(2)}</span>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-sm text-sm" style={{ color: 'var(--color-grey-2)' }}>
                {summarizeRequirements(job.requirements)}
              </div>
              {job.deadlineAt && (
                <div className="mt-sm text-xs text-grey">
                  Deadline: {new Date(job.deadlineAt).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    pending: 'badge-info',
    assigned: 'badge-accent',
    in_progress: 'badge-warning',
    delivered: 'badge-success',
    rejected: 'badge-error',
    timeout: 'badge-grey',
  };

  return (
    <span className={`badge badge-sm ${classMap[status] ?? 'badge-grey'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function summarizeRequirements(requirements: Record<string, unknown>): string {
  const entries = Object.entries(requirements);
  if (entries.length === 0) return 'No details provided';

  for (const [key, value] of entries) {
    if (typeof value === 'string' && value.length > 0) {
      const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      const preview = value.length > 100 ? value.slice(0, 100) + '...' : value;
      return `${label}: ${preview}`;
    }
  }

  return `${entries.length} field(s)`;
}
