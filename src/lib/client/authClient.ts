import { createAuthClient } from 'better-auth/client';
import { telegramClient } from 'better-auth-telegram/client';

export const authClient = createAuthClient({
	fetchOptions: {
		credentials: 'include' // required for link/unlink
	},
	plugins: [telegramClient()]
});
