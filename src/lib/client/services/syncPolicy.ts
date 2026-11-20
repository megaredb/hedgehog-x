/**
 * Pure decision logic for replacing local user data with server data.
 *
 * The important distinction:
 * - guest/unknown (no owner) + local data: merge, never purge;
 * - same authenticated user + no pending mutations: server is authoritative;
 * - another user: switch, i.e. clear the old user's local data first.
 */
export type SyncAction = 'skip' | 'merge' | 'replace' | 'switch';

export interface SyncDecisionInput {
	serverUserId?: string | null;
	localOwner?: string | null;
	hasLocalData: boolean;
	hasPendingMutations: boolean;
}

export function decideSyncAction({
	serverUserId,
	localOwner,
	hasLocalData,
	hasPendingMutations
}: SyncDecisionInput): SyncAction {
	if (!serverUserId) return 'skip';

	const owner = localOwner ?? null;
	if (owner !== null && owner !== serverUserId) return 'switch';
	if (owner === serverUserId) return hasPendingMutations ? 'merge' : 'replace';

	// No owner yet (guest data). Merge to preserve it; then upload it on login.
	return hasLocalData ? 'merge' : 'replace';
}
