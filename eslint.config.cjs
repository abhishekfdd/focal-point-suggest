const globals = require( 'globals' );

const defaultConfig = require( '@wordpress/scripts/config/eslint.config.cjs' );

module.exports = [
	...defaultConfig,
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
		},
	},
	{
		files: [ 'src/detect/worker.js' ],
		languageOptions: {
			globals: {
				...globals.worker,
			},
		},
	},
];
