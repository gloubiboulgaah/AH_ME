import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';

// A registered account or a guest who chose a nickname may browse servers.
export default function RequireGameEntry({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    api.me().then(({ user }) => {
      if (active) setAllowed(Boolean(user || localStorage.getItem('ahme_guest_username')?.trim()));
    }).catch(() => {
      if (active) setAllowed(Boolean(localStorage.getItem('ahme_guest_username')?.trim()));
    });
    return () => { active = false; };
  }, []);
  if (allowed === null) return <main className="loading-screen">Vérification de la session...</main>;
  return allowed ? <>{children}</> : <Navigate to="/" replace />;
}
