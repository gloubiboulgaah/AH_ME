/** @format */

import type { GameEngine } from './engine';
import { TILE } from './salon/layout';
import type { PlayerMesh, PrivateMessage } from './types';

interface NearbyPlayer {
	id: string;
	mesh: PlayerMesh;
	username: string;
	distance: number;
}

// Menu d’interactions entre joueurs (touche F).
// Conservé depuis la version vanilla.
// TODO : le convertir plus tard en composant React.
export class InteractionManager {
	engine: GameEngine;
	interactionRadius = TILE * 2;
	nearbyPlayers: NearbyPlayer[] = [];
	interactionMenu!: HTMLDivElement;
	interactionIndicator!: HTMLDivElement;
	isMenuOpen = false;

	private cleanups: Array<() => void> = [];
	private conversations = new Map<string, Array<{ sender: string; message: string; sent: boolean }>>();
	private unread = new Map<string, number>();
    private userIdForSocket = new Map<string, number>();
	private inbox!: HTMLButtonElement;

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
			'<span class="indicator-text">Appuyez sur F pour interagir</span>';

		document.body.appendChild(indicator);
		this.interactionIndicator = indicator;

		this.inbox = document.createElement('button');
		this.inbox.type = 'button';
		this.inbox.className = 'btn';
		this.inbox.textContent = 'Messages';
		this.inbox.classList.add('private-inbox-button');
		this.inbox.addEventListener('click', () => this.openInbox());
		document.body.appendChild(this.inbox);

		this.cleanups.push(() => {
			menu.remove();
			indicator.remove();
			this.inbox.remove();
			document.getElementById('message-dialog')?.remove();
            document.getElementById('private-inbox-panel')?.remove();
		});
	}

	private bindEvents() {
		const closeButton =
			this.interactionMenu.querySelector<HTMLButtonElement>('.close-btn');

		closeButton?.addEventListener('click', () => this.closeMenu());

		const onKeyDown = (event: KeyboardEvent) => {
			const tag = document.activeElement?.tagName;

			if (tag === 'INPUT' || tag === 'TEXTAREA') return;

			if (event.key.toLowerCase() === 'f' && !event.repeat && !this.isMenuOpen) {
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
		if (this.nearbyPlayers.length > 0 && !this.isMenuOpen ) {
			this.interactionIndicator.classList.remove('hidden');

			const count = this.nearbyPlayers.length;
			const text =
				count === 1
					? `Appuyez sur F pour interagir avec ${this.nearbyPlayers[0].username}`
					: `Appuyez sur F pour interagir (${count} joueurs à proximité)`;

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
						<strong>${this.escapeHtml(player.username)}</strong>
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
					Message à ${this.escapeHtml(player.username)}
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
						Message pour ${this.escapeHtml(player.username)}
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

		dialog.dataset.playerId = player.id;
		document.body.appendChild(dialog);
		this.unread.delete(player.id);
        const peerId=this.userIdForSocket.get(player.id);
        if(peerId) this.engine.network?.socket?.emit('privateMessageRead',{userId:peerId});
		this.updateInbox();
		for (const entry of this.conversations.get(player.id) ?? []) {
			this.renderMessage(player.id, entry.sender, entry.message, entry.sent);
		}

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
                toUserId: player.id.startsWith('offline:') ? Number(player.id.split(':')[1]) : this.userIdForSocket.get(player.id),
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
		const entries = this.conversations.get(playerId) ?? [];
		entries.push({ sender, message, sent: isSent });
		this.conversations.set(playerId, entries.slice(-100));
		this.renderMessage(playerId, sender, message, isSent);
	}

	private renderMessage(playerId: string, sender: string, message: string, isSent: boolean) {
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
		const username = data.fromUsername || mesh?.userData.username || '?';

		if(data.fromUserId) this.userIdForSocket.set(data.from,data.fromUserId);
        this.addMessageToHistory(data.from, username, data.message, false);

		const dialog = document.getElementById('message-dialog');
		if (dialog?.dataset.playerId !== data.from) {
			this.unread.set(data.from, (this.unread.get(data.from) ?? 0) + 1);
			this.updateInbox();
			this.showNotification(`${username} vous a envoyé un message`, data.from);
		}
	}


    receivePrivateHistory(entries: Array<{id:number;sender_id:number;recipient_id:number;body:string;created_at:string;read_at:string|null;sender_username:string;recipient_username:string}>) {
        // garde les nouveaux messages reçus pendant le chargement
        const current = this.engine.network?.otherPlayers;
        for (const entry of entries) {
            const isMine = Boolean(this.engine.network && entry.sender_username === this.engine.network?.networkUsername());
            const peerId = isMine ? entry.recipient_id : entry.sender_id;
            const peerName = isMine ? entry.recipient_username : entry.sender_username;
            const online = [...(current?.entries() ?? [])].find(([,mesh]) => mesh.userData.username === peerName)?.[0];
            const key = online ?? `offline:${peerId}`;
            if (online) this.userIdForSocket.set(online,peerId);
            const history = this.conversations.get(key) ?? [];
            if (!history.some(row => row.message === entry.body && row.sender === (isMine?'Vous':peerName))) {
                history.push({sender:isMine?'Vous':peerName,message:entry.body,sent:isMine});
                this.conversations.set(key,history.slice(-200));
            }
            if (!isMine && !entry.read_at) this.unread.set(key,(this.unread.get(key) ?? 0)+1);
        }
        this.updateInbox();
    }

    confirmPrivateMessage(_data: {to:string;message:string}) { /* Message déjà affiché à l'envoi. */ }

	private escapeHtml(value: string) {
		return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
	}

	private updateInbox() {
		const count = [...this.unread.values()].reduce((sum, value) => sum + value, 0);
		this.inbox.textContent = count ? `Messages (${count})` : 'Messages';
	}

	private openInbox(playerId?: string) {
        const ids = [...this.conversations.keys()];
        if (playerId) {
            const mesh = this.engine.network?.otherPlayers.get(playerId);
            const entries = this.conversations.get(playerId) ?? [];
            const name = mesh?.userData.username || entries.find((entry) => !entry.sent)?.sender || 'Joueur';
            this.openMessageDialog({ id: playerId, mesh: mesh as PlayerMesh, username: name, distance: 0 });
            return;
        }
        document.getElementById('private-inbox-panel')?.remove();
        const panel = document.createElement('section');
        panel.id = 'private-inbox-panel';
        panel.className = 'panel private-inbox-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Conversations privées');
        const header = document.createElement('div');
        header.className = 'private-inbox-header';
        const title = document.createElement('h3');
        title.textContent = 'Messages privés';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn';
        close.textContent = 'Fermer';
        close.addEventListener('click', () => panel.remove());
        header.append(title, close);
        panel.appendChild(header);
        if (!ids.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Aucune conversation pour le moment.';
            panel.appendChild(empty);
        }
        for (const id of ids) {
            const entries = this.conversations.get(id) ?? [];
            const mesh = this.engine.network?.otherPlayers.get(id);
            const name = mesh?.userData.username || entries.find((entry) => !entry.sent)?.sender || 'Joueur';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn private-inbox-conversation';
            button.textContent = `${name}${this.unread.get(id) ? ` (${this.unread.get(id)} non lus)` : ''}`;
            button.addEventListener('click', () => { panel.remove(); this.openInbox(id); });
            panel.appendChild(button);
        }
        document.body.appendChild(panel);
    }

	private showNotification(text: string, playerId: string) {
		const notification = document.createElement('button');
		notification.type = 'button';
		notification.className = 'notification show';
		notification.style.pointerEvents = 'auto';
		notification.textContent = `${text} — Ouvrir`;
		notification.addEventListener('click', () => {
			this.openInbox(playerId);
			notification.remove();
		});
		document.body.appendChild(notification);
		// Le message reste accessible via le bouton Messages.
		setTimeout(() => notification.remove(), 12000);
	}

	destroy() {
		this.cleanups.forEach((cleanup) => cleanup());
		this.cleanups = [];
	}
}
