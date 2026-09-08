import { useState } from 'react';
import { EquipmentList } from './components/EquipmentList';
import { CleaningRecordsPanel } from './components/CleaningRecordsPanel';
import { LoginPage } from './pages/LoginPage';
import { LogoMark, ClipboardIcon } from './components/icons';
import { useAuth } from './hooks/useAuth';
import type { Equipment } from './api/types';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function App() {
  const { user, loading, logout } = useAuth();
  const [selected, setSelected] = useState<Equipment | null>(null);

  if (loading) {
    return (
      <div className="boot-loading">
        <LogoMark size={36} />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <LogoMark />
          <div>
            <h1>Equipment Cleaning Log</h1>
            <div className="subtitle">Every change is recorded with a field-level audit trail</div>
          </div>
        </div>
        <div className="user">
          <span className="user-avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className="user-name">
            <strong>{user.name}</strong>
            <span className="user-email">{user.email}</span>
          </span>
          <button type="button" className="btn btn-sm" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="layout">
        <EquipmentList
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          canEdit={Boolean(user)}
        />

        {selected ? (
          <CleaningRecordsPanel equipment={selected} currentUserName={user.name} />
        ) : (
          <section className="panel empty-state-panel">
            <div className="empty-state">
              <ClipboardIcon size={40} />
              <h3>No equipment selected</h3>
              <p>Choose a piece of equipment from the list to view and manage its cleaning records.</p>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
