import { spawn } from 'node:child_process';

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const port = process.env.WEBHOOK_LOCAL_PORT ?? '5180';

if (!token || !secret) {
	console.error('[serveo-webhook] TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are required');
	process.exit(1);
}

let child = null;
let currentUrl = null;
let stopping = false;
let retryTimer = null;

async function setWebhook(url) {
	const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			url: `${url}/api/telegram/webhook`,
			secret_token: secret,
			allowed_updates: ['chat_member', 'my_chat_member'],
			drop_pending_updates: false
		})
	});
	const data = await response.json();
	if (!data.ok) throw new Error(data.description ?? 'setWebhook failed');
	console.log(`[serveo-webhook] Telegram webhook -> ${url}/api/telegram/webhook`);
}

function scheduleReconnect(reason) {
	if (stopping) return;
	if (retryTimer) return;
	console.error(`[serveo-webhook] ${reason}; reconnecting in 3s`);
	retryTimer = setTimeout(() => {
		retryTimer = null;
		connect();
	}, 3000);
}

function connect() {
	if (stopping) return;
	const proc = spawn(
		'ssh',
		[
			'-o',
			'StrictHostKeyChecking=no',
			'-o',
			'UserKnownHostsFile=/dev/null',
			'-o',
			'ServerAliveInterval=30',
			'-o',
			'ExitOnForwardFailure=yes',
			'-R',
			`80:localhost:${port}`,
			'serveo.net'
		],
		{ stdio: ['ignore', 'pipe', 'pipe'] }
	);
	child = proc;

	const onOutput = (chunk) => {
		// eslint-disable-next-line no-control-regex -- strip ANSI colors from SSH output
		const text = chunk.toString().replace(/\x1b\[[0-9;]*m/g, '');
		process.stdout.write(text);
		const match = text.match(/https:\/\/[a-z0-9-]+\.serveousercontent\.com/);
		if (!match || match[0] === currentUrl) return;
		currentUrl = match[0];
		void setWebhook(currentUrl).catch((error) => {
			console.error(`[serveo-webhook] ${error instanceof Error ? error.message : String(error)}`);
		});
	};

	proc.stdout.on('data', onOutput);
	proc.stderr.on('data', onOutput);
	proc.on('error', (error) => {
		console.error(`[serveo-webhook] ssh error: ${error.message}`);
		scheduleReconnect('ssh error');
	});
	proc.on('exit', (code, signal) => {
		if (child === proc) child = null;
		if (!stopping) {
			console.error(
				`[serveo-webhook] tunnel exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`
			);
			scheduleReconnect('tunnel exited');
		}
	});
}

function shutdown(signal) {
	stopping = true;
	if (retryTimer) clearTimeout(retryTimer);
	retryTimer = null;
	if (child) child.kill('SIGTERM');
	console.log(`[serveo-webhook] stopping (${signal})`);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

connect();
