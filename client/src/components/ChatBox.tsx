/** @format */

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import type { ChatMessage } from '@/game/types';

interface ChatBoxProps {
	messages: ChatMessage[];
	onSend: (message: string) => void;
}

function formatMessageTime(timestamp: number): string {
	return new Intl.DateTimeFormat('fr-FR', {
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(timestamp));
}

export default function ChatBox({ messages, onSend }: ChatBoxProps) {
	const [text, setText] = useState('');
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const messageList = listRef.current;

		if (!messageList) {
			return;
		}

		messageList.scrollTo({
			top: messageList.scrollHeight,
			behavior: 'smooth',
		});
	}, [messages]);

	const send = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
		event.preventDefault();

		const message = text.trim();

		if (!message) {
			return;
		}

		onSend(message);
		setText('');
	};

	return (
		<section className="chat-box" aria-label="Chat global">
			<div className="chat-box-messages" ref={listRef} aria-live="polite">
				{messages.length === 0 ? (
					<p className="chat-box-empty">
						Aucun message pour le moment.
					</p>
				) : (
					messages.map((message, index) => (
						<article
							key={`${message.playerId}-${message.timestamp}-${index}`}
							className="chat-box-line">
							<header className="chat-box-line-header">
								<strong>{message.username}</strong>

								<time
									dateTime={new Date(
										message.timestamp
									).toISOString()}>
									{formatMessageTime(message.timestamp)}
								</time>
							</header>

							<p>{message.message}</p>
						</article>
					))
				)}
			</div>

			<form className="chat-box-form" onSubmit={send}>
				<label className="sr-only" htmlFor="global-chat-message">
					Écrire un message
				</label>

				<input
					className="input chat-box-input"
					id="global-chat-message"
					name="global-chat-message"
					type="text"
					value={text}
					maxLength={300}
					placeholder="Message..."
					autoComplete="off"
					onChange={(event) => setText(event.target.value)}
				/>

				<button
					className="btn chat-box-submit"
					type="submit"
					disabled={!text.trim()}>
					Envoyer
				</button>
			</form>
		</section>
	);
}
