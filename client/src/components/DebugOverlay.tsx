/** @format */

'use client';

import {
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';

export type DebugInfoValue =
	| string
	| number
	| boolean
	| null
	| undefined;

export type DebugInfos = Record<string, DebugInfoValue>;

type DebugOverlayProps = {
	enabled?: boolean;
	defaultOpen?: boolean;
	infos?: DebugInfos;
	wireframe?: boolean;
	onWireframeChange?: (enabled: boolean) => void;
};

const FPS_UPDATE_INTERVAL = 500;

function formatDebugValue(value: DebugInfoValue): ReactNode {
	if (value === null || value === undefined) {
		return '—';
	}

	if (typeof value === 'boolean') {
		return value ? 'Oui' : 'Non';
	}

	return String(value);
}

export default function DebugOverlay({
	enabled = true,
	defaultOpen = false,
	infos = {},
	wireframe = false,
	onWireframeChange,
}: DebugOverlayProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const [fps, setFps] = useState(0);

	const animationFrameRef = useRef<number | null>(null);
	const frameCountRef = useRef(0);
	const previousUpdateRef = useRef(0);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const updateFps = (timestamp: number) => {
			if (previousUpdateRef.current === 0) {
				previousUpdateRef.current = timestamp;
			}

			frameCountRef.current += 1;

			const elapsed =
				timestamp - previousUpdateRef.current;

			if (elapsed >= FPS_UPDATE_INTERVAL) {
				const currentFps = Math.round(
					(frameCountRef.current * 1000) / elapsed,
				);

				setFps(currentFps);

				frameCountRef.current = 0;
				previousUpdateRef.current = timestamp;
			}

			animationFrameRef.current =
				requestAnimationFrame(updateFps);
		};

		animationFrameRef.current =
			requestAnimationFrame(updateFps);

		return () => {
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(
					animationFrameRef.current,
				);
			}

			frameCountRef.current = 0;
			previousUpdateRef.current = 0;
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'F3') {
				event.preventDefault();
				setIsOpen((currentValue) => !currentValue);
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener(
				'keydown',
				handleKeyDown,
			);
		};
	}, [enabled]);

	if (!enabled) {
		return null;
	}

	const infoEntries = Object.entries(infos);

    // console.log('DebugOverlay affiché', {
    //     enabled,
    //     nodeEnv: process.env.NODE_ENV,
    // });

	return (
		<aside
			className="debug-overlay"
			aria-label="Informations de débogage"
		>
			<button
				className="debug-overlay-toggle"
				type="button"
				onClick={() =>
					setIsOpen((currentValue) => !currentValue)
				}
				aria-expanded={isOpen}
				aria-controls="debug-overlay-panel"
				title="Afficher ou masquer le panneau de debug (F3)"
			>
				<span
					className="debug-overlay-fps"
					data-level={
						fps >= 50
							? 'good'
							: fps >= 30
								? 'medium'
								: 'low'
					}
				>
					{fps} FPS
				</span>

				<span aria-hidden="true">
					{isOpen ? '−' : '+'}
				</span>
			</button>

			{isOpen && (
				<div
					className="debug-overlay-panel"
					id="debug-overlay-panel"
				>
					<header className="debug-overlay-header">
						<strong>Debug</strong>
						<span>F3 pour masquer</span>
					</header>

					<dl className="debug-overlay-infos">
						<div>
							<dt>FPS</dt>
							<dd>{fps}</dd>
						</div>

						{infoEntries.map(([label, value]) => (
							<div key={label}>
								<dt>{label}</dt>
								<dd>{formatDebugValue(value)}</dd>
							</div>
						))}
					</dl>

					{onWireframeChange && (
						<label className="debug-overlay-control">
							<span>Wireframe</span>

							<input
								type="checkbox"
								checked={wireframe}
								onChange={(event) =>
									onWireframeChange(
										event.target.checked,
									)
								}
							/>
						</label>
					)}
				</div>
			)}
		</aside>
	);
}