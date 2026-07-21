'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;

type JoinScreenProps = {
	onJoin: (username: string) => void;
};

export default function JoinScreen({ onJoin }: JoinScreenProps) {
	const [username, setUsername] = useState('');
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const validateUsername = (value: string): string => {
		const trimmedUsername = value.trim();

		if (!trimmedUsername) {
			return 'Le pseudo est obligatoire.';
		}

		if (trimmedUsername.length < MIN_USERNAME_LENGTH) {
			return `Le pseudo doit contenir au moins ${MIN_USERNAME_LENGTH} caractères.`;
		}

		if (trimmedUsername.length > MAX_USERNAME_LENGTH) {
			return `Le pseudo ne peut pas dépasser ${MAX_USERNAME_LENGTH} caractères.`;
		}

		return '';
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const trimmedUsername = username.trim();
		const validationError = validateUsername(trimmedUsername);

		if (validationError) {
			setError(validationError);
			return;
		}

		setError('');
		setIsSubmitting(true);

		onJoin(trimmedUsername);
	};

	const handleUsernameChange = (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		const value = event.target.value;

		setUsername(value);

		if (error) {
			setError(validateUsername(value));
		}
	};

	return (
		<main className="join-page">
			<div className="join-background-shape join-background-shape-one" />
			<div className="join-background-shape join-background-shape-two" />

			<section className="join-card">
				<div className="join-logo" aria-hidden="true">
					<span>AH</span>
					<span>ME</span>
				</div>

				<p className="join-eyebrow">Espace communautaire 3D</p>

				<h1>Entre dans le monde</h1>

				<p className="join-description">
					Choisis un pseudo pour rejoindre les autres joueurs et commencer à
					explorer!
				</p>

				<form className="join-form" onSubmit={handleSubmit} noValidate>
					<label htmlFor="username">Ton pseudo</label>

					<input
						id="username"
						name="username"
						type="text"
						value={username}
						onChange={handleUsernameChange}
						placeholder="Exemple : Syldonel"
						minLength={MIN_USERNAME_LENGTH}
						maxLength={MAX_USERNAME_LENGTH}
						autoComplete="nickname"
						aria-invalid={Boolean(error)}
						aria-describedby={
							error ? 'username-error' : 'username-help'
						}
						disabled={isSubmitting}
					/>

					<div className="join-field-information">
						{error ? (
							<p
								id="username-error"
								className="form-error"
								role="alert"
							>
								{error}
							</p>
						) : (
							<p id="username-help" className="join-help">
								Entre {MIN_USERNAME_LENGTH} et {MAX_USERNAME_LENGTH}{' '}
								caractères
							</p>
						)}

						<span>
							{username.trim().length}/{MAX_USERNAME_LENGTH}
						</span>
					</div>

					<button
						className="btn join-button"
						type="submit"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Connexion...' : 'Rejoindre'}
					</button>
				</form>

				{/* <p className="join-fallback">
					Tu pourras également te connecter avec un compte.
				</p> */}
			</section>
		</main>
	);
}