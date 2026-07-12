/** @format */

'use client';

import dynamic from 'next/dynamic';

// three.js cote client uniquement
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
	ssr: false,
	loading: () => <div className="loading-screen">Chargement du monde...</div>,
});

export default function PlayPage() {
	return <GameCanvas />;
}
