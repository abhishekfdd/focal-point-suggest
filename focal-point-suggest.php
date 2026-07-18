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
 * Sanitize a focal point meta value.
 *
 * Coordinates are cast to float, clamped to the 0–1 range, and rounded
 * to two decimals. Anything malformed collapses to an empty array so
 * invalid data is never stored.
 *
 * @param mixed $value Raw meta value.
 * @return array Sanitized `{ x, y }` pair, or an empty array.
 */
function sanitize_focal_point( $value ): array {
	if ( ! is_array( $value ) || ! isset( $value['x'], $value['y'] ) ) {
		return array();
	}

	if ( ! is_numeric( $value['x'] ) || ! is_numeric( $value['y'] ) ) {
		return array();
	}

	return array(
		'x' => round( min( 1.0, max( 0.0, (float) $value['x'] ) ), 2 ),
		'y' => round( min( 1.0, max( 0.0, (float) $value['y'] ) ), 2 ),
	);
}

/**
 * Register the focal point meta on attachments.
 *
 * Stored per attachment so a focal point computed once can be offered
 * again wherever the same image is used, without re-running inference.
 *
 * @return void
 */
function register_focal_point_meta(): void {
	register_post_meta(
		'attachment',
		'_fps_focal_point',
		array(
			'type'              => 'object',
			'single'            => true,
			'sanitize_callback' => __NAMESPACE__ . '\\sanitize_focal_point',
			'auth_callback'     => static function ( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'edit_post', $post_id );
			},
			'show_in_rest'      => array(
				'schema' => array(
					'type'                 => 'object',
					'properties'           => array(
						'x' => array(
							'type'    => 'number',
							'minimum' => 0,
							'maximum' => 1,
						),
						'y' => array(
							'type'    => 'number',
							'minimum' => 0,
							'maximum' => 1,
						),
					),
					'additionalProperties' => false,
				),
			),
		)
	);
}
add_action( 'init', __NAMESPACE__ . '\\register_focal_point_meta' );

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
