import { useState, useEffect, useCallback } from 'react';
import type { Job } from '../types/index.js';
import * as api from '../api/client.js';

export function useJobs(pollInterval = 30_000) {
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const [pendingRes, allRes] = await Promise.all([
        api.getPendingJobs(),
        api.getJobs(),
      ]);

      if (pendingRes.success && pendingRes.data) {
        setPendingJobs(pendingRes.data as Job[]);
      }
      if (allRes.success && allRes.data) {
        setAllJobs(allRes.data as Job[]);
      }
    } catch {
      // Silently fail on poll errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, pollInterval);
    return () => clearInterval(interval);
  }, [fetchJobs, pollInterval]);

  return { pendingJobs, allJobs, loading, refresh: fetchJobs };
}
