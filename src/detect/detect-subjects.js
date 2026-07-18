/**
 * Main-thread interface to the face detection worker.
 *
 * `detectSubjects( imageBitmap )` is the internal detection contract:
 * it resolves to an array of `{ box, confidence }` in image pixel
 * space. The MediaPipe face detector behind it can be swapped for a
 * saliency model later without touching any caller.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const MODEL_FILE = 'models/blaze_face_short_range.tflite';

let worker = null;
let requestId = 0;
const pending = new Map();

/**
 * Human-readable message for a worker error code.
 *
 * Translation happens here rather than in the worker because the
 * i18n runtime only exists on the main thread.
 *
 * @param {string} code Error code from the worker.
 * @return {string} Translated message.
 */
function messageForCode( code ) {
	switch ( code ) {
		case 'model-load-failed':
			return __(
				'The face detection model could not be loaded. Make sure the plugin is built (npm run build) and try again.',
				'focal-point-suggest'
			);
		default:
			return __(
				'Face detection failed unexpectedly. Please try again.',
				'focal-point-suggest'
			);
	}
}

/**
 * Reject every in-flight request, e.g. when the worker crashes.
 *
 * @param {string} message Rejection message.
 */
function rejectAll( message ) {
	for ( const request of pending.values() ) {
		request.reject( new Error( message ) );
	}
	pending.clear();
}

/**
 * Lazily create the shared detection worker.
 *
 * @return {Worker} The detection worker.
 */
function getWorker() {
	if ( worker ) {
		return worker;
	}

	worker = new Worker( new URL( './worker.js', import.meta.url ) );

	worker.onmessage = ( event ) => {
		const { type, id, detections, code } = event.data || {};
		const request = pending.get( id );

		if ( ! request ) {
			return;
		}

		pending.delete( id );

		if ( 'result' === type ) {
			request.resolve( detections );
		} else {
			request.reject( new Error( messageForCode( code ) ) );
		}
	};

	worker.onerror = () => {
		rejectAll( messageForCode( 'worker-crashed' ) );
	};

	const settings = window.focalPointSuggestSettings || {};
	const assetsUrl = settings.assetsUrl || '';

	worker.postMessage( {
		type: 'init',
		wasmUrl: `${ assetsUrl }wasm/`,
		modelUrl: `${ assetsUrl }${ MODEL_FILE }`,
	} );

	return worker;
}

/**
 * Detect subjects (currently: faces) in an image.
 *
 * The bitmap is transferred to the worker and unusable afterwards —
 * read any dimensions you need before calling.
 *
 * @param {ImageBitmap} imageBitmap Decoded image.
 * @return {Promise<Array<{box: {x: number, y: number, width: number, height: number}, confidence: number}>>}
 *   Detections in image pixel space.
 */
export function detectSubjects( imageBitmap ) {
	return new Promise( ( resolve, reject ) => {
		requestId += 1;
		const id = requestId;
		pending.set( id, { resolve, reject } );

		getWorker().postMessage( { type: 'detect', id, bitmap: imageBitmap }, [
			imageBitmap,
		] );
	} );
}
