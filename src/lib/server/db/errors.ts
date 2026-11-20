/** Detects a PostgreSQL unique-constraint violation without leaking driver types. */
export function isUniqueViolation(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const err = error as { code?: unknown; cause?: unknown; errors?: unknown };
	if (err.code === '23505') return true;
	if (Array.isArray(err.errors)) return err.errors.some(isUniqueViolation);
	return isUniqueViolation(err.cause);
}
