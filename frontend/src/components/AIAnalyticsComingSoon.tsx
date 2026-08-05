/**
 * AI Analytics — "coming soon" modal.
 * The AI Analytics page ships in the next version; for now the nav entry opens
 * this preview of what the page will offer.
 */

import React, { useEffect } from 'react';
import { Sparkles, X, Bot, TrendingUp, MessageSquare, Wand2 } from 'lucide-react';

interface AIAnalyticsComingSoonProps {
  onClose: () => void;
}

const FEATURES = [
  {
    icon: Bot,
    title: 'AI Risk Prioritization',
    desc: 'Findings ranked automatically by real-world exploitability and business impact — not just CVSS.',
  },
  {
    icon: MessageSquare,
    title: 'Ask Your Data',
    desc: 'Query scan results in plain English, e.g. "which internet-facing servers gained critical vulns this month?"',
  },
  {
    icon: Wand2,
    title: 'Smart Remediation',
    desc: 'AI-suggested patch plans and playbook recommendations for the fastest path to compliance.',
  },
  {
    icon: TrendingUp,
    title: 'Predictive Trends',
    desc: 'Anomaly detection and forecasts that flag risk spikes before they become incidents.',
  },
];

export const AIAnalyticsComingSoon: React.FC<AIAnalyticsComingSoonProps> = ({ onClose }) => {
  // close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm ai-modal-backdrop"
      onClick={onClose}
    >
      <style>{`
        @keyframes aiModalIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes aiBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        .ai-modal-backdrop { animation: aiBackdropIn 0.15s ease-out; }
        .ai-modal-card { animation: aiModalIn 0.2s ease-out; }
      `}</style>

      <div
        className="ai-modal-card relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* gradient header */}
        <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/15">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">AI Analytics</h2>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium tracking-wide">
                  ✨ Feature coming soon
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            AI Analytics is planned for the next version of the platform. Here's a preview of what it will bring to your vulnerability data:
          </p>
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li
                key={title}
                className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all"
              >
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 self-start">
                  <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* footer */}
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm transition-colors"
          >
            Got it — can't wait!
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAnalyticsComingSoon;
