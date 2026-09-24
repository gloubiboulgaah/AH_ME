/** @format */

import { useEffect } from 'react';

export interface DeskTarget {
	slotIndex: number;
	username: string | null;
	files: number;
	notes: number;
	isMine: boolean;
}

interface DeskOverlayProps {
	desk: DeskTarget;
	onClose: () => void;
}

// coquille du panneau de bureau
// les sections documents et post-its sont des bouchons, Safiya les remplit
// via son overlay pile de feuilles et sa liste de post-its
export default function DeskOverlay({ desk, onClose }: DeskOverlayProps) {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onClose]);

	const owner = desk.username ?? 'Bureau libre';

	return (
		<div className="desk-overlay-backdrop" onClick={onClose}>
			<section
				className="panel desk-overlay"
				role="dialog"
				aria-modal="true"
				aria-labelledby="desk-overlay-title"
				onClick={(event) => event.stopPropagation()}>
				<header className="panel-header desk-overlay-header">
					<div>
						<p className="desk-overlay-kicker">
							Bureau {desk.slotIndex + 1}
							{desk.isMine ? ' · le tien' : ''}
						</p>

						<h2 className="panel-title" id="desk-overlay-title">
							{owner}
						</h2>
					</div>

					<button
						className="btn btn-icon"
						type="button"
						aria-label="Fermer le bureau"
						onClick={onClose}>
						&times;
					</button>
				</header>

				<div className="desk-overlay-sections">
					<article className="desk-overlay-section">
						<h3>Documents</h3>

						<p className="panel-text">
							{desk.files === 0
								? 'Aucun document déposé.'
								: `${desk.files} document${
										desk.files > 1 ? 's' : ''
									} dans ce bureau.`}
						</p>

						<p className="desk-overlay-placeholder">
							La pile de feuilles arrive ici
						</p>
					</article>

					<article className="desk-overlay-section">
						<h3>Post-its</h3>

						<p className="panel-text">
							{desk.notes === 0
								? 'Aucun post-it.'
								: `${desk.notes} post-it${
										desk.notes > 1 ? 's' : ''
									} sur le plateau.`}
						</p>

						<p className="desk-overlay-placeholder">
							La liste des post-its arrive ici
						</p>
					</article>
				</div>

				<footer className="desk-overlay-footer">
					<span>Échap pour revenir au salon</span>
				</footer>
			</section>
		</div>
	);
}
