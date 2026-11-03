import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	return {
		bookId: params.bookId,
		volumeId: params.volumeId
	};
};
