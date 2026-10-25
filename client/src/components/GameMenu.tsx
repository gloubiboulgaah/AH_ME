/** @format */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type AppServer } from '@/lib/api';

interface GameMenuProps {
	// null pour un invite, qui n'a ni compte ni salon
	server: AppServer | null;
	userId: number | null;
	mySlotIndex: number | null;
	onClose: () => void;
}

function errorMessage(err: unknown, fallback: string) {
	return err instanceof Error ? err.message : fallback;
}

// menu pause du salon : avatar, reglages, sortie
export default function GameMenu({
	server,
	userId,
	mySlotIndex,
	onClose,
}: GameMenuProps) {
	const navigate = useNavigate();

	const [confirmLeave, setConfirmLeave] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const isGuest = userId === null;
	const isOwner = server !== null && server.ownerId === userId;

	// quitter libere le bureau et supprime son contenu, d'ou la confirmation
	const leaveSalon = async () => {
		if (!server) return;

		setError('');
		setLoading(true);

		try {
			await api.leaveServer(server.id);
			navigate('/servers', { replace: true });
		} catch (err) {
			setError(errorMessage(err, 'Impossible de quitter le salon.'));
			setLoading(false);
		}
	};

	const logout = async () => {
		setLoading(true);
		await api.logout().catch(() => {});
		navigate('/', { replace: true });
	};

	const leaveAsGuest = () => {
		localStorage.removeItem('ahme_guest_username');
		navigate('/', { replace: true });
	};

	return (
		<div
			className="overlay"
			role="dialog"
			aria-modal="true"
			onClick={onClose}>
			<section
				className="panel overlay-panel game-menu"
				onClick={(event) => event.stopPropagation()}>
				<header className="panel-header">
					<p className="join-eyebrow">Salon</p>
					<h2 className="panel-title">
						{server ? server.name : 'Visite libre'}
					</h2>
					<p className="panel-text">
						{isGuest
							? 'En invité, vous visitez le salon sans bureau. Créez un compte pour en obtenir un.'
							: mySlotIndex === null
								? 'Aucun bureau ne vous est attribué (salon complet).'
								: `Votre bureau : n°${mySlotIndex + 1}`}
					</p>
				</header>

				{confirmLeave ? (
					<div className="stack">
						<p className="game-menu-warning">
							Vous ne serez plus membre du salon. Votre bureau
							sera libéré et les documents et post-its qu'il
							contient seront supprimés.
						</p>

						<button
							className="btn btn-danger"
							type="button"
							onClick={leaveSalon}
							disabled={loading}>
							{loading ? 'Départ...' : 'Quitter définitivement'}
						</button>

						<button
							className="btn btn-ghost"
							type="button"
							onClick={() => setConfirmLeave(false)}
							disabled={loading}>
							Annuler
						</button>
					</div>
				) : (
					<div className="stack">
						<button className="btn" type="button" onClick={onClose}>
							Reprendre
						</button>

						<button
							className="btn btn-ghost"
							type="button"
							onClick={() => navigate('/customize')}>
							Personnaliser mon avatar
						</button>

						{isOwner && (
							<button
								className="btn btn-ghost"
								type="button"
								onClick={() => navigate('/servers/settings')}>
								Configurer le salon
							</button>
						)}

						{!isGuest && (
							<button
								className="btn btn-ghost"
								type="button"
								onClick={() => navigate('/servers')}>
								Revenir à l'accueil (garder mon bureau)
							</button>
						)}

						{!isGuest && !isOwner && server && (
							<button
								className="btn btn-danger"
								type="button"
								onClick={() => setConfirmLeave(true)}>
								Quitter le salon
							</button>
						)}

						{isGuest ? (
							<button
								className="btn btn-ghost"
								type="button"
								onClick={leaveAsGuest}>
								Quitter
							</button>
						) : (
							<button
								className="btn btn-ghost"
								type="button"
								onClick={logout}
								disabled={loading}>
								Déconnexion
							</button>
						)}
					</div>
				)}

				{error && (
					<p className="form-error" role="alert">
						{error}
					</p>
				)}

				<p className="game-menu-hint text-muted">
					Échap pour ouvrir ou fermer ce menu
				</p>
			</section>
		</div>
	);
}
