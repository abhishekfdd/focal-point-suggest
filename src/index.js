/**
 * Focal Point Suggest — editor entry point.
 *
 * Extends the core Cover block with a focal point suggestion panel via
 * the `editor.BlockEdit` filter.
 */

/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import withSuggestion from './editor/with-suggestion';
import './editor.scss';

addFilter(
	'editor.BlockEdit',
	'focal-point-suggest/with-suggestion',
	withSuggestion
);
