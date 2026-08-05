/**
 * Data Visuals — embedded Superset analytics + "Customize" (private dashboard editor).
 * Extracted from the Vulnerability Dashboard so interactive visuals live on their own page.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { BarChart3, Sliders, RefreshCw, Calendar, ChevronDown, Check } from 'lucide-react';
import { vulnerabilityApi, supersetApi, openSupersetEditor } from '../../api/api';
import type { ScanRun } from '../../types';

function fmtDate(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(dt: string | null): string {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export const DataVisuals: React.FC = () => {
  const supersetContainer = useRef<HTMLDivElement>(null);
  const [supersetReady, setSupersetReady] = useState(false);
  const [supersetError, setSupersetError] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // scan selector
  const [allRuns, setAllRuns] = useState<ScanRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const selectedRunIdRef = useRef<number | null>(null);
  selectedRunIdRef.current = selectedRunId;

  const loadRuns = useCallback(async () => {
    try {
      const res = await vulnerabilityApi.listRuns(1, 100);
      setAllRuns(res.items);
    } catch (err) {
      console.error('[DataVisuals] runs load error', err);
    }
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  // close selector on outside click
  useEffect(() => {
    if (!selectorOpen) return;
    const h = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) setSelectorOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [selectorOpen]);

  // (re-)embed Superset when the selected scan changes or on manual refresh
  useEffect(() => {
    let cancelled = false;
    const runId = selectedRunId ?? undefined;
    async function embed() {
      if (cancelled) return;
      try {
        const tokenRes = await supersetApi.guestToken(runId);
        if (cancelled) return;
        if (!tokenRes.dashboard_id) { setSupersetError('Superset dashboard is not configured yet.'); return; }
        let sdk: typeof import('@superset-ui/embedded-sdk');
        try { sdk = await import('@superset-ui/embedded-sdk'); } catch {
          setSupersetError('Superset embed SDK failed to load.'); return;
        }
        if (cancelled || !supersetContainer.current) { if (!cancelled) setSupersetError('Embed container is not ready.'); return; }
        supersetContainer.current.innerHTML = '';
        setSupersetReady(false);
        await sdk.embedDashboard({
          id: tokenRes.dashboard_id,
          supersetDomain: tokenRes.superset_domain,
          mountPoint: supersetContainer.current,
          fetchGuestToken: async () => (await supersetApi.guestToken(selectedRunIdRef.current ?? undefined)).token,
          dashboardUiConfig: { hideTitle: true, hideTab: true, filters: { expanded: false } },
        });
        if (cancelled) return;
        setSupersetReady(true);
        setSupersetError(null);
        const iframe = supersetContainer.current?.querySelector('iframe');
        if (iframe) {
          let firstLoad = true;
          iframe.addEventListener('load', () => { if (firstLoad) { firstLoad = false; return; } if (!cancelled) embed(); });
        }
      } catch (err: any) {
        if (cancelled) return;
        setSupersetError(err?.message || 'Failed to load Superset dashboard.');
      }
    }
    embed();
    return () => { cancelled = true; };
  }, [selectedRunId, reloadKey]);

  const completedRuns = useMemo(
    () => allRuns.filter(r => r.status === 'completed' && r.completed_at),
    [allRuns],
  );
  const latestCompleted = completedRuns[0];
  const activeRun = selectedRunId !== null ? allRuns.find(r => r.id === selectedRunId) : latestCompleted;

  function getSelectorLabel() {
    if (selectedRunId === null)
      return latestCompleted ? `Latest  ·  ${fmtDate(latestCompleted.completed_at)}  ${fmtTime(latestCompleted.completed_at)}` : 'Latest Scan';
    if (!activeRun) return `Scan #${selectedRunId}`;
    return `${fmtDate(activeRun.completed_at)}  ·  ${fmtTime(activeRun.completed_at)}`;
  }

  const selectRun = (id: number | null) => { setSelectedRunId(id); setSelectorOpen(false); };

  const handleCustomize = async () => {
    setCustomizing(true);
    setMessage(null);
    try { await openSupersetEditor(); }
    catch (err: any) { setMessage(err?.response?.data?.detail || err?.message || 'Could not open the dashboard editor.'); }
    finally { setCustomizing(false); }
  };

  const handleRefresh = () => { loadRuns(); setReloadKey(k => k + 1); };

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Visuals</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Interactive analytics — explore, drill down, and customize your own dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCustomize} disabled={customizing}
            title="Open your private dashboard in the Superset editor"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white">
            <Sliders className="w-4 h-4" /> {customizing ? 'Opening…' : 'Customize'}
          </button>
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-red-600 dark:text-red-400">{message}</p>}

      {/* ── Scan selector ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-1 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Viewing scan:</span>
        <div ref={selectorRef} className="relative">
          <button onClick={() => setSelectorOpen(p => !p)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="max-w-xs truncate">{getSelectorLabel()}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${selectorOpen ? 'rotate-180' : ''}`} />
          </button>

          {selectorOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
              <button onClick={() => selectRun(null)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">Latest Scan</span>
                  {latestCompleted && <span className="ml-2 text-xs text-gray-400">{fmtDate(latestCompleted.completed_at)} {fmtTime(latestCompleted.completed_at)}</span>}
                </div>
                {selectedRunId === null && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
              </button>

              {completedRuns.length > 0 ? (
                <div className="border-t border-gray-100 dark:border-gray-700 max-h-72 overflow-y-auto">
                  {completedRuns.map(run => (
                    <button key={run.id} onClick={() => selectRun(run.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
                      <span className="text-gray-800 dark:text-gray-100">
                        {fmtDate(run.completed_at)}
                        <span className="ml-2 text-xs text-gray-400">{fmtTime(run.completed_at)} · {run.trigger_type.replace(/_/g, ' ')}</span>
                      </span>
                      {selectedRunId === run.id && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">No completed scans available yet.</p>
              )}
            </div>
          )}
        </div>
        {selectedRunId !== null && (
          <button onClick={() => selectRun(null)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Reset to latest</button>
        )}
      </div>

      {/* ── Superset Analytics embed ───────────────────────────────────── */}
      <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics</h2>
        </div>
        <div ref={supersetContainer} className="superset-embed w-full" style={{ minHeight: supersetReady ? 2400 : 0 }} />
        {!supersetReady && (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {supersetError
              ? `Superset dashboard unavailable: ${supersetError}`
              : 'Loading Superset dashboard…'}
          </div>
        )}
      </div>

    </div>
  );
};

export default DataVisuals;
