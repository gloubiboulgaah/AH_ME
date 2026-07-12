/** @format */

'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '@/game/types';

interface ChatBoxProps {
	messages: ChatMessage[];
	onSend: (message: string) => void;
}

// chat global minimal, refonte prevue cote UI
export default function ChatBox({ messages, onSend }: ChatBoxProps) {
	const [text, setText] = useState('');
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [messages]);

	const send = (e: FormEvent) => {
		e.preventDefault();
		const msg = text.trim();
		if (!msg) return;
		onSend(msg);
		setText('');
	};

	return (
		<div className="chat-box">
			<div className="chat-box-messages" ref={listRef}>
				{messages.map((m, i) => (
					<div key={i} className="chat-box-line">
						<strong>{m.username}:</strong> {m.message}
					</div>
				))}
			</div>
			<form className="chat-box-form" onSubmit={send}>
				<input
					type="text"
					value={text}
					maxLength={300}
					placeholder="Message..."
					onChange={(e) => setText(e.target.value)}
				/>
				<button type="submit">Envoyer</button>
			</form>
		</div>
	);
}
