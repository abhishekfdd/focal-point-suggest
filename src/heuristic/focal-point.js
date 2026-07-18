/**
 * Focal point heuristic.
 *
 * Pure module: no DOM, no WASM, no WordPress imports. Given face
 * detections in image pixel space, it computes a normalized focal point
 * suitable for the Cover block's `focalPoint` attribute.
 *
 * See docs/heuristic.md for the plain-English explanation of the rules.
 */

/**
 * Detections below this confidence are ignored entirely.
 *
 * @type {number}
 */
export const MIN_CONFIDENCE = 0.5;

/**
 * Clamp a number to an inclusive range.
 *
 * @param {number} value Value to clamp.
 * @param {number} min   Lower bound.
 * @param {number} max   Upper bound.
 * @return {number} Clamped value.
 */
function clamp( value, min, max ) {
	return Math.min( max, Math.max( min, value ) );
}

/**
 * Round to two decimals.
 *
 * @param {number} value Value to round.
 * @return {number} Rounded value.
 */
function round2( value ) {
	return Math.round( value * 100 ) / 100;
}

/**
 * Focal point of a single face box, in pixel space.
 *
 * Horizontally the point sits at the center of the box. Vertically it
 * sits one third down from the top of the box, which approximates the
 * eye line and reads better than the geometric center when the image is
 * cropped tightly.
 *
 * @param {{x: number, y: number, width: number, height: number}} box Face box.
 * @return {{x: number, y: number}} Point in pixels.
 */
function faceAnchor( box ) {
	return {
		x: box.x + box.width / 2,
		y: box.y + box.height / 3,
	};
}

/**
 * Suggest a focal point from face detections.
 *
 * @param {Array<{box: {x: number, y: number, width: number, height: number}, confidence: number}>} detections
 *                                                                                                             Detected subjects in image pixel space.
 * @param {{width: number, height: number}}                                                         imageSize  Dimensions of the
 *                                                                                                             analyzed image in pixels.
 * @return {{x: number, y: number}|null} Normalized focal point with both
 *   coordinates in the 0–1 range rounded to two decimals, or `null` when
 *   no detection clears the confidence threshold.
 */
export function suggestFocalPoint( detections, imageSize ) {
	const { width, height } = imageSize;

	if ( ! width || ! height ) {
		return null;
	}

	const faces = ( detections || [] ).filter(
		( { confidence } ) => confidence >= MIN_CONFIDENCE
	);

	if ( faces.length === 0 ) {
		return null;
	}

	let point;

	if ( faces.length === 1 ) {
		point = faceAnchor( faces[ 0 ].box );
	} else {
		// Centroid of the per-face anchors, weighted by box area, so a
		// large foreground face pulls the point more than a distant one.
		let totalWeight = 0;
		let sumX = 0;
		let sumY = 0;

		for ( const { box } of faces ) {
			const weight = box.width * box.height;
			const anchor = faceAnchor( box );
			totalWeight += weight;
			sumX += anchor.x * weight;
			sumY += anchor.y * weight;
		}

		point = { x: sumX / totalWeight, y: sumY / totalWeight };

		// Clamp to the bounding union of all boxes so the point never
		// lands in empty space between people.
		const union = faces.reduce(
			( acc, { box } ) => ( {
				minX: Math.min( acc.minX, box.x ),
				minY: Math.min( acc.minY, box.y ),
				maxX: Math.max( acc.maxX, box.x + box.width ),
				maxY: Math.max( acc.maxY, box.y + box.height ),
			} ),
			{
				minX: Infinity,
				minY: Infinity,
				maxX: -Infinity,
				maxY: -Infinity,
			}
		);

		point.x = clamp( point.x, union.minX, union.maxX );
		point.y = clamp( point.y, union.minY, union.maxY );
	}

	return {
		x: round2( clamp( point.x / width, 0, 1 ) ),
		y: round2( clamp( point.y / height, 0, 1 ) ),
	};
}
