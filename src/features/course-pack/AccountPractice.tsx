"use client";
import { useSyncExternalStore, useState } from 'react';
import { identifyAccount } from './sync';
const KEY = 'verbalibera-foundation-account';
const subscribe = (listener: () => void) => {
  window.addEventListener('foundation-account-selection', listener);
  return () => window.removeEventListener('foundation-account-selection', listener);
};
const snapshot = () => {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
};
const serverSnapshot = () => undefined;
export function usePracticeAccount() {
  const scope = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const select = (next: string | null) => {
    if (next) localStorage.setItem(KEY, next); else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('foundation-account-selection'));
  };
  return { scope: scope ?? null, ready: scope !== undefined, select };
}
export function AccountPractice({ scope, select, status, retry }: {
  scope: string | null; select: (scope: string | null) => void; status: string; retry: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <section aria-label="Practice account" className="study-account">
    <p>{scope ? 'Account practice · available offline on this device.' : 'Guest practice · saved only on this device.'}</p>
    <p className="study-scope">Guest and account practice stay separate. To transfer guest history, export its backup, select account practice, then import it. Account history remains available on this browser for offline use; use a trusted device.</p>
    <div className="study-actions">
      <button disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { select(await identifyAccount()); } catch (e) { setError(e instanceof Error ? e.message : 'Could not open account practice.'); }
        finally { setBusy(false); }
      }}>{busy ? 'Checking account…' : 'Use signed-in account'}</button>
      {scope ? <><button onClick={() => { try { select(null); } catch { setError('Could not change device selection.'); } }}>Use guest practice</button><button onClick={retry}>Sync now</button></> : <a href="/login">Sign in</a>}
    </div>
    {status ? <p role="status">{status}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
