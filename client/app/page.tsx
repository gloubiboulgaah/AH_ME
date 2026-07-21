/** @format */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type User } from '@/lib/api';
import JoinScreen from '@/components/JoinScreen';

export default function HomePage() {
	const router = useRouter();

	const [user, setUser] = useState<User | null>(null);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		api.me()
			.then((data) => setUser(data.user))
			.catch(() => setUser(null))
			.finally(() => setChecked(true));
	}, []);

	const logout = async () => {
		await api.logout().catch(() => {});
		setUser(null);
	};

	const handleGuestJoin = (username: string) => {
		localStorage.setItem('ahme_guest_username', username);

		console.log('Événement rejoindre mock :', {
			username,
		});

		router.push(`/play?username=${encodeURIComponent(username)}`);
	};

	if (!checked) {
		return (
			<main className="loading-screen">
				<p>Chargement...</p>
			</main>
		);
	}

	if (!user) {
		return (
			<>
				<JoinScreen onJoin={handleGuestJoin} />

				<div className="guest-auth-links">
					<p>Tu as déjà un compte ?</p>

					<Link href="/login">Connexion</Link>

					<span>·</span>

					<Link href="/register">Inscription</Link>
				</div>
			</>
		);
	}

	return (
		<main className="landing">
			<h1>AH_ME</h1>

			<p>Espace communautaire 3D multijoueur</p>

			<div className="landing-actions">
				<p>
					Connecté en tant que <strong>{user.username}</strong>
				</p>

				<button
					className="btn"
					type="button"
					onClick={() => router.push('/play')}
				>
					Jouer
				</button>

				<button
					className="btn btn-ghost"
					type="button"
					onClick={logout}
				>
					Déconnexion
				</button>
			</div>
		</main>
	);
}