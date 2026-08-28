/** @format */

type AvatarPreviewProps = {
	skinTone: string;
	silhouette: Silhouette;
};

export type Silhouette = 'slim' | 'standard' | 'large';

const SILHOUETTE_WIDTHS: Record<Silhouette, number> = {
	slim: 72,
	standard: 92,
	large: 116,
};

export default function AvatarPreview({
	skinTone,
	silhouette,
}: AvatarPreviewProps) {
	const bodyWidth = SILHOUETTE_WIDTHS[silhouette];

	return (
		<div
			className="avatar-preview"
			aria-label={`Aperçu de l'avatar, silhouette ${silhouette}`}>
			<div
				className="avatar-preview-head"
				style={{ backgroundColor: skinTone }}>
				<div className="avatar-preview-eyes">
					<span />
					<span />
				</div>

				<div className="avatar-preview-mouth" />
			</div>

			<div
				className="avatar-preview-body"
				style={{
					width: `${bodyWidth}px`,
					backgroundColor: skinTone,
				}}>
				<div className="avatar-preview-shirt">
					<span>AH</span>
				</div>
			</div>

			<div
				className="avatar-preview-legs"
				style={{ width: `${Math.max(bodyWidth - 20, 52)}px` }}>
				<span />
				<span />
			</div>

			<div
				className="avatar-preview-shadow"
				style={{ width: `${bodyWidth + 20}px` }}
			/>
		</div>
	);
}
