/** @format */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameEngine } from '@/game/engine';
import { NetworkClient } from '@/game/network';
import { InteractionManager } from '@/game/interactions';
import type { ChatMessage } from '@/game/types';
import { SOCKET_URL } from '@/lib/config';
import { api } from '@/lib/api';
import { MOCK_CHAT_MESSAGES } from '@/mocks/chatMessages';
import DebugOverlay from '@/components/DebugOverlay';
import ChatBox from './ChatBox';
import ChatBubble, { type ChatBubbleData } from './ChatBubble';

const MAX_MESSAGES = 50;
const MAX_BUBBLES = 10;

export default function GameCanvas() {
	const navigate = useNavigate();

	// l'effet de demarrage ne doit tourner qu'une fois,
	// on passe par une ref pour ne pas le lier a navigate
	const navigateRef = useRef(navigate);

	useEffect(() => {
		navigateRef.current = navigate;
	}, [navigate]);

	const containerRef = useRef<HTMLDivElement>(null);
	const joyContainerRef = useRef<HTMLDivElement>(null);
	const joyBaseRef = useRef<HTMLDivElement>(null);
	const joyStickRef = useRef<HTMLDivElement>(null);
	const networkRef = useRef<NetworkClient | null>(null);
	const bubbleCounterRef = useRef(0);

	const [connected, setConnected] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);
	const [bubbles, setBubbles] = useState<ChatBubbleData[]>([]);
	const [username, setUsername] = useState('');
	const [wireframe, setWireframe] = useState(false);

	const removeBubble = useCallback((bubbleId: string) => {
		setBubbles((currentBubbles) =>
			currentBubbles.filter((bubble) => bubble.id !== bubbleId)
		);
	}, []);

	const getMockScreenPosition = (
		playerId: string
	): { x: number; y: number } => {
		let hash = 0;

		for (let index = 0; index < playerId.length; index += 1) {
			hash = (hash * 31 + playerId.charCodeAt(index)) >>> 0;
		}

		const availableWidth = Math.max(window.innerWidth - 400, 200);

		const availableHeight = Math.max(window.innerHeight - 350, 180);

		return {
			x: 200 + (hash % availableWidth),
			y: 170 + (Math.floor(hash / 100) % availableHeight),
		};
	};

	const addChatBubble = (message: ChatMessage) => {
		const position = getMockScreenPosition(message.playerId);

		bubbleCounterRef.current += 1;

		const bubble: ChatBubbleData = {
			id: `${message.timestamp}-${message.playerId}-${bubbleCounterRef.current}`,
			playerId: message.playerId,
			username: message.username,
			text: message.message,
			x: position.x,
			y: position.y,
		};

		setBubbles((currentBubbles) => {
			const movedBubbles = currentBubbles.map((currentBubble) => {
				if (currentBubble.playerId !== message.playerId) {
					return currentBubble;
				}

				return {
					...currentBubble,
					y: currentBubble.y - 70,
				};
			});

			return [...movedBubbles.slice(-(MAX_BUBBLES - 1)), bubble];
		});
	};

	useEffect(() => {
		let engine: GameEngine | null = null;
		let network: NetworkClient | null = null;
		let interactions: InteractionManager | null = null;
		let cancelled = false;

		const startGame = async () => {
			if (!containerRef.current) {
				return;
			}

			let authenticatedUsername: string | null = null;

			try {
				const data = await api.me();

				authenticatedUsername = data.user?.username ?? null;
			} catch {
				authenticatedUsername = null;
			}

			const storedGuestUsername =
				localStorage.getItem('ahme_guest_username')?.trim() || null;

			const effectiveUsername =
				authenticatedUsername || storedGuestUsername;

			// effet demonte pendant l'await : on ne touche a rien
			if (cancelled) {
				return;
			}

			if (!effectiveUsername) {
				navigateRef.current('/', { replace: true });
				return;
			}

			setUsername(effectiveUsername);

			engine = new GameEngine(containerRef.current, {
				joyBase: joyBaseRef.current,
				joyStick: joyStickRef.current,
			});

			network = new NetworkClient(engine, {
				url: SOCKET_URL,
				guestUsername: authenticatedUsername
					? undefined
					: storedGuestUsername || undefined,
				onStatus: setConnected,
				onChat: (message) => {
					addChatBubble(message);
				},
			});

			networkRef.current = network;
			engine.network = network;

			interactions = new InteractionManager(engine);
			engine.interactions = interactions;

			const joyContainer = joyContainerRef.current;

			if (
				('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
				joyContainer
			) {
				joyContainer.classList.add('touch-enabled');
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

	const sendChat = (message: string) => {
		const mockMessage: ChatMessage = {
			playerId: 'mock-current-user',
			username,
			message,
			timestamp: Date.now(),
		};

		setMessages((previousMessages) => [
			...previousMessages.slice(-MAX_MESSAGES + 1),
			mockMessage,
		]);

		addChatBubble(mockMessage);
	};

	return (
		<>
			<div id="container" ref={containerRef} />

			<DebugOverlay
				enabled
				wireframe={wireframe}
				onWireframeChange={setWireframe}
				infos={{
					'Chunks chargés': 4,
					'Joueurs connectés': connected ? 1 : 0,
					'Position X': 0,
					'Position Z': 0,
					'Socket connecté': connected,
				}}
			/>

			<div className="chat-bubble-overlay" aria-live="polite">
				{bubbles.map((bubble) => (
					<ChatBubble
						key={bubble.id}
						{...bubble}
						onExpire={removeBubble}
					/>
				))}
			</div>

			<div className="game-status">
				<div className="hint">
					{username && (
						<>
							Pseudo : <strong>{username}</strong>
							<br />
						</>
					)}
					Flèches / WASD pour se déplacer
					<br />E pour interagir, joystick sur mobile
				</div>

				<div
					id="connection-status"
					className={connected ? 'is-on' : 'is-off'}>
					{connected ? 'Connecté' : 'Déconnecté'}
				</div>
			</div>

			<button
				type="button"
				className="btn avatar-customize-game-button"
				onClick={() => navigate('/customize')}>
				Personnaliser mon avatar
			</button>

			<ChatBox messages={messages} onSend={sendChat} />

			<div id="joystick-container" ref={joyContainerRef}>
				<div id="joystick-base" ref={joyBaseRef}>
					<div id="joystick-stick" ref={joyStickRef} />
				</div>
			</div>
		</>
	);
}
