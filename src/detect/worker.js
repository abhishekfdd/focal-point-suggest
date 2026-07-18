/**
 * Face detection Web Worker.
 *
 * Runs MediaPipe's FaceDetector (WASM backend, CPU delegate) off the
 * main thread, rendering into an OffscreenCanvas. The WASM runtime and
 * the model are fetched through the Cache API, so repeat runs skip the
 * network entirely.
 *
 * Protocol (worker <- main):
 *   { type: 'init', wasmUrl, modelUrl }
 *   { type: 'detect', id, bitmap }        // bitmap is transferred
 *
 * Protocol (worker -> main):
 *   { type: 'result', id, detections }    // [ { box, confidence } ]
 *   { type: 'error', id, code }           // code mapped to i18n on main
 *
 * No @wordpress/* imports here: those packages are externalized to
 * window globals, which do not exist in a worker scope.
 */

/**
 * External dependencies
 */
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const CACHE_NAME = 'focal-point-suggest-assets-v1';

let config = null;
let detectorPromise = null;

/**
 * Fetch a URL through the Cache API when available.
 *
 * Falls back to a plain network fetch if the Cache API is unavailable
 * or errors (e.g. storage pressure); caching is an optimization, never
 * a requirement.
 *
 * @param {string} url Asset URL, same-origin.
 * @return {Promise<Response>} The response.
 */
async function cachedFetch( url ) {
	if ( typeof caches === 'undefined' ) {
		return fetch( url );
	}

	try {
		const cache = await caches.open( CACHE_NAME );
		const hit = await cache.match( url );

		if ( hit ) {
			return hit;
		}

		const response = await fetch( url );

		if ( response.ok ) {
			await cache.put( url, response.clone() );
		}

		return response;
	} catch {
		return fetch( url );
	}
}

/**
 * Read a response or throw with the asset URL for context.
 *
 * @param {Response} response Fetch response.
 * @param {string}   url      Requested URL.
 * @return {Response} The same response.
 */
function assertOk( response, url ) {
	if ( ! response.ok ) {
		throw new Error(
			`Failed to load ${ url } (HTTP ${ response.status })`
		);
	}
	return response;
}

/**
 * Create the MediaPipe face detector from same-origin, cached assets.
 *
 * Instead of letting FilesetResolver fetch by URL, the WASM loader and
 * binary are pulled through the Cache API and handed over as blob URLs,
 * and the model is passed as an in-memory buffer.
 *
 * @return {Promise<FaceDetector>} Ready-to-use detector.
 */
async function createDetector() {
	const simd = await FilesetResolver.isSimdSupported();
	const wasmBase = simd
		? 'vision_wasm_internal'
		: 'vision_wasm_nosimd_internal';

	const [ loader, binary, model ] = await Promise.all( [
		cachedFetch( `${ config.wasmUrl }${ wasmBase }.js` ),
		cachedFetch( `${ config.wasmUrl }${ wasmBase }.wasm` ),
		cachedFetch( config.modelUrl ),
	] );

	assertOk( loader, `${ config.wasmUrl }${ wasmBase }.js` );
	assertOk( binary, `${ config.wasmUrl }${ wasmBase }.wasm` );
	assertOk( model, config.modelUrl );

	const fileset = {
		wasmLoaderPath: URL.createObjectURL( await loader.blob() ),
		wasmBinaryPath: URL.createObjectURL( await binary.blob() ),
	};

	return FaceDetector.createFromOptions( fileset, {
		baseOptions: {
			modelAssetBuffer: new Uint8Array( await model.arrayBuffer() ),
			delegate: 'CPU',
		},
		canvas: new OffscreenCanvas( 1, 1 ),
		runningMode: 'IMAGE',
	} );
}

/**
 * Lazily create (and reuse) the detector.
 *
 * @return {Promise<FaceDetector>} Ready-to-use detector.
 */
function getDetector() {
	if ( ! detectorPromise ) {
		detectorPromise = createDetector().catch( ( error ) => {
			// Allow a retry on the next request instead of caching failure.
			detectorPromise = null;
			throw error;
		} );
	}
	return detectorPromise;
}

/**
 * Map MediaPipe detections to the internal { box, confidence } shape.
 *
 * @param {Object} result FaceDetector result.
 * @return {Array<{box: Object, confidence: number}>} Normalized detections.
 */
function mapDetections( result ) {
	return ( result?.detections || [] )
		.filter( ( detection ) => detection.boundingBox )
		.map( ( detection ) => ( {
			box: {
				x: detection.boundingBox.originX,
				y: detection.boundingBox.originY,
				width: detection.boundingBox.width,
				height: detection.boundingBox.height,
			},
			confidence: detection.categories?.[ 0 ]?.score ?? 0,
		} ) );
}

self.onmessage = async ( event ) => {
	const message = event.data || {};

	if ( 'init' === message.type ) {
		config = { wasmUrl: message.wasmUrl, modelUrl: message.modelUrl };
		return;
	}

	if ( 'detect' !== message.type ) {
		return;
	}

	const { id, bitmap } = message;

	if ( ! config ) {
		self.postMessage( { type: 'error', id, code: 'not-initialized' } );
		return;
	}

	let detector;

	try {
		detector = await getDetector();
	} catch {
		self.postMessage( { type: 'error', id, code: 'model-load-failed' } );
		return;
	}

	try {
		const result = detector.detect( bitmap );
		self.postMessage( {
			type: 'result',
			id,
			detections: mapDetections( result ),
		} );
	} catch {
		self.postMessage( { type: 'error', id, code: 'detection-failed' } );
	} finally {
		bitmap.close();
	}
};
