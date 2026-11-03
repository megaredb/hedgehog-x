export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

const BROWSER_COLORS: Record<string, string> = {
	Auth: '#8b5cf6',
	Audio: '#06b6d4',
	Sync: '#10b981',
	Storage: '#f59e0b',
	Downloads: '#3b82f6',
	DB: '#6366f1',
	SW: '#ec4899',
	API: '#ef4444',
	App: '#14b8a6',
	Default: '#64748b'
};

export interface Logger {
	debug: (message: string, ...args: unknown[]) => void;
	info: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
	error: (message: string, ...args: unknown[]) => void;
}

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function isDev(): boolean {
	try {
		if (typeof import.meta !== 'undefined' && import.meta.env) {
			return Boolean(import.meta.env.DEV);
		}
	} catch {
		// ignore
	}
	try {
		if (typeof process !== 'undefined' && process.env) {
			return process.env.NODE_ENV !== 'production';
		}
	} catch {
		// ignore
	}
	return false;
}

/**
 * Resolves current minimum logging level:
 * - In development mode: 'debug'
 * - In production browser: 'warn' (overridable via localStorage.getItem('LOG_LEVEL'))
 * - In production server: 'info'
 */
export function getMinLogLevel(): LogLevel {
	if (isDev()) return 'debug';
	if (isBrowser()) {
		try {
			const override = localStorage.getItem('LOG_LEVEL') as LogLevel;
			if (override && override in LOG_LEVELS) return override;
		} catch {
			// localStorage unavailable
		}
		return 'warn';
	}
	return 'info';
}

/**
 * Creates a scoped logger for a module or component.
 * Safe for SSR, Node.js, browser and Service Worker environments.
 */
export function createLogger(tag: string): Logger {
	const color = BROWSER_COLORS[tag] ?? BROWSER_COLORS.Default;

	function shouldLog(level: LogLevel): boolean {
		const minLevel = getMinLogLevel();
		return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
	}

	function emit(level: LogLevel, message: string, ...args: unknown[]) {
		if (!shouldLog(level)) return;

		const consoleFn = (console[level] ?? console.log).bind(console);

		if (isBrowser()) {
			const badgeStyle = `background: ${color}; color: white; border-radius: 3px; padding: 1px 5px; font-weight: bold; font-size: 10px;`;
			const textStyle = 'color: inherit; font-weight: normal;';
			consoleFn(`%c${tag}%c ${message}`, badgeStyle, textStyle, ...args);
		} else {
			const time = new Date().toISOString().slice(11, 19);
			consoleFn(`[${time}] [${level.toUpperCase()}] [${tag}] ${message}`, ...args);
		}
	}

	return {
		debug: (message: string, ...args: unknown[]) => emit('debug', message, ...args),
		info: (message: string, ...args: unknown[]) => emit('info', message, ...args),
		warn: (message: string, ...args: unknown[]) => emit('warn', message, ...args),
		error: (message: string, ...args: unknown[]) => emit('error', message, ...args)
	};
}
