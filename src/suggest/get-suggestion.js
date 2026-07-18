/**
 * Suggestion source.
 *
 * This module is the single entry point the editor UI uses to obtain a
 * focal point suggestion. It currently returns a fixed point; the real
 * detection pipeline (Web Worker + WASM face detection + heuristic)
 * replaces the body of `getSuggestion()` without changing its contract.
 */

/**
 * Suggest a focal point for an image.
 *
 * @param {string} url Image URL to analyze.
 * @return {Promise<{x: number, y: number}|null>} Normalized focal point in
 *   the 0–1 range, or `null` when no clear subject is found.
 */
// eslint-disable-next-line no-unused-vars -- `url` is part of the stable contract.
export async function getSuggestion( url ) {
	return { x: 0.5, y: 0.33 };
}
