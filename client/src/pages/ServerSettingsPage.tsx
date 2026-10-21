/** @format */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type AppServer } from '../lib/api';

function errorMessage(err: unknown, fallback: string) {
	return err instanceof Error ? err.message : fallback;
}

function formatJoinedAt(value: string) {
	return new Date(value).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
}

function Background() {
	return (
		<>
			<div
				className="join-background-shape join-background-shape-one"
				aria-hidden="true"
			/>
			<div
				className="join-background-shape join-background-shape-two"
				aria-hidden="true"
			/>
		</>
	);
}

// reserve au proprietaire du salon : reglages, code, membres, suppression
export default function ServerSettingsPage() {
	const navigate = useNavigate();

	const [server, setServer] = useState<AppServer | null>(null);
	const [currentUserId, setCurrentUserId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState('');

	const [name, setName] = useState('');
	const [visibility, setVisibility] = useState<'public' | 'private'>(
		'public'
	);
	const [capacity, setCapacity] = useState(20);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [settingsError, setSettingsError] = useState('');

	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [inviteLoading, setInviteLoading] = useState(false);
	const [inviteError, setInviteError] = useState('');

	// membre en attente de confirmation d'exclusion
	const [pendingKick, setPendingKick] = useState<number | null>(null);
	const [kickLoading, setKickLoading] = useState(false);
	const [membersError, setMembersError] = useState('');

	const [deleteConfirm, setDeleteConfirm] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState('');

	useEffect(() => {
		Promise.all([api.currentServer(), api.me()])
			.then(([serverResult, userResult]) => {
				const current = serverResult.server;

				setServer(current);
				setCurrentUserId(userResult.user?.id ?? null);

				if (current) {
					setName(current.name);
					setVisibility(current.visibility);
					setCapacity(current.capacity);
				}
			})
			.catch((err) =>
				setLoadError(
					errorMessage(err, 'Impossible de charger le serveur.')
				)
			)
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return (
			<main className="join-page">
				<section className="panel server-panel">
					<p className="server-loading">Chargement...</p>
				</section>
			</main>
		);
	}

	// pas de serveur, pas connecte ou pas proprietaire : meme ecran de refus
	if (!server || currentUserId !== server.ownerId) {
		return (
			<main className="join-page">
				<Background />

				<section className="panel server-panel server-empty">
					<p className="join-eyebrow">Salon AH_ME</p>

					<h1>Accès refusé</h1>

					<p>
						{loadError ||
							(server
								? 'Seul le propriétaire du serveur peut le configurer.'
								: "Aucun serveur n'existe pour le moment.")}
					</p>

					<Link className="btn" to="/servers">
						Retour au serveur
					</Link>
				</section>
			</main>
		);
	}

	const currentServer = server;
	const minCapacity = Math.max(2, currentServer.members.length);
	const nameChanged = name.trim() !== currentServer.name;
	const dirty =
		nameChanged ||
		visibility !== currentServer.visibility ||
		capacity !== currentServer.capacity;

	async function handleSave(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSettingsError('');
		setSaved(false);

		const trimmedName = name.trim();

		if (!trimmedName) {
			setSettingsError('Le nom du serveur est requis.');
			return;
		}

		if (capacity < minCapacity || capacity > 50) {
			setSettingsError(
				`La capacité doit être comprise entre ${minCapacity} et 50.`
			);
			return;
		}

		setSaving(true);

		try {
			const result = await api.updateServer(currentServer.id, {
				name: trimmedName,
				visibility,
				capacity,
			});

			setServer({ ...currentServer, ...result.server });
			setName(result.server.name);
			setSaved(true);

			// un passage en prive genere le premier code
			if (result.inviteCode) setInviteCode(result.inviteCode);
			if (result.server.visibility === 'public') setInviteCode(null);
		} catch (err) {
			setSettingsError(
				errorMessage(err, 'Impossible d’enregistrer les réglages.')
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleRegenerate() {
		setInviteError('');
		setInviteLoading(true);

		try {
			const result = await api.regenerateInviteCode(currentServer.id);
			setInviteCode(result.inviteCode);
		} catch (err) {
			setInviteError(
				errorMessage(
					err,
					"Impossible de régénérer le code d'invitation."
				)
			);
		} finally {
			setInviteLoading(false);
		}
	}

	async function handleKick(userId: number) {
		setMembersError('');
		setKickLoading(true);

		try {
			await api.removeMember(currentServer.id, userId);

			setServer({
				...currentServer,
				members: currentServer.members.filter(
					(member) => member.id !== userId
				),
			});
			setPendingKick(null);
		} catch (err) {
			setMembersError(
				errorMessage(err, 'Impossible d’exclure ce membre.')
			);
		} finally {
			setKickLoading(false);
		}
	}

	async function handleDelete() {
		setDeleteError('');
		setDeleting(true);

		try {
			await api.deleteServer(currentServer.id);
			navigate('/servers', { replace: true });
		} catch (err) {
			setDeleteError(
				errorMessage(err, 'Impossible de supprimer le serveur.')
			);
			setDeleting(false);
		}
	}

	return (
		<main className="join-page server-settings-page">
			<Background />

			<section className="panel server-panel server-settings">
				<header className="server-page-header">
					<p className="join-eyebrow">Salon AH_ME</p>
					<h1>Configurer le serveur</h1>
					<p>Ces réglages ne sont visibles que par vous.</p>
				</header>

				<section
					className="server-section"
					aria-labelledby="settings-title">
					<h2 id="settings-title">Réglages</h2>

					<form className="stack" onSubmit={handleSave}>
						<div>
							<label
								className="input-label"
								htmlFor="settings-name">
								Nom
							</label>

							<input
								className="input"
								id="settings-name"
								value={name}
								onChange={(event) => {
									setName(event.target.value);
									setSaved(false);
								}}
								maxLength={128}
								disabled={saving}
							/>
						</div>

						<div>
							<label
								className="input-label"
								htmlFor="settings-visibility">
								Visibilité
							</label>

							<select
								className="select"
								id="settings-visibility"
								value={visibility}
								onChange={(event) => {
									setVisibility(
										event.target.value as
											'public' | 'private'
									);
									setSaved(false);
								}}
								disabled={saving}>
								<option value="public">Public</option>
								<option value="private">Privé</option>
							</select>

							<p className="server-field-help">
								{visibility === currentServer.visibility
									? visibility === 'private'
										? "Un code d'invitation est nécessaire pour rejoindre."
										: 'Tout le monde peut rejoindre directement.'
									: visibility === 'private'
										? "Un code d'invitation sera généré à l'enregistrement. Les membres actuels restent."
										: "Le code d'invitation sera supprimé, tout le monde pourra rejoindre."}
							</p>
						</div>

						<div>
							<label
								className="input-label"
								htmlFor="settings-capacity">
								Capacité
							</label>

							<input
								className="input"
								id="settings-capacity"
								type="number"
								min={minCapacity}
								max={50}
								value={capacity}
								onChange={(event) => {
									setCapacity(Number(event.target.value));
									setSaved(false);
								}}
								disabled={saving}
							/>

							<p className="server-field-help">
								Entre {minCapacity} et 50 : impossible de
								descendre sous le nombre de membres actuels.
							</p>
						</div>

						{settingsError && (
							<p className="form-error" role="alert">
								{settingsError}
							</p>
						)}

						{saved && (
							<p className="server-success" role="status">
								Réglages enregistrés.
							</p>
						)}

						<button
							className="btn"
							type="submit"
							disabled={saving || !dirty}>
							{saving ? 'Enregistrement...' : 'Enregistrer'}
						</button>
					</form>
				</section>

				{currentServer.visibility === 'private' && (
					<section
						className="server-section"
						aria-labelledby="invite-title">
						<h2 id="invite-title">Code d'invitation</h2>

						<p className="server-field-help">
							Le code n'est affiché qu'une fois. En générer un
							nouveau invalide l'ancien.
						</p>

						{inviteCode && (
							<div className="server-invite-code">
								<span>Nouveau code d'invitation</span>
								<strong>{inviteCode}</strong>
							</div>
						)}

						{inviteError && (
							<p className="form-error" role="alert">
								{inviteError}
							</p>
						)}

						<button
							className="btn btn-ghost"
							type="button"
							onClick={handleRegenerate}
							disabled={inviteLoading}>
							{inviteLoading
								? 'Génération...'
								: 'Régénérer le code'}
						</button>
					</section>
				)}

				<section
					className="server-section"
					aria-labelledby="members-title">
					<h2 id="members-title">
						Membres ({currentServer.members.length}/
						{currentServer.capacity})
					</h2>

					<ul className="server-members">
						{currentServer.members.map((member) => (
							<li key={member.id} className="server-member">
								<div className="server-member-info">
									<strong>{member.username}</strong>
									<span>
										{member.role === 'owner'
											? 'Propriétaire'
											: 'Membre'}{' '}
										· depuis le{' '}
										{formatJoinedAt(member.joinedAt)}
									</span>
								</div>

								{member.role !== 'owner' &&
									(pendingKick === member.id ? (
										<div className="server-member-actions">
											<button
												className="btn btn-danger btn-small"
												type="button"
												onClick={() =>
													handleKick(member.id)
												}
												disabled={kickLoading}>
												Confirmer
											</button>
											<button
												className="btn btn-ghost btn-small"
												type="button"
												onClick={() =>
													setPendingKick(null)
												}
												disabled={kickLoading}>
												Annuler
											</button>
										</div>
									) : (
										<button
											className="btn btn-ghost btn-small"
											type="button"
											onClick={() =>
												setPendingKick(member.id)
											}
											disabled={kickLoading}>
											Exclure
										</button>
									))}
							</li>
						))}
					</ul>

					{membersError && (
						<p className="form-error" role="alert">
							{membersError}
						</p>
					)}
				</section>

				<section
					className="server-section server-danger"
					aria-labelledby="danger-title">
					<h2 id="danger-title">Supprimer le serveur</h2>

					<p className="server-field-help">
						Tous les bureaux, documents et post-its seront effacés.
						Pour confirmer, tapez le nom du serveur :{' '}
						<strong>{currentServer.name}</strong>
					</p>

					<input
						className="input"
						aria-label="Nom du serveur pour confirmer la suppression"
						value={deleteConfirm}
						onChange={(event) =>
							setDeleteConfirm(event.target.value)
						}
						disabled={deleting}
					/>

					{deleteError && (
						<p className="form-error" role="alert">
							{deleteError}
						</p>
					)}

					<button
						className="btn btn-danger"
						type="button"
						onClick={handleDelete}
						disabled={
							deleting ||
							deleteConfirm.trim() !== currentServer.name
						}>
						{deleting
							? 'Suppression...'
							: 'Supprimer définitivement'}
					</button>
				</section>

				<Link className="btn btn-ghost" to="/servers">
					Retour
				</Link>
			</section>
		</main>
	);
}
