/** @format */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GameEngine } from '@/game/engine';
import { NetworkClient } from '@/game/network';
import { InteractionManager } from '@/game/interactions';
import type { ChatMessage } from '@/game/types';
import { SOCKET_URL } from '@/lib/config';
import ChatBox from './ChatBox';
import { api } from '@/lib/api';

const MAX_MESSAGES = 50;

export default function GameCanvas() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const containerRef = useRef<HTMLDivElement>(null);
	const joyContainerRef = useRef<HTMLDivElement>(null);
	const joyBaseRef = useRef<HTMLDivElement>(null);
	const joyStickRef = useRef<HTMLDivElement>(null);
	const networkRef = useRef<NetworkClient | null>(null);

	const [connected, setConnected] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [username, setUsername] = useState('');

	useEffect(() => {
		let engine: GameEngine | null = null;
		let network: NetworkClient | null = null;
		let interactions: InteractionManager | null = null;
		let cancelled = false;

		const startGame = async () => {
			if (!containerRef.current) return;

			let authenticatedUsername: string | null = null;

			try {
				const data = await api.me();
				authenticatedUsername =
					data.user?.username ?? null;
			} catch {
				authenticatedUsername = null;
			}

			const storedGuestUsername =
				localStorage
					.getItem('ahme_guest_username')
					?.trim() || null;

			const effectiveUsername =
				authenticatedUsername || storedGuestUsername;

			// Impossible de jouer sans compte ni pseudo invité.
			if (!effectiveUsername || cancelled) {
				window.location.href = '/';
				return;
			}

			engine = new GameEngine(containerRef.current, {
				joyBase: joyBaseRef.current,
				joyStick: joyStickRef.current,
			});

			network = new NetworkClient(engine, {
				url: SOCKET_URL,

				// Aucun pseudo libre n'est envoyé pour un compte connecté.
				// Le serveur retrouvera le compte grâce au cookie.
				guestUsername: authenticatedUsername
					? undefined
					: storedGuestUsername || undefined,

				onStatus: setConnected,

				onChat: (message) => {
					setMessages((previousMessages) => [
						...previousMessages.slice(
							-MAX_MESSAGES + 1
						),
						message,
					]);
				},
			});

			networkRef.current = network;
			engine.network = network;

			interactions = new InteractionManager(engine);
			engine.interactions = interactions;

			const joyContainer = joyContainerRef.current;

			if (
				('ontouchstart' in window ||
					navigator.maxTouchPoints > 0) &&
				joyContainer
			) {
				joyContainer.classList.add(
					'touch-enabled'
				);
			}
		};

		void startGame();

		return () => {
			cancelled = true;

			interactions?.destroy();
			network?.destroy();
			engine?.destroy();

			networkRef.current = null;
		};
	}, []);

	const sendChat = (msg: string) => {
		networkRef.current?.sendChatMessage(msg);
	};

	return (
		<>
			<div id="container" ref={containerRef} />

			<div className="hint">
				{username && (
					<>
						Pseudo : <strong>{username}</strong>
						<br />
					</>
				)}

				Flèches / WASD pour se déplacer
				<br />
				E pour interagir, joystick sur mobile
			</div>

			<div
				id="connection-status"
				className={connected ? 'is-on' : 'is-off'}
			>
				{connected ? 'Connecté' : 'Déconnecté'}
			</div>

			<ChatBox messages={messages} onSend={sendChat} />

			<div id="joystick-container" ref={joyContainerRef}>
				<div id="joystick-base" ref={joyBaseRef}>
					<div
						id="joystick-stick"
						ref={joyStickRef}
					/>
				</div>
			</div>
		</>
	);
}