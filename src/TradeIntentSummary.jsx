import { AlertTriangle, CheckCircle } from 'lucide-react';
import {
  formatConfirmationSummary,
  formatConfidenceBreakdown,
  formatIntentMoney,
  formatQualityFlags,
  formatRiskPlanSummary,
  formatSentinelChecks,
  formatSourceAdjustedConfidence,
  formatSourceConfirmationPlan,
  summarizePulsePacket,
} from './tradeIntent';

export const TradeIntentSummary = ({
  intent,
  sentinel,
  pulsePacket,
  pulseStatus,
  confirmationSources,
  loading,
  error,
}) => {
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="rounded-lg bg-dark-700 p-6 text-center text-gray-400">
        {loading ? 'Loading trade intent...' : 'No trade intent loaded'}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg bg-dark-700 p-4">
        <p className="text-sm text-gray-200 leading-6">{intent.readable_summary}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-dark-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Confidence</div>
          <div className="text-xl font-mono text-white">{intent.confidence.toFixed(1)}</div>
        </div>
        <div className="bg-dark-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Source-Adjusted</div>
          <div className="text-xl font-mono text-white">{intent.source_adjusted_confidence.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-1">{formatSourceAdjustedConfidence(intent)}</div>
        </div>
        <div className="bg-dark-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Level</div>
          <div className="text-xl font-mono text-white">${intent.level_price.toFixed(2)}</div>
        </div>
        <div className="bg-dark-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Distance</div>
          <div className="text-xl font-mono text-white">{intent.distance_pct.toFixed(2)}%</div>
        </div>
        <div className="bg-dark-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Notional</div>
          <div className="text-xl font-mono text-white">{formatIntentMoney(intent.notional)}</div>
        </div>
      </div>

      <div className="bg-dark-700 rounded-lg p-4">
        <div className="text-xs text-gray-500 mb-3">Confidence Breakdown</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {formatConfidenceBreakdown(intent.confidence_breakdown).map((line) => (
            <div key={line} className="rounded bg-dark-800 px-3 py-2 text-sm text-gray-200">
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-dark-700 rounded-lg p-4">
        <div className="text-xs text-gray-500 mb-3">Signal Quality Flags</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {formatQualityFlags(intent.quality_flags).map((line) => (
            <div key={line} className="rounded bg-dark-800 px-3 py-2 text-sm text-gray-200">
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-dark-700 rounded-lg p-4">
        <div className="text-xs text-gray-500 mb-2">Source Confirmation Plan</div>
        {confirmationSources?.summary && (
          <p className="text-sm text-gray-200 mb-3">{confirmationSources.summary}</p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {formatSourceConfirmationPlan(confirmationSources).map((line) => (
            <div key={line} className="rounded bg-dark-800 px-3 py-2 text-sm text-gray-200">
              {line}
            </div>
          ))}
        </div>
        {confirmationSources?.recommended_next_sources?.length > 0 && (
          <p className="text-xs text-gray-500 mt-3">{confirmationSources.recommended_next_sources.join(' ')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-dark-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-accent-yellow" />
            <span className="text-white font-medium">Blockers</span>
          </div>
          {intent.blockers.length === 0 ? (
            <p className="text-sm text-gray-400">No active blockers.</p>
          ) : (
            <ul className="space-y-2">
              {intent.blockers.map((blocker) => (
                <li key={blocker} className="text-sm text-yellow-200">{blocker}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-dark-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={14} className="text-accent-green" />
            <span className="text-white font-medium">Reasons</span>
          </div>
          <ul className="space-y-2">
            {intent.reasons.map((reason) => (
              <li key={reason} className="text-sm text-gray-300">{reason}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-dark-700 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-2">Risk Plan</div>
          <p className="text-sm text-gray-200">{formatRiskPlanSummary(intent.risk_plan)}</p>
          {intent.risk_plan?.notes?.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">{intent.risk_plan.notes.join(' ')}</p>
          )}
        </div>

        <div className="bg-dark-700 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-2">Sentinel Edge</div>
          <p className="text-sm text-gray-200 mb-2">{formatConfirmationSummary(sentinel?.confirmation)}</p>
          <p className="text-sm text-gray-200">{sentinel?.reasons?.join(' ') || 'No Sentinel decision.'}</p>
        </div>
      </div>

      <div className="bg-dark-700 rounded-lg p-4">
        <div className="text-xs text-gray-500 mb-3">Sentinel Checklist</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {formatSentinelChecks(sentinel?.checks).map((line) => (
            <div key={line} className="rounded bg-dark-800 px-3 py-2 text-sm text-gray-200">
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-dark-700 rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs text-gray-500">Pulse</div>
            {pulseStatus?.status && (
              <span className="rounded border border-dark-500 px-2 py-1 text-xs uppercase text-gray-300">
                {pulseStatus.status.replace('_', ' ')}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-200">{summarizePulsePacket(pulsePacket, pulseStatus)}</p>
        </div>
      </div>
    </>
  );
};
