/** @format */

import type { GameEngine } from './engine';
import type { PlayerMesh, PrivateMessage } from './types';

interface NearbyPlayer {
	id: string;
	mesh: PlayerMesh;
	username: string;
	distance: number;
}

// menu d'interactions entre joueurs (touche E)
// porte tel quel depuis la version vanilla, TODO passer en composants react
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
		menu.className = 'interaction-menu hidden';
		menu.innerHTML = `
      <div class="interaction-menu-header">
        <h3>Interactions disponibles</h3>
        <button class="close-btn">&times;</button>
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
		const closeBtn = this.interactionMenu.querySelector('.close-btn');
		closeBtn?.addEventListener('click', () => this.closeMenu());

		const onKeyDown = (e: KeyboardEvent) => {
			const tag = document.activeElement?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;

			if (e.key.toLowerCase() === 'e' && !this.isMenuOpen) {
				if (this.nearbyPlayers.length > 0) this.openMenu();
			} else if (e.key === 'Escape' && this.isMenuOpen) {
				this.closeMenu();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		this.cleanups.push(() =>
			window.removeEventListener('keydown', onKeyDown)
		);

		this.interactionMenu.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains('interaction-option')) {
				this.handleInteraction(
					target.dataset.action || '',
					target.dataset.playerId || ''
				);
			}
		});
	}

	update() {
		if (!this.engine.network || !this.engine.player) return;

		this.nearbyPlayers = [];
		const playerPos = this.engine.player.position;

		this.engine.network.otherPlayers.forEach((otherPlayer, playerId) => {
			const distance = playerPos.distanceTo(otherPlayer.position);
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
					? 'Appuyez sur E pour interagir avec ' +
						this.nearbyPlayers[0].username
					: 'Appuyez sur E pour interagir (' +
						count +
						' joueurs a proximite)';
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
		const content = this.interactionMenu.querySelector(
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
            <span class="distance">${Math.round(player.distance)} unites</span>
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
        <button class="interaction-option" data-action="message" data-player-id="${player.id}">
          <span class="icon">\u{1F4AC}</span>
          <span class="label">Envoyer un message</span>
        </button>
        <button class="interaction-option" data-action="wave" data-player-id="${player.id}">
          <span class="icon">\u{1F44B}</span>
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
		const player = this.nearbyPlayers.find((p) => p.id === playerId);
		if (!player) return;

		if (action === 'message') this.openMessageDialog(player);
		if (action === 'wave') this.sendWave(player);

		this.closeMenu();
	}

	openMessageDialog(player: NearbyPlayer) {
		document.getElementById('message-dialog')?.remove();

		const dialog = document.createElement('div');
		dialog.id = 'message-dialog';
		dialog.className = 'message-dialog';
		dialog.innerHTML = `
      <div class="message-dialog-header">
        <h3>Message a ${player.username}</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="message-dialog-body">
        <div class="message-history" id="message-history-${player.id}"></div>
        <div class="message-input-container">
          <input type="text" class="message-input" placeholder="Tapez votre message..." maxlength="200">
          <button class="send-btn">Envoyer</button>
        </div>
      </div>
    `;
		document.body.appendChild(dialog);

		dialog
			.querySelector('.close-btn')
			?.addEventListener('click', () => dialog.remove());

		const input = dialog.querySelector<HTMLInputElement>('.message-input');
		const sendBtn = dialog.querySelector('.send-btn');
		if (!input || !sendBtn) return;

		const sendMessage = () => {
			const message = input.value.trim();
			if (message && this.engine.network?.socket) {
				this.engine.network.socket.emit('privateMessage', {
					to: player.id,
					message,
				});
				this.addMessageToHistory(player.id, 'Vous', message, true);
				input.value = '';
			}
		};

		sendBtn.addEventListener('click', sendMessage);
		input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') sendMessage();
		});
		input.focus();
	}

	private addMessageToHistory(
		playerId: string,
		sender: string,
		message: string,
		isSent: boolean
	) {
		const history = document.getElementById('message-history-' + playerId);
		if (!history) return;

		const msgEl = document.createElement('div');
		msgEl.className = 'message ' + (isSent ? 'sent' : 'received');

		const senderEl = document.createElement('div');
		senderEl.className = 'message-sender';
		senderEl.textContent = sender;

		const textEl = document.createElement('div');
		textEl.className = 'message-text';
		textEl.textContent = message;

		const timeEl = document.createElement('div');
		timeEl.className = 'message-time';
		timeEl.textContent = new Date().toLocaleTimeString();

		msgEl.append(senderEl, textEl, timeEl);
		history.appendChild(msgEl);
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
			this.showNotification(username + ' vous a envoye un message');
		}
	}

	private showNotification(text: string) {
		const notif = document.createElement('div');
		notif.className = 'notification';
		notif.textContent = text;
		document.body.appendChild(notif);

		setTimeout(() => notif.classList.add('show'), 100);
		setTimeout(() => {
			notif.classList.remove('show');
			setTimeout(() => notif.remove(), 300);
		}, 3000);
	}

	destroy() {
		this.cleanups.forEach((fn) => fn());
		this.cleanups = [];
	}
}
