/** @format */

'use client';

import { useEffect } from 'react';

export interface ChatBubbleData {
	id: string;
	playerId: string;
	username: string;
	text: string;
	x: number;
	y: number;
}

interface ChatBubbleProps extends ChatBubbleData {
	duration?: number;
	onExpire: (id: string) => void;
}

export default function ChatBubble({
	id,
	username,
	text,
	x,
	y,
	duration = 4000,
	onExpire,
}: ChatBubbleProps) {
	useEffect(() => {
		const timeout = window.setTimeout(() => {
			onExpire(id);
		}, duration);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [duration, id, onExpire]);

	return (
		<div
			className="avatar-chat-bubble"
			style={{
				left: `${x}px`,
				top: `${y}px`,
			}}
			role="status"
		>
			<strong className="avatar-chat-bubble-username">
				{username}
			</strong>

			<span className="avatar-chat-bubble-text">
				{text}
			</span>
		</div>
	);
}