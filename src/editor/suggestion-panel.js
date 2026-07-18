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
import {
	getStoredFocalPoint,
	saveStoredFocalPoint,
} from '../meta/attachment-focal-point';
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
 * When the image is a media library attachment, a previously accepted
 * point stored in its meta is offered first, with re-analysis one click
 * away; accepting a freshly computed point stores it for next time.
 *
 * @param {Object}   props
 * @param {string}   props.url          Background image URL.
 * @param {number}   props.attachmentId Attachment ID, if the image comes
 *                                      from the media library.
 * @param {Object}   props.focalPoint   Current `focalPoint` attribute, if any.
 * @param {boolean}  props.disabled     Whether suggesting is unavailable
 *                                      (e.g. fixed/repeated backgrounds).
 * @param {Function} props.onAccept     Called with the accepted point.
 */
export default function SuggestionPanel( {
	url,
	attachmentId,
	focalPoint,
	disabled,
	onAccept,
} ) {
	// idle | loading | ready | empty | error
	const [ status, setStatus ] = useState( 'idle' );
	// fresh (computed now) | stored (read from attachment meta)
	const [ source, setSource ] = useState( 'fresh' );
	const [ suggestion, setSuggestion ] = useState( null );
	const [ errorMessage, setErrorMessage ] = useState( '' );
	const [ needsConfirm, setNeedsConfirm ] = useState( false );
	const [ persistFailed, setPersistFailed ] = useState( false );

	const reset = () => {
		setStatus( 'idle' );
		setSource( 'fresh' );
		setSuggestion( null );
		setErrorMessage( '' );
		setNeedsConfirm( false );
	};

	const analyze = async () => {
		setStatus( 'loading' );
		setNeedsConfirm( false );
		try {
			const point = await getSuggestion( url );
			if ( ! point ) {
				setStatus( 'empty' );
				return;
			}
			setSuggestion( roundPoint( point ) );
			setSource( 'fresh' );
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

	const handleSuggest = async () => {
		setPersistFailed( false );

		// Offer the point stored on the attachment before running
		// inference again.
		if ( attachmentId ) {
			setStatus( 'loading' );
			const stored = await getStoredFocalPoint( attachmentId );
			if ( stored ) {
				setSuggestion( roundPoint( stored ) );
				setSource( 'stored' );
				setStatus( 'ready' );
				setNeedsConfirm( false );
				return;
			}
		}

		await analyze();
	};

	const applySuggestion = () => {
		const point = roundPoint( suggestion );
		onAccept( point );

		// Persist freshly computed points (or stored ones the user
		// adjusted) so the attachment offers them next time.
		if ( attachmentId ) {
			saveStoredFocalPoint( attachmentId, point ).catch( () => {
				setPersistFailed( true );
			} );
		}

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
					{ persistFailed && (
						<Notice status="warning" isDismissible={ false }>
							{ __(
								'The focal point was applied to the block, but saving it to the media library failed.',
								'focal-point-suggest'
							) }
						</Notice>
					) }
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
						onClick={ analyze }
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
						onClick={ analyze }
						className="focal-point-suggest-panel__retry"
					>
						{ __( 'Try again', 'focal-point-suggest' ) }
					</Button>
				</>
			) }

			{ status === 'ready' && suggestion && (
				<>
					<p className="focal-point-suggest-panel__help">
						{ source === 'stored'
							? __(
									'A focal point saved earlier for this image. Accept it, adjust it, or re-analyze.',
									'focal-point-suggest'
							  )
							: __(
									'Suggested focal point. Drag the point to adjust it before accepting.',
									'focal-point-suggest'
							  ) }
					</p>
					<FocalPointPicker
						url={ url }
						value={ suggestion }
						onChange={ ( point ) => {
							setSuggestion( {
								x: Number( point.x ),
								y: Number( point.y ),
							} );
							// An adjusted stored point is a new point;
							// persist it again on accept.
							setSource( 'fresh' );
						} }
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
						{ source === 'stored' && (
							<FlexItem>
								<Button variant="secondary" onClick={ analyze }>
									{ __(
										'Re-analyze',
										'focal-point-suggest'
									) }
								</Button>
							</FlexItem>
						) }
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
