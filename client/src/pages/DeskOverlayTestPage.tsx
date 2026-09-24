/** @format */

import { useState } from 'react';
import DeskOverlay from '../components/desk/DeskOverlay';

export default function DeskOverlayTestPage() {
	const [open, setOpen] = useState(false);

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
				<p className="join-eyebrow">Page de test</p>

				<h1>Overlay du bureau</h1>

				<p>
					Cette page permet de tester le panneau du bureau
					indépendamment de l'environnement 3D.
				</p>

				<button
					className="btn"
					type="button"
					onClick={() => setOpen(true)}>
					Ouvrir le bureau
				</button>
			</section>

			{open && <DeskOverlay deskId={1} onClose={() => setOpen(false)} />}
		</main>
	);
}
