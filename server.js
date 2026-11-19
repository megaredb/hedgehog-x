import compression from 'compression';
import { createServer } from 'node:http';
import { handler } from './build/handler.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
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

createServer((req, res) => {
	cacheHeaders(req, res, () => compress(req, res, () => handler(req, res)));
}).listen(port, host, () => {
	console.log(`Listening on http://${host}:${port}`);
});
