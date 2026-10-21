/** @format */

import { useNavigate } from 'react-router-dom';
import AvatarCustomizer, {
	type AvatarCustomization,
} from '@/components/AvatarCustomizer';
import { loadAvatar, saveAvatar } from '@/lib/avatar';

export default function CustomizePage() {
	const navigate = useNavigate();
	const saved = loadAvatar();

	const handleConfirm = (customization: AvatarCustomization) => {
		// lu par le jeu au moment de se connecter, cf NetworkClient
		saveAvatar({
			skin: customization.skinTone,
			build: customization.silhouette,
		});

		navigate('/play');
	};

	return (
		<AvatarCustomizer
			initialSkinTone={saved?.skin}
			initialSilhouette={saved?.build}
			onConfirm={handleConfirm}
		/>
	);
}
