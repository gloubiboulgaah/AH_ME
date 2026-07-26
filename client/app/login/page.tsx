/** @format */

'use client';

import {
	useState,
	type SubmitEventHandler,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
	const router = useRouter();

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
			await api.login({
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
					<h1 className="panel-title">Connexion</h1>
				</header>

				<form
					className="auth-form stack"
					onSubmit={submit}
				>
					<div>
						<label
							className="input-label"
							htmlFor="login-email"
						>
							Email
						</label>

						<input
							className="input"
							id="login-email"
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
							htmlFor="login-password"
						>
							Mot de passe
						</label>

						<input
							className="input"
							id="login-password"
							name="password"
							type="password"
							placeholder="Ton mot de passe"
							value={password}
							onChange={(event) =>
								setPassword(event.target.value)
							}
							autoComplete="current-password"
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
						{loading ? 'Connexion...' : 'Se connecter'}
					</button>
				</form>

				<p className="panel-text auth-switch">
					Pas de compte ?{' '}
					<Link href="/register">Inscription</Link>
				</p>
			</section>
		</main>
	);
}