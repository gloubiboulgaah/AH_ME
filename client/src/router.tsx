/** @format */

import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PlayPage from './pages/PlayPage';
import CustomizePage from './pages/CustomizePage';

export const router = createBrowserRouter([
	{ path: '/', element: <HomePage /> },
	{ path: '/login', element: <LoginPage /> },
	{ path: '/register', element: <RegisterPage /> },
	{ path: '/play', element: <PlayPage /> },
	{ path: '/customize', element: <CustomizePage /> },
	{
		path: '*',
		element: (
			<main className="loading-screen">
				<p>Page introuvable.</p>
			</main>
		),
	},
]);
