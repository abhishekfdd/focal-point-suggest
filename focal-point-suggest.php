<?php
/**
 * Plugin Name:       Focal Point Suggest
 * Plugin URI:        https://github.com/abhishekfdd/focal-point-suggest
 * Description:       Suggests a focal point for Cover block images by detecting faces locally in the browser. Never crop out a face again.
 * Version:           0.1.0
 * Requires at least: 7.0
 * Requires PHP:      8.3
 * Author:            Abhishek Kumar
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       focal-point-suggest
 *
 * @package FocalPointSuggest
 */

namespace FocalPointSuggest;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const VERSION = '0.1.0';

/**
 * Absolute path to the plugin directory, with trailing slash.
 *
 * @return string
 */
function plugin_dir(): string {
	return plugin_dir_path( __FILE__ );
}

/**
 * URL of the plugin directory, with trailing slash.
 *
 * @return string
 */
function plugin_url(): string {
	return plugin_dir_url( __FILE__ );
}

/**
 * Enqueue the editor script in the block editor only.
 *
 * The `enqueue_block_editor_assets` hook fires exclusively inside the block
 * editor, so no additional screen checks are needed.
 *
 * @return void
 */
function enqueue_editor_assets(): void {
	$asset_file = plugin_dir() . 'build/index.asset.php';

	if ( ! file_exists( $asset_file ) ) {
		return;
	}

	$asset = require $asset_file;

	wp_enqueue_script(
		'focal-point-suggest-editor',
		plugin_url() . 'build/index.js',
		$asset['dependencies'],
		$asset['version'],
		true
	);

	wp_set_script_translations( 'focal-point-suggest-editor', 'focal-point-suggest' );

	wp_add_inline_script(
		'focal-point-suggest-editor',
		sprintf(
			'window.focalPointSuggestSettings = %s;',
			wp_json_encode(
				array(
					'assetsUrl' => esc_url_raw( plugin_url() . 'build/' ),
				)
			)
		),
		'before'
	);

	$style_file = plugin_dir() . 'build/index.css';

	if ( file_exists( $style_file ) ) {
		wp_enqueue_style(
			'focal-point-suggest-editor',
			plugin_url() . 'build/index.css',
			array(),
			$asset['version']
		);
	}
}
add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_editor_assets' );

/**
 * Warn administrators when the plugin is active but not built.
 *
 * @return void
 */
function maybe_show_build_notice(): void {
	if ( ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	if ( file_exists( plugin_dir() . 'build/index.asset.php' ) ) {
		return;
	}

	printf(
		'<div class="notice notice-warning"><p>%s</p></div>',
		esc_html__( 'Focal Point Suggest: build files are missing. Run "npm install && npm run build" in the plugin directory.', 'focal-point-suggest' )
	);
}
add_action( 'admin_notices', __NAMESPACE__ . '\\maybe_show_build_notice' );
