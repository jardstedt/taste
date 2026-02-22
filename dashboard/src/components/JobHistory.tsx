import type { Job } from '../types/index.js';
import { OFFERING_LABELS } from '../types/index.js';

interface JobHistoryProps {
  jobs: Job[];
  loading: boolean;
}

export function JobHistory({ jobs, loading }: JobHistoryProps) {
  if (loading) {
    return <p className="text-grey">Loading job history...</p>;
  }

  const completedJobs = jobs.filter(j => !['pending', 'assigned'].includes(j.status));

  return (
    <div>
      <h2 className="page-title mb-lg">Job History</h2>

      {completedJobs.length === 0 ? (
        <div className="empty-state">No completed jobs yet.</div>
      ) : (
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Price</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {completedJobs.map(job => (
              <tr key={job.id}>
                <td>{OFFERING_LABELS[job.offeringType]}</td>
                <td><StatusBadge status={job.status} /></td>
                <td>${job.priceUsdc.toFixed(2)}</td>
                <td className="text-grey">
                  {new Date(job.deliveredAt ?? job.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    delivered: 'badge-success',
    rejected: 'badge-error',
    timeout: 'badge-grey',
    in_progress: 'badge-warning',
  };

  return (
    <span className={`badge badge-sm ${classMap[status] ?? 'badge-grey'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
