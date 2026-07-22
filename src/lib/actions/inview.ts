/**
 * Svelte Action to detect when an element intersects with the viewport
 * and is considered "in view" (e.g. >= 50% visible).
 */
export function inview(node: HTMLElement, callback: (isVisible: boolean) => void) {
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					callback(true);
				}
			});
		},
		{
			root: null,
			rootMargin: '0px',
			threshold: 0.5 // Trigger when at least 50% of the element is visible
		}
	);

	observer.observe(node);

	return {
		destroy() {
			observer.unobserve(node);
			observer.disconnect();
		}
	};
}
