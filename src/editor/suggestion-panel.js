/**
 * WordPress dependencies
 */
import {
	Button,
	FocalPointPicker,
	Flex,
	FlexItem,
	Notice,
	PanelBody,
	Spinner,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getSuggestion } from '../suggest/get-suggestion';

/**
 * Round a focal point to two decimals.
 *
 * @param {{x: number, y: number}} point Focal point.
 * @return {{x: number, y: number}} Rounded focal point.
 */
function roundPoint( point ) {
	return {
		x: Math.round( point.x * 100 ) / 100,
		y: Math.round( point.y * 100 ) / 100,
	};
}

/**
 * Inspector panel that suggests a focal point for the Cover image.
 *
 * The suggestion lives in local state until the user accepts it; only
 * then is the block's `focalPoint` attribute written. An existing focal
 * point is never overwritten without an explicit confirmation step.
 *
 * @param {Object}   props
 * @param {string}   props.url        Background image URL.
 * @param {Object}   props.focalPoint Current `focalPoint` attribute, if any.
 * @param {boolean}  props.disabled   Whether suggesting is unavailable
 *                                    (e.g. fixed/repeated backgrounds).
 * @param {Function} props.onAccept   Called with the accepted point.
 */
export default function SuggestionPanel( {
	url,
	focalPoint,
	disabled,
	onAccept,
} ) {
	// idle | loading | ready | empty | error
	const [ status, setStatus ] = useState( 'idle' );
	const [ suggestion, setSuggestion ] = useState( null );
	const [ errorMessage, setErrorMessage ] = useState( '' );
	const [ needsConfirm, setNeedsConfirm ] = useState( false );

	const reset = () => {
		setStatus( 'idle' );
		setSuggestion( null );
		setErrorMessage( '' );
		setNeedsConfirm( false );
	};

	const handleSuggest = async () => {
		setStatus( 'loading' );
		setNeedsConfirm( false );
		try {
			const point = await getSuggestion( url );
			if ( ! point ) {
				setStatus( 'empty' );
				return;
			}
			setSuggestion( roundPoint( point ) );
			setStatus( 'ready' );
		} catch ( error ) {
			setErrorMessage(
				error?.message ||
					__(
						'The image could not be analyzed.',
						'focal-point-suggest'
					)
			);
			setStatus( 'error' );
		}
	};

	const applySuggestion = () => {
		onAccept( roundPoint( suggestion ) );
		reset();
	};

	const handleAccept = () => {
		// Confirm before replacing a focal point that is already set.
		if ( focalPoint && ! needsConfirm ) {
			setNeedsConfirm( true );
			return;
		}
		applySuggestion();
	};

	return (
		<PanelBody
			title={ __( 'Focal point suggestion', 'focal-point-suggest' ) }
			initialOpen
			className="focal-point-suggest-panel"
		>
			{ disabled && (
				<p className="focal-point-suggest-panel__help">
					{ __(
						'Focal point is not available for fixed or repeated backgrounds.',
						'focal-point-suggest'
					) }
				</p>
			) }

			{ ! disabled && status === 'idle' && (
				<>
					<p className="focal-point-suggest-panel__help">
						{ __(
							'Detect faces in the image and suggest a focal point that keeps them in view. Detection runs entirely in your browser.',
							'focal-point-suggest'
						) }
					</p>
					<Button variant="secondary" onClick={ handleSuggest }>
						{ __( 'Suggest focal point', 'focal-point-suggest' ) }
					</Button>
				</>
			) }

			{ status === 'loading' && (
				<Flex justify="flex-start" align="center" gap={ 2 }>
					<FlexItem>
						<Spinner />
					</FlexItem>
					<FlexItem>
						{ __( 'Analyzing image…', 'focal-point-suggest' ) }
					</FlexItem>
				</Flex>
			) }

			{ status === 'empty' && (
				<>
					<Notice status="info" isDismissible={ false }>
						{ __(
							'No clear subject found. The focal point was left unchanged.',
							'focal-point-suggest'
						) }
					</Notice>
					<Button
						variant="secondary"
						onClick={ handleSuggest }
						className="focal-point-suggest-panel__retry"
					>
						{ __( 'Try again', 'focal-point-suggest' ) }
					</Button>
				</>
			) }

			{ status === 'error' && (
				<>
					<Notice status="warning" isDismissible={ false }>
						{ errorMessage }
					</Notice>
					<Button
						variant="secondary"
						onClick={ handleSuggest }
						className="focal-point-suggest-panel__retry"
					>
						{ __( 'Try again', 'focal-point-suggest' ) }
					</Button>
				</>
			) }

			{ status === 'ready' && suggestion && (
				<>
					<p className="focal-point-suggest-panel__help">
						{ __(
							'Suggested focal point. Drag the point to adjust it before accepting.',
							'focal-point-suggest'
						) }
					</p>
					<FocalPointPicker
						url={ url }
						value={ suggestion }
						onChange={ ( point ) =>
							setSuggestion( {
								x: Number( point.x ),
								y: Number( point.y ),
							} )
						}
					/>
					{ needsConfirm && (
						<Notice status="warning" isDismissible={ false }>
							{ __(
								'This block already has a focal point. Accepting will replace it.',
								'focal-point-suggest'
							) }
						</Notice>
					) }
					<Flex justify="flex-start" gap={ 2 }>
						<FlexItem>
							<Button variant="primary" onClick={ handleAccept }>
								{ needsConfirm
									? __(
											'Replace focal point',
											'focal-point-suggest'
									  )
									: __( 'Accept', 'focal-point-suggest' ) }
							</Button>
						</FlexItem>
						<FlexItem>
							<Button variant="tertiary" onClick={ reset }>
								{ __( 'Reject', 'focal-point-suggest' ) }
							</Button>
						</FlexItem>
					</Flex>
				</>
			) }
		</PanelBody>
	);
}
