/** @format */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type AppServer } from '../lib/api';

export default function ServersPage() {
	const navigate = useNavigate();

	const [server, setServer] = useState<AppServer | null>(null);
	const [currentUserId, setCurrentUserId] = useState<number | null>(null);
	const [inviteCode, setInviteCode] = useState('');
	const [newInviteCode, setNewInviteCode] = useState('');
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		Promise.all([api.currentServer(), api.me()])
			.then(([serverResult, userResult]) => {
				setServer(serverResult.server);
				setCurrentUserId(userResult.user?.id ?? null);
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

	async function handleJoin() {
		if (!server) return;

		setError('');
		setActionLoading(true);

		try {
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
			navigate('/play');
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

	async function handleDelete() {
		if (!server) return;

		const confirmed = window.confirm(
			`Supprimer définitivement le serveur « ${server.name} » ?`
		);

		if (!confirmed) return;

		setError('');
		setActionLoading(true);

		try {
			await api.deleteServer(server.id);
			setServer(null);
			setNewInviteCode('');
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Impossible de supprimer le serveur.'
			);
		} finally {
			setActionLoading(false);
		}
	}

	async function handleRegenerateInvite() {
		if (!server) return;

		setError('');
		setActionLoading(true);

		try {
			const result = await api.regenerateInviteCode(server.id);
			setNewInviteCode(result.inviteCode);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Impossible de régénérer le code d'invitation."
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

					<h1>Aucun serveur</h1>

					<p>
						Aucun serveur n'a encore été créé. Créez le premier
						espace de votre équipe.
					</p>

					<Link className="btn" to="/servers/create">
						Créer un serveur
					</Link>
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
						<strong>{server.capacity}</strong>
						<span>Capacité</span>
					</div>
				</div>

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
							<>
								{server.visibility === 'private' && (
									<button
										className="btn btn-ghost"
										type="button"
										onClick={handleRegenerateInvite}
										disabled={actionLoading}>
										Régénérer le code d'invitation
									</button>
								)}

								{newInviteCode && (
									<div className="server-invite-code">
										<span>Nouveau code d'invitation</span>
										<strong>{newInviteCode}</strong>
									</div>
								)}

								<button
									className="btn btn-danger"
									type="button"
									onClick={handleDelete}
									disabled={actionLoading}>
									Supprimer le serveur
								</button>
							</>
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
