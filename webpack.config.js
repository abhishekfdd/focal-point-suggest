/**
 * Extends the default @wordpress/scripts webpack config to copy the
 * MediaPipe WASM runtime and the bundled face detection model into the
 * build directory, so all inference assets are served same-origin.
 */
const CopyPlugin = require( 'copy-webpack-plugin' );

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	plugins: [
		...defaultConfig.plugins,
		new CopyPlugin( {
			patterns: [
				{
					from: 'node_modules/@mediapipe/tasks-vision/wasm',
					to: 'wasm',
					globOptions: {
						// Only the classic-worker runtimes are used; see
						// src/detect/worker.js.
						ignore: [ '**/vision_wasm_module_internal.*' ],
					},
				},
				{
					from: 'assets/models',
					to: 'models',
				},
			],
		} ),
	],
};
