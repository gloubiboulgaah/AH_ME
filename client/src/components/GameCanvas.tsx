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
		if (!containerRef.current) return;

		const usernameFromUrl = searchParams.get('username');
		const usernameFromStorage = localStorage.getItem(
			'ahme_guest_username',
		);

		const guestUsername =
			usernameFromUrl?.trim() || usernameFromStorage?.trim();

		/*
		 * Si aucun pseudo n'existe, l'utilisateur doit revenir
		 * sur l'écran d'accueil pour en choisir un.
		 */
		if (!guestUsername) {
			router.replace('/');
			return;
		}

		localStorage.setItem('ahme_guest_username', guestUsername);
		setUsername(guestUsername);

		console.log('Pseudo utilisé dans le jeu :', guestUsername);

		const engine = new GameEngine(containerRef.current, {
			joyBase: joyBaseRef.current,
			joyStick: joyStickRef.current,
		});

		const network = new NetworkClient(engine, {
			url: SOCKET_URL,
			onStatus: setConnected,
			onChat: (msg) =>
				setMessages((prev) => [
					...prev.slice(-MAX_MESSAGES + 1),
					msg,
				]),
		});

		networkRef.current = network;
		engine.network = network;

		const interactions = new InteractionManager(engine);
		engine.interactions = interactions;

		const joyContainer = joyContainerRef.current;

		if (
			('ontouchstart' in window ||
				navigator.maxTouchPoints > 0) &&
			joyContainer
		) {
			joyContainer.classList.add('touch-enabled');
		}

		return () => {
			interactions.destroy();
			network.destroy();
			engine.destroy();
		};
	}, [router, searchParams]);

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