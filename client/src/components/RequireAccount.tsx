/** @format */

import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function RequireAccount({ children }: { children: ReactNode }) {
	const [authorized, setAuthorized] = useState<boolean | null>(null);
	useEffect(() => {
		let active = true;
		api.me()
			.then(({ user }) => {
				if (active) setAuthorized(Boolean(user));
			})
			.catch(() => {
				if (active) setAuthorized(false);
			});
		return () => {
			active = false;
		};
	}, []);
	if (authorized === null)
		return (
			<main className="loading-screen">
				Vérification de la session...
			</main>
		);
	if (!authorized) return <Navigate to="/" replace />;
	return <>{children}</>;
}
