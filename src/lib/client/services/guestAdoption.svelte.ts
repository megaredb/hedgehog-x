import type { LocalUserDataCounts } from '$lib/client/db/syncState';

export type GuestAdoptionDecision = 'import' | 'discard';

export interface GuestAdoptionRequest {
	userId: string;
	accountName?: string;
	counts: LocalUserDataCounts;
}

class GuestAdoptionStore {
	open = $state(false);
	request = $state<GuestAdoptionRequest | null>(null);
	#resolve: ((decision: GuestAdoptionDecision) => void) | null = null;

	ask(request: GuestAdoptionRequest): Promise<GuestAdoptionDecision> {
		// A second sync while the modal is open must not leave the first promise stuck.
		this.#resolve?.('discard');
		this.request = request;
		this.open = true;

		return new Promise((resolve) => {
			this.#resolve = resolve;
		});
	}

	choose(decision: GuestAdoptionDecision) {
		if (!this.open) return;
		this.open = false;
		const resolve = this.#resolve;
		this.#resolve = null;
		resolve?.(decision);
	}

	cancel() {
		this.choose('discard');
	}

	get accountName(): string {
		return this.request?.accountName || 'аккаунт';
	}

	get total(): number {
		const c = this.request?.counts;
		if (!c) return 0;
		return c.progress + c.bookmarks + c.volumeLikes + c.chapterLikes;
	}
}

export const guestAdoption = new GuestAdoptionStore();
