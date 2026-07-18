/**
 * Attachment meta persistence for accepted focal points.
 *
 * A focal point accepted for an image is stored on the attachment
 * (`_fps_focal_point`), so the next time the same image is used —
 * possibly in a different post — the stored point can be offered
 * immediately instead of re-running inference.
 */

/**
 * WordPress dependencies
 */
import { store as coreStore } from '@wordpress/core-data';
import { dispatch, resolveSelect } from '@wordpress/data';

/**
 * Meta key registered in the plugin bootstrap.
 *
 * @type {string}
 */
export const META_KEY = '_fps_focal_point';

/**
 * Read the stored focal point for an attachment, if any.
 *
 * Failures (deleted attachment, missing permissions) resolve to `null`
 * so callers fall back to running inference.
 *
 * @param {number} attachmentId Attachment post ID.
 * @return {Promise<{x: number, y: number}|null>} Stored point or `null`.
 */
export async function getStoredFocalPoint( attachmentId ) {
	try {
		const media = await resolveSelect( coreStore ).getMedia( attachmentId );
		const point = media?.meta?.[ META_KEY ];

		if (
			point &&
			typeof point.x === 'number' &&
			typeof point.y === 'number'
		) {
			return { x: point.x, y: point.y };
		}
	} catch {
		// Fall through to null: treat unreadable meta as "nothing stored".
	}

	return null;
}

/**
 * Persist a focal point to the attachment's meta.
 *
 * @param {number}                 attachmentId Attachment post ID.
 * @param {{x: number, y: number}} point        Accepted focal point.
 * @return {Promise<void>} Resolves when saved; rejects on failure.
 */
export async function saveStoredFocalPoint( attachmentId, point ) {
	await dispatch( coreStore ).saveEntityRecord( 'root', 'media', {
		id: attachmentId,
		meta: { [ META_KEY ]: point },
	} );
}
