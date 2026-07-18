/**
 * Internal dependencies
 */
import { suggestFocalPoint, MIN_CONFIDENCE } from '../focal-point';

const IMAGE = { width: 1000, height: 500 };

const face = ( x, y, width, height, confidence = 0.9 ) => ( {
	box: { x, y, width, height },
	confidence,
} );

describe( 'suggestFocalPoint', () => {
	it( 'returns null when there are no detections', () => {
		expect( suggestFocalPoint( [], IMAGE ) ).toBeNull();
		expect( suggestFocalPoint( undefined, IMAGE ) ).toBeNull();
	} );

	it( 'returns null when every detection is below the confidence threshold', () => {
		const detections = [
			face( 100, 100, 200, 200, 0.49 ),
			face( 600, 100, 100, 100, 0.2 ),
		];
		expect( suggestFocalPoint( detections, IMAGE ) ).toBeNull();
	} );

	it( 'keeps detections exactly at the confidence threshold', () => {
		const detections = [ face( 400, 100, 200, 300, MIN_CONFIDENCE ) ];
		expect( suggestFocalPoint( detections, IMAGE ) ).not.toBeNull();
	} );

	it( 'returns null for a degenerate image size', () => {
		const detections = [ face( 0, 0, 10, 10 ) ];
		expect(
			suggestFocalPoint( detections, { width: 0, height: 0 } )
		).toBeNull();
	} );

	it( 'anchors a single face at its horizontal center and eye line', () => {
		// Box centered at x = 500; eye line at 100 + 300 / 3 = 200.
		const detections = [ face( 400, 100, 200, 300 ) ];
		expect( suggestFocalPoint( detections, IMAGE ) ).toEqual( {
			x: 0.5,
			y: 0.4,
		} );
	} );

	it( 'ignores low-confidence detections next to a confident face', () => {
		const detections = [
			face( 400, 100, 200, 300, 0.95 ),
			face( 0, 0, 400, 400, 0.3 ),
		];
		expect( suggestFocalPoint( detections, IMAGE ) ).toEqual( {
			x: 0.5,
			y: 0.4,
		} );
	} );

	it( 'lands midway between two equal faces', () => {
		const detections = [
			face( 100, 100, 100, 100 ),
			face( 800, 100, 100, 100 ),
		];
		// Anchors at x = 150 and x = 850 with equal weights → x = 500.
		// Both eye lines at y = 100 + 100 / 3 ≈ 133.3 → y ≈ 0.27.
		expect( suggestFocalPoint( detections, IMAGE ) ).toEqual( {
			x: 0.5,
			y: 0.27,
		} );
	} );

	it( 'pulls the point toward a dominant face', () => {
		// Worked example from docs/heuristic.md.
		const detections = [
			face( 100, 100, 200, 200 ), // weight 40 000, anchor (200, 166.7)
			face( 700, 150, 100, 100 ), // weight 10 000, anchor (750, 183.3)
		];
		const point = suggestFocalPoint( detections, IMAGE );
		expect( point ).toEqual( { x: 0.31, y: 0.34 } );

		// Sanity: much closer to the dominant face's anchor (x = 0.2)
		// than to the small face's (x = 0.75).
		expect( point.x ).toBeLessThan( 0.475 );
	} );

	it( 'keeps the multi-face point inside the bounding union of the boxes', () => {
		const detections = [
			face( 100, 50, 150, 150 ),
			face( 750, 300, 150, 150 ),
			face( 400, 100, 50, 50 ),
		];
		const union = {
			minX: 100 / IMAGE.width,
			maxX: 900 / IMAGE.width,
			minY: 50 / IMAGE.height,
			maxY: 450 / IMAGE.height,
		};
		const point = suggestFocalPoint( detections, IMAGE );
		expect( point.x ).toBeGreaterThanOrEqual( union.minX );
		expect( point.x ).toBeLessThanOrEqual( union.maxX );
		expect( point.y ).toBeGreaterThanOrEqual( union.minY );
		expect( point.y ).toBeLessThanOrEqual( union.maxY );
	} );

	it( 'clamps boxes that extend past the image edge into the 0–1 range', () => {
		// Detectors may report boxes partially out of frame; the anchor
		// of this one sits above the top edge.
		const detections = [ face( -100, -90, 200, 90 ) ];
		expect( suggestFocalPoint( detections, IMAGE ) ).toEqual( {
			x: 0,
			y: 0,
		} );
	} );

	it( 'rounds coordinates to two decimals', () => {
		const detections = [ face( 0, 0, 100, 100 ) ];
		// Anchor (50, 33.33) → { x: 0.05, y: 0.0667 } → rounded 0.07.
		expect( suggestFocalPoint( detections, IMAGE ) ).toEqual( {
			x: 0.05,
			y: 0.07,
		} );
	} );
} );
