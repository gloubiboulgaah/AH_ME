/** @format */

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, type AppServer } from '../lib/api';

export default function ServersPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const kicked = Boolean(
		(location.state as { kicked?: boolean } | null)?.kicked
	);

	const [server, setServer] = useState<AppServer | null>(null);
	const [currentUserId, setCurrentUserId] = useState<number | null>(null);
	const [inviteCode, setInviteCode] = useState('');
	const [isGuest, setIsGuest] = useState(false);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		Promise.all([api.currentServer(), api.me()])
			.then(([serverResult, userResult]) => {
				setServer(serverResult.server);
				setCurrentUserId(userResult.user?.id ?? null);
				setIsGuest(!userResult.user);
			})
			.catch((err) => {
				setError(
					err instanceof Error
						? err.message
						: 'Impossible de charger le serveur.'
				);
			})
			.finally(() => setLoading(false));
	}, []);

	// Actualise uniquement la presence, sans recharger la page ni effacer les saisies.
	useEffect(() => {
		const interval = window.setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			api.currentServer()
				.then(({ server: updated }) => {
					setServer((previous) =>
						previous && updated && previous.id === updated.id
							? { ...previous, onlineCount: updated.onlineCount }
							: previous
					);
				})
				.catch(() => {});
		}, 10000);
		return () => window.clearInterval(interval);
	}, []);

	async function handleJoin() {
		if (!server) return;

		setError('');
		setActionLoading(true);

		try {
			if (isGuest) {
				if (server.visibility === 'private') {
					setError(
						'Ce salon privé nécessite un compte et une invitation.'
					);
					return;
				}
				navigate('/play');
				return;
			}
			await api.joinServer(
				server.id,
				server.visibility === 'private' ? inviteCode.trim() : undefined
			);

			navigate('/play');
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Impossible de rejoindre le serveur.'
			);
		} finally {
			setActionLoading(false);
		}
	}

	async function handleLeave() {
		if (!server) return;

		setError('');
		setActionLoading(true);

		try {
			await api.leaveServer(server.id);

			// on reste ici, le bouton Rejoindre reapparait
			const { server: refreshed } = await api.currentServer();
			setServer(refreshed);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Impossible de quitter le serveur.'
			);
		} finally {
			setActionLoading(false);
		}
	}

	if (loading) {
		return (
			<main className="join-page">
				<section className="panel server-panel">
					<p className="server-loading">Chargement...</p>
				</section>
			</main>
		);
	}

	if (!server) {
		return (
			<main className="join-page">
				<div
					className="join-background-shape join-background-shape-one"
					aria-hidden="true"
				/>
				<div
					className="join-background-shape join-background-shape-two"
					aria-hidden="true"
				/>

				<section className="panel server-panel server-empty">
					<p className="join-eyebrow">Salon AH_ME</p>

					<h1>Aucun salon disponible</h1>

					<p>Aucun salon public n'est disponible pour le moment.</p>

					{isGuest ? (
						<button
							className="btn"
							type="button"
							onClick={() => navigate('/play')}>
							Retourner au Lobby
						</button>
					) : (
						<Link className="btn" to="/servers/create">
							Créer un serveur
						</Link>
					)}
				</section>
			</main>
		);
	}

	const isOwner = currentUserId === server.ownerId;
	const isMember = server.members.some(
		(member) => member.id === currentUserId
	);
	const isFull = server.members.length >= server.capacity;

	return (
		<main className="join-page">
			<div
				className="join-background-shape join-background-shape-one"
				aria-hidden="true"
			/>
			<div
				className="join-background-shape join-background-shape-two"
				aria-hidden="true"
			/>

			<section className="panel server-panel">
				<header className="server-header">
					<div>
						<p className="join-eyebrow">Salon AH_ME</p>
						<h1>{server.name}</h1>
					</div>

					<span className="server-visibility">
						{server.visibility === 'private' ? 'Privé' : 'Public'}
					</span>
				</header>

				<div className="server-stats">
					<div>
						<strong>{server.members.length}</strong>
						<span>Membres</span>
					</div>

					<div>
						<strong>{server.onlineCount ?? '—'}</strong>
						<span>Joueurs en ligne</span>
					</div>
					<div>
						<strong>{server.capacity}</strong>
						<span>Capacité membres</span>
					</div>
				</div>

				{kicked && !isMember && (
					<p className="form-error" role="alert">
						Le propriétaire vous a retiré de ce serveur.
					</p>
				)}

				{isOwner && (
					<p className="server-status">
						Vous êtes propriétaire de ce serveur.
					</p>
				)}

				{!isOwner && isMember && (
					<p className="server-status">
						Vous êtes membre de ce serveur.
					</p>
				)}

				{isMember ? (
					<div className="stack">
						<button
							className="btn"
							type="button"
							onClick={() => navigate('/play')}
							disabled={actionLoading}>
							Entrer dans le serveur
						</button>

						{isOwner ? (
							<Link
								className="btn btn-ghost"
								to="/servers/settings">
								Configurer le serveur
							</Link>
						) : (
							<button
								className="btn btn-ghost"
								type="button"
								onClick={handleLeave}
								disabled={actionLoading}>
								Quitter le serveur
							</button>
						)}
					</div>
				) : (
					<div className="stack">
						{server.visibility === 'private' && (
							<div>
								<label
									className="input-label"
									htmlFor="server-invite">
									Code d'invitation
								</label>

								<input
									className="input"
									id="server-invite"
									value={inviteCode}
									onChange={(event) =>
										setInviteCode(event.target.value)
									}
									placeholder="Saisissez le code"
								/>
							</div>
						)}

						{isFull && (
							<p className="form-error">
								Le serveur est complet.
							</p>
						)}

						<button
							className="btn"
							type="button"
							onClick={handleJoin}
							disabled={
								actionLoading ||
								isFull ||
								(server.visibility === 'private' &&
									!inviteCode.trim())
							}>
							{actionLoading ? 'Connexion...' : 'Rejoindre'}
						</button>
					</div>
				)}

				{error && (
					<p className="form-error" role="alert">
						{error}
					</p>
				)}
			</section>
		</main>
	);
}
