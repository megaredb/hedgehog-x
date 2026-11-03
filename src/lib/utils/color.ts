/**
 * Extracts average color from an image using offscreen Canvas.
 * Returns RGB components, HEX string, and ready-to-use CSS rgbString.
 */
export interface ExtractedColor {
	r: number;
	g: number;
	b: number;
	hex: string;
	rgbString: string;
}

const colorCache = new Map<string, ExtractedColor>();

export async function extractAverageColor(
	imageSrc: string | null | undefined
): Promise<ExtractedColor> {
	if (!imageSrc) {
		return { r: 59, g: 130, b: 246, hex: '#3b82f6', rgbString: '59 130 246' };
	}

	if (colorCache.has(imageSrc)) {
		return colorCache.get(imageSrc)!;
	}

	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';

		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				if (!ctx) {
					throw new Error('Canvas context not available');
				}

				const sampleSize = 16;
				canvas.width = sampleSize;
				canvas.height = sampleSize;

				ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
				const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

				let totalR = 0;
				let totalG = 0;
				let totalB = 0;
				let count = 0;

				for (let i = 0; i < imageData.length; i += 4) {
					const a = imageData[i + 3];
					if (a < 128) continue; // Skip semi-transparent pixels

					totalR += imageData[i];
					totalG += imageData[i + 1];
					totalB += imageData[i + 2];
					count++;
				}

				if (count === 0) {
					throw new Error('No opaque pixels');
				}

				const r = Math.round(totalR / count);
				const g = Math.round(totalG / count);
				const b = Math.round(totalB / count);

				const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
				const result: ExtractedColor = {
					r,
					g,
					b,
					hex,
					rgbString: `${r} ${g} ${b}`
				};

				colorCache.set(imageSrc, result);
				resolve(result);
			} catch {
				const fallback: ExtractedColor = {
					r: 59,
					g: 130,
					b: 246,
					hex: '#3b82f6',
					rgbString: '59 130 246'
				};
				resolve(fallback);
			}
		};

		img.onerror = () => {
			const fallback: ExtractedColor = {
				r: 59,
				g: 130,
				b: 246,
				hex: '#3b82f6',
				rgbString: '59 130 246'
			};
			resolve(fallback);
		};

		img.src = imageSrc;
	});
}
