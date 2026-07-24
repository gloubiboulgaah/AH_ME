/** @format */

import type { ChatMessage } from '@/game/types';

const now = Date.now();

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
	{
		playerId: 'mock-player-1',
		username: 'Safiya',
		message: 'Salut, bienvenue dans AH_ME !',
		timestamp: now - 120_000,
	},
	{
		playerId: 'mock-player-2',
		username: 'Elliott',
		message:
			'Ce message est volontairement plus long pour vérifier que le texte revient correctement à la ligne sur ordinateur et sur mobile.',
		timestamp: now - 60_000,
	},
	{
		playerId: 'mock-player-3',
		username: 'Alex',
		message: 'On se retrouve près de la place centrale ?',
		timestamp: now - 15_000,
	},
];