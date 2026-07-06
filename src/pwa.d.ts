declare module 'virtual:pwa-register/svelte' {
	import { type Writable } from 'svelte/store';

	export interface RegisterSWOptions {
		immediate?: boolean;
		onNeedRefresh?: () => void;
		onOfflineReady?: () => void;
		onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
		onRegisterError?: (error: unknown) => void;
		onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
	}

	export function useRegisterSW(options?: RegisterSWOptions): {
		needRefresh: Writable<boolean>;
		offlineReady: Writable<boolean>;
		updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
	};
}

declare module 'virtual:pwa-info' {
	export const pwaInfo:
		| {
				webManifest: {
					linkTag: string;
				};
		  }
		| undefined;
}
