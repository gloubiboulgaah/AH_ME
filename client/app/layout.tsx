/** @format */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
	title: 'AH_ME',
	description: 'Espace communautaire 3D multijoueur',
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="fr">
			<body>{children}</body>
		</html>
	);
}
