/** @format */

'use client';

import {
	useState,
	type SubmitEventHandler,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function RegisterPage() {
	const router = useRouter();

	const [username, setUsername] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const submit: SubmitEventHandler<HTMLFormElement> = async (
		event,
	) => {
		event.preventDefault();

		setError('');
		setLoading(true);

		try {
			await api.register({
				username,
				email,
				password,
			});

			router.push('/play');
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Une erreur s'est produite.",
			);
			setLoading(false);
		}
	};

	return (
		<main className="join-page">
			<div
				className="join-background-shape join-background-shape-one"
				aria-hidden="true"
			/>

			<div
				className="join-background-shape join-background-shape-two"
				aria-hidden="true"
			/>

			<section className="panel auth-panel">
				<header className="panel-header">
					<h1 className="panel-title">Inscription</h1>
				</header>

				<form
					className="auth-form stack"
					onSubmit={submit}
				>
					<div>
						<label
							className="input-label"
							htmlFor="register-username"
						>
							Pseudo
						</label>

						<input
							className="input"
							id="register-username"
							name="username"
							type="text"
							placeholder="Ton pseudo"
							value={username}
							onChange={(event) =>
								setUsername(event.target.value)
							}
							minLength={3}
							maxLength={32}
							autoComplete="username"
							disabled={loading}
							required
						/>
					</div>

					<div>
						<label
							className="input-label"
							htmlFor="register-email"
						>
							Email
						</label>

						<input
							className="input"
							id="register-email"
							name="email"
							type="email"
							placeholder="ton@email.com"
							value={email}
							onChange={(event) =>
								setEmail(event.target.value)
							}
							autoComplete="email"
							disabled={loading}
							required
						/>
					</div>

					<div>
						<label
							className="input-label"
							htmlFor="register-password"
						>
							Mot de passe
						</label>

						<input
							className="input"
							id="register-password"
							name="password"
							type="password"
							placeholder="8 caractères minimum"
							value={password}
							onChange={(event) =>
								setPassword(event.target.value)
							}
							minLength={8}
							autoComplete="new-password"
							disabled={loading}
							required
						/>
					</div>

					{error && (
						<p className="form-error" role="alert">
							{error}
						</p>
					)}

					<button
						className="btn"
						type="submit"
						disabled={loading}
					>
						{loading ? 'Inscription...' : "S'inscrire"}
					</button>
				</form>

				<p className="panel-text auth-switch">
					Déjà un compte ?{' '}
					<Link href="/login">Connexion</Link>
				</p>
			</section>
		</main>
	);
}