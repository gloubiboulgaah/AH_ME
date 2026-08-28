/** @format */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type User } from '@/lib/api';
import JoinScreen from '@/components/JoinScreen';

export default function HomePage() {
	const navigate = useNavigate();

	const [user, setUser] = useState<User | null>(null);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		api.me()
			.then((data) => {
				setUser(data.user);

				// Un compte connecté est prioritaire sur le pseudo invité.
				if (data.user) {
					localStorage.removeItem('ahme_guest_username');
				}
			})
			.catch(() => {
				setUser(null);
			})
			.finally(() => {
				setChecked(true);
			});
	}, []);

	const logout = async () => {
		await api.logout().catch(() => {});
		setUser(null);
	};

	const handleGuestJoin = (username: string) => {
		const normalizedUsername = username.trim();

		localStorage.setItem('ahme_guest_username', normalizedUsername);

		console.log('Événement rejoindre mock :', {
			username: normalizedUsername,
		});

		navigate('/play');
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

					<Link to="/login">Connexion</Link>

					<span>·</span>

					<Link to="/register">Inscription</Link>
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
					onClick={() => navigate('/play')}>
					Jouer
				</button>

				<button
					className="btn btn-ghost"
					type="button"
					onClick={logout}>
					Déconnexion
				</button>
			</div>
		</main>
	);
}
