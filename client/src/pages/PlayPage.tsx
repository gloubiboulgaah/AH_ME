/** @format */

import { lazy, Suspense } from 'react';

// three.js charge a la demande, garde le bundle des autres pages leger
const GameCanvas = lazy(() => import('@/components/GameCanvas'));

export default function PlayPage() {
	return (
		<Suspense
			fallback={
				<div className="loading-screen">Chargement du monde...</div>
			}>
			<GameCanvas />
		</Suspense>
	);
}
