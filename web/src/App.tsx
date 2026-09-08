import { useState } from 'react';
import { EquipmentList } from './components/EquipmentList';
import { CleaningRecordsPanel } from './components/CleaningRecordsPanel';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './hooks/useAuth';
import type { Equipment } from './api/types';

export function App() {
  const { user, loading, logout } = useAuth();
  const [selected, setSelected] = useState<Equipment | null>(null);

  if (loading) {
    return <p className="loading">Loading…</p>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Equipment Cleaning Log</h1>
          <div className="subtitle">Every change is recorded with a field-level audit trail.</div>
        </div>
        <div className="user">
          <span>
            Signed in as <strong>{user.name}</strong>
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
          <section className="panel">
            <p className="empty">Select a piece of equipment to see its cleaning records.</p>
          </section>
        )}
      </main>
    </>
  );
}
