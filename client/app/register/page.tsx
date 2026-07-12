/** @format */

'use client';

import { useState, type FormEvent } from 'react';
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

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			await api.register({ username, email, password });
			router.push('/play');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'erreur');
			setLoading(false);
		}
	};

	return (
		<main className="landing">
			<h1>Inscription</h1>
			<form className="auth-form" onSubmit={submit}>
				<input
					type="text"
					placeholder="Pseudo"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					minLength={3}
					maxLength={32}
					required
				/>
				<input
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
				<input
					type="password"
					placeholder="Mot de passe (8 min)"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					minLength={8}
					required
				/>
				{error && <p className="form-error">{error}</p>}
				<button className="btn" type="submit" disabled={loading}>
					{loading ? '...' : "S'inscrire"}
				</button>
			</form>
			<p>
				Deja un compte ? <Link href="/login">Connexion</Link>
			</p>
		</main>
	);
}
