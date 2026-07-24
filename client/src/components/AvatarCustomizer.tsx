/** @format */

'use client';

import { useState } from 'react';
import AvatarPreview, {
	type Silhouette,
} from '@/components/AvatarPreview';

const SKIN_TONES = [
	{
		id: 'light',
		label: 'Clair',
		color: '#f4c7a1',
	},
	{
		id: 'medium-light',
		label: 'Clair moyen',
		color: '#d99b6c',
	},
	{
		id: 'medium',
		label: 'Moyen',
		color: '#b97248',
	},
	{
		id: 'medium-dark',
		label: 'Foncé moyen',
		color: '#855033',
	},
	{
		id: 'dark',
		label: 'Foncé',
		color: '#553321',
	},
] as const;

type SkinTone = (typeof SKIN_TONES)[number]['color'];

export type AvatarCustomization = {
	skinTone: SkinTone;
	silhouette: Silhouette;
};

type AvatarCustomizerProps = {
	onConfirm: (customization: AvatarCustomization) => void;
};

const SILHOUETTES: Array<{
	id: Silhouette;
	label: string;
	description: string;
}> = [
	{
		id: 'slim',
		label: 'Fine',
		description: 'Silhouette étroite',
	},
	{
		id: 'standard',
		label: 'Standard',
		description: 'Silhouette équilibrée',
	},
	{
		id: 'large',
		label: 'Large',
		description: 'Silhouette plus large',
	},
];

export default function AvatarCustomizer({
	onConfirm,
}: AvatarCustomizerProps) {
	const [skinTone, setSkinTone] = useState<SkinTone>(
		SKIN_TONES[1].color,
	);

	const [silhouette, setSilhouette] =
		useState<Silhouette>('standard');

	const selectedTone = SKIN_TONES.find(
		(tone) => tone.color === skinTone,
	);

	const confirmCustomization = () => {
		onConfirm({
			skinTone,
			silhouette,
		});
	};

	return (
		<main className="avatar-customization-page">
			<div className="avatar-customization-background avatar-customization-background-one" />
			<div className="avatar-customization-background avatar-customization-background-two" />

			<section className="avatar-customization-card">
				<header className="avatar-customization-header">
					<p className="join-eyebrow">
						Personnalisation
					</p>

					<h1>Crée ton avatar</h1>

					<p>
						Choisis une couleur de peau et une
						silhouette avant de rejoindre le monde.
					</p>
				</header>

				<div className="avatar-customization-content">
					<section
						className="avatar-customization-controls"
						aria-label="Options de personnalisation"
					>
						<fieldset className="avatar-option-group">
							<legend>Teinte de peau</legend>

							<p className="avatar-option-description">
								Couleur sélectionnée :{' '}
								<strong>
									{selectedTone?.label}
								</strong>
							</p>

							<div className="skin-tone-options">
								{SKIN_TONES.map((tone) => {
									const isSelected =
										tone.color === skinTone;

									return (
										<button
											key={tone.id}
											type="button"
											className={`skin-tone-button${
												isSelected
													? ' is-selected'
													: ''
											}`}
											style={{
												backgroundColor:
													tone.color,
											}}
											aria-label={tone.label}
											aria-pressed={
												isSelected
											}
											title={tone.label}
											onClick={() =>
												setSkinTone(
													tone.color,
												)
											}
										>
											<span className="sr-only">
												{tone.label}
											</span>
										</button>
									);
								})}
							</div>
						</fieldset>

						<fieldset className="avatar-option-group">
							<legend>Silhouette</legend>

							<div className="silhouette-options">
								{SILHOUETTES.map((option) => {
									const isSelected =
										option.id === silhouette;

									return (
										<button
											key={option.id}
											type="button"
											className={`silhouette-button${
												isSelected
													? ' is-selected'
													: ''
											}`}
											aria-pressed={
												isSelected
											}
											onClick={() =>
												setSilhouette(
													option.id,
												)
											}
										>
											<span className="silhouette-button-icon">
												<span
													className={`silhouette-icon silhouette-icon-${option.id}`}
												/>
											</span>

											<span className="silhouette-button-text">
												<strong>
													{option.label}
												</strong>

												<small>
													{
														option.description
													}
												</small>
											</span>
										</button>
									);
								})}
							</div>
						</fieldset>
					</section>

					<section
						className="avatar-preview-panel"
						aria-label="Aperçu de l'avatar"
					>
						<h2>Aperçu</h2>

						<AvatarPreview
							skinTone={skinTone}
							silhouette={silhouette}
						/>

						<p>
							Les modifications apparaissent
							instantanément.
						</p>
					</section>
				</div>

				<button
					className="btn avatar-confirm-button"
					type="button"
					onClick={confirmCustomization}
				>
					Continuer
				</button>
			</section>
		</main>
	);
}