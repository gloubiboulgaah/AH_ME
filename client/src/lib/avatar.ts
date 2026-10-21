/** @format */

import type { AvatarBuild } from '@/game/voxel/models/avatar';

// apparence choisie dans l'ecran de personnalisation
// gardee dans le navigateur pour que les invites l'aient aussi, le serveur
// la recoit au handshake et la sauvegarde pour les comptes
export interface AvatarAppearance {
	skin: string;
	build: AvatarBuild;
}

const STORAGE_KEY = 'ahme_avatar';

const BUILDS: AvatarBuild[] = ['slim', 'standard', 'large'];

export function isAvatarAppearance(value: unknown): value is AvatarAppearance {
	if (!value || typeof value !== 'object') return false;

	const { skin, build } = value as Record<string, unknown>;

	return (
		typeof skin === 'string' &&
		/^#[0-9a-fA-F]{6}$/.test(skin) &&
		BUILDS.includes(build as AvatarBuild)
	);
}

export function loadAvatar(): AvatarAppearance | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		return isAvatarAppearance(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function saveAvatar(appearance: AvatarAppearance) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
	} catch {
		// stockage bloque : l'avatar par defaut sera utilise
	}
}
