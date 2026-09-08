import { useState } from 'react';
import { FlaskIcon, ClipboardIcon, HistoryIcon } from './icons';

const DISMISSED_KEY = 'purecycle.howItWorks.dismissed';

const steps = [
  {
    icon: FlaskIcon,
    title: '1. Pick a machine',
    body: 'Choose a piece of equipment on the left to see its cleaning history.',
  },
  {
    icon: ClipboardIcon,
    title: '2. Log a cleaning',
    body: 'Add or edit a record — who cleaned it, when, how, and whether it’s verified.',
  },
  {
    icon: HistoryIcon,
    title: '3. Check the trail',
    body: 'Every save is tracked field by field, so History always shows exactly what changed.',
  },
];

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * A one-time explainer for what this tool is for, shown until the viewer dismisses it.
 * Persisted in localStorage rather than a database field: it is a per-browser UI
 * convenience, not something that needs to be shared across users or devices.
 */
export function HowItWorks() {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage may be unavailable (private browsing); dismissing for this
      // session only is an acceptable fallback.
    }
  }

  return (
    <section className="how-it-works" aria-label="How PureCycle works">
      <div className="how-it-works-intro">
        <h2>Every cleaning, fully traceable</h2>
        <p>
          PureCycle logs when equipment is cleaned and keeps a field-level history of
          every edit, so a record can always be traced back for a regulatory audit.
        </p>
      </div>
      <ol className="how-it-works-steps">
        {steps.map((step) => (
          <li key={step.title}>
            <span className="how-it-works-icon">
              <step.icon size={16} />
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn-link how-it-works-dismiss" onClick={dismiss}>
        Got it, hide this
      </button>
    </section>
  );
}
