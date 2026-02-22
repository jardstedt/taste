import type { Addon } from '../types/index.js';

const ADDON_LABELS: Record<string, string> = {
  screenshot: 'Screenshot',
  extended_time: 'Extended Time',
  written_report: 'Written Report',
  second_opinion: 'Second Opinion',
  image_upload: 'Image Upload',
  follow_up: 'Follow-up',
  crowd_poll: 'Crowd Poll',
};

interface AddonDetailProps {
  addon: Addon;
  onRespond: (addonId: string, accepted: boolean) => void;
}

export function AddonDetail({ addon, onRespond }: AddonDetailProps) {
  return (
    <div className="addon-detail">
      <div className="addon-detail-header">
        <span className="text-bold">{ADDON_LABELS[addon.addonType] || addon.addonType}</span>
        <span className="text-sm text-bold">+${addon.priceUsdc.toFixed(2)} USDC</span>
      </div>
      {addon.description && (
        <p className="text-sm mt-sm" style={{ margin: 0 }}>{addon.description}</p>
      )}
      {addon.status === 'pending' && (
        <div className="flex gap-sm mt-md">
          <button onClick={() => onRespond(addon.id, true)} className="btn btn-primary btn-sm">Accept</button>
          <button onClick={() => onRespond(addon.id, false)} className="btn btn-ghost btn-sm">Decline</button>
        </div>
      )}
      {addon.status !== 'pending' && (
        <div className="mt-sm">
          <span className={`badge badge-sm ${
            addon.status === 'accepted' ? 'badge-success' :
            addon.status === 'declined' ? 'badge-error' : 'badge-grey'
          }`}>
            {addon.status}
          </span>
        </div>
      )}
    </div>
  );
}
