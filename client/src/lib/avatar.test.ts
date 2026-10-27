
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	isAvatarAppearance,
	loadAvatar,
	saveAvatar,
} from './avatar';

describe('Personnalisation de l’avatar', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('accepte un avatar valide', () => {
		expect(
			isAvatarAppearance({
				skin: '#AABBCC',
				build: 'standard',
			})
		).toBe(true);
	});

	it.each(['slim', 'standard', 'large'])(
		'accepte la morphologie %s',
		(build) => {
			expect(
				isAvatarAppearance({
					skin: '#abcdef',
					build,
				})
			).toBe(true);
		}
	);

	it('refuse une couleur invalide', () => {
		expect(
			isAvatarAppearance({
				skin: 'red',
				build: 'standard',
			})
		).toBe(false);
	});

	it('refuse une morphologie inconnue', () => {
		expect(
			isAvatarAppearance({
				skin: '#abcdef',
				build: 'giant',
			})
		).toBe(false);
	});

	it('refuse les données absentes ou incorrectes', () => {
		expect(isAvatarAppearance(null)).toBe(false);
		expect(isAvatarAppearance(undefined)).toBe(false);
		expect(isAvatarAppearance('avatar')).toBe(false);
		expect(isAvatarAppearance({})).toBe(false);
	});

	it('enregistre puis recharge un avatar', () => {
		const storage = new Map<string, string>();

		vi.stubGlobal('localStorage', {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
		});

		const avatar = {
			skin: '#123456',
			build: 'slim' as const,
		};

		saveAvatar(avatar);

		expect(loadAvatar()).toEqual(avatar);
		expect(storage.has('ahme_avatar')).toBe(true);
	});

	it('retourne null si les données enregistrées sont invalides', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => '{invalid json',
		});

		expect(loadAvatar()).toBeNull();
	});

	it('retourne null si le stockage est inaccessible', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('Storage blocked');
			},
		});

		expect(loadAvatar()).toBeNull();
	});

	it('ne plante pas si l’enregistrement est bloqué', () => {
		vi.stubGlobal('localStorage', {
			setItem: () => {
				throw new Error('Storage blocked');
			},
		});

		expect(() =>
			saveAvatar({
				skin: '#abcdef',
				build: 'large',
			})
		).not.toThrow();
	});
});
