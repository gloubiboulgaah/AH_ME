/** @format */

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			await api.login({ email, password });
			router.push('/play');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'erreur');
			setLoading(false);
		}
	};

	return (
		<main className="landing">
			<h1>Connexion</h1>
			<form className="auth-form" onSubmit={submit}>
				<input
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
				<input
					type="password"
					placeholder="Mot de passe"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
				{error && <p className="form-error">{error}</p>}
				<button className="btn" type="submit" disabled={loading}>
					{loading ? '...' : 'Se connecter'}
				</button>
			</form>
			<p>
				Pas de compte ? <Link href="/register">Inscription</Link>
			</p>
		</main>
	);
}
