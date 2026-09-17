/** @format */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function CreateServerPage() {
	const navigate = useNavigate();
	const [name, setName] = useState('');
	const [visibility, setVisibility] = useState<'public' | 'private'>(
		'public'
	);
	const [capacity, setCapacity] = useState(20);
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [created, setCreated] = useState(false);
	const [serverExists, setServerExists] = useState(false);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError('');
		setServerExists(false);

		const trimmedName = name.trim();

		if (!trimmedName) {
			setError('Le nom du serveur est requis.');
			return;
		}

		if (trimmedName.length > 128) {
			setError('Le nom du serveur est trop long.');
			return;
		}

		if (capacity < 2 || capacity > 50) {
			setError('La capacité doit être comprise entre 2 et 50.');
			return;
		}

		setLoading(true);

		try {
			const result = await api.createServer({
				name: trimmedName,
				visibility,
				capacity,
			});

			if (visibility === 'private' && result.inviteCode) {
				setInviteCode(result.inviteCode);
				setCreated(true);
			} else {
				navigate('/servers');
			}
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: 'Impossible de créer le serveur.';

			setError(message);

			if (message === 'Un serveur existe déjà.') {
				setServerExists(true);
			}
		} finally {
			setLoading(false);
		}
	}

	async function copyInviteCode() {
		if (!inviteCode) return;

		await navigator.clipboard.writeText(inviteCode);
		setCopied(true);
	}

	if (created) {
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
					<header className="server-page-header">
						<p className="join-eyebrow">Salon AH_ME</p>
						<h1>Serveur créé</h1>
						<p>Votre serveur est prêt à accueillir ses membres.</p>
					</header>

					{inviteCode && (
						<div className="server-invite-code">
							<span>Code d'invitation</span>
							<strong>{inviteCode}</strong>

							<button
								className="btn btn-ghost"
								type="button"
								onClick={copyInviteCode}>
								{copied ? 'Code copié' : 'Copier le code'}
							</button>
						</div>
					)}

					<Link className="btn" to="/servers">
						Voir le serveur
					</Link>
				</section>
			</main>
		);
	}

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
				<header className="server-page-header">
					<p className="join-eyebrow">Salon AH_ME</p>
					<h1>Créer un serveur</h1>
					<p>Configurez votre espace avant d'inviter votre équipe.</p>
				</header>

				<form className="stack" onSubmit={handleSubmit}>
					<div>
						<label className="input-label" htmlFor="server-name">
							Nom
						</label>

						<input
							className="input"
							id="server-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Nom du serveur"
							maxLength={128}
							disabled={loading}
						/>
					</div>

					<div>
						<label
							className="input-label"
							htmlFor="server-visibility">
							Visibilité
						</label>

						<select
							className="select"
							id="server-visibility"
							value={visibility}
							onChange={(event) =>
								setVisibility(
									event.target.value as 'public' | 'private'
								)
							}
							disabled={loading}>
							<option value="public">Public</option>
							<option value="private">Privé</option>
						</select>

						<p className="server-field-help">
							{visibility === 'private'
								? "Un code d'invitation sera nécessaire pour rejoindre le serveur."
								: 'Les utilisateurs pourront rejoindre directement le serveur.'}
						</p>
					</div>

					<div>
						<label
							className="input-label"
							htmlFor="server-capacity">
							Capacité
						</label>

						<input
							className="input"
							id="server-capacity"
							type="number"
							min={2}
							max={50}
							value={capacity}
							onChange={(event) =>
								setCapacity(Number(event.target.value))
							}
							disabled={loading}
						/>

						<p className="server-field-help">
							Entre 2 et 50 membres.
						</p>
					</div>

					{error && (
						<p className="form-error" role="alert">
							{error}
						</p>
					)}

					{serverExists && (
						<Link className="btn btn-ghost" to="/servers">
							Voir le serveur existant
						</Link>
					)}

					<button className="btn" type="submit" disabled={loading}>
						{loading ? 'Création...' : 'Créer le serveur'}
					</button>

					<Link className="btn btn-ghost" to="/servers">
						Retour
					</Link>
				</form>
			</section>
		</main>
	);
}
