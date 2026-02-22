import { useState } from 'react';
import * as api from '../api/client.js';
import type { AuthUser, Availability } from '../types/index.js';

interface AvailabilityToggleProps {
  user: AuthUser;
  onUpdate: () => void;
}

export function AvailabilityToggle({ user, onUpdate }: AvailabilityToggleProps) {
  const [updating, setUpdating] = useState(false);
  const isOnline = user.availability === 'online';

  const toggle = async () => {
    setUpdating(true);
    const newAvailability: Availability = isOnline ? 'offline' : 'online';
    await api.updateExpert(user.expertId, { availability: newAvailability });
    onUpdate();
    setUpdating(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={updating}
      className={`availability-toggle ${isOnline ? 'availability-online' : 'availability-offline'}`}
    >
      <span className={`status-dot ${isOnline ? 'status-dot-online' : 'status-dot-offline'}`} style={{ width: 6, height: 6 }} />
      <span>{isOnline ? 'Available' : 'Offline'}</span>
    </button>
  );
}
