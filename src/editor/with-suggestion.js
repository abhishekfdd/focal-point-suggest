/**
 * WordPress dependencies
 */
import { InspectorControls } from '@wordpress/block-editor';
import { createHigherOrderComponent } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import SuggestionPanel from './suggestion-panel';

/**
 * Higher-order component that adds the focal point suggestion panel to the
 * Cover block's inspector when its background is an image.
 *
 * Applied through the `editor.BlockEdit` filter; every other block type is
 * passed through untouched.
 */
const withSuggestion = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		if ( props.name !== 'core/cover' ) {
			return <BlockEdit { ...props } />;
		}

		const { url, backgroundType, focalPoint, hasParallax, isRepeated } =
			props.attributes;
		const hasImage = 'image' === backgroundType && !! url;

		if ( ! hasImage ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				<BlockEdit { ...props } />
				<InspectorControls>
					<SuggestionPanel
						url={ url }
						focalPoint={ focalPoint }
						disabled={ !! hasParallax || !! isRepeated }
						onAccept={ ( point ) =>
							props.setAttributes( { focalPoint: point } )
						}
					/>
				</InspectorControls>
			</>
		);
	};
}, 'withFocalPointSuggestion' );

export default withSuggestion;
