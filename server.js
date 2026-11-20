import compression from 'compression';
import { createServer } from 'node:http';
import { handler } from './build/handler.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const shutdownTimeoutSec = Math.max(
	1,
	Number.parseInt(process.env.SHUTDOWN_TIMEOUT || '30', 10) || 30
);
const compress = compression({ threshold: 1024 });

function cacheHeaders(req, res, next) {
	const url = (req.url ?? '').split('?')[0];
	if (url.startsWith('/_app/immutable/')) {
		res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
	} else if (/\.(?:webp|png|jpe?g|gif|svg|ico|woff2?|mp3|webm)$/i.test(url)) {
		res.setHeader('Cache-Control', 'public, max-age=604800');
	}
	next();
}

const server = createServer((req, res) => {
	cacheHeaders(req, res, () => compress(req, res, () => handler(req, res)));
});

server.listen(port, host, () => {
	console.log(`Listening on http://${host}:${port}`);
});

let shutdownTimer;
function gracefulShutdown(reason) {
	if (shutdownTimer) return;
	server.closeIdleConnections?.();
	server.close((error) => {
		if (error) return;
		if (shutdownTimer) clearTimeout(shutdownTimer);
		process.emit('sveltekit:shutdown', reason);
	});
	shutdownTimer = setTimeout(() => {
		server.closeAllConnections?.();
		process.emit('sveltekit:shutdown', reason);
	}, shutdownTimeoutSec * 1000);
	shutdownTimer.unref?.();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
