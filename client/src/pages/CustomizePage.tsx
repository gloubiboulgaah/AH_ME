/** @format */

import { useNavigate } from 'react-router-dom';
import AvatarCustomizer, {
	type AvatarCustomization,
} from '@/components/AvatarCustomizer';

export default function CustomizePage() {
	const navigate = useNavigate();

	const handleConfirm = (customization: AvatarCustomization) => {
		/*
		 * État reçu depuis AvatarCustomizer.
		 * Plus tard, cet endroit pourra appeler l'API :
		 *
		 * await api.updateAvatar(customization);
		 */

		console.log('Personnalisation d’avatar mock :', customization);

		navigate('/play');
	};

	return <AvatarCustomizer onConfirm={handleConfirm} />;
}
