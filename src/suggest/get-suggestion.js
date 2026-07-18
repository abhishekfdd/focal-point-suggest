/**
 * Suggestion source.
 *
 * This module is the single entry point the editor UI uses to obtain a
 * focal point suggestion: fetch the image, detect subjects in a Web
 * Worker, and run the heuristic over the detections.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { detectSubjects } from '../detect/detect-subjects';
import { suggestFocalPoint } from '../heuristic/focal-point';

/**
 * Fetch and decode an image into an ImageBitmap.
 *
 * The image is requested without cross-origin credentials (the
 * equivalent of `crossorigin="anonymous"`), so pixel data stays
 * readable. Every failure mode maps to a human-readable message the
 * panel can display — never a silent failure.
 *
 * @param {string} url Image URL.
 * @return {Promise<ImageBitmap>} Decoded image.
 */
async function loadImageBitmap( url ) {
	let response;

	try {
		response = await fetch( url, {
			mode: 'cors',
			credentials: 'same-origin',
		} );
	} catch {
		throw new Error(
			__(
				'The image could not be read. If it is hosted on another domain, that server must allow cross-origin (CORS) access.',
				'focal-point-suggest'
			)
		);
	}

	if ( ! response.ok ) {
		throw new Error(
			__(
				'The image could not be downloaded. Check that the file still exists.',
				'focal-point-suggest'
			)
		);
	}

	try {
		return await createImageBitmap( await response.blob() );
	} catch {
		throw new Error(
			__(
				'This file could not be decoded as an image.',
				'focal-point-suggest'
			)
		);
	}
}

/**
 * Suggest a focal point for an image.
 *
 * @param {string} url Image URL to analyze.
 * @return {Promise<{x: number, y: number}|null>} Normalized focal point in
 *   the 0–1 range, or `null` when no clear subject is found.
 */
export async function getSuggestion( url ) {
	const bitmap = await loadImageBitmap( url );

	// The bitmap is transferred to the worker; capture dimensions first.
	const size = { width: bitmap.width, height: bitmap.height };

	const detections = await detectSubjects( bitmap );

	return suggestFocalPoint( detections, size );
}
