/** @format */

'use client';

import { useRouter } from 'next/navigation';
import AvatarCustomizer, {
	type AvatarCustomization,
} from '@/components/AvatarCustomizer';

export default function CustomizePage() {
	const router = useRouter();

	const handleConfirm = (
		customization: AvatarCustomization,
	) => {
		/*
		 * État reçu depuis AvatarCustomizer.
		 * Plus tard, cet endroit pourra appeler l'API :
		 *
		 * await api.updateAvatar(customization);
		 */

		console.log(
			'Personnalisation d’avatar mock :',
			customization,
		);

		router.push('/play');
	};

	return (
		<AvatarCustomizer onConfirm={handleConfirm} />
	);
}