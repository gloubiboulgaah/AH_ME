/** @format */

import type { GameEngine } from './engine';
import type { PlayerMesh, PrivateMessage } from './types';

interface NearbyPlayer {
	id: string;
	mesh: PlayerMesh;
	username: string;
	distance: number;
}

// Menu d’interactions entre joueurs (touche E).
// Conservé depuis la version vanilla.
// TODO : le convertir plus tard en composant React.
export class InteractionManager {
	engine: GameEngine;
	interactionRadius = 50;
	nearbyPlayers: NearbyPlayer[] = [];
	interactionMenu!: HTMLDivElement;
	interactionIndicator!: HTMLDivElement;
	isMenuOpen = false;

	private cleanups: Array<() => void> = [];

	constructor(engine: GameEngine) {
		this.engine = engine;
		this.createUI();
		this.bindEvents();
	}

	private createUI() {
		const menu = document.createElement('div');

		menu.id = 'interaction-menu';
		menu.className = 'panel interaction-menu hidden';
		menu.setAttribute('role', 'dialog');
		menu.setAttribute('aria-modal', 'false');
		menu.setAttribute('aria-labelledby', 'interaction-menu-title');

		menu.innerHTML = `
			<div class="interaction-menu-header">
				<h3 id="interaction-menu-title">Interactions disponibles</h3>

				<button
					class="btn btn-icon close-btn"
					type="button"
					aria-label="Fermer le menu d’interactions"
				>
					&times;
				</button>
			</div>

			<div class="interaction-menu-content"></div>
		`;

		document.body.appendChild(menu);
		this.interactionMenu = menu;

		const indicator = document.createElement('div');

		indicator.id = 'interaction-indicator';
		indicator.className = 'interaction-indicator hidden';
		indicator.innerHTML =
			'<span class="indicator-text">Appuyez sur E pour interagir</span>';

		document.body.appendChild(indicator);
		this.interactionIndicator = indicator;

		this.cleanups.push(() => {
			menu.remove();
			indicator.remove();
			document.getElementById('message-dialog')?.remove();
		});
	}

	private bindEvents() {
		const closeButton =
			this.interactionMenu.querySelector<HTMLButtonElement>('.close-btn');

		closeButton?.addEventListener('click', () => this.closeMenu());

		const onKeyDown = (event: KeyboardEvent) => {
			const tag = document.activeElement?.tagName;

			if (tag === 'INPUT' || tag === 'TEXTAREA') return;

			if (event.key.toLowerCase() === 'e' && !this.isMenuOpen) {
				if (this.nearbyPlayers.length > 0) this.openMenu();
			} else if (event.key === 'Escape' && this.isMenuOpen) {
				this.closeMenu();
			}
		};

		window.addEventListener('keydown', onKeyDown);

		this.cleanups.push(() =>
			window.removeEventListener('keydown', onKeyDown)
		);

		this.interactionMenu.addEventListener('click', (event) => {
			const target = event.target as HTMLElement;
			const option = target.closest<HTMLButtonElement>(
				'.interaction-option'
			);

			if (!option) return;

			this.handleInteraction(
				option.dataset.action ?? '',
				option.dataset.playerId ?? ''
			);
		});
	}

	update() {
		if (!this.engine.network || !this.engine.player) return;

		this.nearbyPlayers = [];
		const playerPosition = this.engine.player.position;

		this.engine.network.otherPlayers.forEach((otherPlayer, playerId) => {
			const distance = playerPosition.distanceTo(otherPlayer.position);

			if (distance <= this.interactionRadius) {
				this.nearbyPlayers.push({
					id: playerId,
					mesh: otherPlayer,
					username: otherPlayer.userData.username || '?',
					distance,
				});
			}
		});

		this.updateIndicator();
	}

	private updateIndicator() {
		if (this.nearbyPlayers.length > 0 && !this.isMenuOpen) {
			this.interactionIndicator.classList.remove('hidden');

			const count = this.nearbyPlayers.length;
			const text =
				count === 1
					? `Appuyez sur E pour interagir avec ${this.nearbyPlayers[0].username}`
					: `Appuyez sur E pour interagir (${count} joueurs à proximité)`;

			const label =
				this.interactionIndicator.querySelector('.indicator-text');

			if (label) label.textContent = text;
		} else {
			this.interactionIndicator.classList.add('hidden');
		}
	}

	openMenu() {
		if (this.nearbyPlayers.length === 0) return;

		this.isMenuOpen = true;

		const content = this.interactionMenu.querySelector<HTMLDivElement>(
			'.interaction-menu-content'
		);

		if (!content) return;

		content.innerHTML = '';

		if (this.nearbyPlayers.length === 1) {
			content.innerHTML = this.generateSinglePlayerOptions(
				this.nearbyPlayers[0]
			);
		} else {
			this.nearbyPlayers.forEach((player) => {
				const section = document.createElement('div');

				section.className = 'player-interaction-section';

				section.innerHTML = `
					<div class="player-header">
						<strong>${player.username}</strong>
						<span class="distance">
							${Math.round(player.distance)} unités
						</span>
					</div>

					${this.generateSinglePlayerOptions(player)}
				`;

				content.appendChild(section);
			});
		}

		this.interactionMenu.classList.remove('hidden');
		this.interactionIndicator.classList.add('hidden');
	}

	private generateSinglePlayerOptions(player: NearbyPlayer) {
		return `
			<div class="interaction-options">
				<button
					class="btn btn-ghost interaction-option"
					type="button"
					data-action="message"
					data-player-id="${player.id}"
				>
					<span class="icon" aria-hidden="true">
						\u{1F4AC}
					</span>
					<span class="label">Envoyer un message</span>
				</button>

				<button
					class="btn btn-ghost interaction-option"
					type="button"
					data-action="wave"
					data-player-id="${player.id}"
				>
					<span class="icon" aria-hidden="true">
						\u{1F44B}
					</span>
					<span class="label">Saluer</span>
				</button>
			</div>
		`;
	}

	closeMenu() {
		this.isMenuOpen = false;
		this.interactionMenu.classList.add('hidden');
		this.updateIndicator();
	}

	handleInteraction(action: string, playerId: string) {
		const player = this.nearbyPlayers.find(
			(nearbyPlayer) => nearbyPlayer.id === playerId
		);

		if (!player) return;

		if (action === 'message') {
			this.openMessageDialog(player);
		}

		if (action === 'wave') {
			this.sendWave(player);
		}

		this.closeMenu();
	}

	openMessageDialog(player: NearbyPlayer) {
		document.getElementById('message-dialog')?.remove();

		const dialog = document.createElement('div');

		dialog.id = 'message-dialog';
		dialog.className = 'panel message-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'false');
		dialog.setAttribute('aria-labelledby', 'message-dialog-title');

		dialog.innerHTML = `
			<div class="message-dialog-header">
				<h3 id="message-dialog-title">
					Message à ${player.username}
				</h3>

				<button
					class="btn btn-icon close-btn"
					type="button"
					aria-label="Fermer la conversation"
				>
					&times;
				</button>
			</div>

			<div class="message-dialog-body">
				<div
					class="message-history"
					id="message-history-${player.id}"
					aria-live="polite"
				></div>

				<div class="message-input-container">
					<label
						class="sr-only"
						for="private-message-input-${player.id}"
					>
						Message pour ${player.username}
					</label>

					<input
						id="private-message-input-${player.id}"
						name="private-message"
						type="text"
						class="input message-input"
						placeholder="Tapez votre message..."
						maxlength="200"
						autocomplete="off"
					>

					<button
						class="btn send-btn"
						type="button"
					>
						Envoyer
					</button>
				</div>
			</div>
		`;

		document.body.appendChild(dialog);

		dialog
			.querySelector<HTMLButtonElement>('.close-btn')
			?.addEventListener('click', () => dialog.remove());

		const input = dialog.querySelector<HTMLInputElement>('.message-input');

		const sendButton = dialog.querySelector<HTMLButtonElement>('.send-btn');

		if (!input || !sendButton) return;

		const sendMessage = () => {
			const message = input.value.trim();

			if (!message || !this.engine.network?.socket) return;

			this.engine.network.socket.emit('privateMessage', {
				to: player.id,
				message,
			});

			this.addMessageToHistory(player.id, 'Vous', message, true);

			input.value = '';
			input.focus();
		};

		sendButton.addEventListener('click', sendMessage);

		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				sendMessage();
			}
		});

		input.focus();
	}

	private addMessageToHistory(
		playerId: string,
		sender: string,
		message: string,
		isSent: boolean
	) {
		const history = document.getElementById(`message-history-${playerId}`);

		if (!history) return;

		const messageElement = document.createElement('div');

		messageElement.className = `message ${isSent ? 'sent' : 'received'}`;

		const senderElement = document.createElement('div');
		senderElement.className = 'message-sender';
		senderElement.textContent = sender;

		const textElement = document.createElement('div');
		textElement.className = 'message-text';
		textElement.textContent = message;

		const timeElement = document.createElement('div');
		timeElement.className = 'message-time';
		timeElement.textContent = new Date().toLocaleTimeString('fr-FR', {
			hour: '2-digit',
			minute: '2-digit',
		});

		messageElement.append(senderElement, textElement, timeElement);

		history.appendChild(messageElement);
		history.scrollTop = history.scrollHeight;
	}

	sendWave(player: NearbyPlayer) {
		this.engine.network?.socket?.emit('emote', {
			to: player.id,
			type: 'wave',
		});
	}

	receivePrivateMessage(data: PrivateMessage) {
		const mesh = this.engine.network?.otherPlayers.get(data.from);

		if (!mesh) return;

		const username = mesh.userData.username || '?';

		this.addMessageToHistory(data.from, username, data.message, false);

		if (!document.getElementById('message-dialog')) {
			this.showNotification(`${username} vous a envoyé un message`);
		}
	}

	private showNotification(text: string) {
		const notification = document.createElement('div');

		notification.className = 'notification';
		notification.textContent = text;

		document.body.appendChild(notification);

		setTimeout(() => {
			notification.classList.add('show');
		}, 100);

		setTimeout(() => {
			notification.classList.remove('show');

			setTimeout(() => {
				notification.remove();
			}, 300);
		}, 3000);
	}

	destroy() {
		this.cleanups.forEach((cleanup) => cleanup());
		this.cleanups = [];
	}
}
