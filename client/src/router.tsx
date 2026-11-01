/** @format */

import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RequireAccount from './components/RequireAccount';
import RequireGameEntry from './components/RequireGameEntry';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PlayPage from './pages/PlayPage';
import CustomizePage from './pages/CustomizePage';
import ServersPage from './pages/ServersPage';
import CreateServerPage from './pages/CreateServerPage';
import ServerSettingsPage from './pages/ServerSettingsPage';

export const router = createBrowserRouter([
	{ path: '/', element: <HomePage /> },
	{ path: '/login', element: <LoginPage /> },
	{ path: '/register', element: <RegisterPage /> },
	{ path: '/play', element: <PlayPage /> },
	{ path: '/customize', element: <CustomizePage /> },
	{ path: '/servers', element: <RequireGameEntry><ServersPage /></RequireGameEntry> },
	{ path: '/servers/create', element: <RequireAccount><CreateServerPage /></RequireAccount> },
	{ path: '/servers/settings', element: <RequireAccount><ServerSettingsPage /></RequireAccount> },
	{
		path: '*',
		element: (
			<main className="loading-screen">
				<p>Page introuvable.</p>
			</main>
		),
	},
]);
