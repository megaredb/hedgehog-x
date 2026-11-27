export interface ChapterIllustrationTiming {
	chapterId: string;
	illustrationId: string;
	showAtSeconds: number;
}

/** Chapters an illustration belongs to. Illustrations without timing are volume-level. */
export function illustrationChapterIds(
	illustrationId: string,
	timings: ChapterIllustrationTiming[]
): string[] {
	const ids = new Set<string>();
	for (const timing of timings) {
		if (timing.illustrationId === illustrationId) ids.add(timing.chapterId);
	}
	return [...ids];
}

/**
 * A chapter illustration is hidden until at least one related chapter has
 * actually been started. Volume-level art has no chapter and is not locked by
 * this rule.
 */
export function isIllustrationChapterLocked(
	illustrationId: string,
	timings: ChapterIllustrationTiming[],
	playedChapterIds: ReadonlySet<string>
): boolean {
	const chapterIds = illustrationChapterIds(illustrationId, timings);
	return chapterIds.length > 0 && !chapterIds.some((chapterId) => playedChapterIds.has(chapterId));
}
