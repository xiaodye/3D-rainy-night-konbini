window.__M = {};
// ==== src/config.js ====
__M.config = {};
(function () {
'use strict';
const __THREE = window.THREE;
// ---------------------------------------------------------------------------
// Layout + palette for the rainy-night convenience-store diorama.
// Everything is authored in world units (1 unit ~= 1 meter) on a 26x26 base.
// ---------------------------------------------------------------------------

const BASE = {
  size: 26,
  half: 13,
  thickness: 1.25,
  bevel: 0.24,
  top: 0,
};

// --- streets -----------------------------------------------------------------
const STREET = {
  main: { z0: 4.6, z1: 11.0 }, // runs along X (east-west)
  side: { x0: -9.6, x1: -5.0 }, // narrow side street, runs along Z
  curbH: 0.15,
  curbW: 0.26,
};

const WALK = {
  southZ0: 11.0,
  southZ1: 13.0,
  northZ0: 3.0,
  northZ1: 4.6,
  sideW0: -5.0, // east sidewalk of the side street
  sideW1: -3.6,
  westW0: -13.0, // west sidewalk of the side street
  westW1: -9.6,
};

// --- store -------------------------------------------------------------------
const STORE = {
  x0: -1.0,
  x1: 8.4,
  z0: -9.2,
  z1: -0.6,
  h: 4.3,
  fascia0: 3.05,
  fascia1: 4.05,
  glassBase: 0.22,
  glassTop: 2.95,
  wallT: 0.24,
};

const FORECOURT = { x0: -3.6, x1: 13.0, z0: -0.6, z1: 3.0, y: 0.15 };

const ALLEY_E = { x0: 8.4, x1: 10.0, z0: -13.0, z1: -0.6 };
const NEIGHBOUR_E = { x0: 10.0, x1: 13.0, z0: -13.0, z1: -0.6, h: 7.4 };
const NEIGHBOUR_W = { x0: -13.0, x1: -9.6, z0: -13.0, z1: 4.6, h: 6.1 };

// --- palette -----------------------------------------------------------------
const c = (hex) => hex;
const COLORS = {
  // ground / structure
  asphalt: c(0x2b2f3b),
  asphaltDark: c(0x22252f),
  sidewalk: c(0x565b69),
  sidewalkDark: c(0x464b58),
  curb: c(0x6d7280),
  baseSide: c(0x1a1d27),
  baseTop: c(0x232733),
  paint: c(0xd8dbe2),

  // store exterior
  wall: c(0xd6d0c4),
  wallShade: c(0xb9b3a6),
  wallTrim: c(0x3a4050),
  fascia: c(0xf6f7fb),
  brand: c(0x2f6fe0),
  brandWarm: c(0xff8a3d),
  brandGreen: c(0x27b07a),
  metal: c(0x4a5162),
  metalDark: c(0x2c313d),
  glassTint: c(0x9fc6e8),

  // interior
  floorTile: c(0xd9d2c6),
  floorTile2: c(0xc9c2b6),
  shelf: c(0xe7e9ee),
  shelfEdge: c(0xb9bfcc),
  fridge: c(0xdff0ff),
  warmLight: c(0xfff0cf),
  counter: c(0xdcd6ca),

  // night lighting
  lampWarm: c(0xffcf8a),
  lampCool: c(0xa9c8ff),
  neonPink: c(0xff4f9a),
  neonCyan: c(0x4fdcff),
  neonAmber: c(0xffb347),
  signalRed: c(0xff5a4d),
  signalGreen: c(0x62e6a4),

  // misc props
  vendingRed: c(0xd93b3b),
  vendingBody: c(0xe8ecf2),
  bikeFrame: c(0x38414f),
  foliage: c(0x2f4a38),
  foliageLit: c(0x415e46),
  wood: c(0x7a6350),
  dirt: c(0x4a4550),
};

const OUTLINE = { color: 0x0a0c14, px: 1.95 };

// --- deterministic random ----------------------------------------------------
function makeRng(seed = 1337) {
  let s = seed >>> 0;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// --- tiny helpers ------------------------------------------------------------
const box2 = (x0, x1, z0, z1) => ({ x0, x1, z0, z1, w: x1 - x0, d: z1 - z0 });
const inBox = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;

Object.assign(__M.config, { BASE, STREET, WALK, STORE, FORECOURT, ALLEY_E, NEIGHBOUR_E, NEIGHBOUR_W, COLORS, OUTLINE, makeRng, lerp, clamp, smoothstep, box2, inBox });
})();
// ==== src/BufferGeometryUtils.js ====
__M.BufferGeometryUtils = {};
(function () {
'use strict';
const __THREE = window.THREE;
const { BufferAttribute, BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, InterleavedBuffer, InterleavedBufferAttribute, TriangleFanDrawMode, TriangleStripDrawMode, TrianglesDrawMode, Vector3 } = __THREE;

function computeMikkTSpaceTangents( geometry, MikkTSpace, negateSign = true ) {

	if ( ! MikkTSpace || ! MikkTSpace.isReady ) {

		throw new Error( 'BufferGeometryUtils: Initialized MikkTSpace library required.' );

	}

	if ( ! geometry.hasAttribute( 'position' ) || ! geometry.hasAttribute( 'normal' ) || ! geometry.hasAttribute( 'uv' ) ) {

		throw new Error( 'BufferGeometryUtils: Tangents require "position", "normal", and "uv" attributes.' );

	}

	function getAttributeArray( attribute ) {

		if ( attribute.normalized || attribute.isInterleavedBufferAttribute ) {

			const dstArray = new Float32Array( attribute.count * attribute.itemSize );

			for ( let i = 0, j = 0; i < attribute.count; i ++ ) {

				dstArray[ j ++ ] = attribute.getX( i );
				dstArray[ j ++ ] = attribute.getY( i );

				if ( attribute.itemSize > 2 ) {

					dstArray[ j ++ ] = attribute.getZ( i );

				}

			}

			return dstArray;

		}

		if ( attribute.array instanceof Float32Array ) {

			return attribute.array;

		}

		return new Float32Array( attribute.array );

	}

	// MikkTSpace algorithm requires non-indexed input.

	const _geometry = geometry.index ? geometry.toNonIndexed() : geometry;

	// Compute vertex tangents.

	const tangents = MikkTSpace.generateTangents(

		getAttributeArray( _geometry.attributes.position ),
		getAttributeArray( _geometry.attributes.normal ),
		getAttributeArray( _geometry.attributes.uv )

	);

	// Texture coordinate convention of glTF differs from the apparent
	// default of the MikkTSpace library; .w component must be flipped.

	if ( negateSign ) {

		for ( let i = 3; i < tangents.length; i += 4 ) {

			tangents[ i ] *= - 1;

		}

	}

	//

	_geometry.setAttribute( 'tangent', new BufferAttribute( tangents, 4 ) );

	if ( geometry !== _geometry ) {

		geometry.copy( _geometry );

	}

	return geometry;

}

/**
 * @param  {Array<BufferGeometry>} geometries
 * @param  {Boolean} useGroups
 * @return {BufferGeometry}
 */
function mergeGeometries( geometries, useGroups = false ) {

	const isIndexed = geometries[ 0 ].index !== null;

	const attributesUsed = new Set( Object.keys( geometries[ 0 ].attributes ) );
	const morphAttributesUsed = new Set( Object.keys( geometries[ 0 ].morphAttributes ) );

	const attributes = {};
	const morphAttributes = {};

	const morphTargetsRelative = geometries[ 0 ].morphTargetsRelative;

	const mergedGeometry = new BufferGeometry();

	let offset = 0;

	for ( let i = 0; i < geometries.length; ++ i ) {

		const geometry = geometries[ i ];
		let attributesCount = 0;

		// ensure that all geometries are indexed, or none

		if ( isIndexed !== ( geometry.index !== null ) ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.' );
			return null;

		}

		// gather attributes, exit early if they're different

		for ( const name in geometry.attributes ) {

			if ( ! attributesUsed.has( name ) ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.' );
				return null;

			}

			if ( attributes[ name ] === undefined ) attributes[ name ] = [];

			attributes[ name ].push( geometry.attributes[ name ] );

			attributesCount ++;

		}

		// ensure geometries have the same number of attributes

		if ( attributesCount !== attributesUsed.size ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. Make sure all geometries have the same number of attributes.' );
			return null;

		}

		// gather morph attributes, exit early if they're different

		if ( morphTargetsRelative !== geometry.morphTargetsRelative ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. .morphTargetsRelative must be consistent throughout all geometries.' );
			return null;

		}

		for ( const name in geometry.morphAttributes ) {

			if ( ! morphAttributesUsed.has( name ) ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '.  .morphAttributes must be consistent throughout all geometries.' );
				return null;

			}

			if ( morphAttributes[ name ] === undefined ) morphAttributes[ name ] = [];

			morphAttributes[ name ].push( geometry.morphAttributes[ name ] );

		}

		if ( useGroups ) {

			let count;

			if ( isIndexed ) {

				count = geometry.index.count;

			} else if ( geometry.attributes.position !== undefined ) {

				count = geometry.attributes.position.count;

			} else {

				console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. The geometry must have either an index or a position attribute' );
				return null;

			}

			mergedGeometry.addGroup( offset, count, i );

			offset += count;

		}

	}

	// merge indices

	if ( isIndexed ) {

		let indexOffset = 0;
		const mergedIndex = [];

		for ( let i = 0; i < geometries.length; ++ i ) {

			const index = geometries[ i ].index;

			for ( let j = 0; j < index.count; ++ j ) {

				mergedIndex.push( index.getX( j ) + indexOffset );

			}

			indexOffset += geometries[ i ].attributes.position.count;

		}

		mergedGeometry.setIndex( mergedIndex );

	}

	// merge attributes

	for ( const name in attributes ) {

		const mergedAttribute = mergeAttributes( attributes[ name ] );

		if ( ! mergedAttribute ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the ' + name + ' attribute.' );
			return null;

		}

		mergedGeometry.setAttribute( name, mergedAttribute );

	}

	// merge morph attributes

	for ( const name in morphAttributes ) {

		const numMorphTargets = morphAttributes[ name ][ 0 ].length;

		if ( numMorphTargets === 0 ) break;

		mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
		mergedGeometry.morphAttributes[ name ] = [];

		for ( let i = 0; i < numMorphTargets; ++ i ) {

			const morphAttributesToMerge = [];

			for ( let j = 0; j < morphAttributes[ name ].length; ++ j ) {

				morphAttributesToMerge.push( morphAttributes[ name ][ j ][ i ] );

			}

			const mergedMorphAttribute = mergeAttributes( morphAttributesToMerge );

			if ( ! mergedMorphAttribute ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the ' + name + ' morphAttribute.' );
				return null;

			}

			mergedGeometry.morphAttributes[ name ].push( mergedMorphAttribute );

		}

	}

	return mergedGeometry;

}

/**
 * @param {Array<BufferAttribute>} attributes
 * @return {BufferAttribute}
 */
function mergeAttributes( attributes ) {

	let TypedArray;
	let itemSize;
	let normalized;
	let gpuType = - 1;
	let arrayLength = 0;

	for ( let i = 0; i < attributes.length; ++ i ) {

		const attribute = attributes[ i ];

		if ( attribute.isInterleavedBufferAttribute ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. InterleavedBufferAttributes are not supported.' );
			return null;

		}

		if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
		if ( TypedArray !== attribute.array.constructor ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.' );
			return null;

		}

		if ( itemSize === undefined ) itemSize = attribute.itemSize;
		if ( itemSize !== attribute.itemSize ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.' );
			return null;

		}

		if ( normalized === undefined ) normalized = attribute.normalized;
		if ( normalized !== attribute.normalized ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.' );
			return null;

		}

		if ( gpuType === - 1 ) gpuType = attribute.gpuType;
		if ( gpuType !== attribute.gpuType ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.' );
			return null;

		}

		arrayLength += attribute.array.length;

	}

	const array = new TypedArray( arrayLength );
	let offset = 0;

	for ( let i = 0; i < attributes.length; ++ i ) {

		array.set( attributes[ i ].array, offset );

		offset += attributes[ i ].array.length;

	}

	const result = new BufferAttribute( array, itemSize, normalized );
	if ( gpuType !== undefined ) {

		result.gpuType = gpuType;

	}

	return result;

}

/**
 * @param {BufferAttribute}
 * @return {BufferAttribute}
 */
function deepCloneAttribute( attribute ) {

	if ( attribute.isInstancedInterleavedBufferAttribute || attribute.isInterleavedBufferAttribute ) {

		return deinterleaveAttribute( attribute );

	}

	if ( attribute.isInstancedBufferAttribute ) {

		return new InstancedBufferAttribute().copy( attribute );

	}

	return new BufferAttribute().copy( attribute );

}

/**
 * @param {Array<BufferAttribute>} attributes
 * @return {Array<InterleavedBufferAttribute>}
 */
function interleaveAttributes( attributes ) {

	// Interleaves the provided attributes into an InterleavedBuffer and returns
	// a set of InterleavedBufferAttributes for each attribute
	let TypedArray;
	let arrayLength = 0;
	let stride = 0;

	// calculate the length and type of the interleavedBuffer
	for ( let i = 0, l = attributes.length; i < l; ++ i ) {

		const attribute = attributes[ i ];

		if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
		if ( TypedArray !== attribute.array.constructor ) {

			console.error( 'AttributeBuffers of different types cannot be interleaved' );
			return null;

		}

		arrayLength += attribute.array.length;
		stride += attribute.itemSize;

	}

	// Create the set of buffer attributes
	const interleavedBuffer = new InterleavedBuffer( new TypedArray( arrayLength ), stride );
	let offset = 0;
	const res = [];
	const getters = [ 'getX', 'getY', 'getZ', 'getW' ];
	const setters = [ 'setX', 'setY', 'setZ', 'setW' ];

	for ( let j = 0, l = attributes.length; j < l; j ++ ) {

		const attribute = attributes[ j ];
		const itemSize = attribute.itemSize;
		const count = attribute.count;
		const iba = new InterleavedBufferAttribute( interleavedBuffer, itemSize, offset, attribute.normalized );
		res.push( iba );

		offset += itemSize;

		// Move the data for each attribute into the new interleavedBuffer
		// at the appropriate offset
		for ( let c = 0; c < count; c ++ ) {

			for ( let k = 0; k < itemSize; k ++ ) {

				iba[ setters[ k ] ]( c, attribute[ getters[ k ] ]( c ) );

			}

		}

	}

	return res;

}

// returns a new, non-interleaved version of the provided attribute
function deinterleaveAttribute( attribute ) {

	const cons = attribute.data.array.constructor;
	const count = attribute.count;
	const itemSize = attribute.itemSize;
	const normalized = attribute.normalized;

	const array = new cons( count * itemSize );
	let newAttribute;
	if ( attribute.isInstancedInterleavedBufferAttribute ) {

		newAttribute = new InstancedBufferAttribute( array, itemSize, normalized, attribute.meshPerAttribute );

	} else {

		newAttribute = new BufferAttribute( array, itemSize, normalized );

	}

	for ( let i = 0; i < count; i ++ ) {

		newAttribute.setX( i, attribute.getX( i ) );

		if ( itemSize >= 2 ) {

			newAttribute.setY( i, attribute.getY( i ) );

		}

		if ( itemSize >= 3 ) {

			newAttribute.setZ( i, attribute.getZ( i ) );

		}

		if ( itemSize >= 4 ) {

			newAttribute.setW( i, attribute.getW( i ) );

		}

	}

	return newAttribute;

}

// deinterleaves all attributes on the geometry
function deinterleaveGeometry( geometry ) {

	const attributes = geometry.attributes;
	const morphTargets = geometry.morphTargets;
	const attrMap = new Map();

	for ( const key in attributes ) {

		const attr = attributes[ key ];
		if ( attr.isInterleavedBufferAttribute ) {

			if ( ! attrMap.has( attr ) ) {

				attrMap.set( attr, deinterleaveAttribute( attr ) );

			}

			attributes[ key ] = attrMap.get( attr );

		}

	}

	for ( const key in morphTargets ) {

		const attr = morphTargets[ key ];
		if ( attr.isInterleavedBufferAttribute ) {

			if ( ! attrMap.has( attr ) ) {

				attrMap.set( attr, deinterleaveAttribute( attr ) );

			}

			morphTargets[ key ] = attrMap.get( attr );

		}

	}

}

/**
 * @param {BufferGeometry} geometry
 * @return {number}
 */
function estimateBytesUsed( geometry ) {

	// Return the estimated memory used by this geometry in bytes
	// Calculate using itemSize, count, and BYTES_PER_ELEMENT to account
	// for InterleavedBufferAttributes.
	let mem = 0;
	for ( const name in geometry.attributes ) {

		const attr = geometry.getAttribute( name );
		mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;

	}

	const indices = geometry.getIndex();
	mem += indices ? indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT : 0;
	return mem;

}

/**
 * @param {BufferGeometry} geometry
 * @param {number} tolerance
 * @return {BufferGeometry}
 */
function mergeVertices( geometry, tolerance = 1e-4 ) {

	tolerance = Math.max( tolerance, Number.EPSILON );

	// Generate an index buffer if the geometry doesn't have one, or optimize it
	// if it's already available.
	const hashToIndex = {};
	const indices = geometry.getIndex();
	const positions = geometry.getAttribute( 'position' );
	const vertexCount = indices ? indices.count : positions.count;

	// next value for triangle indices
	let nextIndex = 0;

	// attributes and new attribute arrays
	const attributeNames = Object.keys( geometry.attributes );
	const tmpAttributes = {};
	const tmpMorphAttributes = {};
	const newIndices = [];
	const getters = [ 'getX', 'getY', 'getZ', 'getW' ];
	const setters = [ 'setX', 'setY', 'setZ', 'setW' ];

	// Initialize the arrays, allocating space conservatively. Extra
	// space will be trimmed in the last step.
	for ( let i = 0, l = attributeNames.length; i < l; i ++ ) {

		const name = attributeNames[ i ];
		const attr = geometry.attributes[ name ];

		tmpAttributes[ name ] = new BufferAttribute(
			new attr.array.constructor( attr.count * attr.itemSize ),
			attr.itemSize,
			attr.normalized
		);

		const morphAttr = geometry.morphAttributes[ name ];
		if ( morphAttr ) {

			tmpMorphAttributes[ name ] = new BufferAttribute(
				new morphAttr.array.constructor( morphAttr.count * morphAttr.itemSize ),
				morphAttr.itemSize,
				morphAttr.normalized
			);

		}

	}

	// convert the error tolerance to an amount of decimal places to truncate to
	const halfTolerance = tolerance * 0.5;
	const exponent = Math.log10( 1 / tolerance );
	const hashMultiplier = Math.pow( 10, exponent );
	const hashAdditive = halfTolerance * hashMultiplier;
	for ( let i = 0; i < vertexCount; i ++ ) {

		const index = indices ? indices.getX( i ) : i;

		// Generate a hash for the vertex attributes at the current index 'i'
		let hash = '';
		for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

			const name = attributeNames[ j ];
			const attribute = geometry.getAttribute( name );
			const itemSize = attribute.itemSize;

			for ( let k = 0; k < itemSize; k ++ ) {

				// double tilde truncates the decimal value
				hash += `${ ~ ~ ( attribute[ getters[ k ] ]( index ) * hashMultiplier + hashAdditive ) },`;

			}

		}

		// Add another reference to the vertex if it's already
		// used by another index
		if ( hash in hashToIndex ) {

			newIndices.push( hashToIndex[ hash ] );

		} else {

			// copy data to the new index in the temporary attributes
			for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

				const name = attributeNames[ j ];
				const attribute = geometry.getAttribute( name );
				const morphAttr = geometry.morphAttributes[ name ];
				const itemSize = attribute.itemSize;
				const newarray = tmpAttributes[ name ];
				const newMorphArrays = tmpMorphAttributes[ name ];

				for ( let k = 0; k < itemSize; k ++ ) {

					const getterFunc = getters[ k ];
					const setterFunc = setters[ k ];
					newarray[ setterFunc ]( nextIndex, attribute[ getterFunc ]( index ) );

					if ( morphAttr ) {

						for ( let m = 0, ml = morphAttr.length; m < ml; m ++ ) {

							newMorphArrays[ m ][ setterFunc ]( nextIndex, morphAttr[ m ][ getterFunc ]( index ) );

						}

					}

				}

			}

			hashToIndex[ hash ] = nextIndex;
			newIndices.push( nextIndex );
			nextIndex ++;

		}

	}

	// generate result BufferGeometry
	const result = geometry.clone();
	for ( const name in geometry.attributes ) {

		const tmpAttribute = tmpAttributes[ name ];

		result.setAttribute( name, new BufferAttribute(
			tmpAttribute.array.slice( 0, nextIndex * tmpAttribute.itemSize ),
			tmpAttribute.itemSize,
			tmpAttribute.normalized,
		) );

		if ( ! ( name in tmpMorphAttributes ) ) continue;

		for ( let j = 0; j < tmpMorphAttributes[ name ].length; j ++ ) {

			const tmpMorphAttribute = tmpMorphAttributes[ name ][ j ];

			result.morphAttributes[ name ][ j ] = new BufferAttribute(
				tmpMorphAttribute.array.slice( 0, nextIndex * tmpMorphAttribute.itemSize ),
				tmpMorphAttribute.itemSize,
				tmpMorphAttribute.normalized,
			);

		}

	}

	// indices

	result.setIndex( newIndices );

	return result;

}

/**
 * @param {BufferGeometry} geometry
 * @param {number} drawMode
 * @return {BufferGeometry}
 */
function toTrianglesDrawMode( geometry, drawMode ) {

	if ( drawMode === TrianglesDrawMode ) {

		console.warn( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.' );
		return geometry;

	}

	if ( drawMode === TriangleFanDrawMode || drawMode === TriangleStripDrawMode ) {

		let index = geometry.getIndex();

		// generate index if not present

		if ( index === null ) {

			const indices = [];

			const position = geometry.getAttribute( 'position' );

			if ( position !== undefined ) {

				for ( let i = 0; i < position.count; i ++ ) {

					indices.push( i );

				}

				geometry.setIndex( indices );
				index = geometry.getIndex();

			} else {

				console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.' );
				return geometry;

			}

		}

		//

		const numberOfTriangles = index.count - 2;
		const newIndices = [];

		if ( drawMode === TriangleFanDrawMode ) {

			// gl.TRIANGLE_FAN

			for ( let i = 1; i <= numberOfTriangles; i ++ ) {

				newIndices.push( index.getX( 0 ) );
				newIndices.push( index.getX( i ) );
				newIndices.push( index.getX( i + 1 ) );

			}

		} else {

			// gl.TRIANGLE_STRIP

			for ( let i = 0; i < numberOfTriangles; i ++ ) {

				if ( i % 2 === 0 ) {

					newIndices.push( index.getX( i ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i + 2 ) );

				} else {

					newIndices.push( index.getX( i + 2 ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i ) );

				}

			}

		}

		if ( ( newIndices.length / 3 ) !== numberOfTriangles ) {

			console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.' );

		}

		// build final geometry

		const newGeometry = geometry.clone();
		newGeometry.setIndex( newIndices );
		newGeometry.clearGroups();

		return newGeometry;

	} else {

		console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:', drawMode );
		return geometry;

	}

}

/**
 * Calculates the morphed attributes of a morphed/skinned BufferGeometry.
 * Helpful for Raytracing or Decals.
 * @param {Mesh | Line | Points} object An instance of Mesh, Line or Points.
 * @return {Object} An Object with original position/normal attributes and morphed ones.
 */
function computeMorphedAttributes( object ) {

	const _vA = new Vector3();
	const _vB = new Vector3();
	const _vC = new Vector3();

	const _tempA = new Vector3();
	const _tempB = new Vector3();
	const _tempC = new Vector3();

	const _morphA = new Vector3();
	const _morphB = new Vector3();
	const _morphC = new Vector3();

	function _calculateMorphedAttributeData(
		object,
		attribute,
		morphAttribute,
		morphTargetsRelative,
		a,
		b,
		c,
		modifiedAttributeArray
	) {

		_vA.fromBufferAttribute( attribute, a );
		_vB.fromBufferAttribute( attribute, b );
		_vC.fromBufferAttribute( attribute, c );

		const morphInfluences = object.morphTargetInfluences;

		if ( morphAttribute && morphInfluences ) {

			_morphA.set( 0, 0, 0 );
			_morphB.set( 0, 0, 0 );
			_morphC.set( 0, 0, 0 );

			for ( let i = 0, il = morphAttribute.length; i < il; i ++ ) {

				const influence = morphInfluences[ i ];
				const morph = morphAttribute[ i ];

				if ( influence === 0 ) continue;

				_tempA.fromBufferAttribute( morph, a );
				_tempB.fromBufferAttribute( morph, b );
				_tempC.fromBufferAttribute( morph, c );

				if ( morphTargetsRelative ) {

					_morphA.addScaledVector( _tempA, influence );
					_morphB.addScaledVector( _tempB, influence );
					_morphC.addScaledVector( _tempC, influence );

				} else {

					_morphA.addScaledVector( _tempA.sub( _vA ), influence );
					_morphB.addScaledVector( _tempB.sub( _vB ), influence );
					_morphC.addScaledVector( _tempC.sub( _vC ), influence );

				}

			}

			_vA.add( _morphA );
			_vB.add( _morphB );
			_vC.add( _morphC );

		}

		if ( object.isSkinnedMesh ) {

			object.applyBoneTransform( a, _vA );
			object.applyBoneTransform( b, _vB );
			object.applyBoneTransform( c, _vC );

		}

		modifiedAttributeArray[ a * 3 + 0 ] = _vA.x;
		modifiedAttributeArray[ a * 3 + 1 ] = _vA.y;
		modifiedAttributeArray[ a * 3 + 2 ] = _vA.z;
		modifiedAttributeArray[ b * 3 + 0 ] = _vB.x;
		modifiedAttributeArray[ b * 3 + 1 ] = _vB.y;
		modifiedAttributeArray[ b * 3 + 2 ] = _vB.z;
		modifiedAttributeArray[ c * 3 + 0 ] = _vC.x;
		modifiedAttributeArray[ c * 3 + 1 ] = _vC.y;
		modifiedAttributeArray[ c * 3 + 2 ] = _vC.z;

	}

	const geometry = object.geometry;
	const material = object.material;

	let a, b, c;
	const index = geometry.index;
	const positionAttribute = geometry.attributes.position;
	const morphPosition = geometry.morphAttributes.position;
	const morphTargetsRelative = geometry.morphTargetsRelative;
	const normalAttribute = geometry.attributes.normal;
	const morphNormal = geometry.morphAttributes.position;

	const groups = geometry.groups;
	const drawRange = geometry.drawRange;
	let i, j, il, jl;
	let group;
	let start, end;

	const modifiedPosition = new Float32Array( positionAttribute.count * positionAttribute.itemSize );
	const modifiedNormal = new Float32Array( normalAttribute.count * normalAttribute.itemSize );

	if ( index !== null ) {

		// indexed buffer geometry

		if ( Array.isArray( material ) ) {

			for ( i = 0, il = groups.length; i < il; i ++ ) {

				group = groups[ i ];

				start = Math.max( group.start, drawRange.start );
				end = Math.min( ( group.start + group.count ), ( drawRange.start + drawRange.count ) );

				for ( j = start, jl = end; j < jl; j += 3 ) {

					a = index.getX( j );
					b = index.getX( j + 1 );
					c = index.getX( j + 2 );

					_calculateMorphedAttributeData(
						object,
						positionAttribute,
						morphPosition,
						morphTargetsRelative,
						a, b, c,
						modifiedPosition
					);

					_calculateMorphedAttributeData(
						object,
						normalAttribute,
						morphNormal,
						morphTargetsRelative,
						a, b, c,
						modifiedNormal
					);

				}

			}

		} else {

			start = Math.max( 0, drawRange.start );
			end = Math.min( index.count, ( drawRange.start + drawRange.count ) );

			for ( i = start, il = end; i < il; i += 3 ) {

				a = index.getX( i );
				b = index.getX( i + 1 );
				c = index.getX( i + 2 );

				_calculateMorphedAttributeData(
					object,
					positionAttribute,
					morphPosition,
					morphTargetsRelative,
					a, b, c,
					modifiedPosition
				);

				_calculateMorphedAttributeData(
					object,
					normalAttribute,
					morphNormal,
					morphTargetsRelative,
					a, b, c,
					modifiedNormal
				);

			}

		}

	} else {

		// non-indexed buffer geometry

		if ( Array.isArray( material ) ) {

			for ( i = 0, il = groups.length; i < il; i ++ ) {

				group = groups[ i ];

				start = Math.max( group.start, drawRange.start );
				end = Math.min( ( group.start + group.count ), ( drawRange.start + drawRange.count ) );

				for ( j = start, jl = end; j < jl; j += 3 ) {

					a = j;
					b = j + 1;
					c = j + 2;

					_calculateMorphedAttributeData(
						object,
						positionAttribute,
						morphPosition,
						morphTargetsRelative,
						a, b, c,
						modifiedPosition
					);

					_calculateMorphedAttributeData(
						object,
						normalAttribute,
						morphNormal,
						morphTargetsRelative,
						a, b, c,
						modifiedNormal
					);

				}

			}

		} else {

			start = Math.max( 0, drawRange.start );
			end = Math.min( positionAttribute.count, ( drawRange.start + drawRange.count ) );

			for ( i = start, il = end; i < il; i += 3 ) {

				a = i;
				b = i + 1;
				c = i + 2;

				_calculateMorphedAttributeData(
					object,
					positionAttribute,
					morphPosition,
					morphTargetsRelative,
					a, b, c,
					modifiedPosition
				);

				_calculateMorphedAttributeData(
					object,
					normalAttribute,
					morphNormal,
					morphTargetsRelative,
					a, b, c,
					modifiedNormal
				);

			}

		}

	}

	const morphedPositionAttribute = new Float32BufferAttribute( modifiedPosition, 3 );
	const morphedNormalAttribute = new Float32BufferAttribute( modifiedNormal, 3 );

	return {

		positionAttribute: positionAttribute,
		normalAttribute: normalAttribute,
		morphedPositionAttribute: morphedPositionAttribute,
		morphedNormalAttribute: morphedNormalAttribute

	};

}

function mergeGroups( geometry ) {

	if ( geometry.groups.length === 0 ) {

		console.warn( 'THREE.BufferGeometryUtils.mergeGroups(): No groups are defined. Nothing to merge.' );
		return geometry;

	}

	let groups = geometry.groups;

	// sort groups by material index

	groups = groups.sort( ( a, b ) => {

		if ( a.materialIndex !== b.materialIndex ) return a.materialIndex - b.materialIndex;

		return a.start - b.start;

	} );

	// create index for non-indexed geometries

	if ( geometry.getIndex() === null ) {

		const positionAttribute = geometry.getAttribute( 'position' );
		const indices = [];

		for ( let i = 0; i < positionAttribute.count; i += 3 ) {

			indices.push( i, i + 1, i + 2 );

		}

		geometry.setIndex( indices );

	}

	// sort index

	const index = geometry.getIndex();

	const newIndices = [];

	for ( let i = 0; i < groups.length; i ++ ) {

		const group = groups[ i ];

		const groupStart = group.start;
		const groupLength = groupStart + group.count;

		for ( let j = groupStart; j < groupLength; j ++ ) {

			newIndices.push( index.getX( j ) );

		}

	}

	geometry.dispose(); // Required to force buffer recreation
	geometry.setIndex( newIndices );

	// update groups indices

	let start = 0;

	for ( let i = 0; i < groups.length; i ++ ) {

		const group = groups[ i ];

		group.start = start;
		start += group.count;

	}

	// merge groups

	let currentGroup = groups[ 0 ];

	geometry.groups = [ currentGroup ];

	for ( let i = 1; i < groups.length; i ++ ) {

		const group = groups[ i ];

		if ( currentGroup.materialIndex === group.materialIndex ) {

			currentGroup.count += group.count;

		} else {

			currentGroup = group;
			geometry.groups.push( currentGroup );

		}

	}

	return geometry;

}


/**
 * Modifies the supplied geometry if it is non-indexed, otherwise creates a new,
 * non-indexed geometry. Returns the geometry with smooth normals everywhere except
 * faces that meet at an angle greater than the crease angle.
 *
 * @param {BufferGeometry} geometry
 * @param {number} [creaseAngle]
 * @return {BufferGeometry}
 */
function toCreasedNormals( geometry, creaseAngle = Math.PI / 3 /* 60 degrees */ ) {

	const creaseDot = Math.cos( creaseAngle );
	const hashMultiplier = ( 1 + 1e-10 ) * 1e2;

	// reusable vectors
	const verts = [ new Vector3(), new Vector3(), new Vector3() ];
	const tempVec1 = new Vector3();
	const tempVec2 = new Vector3();
	const tempNorm = new Vector3();
	const tempNorm2 = new Vector3();

	// hashes a vector
	function hashVertex( v ) {

		const x = ~ ~ ( v.x * hashMultiplier );
		const y = ~ ~ ( v.y * hashMultiplier );
		const z = ~ ~ ( v.z * hashMultiplier );
		return `${x},${y},${z}`;

	}

	// BufferGeometry.toNonIndexed() warns if the geometry is non-indexed
	// and returns the original geometry
	const resultGeometry = geometry.index ? geometry.toNonIndexed() : geometry;
	const posAttr = resultGeometry.attributes.position;
	const vertexMap = {};

	// find all the normals shared by commonly located vertices
	for ( let i = 0, l = posAttr.count / 3; i < l; i ++ ) {

		const i3 = 3 * i;
		const a = verts[ 0 ].fromBufferAttribute( posAttr, i3 + 0 );
		const b = verts[ 1 ].fromBufferAttribute( posAttr, i3 + 1 );
		const c = verts[ 2 ].fromBufferAttribute( posAttr, i3 + 2 );

		tempVec1.subVectors( c, b );
		tempVec2.subVectors( a, b );

		// add the normal to the map for all vertices
		const normal = new Vector3().crossVectors( tempVec1, tempVec2 ).normalize();
		for ( let n = 0; n < 3; n ++ ) {

			const vert = verts[ n ];
			const hash = hashVertex( vert );
			if ( ! ( hash in vertexMap ) ) {

				vertexMap[ hash ] = [];

			}

			vertexMap[ hash ].push( normal );

		}

	}

	// average normals from all vertices that share a common location if they are within the
	// provided crease threshold
	const normalArray = new Float32Array( posAttr.count * 3 );
	const normAttr = new BufferAttribute( normalArray, 3, false );
	for ( let i = 0, l = posAttr.count / 3; i < l; i ++ ) {

		// get the face normal for this vertex
		const i3 = 3 * i;
		const a = verts[ 0 ].fromBufferAttribute( posAttr, i3 + 0 );
		const b = verts[ 1 ].fromBufferAttribute( posAttr, i3 + 1 );
		const c = verts[ 2 ].fromBufferAttribute( posAttr, i3 + 2 );

		tempVec1.subVectors( c, b );
		tempVec2.subVectors( a, b );

		tempNorm.crossVectors( tempVec1, tempVec2 ).normalize();

		// average all normals that meet the threshold and set the normal value
		for ( let n = 0; n < 3; n ++ ) {

			const vert = verts[ n ];
			const hash = hashVertex( vert );
			const otherNormals = vertexMap[ hash ];
			tempNorm2.set( 0, 0, 0 );

			for ( let k = 0, lk = otherNormals.length; k < lk; k ++ ) {

				const otherNorm = otherNormals[ k ];
				if ( tempNorm.dot( otherNorm ) > creaseDot ) {

					tempNorm2.add( otherNorm );

				}

			}

			tempNorm2.normalize();
			normAttr.setXYZ( i3 + n, tempNorm2.x, tempNorm2.y, tempNorm2.z );

		}

	}

	resultGeometry.setAttribute( 'normal', normAttr );
	return resultGeometry;

}

function mergeBufferGeometries( geometries, useGroups = false ) {

	console.warn( 'THREE.BufferGeometryUtils: mergeBufferGeometries() has been renamed to mergeGeometries().' ); // @deprecated, r151
	return mergeGeometries( geometries, useGroups );

}

function mergeBufferAttributes( attributes ) {

	console.warn( 'THREE.BufferGeometryUtils: mergeBufferAttributes() has been renamed to mergeAttributes().' ); // @deprecated, r151
	return mergeAttributes( attributes );

}



Object.assign(__M.BufferGeometryUtils, { computeMikkTSpaceTangents, mergeGeometries, mergeBufferGeometries, mergeAttributes, mergeBufferAttributes, interleaveAttributes, estimateBytesUsed, mergeVertices, toTrianglesDrawMode, computeMorphedAttributes, mergeGroups, toCreasedNormals, deepCloneAttribute, deinterleaveAttribute, deinterleaveGeometry });
})();
// ==== src/OrbitControls.js ====
__M.OrbitControls = {};
(function () {
'use strict';
const __THREE = window.THREE;
const { EventDispatcher, MOUSE, Quaternion, Spherical, TOUCH, Vector2, Vector3, Plane, Ray, MathUtils } = __THREE;

// OrbitControls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

const _changeEvent = { type: 'change' };
const _startEvent = { type: 'start' };
const _endEvent = { type: 'end' };
const _ray = new Ray();
const _plane = new Plane();
const TILT_LIMIT = Math.cos( 70 * MathUtils.DEG2RAD );

class OrbitControls extends EventDispatcher {

	constructor( object, domElement ) {

		super();

		this.object = object;
		this.domElement = domElement;
		this.domElement.style.touchAction = 'none'; // disable touch scroll

		// Set to false to disable this control
		this.enabled = true;

		// "target" sets the location of focus, where the object orbits around
		this.target = new Vector3();

		// Sets the 3D cursor (similar to Blender), from which the maxTargetRadius takes effect
		this.cursor = new Vector3();

		// How far you can dolly in and out ( PerspectiveCamera only )
		this.minDistance = 0;
		this.maxDistance = Infinity;

		// How far you can zoom in and out ( OrthographicCamera only )
		this.minZoom = 0;
		this.maxZoom = Infinity;

		// Limit camera target within a spherical area around the cursor
		this.minTargetRadius = 0;
		this.maxTargetRadius = Infinity;

		// How far you can orbit vertically, upper and lower limits.
		// Range is 0 to Math.PI radians.
		this.minPolarAngle = 0; // radians
		this.maxPolarAngle = Math.PI; // radians

		// How far you can orbit horizontally, upper and lower limits.
		// If set, the interval [ min, max ] must be a sub-interval of [ - 2 PI, 2 PI ], with ( max - min < 2 PI )
		this.minAzimuthAngle = - Infinity; // radians
		this.maxAzimuthAngle = Infinity; // radians

		// Set to true to enable damping (inertia)
		// If damping is enabled, you must call controls.update() in your animation loop
		this.enableDamping = false;
		this.dampingFactor = 0.05;

		// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
		// Set to false to disable zooming
		this.enableZoom = true;
		this.zoomSpeed = 1.0;

		// Set to false to disable rotating
		this.enableRotate = true;
		this.rotateSpeed = 1.0;

		// Set to false to disable panning
		this.enablePan = true;
		this.panSpeed = 1.0;
		this.screenSpacePanning = true; // if false, pan orthogonal to world-space direction camera.up
		this.keyPanSpeed = 7.0;	// pixels moved per arrow key push
		this.zoomToCursor = false;

		// Set to true to automatically rotate around the target
		// If auto-rotate is enabled, you must call controls.update() in your animation loop
		this.autoRotate = false;
		this.autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

		// The four arrow keys
		this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

		// Mouse buttons
		this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

		// Touch fingers
		this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

		// for reset
		this.target0 = this.target.clone();
		this.position0 = this.object.position.clone();
		this.zoom0 = this.object.zoom;

		// the target DOM element for key events
		this._domElementKeyEvents = null;

		//
		// public methods
		//

		this.getPolarAngle = function () {

			return spherical.phi;

		};

		this.getAzimuthalAngle = function () {

			return spherical.theta;

		};

		this.getDistance = function () {

			return this.object.position.distanceTo( this.target );

		};

		this.listenToKeyEvents = function ( domElement ) {

			domElement.addEventListener( 'keydown', onKeyDown );
			this._domElementKeyEvents = domElement;

		};

		this.stopListenToKeyEvents = function () {

			this._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown );
			this._domElementKeyEvents = null;

		};

		this.saveState = function () {

			scope.target0.copy( scope.target );
			scope.position0.copy( scope.object.position );
			scope.zoom0 = scope.object.zoom;

		};

		this.reset = function () {

			scope.target.copy( scope.target0 );
			scope.object.position.copy( scope.position0 );
			scope.object.zoom = scope.zoom0;

			scope.object.updateProjectionMatrix();
			scope.dispatchEvent( _changeEvent );

			scope.update();

			state = STATE.NONE;

		};

		// this method is exposed, but perhaps it would be better if we can make it private...
		this.update = function () {

			const offset = new Vector3();

			// so camera.up is the orbit axis
			const quat = new Quaternion().setFromUnitVectors( object.up, new Vector3( 0, 1, 0 ) );
			const quatInverse = quat.clone().invert();

			const lastPosition = new Vector3();
			const lastQuaternion = new Quaternion();
			const lastTargetPosition = new Vector3();

			const twoPI = 2 * Math.PI;

			return function update( deltaTime = null ) {

				const position = scope.object.position;

				offset.copy( position ).sub( scope.target );

				// rotate offset to "y-axis-is-up" space
				offset.applyQuaternion( quat );

				// angle from z-axis around y-axis
				spherical.setFromVector3( offset );

				if ( scope.autoRotate && state === STATE.NONE ) {

					rotateLeft( getAutoRotationAngle( deltaTime ) );

				}

				if ( scope.enableDamping ) {

					spherical.theta += sphericalDelta.theta * scope.dampingFactor;
					spherical.phi += sphericalDelta.phi * scope.dampingFactor;

				} else {

					spherical.theta += sphericalDelta.theta;
					spherical.phi += sphericalDelta.phi;

				}

				// restrict theta to be between desired limits

				let min = scope.minAzimuthAngle;
				let max = scope.maxAzimuthAngle;

				if ( isFinite( min ) && isFinite( max ) ) {

					if ( min < - Math.PI ) min += twoPI; else if ( min > Math.PI ) min -= twoPI;

					if ( max < - Math.PI ) max += twoPI; else if ( max > Math.PI ) max -= twoPI;

					if ( min <= max ) {

						spherical.theta = Math.max( min, Math.min( max, spherical.theta ) );

					} else {

						spherical.theta = ( spherical.theta > ( min + max ) / 2 ) ?
							Math.max( min, spherical.theta ) :
							Math.min( max, spherical.theta );

					}

				}

				// restrict phi to be between desired limits
				spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

				spherical.makeSafe();


				// move target to panned location

				if ( scope.enableDamping === true ) {

					scope.target.addScaledVector( panOffset, scope.dampingFactor );

				} else {

					scope.target.add( panOffset );

				}

				// Limit the target distance from the cursor to create a sphere around the center of interest
				scope.target.sub( scope.cursor );
				scope.target.clampLength( scope.minTargetRadius, scope.maxTargetRadius );
				scope.target.add( scope.cursor );

				// adjust the camera position based on zoom only if we're not zooming to the cursor or if it's an ortho camera
				// we adjust zoom later in these cases
				if ( scope.zoomToCursor && performCursorZoom || scope.object.isOrthographicCamera ) {

					spherical.radius = clampDistance( spherical.radius );

				} else {

					spherical.radius = clampDistance( spherical.radius * scale );

				}

				offset.setFromSpherical( spherical );

				// rotate offset back to "camera-up-vector-is-up" space
				offset.applyQuaternion( quatInverse );

				position.copy( scope.target ).add( offset );

				scope.object.lookAt( scope.target );

				if ( scope.enableDamping === true ) {

					sphericalDelta.theta *= ( 1 - scope.dampingFactor );
					sphericalDelta.phi *= ( 1 - scope.dampingFactor );

					panOffset.multiplyScalar( 1 - scope.dampingFactor );

				} else {

					sphericalDelta.set( 0, 0, 0 );

					panOffset.set( 0, 0, 0 );

				}

				// adjust camera position
				let zoomChanged = false;
				if ( scope.zoomToCursor && performCursorZoom ) {

					let newRadius = null;
					if ( scope.object.isPerspectiveCamera ) {

						// move the camera down the pointer ray
						// this method avoids floating point error
						const prevRadius = offset.length();
						newRadius = clampDistance( prevRadius * scale );

						const radiusDelta = prevRadius - newRadius;
						scope.object.position.addScaledVector( dollyDirection, radiusDelta );
						scope.object.updateMatrixWorld();

					} else if ( scope.object.isOrthographicCamera ) {

						// adjust the ortho camera position based on zoom changes
						const mouseBefore = new Vector3( mouse.x, mouse.y, 0 );
						mouseBefore.unproject( scope.object );

						scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / scale ) );
						scope.object.updateProjectionMatrix();
						zoomChanged = true;

						const mouseAfter = new Vector3( mouse.x, mouse.y, 0 );
						mouseAfter.unproject( scope.object );

						scope.object.position.sub( mouseAfter ).add( mouseBefore );
						scope.object.updateMatrixWorld();

						newRadius = offset.length();

					} else {

						console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.' );
						scope.zoomToCursor = false;

					}

					// handle the placement of the target
					if ( newRadius !== null ) {

						if ( this.screenSpacePanning ) {

							// position the orbit target in front of the new camera position
							scope.target.set( 0, 0, - 1 )
								.transformDirection( scope.object.matrix )
								.multiplyScalar( newRadius )
								.add( scope.object.position );

						} else {

							// get the ray and translation plane to compute target
							_ray.origin.copy( scope.object.position );
							_ray.direction.set( 0, 0, - 1 ).transformDirection( scope.object.matrix );

							// if the camera is 20 degrees above the horizon then don't adjust the focus target to avoid
							// extremely large values
							if ( Math.abs( scope.object.up.dot( _ray.direction ) ) < TILT_LIMIT ) {

								object.lookAt( scope.target );

							} else {

								_plane.setFromNormalAndCoplanarPoint( scope.object.up, scope.target );
								_ray.intersectPlane( _plane, scope.target );

							}

						}

					}

				} else if ( scope.object.isOrthographicCamera ) {

					scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / scale ) );
					scope.object.updateProjectionMatrix();
					zoomChanged = true;

				}

				scale = 1;
				performCursorZoom = false;

				// update condition is:
				// min(camera displacement, camera rotation in radians)^2 > EPS
				// using small-angle approximation cos(x/2) = 1 - x^2 / 8

				if ( zoomChanged ||
					lastPosition.distanceToSquared( scope.object.position ) > EPS ||
					8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ||
					lastTargetPosition.distanceToSquared( scope.target ) > 0 ) {

					scope.dispatchEvent( _changeEvent );

					lastPosition.copy( scope.object.position );
					lastQuaternion.copy( scope.object.quaternion );
					lastTargetPosition.copy( scope.target );

					return true;

				}

				return false;

			};

		}();

		this.dispose = function () {

			scope.domElement.removeEventListener( 'contextmenu', onContextMenu );

			scope.domElement.removeEventListener( 'pointerdown', onPointerDown );
			scope.domElement.removeEventListener( 'pointercancel', onPointerUp );
			scope.domElement.removeEventListener( 'wheel', onMouseWheel );

			scope.domElement.removeEventListener( 'pointermove', onPointerMove );
			scope.domElement.removeEventListener( 'pointerup', onPointerUp );


			if ( scope._domElementKeyEvents !== null ) {

				scope._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown );
				scope._domElementKeyEvents = null;

			}

			//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

		};

		//
		// internals
		//

		const scope = this;

		const STATE = {
			NONE: - 1,
			ROTATE: 0,
			DOLLY: 1,
			PAN: 2,
			TOUCH_ROTATE: 3,
			TOUCH_PAN: 4,
			TOUCH_DOLLY_PAN: 5,
			TOUCH_DOLLY_ROTATE: 6
		};

		let state = STATE.NONE;

		const EPS = 0.000001;

		// current position in spherical coordinates
		const spherical = new Spherical();
		const sphericalDelta = new Spherical();

		let scale = 1;
		const panOffset = new Vector3();

		const rotateStart = new Vector2();
		const rotateEnd = new Vector2();
		const rotateDelta = new Vector2();

		const panStart = new Vector2();
		const panEnd = new Vector2();
		const panDelta = new Vector2();

		const dollyStart = new Vector2();
		const dollyEnd = new Vector2();
		const dollyDelta = new Vector2();

		const dollyDirection = new Vector3();
		const mouse = new Vector2();
		let performCursorZoom = false;

		const pointers = [];
		const pointerPositions = {};

		function getAutoRotationAngle( deltaTime ) {

			if ( deltaTime !== null ) {

				return ( 2 * Math.PI / 60 * scope.autoRotateSpeed ) * deltaTime;

			} else {

				return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

			}

		}

		function getZoomScale( delta ) {

			const normalized_delta = Math.abs( delta ) / ( 100 * ( window.devicePixelRatio | 0 ) );
			return Math.pow( 0.95, scope.zoomSpeed * normalized_delta );

		}

		function rotateLeft( angle ) {

			sphericalDelta.theta -= angle;

		}

		function rotateUp( angle ) {

			sphericalDelta.phi -= angle;

		}

		const panLeft = function () {

			const v = new Vector3();

			return function panLeft( distance, objectMatrix ) {

				v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
				v.multiplyScalar( - distance );

				panOffset.add( v );

			};

		}();

		const panUp = function () {

			const v = new Vector3();

			return function panUp( distance, objectMatrix ) {

				if ( scope.screenSpacePanning === true ) {

					v.setFromMatrixColumn( objectMatrix, 1 );

				} else {

					v.setFromMatrixColumn( objectMatrix, 0 );
					v.crossVectors( scope.object.up, v );

				}

				v.multiplyScalar( distance );

				panOffset.add( v );

			};

		}();

		// deltaX and deltaY are in pixels; right and down are positive
		const pan = function () {

			const offset = new Vector3();

			return function pan( deltaX, deltaY ) {

				const element = scope.domElement;

				if ( scope.object.isPerspectiveCamera ) {

					// perspective
					const position = scope.object.position;
					offset.copy( position ).sub( scope.target );
					let targetDistance = offset.length();

					// half of the fov is center to top of screen
					targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

					// we use only clientHeight here so aspect ratio does not distort speed
					panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
					panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

				} else if ( scope.object.isOrthographicCamera ) {

					// orthographic
					panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
					panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );

				} else {

					// camera neither orthographic nor perspective
					console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
					scope.enablePan = false;

				}

			};

		}();

		function dollyOut( dollyScale ) {

			if ( scope.object.isPerspectiveCamera || scope.object.isOrthographicCamera ) {

				scale /= dollyScale;

			} else {

				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
				scope.enableZoom = false;

			}

		}

		function dollyIn( dollyScale ) {

			if ( scope.object.isPerspectiveCamera || scope.object.isOrthographicCamera ) {

				scale *= dollyScale;

			} else {

				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
				scope.enableZoom = false;

			}

		}

		function updateZoomParameters( x, y ) {

			if ( ! scope.zoomToCursor ) {

				return;

			}

			performCursorZoom = true;

			const rect = scope.domElement.getBoundingClientRect();
			const dx = x - rect.left;
			const dy = y - rect.top;
			const w = rect.width;
			const h = rect.height;

			mouse.x = ( dx / w ) * 2 - 1;
			mouse.y = - ( dy / h ) * 2 + 1;

			dollyDirection.set( mouse.x, mouse.y, 1 ).unproject( scope.object ).sub( scope.object.position ).normalize();

		}

		function clampDistance( dist ) {

			return Math.max( scope.minDistance, Math.min( scope.maxDistance, dist ) );

		}

		//
		// event callbacks - update the object state
		//

		function handleMouseDownRotate( event ) {

			rotateStart.set( event.clientX, event.clientY );

		}

		function handleMouseDownDolly( event ) {

			updateZoomParameters( event.clientX, event.clientX );
			dollyStart.set( event.clientX, event.clientY );

		}

		function handleMouseDownPan( event ) {

			panStart.set( event.clientX, event.clientY );

		}

		function handleMouseMoveRotate( event ) {

			rotateEnd.set( event.clientX, event.clientY );

			rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

			const element = scope.domElement;

			rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height

			rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

			rotateStart.copy( rotateEnd );

			scope.update();

		}

		function handleMouseMoveDolly( event ) {

			dollyEnd.set( event.clientX, event.clientY );

			dollyDelta.subVectors( dollyEnd, dollyStart );

			if ( dollyDelta.y > 0 ) {

				dollyOut( getZoomScale( dollyDelta.y ) );

			} else if ( dollyDelta.y < 0 ) {

				dollyIn( getZoomScale( dollyDelta.y ) );

			}

			dollyStart.copy( dollyEnd );

			scope.update();

		}

		function handleMouseMovePan( event ) {

			panEnd.set( event.clientX, event.clientY );

			panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

			pan( panDelta.x, panDelta.y );

			panStart.copy( panEnd );

			scope.update();

		}

		function handleMouseWheel( event ) {

			updateZoomParameters( event.clientX, event.clientY );

			if ( event.deltaY < 0 ) {

				dollyIn( getZoomScale( event.deltaY ) );

			} else if ( event.deltaY > 0 ) {

				dollyOut( getZoomScale( event.deltaY ) );

			}

			scope.update();

		}

		function handleKeyDown( event ) {

			let needsUpdate = false;

			switch ( event.code ) {

				case scope.keys.UP:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						rotateUp( 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight );

					} else {

						pan( 0, scope.keyPanSpeed );

					}

					needsUpdate = true;
					break;

				case scope.keys.BOTTOM:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						rotateUp( - 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight );

					} else {

						pan( 0, - scope.keyPanSpeed );

					}

					needsUpdate = true;
					break;

				case scope.keys.LEFT:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						rotateLeft( 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight );

					} else {

						pan( scope.keyPanSpeed, 0 );

					}

					needsUpdate = true;
					break;

				case scope.keys.RIGHT:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						rotateLeft( - 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight );

					} else {

						pan( - scope.keyPanSpeed, 0 );

					}

					needsUpdate = true;
					break;

			}

			if ( needsUpdate ) {

				// prevent the browser from scrolling on cursor keys
				event.preventDefault();

				scope.update();

			}


		}

		function handleTouchStartRotate( event ) {

			if ( pointers.length === 1 ) {

				rotateStart.set( event.pageX, event.pageY );

			} else {

				const position = getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				rotateStart.set( x, y );

			}

		}

		function handleTouchStartPan( event ) {

			if ( pointers.length === 1 ) {

				panStart.set( event.pageX, event.pageY );

			} else {

				const position = getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				panStart.set( x, y );

			}

		}

		function handleTouchStartDolly( event ) {

			const position = getSecondPointerPosition( event );

			const dx = event.pageX - position.x;
			const dy = event.pageY - position.y;

			const distance = Math.sqrt( dx * dx + dy * dy );

			dollyStart.set( 0, distance );

		}

		function handleTouchStartDollyPan( event ) {

			if ( scope.enableZoom ) handleTouchStartDolly( event );

			if ( scope.enablePan ) handleTouchStartPan( event );

		}

		function handleTouchStartDollyRotate( event ) {

			if ( scope.enableZoom ) handleTouchStartDolly( event );

			if ( scope.enableRotate ) handleTouchStartRotate( event );

		}

		function handleTouchMoveRotate( event ) {

			if ( pointers.length == 1 ) {

				rotateEnd.set( event.pageX, event.pageY );

			} else {

				const position = getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				rotateEnd.set( x, y );

			}

			rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

			const element = scope.domElement;

			rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height

			rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

			rotateStart.copy( rotateEnd );

		}

		function handleTouchMovePan( event ) {

			if ( pointers.length === 1 ) {

				panEnd.set( event.pageX, event.pageY );

			} else {

				const position = getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				panEnd.set( x, y );

			}

			panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

			pan( panDelta.x, panDelta.y );

			panStart.copy( panEnd );

		}

		function handleTouchMoveDolly( event ) {

			const position = getSecondPointerPosition( event );

			const dx = event.pageX - position.x;
			const dy = event.pageY - position.y;

			const distance = Math.sqrt( dx * dx + dy * dy );

			dollyEnd.set( 0, distance );

			dollyDelta.set( 0, Math.pow( dollyEnd.y / dollyStart.y, scope.zoomSpeed ) );

			dollyOut( dollyDelta.y );

			dollyStart.copy( dollyEnd );

			const centerX = ( event.pageX + position.x ) * 0.5;
			const centerY = ( event.pageY + position.y ) * 0.5;

			updateZoomParameters( centerX, centerY );

		}

		function handleTouchMoveDollyPan( event ) {

			if ( scope.enableZoom ) handleTouchMoveDolly( event );

			if ( scope.enablePan ) handleTouchMovePan( event );

		}

		function handleTouchMoveDollyRotate( event ) {

			if ( scope.enableZoom ) handleTouchMoveDolly( event );

			if ( scope.enableRotate ) handleTouchMoveRotate( event );

		}

		//
		// event handlers - FSM: listen for events and reset state
		//

		function onPointerDown( event ) {

			if ( scope.enabled === false ) return;

			if ( pointers.length === 0 ) {

				scope.domElement.setPointerCapture( event.pointerId );

				scope.domElement.addEventListener( 'pointermove', onPointerMove );
				scope.domElement.addEventListener( 'pointerup', onPointerUp );

			}

			//

			addPointer( event );

			if ( event.pointerType === 'touch' ) {

				onTouchStart( event );

			} else {

				onMouseDown( event );

			}

		}

		function onPointerMove( event ) {

			if ( scope.enabled === false ) return;

			if ( event.pointerType === 'touch' ) {

				onTouchMove( event );

			} else {

				onMouseMove( event );

			}

		}

		function onPointerUp( event ) {

			removePointer( event );

			if ( pointers.length === 0 ) {

				scope.domElement.releasePointerCapture( event.pointerId );

				scope.domElement.removeEventListener( 'pointermove', onPointerMove );
				scope.domElement.removeEventListener( 'pointerup', onPointerUp );

			}

			scope.dispatchEvent( _endEvent );

			state = STATE.NONE;

		}

		function onMouseDown( event ) {

			let mouseAction;

			switch ( event.button ) {

				case 0:

					mouseAction = scope.mouseButtons.LEFT;
					break;

				case 1:

					mouseAction = scope.mouseButtons.MIDDLE;
					break;

				case 2:

					mouseAction = scope.mouseButtons.RIGHT;
					break;

				default:

					mouseAction = - 1;

			}

			switch ( mouseAction ) {

				case MOUSE.DOLLY:

					if ( scope.enableZoom === false ) return;

					handleMouseDownDolly( event );

					state = STATE.DOLLY;

					break;

				case MOUSE.ROTATE:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( scope.enablePan === false ) return;

						handleMouseDownPan( event );

						state = STATE.PAN;

					} else {

						if ( scope.enableRotate === false ) return;

						handleMouseDownRotate( event );

						state = STATE.ROTATE;

					}

					break;

				case MOUSE.PAN:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( scope.enableRotate === false ) return;

						handleMouseDownRotate( event );

						state = STATE.ROTATE;

					} else {

						if ( scope.enablePan === false ) return;

						handleMouseDownPan( event );

						state = STATE.PAN;

					}

					break;

				default:

					state = STATE.NONE;

			}

			if ( state !== STATE.NONE ) {

				scope.dispatchEvent( _startEvent );

			}

		}

		function onMouseMove( event ) {

			switch ( state ) {

				case STATE.ROTATE:

					if ( scope.enableRotate === false ) return;

					handleMouseMoveRotate( event );

					break;

				case STATE.DOLLY:

					if ( scope.enableZoom === false ) return;

					handleMouseMoveDolly( event );

					break;

				case STATE.PAN:

					if ( scope.enablePan === false ) return;

					handleMouseMovePan( event );

					break;

			}

		}

		function onMouseWheel( event ) {

			if ( scope.enabled === false || scope.enableZoom === false || state !== STATE.NONE ) return;

			event.preventDefault();

			scope.dispatchEvent( _startEvent );

			handleMouseWheel( event );

			scope.dispatchEvent( _endEvent );

		}

		function onKeyDown( event ) {

			if ( scope.enabled === false || scope.enablePan === false ) return;

			handleKeyDown( event );

		}

		function onTouchStart( event ) {

			trackPointer( event );

			switch ( pointers.length ) {

				case 1:

					switch ( scope.touches.ONE ) {

						case TOUCH.ROTATE:

							if ( scope.enableRotate === false ) return;

							handleTouchStartRotate( event );

							state = STATE.TOUCH_ROTATE;

							break;

						case TOUCH.PAN:

							if ( scope.enablePan === false ) return;

							handleTouchStartPan( event );

							state = STATE.TOUCH_PAN;

							break;

						default:

							state = STATE.NONE;

					}

					break;

				case 2:

					switch ( scope.touches.TWO ) {

						case TOUCH.DOLLY_PAN:

							if ( scope.enableZoom === false && scope.enablePan === false ) return;

							handleTouchStartDollyPan( event );

							state = STATE.TOUCH_DOLLY_PAN;

							break;

						case TOUCH.DOLLY_ROTATE:

							if ( scope.enableZoom === false && scope.enableRotate === false ) return;

							handleTouchStartDollyRotate( event );

							state = STATE.TOUCH_DOLLY_ROTATE;

							break;

						default:

							state = STATE.NONE;

					}

					break;

				default:

					state = STATE.NONE;

			}

			if ( state !== STATE.NONE ) {

				scope.dispatchEvent( _startEvent );

			}

		}

		function onTouchMove( event ) {

			trackPointer( event );

			switch ( state ) {

				case STATE.TOUCH_ROTATE:

					if ( scope.enableRotate === false ) return;

					handleTouchMoveRotate( event );

					scope.update();

					break;

				case STATE.TOUCH_PAN:

					if ( scope.enablePan === false ) return;

					handleTouchMovePan( event );

					scope.update();

					break;

				case STATE.TOUCH_DOLLY_PAN:

					if ( scope.enableZoom === false && scope.enablePan === false ) return;

					handleTouchMoveDollyPan( event );

					scope.update();

					break;

				case STATE.TOUCH_DOLLY_ROTATE:

					if ( scope.enableZoom === false && scope.enableRotate === false ) return;

					handleTouchMoveDollyRotate( event );

					scope.update();

					break;

				default:

					state = STATE.NONE;

			}

		}

		function onContextMenu( event ) {

			if ( scope.enabled === false ) return;

			event.preventDefault();

		}

		function addPointer( event ) {

			pointers.push( event.pointerId );

		}

		function removePointer( event ) {

			delete pointerPositions[ event.pointerId ];

			for ( let i = 0; i < pointers.length; i ++ ) {

				if ( pointers[ i ] == event.pointerId ) {

					pointers.splice( i, 1 );
					return;

				}

			}

		}

		function trackPointer( event ) {

			let position = pointerPositions[ event.pointerId ];

			if ( position === undefined ) {

				position = new Vector2();
				pointerPositions[ event.pointerId ] = position;

			}

			position.set( event.pageX, event.pageY );

		}

		function getSecondPointerPosition( event ) {

			const pointerId = ( event.pointerId === pointers[ 0 ] ) ? pointers[ 1 ] : pointers[ 0 ];

			return pointerPositions[ pointerId ];

		}

		//

		scope.domElement.addEventListener( 'contextmenu', onContextMenu );

		scope.domElement.addEventListener( 'pointerdown', onPointerDown );
		scope.domElement.addEventListener( 'pointercancel', onPointerUp );
		scope.domElement.addEventListener( 'wheel', onMouseWheel, { passive: false } );

		// force an update at start

		this.update();

	}

}



Object.assign(__M.OrbitControls, { OrbitControls });
})();
// ==== src/toon.js ====
__M.toon = {};
(function () {
'use strict';
const __THREE = window.THREE;
// ---------------------------------------------------------------------------
// Toon material system + geometry builder with automatic merging and
// inverted-hull outlines (one draw call per material bucket).
// ---------------------------------------------------------------------------
const THREE = __THREE;
const { mergeGeometries } = __M.BufferGeometryUtils;
const { OUTLINE } = __M.config;

// --- gradient ramp -----------------------------------------------------------
const _ramps = new Map();
function gradientMap(steps = 4) {
  if (_ramps.has(steps)) return _ramps.get(steps);
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    // ease the toe so shadows stay readable, keep a bright shoulder
    const v = Math.round(255 * Math.pow(t, 0.82) * (0.82 + 0.18 * t) + 26);
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = Math.min(255, v);
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _ramps.set(steps, tex);
  return tex;
}

// --- material cache ----------------------------------------------------------
const _matCache = new Map();
function cache(key, make) {
  let m = _matCache.get(key);
  if (!m) { m = make(); _matCache.set(key, m); }
  return m;
}

/** Cel-shaded surface. */
function toon(color, opts = {}) {
  const {
    emissive = 0x000000, emissiveIntensity = 1, flat = false, side = THREE.FrontSide,
    opacity = 1, transparent = false, map = null, depthWrite = true, ramp = 4,
    vertexColors = false, fog = true,
  } = opts;
  const key = `T|${color}|${emissive}|${emissiveIntensity}|${flat}|${side}|${opacity}|${transparent}|${map ? map.uuid : 0}|${ramp}|${vertexColors}|${fog}`;
  return cache(key, () => {
    const m = new THREE.MeshToonMaterial({
      color, gradientMap: gradientMap(ramp), side, opacity, transparent, depthWrite,
      vertexColors, fog, flatShading: !!flat,
    });
    if (map) m.map = map;
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
    return m;
  });
}

/** Unlit / self-illuminated surface. intensity > 1 goes HDR for the bloom pass. */
function glow(color, intensity = 1, opts = {}) {
  const { side = THREE.FrontSide, opacity = 1, transparent = false, map = null, fog = false, depthWrite = true } = opts;
  const key = `G|${color}|${intensity}|${side}|${opacity}|${transparent}|${map ? map.uuid : 0}|${fog}|${depthWrite}`;
  return cache(key, () => {
    const col = new THREE.Color(color).multiplyScalar(intensity);
    const m = new THREE.MeshBasicMaterial({ color: col, side, opacity, transparent, fog, depthWrite, toneMapped: false });
    if (map) m.map = map;
    return m;
  });
}

/** Additive glow card (light halos, light shafts, wet streaks). */
function additive(color, intensity = 1, opts = {}) {
  const { map = null, opacity = 1, depthWrite = false } = opts;
  const key = `A|${color}|${intensity}|${map ? map.uuid : 0}|${opacity}|${depthWrite}`;
  return cache(key, () => {
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity), map, transparent: true,
      opacity, blending: THREE.AdditiveBlending, depthWrite, fog: false, toneMapped: false,
      side: THREE.DoubleSide,
    });
    return m;
  });
}

// --- radial glow sprite ------------------------------------------------------
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.28, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  _glowTex = new THREE.CanvasTexture(cv);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

// --- outline shell -----------------------------------------------------------
const OUTLINE_MAT = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(OUTLINE.color) }, uPx: { value: OUTLINE.px } },
  vertexShader: /* glsl */`
    attribute float aOutline;
    uniform float uPx;
    varying float vA;
    void main() {
      vA = aOutline;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      float dist = max(-mv.z, 0.5);
      mv.xyz += n * aOutline * uPx * dist * 0.00062;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor;
    varying float vA;
    void main() {
      if (vA < 0.01) discard;
      gl_FragColor = vec4(uColor, 1.0);
    }`,
  side: THREE.BackSide,
  fog: false,
});

// --- geometry normalisation --------------------------------------------------
function prep(geo, outline) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g === geo) g = geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  const n = g.attributes.position.count;
  const a = new Float32Array(n).fill(outline);
  g.setAttribute('aOutline', new THREE.BufferAttribute(a, 1));
  return g;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function xform(pos, rot, scale) {
  _v.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
  _q.setFromEuler(_e);
  _s.set(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1);
  return _m4.compose(_v, _q, _s);
}

// ---------------------------------------------------------------------------
// Builder: author freely, merge at the end.
// ---------------------------------------------------------------------------
class Builder {
  constructor() {
    this.root = new THREE.Group();
    this.buckets = new Map(); // material -> [geometry]
    this.count = 0;
    this.tris = 0;
    this._geoCache = new Map();
  }

  _geo(key, make) {
    let g = this._geoCache.get(key);
    if (!g) { g = make(); this._geoCache.set(key, g); }
    return g;
  }

  boxGeo(w, h, d) {
    return this._geo(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
  }
  cylGeo(rt, rb, h, seg = 10, open = false) {
    return this._geo(`c${rt}_${rb}_${h}_${seg}_${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
  }
  planeGeo(w, h, sw = 1, sh = 1) {
    return this._geo(`p${w}_${h}_${sw}_${sh}`, () => new THREE.PlaneGeometry(w, h, sw, sh));
  }
  sphereGeo(r, seg = 12) {
    return this._geo(`s${r}_${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1)));
  }
  torusGeo(r, t, seg = 12, rings = 8) {
    return this._geo(`t${r}_${t}_${seg}_${rings}`, () => new THREE.TorusGeometry(r, t, rings, seg));
  }
  capsuleGeo(r, len, seg = 10) {
    return this._geo(`k${r}_${len}_${seg}`, () => new THREE.CapsuleGeometry(r, len, 4, seg));
  }

  /**
   * Add geometry. opts: { pos, rot, scale, outline, dynamic, parent, name }
   * outline: multiplier for the hull width (0 = no outline).
   */
  add(geo, mat, opts = {}) {
    const { pos, rot, scale, outline = 1, dynamic = false, parent = null, name = '' } = opts;
    this.count++;
    this.tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;

    if (dynamic) {
      const mesh = new THREE.Mesh(geo, mat);
      if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
      if (name) mesh.name = name;
      (parent || this.root).add(mesh);
      return mesh;
    }

    const g = prep(geo, outline);
    g.applyMatrix4(xform(pos, rot, scale));
    let arr = this.buckets.get(mat);
    if (!arr) { arr = []; this.buckets.set(mat, arr); }
    arr.push(g);
    return null;
  }

  box(w, h, d, mat, opts) { return this.add(this.boxGeo(w, h, d), mat, opts); }
  cyl(rt, rb, h, seg, mat, opts) { return this.add(this.cylGeo(rt, rb, h, seg), mat, opts); }
  /** Vertical plane, normal facing +z by default. */
  plane(w, h, mat, opts) { return this.add(this.planeGeo(w, h), mat, opts); }
  /** Horizontal plane (facing up). */
  plate(w, d, mat, opts = {}) {
    const rot = opts.rot ? opts.rot.slice() : [0, 0, 0];
    const o = { ...opts, rot: [rot[0] - Math.PI / 2, rot[1], rot[2]] };
    return this.add(this.planeGeo(w, d), mat, o);
  }
  sphere(r, seg, mat, opts) { return this.add(this.sphereGeo(r, seg), mat, opts); }

  /** Merge every static bucket into one mesh per material, then build outline shells. */
  finalize({ outlineMeshes = true } = {}) {
    let buckets = 0;
    for (const [mat, geos] of this.buckets) {
      if (!geos.length) continue;
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) { console.warn('merge failed for material', mat.type); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.frustumCulled = false;
      this.root.add(mesh);
      buckets++;
      if (outlineMeshes) {
        const shell = new THREE.Mesh(merged, OUTLINE_MAT);
        shell.frustumCulled = false;
        shell.renderOrder = -1;
        this.root.add(shell);
      }
      if (geos.length > 1) geos.forEach((g) => g.dispose && g.dispose());
    }
    this.buckets.clear();
    this._geoCache.clear();
    return { buckets, meshes: this.count, tris: Math.round(this.tris) };
  }
}

/** Convenience: build a small static group and return it merged. */
function mergeGroup(group) {
  const out = new THREE.Group();
  return out;
}

Object.assign(__M.toon, { gradientMap, toon, glow, additive, glowTexture, OUTLINE_MAT, Builder, mergeGroup });
})();
// ==== src/sky.js ====
__M.sky = {};
(function () {
'use strict';
const __THREE = window.THREE;
// ---------------------------------------------------------------------------
// Night sky: a deep indigo gradient with a faint warm city glow at the horizon.
// Also supplies the reflection backdrop for the wet street.
// ---------------------------------------------------------------------------
const THREE = __THREE;

function buildSky(scene) {
  const cv = document.createElement('canvas');
  cv.width = 8;
  cv.height = 512;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0.00, '#080c18');
  grd.addColorStop(0.24, '#0c1326');
  grd.addColorStop(0.42, '#131c34');
  grd.addColorStop(0.50, '#1c2542');
  // below the horizon: a soft blue-grey haze, never black — this is what the
  // mirrored camera sees, so it becomes the ambient sheen of the wet street
  grd.addColorStop(0.56, '#222c48');
  grd.addColorStop(0.66, '#26304c');
  grd.addColorStop(0.80, '#222a40');
  grd.addColorStop(1.00, '#1b2233');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 512);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  scene.background = tex;

  return { texture: tex, update() {} };
}

Object.assign(__M.sky, { buildSky });
})();
// ==== src/ground.js ====
__M.ground = {};
(function () {
'use strict';
const __THREE = window.THREE;
// ---------------------------------------------------------------------------
// The base plate + the wet street surface.
//  * a 2048px canvas paints every road marking, tile, gutter and puddle mask
//  * a custom shader mixes that paint with a real planar reflection
//  * rain ripples distort the reflection and add micro sparkle
// ---------------------------------------------------------------------------
const THREE = __THREE;
const { BASE, STREET, WALK, COLORS, makeRng } = __M.config;
const { toon, Builder } = __M.toon;

const S = 2048; // canvas resolution
const PX = S / BASE.size;

const wx = (x) => (x + BASE.half) * PX;
const wz = (z) => (z + BASE.half) * PX;

function rgba(hex, a = 1) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Canvas paint
// ---------------------------------------------------------------------------
function paintGround() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const rng = makeRng(20240917);

  const rect = (x0, z0, x1, z1) => [wx(x0), wz(z0), (x1 - x0) * PX, (z1 - z0) * PX];

  // --- 1. everything starts as damp dark ground -----------------------------
  g.fillStyle = rgba(COLORS.asphaltDark);
  g.fillRect(0, 0, S, S);

  // base asphalt everywhere (the "outside the streets" areas are mostly hidden
  // under sidewalks and buildings, but the edge of the base should still read)
  const fill = (x0, z0, x1, z1, col) => {
    const [a, b, w, h] = rect(x0, z0, x1, z1);
    g.fillStyle = col; g.fillRect(a, b, w, h);
  };

  fill(-13, 4.6, 13, 11.0, rgba(0x373b48)); // main street
  fill(-9.6, -13, -5.0, 4.6, rgba(0x353946)); // side street
  fill(8.4, -13, 10.0, -0.6, rgba(0x2b2e38)); // east alley
  fill(-3.6, -0.6, 13, 4.6, rgba(0x3e424f)); // store forecourt (lighter concrete)
  fill(-3.6, -13, -1.0, -0.6, rgba(0x383c48)); // side lot beside the store
  fill(-5.0, -13, -3.6, 4.6, rgba(0x3a3e4a)); // pavement strip along the side street

  // --- 2. asphalt aggregate noise ------------------------------------------
  for (let i = 0; i < 26000; i++) {
    const x = rng() * S, y = rng() * S;
    const v = rng();
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.012 + rng() * 0.03})` : `rgba(0,0,0,${0.02 + rng() * 0.05})`;
    g.fillRect(x, y, 1 + rng() * 2.2, 1 + rng() * 2.2);
  }
  // broad tonal blotches (oil / wear)
  for (let i = 0; i < 90; i++) {
    const x = rng() * S, y = rng() * S, r = 30 + rng() * 190;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng() > 0.42;
    grd.addColorStop(0, dark ? 'rgba(0,0,0,0.16)' : 'rgba(150,160,180,0.07)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // --- 3. concrete joint lines on the forecourt ----------------------------
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 2.4;
  for (let x = -3.6; x <= 13; x += 2.6) {
    g.beginPath(); g.moveTo(wx(x), wz(-0.6)); g.lineTo(wx(x), wz(4.6)); g.stroke();
  }

  // --- 4. road markings ----------------------------------------------------
  g.lineCap = 'butt';
  // main street edge lines
  g.strokeStyle = rgba(COLORS.paint, 0.62);
  g.lineWidth = 0.14 * PX;
  for (const z of [5.05, 10.55]) {
    g.beginPath(); g.moveTo(wx(-13), wz(z)); g.lineTo(wx(13), wz(z)); g.stroke();
  }
  // dashed centre line
  g.strokeStyle = rgba(COLORS.paint, 0.5);
  g.lineWidth = 0.12 * PX;
  for (let x = -12.6; x < 13; x += 2.0) {
    g.beginPath(); g.moveTo(wx(x), wz(7.8)); g.lineTo(wx(x + 1.1), wz(7.8)); g.stroke();
  }
  // side street edge lines
  g.strokeStyle = rgba(COLORS.paint, 0.4);
  g.lineWidth = 0.12 * PX;
  for (const x of [-9.35, -5.25]) {
    g.beginPath(); g.moveTo(wx(x), wz(-13)); g.lineTo(wx(x), wz(4.55)); g.stroke();
  }

  // crosswalk across the main street, aligned with the store driveway
  const cwX0 = 0.7, cwX1 = 3.7;
  for (let x = cwX0; x < cwX1 - 0.01; x += 0.78) {
    g.fillStyle = rgba(COLORS.paint, 0.72);
    g.fillRect(wx(x), wz(4.95), 0.46 * PX, 5.9 * PX);
  }
  // stop line for the side street
  g.fillStyle = rgba(COLORS.paint, 0.66);
  g.fillRect(wx(-9.6), wz(4.72), 4.6 * PX, 0.4 * PX);
  // give-way triangles on the side street
  g.fillStyle = rgba(COLORS.paint, 0.5);
  for (let i = 0; i < 5; i++) {
    const cx = -9.3 + i * 0.95;
    g.beginPath();
    g.moveTo(wx(cx), wz(5.55)); g.lineTo(wx(cx + 0.6), wz(5.55)); g.lineTo(wx(cx + 0.3), wz(6.4));
    g.closePath(); g.fill();
  }

  // parking stalls in the forecourt (three bays + hatched no-park zone)
  g.strokeStyle = rgba(COLORS.paint, 0.6);
  g.lineWidth = 0.13 * PX;
  const bays = [1.1, 3.7, 6.3, 8.9];
  for (const x of bays) {
    g.beginPath(); g.moveTo(wx(x), wz(-0.5)); g.lineTo(wx(x), wz(2.7)); g.stroke();
  }
  g.beginPath(); g.moveTo(wx(1.1), wz(2.7)); g.lineTo(wx(8.9), wz(2.7)); g.stroke();
  // wheel stops
  g.fillStyle = rgba(0x9aa2b2, 0.85);
  for (const x of bays.slice(0, 3)) {
    g.fillRect(wx(x + 0.35), wz(-0.42), 2.0 * PX, 0.2 * PX);
  }
  // diagonal hatching near the store entrance
  g.strokeStyle = rgba(COLORS.paint, 0.34);
  g.lineWidth = 0.1 * PX;
  for (let i = 0; i < 12; i++) {
    const x = 9.4 + i * 0.42;
    g.beginPath(); g.moveTo(wx(x), wz(-0.4)); g.lineTo(wx(x - 1.0), wz(2.6)); g.stroke();
  }

  // --- 5. gutters, grates, manholes ---------------------------------------
  // gutter channel hugging the north curb of the main street
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.fillRect(wx(-13), wz(4.6), 26 * PX, 0.34 * PX);
  g.fillStyle = 'rgba(0,0,0,0.26)';
  g.fillRect(wx(-13), wz(10.66), 26 * PX, 0.34 * PX);
  g.fillRect(wx(-5.0), wz(-13), 0.34 * PX, 17.6 * PX);
  g.fillRect(wx(-9.94), wz(-13), 0.34 * PX, 17.6 * PX);

  // drain grates
  const grate = (x, z, w, d, rot = 0) => {
    g.save();
    g.translate(wx(x), wz(z));
    if (rot) g.rotate(rot);
    g.fillStyle = 'rgba(12,14,20,0.85)';
    g.fillRect(-w * PX / 2, -d * PX / 2, w * PX, d * PX);
    g.fillStyle = 'rgba(120,130,150,0.5)';
    for (let i = 0; i < Math.floor(w * 6); i++) {
      const px = -w * PX / 2 + 0.08 * PX + i * 0.17 * PX;
      g.fillRect(px, -d * PX / 2 + 0.03 * PX, 0.07 * PX, d * PX - 0.06 * PX);
    }
    g.restore();
  };
  grate(2.4, 4.78, 0.9, 0.34);
  grate(-6.9, 4.78, 0.9, 0.34);
  grate(9.6, 4.78, 0.9, 0.34);
  grate(-5.15, -2.2, 0.34, 0.9);
  grate(-5.15, -7.4, 0.34, 0.9);

  // manhole covers
  const manhole = (x, z, r) => {
    g.save(); g.translate(wx(x), wz(z));
    g.fillStyle = 'rgba(30,33,42,0.9)';
    g.beginPath(); g.arc(0, 0, r * PX, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,130,150,0.34)';
    g.lineWidth = 0.05 * PX;
    g.beginPath(); g.arc(0, 0, r * PX * 0.86, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * PX * 0.2, Math.sin(a) * r * PX * 0.2);
      g.lineTo(Math.cos(a) * r * PX * 0.8, Math.sin(a) * r * PX * 0.8);
      g.stroke();
    }
    g.restore();
  };
  manhole(-7.6, 8.4, 0.42);
  manhole(5.6, 9.2, 0.42);
  manhole(-7.2, -3.0, 0.36);

  // --- 6. wetness / puddle mask (separate grayscale map) --------------------
  // black = damp, white = standing water / strong mirror
  const wcv = document.createElement('canvas');
  wcv.width = wcv.height = S;
  const wg = wcv.getContext('2d');
  wg.fillStyle = '#6e6e6e'; // damp asphalt everywhere
  wg.fillRect(0, 0, S, S);
  // softer patches of extra dampness
  for (let i = 0; i < 60; i++) {
    const x = rng() * S, y = rng() * S, r = 60 + rng() * 260;
    const grd = wg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    wg.fillStyle = grd;
    wg.beginPath(); wg.arc(x, y, r, 0, Math.PI * 2); wg.fill();
  }

  const puddle = (x, z, rx, rz, strength, seed) => {
    const r2 = makeRng(seed);
    wg.save();
    wg.translate(wx(x), wz(z));
    wg.scale(rx * PX, rz * PX);
    const grd = wg.createRadialGradient(0, 0, 0.1, 0, 0, 1);
    grd.addColorStop(0, `rgba(255,255,255,${strength})`);
    grd.addColorStop(0.62, `rgba(255,255,255,${strength * 0.9})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    wg.fillStyle = grd;
    wg.beginPath();
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = 0.72 + r2() * 0.42;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) wg.moveTo(px, py); else wg.lineTo(px, py);
    }
    wg.closePath();
    wg.fill();
    wg.restore();
  };

  // big pooling along the gutters and in the low centre of the streets
  puddle(-8.5, 5.4, 3.4, 1.0, 0.62, 11);
  puddle(2.0, 5.6, 3.0, 0.9, 0.6, 12);
  puddle(7.5, 10.2, 3.6, 1.1, 0.58, 13);
  puddle(-11.4, 9.0, 2.2, 2.6, 0.5, 14);
  puddle(-6.2, 0.5, 1.4, 2.6, 0.55, 15);
  puddle(-7.4, -6.5, 1.7, 3.2, 0.6, 16);
  puddle(-6.6, -11.0, 1.5, 2.4, 0.52, 17);
  puddle(9.2, -5.0, 0.6, 3.0, 0.62, 18);
  puddle(9.3, -10.5, 0.62, 2.4, 0.55, 19);
  puddle(4.0, 1.6, 2.6, 1.2, 0.66, 20);
  puddle(6.8, 0.9, 2.0, 1.0, 0.6, 21);
  puddle(1.2, 2.9, 2.2, 0.9, 0.55, 22);
  puddle(11.4, 2.2, 1.6, 1.2, 0.5, 23);
  puddle(-2.0, -4.0, 1.2, 2.2, 0.5, 24);

  // scattered small puddles
  for (let i = 0; i < 70; i++) {
    const x = -13 + rng() * 26, z = -13 + rng() * 26;
    puddle(x, z, 0.35 + rng() * 1.1, 0.3 + rng() * 0.9, 0.3 + rng() * 0.4, 300 + i);
  }

  // puddles are strongest right where the store light spills
  puddle(2.4, 0.6, 3.2, 1.5, 0.55, 41);
  puddle(6.4, 1.2, 2.6, 1.3, 0.5, 42);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;

  const wetTex = new THREE.CanvasTexture(wcv);
  wetTex.colorSpace = THREE.NoColorSpace;
  wetTex.anisotropy = 4;
  wetTex.minFilter = THREE.LinearMipmapLinearFilter;
  wetTex.magFilter = THREE.LinearFilter;
  wetTex.generateMipmaps = true;
  wetTex.needsUpdate = true;

  return { albedo: tex, wet: wetTex };
}

// ---------------------------------------------------------------------------
// sidewalk tile texture (small tiling canvas)
// ---------------------------------------------------------------------------
function tileTexture() {
  const T = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = T;
  const g = cv.getContext('2d');
  g.fillStyle = rgba(COLORS.sidewalk);
  g.fillRect(0, 0, T, T);
  const rng = makeRng(77);
  // 4x4 tiles with grout
  const n = 4, s = T / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 0.92 + rng() * 0.16;
      const c = new THREE.Color(COLORS.sidewalk).multiplyScalar(v);
      g.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
      g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
      // tactile dots on the corner tile
      if (i === 0 && j === 0) {
        g.fillStyle = 'rgba(0,0,0,0.10)';
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          g.beginPath(); g.arc(s * (0.28 + a * 0.22), s * (0.28 + b * 0.22), s * 0.055, 0, 6.3); g.fill();
        }
      }
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.16)';
  g.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, T); g.stroke();
    g.beginPath(); g.moveTo(0, i * s); g.lineTo(T, i * s); g.stroke();
  }
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    g.fillRect(rng() * T, rng() * T, 2, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------------------
// Wet ground mesh with planar reflection
// ---------------------------------------------------------------------------
const GROUND_VS = /* glsl */`
  uniform mat4 uTextureMatrix;
  varying vec2 vUvG;
  varying vec4 vProj;
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vUvG = uv;
    vProj = uTextureMatrix * wp;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GROUND_FS = /* glsl */`
  precision highp float;
  uniform sampler2D tGround;
  uniform sampler2D tWet;
  uniform sampler2D tReflect;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uTime;
  uniform vec3 uAmbient;
  uniform vec3 uSky;
  uniform float uRipAmp;
  uniform float uWaveScale;
  uniform float uReflStrength;
  uniform float uWaterDark;
  uniform float uSparkle;
  uniform float uPoolStrength;
  uniform float uDebugRefl;
  uniform vec3 uLightPos[8];
  uniform vec3 uLightCol[8];
  uniform vec2 uLightRad[8];
  uniform int uLightCount;
  varying vec2 vUvG;
  varying vec4 vProj;
  varying vec3 vWorld;

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  // two octaves of expanding rain rings; returns a screen-space offset
  vec2 ripples(vec2 p, float t, float scale, float speed) {
    vec2 acc = vec2(0.0);
    vec2 cell = floor(p / scale);
    for (int j = 0; j <= 1; j++) {
      for (int i = 0; i <= 1; i++) {
        vec2 c = cell + vec2(float(i), float(j));
        vec2 h = hash22(c * 1.37);
        vec2 center = (c + vec2(0.15) + 0.7 * h) * scale;
        float ph = fract(t * speed + h.x * 5.13 + h.y * 2.71);
        vec2 d = p - center;
        float r = length(d);
        float rad = ph * scale * 0.85;
        float ring = exp(-abs(r - rad) * 22.0 / scale) * (1.0 - ph) * (1.0 - ph);
        acc += (d / max(r, 1e-4)) * ring * sin((r - rad) * 34.0 / scale);
      }
    }
    return acc;
  }

  // one directional wave train; returns d(height)/d(p)
  vec2 waveTrain(vec2 p, vec2 dir, float wavelength, float amp, float speed, float t) {
    float k = 6.2831853 / wavelength;
    float ph = dot(p, dir) * k + t * speed;
    return dir * (k * amp) * cos(ph);
  }

  // 水面斜率：以雨点同心圆环为主，只留极轻的慢波让水面不完全静止
  vec2 waterGrad(vec2 p, float t, float dist) {
    // 高频分量随距离衰减：符合物理，也避免远处闪烁
    float near = 1.0 / (1.0 + dist * 0.05);
    vec2 g = vec2(0.0);
    g += waveTrain(p, normalize(vec2(1.00, 0.30)), 5.0, 0.0030, 0.35, t);
    // 三层不同尺度 / 不同网格相位的雨点环，避免出现规则网格感
    g += ripples(p, t, 0.42, 0.90) * 0.95 * near;
    g += ripples(p * 1.70 + 7.0, t * 1.35, 0.60, 0.70) * 0.75 * near;
    g += ripples(p * 2.90 + 21.0, t * 1.70, 0.85, 0.55) * 0.55 * near;
    return g;
  }

  void main() {
    vec4 ground = texture2D(tGround, vUvG);
    vec3 albedo = mix(ground.rgb / 12.92, pow((ground.rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, ground.rgb));
    float wet = texture2D(tWet, vUvG).r;
    wet = clamp(wet * 1.45, 0.0, 1.0);

    vec3 viewVec = cameraPosition - vWorld;
    float dist = length(viewVec);
    vec3 V = viewVec / max(dist, 1e-4);

    // water surface slope -> perturbed reflection direction -> screen offset.
    // This is the physical route: the wave normal tilts the reflected ray, and
    // tilts along the view direction show up as vertical wobble on screen.
    vec2 wg = waterGrad(vWorld.xz, uTime, dist) * uRipAmp;
    vec3 N = normalize(vec3(-wg.x, 1.0, -wg.y));
    vec3 R = reflect(-V, N);
    vec3 R0 = vec3(-V.x, V.y, -V.z);
    vec3 dR = R - R0;
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec2 disp = vec2(dot(dR, camRight), dot(dR, camUp)) * uWaveScale * mix(0.6, 1.0, wet);

    vec4 proj = vProj;
    proj.xy += disp * proj.w;
    vec2 puv = proj.xy / proj.w;
    // keep the mirror from smearing when the projected uv leaves the render target
    vec2 dd = abs(puv - 0.5) * 2.0;
    float valid = smoothstep(1.45, 0.98, max(dd.x, dd.y));
    // 紧凑高斯模糊：只让反射轻微发虚，绝不产生重影
    float blurK = 0.0035 + 0.00018 * dist;
    float b1 = proj.w * blurK, b2 = proj.w * blurK * 2.5;
    vec3 refl =
        texture2DProj(tReflect, proj).rgb * 0.40
      + (texture2DProj(tReflect, proj + vec4(0.0, b1, 0.0, 0.0)).rgb
       + texture2DProj(tReflect, proj - vec4(0.0, b1, 0.0, 0.0)).rgb) * 0.20
      + (texture2DProj(tReflect, proj + vec4(0.0, b2, 0.0, 0.0)).rgb
       + texture2DProj(tReflect, proj - vec4(0.0, b2, 0.0, 0.0)).rgb) * 0.10;
    refl *= valid;


    // view angle: grazing views reflect much more
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.2);
    float mirror = mix(0.48, 0.92, wet) * mix(0.92, 1.0, fres);

    int dbg = int(uDebugRefl + 0.5);
    if (dbg == 1) { gl_FragColor = vec4(texture2D(tWet, vUvG).rrr, 1.0); return; }
    if (dbg == 2) { gl_FragColor = vec4(texture2D(tGround, vUvG).rgb, 1.0); return; }
    if (dbg == 3) { gl_FragColor = vec4(wet, fres, dot(refl, vec3(0.3333)), 1.0); return; }
    if (dbg == 4) { gl_FragColor = vec4(valid, mirror, dot(refl, vec3(0.3333)), 1.0); return; }
    if (dbg == 5) { gl_FragColor = vec4(refl.rgb, 1.0); return; }
    if (dbg == 6) { gl_FragColor = vec4(0.43, 0.86, 0.21, 1.0); return; }
    vec3 col = albedo * uAmbient * mix(1.0, 0.5, uWaterDark * wet);
    col = mix(col, refl * vec3(1.0, 0.99, 1.04) * uReflStrength, clamp(mirror, 0.0, 0.9));
    // deep water reads darker: the wetter the surface, the more light it swallows
    col *= mix(1.0, 0.78, uWaterDark * wet);
    // faint sky sheen so wet asphalt is not pure black
    col += uSky * wet * (0.16 + 0.30 * fres) * (1.0 - 0.75 * uWaterDark);

    // light pools on the pavement
    for (int i = 0; i < 8; i++) {
      if (i >= uLightCount) break;
      vec3 d = uLightPos[i] - vWorld;
      float dist2 = dot(d, d);
      float r = uLightRad[i].x;
      float att = 1.0 / (1.0 + dist2 / (r * r));
      col += uLightCol[i] * att * uLightRad[i].y * uPoolStrength * mix(0.55, 1.0, wet);
    }

    // wave crests catch the light
    float spark = length(wg);
    col += vec3(0.5, 0.62, 0.85) * spark * uSparkle * wet;

    // fog
    float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, clamp(f, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

class WetGround extends THREE.Mesh {
  constructor(renderer, size = BASE.size) {
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const textureMatrix = new THREE.Matrix4();
    const maps = paintGround();
    const uniforms = {
      tGround: { value: null },
      tWet: { value: null },
      tReflect: { value: null },
      uTextureMatrix: { value: textureMatrix },
      uFogColor: { value: new THREE.Color(0x0a0f1a) },
      uFogDensity: { value: 0.0125 },
      uTime: { value: 0 },
      uAmbient: { value: new THREE.Vector3(4.2, 4.4, 5.2) },
      uSky: { value: new THREE.Vector3(0.07, 0.095, 0.155) },
      uRipAmp: { value: 1 },
      uWaveScale: { value: 0.6 },
      uReflStrength: { value: 0.85 },
      uWaterDark: { value: 0.55 },
      uSparkle: { value: 0.02 },
      uPoolStrength: { value: 1.2 },
      uDebugRefl: { value: 0 },
      uLightPos: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
      uLightCol: { value: Array.from({ length: 8 }, () => new THREE.Color(0, 0, 0)) },
      uLightRad: { value: Array.from({ length: 8 }, () => new THREE.Vector2(4, 1)) },
      uLightCount: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VS, fragmentShader: GROUND_FS, uniforms, fog: false,
    });
    super(geo, mat);
    this.frustumCulled = false;
    uniforms.tGround.value = maps.albedo;
    uniforms.tWet.value = maps.wet;
    this.uniforms = uniforms;
    this.renderer = renderer;
    this.textureMatrix = textureMatrix;
    this._lights = 0;

    // reflection target - resolution follows the canvas so zooming never
    // magnifies a fixed-size mirror. No mipmaps: a mipmapped half-float target
    // can be incomplete on some drivers and then samples as black.
    this.rt = new THREE.WebGLRenderTarget(1024, 1024, {
      type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    this.rt.texture.generateMipmaps = false;
    this.setSize(renderer.domElement.width, renderer.domElement.height);
    this.virtualCamera = new THREE.PerspectiveCamera();
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 100000);
    this.normal = new THREE.Vector3();
    this.view = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.rot = new THREE.Matrix4();
    this.rwp = new THREE.Vector3();
    this.cwp = new THREE.Vector3();
    this.hideInMirror = [];
    uniforms.tReflect.value = this.rt.texture;
    this.clearColor = new THREE.Color(0x232c42);
    // one permanent global clipping plane, parked far below except during the
    // mirror pass — avoids the driver-sensitive oblique projection entirely
    renderer.clippingPlanes = [this.clipPlane];
  }

  setSize(w, h) {
    const s = Math.min(this.maxSize || 896, Math.max(512, Math.round(Math.max(w, h) * 0.55)));
    if (this.rt.width !== s) {
      this.rt.setSize(s, s);
      this.rt.texture.generateMipmaps = false;
      this.rt.texture.minFilter = THREE.LinearFilter;
    }
  }

  addLight(pos, color, radius, intensity) {
    const i = this._lights++;
    if (i >= 8) return;
    this.uniforms.uLightPos.value[i].set(pos[0], pos[1], pos[2]);
    this.uniforms.uLightCol.value[i].set(color);
    this.uniforms.uLightRad.value[i].set(radius, intensity);
    this.uniforms.uLightCount.value = this._lights;
  }

  update(t) { this.uniforms.uTime.value = t; }

  /** Renders the mirror target. Call once per frame, before the main render. */
  renderMirror(scene, camera) {
    const renderer = this.renderer;
    const u = this.uniforms;
    this.rwp.setFromMatrixPosition(this.matrixWorld);
    this.cwp.setFromMatrixPosition(camera.matrixWorld);
    this.rot.extractRotation(this.matrixWorld);
    this.normal.set(0, 1, 0).applyMatrix4(this.rot);
    this.view.subVectors(this.rwp, this.cwp);
    if (this.view.dot(this.normal) > 0) return;
    this.view.reflect(this.normal).negate().add(this.rwp);

    this.rot.extractRotation(camera.matrixWorld);
    this.lookAt.set(0, 0, -1).applyMatrix4(this.rot).add(this.cwp);
    this.target.subVectors(this.rwp, this.lookAt);
    this.target.reflect(this.normal).negate().add(this.rwp);

    const vc = this.virtualCamera;
    vc.position.copy(this.view);
    vc.up.set(0, 1, 0).applyMatrix4(this.rot).reflect(this.normal);
    vc.lookAt(this.target);
    vc.near = camera.near;
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(
      0.5, 0, 0, 0.5,
      0, 0.5, 0, 0.5,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1,
    );
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    u.uTextureMatrix.value.copy(this.textureMatrix);

    const prevVisible = this.visible;
    const prevRT = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    this.visible = false;
    // anything below the water plane must not leak into the mirror
    for (const o of this.hideInMirror) o.visible = false;
    renderer.shadowMap.autoUpdate = false;
    // clip the world under y = 0; the plane is parked far away the rest of the frame
    this.clipPlane.constant = 0.003;
    renderer.setClearColor(this.clearColor, 1);
    renderer.setRenderTarget(this.rt);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear();
    renderer.render(scene, vc);
    this.clipPlane.constant = 100000;
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.autoUpdate = prevShadow;
    for (const o of this.hideInMirror) o.visible = true;
    this.visible = prevVisible;
  }

  _reflect() {
    // mirrors are driven from the main loop via renderMirror()
  }
}

// ---------------------------------------------------------------------------
// assemble base + sidewalks + curbs
// ---------------------------------------------------------------------------
function buildGround(builder, renderer, scene) {
  const tileTex = tileTexture();

  // --- wet ground ----------------------------------------------------------
  const ground = new WetGround(renderer);
  ground.position.y = 0.0;
  scene.add(ground);

  // --- plinth (stepped, collectible-model feel) ----------------------------
  // kept in its own merged group so it can be hidden while the mirror renders
  const plinthBuilder = new Builder();
  const plinth = (w, h, d, y, col) => {
    plinthBuilder.box(w, h, d, toon(col, { ramp: 3 }), { pos: [0, y, 0], outline: 0 });
  };
  // NOTE: the top slab stops 2cm below y=0 — it must never be coplanar with the
  // wet ground plane, or the two z-fight and the mirror flickers on and off.
  plinth(26.5, 0.34, 26.5, -0.19, 0x272b36);
  plinth(26.05, 0.92, 26.05, -0.82, 0x1e212a);
  plinth(25.4, 0.16, 25.4, -1.36, 0x161820);
  plinth(24.2, 0.1, 24.2, -1.47, 0x101218);
  plinthBuilder.finalize({ outlineMeshes: false });
  scene.add(plinthBuilder.root);
  ground.hideInMirror.push(plinthBuilder.root);

  // --- sidewalks -----------------------------------------------------------
  const H = STREET.curbH;

  const slab = (x0, z0, x1, z1, texScale = 1.35) => {
    const w = x1 - x0, d = z1 - z0;
    const t = tileTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / texScale)), Math.max(1, Math.round(d / texScale)));
    builder.box(w, H, d, toon(0xffffff, { map: t }), {
      pos: [(x0 + x1) / 2, H / 2, (z0 + z1) / 2], outline: 0.9,
    });
  };

  // south sidewalk
  slab(-13, WALK.southZ0, 13, WALK.southZ1);
  // west sidewalk of the side street
  slab(-13, -13, -9.6, WALK.southZ0);
  // east sidewalk of the side street
  slab(-5.0, -13, -3.6, 4.6);

  // curb noses (slightly lighter, catches the street light)
  const curbMat = toon(COLORS.curb, { ramp: 3 });
  const curb = (x0, z0, x1, z1) => {
    builder.box(x1 - x0, H + 0.04, z1 - z0, curbMat, {
      pos: [(x0 + x1) / 2, (H + 0.04) / 2, (z0 + z1) / 2], outline: 1.0,
    });
  };
  curb(-13, WALK.southZ0 - 0.02, 13, WALK.southZ0 + STREET.curbW);
  curb(-9.6 - STREET.curbW, -13, -9.6, 4.6);
  curb(-5.0, -13, -5.0 + STREET.curbW, 4.6);

  return { ground };
}

Object.assign(__M.ground, { tileTexture, WetGround, buildGround });
})();
// ==== src/postfx.js ====
__M.postfx = {};
(function () {
'use strict';
const __THREE = window.THREE;
// ---------------------------------------------------------------------------
// Post processing: HDR scene target -> bright pass -> 3-level gaussian bloom
// -> filmic composite with vignette, grain and a soft toon grade.
// ---------------------------------------------------------------------------
const THREE = __THREE;

const QUAD_VS = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FS = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  uniform float uSoft;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float k = smoothstep(uThreshold, uThreshold + uSoft, l);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

const BLUR_FS = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 uDir;      // texel-sized direction
  void main() {
    vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
    s += texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
    s += texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(s, 1.0);
  }
`;

const COMPOSITE_FS = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tScene;
  uniform sampler2D tBloom0;
  uniform sampler2D tBloom1;
  uniform sampler2D tBloom2;
  uniform float uBloom;
  uniform float uExposure;
  uniform float uTime;
  uniform vec2 uRes;

  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  vec3 lin2srgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  void main() {
    vec2 uv = vUv;
    // gentle lens breathing / chromatic separation towards the frame edge
    vec2 d = uv - 0.5;
    float r2 = dot(d, d);
    vec2 off = d * r2 * 0.0022;
    vec3 col;
    col.r = texture2D(tScene, uv + off).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - off).b;

    vec3 bloom = texture2D(tBloom0, uv).rgb * 0.55
               + texture2D(tBloom1, uv).rgb * 0.32
               + texture2D(tBloom2, uv).rgb * 0.24;
    col += bloom * uBloom;

    col *= uExposure;
    col = aces(col);

    // cool the shadows, warm the highlights — the classic night-anime grade
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col * vec3(0.92, 0.97, 1.08), col * vec3(1.06, 1.005, 0.94), smoothstep(0.18, 0.85, lum));
    // saturation lift
    col = mix(vec3(lum), col, 1.18);

    // vignette
    float vig = smoothstep(1.25, 0.20, r2 * 1.6);
    col *= mix(0.82, 1.0, vig);

    // fine grain so the flats never look dead
    float g = hash(uv * uRes + fract(uTime) * 91.7) - 0.5;
    col += g * 0.018 * (1.0 - lum * 0.6);

    gl_FragColor = vec4(lin2srgb(col), 1.0);
  }
`;

class Pass {
  constructor(material) {
    this.material = material;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  render(renderer, target) {
    renderer.setRenderTarget(target || null);
    renderer.clear(true, false, false);
    renderer.render(this.scene, this.camera);
  }
}

class PostFX {
  constructor(renderer, samples = 4) {
    this.renderer = renderer;
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false, samples };
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.sceneRT.texture.minFilter = THREE.LinearFilter;
    this.sceneRT.texture.magFilter = THREE.LinearFilter;

    const small = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    this.brightRT = new THREE.WebGLRenderTarget(1, 1, small);
    this.blurA = [0, 1, 2].map(() => new THREE.WebGLRenderTarget(1, 1, small));
    this.blurB = [0, 1, 2].map(() => new THREE.WebGLRenderTarget(1, 1, small));
    for (const rt of [this.brightRT, ...this.blurA, ...this.blurB]) {
      rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
      rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    }

    this.brightPass = new Pass(new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: BRIGHT_FS, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: 1.28 }, uSoft: { value: 0.7 } },
    }));
    this.blurPass = new Pass(new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
    }));
    this.composite = new Pass(new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: COMPOSITE_FS, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tBloom0: { value: null }, tBloom1: { value: null }, tBloom2: { value: null },
        uBloom: { value: 1.05 }, uExposure: { value: 1.62 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      },
    }));
    this.setSize(1, 1);
  }

  setSize(w, h) {
    const dpr = this.renderer.getPixelRatio();
    const W = Math.max(1, Math.floor(w * dpr));
    const H = Math.max(1, Math.floor(h * dpr));
    this.sceneRT.setSize(W, H);
    this.brightRT.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1));
    for (let i = 0; i < 3; i++) {
      const s = 2 << (i + 1); // 4, 8, 16
      this.blurA[i].setSize(Math.max(1, Math.floor(W / s)), Math.max(1, Math.floor(H / s)));
      this.blurB[i].setSize(Math.max(1, Math.floor(W / s)), Math.max(1, Math.floor(H / s)));
    }
    this.composite.material.uniforms.uRes.value.set(W, H);
    this.size = [W, H];
  }

  render(scene, camera, time) {
    const r = this.renderer;
    const prevAutoClear = r.autoClear;
    r.autoClear = true;

    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    // bright pass
    this.brightPass.material.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.brightPass.render(r, this.brightRT);

    // gaussian chain
    let src = this.brightRT.texture;
    for (let i = 0; i < 3; i++) {
      const a = this.blurA[i], b = this.blurB[i];
      const tw = 1 / a.width, th = 1 / a.height;
      this.blurPass.material.uniforms.tDiffuse.value = src;
      this.blurPass.material.uniforms.uDir.value.set(tw * (1.0 + i * 0.6), 0);
      this.blurPass.render(r, a);
      this.blurPass.material.uniforms.tDiffuse.value = a.texture;
      this.blurPass.material.uniforms.uDir.value.set(0, th * (1.0 + i * 0.6));
      this.blurPass.render(r, b);
      src = b.texture;
    }

    const u = this.composite.material.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBloom0.value = this.blurB[0].texture;
    u.tBloom1.value = this.blurB[1].texture;
    u.tBloom2.value = this.blurB[2].texture;
    u.uTime.value = time;
    this.composite.render(r, null);
    r.autoClear = prevAutoClear;
  }
}

Object.assign(__M.postfx, { PostFX });
})();
// ==== src/rain.js ====
__M.rain = {};
(function () {
'use strict';
const __THREE = window.THREE;
// ---------------------------------------------------------------------------
// Rain: falling streaks, ground splashes and drips off the awnings / eaves.
// Everything is instanced and animated on the GPU.
// ---------------------------------------------------------------------------
const THREE = __THREE;
const { makeRng } = __M.config;

const BOX = 30;      // rain volume tile size — centred on the diorama, not the camera
const HEIGHT = 26;

function streakTexture() {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0.0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grd.addColorStop(0.85, 'rgba(255,255,255,0.95)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 16, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ringTexture() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 4;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 9;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const RAIN_VS = /* glsl */`
  attribute vec3 aOffset;
  attribute vec2 aParams;   // fall speed, random phase
  attribute float aLen;
  uniform float uTime;
  uniform vec3 uCam;
  uniform float uBox;
  uniform float uHeight;
  uniform vec3 uWind;
  varying float vFade;
  varying vec2 vUvS;

  void main() {
    vec3 p = aOffset;
    p.y = mod(aOffset.y - uTime * aParams.x, uHeight);
    p += uWind * (p.y * 0.06);

    vec3 toCam = normalize(uCam - p);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
    vec3 up = normalize(vec3(0.0, 1.0, 0.0) + uWind * 0.12);

    float w = 0.016 + 0.012 * aParams.y;
    vec3 wp = p + right * position.x * w + up * position.y * aLen;

    float d = length(uCam - wp);
    // keep the shower inside the model footprint
    float outside = 1.0 - smoothstep(12.5, 15.5, length(p.xz));
    vFade = exp(-d * 0.014) * (0.55 + 0.45 * aParams.y) * outside;
    vUvS = uv;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const RAIN_FS = /* glsl */`
  precision mediump float;
  uniform sampler2D tStreak;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying vec2 vUvS;
  void main() {
    vec4 t = texture2D(tStreak, vUvS);
    float a = t.a * vFade * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const SPLASH_VS = /* glsl */`
  attribute vec3 aOffset;
  attribute vec2 aParams;   // phase, size
  uniform float uTime;
  uniform vec3 uCam;
  uniform float uBox;
  varying vec2 vUvS;
  varying float vFade;
  void main() {
    vec3 p = aOffset;
    float ph = fract(uTime * 1.15 + aParams.x);
    float s = (0.10 + ph * 0.42) * aParams.y;
    vFade = (1.0 - ph) * (1.0 - ph) * exp(-length(uCam - p) * 0.035)
          * (1.0 - smoothstep(12.5, 15.5, length(p.xz)));
    vUvS = uv;

    vec3 right = vec3(1.0, 0.0, 0.0);
    vec3 fwd = vec3(0.0, 0.0, 1.0);
    vec3 wp = p + right * position.x * s + fwd * position.y * s;
    wp.y += 0.012;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const SPLASH_FS = /* glsl */`
  precision mediump float;
  uniform sampler2D tRing;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUvS;
  varying float vFade;
  void main() {
    vec4 t = texture2D(tRing, vUvS);
    float a = t.a * vFade * 0.5 * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// drips falling from a list of world-space origins
const DRIP_VS = /* glsl */`
  attribute vec3 aOrigin;
  attribute vec2 aParams;   // phase, speed
  attribute float aLen;
  uniform float uTime;
  varying float vFade;
  varying vec2 vUvS;
  void main() {
    float cycle = 2.6 + aParams.x * 2.4;
    float t = mod(uTime * aParams.y + aParams.x * 7.0, cycle);
    float fall = t * 6.5;
    vec3 p = aOrigin - vec3(0.0, fall, 0.0);
    float alive = step(0.15, t) * step(p.y, aOrigin.y) * step(0.0, p.y);
    vFade = alive * (0.55 + 0.45 * aParams.x) * (1.0 - smoothstep(cycle * 0.72, cycle, t));
    vec3 right = vec3(1.0, 0.0, 0.0);
    vec3 wp = p + right * position.x * 0.016 + vec3(0.0, 1.0, 0.0) * position.y * aLen;
    vUvS = uv;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const DRIP_FS = /* glsl */`
  precision mediump float;
  uniform sampler2D tStreak;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying vec2 vUvS;
  void main() {
    vec4 t = texture2D(tStreak, vUvS);
    float a = t.a * vFade * 0.85 * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

function buildRain(scene, { ground, splash: wantSplash = true } = {}) {
  const rng = makeRng(9182);
  const group = new THREE.Group();
  scene.add(group);

  const streakTex = streakTexture();
  const ringTex = ringTexture();

  // --- falling rain ---------------------------------------------------------
  const N = 3200;
  const plane = new THREE.PlaneGeometry(1, 1);
  const rainGeo = new THREE.InstancedBufferGeometry();
  rainGeo.index = plane.index;
  rainGeo.attributes.position = plane.attributes.position;
  rainGeo.attributes.uv = plane.attributes.uv;
  const off = new Float32Array(N * 3);
  const par = new Float32Array(N * 2);
  const len = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    off[i * 3 + 0] = (rng() - 0.5) * BOX;
    off[i * 3 + 1] = rng() * HEIGHT;
    off[i * 3 + 2] = (rng() - 0.5) * BOX;
    par[i * 2 + 0] = 13 + rng() * 11;
    par[i * 2 + 1] = rng();
    len[i] = 0.42 + rng() * 0.62;
  }
  rainGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
  rainGeo.setAttribute('aParams', new THREE.InstancedBufferAttribute(par, 2));
  rainGeo.setAttribute('aLen', new THREE.InstancedBufferAttribute(len, 1));

  const rainMat = new THREE.ShaderMaterial({
    vertexShader: RAIN_VS, fragmentShader: RAIN_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: BOX },
      uHeight: { value: HEIGHT }, uWind: { value: new THREE.Vector3(-0.05, 0, 0.02) },
      tStreak: { value: streakTex }, uColor: { value: new THREE.Color(0xa8c6e6) }, uOpacity: { value: 0.78 },
    },
  });
  const rain = new THREE.Mesh(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.renderOrder = 6;
  group.add(rain);

  // --- splashes -------------------------------------------------------------
  const M = 260;
  const splashGeo = new THREE.InstancedBufferGeometry();
  splashGeo.index = plane.index;
  splashGeo.attributes.position = plane.attributes.position;
  splashGeo.attributes.uv = plane.attributes.uv;
  const soff = new Float32Array(M * 3);
  const spar = new Float32Array(M * 2);
  for (let i = 0; i < M; i++) {
    soff[i * 3 + 0] = (rng() - 0.5) * BOX;
    soff[i * 3 + 1] = 0.0;
    soff[i * 3 + 2] = (rng() - 0.5) * BOX;
    spar[i * 2 + 0] = rng();
    spar[i * 2 + 1] = 0.6 + rng() * 1.1;
  }
  splashGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(soff, 3));
  splashGeo.setAttribute('aParams', new THREE.InstancedBufferAttribute(spar, 2));
  const splashMat = new THREE.ShaderMaterial({
    vertexShader: SPLASH_VS, fragmentShader: SPLASH_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: BOX },
      tRing: { value: ringTex }, uColor: { value: new THREE.Color(0x8fb2d8) },
      uOpacity: { value: 1 },
    },
  });
  const splash = new THREE.Mesh(splashGeo, splashMat);
  splash.frustumCulled = false;
  splash.renderOrder = 5;
  if (wantSplash) group.add(splash);

  // --- drips off the eaves --------------------------------------------------
  const drips = [
    // storefront awning edge
    [-0.4, 3.16, 0.42], [1.6, 3.16, 0.42], [3.6, 3.16, 0.42], [5.6, 3.16, 0.42], [7.6, 3.16, 0.42],
    // store roof line
    [-0.9, 4.32, 0.55], [2.4, 4.32, 0.55], [5.6, 4.32, 0.55], [8.2, 4.32, 0.55],
    // west eave
    [-1.02, 4.32, -3.2], [-1.02, 4.32, -6.4], [-1.02, 4.32, -8.6],
    // neighbour building eaves
    [10.05, 6.6, -2.2], [10.05, 6.6, -5.6], [10.05, 6.6, -9.4],
    [-9.62, 5.6, -1.0], [-9.62, 5.6, -4.6], [-9.62, 5.6, -8.0],
    // traffic-light gantry
    [-7.6, 4.9, 5.3],
  ];
  const D = drips.length;
  const dripGeo = new THREE.InstancedBufferGeometry();
  dripGeo.index = plane.index;
  dripGeo.attributes.position = plane.attributes.position;
  dripGeo.attributes.uv = plane.attributes.uv;
  const dof = new Float32Array(D * 3);
  const dpa = new Float32Array(D * 2);
  const dle = new Float32Array(D);
  drips.forEach((d, i) => {
    dof[i * 3] = d[0]; dof[i * 3 + 1] = d[1]; dof[i * 3 + 2] = d[2];
    dpa[i * 2] = rng(); dpa[i * 2 + 1] = 0.7 + rng() * 0.6;
    dle[i] = 0.16 + rng() * 0.16;
  });
  dripGeo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(dof, 3));
  dripGeo.setAttribute('aParams', new THREE.InstancedBufferAttribute(dpa, 2));
  dripGeo.setAttribute('aLen', new THREE.InstancedBufferAttribute(dle, 1));
  const dripMat = new THREE.ShaderMaterial({
    vertexShader: DRIP_VS, fragmentShader: DRIP_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 }, tStreak: { value: streakTex },
      uColor: { value: new THREE.Color(0xbdd4ee) }, uOpacity: { value: 1 },
    },
  });
  const drip = new THREE.Mesh(dripGeo, dripMat);
  drip.frustumCulled = false;
  drip.renderOrder = 6;
  group.add(drip);

  const cam = new THREE.Vector3();
  return {
    group,
    /** 0 = 无雨, 1 = 默认, >1 = 更大 */
    setAmount(v) {
      const k = Math.max(0, v);
      rainMat.uniforms.uOpacity.value = 0.78 * k;
      splashMat.uniforms.uOpacity.value = k;
      dripMat.uniforms.uOpacity.value = k;
      rain.visible = k > 0.01;
      splash.visible = wantSplash && k > 0.01;
      drip.visible = k > 0.01;
    },
    update(t, dt, camera) {
      camera.getWorldPosition(cam);
      rainMat.uniforms.uTime.value = t;
      rainMat.uniforms.uCam.value.copy(cam);
      splashMat.uniforms.uTime.value = t;
      splashMat.uniforms.uCam.value.copy(cam);
      dripMat.uniforms.uTime.value = t;
    },
  };
}

Object.assign(__M.rain, { buildRain });
})();
// ==== src/props.js ====
__M.props = {};
(function () {
'use strict';
const __THREE = window.THREE;
// ---------------------------------------------------------------------------
// Everything around the store: vending machines, bicycles, poles and wires,
// street lamps, signals, guardrails, signs, bins, the alley and the two
// neighbouring buildings that frame the corner.
// ---------------------------------------------------------------------------
const THREE = __THREE;
const { COLORS, STREET, WALK, NEIGHBOUR_E, NEIGHBOUR_W, ALLEY_E, makeRng, clamp, lerp } = __M.config;
const { toon, glow, additive, glowTexture } = __M.toon;

function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const JP = '"Yu Gothic","YuGothic","MS Gothic","Meiryo",sans-serif';
const EN = '"Segoe UI",Arial,sans-serif';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// --- vending machine front ---------------------------------------------------
function vendingTexture(accent = '#d93b3b') {
  const W = 256, Hh = 512;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = '#eef1f6'; g.fillRect(0, 0, W, Hh);
  g.fillStyle = accent; g.fillRect(0, 0, W, 92);
  g.fillStyle = '#ffffff';
  g.font = `bold 46px ${JP}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('つめたい', W / 2, 46);
  // product rows behind glass
  const rng = makeRng(31);
  const pal = ['#e8543f', '#f2a03d', '#4fb06d', '#3f8fe8', '#d94f9a', '#5ad0c0', '#f7d94c'];
  for (let r = 0; r < 3; r++) {
    const y = 118 + r * 108;
    g.fillStyle = 'rgba(20,24,32,0.10)';
    g.fillRect(12, y + 76, W - 24, 8);
    for (let i = 0; i < 4; i++) {
      const x = 26 + i * 58;
      g.fillStyle = pal[(i + r * 3) % pal.length];
      roundRect(g, x, y, 44, 74, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(x + 6, y + 14, 32, 12);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(x + 6, y + 34, 20, 8);
    }
  }
  // price strip
  g.fillStyle = '#ffffff'; g.fillRect(0, 452, W, 60);
  g.fillStyle = '#1b2b52';
  g.font = `bold 34px ${EN}`;
  g.fillText('¥130', W / 2, 482);
  return tex(c);
}

// --- building facade ---------------------------------------------------------
function facadeTexture({ w = 512, h = 1024, floors = 3, base = '#3a3f4c', win = '#2a2f3c', lit = 0.45, seed = 5, shopfront = false }) {
  const [c, g] = cvs(w, h);
  const rng = makeRng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  // tile texture
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    g.fillRect(rng() * w, rng() * h, 3, 3);
  }
  const fh = h / floors;
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh;
    // floor separation band
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, y0 + fh - 8, w, 8);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, y0 + fh - 14, w, 5);
    if (shopfront && f === floors - 1) continue;
    // windows
    const cols = Math.max(2, Math.round(w / 150));
    const ww = (w / cols) * 0.52;
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * (w / cols) - ww / 2;
      const wh = fh * 0.46;
      const wy = y0 + fh * 0.2;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x - 5, wy - 5, ww + 10, wh + 10);
      const on = rng() < lit;
      if (on) {
        const grd = g.createLinearGradient(x, wy, x, wy + wh);
        grd.addColorStop(0, '#ffe4b0');
        grd.addColorStop(1, '#f0b878');
        g.fillStyle = grd;
      } else {
        g.fillStyle = '#232836';
      }
      g.fillRect(x, wy, ww, wh);
      if (on) {
        // curtain / sill silhouette
        g.fillStyle = 'rgba(120,90,60,0.35)';
        g.fillRect(x, wy, ww, wh * (0.18 + rng() * 0.3));
      }
      // frame mullion
      g.fillStyle = 'rgba(20,24,32,0.7)';
      g.fillRect(x + ww / 2 - 2, wy, 4, wh);
      g.fillStyle = 'rgba(150,160,180,0.25)';
      g.fillRect(x - 5, wy + wh + 2, ww + 10, 5);
    }
    // balcony rail on some floors
    if (f % 2 === 1) {
      g.fillStyle = 'rgba(30,34,44,0.75)';
      g.fillRect(0, y0 + fh * 0.72, w, fh * 0.16);
      g.fillStyle = 'rgba(160,170,190,0.3)';
      for (let x = 0; x < w; x += 12) g.fillRect(x, y0 + fh * 0.72, 3, fh * 0.16);
    }
  }
  // drain pipes
  for (const x of [0.06, 0.52, 0.94]) {
    g.fillStyle = 'rgba(24,28,36,0.8)';
    g.fillRect(w * x, 0, 12, h);
    g.fillStyle = 'rgba(140,150,170,0.2)';
    g.fillRect(w * x, 0, 3, h);
  }
  // rain stains
  for (let i = 0; i < 26; i++) {
    const x = rng() * w, ww = 8 + rng() * 40, y = rng() * h * 0.6;
    const grd = g.createLinearGradient(0, y, 0, y + h * 0.5);
    grd.addColorStop(0, 'rgba(0,0,0,0.20)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x, y, ww, h * 0.5);
  }
  return tex(c);
}

// --- signs -------------------------------------------------------------------
function roadSignTexture(text, sub, bg = '#2f6fe0') {
  const W = 512, Hh = 192;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = '#ffffff'; g.lineWidth = 8;
  roundRect(g, 10, 10, W - 20, Hh - 20, 16); g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 84px ${JP}`;
  g.fillText(text, W / 2, sub ? Hh * 0.4 : Hh / 2);
  if (sub) { g.font = `500 44px ${EN}`; g.fillText(sub, W / 2, Hh * 0.76); }
  return tex(c);
}

function boardTexture() {
  const W = 512, Hh = 384;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = '#c9c4b4'; g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#8d8778'; g.fillRect(0, 0, W, 26);
  const rng = makeRng(88);
  const cols = ['#f0e8d0', '#e8dcc0', '#f4e8cc'];
  for (let i = 0; i < 5; i++) {
    const x = 24 + (i % 3) * 160, y = 46 + Math.floor(i / 3) * 168;
    g.fillStyle = cols[i % 3];
    g.fillRect(x, y, 140, 150);
    g.fillStyle = `hsl(${Math.floor(rng() * 360)},55%,62%)`;
    g.fillRect(x + 12, y + 14, 116, 54);
    g.fillStyle = 'rgba(60,60,70,0.55)';
    for (let l = 0; l < 4; l++) g.fillRect(x + 12, y + 82 + l * 16, 116 - rng() * 50, 7);
  }
  return tex(c);
}

function shutterTexture() {
  const W = 256, Hh = 256;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = '#4a4f5a'; g.fillRect(0, 0, W, Hh);
  for (let y = 0; y < Hh; y += 12) {
    g.fillStyle = y % 24 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.18)';
    g.fillRect(0, y, W, 8);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 200; i++) g.fillRect(Math.random() * W, Math.random() * Hh, 2, 2);
  return tex(c);
}

// ---------------------------------------------------------------------------
function buildProps(builder, scene, ctx = {}) {
  const rng = makeRng(31415);
  const group = new THREE.Group();
  scene.add(group);
  const dyn = { signals: [], flickers: [], lamps: [] };

  const M = {
    metal: toon(COLORS.metal),
    metalDark: toon(COLORS.metalDark),
    steel: toon(0x8d94a3),
    concrete: toon(0x8f8b84, { ramp: 3 }),
    concreteDark: toon(0x6e6a64, { ramp: 3 }),
    red: toon(COLORS.vendingRed),
    blue: toon(0x2f6fe0),
    white: toon(0xe8ebf0),
    rubber: toon(0x23262e),
    glassDark: toon(0x1d2230),
    foliage: toon(COLORS.foliage),
    foliageLit: toon(COLORS.foliageLit),
    wood: toon(COLORS.wood),
    lampGlow: glow(0xffd9a0, 2.1),
    lampGlowCool: glow(0xcfe4ff, 1.9),
    neon: glow(0xffffff, 1.5),
    binBody: toon(0x4f5666),
  };

  // =========================================================================
  // vending machines
  // =========================================================================
  function vending(x, z, rotY, accent) {
    const t = vendingTexture(accent);
    const face = glow(0xffffff, 1.12, { map: t });
    dyn.flickers.push(face);
    const w = 1.05, d = 0.72, h = 1.92;
    // body
    builder.box(w, h, d, M.white, { pos: [x, h / 2, z], rot: [0, rotY, 0], outline: 1.1 });
    const fwd = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
    const px = x + fwd.x * (d / 2 + 0.012), pz = z + fwd.z * (d / 2 + 0.012);
    builder.plane(w - 0.06, h - 0.08, face, { pos: [px, h / 2 + 0.02, pz], rot: [0, rotY, 0] });
    // base + top cap
    builder.box(w + 0.05, 0.12, d + 0.05, M.metalDark, { pos: [x, 0.06, z], rot: [0, rotY, 0], outline: 0.9 });
    builder.box(w + 0.05, 0.08, d + 0.05, M.metalDark, { pos: [x, h - 0.02, z], rot: [0, rotY, 0], outline: 0.9 });
    // coin slot panel
    const sx = x + fwd.x * (d / 2 + 0.05), sz = z + fwd.z * (d / 2 + 0.05);
    builder.box(0.16, 0.3, 0.06, M.metalDark, { pos: [sx + fwd.z * 0.36, 1.15, sz - fwd.x * 0.36], rot: [0, rotY, 0], outline: 0.7 });
    // glow card
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.2, h * 1.5), additive(0xfff0d0, 0.7, { map: glowTexture() }));
    card.position.set(x + fwd.x * 0.42, h * 0.5, z + fwd.z * 0.42);
    card.rotation.y = rotY;
    card.renderOrder = 4;
    group.add(card);
    if (ctx.ground) ctx.ground.addLight([x + fwd.x * 0.9, 1.3, z + fwd.z * 0.9], [1.0, 0.9, 0.72], 3.4, 0.55);
  }
  vending(-1.62, -2.6, -Math.PI / 2, '#d93b3b');
  vending(-9.05, -4.6, Math.PI / 2, '#2f6fe0');
  vending(11.9, -0.2, Math.PI, '#27b07a');

  // =========================================================================
  // bicycles
  // =========================================================================
  function bicycle(x, z, rotY, frameCol) {
    const F = toon(frameCol);
    const R = 0.325;
    const cos = Math.cos(rotY), sin = Math.sin(rotY);
    // local (along the frame, up, sideways) -> world
    const P = (dx, dy, dz) => [x + dx * cos + dz * sin, dy, z - dx * sin + dz * cos];
    const WR = [0, rotY, 0]; // wheel plane: axis runs across the frame

    // --- wheels: tyre + rim + spokes, no solid disc -------------------------
    for (const dx of [-0.52, 0.52]) {
      const p = P(dx, R, 0);
      builder.add(builder.torusGeo(R, 0.036, 18, 8), M.rubber, { pos: p, rot: WR, outline: 0.6 });
      builder.add(builder.torusGeo(R - 0.052, 0.018, 18, 6), M.steel, { pos: p, rot: WR, outline: 0.4 });
      builder.box(0.05, 0.05, 0.1, M.steel, { pos: p, rot: WR, outline: 0.4 }); // hub
      for (let s = 0; s < 3; s++) {
        const a = (s / 3) * Math.PI;
        builder.box(R * 1.85, 0.013, 0.013, M.steel, {
          pos: p, rot: [0, rotY, a], outline: 0,
        });
      }
    }

    // --- frame --------------------------------------------------------------
    const tube = (a, b, r = 0.022) => {
      const pa = new THREE.Vector3(...a), pb = new THREE.Vector3(...b);
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const len = pa.distanceTo(pb);
      const dir = pb.clone().sub(pa).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const e = new THREE.Euler().setFromQuaternion(quat);
      builder.cyl(r, r, len, 8, F, { pos: [mid.x, mid.y, mid.z], rot: [e.x, e.y, e.z], outline: 0.5 });
    };
    const rear = P(-0.52, R, 0), front = P(0.52, R, 0);
    const crank = P(-0.06, 0.3, 0), seatTop = P(-0.11, 0.72, 0), headTop = P(0.3, 0.78, 0);
    tube(rear, crank, 0.024);        // chain stay
    tube(rear, seatTop, 0.022);      // seat stay
    tube(crank, seatTop, 0.026);     // seat tube
    tube(crank, headTop, 0.026);     // down tube
    tube(seatTop, headTop, 0.024);   // top tube
    tube(headTop, front, 0.022);     // fork
    tube(P(0.3, 0.78, 0), P(0.36, 0.9, 0), 0.02); // stem
    tube(P(-0.52, R, 0), P(-0.52, 0.62, 0), 0.018); // seat post rear
    tube(P(-0.52, 0.62, 0), P(-0.14, 0.62, 0), 0.016); // rear rack

    // handlebar
    builder.cyl(0.017, 0.017, 0.44, 8, M.steel, { pos: P(0.36, 0.9, 0), rot: [Math.PI / 2, 0, rotY], outline: 0.5 });
    for (const dz of [-0.19, 0.19]) {
      builder.cyl(0.025, 0.025, 0.1, 8, M.rubber, { pos: P(0.36, 0.9, dz), rot: [Math.PI / 2, 0, rotY], outline: 0.4 });
    }
    // saddle
    builder.box(0.26, 0.055, 0.11, M.rubber, { pos: P(-0.13, 0.76, 0), rot: [0, rotY, 0], outline: 0.6 });
    builder.cyl(0.02, 0.02, 0.14, 6, M.steel, { pos: P(-0.12, 0.69, 0), outline: 0.4 });
    // front basket (dark body with a wire rim and floor)
    const fenderMat = toon(0x7b828e, { ramp: 3 });
    const bk = P(0.47, 0.58, 0);
    builder.box(0.25, 0.19, 0.21, toon(0x2f353f, { ramp: 2 }), { pos: bk, rot: [0, rotY, 0], outline: 0.4 });
    builder.box(0.27, 0.022, 0.23, fenderMat, { pos: [bk[0], bk[1] + 0.1, bk[2]], rot: [0, rotY, 0], outline: 0.5 });
    builder.box(0.27, 0.022, 0.23, fenderMat, { pos: [bk[0], bk[1] - 0.095, bk[2]], rot: [0, rotY, 0], outline: 0.5 });
    // basket stay to the fork
    builder.cyl(0.014, 0.014, 0.2, 6, M.steel, { pos: P(0.5, 0.44, 0), outline: 0.4 });
    // fenders over both wheels (thin, mid grey, hugging the tyre)
    for (const dx of [-0.52, 0.52]) {
      builder.add(new THREE.TorusGeometry(R + 0.052, 0.011, 6, 14, Math.PI * 1.05), fenderMat, {
        pos: P(dx, R, 0), rot: [0, rotY, 0.28], outline: 0.4,
      });
    }
    // chainring + chain
    builder.box(0.17, 0.17, 0.022, M.steel, { pos: P(-0.06, 0.3, 0.05), rot: [0, rotY, 0], outline: 0.4 });
    builder.box(0.5, 0.022, 0.016, M.metalDark, {
      pos: P(-0.29, 0.31, 0.05), rot: [0, rotY, 0.05], outline: 0.3,
    });
    // pedals + crank
    builder.cyl(0.05, 0.05, 0.06, 8, M.steel, { pos: crank, rot: [0, 0, Math.PI / 2], outline: 0.4 });
    for (const s of [-1, 1]) {
      builder.box(0.1, 0.02, 0.05, M.rubber, {
        pos: P(-0.06 + s * 0.12, 0.3 + s * 0.12, 0.08 * s), rot: [0, rotY, 0], outline: 0.4,
      });
    }
    // kickstand
    builder.cyl(0.015, 0.015, 0.3, 6, M.steel, { pos: P(-0.2, 0.16, 0.13), rot: [0.3, rotY, 0.18], outline: 0.4 });
  }
  bicycle(-2.9, -5.4, 0.32, 0x3d4a63);
  bicycle(-2.75, -6.5, 0.18, 0x6a4a52);
  bicycle(7.15, 2.3, -0.5, 0x2f4a52);

  // bike rack
  for (let i = 0; i < 4; i++) {
    const x = -3.05, z = -5.0 - i * 0.62;
    builder.cyl(0.03, 0.03, 0.62, 8, M.steel, { pos: [x, 0.31, z], outline: 0.6 });
    builder.add(builder.torusGeo(0.16, 0.022, 10, 6, Math.PI), M.steel, {
      pos: [x, 0.62, z], rot: [0, 0, 0], outline: 0.5,
    });
  }

  // =========================================================================
  // bins, umbrella stand, sandwich board
  // =========================================================================
  function bin(x, z, rotY, label) {
    const fwd = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
    builder.box(0.52, 0.78, 0.46, M.binBody, { pos: [x, 0.39, z], rot: [0, rotY, 0], outline: 1.1 });
    // lid with a slot
    builder.box(0.56, 0.12, 0.5, M.metalDark, { pos: [x, 0.84, z], rot: [0, rotY, 0], outline: 0.9 });
    builder.box(0.3, 0.04, 0.12, M.metal, {
      pos: [x + fwd.x * 0.2, 0.9, z + fwd.z * 0.2], rot: [0, rotY, 0], outline: 0.4,
    });
    // recycling label
    builder.box(0.34, 0.24, 0.03, label === 'pet' ? M.blue : M.metal, {
      pos: [x + fwd.x * 0.245, 0.6, z + fwd.z * 0.245], rot: [0, rotY, 0], outline: 0.5,
    });
    // opening
    builder.box(0.3, 0.2, 0.05, M.metalDark, {
      pos: [x + fwd.x * 0.25, 0.38, z + fwd.z * 0.25], rot: [0, rotY, 0], outline: 0.5,
    });
    // feet
    for (const s of [-1, 1]) {
      builder.box(0.08, 0.06, 0.08, M.metalDark, {
        pos: [x + fwd.z * 0.18 * s, 0.03, z - fwd.x * 0.18 * s], rot: [0, rotY, 0], outline: 0.4,
      });
    }
  }
  bin(4.55, 0.15, 0, 'pet');
  bin(5.25, 0.15, 0, 'can');
  bin(-2.5, -0.05, Math.PI / 2, 'pet');

  // umbrella stand outside the door
  builder.cyl(0.2, 0.16, 0.68, 14, M.metal, { pos: [1.15, 0.34, 0.28], outline: 1.1 });
  for (let i = 0; i < 5; i++) {
    const a = i * 1.27;
    const c = toon([0x2f6fe0, 0xd94f9a, 0xe8e2d4, 0x3f8fe8, 0x4fb06d][i]);
    builder.cyl(0.026, 0.026, 0.86, 6, c, {
      pos: [1.15 + Math.cos(a) * 0.08, 0.62, 0.28 + Math.sin(a) * 0.08],
      rot: [0.14 * Math.cos(a), 0, 0.14 * Math.sin(a)], outline: 0.5,
    });
  }

  // A-frame sandwich board
  (() => {
    const x = 6.05, z = 0.5, rot = -0.35;
    builder.box(0.62, 0.9, 0.05, M.white, { pos: [x, 0.52, z], rot: [0.2, rot, 0], outline: 0.9 });
    builder.box(0.62, 0.9, 0.05, M.white, { pos: [x, 0.52, z + 0.02], rot: [-0.2, rot, 0], outline: 0.9 });
    builder.box(0.5, 0.12, 0.03, M.blue, { pos: [x + 0.03, 0.78, z], rot: [0.2, rot, 0], outline: 0.4 });
  })();

  // =========================================================================
  // street lamps, utility poles, wires
  // =========================================================================
  const wireMat = toon(0x151820);
  function wire(a, b, sag = 0.5, r = 0.016) {
    const mid = new THREE.Vector3((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - sag, (a[2] + b[2]) / 2);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...a), mid, new THREE.Vector3(...b),
    ]);
    const geo = new THREE.TubeGeometry(curve, 14, r, 5, false);
    builder.add(geo, wireMat, { outline: 0.4 });
  }

  function pole(x, z, h = 8.4) {
    builder.cyl(0.13, 0.17, h, 10, M.concrete, { pos: [x, h / 2, z], outline: 1.1 });
    // crossarms
    for (const [y, w] of [[h - 0.55, 1.5], [h - 1.15, 1.2]]) {
      builder.box(w, 0.09, 0.09, M.concreteDark, { pos: [x, y, z], outline: 0.8 });
      for (const dx of [-w / 2 + 0.12, w / 2 - 0.12]) {
        builder.cyl(0.05, 0.05, 0.16, 8, M.steel, { pos: [x + dx, y + 0.14, z], outline: 0.5 });
      }
    }
    // transformer
    builder.cyl(0.24, 0.24, 0.62, 12, M.steel, { pos: [x + 0.34, h - 2.3, z], outline: 1.1 });
    builder.cyl(0.26, 0.26, 0.06, 12, M.metalDark, { pos: [x + 0.34, h - 1.97, z], outline: 0.7 });
    // small lamp arm
    builder.cyl(0.05, 0.05, 0.9, 8, M.metalDark, { pos: [x - 0.45, h - 1.9, z], rot: [0, 0, Math.PI / 2], outline: 0.6 });
    builder.box(0.34, 0.12, 0.24, M.metalDark, { pos: [x - 0.88, h - 2.0, z], outline: 0.8 });
    builder.box(0.3, 0.05, 0.2, M.lampGlow, { pos: [x - 0.88, h - 2.08, z], outline: 0 });
    return { x, z, h };
  }

  const p1 = pole(-10.7, 12.1, 8.8);
  const p2 = pole(1.4, 12.4, 8.4);
  const p3 = pole(-6.9, -11.6, 7.6);
  const p4 = pole(12.5, 4.1, 7.2);
  // wire spans
  wire([p1.x - 0.6, p1.h - 0.55, p1.z], [p2.x - 0.6, p2.h - 0.55, p2.z], 1.5);
  wire([p1.x - 0.6, p1.h - 1.15, p1.z], [p2.x - 0.6, p2.h - 1.15, p2.z], 1.7);
  wire([p1.x + 0.6, p1.h - 0.55, p1.z], [p2.x + 0.6, p2.h - 0.55, p2.z], 1.5);
  wire([p1.x + 0.6, p1.h - 1.15, p1.z], [p2.x + 0.6, p2.h - 1.15, p2.z], 1.7);
  wire([p1.x, p1.h - 2.6, p1.z], [p3.x, p3.h - 1.4, p3.z], 1.9, 0.02);
  wire([p1.x, p1.h - 3.0, p1.z], [p3.x, p3.h - 1.8, p3.z], 2.1, 0.02);
  wire([p4.x, p4.h - 1.1, p4.z], [p2.x + 0.4, p2.h - 1.9, p2.z], 1.3, 0.018);
  wire([p4.x, p4.h - 1.5, p4.z], [p2.x + 0.4, p2.h - 2.3, p2.z], 1.4, 0.018);
  // drop line into the store
  wire([p4.x, p4.h - 1.2, p4.z], [9.0, 4.4, -1.2], 0.5, 0.02);

  // street lamp on the sidewalk
  function streetLamp(x, z, rotY = 0, h = 5.2) {
    builder.cyl(0.09, 0.12, h, 10, M.metalDark, { pos: [x, h / 2, z], outline: 1.1 });
    builder.box(0.4, 0.16, 0.4, M.metalDark, { pos: [x, 0.08, z], outline: 0.9 });
    const armX = Math.sin(rotY), armZ = Math.cos(rotY);
    builder.cyl(0.06, 0.06, 1.0, 8, M.metalDark, {
      pos: [x + armX * 0.5, h - 0.1, z + armZ * 0.5], rot: [0, rotY, Math.PI / 2], outline: 0.7,
    });
    builder.cyl(0.3, 0.16, 0.26, 12, M.metalDark, { pos: [x + armX * 1.0, h - 0.2, z + armZ * 1.0], outline: 1.0 });
    builder.cyl(0.24, 0.24, 0.06, 12, M.lampGlow, { pos: [x + armX * 1.0, h - 0.33, z + armZ * 1.0], outline: 0 });
    // halo
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), additive(0xffd9a0, 0.55, { map: glowTexture() }));
    halo.position.set(x + armX * 1.0, h - 0.4, z + armZ * 1.0);
    halo.renderOrder = 4;
    group.add(halo);
    dyn.lamps.push(halo);
    const l = new THREE.PointLight(0xffd9a0, 9, 13, 2);
    l.position.set(x + armX * 1.0, h - 0.5, z + armZ * 1.0);
    scene.add(l);
    if (ctx.ground) ctx.ground.addLight([x + armX * 1.0, h - 0.4, z + armZ * 1.0], [1.0, 0.84, 0.6], 5.4, 1.0);
  }
  streetLamp(-5.3, 11.7, Math.PI * 0.5);
  streetLamp(-8.0, -8.4, Math.PI * 1.15, 4.6);
  streetLamp(11.4, -6.4, -Math.PI * 0.6, 4.4);
  streetLamp(12.2, 12.0, -Math.PI * 0.35, 5.0);

  // =========================================================================
  // traffic signals
  // =========================================================================
  function signalHead(x, y, z, rotY, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);
    group.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.3, 0.22), M.metalDark);
    g.add(body);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.3), M.metalDark);
    visor.position.set(0, 0.16, 0.03);
    g.add(visor);
    const cols = [0xff5a4d, 0xffcf4d, 0x62e6a4];
    const lamps = cols.map((c, i) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.12), toneMapped: false });
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.098, 14), m);
      l.position.set(-0.24 + i * 0.24, 0, 0.115);
      g.add(l);
      return m;
    });
    dyn.signals.push({ lamps, cols, offset: rng() * 6 });
    return g;
  }
  // junction signal on a pole
  builder.cyl(0.1, 0.12, 5.0, 10, M.metalDark, { pos: [-5.35, 2.5, 10.55], outline: 1.1 });
  signalHead(-5.35, 4.9, 10.3, 0, 1);
  // pedestrian signal
  builder.box(0.26, 0.5, 0.2, M.metalDark, { pos: [-5.35, 3.2, 10.42], outline: 0.9 });
  builder.box(0.18, 0.18, 0.03, glow(0xff5a4d, 1.2), { pos: [-5.35, 3.32, 10.31], outline: 0 });
  builder.box(0.18, 0.18, 0.03, toon(0x1c2028), { pos: [-5.35, 3.08, 10.31], outline: 0 });
  // distant signal at the far end of the main street
  builder.cyl(0.08, 0.1, 4.4, 8, M.metalDark, { pos: [-12.3, 2.2, 5.15], outline: 1.0 });
  signalHead(-12.3, 4.3, 5.4, 0.5, 0.85);

  // =========================================================================
  // guardrail, signs, hydrant, post box, planters
  // =========================================================================
  // guardrail along the south sidewalk
  const gz = 11.55;
  for (let x = -7.4; x <= -0.4; x += 1.4) {
    builder.cyl(0.045, 0.05, 0.86, 8, M.steel, { pos: [x, 0.43, gz], outline: 0.6 });
  }
  for (const y of [0.72, 0.44]) {
    builder.cyl(0.03, 0.03, 7.2, 8, M.steel, { pos: [-3.9, y, gz], rot: [0, 0, Math.PI / 2], outline: 0.5 });
  }
  builder.cyl(0.045, 0.05, 0.86, 8, M.steel, { pos: [-7.4, 0.43, gz], outline: 0.6 });
  builder.cyl(0.045, 0.05, 0.86, 8, M.steel, { pos: [-0.4, 0.43, gz], outline: 0.6 });

  // road name sign on a pole
  (() => {
    const t = roadSignTexture('桜町 3', 'SAKURA-CHO 3', '#2f6fe0');
    builder.cyl(0.05, 0.06, 2.7, 8, M.steel, { pos: [-4.7, 1.35, 11.9], outline: 0.7 });
    builder.plane(1.25, 0.47, glow(0xffffff, 1.0, { map: t }), { pos: [-4.7, 2.45, 11.95] });
    builder.plane(1.25, 0.47, glow(0xffffff, 1.0, { map: t }), { pos: [-4.7, 2.45, 11.85], rot: [0, Math.PI, 0] });
  })();
  // give-way sign at the side street
  (() => {
    const t = roadSignTexture('止まれ', 'STOP', '#c8342f');
    builder.cyl(0.05, 0.06, 2.6, 8, M.steel, { pos: [-5.35, 1.3, 5.6], outline: 0.7 });
    builder.plane(1.0, 0.38, glow(0xffffff, 1.0, { map: t }), { pos: [-5.35, 2.4, 5.65] });
  })();
  // convex traffic mirror at the corner
  (() => {
    builder.cyl(0.05, 0.06, 3.0, 8, M.steel, { pos: [-9.85, 1.5, 3.9], outline: 0.7 });
    builder.add(new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), toon(0xbfd4e8, { ramp: 3 }), {
      pos: [-9.85, 2.95, 3.9], rot: [Math.PI * 0.62, 0.5, 0], outline: 1.0,
    });
    builder.add(builder.torusGeo(0.44, 0.04, 16, 6), M.metalDark, {
      pos: [-9.85, 2.95, 3.9], rot: [Math.PI * 0.62, 0.5, 0], outline: 0.6,
    });
  })();
  // fire hydrant
  (() => {
    const x = 8.0, z = 11.8;
    builder.cyl(0.14, 0.17, 0.5, 12, toon(0xc23a35), { pos: [x, 0.25, z], outline: 1.0 });
    builder.cyl(0.1, 0.14, 0.22, 12, toon(0xc23a35), { pos: [x, 0.6, z], outline: 1.0 });
    builder.add(builder.sphereGeo(0.11, 12), toon(0xd8483f), { pos: [x, 0.74, z], outline: 1.0 });
    builder.cyl(0.05, 0.05, 0.3, 8, M.metalDark, { pos: [x, 0.45, z], rot: [0, 0, Math.PI / 2], outline: 0.6 });
  })();
  // Japanese post box
  (() => {
    const x = 2.6, z = 12.0;
    builder.cyl(0.19, 0.2, 0.9, 14, toon(0xc8342f), { pos: [x, 0.75, z], outline: 1.1 });
    builder.add(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xd8483f), {
      pos: [x, 1.2, z], outline: 1.1,
    });
    builder.box(0.3, 0.16, 0.06, toon(0x2a2f3a), { pos: [x, 1.06, z - 0.17], outline: 0.7 });
    builder.cyl(0.05, 0.06, 0.3, 8, M.metalDark, { pos: [x, 0.15, z], outline: 0.6 });
    builder.cyl(0.2, 0.2, 0.04, 14, M.metalDark, { pos: [x, 1.32, z], outline: 0.5 });
  })();
  // planters with clipped shrubs
  for (const [x, z] of [[-8.6, 12.2], [-11.6, 12.2], [-3.1, 12.2]]) {
    builder.box(0.9, 0.42, 0.9, toon(0x6d6a63, { ramp: 3 }), { pos: [x, 0.36, z], outline: 1.0 });
    builder.add(builder.sphereGeo(0.44, 10), M.foliage, { pos: [x, 0.86, z], scale: [1, 0.86, 1], outline: 1.1 });
    builder.add(builder.sphereGeo(0.3, 10), M.foliageLit, { pos: [x + 0.16, 1.02, z - 0.1], outline: 1.0 });
  }

  // =========================================================================
  // bulletin board + neighbour walls
  // =========================================================================
  (() => {
    const t = boardTexture();
    // on the store's west wall, beside the vending machine
    builder.box(1.7, 1.25, 0.09, M.wood, { pos: [-1.12, 1.9, -5.4], rot: [0, -Math.PI / 2, 0], outline: 1.0 });
    builder.plane(1.56, 1.1, glow(0xffffff, 0.92, { map: t }), { pos: [-1.19, 1.9, -5.4], rot: [0, -Math.PI / 2, 0] });
    builder.box(1.8, 0.12, 0.2, M.metalDark, { pos: [-1.14, 2.6, -5.4], rot: [0, -Math.PI / 2, 0], outline: 0.7 });
  })();

  // =========================================================================
  // neighbouring buildings
  // =========================================================================
  function building(box, floors, seed, opts = {}) {
    const { lit = 0.42, base = '#3a3f4c', h = box.h, faces = '+z,-x,+x,-z' } = opts;
    const w = box.x1 - box.x0, d = box.z1 - box.z0;
    const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
    builder.box(w, h, d, toon(0x2c313c, { ramp: 3 }), { pos: [cx, h / 2, cz], outline: 1.2 });
    const list = faces.split(',');
    const tz = list.some((f) => f === '+z' || f === '-z')
      ? facadeTexture({ w: 512, h: 1024, floors, seed, lit, base }) : null;
    const tx = list.some((f) => f === '+x' || f === '-x')
      ? facadeTexture({ w: 512, h: 1024, floors, seed: seed + 3, lit, base }) : null;
    for (const f of list) {
      if (f === '+z') builder.plane(w, h, glow(0xffffff, 0.86, { map: tz }), { pos: [cx, h / 2, box.z1 + 0.01] });
      else if (f === '-z') builder.plane(w, h, glow(0xffffff, 0.86, { map: tz }), { pos: [cx, h / 2, box.z0 - 0.01], rot: [0, Math.PI, 0] });
      else if (f === '+x') builder.plane(d, h, glow(0xffffff, 0.86, { map: tx }), { pos: [box.x1 + 0.01, h / 2, cz], rot: [0, Math.PI / 2, 0] });
      else if (f === '-x') builder.plane(d, h, glow(0xffffff, 0.86, { map: tx }), { pos: [box.x0 - 0.01, h / 2, cz], rot: [0, -Math.PI / 2, 0] });
    }
    // parapet
    builder.box(w + 0.2, 0.28, d + 0.2, toon(0x3a3f4c, { ramp: 3 }), { pos: [cx, h + 0.14, cz], outline: 1.0 });
  }

  // east neighbour (narrow mixed-use block) — its west wall lines the alley
  building({ ...NEIGHBOUR_E, h: NEIGHBOUR_E.h }, 3, 12, { lit: 0.4, base: '#3f4450' });
  // west neighbour (two-storey shop house)
  building({ ...NEIGHBOUR_W, h: NEIGHBOUR_W.h }, 2, 27, { lit: 0.5, base: '#4a443c' });

  // shuttered shopfront on the west neighbour, facing the main street
  (() => {
    const t = shutterTexture();
    builder.plane(2.6, 1.9, toon(0xffffff, { map: t, ramp: 3 }), { pos: [-11.3, 1.15, 4.61] });
    builder.box(2.8, 0.16, 0.24, M.metalDark, { pos: [-11.3, 2.2, 4.55], outline: 0.8 });
    builder.box(2.8, 0.12, 0.3, toon(0x4a3f38, { ramp: 3 }), { pos: [-11.3, 2.4, 4.5], outline: 0.8 });
    // striped awning
    for (let i = 0; i < 8; i++) {
      builder.box(0.34, 0.05, 0.7, i % 2 ? toon(0xb8443f) : toon(0xe4ded0), {
        pos: [-12.4 + i * 0.35, 2.5, 4.85], rot: [0.3, 0, 0], outline: 0.5,
      });
    }
    // wall lamp + small neon
    builder.box(0.1, 0.16, 0.1, M.metalDark, { pos: [-9.7, 2.6, 4.5], outline: 0.6 });
    builder.box(0.08, 0.12, 0.08, glow(0xffcf8a, 1.6), { pos: [-9.7, 2.5, 4.44], outline: 0 });
  })();

  // neon vertical sign on the east neighbour, facing the forecourt
  (() => {
    const t = roadSignTexture('コインランドリー', 'COIN LAUNDRY', '#8b3fd6');
    const mat = glow(0xffffff, 1.5, { map: t });
    dyn.flickers.push(mat);
    builder.box(0.24, 2.3, 0.36, M.metalDark, { pos: [11.4, 4.3, -0.72], outline: 1.0 });
    builder.plane(0.3, 2.2, mat, { pos: [11.4, 4.3, -0.53] });
    if (ctx.ground) ctx.ground.addLight([11.4, 3.6, 0.2], [0.62, 0.4, 1.0], 4.2, 0.55);
  })();

  // pink snack-bar neon on the west neighbour, facing the main street
  (() => {
    const W = 256, Hh = 768;
    const [c, g] = cvs(W, Hh);
    g.fillStyle = '#141018'; g.fillRect(0, 0, W, Hh);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#ff4f9a';
    g.shadowBlur = 26;
    g.fillStyle = '#ffb6d8';
    g.font = `bold 96px ${JP}`;
    ['ス', 'ナ', 'ッ', 'ク'].forEach((ch, i) => g.fillText(ch, W / 2, 110 + i * 128));
    g.shadowBlur = 16;
    g.fillStyle = '#ffd9ec';
    g.font = `bold 62px ${JP}`;
    g.fillText('ゆ き', W / 2, Hh - 96);
    const mat = glow(0xffffff, 1.45, { map: tex(c) });
    dyn.flickers.push(mat);
    builder.box(0.22, 1.9, 0.3, M.metalDark, { pos: [-10.6, 3.9, 4.72], outline: 1.0 });
    builder.plane(0.26, 1.8, mat, { pos: [-10.6, 3.9, 4.9] });
    if (ctx.ground) ctx.ground.addLight([-10.6, 3.4, 5.6], [1.0, 0.42, 0.68], 4.4, 0.6);
  })();

  // small cyan shop sign near the side street
  (() => {
    const t = roadSignTexture('クリーニング', 'CLEANING', '#1f8fb8');
    const mat = glow(0xffffff, 1.35, { map: t });
    dyn.flickers.push(mat);
    builder.box(1.5, 0.34, 0.22, M.metalDark, { pos: [-11.2, 3.2, 4.68], outline: 0.9 });
    builder.plane(1.4, 0.28, mat, { pos: [-11.2, 3.2, 4.8] });
  })();

  // AC condensers + pipes on the alley walls
  function acUnit(x, y, z, rotY, w = 0.78) {
    builder.box(w, 0.56, 0.34, toon(0xd8d5cc, { ramp: 3 }), { pos: [x, y, z], rot: [0, rotY, 0], outline: 1.0 });
    builder.cyl(0.19, 0.19, 0.05, 12, toon(0x9a978f, { ramp: 3 }), {
      pos: [x + Math.sin(rotY) * 0.18, y, z + Math.cos(rotY) * 0.18], rot: [Math.PI / 2, 0, rotY], outline: 0.7,
    });
    builder.box(w * 0.9, 0.05, 0.05, M.metalDark, { pos: [x, y - 0.3, z], rot: [0, rotY, 0], outline: 0.5 });
  }
  acUnit(8.55, 1.5, -3.2, Math.PI / 2);
  acUnit(8.55, 2.4, -7.6, Math.PI / 2);
  acUnit(9.85, 1.7, -5.4, -Math.PI / 2);
  acUnit(9.85, 3.9, -9.2, -Math.PI / 2);
  acUnit(9.85, 5.6, -2.4, -Math.PI / 2);
  acUnit(-9.45, 3.2, -6.2, Math.PI / 2);
  acUnit(-9.45, 4.4, -10.4, Math.PI / 2);

  // vertical drain pipes in the alley
  for (const [x, z] of [[8.5, -1.6], [8.5, -8.8], [9.9, -3.8], [9.9, -11.6]]) {
    builder.cyl(0.07, 0.07, 4.4, 8, M.metalDark, { pos: [x, 2.2, z], outline: 0.7 });
    builder.cyl(0.09, 0.09, 0.12, 8, M.metalDark, { pos: [x, 0.2, z], outline: 0.5 });
  }

  // alley clutter: crates, a dumpster, a lantern at the dead end
  builder.box(1.0, 0.62, 0.72, toon(0x3f5a4a, { ramp: 3 }), { pos: [9.3, 0.31, -11.2], outline: 1.1 });
  builder.box(1.04, 0.08, 0.76, M.metalDark, { pos: [9.3, 0.66, -11.2], outline: 0.8 });
  for (let i = 0; i < 3; i++) {
    builder.box(0.42, 0.28, 0.3, toon(0x8a7a5c, { ramp: 3 }), {
      pos: [9.2 + (i % 2) * 0.1, 0.14 + Math.floor(i / 2) * 0.29, -10.2 + (i % 2) * 0.32], outline: 0.8,
    });
  }
  builder.box(0.5, 0.22, 0.1, glow(0xffcf8a, 1.5), { pos: [9.7, 2.9, -12.7], outline: 0 });
  builder.cyl(0.03, 0.03, 0.4, 6, M.metalDark, { pos: [9.7, 3.2, -12.7], outline: 0 });
  if (ctx.ground) ctx.ground.addLight([9.4, 2.6, -12.4], [1.0, 0.76, 0.5], 3.6, 0.6);

  // =========================================================================
  // animation
  // =========================================================================
  function update(t) {
    // traffic signal cycle
    for (const s of dyn.signals) {
      const cyc = (t * 0.32 + s.offset) % 1;
      const phase = cyc < 0.42 ? 0 : cyc < 0.55 ? 1 : 2;
      s.lamps.forEach((m, i) => {
        const on = i === phase;
        const target = new THREE.Color(s.cols[i]).multiplyScalar(on ? 2.1 : 0.10);
        m.color.lerp(target, 0.14);
      });
    }
    // lamp halos breathe a little
    dyn.lamps.forEach((h, i) => {
      h.material.opacity = 0.38 + 0.05 * Math.sin(t * 1.7 + i * 2.1);
    });
    // sign flicker
    for (const m of dyn.flickers) {
      const f = 1 - 0.05 * Math.max(0, Math.sin(t * 5.3 + 1.2) - 0.92) * 8;
      m.color.setScalar(1.4 * f);
    }
  }

  return { group, update, materials: M };
}

Object.assign(__M.props, { buildProps });
})();
// ==== src/store.js ====
__M.store = {};
(function () {
'use strict';
const __THREE = window.THREE;
// ---------------------------------------------------------------------------
// The convenience store: shell, illuminated signage, glass storefront, and a
// densely furnished interior that reads clearly through the windows.
// ---------------------------------------------------------------------------
const THREE = __THREE;
const { STORE, COLORS, makeRng, lerp, clamp } = __M.config;
const { toon, glow, additive } = __M.toon;

const X0 = STORE.x0, X1 = STORE.x1, Z0 = STORE.z0, Z1 = STORE.z1;
const H = STORE.h;
const WALL = STORE.wallT;
const IX0 = X0 + WALL, IX1 = X1 - WALL;
const IZ0 = Z0 + WALL, IZ1 = Z1 - WALL;
const FLOOR = 0.18;
const CEIL = 2.92;
const FRONT = Z1; // facade plane
const GY0 = STORE.glassBase; // 0.22
const GY1 = STORE.glassTop; // 2.95

// ---------------------------------------------------------------------------
// canvas art helpers
// ---------------------------------------------------------------------------
function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
const JP = '"Yu Gothic","YuGothic","MS Gothic","Meiryo",sans-serif';
const EN = '"Segoe UI","Helvetica Neue",Arial,sans-serif';

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Big fascia sign: brand block on the left, name + 24H badge on the right. */
function fasciaTexture() {
  const W = 2048, Hh = 256;
  const [c, g] = cvs(W, Hh);
  const bg = g.createLinearGradient(0, 0, 0, Hh);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.55, '#f2f5fb');
  bg.addColorStop(1, '#dde4f0');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, Hh);

  // brand colour bands top / bottom
  g.fillStyle = '#2f6fe0'; g.fillRect(0, 0, W, 12);
  g.fillStyle = '#ff8a3d'; g.fillRect(0, Hh - 16, W, 16);

  // logo mark
  const cx = 150, cy = Hh / 2, r = 74;
  g.fillStyle = '#2f6fe0';
  roundRect(g, cx - r, cy - r, r * 2, r * 2, 26); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(cx - 46, cy + 40); g.lineTo(cx + 46, cy - 40); g.lineTo(cx + 46, cy - 8);
  g.lineTo(cx - 10, cy + 40); g.closePath(); g.fill();
  g.fillStyle = '#ff8a3d';
  g.beginPath(); g.arc(cx + 34, cy + 30, 20, 0, 6.3); g.fill();

  // wordmark
  g.fillStyle = '#1b2b52';
  g.font = `bold 148px ${EN}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('SUNMART', 268, cy - 12);

  g.fillStyle = '#2f6fe0';
  g.font = `600 62px ${JP}`;
  g.fillText('サンマート', 274, cy + 78);

  g.fillStyle = '#5a6b8c';
  g.font = `500 52px ${EN}`;
  g.fillText('CONVENIENCE STORE', 800, cy + 80);

  // 24H badge
  const bx = W - 430;
  g.fillStyle = '#ff8a3d';
  roundRect(g, bx, 44, 360, 168, 26); g.fill();
  g.fillStyle = '#ffffff';
  g.font = `bold 128px ${EN}`;
  g.textAlign = 'center';
  g.fillText('24H', bx + 180, 132);
  g.font = `600 44px ${JP}`;
  g.fillText('年中無休', bx + 180, 190);

  // soft lightbox falloff
  const vg = g.createRadialGradient(W / 2, Hh / 2, Hh * 0.3, W / 2, Hh / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(40,60,110,0.18)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, Hh);
  return tex(c);
}

/** Vertical pylon sign (Japanese street-corner style). */
function pylonTexture() {
  const W = 256, Hh = 1024;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = '#f7f9fd'; g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#2f6fe0'; g.fillRect(0, 0, W, 18); g.fillRect(0, Hh - 18, W, 18);

  // logo
  g.fillStyle = '#2f6fe0';
  roundRect(g, 48, 46, 160, 160, 30); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(88, 176); g.lineTo(168, 76); g.lineTo(168, 122); g.lineTo(112, 176); g.closePath(); g.fill();
  g.fillStyle = '#ff8a3d';
  g.beginPath(); g.arc(160, 168, 24, 0, 6.3); g.fill();

  // vertical katakana
  g.fillStyle = '#1b2b52';
  g.font = `bold 118px ${JP}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = ['サ', 'ン', 'マ', 'ー', 'ト'];
  chars.forEach((ch, i) => g.fillText(ch, W / 2, 320 + i * 128));

  g.fillStyle = '#ff8a3d';
  g.font = `bold 66px ${JP}`;
  g.fillText('24時間', W / 2, Hh - 74);
  return tex(c);
}

function posterTexture(seed, hue) {
  const W = 320, Hh = 448;
  const [c, g] = cvs(W, Hh);
  const rng = makeRng(seed);
  const base = new THREE.Color().setHSL(hue, 0.55, 0.62);
  const bg = g.createLinearGradient(0, 0, W, Hh);
  bg.addColorStop(0, `#${base.clone().offsetHSL(0, 0, 0.22).getHexString()}`);
  bg.addColorStop(1, `#${base.clone().offsetHSL(0.05, 0, -0.16).getHexString()}`);
  g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
  // abstract shapes
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = 0.18 + rng() * 0.3;
    g.fillStyle = i % 2 ? '#ffffff' : `#${base.clone().offsetHSL(0.5, 0.1, 0).getHexString()}`;
    g.beginPath();
    g.arc(rng() * W, rng() * Hh * 0.7, 40 + rng() * 130, 0, 6.3);
    g.fill();
  }
  g.globalAlpha = 1;
  // headline bars
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.fillRect(28, Hh - 168, W - 56, 26);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(28, Hh - 128, (W - 56) * 0.66, 16);
  g.fillRect(28, Hh - 100, (W - 56) * 0.45, 16);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = `bold 44px ${JP}`;
  g.fillText('新発売', 30, 66);
  return tex(c);
}

function interiorFloorTexture() {
  const S = 1024;
  const [c, g] = cvs(S, S);
  g.fillStyle = '#ded7c9'; g.fillRect(0, 0, S, S);
  const n = 16, s = S / n;
  const rng = makeRng(4242);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 0.955 + rng() * 0.09;
      const col = new THREE.Color(0xded7c9).multiplyScalar(v);
      g.fillStyle = `#${col.getHexString()}`;
      g.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
    }
  }
  g.strokeStyle = 'rgba(120,110,95,0.22)';
  g.lineWidth = 1.6;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * s); g.lineTo(S, i * s); g.stroke();
  }
  // green guide arrows pointing to the register
  g.fillStyle = 'rgba(38,150,110,0.5)';
  const arrow = (x, y, rot) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath();
    g.moveTo(0, -46); g.lineTo(34, -6); g.lineTo(14, -6); g.lineTo(14, 46);
    g.lineTo(-14, 46); g.lineTo(-14, -6); g.lineTo(-34, -6);
    g.closePath(); g.fill();
    g.restore();
  };
  arrow(S * 0.3, S * 0.28, 0);
  arrow(S * 0.3, S * 0.52, 0);
  arrow(S * 0.62, S * 0.4, Math.PI * 0.5);
  return tex(c);
}

function productColor(i, rng) {
  const pal = [
    0xe8402f, 0xf59a1e, 0xf5d33a, 0x36a862, 0x2b7fe0, 0x6b4fd6, 0xd63f92,
    0xf2f0e8, 0x7fd4e8, 0x8a5a3a, 0xf07ba8, 0x3fc8b4, 0xd13a3a, 0xfaf6ea,
    0xb0b8c8, 0xef7f3a,
  ];
  return pal[(i + Math.floor(rng() * pal.length)) % pal.length];
}

// ---------------------------------------------------------------------------
// glass shader: faint tint, fresnel edge, anime highlight, running rain
// ---------------------------------------------------------------------------
const GLASS_VS = /* glsl */`
  varying vec3 vWorld;
  varying vec2 vUvG;
  varying vec3 vN;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vUvG = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GLASS_FS = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform vec3 uTint;
  uniform vec3 uLightA;
  uniform vec3 uLightB;
  uniform vec2 uScale;
  varying vec3 vWorld;
  varying vec2 vUvG;
  varying vec3 vN;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  void main() {
    vec2 uv = vec2(vUvG.x * uScale.x, vUvG.y * uScale.y);
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - abs(dot(normalize(vN), V)), 3.0);

    // running rain: columns of droplets sliding down at different speeds
    float rain = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float col = floor(uv.x * (7.0 + fi * 5.0) + fi * 3.7);
      float rnd = h21(vec2(col, fi));
      float speed = 0.06 + rnd * 0.16;
      float y = uv.y + uTime * speed + rnd * 10.0;
      float cell = floor(y * 2.2);
      float r2 = h21(vec2(col, cell + fi * 11.0));
      float drop = smoothstep(0.94, 1.0, r2);
      float streak = drop * smoothstep(0.0, 0.35, fract(y * 2.2)) * (1.0 - fract(y * 2.2) * 0.55);
      rain += streak * (0.5 - fi * 0.12);
    }

    // slow film of water everywhere
    float film = 0.05 * (0.5 + 0.5 * sin(uv.x * 9.0 + uTime * 0.7)) * 0.5;

    // one soft diagonal anime highlight
    float band = smoothstep(0.34, 0.5, uv.x * 0.42 + uv.y * 0.58)
               * (1.0 - smoothstep(0.5, 0.66, uv.x * 0.42 + uv.y * 0.58));

    vec3 col = uTint * (0.35 + fres * 1.5);
    col += uLightA * (rain * 0.55 + film);
    col += uLightB * band * 0.5;
    col += uLightA * fres * 0.35;

    float a = 0.085 + fres * 0.34 + rain * 0.40 + band * 0.11 + film * 0.16;
    a = clamp(a, 0.0, 0.62);
    gl_FragColor = vec4(col, a);
  }
`;

function glassMaterial(tint = 0x9fc6e8, scale = [3, 2]) {
  return new THREE.ShaderMaterial({
    vertexShader: GLASS_VS, fragmentShader: GLASS_FS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(tint) },
      uLightA: { value: new THREE.Color(0xdff0ff) },
      uLightB: { value: new THREE.Color(0xffffff) },
      uScale: { value: new THREE.Vector2(scale[0], scale[1]) },
    },
  });
}

// ---------------------------------------------------------------------------
function buildStore(builder, scene, ctx = {}) {
  const rng = makeRng(5150);
  const group = new THREE.Group();
  scene.add(group);
  const dynamic = { glassMats: [], doors: [], lights: [], flickers: [] };

  const M = {
    wall: toon(COLORS.wall),
    wallShade: toon(COLORS.wallShade),
    trim: toon(COLORS.wallTrim),
    metal: toon(COLORS.metal),
    metalDark: toon(COLORS.metalDark),
    white: toon(0xf2f3f6),
    fascia: toon(0xeef1f7),
    brandBlue: toon(COLORS.brand),
    brandWarm: toon(COLORS.brandWarm),
    sign: glow(0xffffff, 1.55),
    signSoft: glow(0xe8f0ff, 1.25),
    roof: toon(0x6e7079, { ramp: 3 }),
    roofSeam: toon(0x55575f, { ramp: 3 }),
    // interior — emissive-boosted so the shop reads bright through the glass
    floor: toon(0xcbc4b6, { map: interiorFloorTexture(), emissive: 0x201c15 }),
    iWall: toon(0xc2bcb0, { emissive: 0x211d16 }),
    iWallCool: toon(0xb8c0c8, { emissive: 0x181e26 }),
    iCeil: toon(0xc6c2b8, { emissive: 0x211e17 }),
    shelf: toon(0xbcc2cc, { emissive: 0x1c1f24 }),
    shelfEdge: toon(0x9ba2ae, { emissive: 0x15171b }),
    counter: toon(0xd0cabe, { emissive: 0x231f1b }),
    counterTop: toon(0xc2b9ab, { emissive: 0x1f1c18 }),
    lightPanel: glow(0xfff0d0, 0.88),
    lightPanelCool: glow(0xe8f4ff, 0.8),
    fridgeGlow: glow(0xcfe4ff, 0.72),
    fridgeShelf: toon(0xdfe7f0, { emissive: 0x2a3442 }),
    warmGlow: glow(0xffcf8a, 0.9),
    screen: glow(0x9fd8ff, 0.8),
    door: toon(0xdfe4ec),
  };

  // =========================================================================
  // 1. shell
  // =========================================================================
  const wallH = H;
  // back wall
  builder.box(X1 - X0, wallH, WALL, M.wall, { pos: [(X0 + X1) / 2, wallH / 2, Z0 + WALL / 2], outline: 1.1 });
  // left (west) wall
  builder.box(WALL, wallH, Z1 - Z0, M.wall, { pos: [X0 + WALL / 2, wallH / 2, (Z0 + Z1) / 2], outline: 1.1 });
  // right (east) wall
  builder.box(WALL, wallH, Z1 - Z0, M.wall, { pos: [X1 - WALL / 2, wallH / 2, (Z0 + Z1) / 2], outline: 1.1 });

  // front facade above the glass
  const headerY0 = GY1;
  builder.box(X1 - X0, H - headerY0, WALL, M.wall, {
    pos: [(X0 + X1) / 2, (headerY0 + H) / 2, FRONT - WALL / 2], outline: 1.1,
  });
  // front corner pillars
  builder.box(0.62, headerY0, WALL, M.wall, { pos: [X0 + 0.31, headerY0 / 2, FRONT - WALL / 2], outline: 1.1 });
  builder.box(0.62, headerY0, WALL, M.wall, { pos: [X1 - 0.31, headerY0 / 2, FRONT - WALL / 2], outline: 1.1 });
  // low plinth under the glass
  builder.box(X1 - X0 - 1.24, GY0, WALL + 0.06, M.wallShade, {
    pos: [(X0 + X1) / 2, GY0 / 2, FRONT - WALL / 2 + 0.03], outline: 1.0,
  });

  // roof slab + parapet
  builder.box(X1 - X0 + 0.3, 0.22, Z1 - Z0 + 0.3, M.roof, {
    pos: [(X0 + X1) / 2, H - 0.11, (Z0 + Z1) / 2], outline: 1.0,
  });
  // roof membrane seams
  for (let x = X0 + 1.6; x < X1; x += 2.2) {
    builder.box(0.05, 0.03, Z1 - Z0, M.roofSeam, { pos: [x, H + 0.005, (Z0 + Z1) / 2], outline: 0 });
  }
  const parapet = (w, d, x, z) => {
    builder.box(w, 0.34, d, M.wall, { pos: [x, H + 0.17, z], outline: 1.1 });
    builder.box(w + 0.06, 0.06, d + 0.06, M.metalDark, { pos: [x, H + 0.36, z], outline: 0.8 });
  };
  parapet(X1 - X0 + 0.3, 0.22, (X0 + X1) / 2, Z0 - 0.04);
  parapet(0.22, Z1 - Z0 + 0.3, X0 - 0.04, (Z0 + Z1) / 2);
  parapet(0.22, Z1 - Z0 + 0.3, X1 + 0.04, (Z0 + Z1) / 2);
  parapet(X1 - X0 + 0.3, 0.22, (X0 + X1) / 2, Z1 + 0.04);

  // roof clutter
  builder.box(1.1, 0.72, 0.62, M.metal, { pos: [6.9, H + 0.47, -6.4], outline: 1.1 });
  builder.cyl(0.26, 0.26, 0.55, 10, M.metal, { pos: [6.9, H + 0.5, -6.0], rot: [Math.PI / 2, 0, 0], outline: 1.1 });
  builder.box(0.9, 0.6, 0.56, M.metal, { pos: [1.4, H + 0.41, -7.8], outline: 1.1 });
  builder.cyl(0.09, 0.09, 1.3, 8, M.metalDark, { pos: [2.6, H + 0.65, -5.2], outline: 1.0 });
  builder.cyl(0.32, 0.32, 0.14, 10, M.metalDark, { pos: [2.6, H + 1.32, -5.2], outline: 1.0 });
  // low water tank, satellite dish and a service box
  builder.box(0.62, 0.5, 0.62, M.metalDark, { pos: [0.3, H + 0.4, -2.6], outline: 1.0 });
  builder.box(0.68, 0.08, 0.68, M.metal, { pos: [0.3, H + 0.68, -2.6], outline: 0.8 });
  builder.add(new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.36), M.white, {
    pos: [7.6, H + 0.5, -2.2], rot: [1.1, -0.6, 0], outline: 0.9,
  });
  builder.cyl(0.05, 0.05, 0.5, 8, M.metalDark, { pos: [7.6, H + 0.25, -2.2], outline: 0.6 });
  builder.box(0.5, 0.34, 0.28, M.metal, { pos: [4.9, H + 0.28, -8.4], outline: 0.9 });

  // =========================================================================
  // 2. signage
  // =========================================================================
  const fasciaTex = fasciaTexture();
  const signMat = glow(0xffffff, 1.18, { map: fasciaTex });
  dynamic.flickers.push(signMat);
  // lightbox body
  builder.box(X1 - X0 - 0.24, 1.06, 0.30, M.fascia, {
    pos: [(X0 + X1) / 2, 3.56, FRONT + 0.14], outline: 1.0,
  });
  // lit face
  builder.plane(X1 - X0 - 0.3, 1.0, signMat, { pos: [(X0 + X1) / 2, 3.56, FRONT + 0.30] });
  // under-fascia trim strip with a row of tiny lamps
  builder.box(X1 - X0 - 0.3, 0.06, 0.16, M.metalDark, { pos: [(X0 + X1) / 2, 3.0, FRONT + 0.18], outline: 0 });
  for (let x = X0 + 0.7; x < X1 - 0.5; x += 0.62) {
    builder.cyl(0.055, 0.055, 0.03, 8, M.lightPanel, { pos: [x, 2.97, FRONT + 0.16], outline: 0 });
  }

  // pylon sign on the forecourt corner
  const pylonTex = pylonTexture();
  const pylonFace = glow(0xffffff, 1.22, { map: pylonTex });
  dynamic.flickers.push(pylonFace);
  builder.cyl(0.11, 0.13, 2.0, 10, M.metalDark, { pos: [9.35, 1.0, 2.35], outline: 1.0 });
  builder.box(0.72, 3.3, 0.42, M.fascia, { pos: [9.35, 3.65, 2.35], outline: 1.1 });
  builder.plane(0.66, 3.2, pylonFace, { pos: [9.35, 3.65, 2.35 + 0.215] });
  builder.plane(0.66, 3.2, pylonFace, { pos: [9.35, 3.65, 2.35 - 0.215], rot: [0, Math.PI, 0] });
  builder.plane(0.4, 3.2, pylonFace, { pos: [9.35 + 0.365, 3.65, 2.35], rot: [0, Math.PI / 2, 0] });
  builder.plane(0.4, 3.2, pylonFace, { pos: [9.35 - 0.365, 3.65, 2.35], rot: [0, -Math.PI / 2, 0] });

  // side (west) sign facing the side lot
  builder.box(0.26, 0.9, 3.2, M.fascia, { pos: [X0 - 0.13, 3.55, -4.6], outline: 1.0 });
  builder.plane(3.0, 0.84, signMat, { pos: [X0 - 0.28, 3.55, -4.6], rot: [0, -Math.PI / 2, 0] });

  // =========================================================================
  // 3. storefront glass + mullions
  // =========================================================================
  const glassMat = glassMaterial(0x9fc6e8, [4, 1.6]);
  dynamic.glassMats.push(glassMat);
  const mull = M.metalDark;
  const mullion = (x, w = 0.09) => builder.box(w, GY1 - GY0, 0.12, mull, {
    pos: [x, (GY0 + GY1) / 2, FRONT - 0.06], outline: 0.8,
  });
  // top and bottom rails
  builder.box(X1 - X0 - 1.0, 0.1, 0.14, mull, { pos: [(X0 + X1) / 2, GY1 + 0.02, FRONT - 0.06], outline: 0.9 });
  builder.box(X1 - X0 - 1.0, 0.08, 0.14, mull, { pos: [(X0 + X1) / 2, GY0 - 0.01, FRONT - 0.06], outline: 0.9 });

  const DOOR_X0 = 1.8, DOOR_X1 = 3.8;
  // fixed panes left of the door
  for (const x of [X0 + 0.62, 0.95, 1.38]) mullion(x);
  mullion(DOOR_X0 - 0.05, 0.11);
  mullion(DOOR_X1 + 0.05, 0.11);
  for (const x of [4.25, 5.3, 6.35, 7.4, 8.05]) mullion(x);
  // the glass sheets themselves (one big sheet, mullions read as divisions)
  builder.add(builder.planeGeo(X1 - X0 - 1.24, GY1 - GY0), glassMat, {
    pos: [(X0 + X1) / 2, (GY0 + GY1) / 2, FRONT - 0.055], outline: 0,
  });

  // automatic sliding doors (dynamic)
  const doorGlassL = glassMaterial(0x9fc6e8, [1.2, 1.6]);
  const doorGlassR = glassMaterial(0x9fc6e8, [1.2, 1.6]);
  dynamic.glassMats.push(doorGlassL, doorGlassR);
  const doorFrame = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 0, FRONT - 0.05);
    group.add(g);
    return g;
  };
  const dl = doorFrame(DOOR_X0 + 0.5);
  const dr = doorFrame(DOOR_X1 - 0.5);
  const doorPanel = (parent, mat, sign) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, GY1 - GY0 - 0.06, 0.05), mat);
    m.position.set(0, (GY0 + GY1) / 2, 0);
    parent.add(m);
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.07), M.metalDark);
    f.position.set(0, GY1 - 0.1, 0);
    parent.add(f);
    const f2 = f.clone(); f2.position.y = GY0 + 0.05; parent.add(f2);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.07), M.metalDark);
    rail.position.set(0, (GY0 + GY1) / 2, 0); parent.add(rail);
    // small blue decal band (the classic automatic-door sticker)
    const decal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.055), M.brandBlue);
    decal.position.set(0, GY1 - 0.42, 0.03); parent.add(decal);
    void sign;
  };
  doorPanel(dl, doorGlassL, true);
  doorPanel(dr, doorGlassR, false);
  dynamic.doors.push({ left: dl, right: dr, x0: DOOR_X0 + 0.5, x1: DOOR_X1 - 0.5 });

  // door threshold + mat
  builder.box(2.3, 0.06, 0.5, M.metal, { pos: [2.8, 0.03, FRONT + 0.24], outline: 0.8 });
  builder.box(2.0, 0.03, 0.62, toon(0x2b2f38), { pos: [2.8, 0.055, FRONT + 0.62], outline: 0.6 });

  // entrance canopy
  builder.box(3.4, 0.14, 1.3, M.fascia, { pos: [2.8, 2.9, FRONT + 0.6], outline: 1.0 });
  builder.box(3.4, 0.06, 0.1, M.metalDark, { pos: [2.8, 2.82, FRONT + 1.2], outline: 0.6 });
  for (const x of [1.7, 2.8, 3.9]) {
    builder.cyl(0.11, 0.11, 0.05, 10, M.lightPanel, { pos: [x, 2.8, FRONT + 0.45], outline: 0 });
  }

  // =========================================================================
  // 4. interior shell
  // =========================================================================
  const iw = IX1 - IX0, id = IZ1 - IZ0;
  const icx = (IX0 + IX1) / 2, icz = (IZ0 + IZ1) / 2;
  // floor
  builder.plate(iw, id, M.floor, { pos: [icx, FLOOR, icz] });
  // ceiling
  builder.plate(iw, id, M.iCeil, { pos: [icx, CEIL, icz], rot: [0, 0, Math.PI] });
  // interior wall skins (brighter than the shell so the inside glows)
  builder.plane(iw, CEIL - FLOOR, M.iWall, { pos: [icx, (FLOOR + CEIL) / 2, IZ0 + 0.02] });
  builder.plane(id, CEIL - FLOOR, M.iWall, { pos: [IX0 + 0.02, (FLOOR + CEIL) / 2, icz], rot: [0, Math.PI / 2, 0] });
  builder.plane(id, CEIL - FLOOR, M.iWallCool, { pos: [IX1 - 0.02, (FLOOR + CEIL) / 2, icz], rot: [0, -Math.PI / 2, 0] });
  // interior side of the front wall (above the glass)
  builder.plane(iw, H - GY1, M.iWall, { pos: [icx, (GY1 + H) / 2, IZ1 - 0.02], rot: [0, Math.PI, 0] });

  // ceiling light panels
  for (let x = IX0 + 1.1; x < IX1 - 0.6; x += 2.1) {
    for (let z = IZ0 + 1.2; z < IZ1 - 0.8; z += 2.6) {
      builder.box(1.5, 0.05, 0.34, M.lightPanel, { pos: [x, CEIL - 0.05, z], outline: 0 });
      builder.box(1.6, 0.08, 0.44, M.iCeil, { pos: [x, CEIL - 0.01, z], outline: 0.5 });
    }
  }

  // =========================================================================
  // 5. interior fittings
  // =========================================================================
  const prod = (x, y, z, w, h, d, col, outline = 0.7) =>
    builder.box(w, h, d, toon(col, { emissive: new THREE.Color(col).multiplyScalar(0.16).getHex() }), {
      pos: [x, y, z], outline,
    });

  // --- back wall: refrigerated drink bank ----------------------------------
  const fz = IZ0 + 0.05;
  const fx0 = IX0 + 1.1, fx1 = IX0 + 6.4;
  builder.box(fx1 - fx0 + 0.3, 2.28, 0.72, M.fridgeShelf, { pos: [(fx0 + fx1) / 2, FLOOR + 1.14, fz + 0.36], outline: 1.0 });
  // glowing back panel
  builder.plane(fx1 - fx0, 1.9, M.fridgeGlow, { pos: [(fx0 + fx1) / 2, FLOOR + 1.2, fz + 0.06] });
  // shelves + bottles
  for (let s = 0; s < 4; s++) {
    const y = FLOOR + 0.36 + s * 0.44;
    builder.box(fx1 - fx0, 0.035, 0.5, M.fridgeShelf, { pos: [(fx0 + fx1) / 2, y, fz + 0.3], outline: 0.5 });
    for (let i = 0; i < 20; i++) {
      const bx = fx0 + 0.14 + i * ((fx1 - fx0 - 0.28) / 19);
      const col = productColor(i + s * 3, rng);
      const bh = 0.24 + rng() * 0.08;
      prod(bx, y + bh / 2 + 0.02, fz + 0.3, 0.15, bh, 0.15, col, 0.5);
      // cap
      prod(bx, y + bh + 0.055, fz + 0.3, 0.08, 0.05, 0.08, col, 0.4);
    }
  }
  // fridge door glass + frames
  const fridgeGlass = glassMaterial(0xbfe0ff, [1.6, 1.2]);
  dynamic.glassMats.push(fridgeGlass);
  const doors = 4;
  for (let i = 0; i < doors; i++) {
    const x = fx0 + (i + 0.5) * (fx1 - fx0) / doors;
    builder.add(builder.planeGeo((fx1 - fx0) / doors - 0.06, 1.94), fridgeGlass, {
      pos: [x, FLOOR + 1.2, fz + 0.72], outline: 0,
    });
    builder.box(0.05, 2.0, 0.06, M.metal, { pos: [fx0 + i * (fx1 - fx0) / doors, FLOOR + 1.2, fz + 0.72], outline: 0.6 });
    builder.box(0.7, 0.05, 0.05, M.metal, { pos: [x, FLOOR + 1.1, fz + 0.76], outline: 0.5 });
  }
  builder.box(fx1 - fx0, 0.12, 0.78, M.metal, { pos: [(fx0 + fx1) / 2, FLOOR + 2.32, fz + 0.4], outline: 0.9 });

  // --- back wall right: chilled bento / onigiri case ------------------------
  const bx0 = fx1 + 0.35, bx1 = IX1 - 0.15;
  builder.box(bx1 - bx0, 2.1, 0.66, M.fridgeShelf, { pos: [(bx0 + bx1) / 2, FLOOR + 1.05, fz + 0.33], outline: 1.0 });
  builder.plane(bx1 - bx0, 1.75, M.fridgeGlow, { pos: [(bx0 + bx1) / 2, FLOOR + 1.1, fz + 0.05] });
  for (let s = 0; s < 3; s++) {
    const y = FLOOR + 0.42 + s * 0.56;
    builder.box(bx1 - bx0, 0.04, 0.46, M.fridgeShelf, { pos: [(bx0 + bx1) / 2, y, fz + 0.3], outline: 0.5 });
    for (let i = 0; i < 5; i++) {
      const px = bx0 + 0.22 + i * ((bx1 - bx0 - 0.44) / 4);
      prod(px, y + 0.12, fz + 0.3, 0.3, 0.2, 0.24, i % 2 ? 0xf0e0b8 : 0xe8d8c0, 0.6);
      prod(px, y + 0.2, fz + 0.44, 0.24, 0.05, 0.03, 0xd94f4f, 0.3);
    }
  }
  builder.add(builder.planeGeo(bx1 - bx0 - 0.04, 1.8), fridgeGlass, {
    pos: [(bx0 + bx1) / 2, FLOOR + 1.1, fz + 0.66], outline: 0,
  });

  // --- gondola shelf runs ---------------------------------------------------
  const shelfRun = (x0, z0, z1) => {
    const w = 1.32, len = z1 - z0, cx = x0 + w / 2, cz = (z0 + z1) / 2;
    builder.box(w, 0.09, len, M.shelf, { pos: [cx, FLOOR + 0.09, cz], outline: 0.9 });
    builder.box(w - 0.1, 0.06, len - 0.06, M.shelfEdge, { pos: [cx, FLOOR + 0.2, cz], outline: 0.6 });
    for (let s = 0; s < 4; s++) {
      const y = FLOOR + 0.44 + s * 0.38;
      builder.box(w, 0.035, len, M.shelf, { pos: [cx, y, cz], outline: 0.6 });
      // coloured price rail (the green / blue conbini shelf strips)
      const railCol = s % 2 ? 0x2f9e6a : 0x2f6fe0;
      const rail = toon(railCol, { emissive: new THREE.Color(railCol).multiplyScalar(0.4).getHex() });
      builder.box(0.03, 0.09, len, rail, { pos: [x0 + 0.015, y - 0.05, cz], outline: 0.3 });
      builder.box(0.03, 0.09, len, rail, { pos: [x0 + w - 0.015, y - 0.05, cz], outline: 0.3 });
      // goods on both faces
      const n = Math.floor(len / 0.2);
      for (let i = 0; i < n; i++) {
        const pz = z0 + 0.11 + i * 0.2;
        const c1 = productColor(i + s, rng);
        prod(x0 + 0.26, y + 0.15, pz, 0.26, 0.28, 0.18, c1, 0.5);
        const c2 = productColor(i + s * 2 + 5, rng);
        prod(x0 + w - 0.26, y + 0.16, pz, 0.26, 0.3, 0.18, c2, 0.5);
      }
    }
    builder.box(w, 0.06, len, M.shelfEdge, { pos: [cx, FLOOR + 1.98, cz], outline: 0.9 });
  };
  shelfRun(IX0 + 0.9, IZ0 + 2.1, IZ1 - 1.2);
  shelfRun(IX0 + 3.5, IZ0 + 2.1, IZ1 - 1.2);

  // --- east wall: snacks + instant noodles ----------------------------------
  const ex = IX1 - 0.02;
  builder.box(0.5, 2.4, 4.6, M.shelf, { pos: [ex - 0.26, FLOOR + 1.2, -6.2], outline: 1.0 });
  for (let s = 0; s < 5; s++) {
    const y = FLOOR + 0.42 + s * 0.44;
    builder.box(0.46, 0.035, 4.5, M.shelf, { pos: [ex - 0.26, y, -6.2], outline: 0.5 });
    for (let i = 0; i < 12; i++) {
      const pz = -8.3 + i * 0.36;
      prod(ex - 0.26, y + 0.14, pz, 0.32, 0.24, 0.28, productColor(i + s * 3, rng), 0.5);
    }
  }
  // freezer case on the east wall near the back
  builder.box(0.8, 1.9, 1.5, M.fridgeShelf, { pos: [ex - 0.4, FLOOR + 0.95, -8.1], outline: 1.0 });
  builder.add(builder.planeGeo(1.4, 1.4), fridgeGlass, {
    pos: [ex - 0.81, FLOOR + 1.0, -8.1], rot: [0, -Math.PI / 2, 0], outline: 0,
  });

  // --- magazine rack (front-left, back to the window) -----------------------
  const magX = IX0 + 1.0, magZ = IZ1 - 0.9;
  builder.box(1.5, 1.5, 0.44, M.shelf, { pos: [magX, FLOOR + 0.78, magZ], outline: 1.0 });
  for (let s = 0; s < 3; s++) {
    const y = FLOOR + 0.3 + s * 0.46;
    builder.box(1.44, 0.03, 0.4, M.shelf, { pos: [magX, y, magZ], outline: 0.4 });
    for (let i = 0; i < 6; i++) {
      const px = magX - 0.62 + i * 0.25;
      const c = productColor(i + s * 4 + 2, rng);
      builder.box(0.22, 0.3, 0.03, toon(c, { emissive: new THREE.Color(c).multiplyScalar(0.4).getHex() }), {
        pos: [px, y + 0.17, magZ - 0.16], rot: [-0.22, 0, 0], outline: 0.5,
      });
    }
  }

  // --- register counter -----------------------------------------------------
  const cz = -2.7, cx0 = IX0 + 4.9, cx1 = IX1 - 0.35;
  builder.box(cx1 - cx0, 0.9, 0.95, M.counter, { pos: [(cx0 + cx1) / 2, FLOOR + 0.45, cz], outline: 1.1 });
  builder.box(cx1 - cx0 + 0.1, 0.07, 1.05, M.counterTop, { pos: [(cx0 + cx1) / 2, FLOOR + 0.93, cz], outline: 1.1 });
  // lower shelf behind
  builder.box(cx1 - cx0, 0.05, 0.5, M.counter, { pos: [(cx0 + cx1) / 2, FLOOR + 0.25, cz - 0.75], outline: 0.7 });
  // POS terminal
  builder.box(0.42, 0.1, 0.34, M.metal, { pos: [cx0 + 0.5, FLOOR + 1.0, cz], outline: 0.7 });
  builder.box(0.4, 0.3, 0.06, M.screen, { pos: [cx0 + 0.5, FLOOR + 1.2, cz - 0.06], rot: [-0.28, 0, 0], outline: 0 });
  builder.box(0.36, 0.28, 0.3, M.metalDark, { pos: [cx0 + 1.05, FLOOR + 1.08, cz], outline: 0.8 });
  // coffee machine
  builder.box(0.5, 0.72, 0.5, M.metalDark, { pos: [cx0 + 1.75, FLOOR + 1.3, cz], outline: 1.0 });
  builder.box(0.44, 0.16, 0.06, M.screen, { pos: [cx0 + 1.75, FLOOR + 1.56, cz + 0.26], outline: 0 });
  builder.box(0.3, 0.1, 0.22, M.metal, { pos: [cx0 + 1.75, FLOOR + 1.0, cz + 0.12], outline: 0.6 });
  // hot food case (oden / steamed buns)
  builder.box(0.72, 0.4, 0.52, M.warmGlow, { pos: [cx0 + 2.55, FLOOR + 1.14, cz], outline: 0 });
  builder.box(0.78, 0.06, 0.58, M.metal, { pos: [cx0 + 2.55, FLOOR + 0.94, cz], outline: 0.7 });
  builder.box(0.74, 0.44, 0.04, M.metal, { pos: [cx0 + 2.55, FLOOR + 1.14, cz + 0.28], outline: 0.5 });
  // lottery / flyer stand on the counter end
  builder.box(0.24, 0.42, 0.3, M.metal, { pos: [cx1 - 0.25, FLOOR + 1.18, cz], outline: 0.7 });
  builder.box(0.22, 0.3, 0.03, toon(0xf2f4f8, { emissive: 0x555a66 }), {
    pos: [cx1 - 0.25, FLOOR + 1.28, cz + 0.16], rot: [-0.16, 0, 0], outline: 0.4,
  });

  // --- behind-counter goods wall (cigarettes / bottles) ---------------------
  const gw = IZ1 - 1.0;
  builder.box(cx1 - cx0, 1.9, 0.3, M.shelf, { pos: [(cx0 + cx1) / 2, FLOOR + 1.5, cz - 1.25], outline: 1.0 });
  for (let s = 0; s < 4; s++) {
    const y = FLOOR + 0.72 + s * 0.42;
    builder.box(cx1 - cx0 - 0.05, 0.03, 0.28, M.shelfEdge, { pos: [(cx0 + cx1) / 2, y, cz - 1.24], outline: 0.4 });
    for (let i = 0; i < 14; i++) {
      const px = cx0 + 0.16 + i * ((cx1 - cx0 - 0.32) / 13);
      const c = productColor(i + s * 5 + 1, rng);
      prod(px, y + 0.11, cz - 1.24, 0.16, 0.2, 0.16, c, 0.5);
    }
  }
  void gw;

  // --- ATM in the front-right corner ---------------------------------------
  builder.box(0.9, 1.7, 0.62, M.metal, { pos: [IX1 - 0.55, FLOOR + 0.85, IZ1 - 0.85], outline: 1.1 });
  builder.box(0.66, 0.44, 0.06, M.screen, { pos: [IX1 - 0.55, FLOOR + 1.24, IZ1 - 1.14], rot: [-0.1, 0, 0], outline: 0 });
  builder.box(0.5, 0.2, 0.04, M.metalDark, { pos: [IX1 - 0.55, FLOOR + 0.9, IZ1 - 1.14], outline: 0.5 });

  // --- back room door -------------------------------------------------------
  builder.box(0.95, 2.0, 0.08, M.door, { pos: [IX0 + 0.52, FLOOR + 1.0, IZ0 + 0.06], outline: 1.0 });
  builder.box(0.1, 0.1, 0.06, M.metal, { pos: [IX0 + 0.88, FLOOR + 1.0, IZ0 + 0.13], outline: 0.5 });
  builder.box(0.34, 0.2, 0.04, M.lightPanel, { pos: [IX0 + 0.52, FLOOR + 2.22, IZ0 + 0.08], outline: 0 });

  // --- posters, clock, wall graphics ---------------------------------------
  const posters = [posterTexture(7, 0.58), posterTexture(21, 0.06), posterTexture(35, 0.86)];
  const posterMats = posters.map((t) => glow(0xffffff, 1.05, { map: t }));
  posterMats.forEach((m, i) => {
    builder.plane(0.82, 1.15, m, { pos: [IX0 + 0.03, FLOOR + 1.75, -3.6 - i * 1.3], rot: [0, Math.PI / 2, 0] });
  });
  // ceiling-hung aisle signs
  for (const [x, z] of [[IX0 + 1.5, IZ0 + 3.6], [IX0 + 4.1, IZ0 + 3.6], [IX0 + 6.6, IZ0 + 5.4]]) {
    builder.box(1.1, 0.34, 0.03, M.lightPanelCool, { pos: [x, CEIL - 0.62, z], outline: 0.5 });
    builder.box(0.05, 0.28, 0.05, M.metalDark, { pos: [x, CEIL - 0.42, z], outline: 0 });
  }
  // wall clock
  builder.cyl(0.22, 0.22, 0.06, 14, M.white, { pos: [IX0 + 0.06, FLOOR + 2.4, IZ1 - 2.2], rot: [0, 0, Math.PI / 2], outline: 0.8 });
  builder.cyl(0.19, 0.19, 0.02, 14, toon(0xf8f8fa, { emissive: 0x4a4a52 }), {
    pos: [IX0 + 0.1, FLOOR + 2.4, IZ1 - 2.2], rot: [0, 0, Math.PI / 2], outline: 0,
  });

  // --- entry clutter --------------------------------------------------------
  // promotion island just inside the door
  (() => {
    const ix = 5.6, iz = -1.5;
    builder.box(1.3, 0.5, 0.62, M.shelf, { pos: [ix, FLOOR + 0.25, iz], outline: 1.0 });
    builder.box(1.38, 0.05, 0.68, M.shelfEdge, { pos: [ix, FLOOR + 0.52, iz], outline: 0.7 });
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 2; j++) {
        const c = productColor(i * 2 + j + 3, rng);
        prod(ix - 0.52 + i * 0.26, FLOOR + 0.66, iz - 0.16 + j * 0.32, 0.22, 0.26, 0.26, c, 0.6);
      }
    }
    // small poster board on top of the island
    builder.box(0.5, 0.3, 0.03, glow(0xf2f6ff, 0.85), { pos: [ix + 0.1, FLOOR + 0.86, iz - 0.3], rot: [-0.25, 0, 0], outline: 0.4 });
  })();
  // newspaper / magazine shelf facing the window
  (() => {
    const nx = IX0 + 0.35, nz = IZ1 - 2.9;
    builder.box(0.4, 1.2, 1.3, M.shelf, { pos: [nx, FLOOR + 0.6, nz], outline: 1.0 });
    for (let s = 0; s < 3; s++) {
      builder.box(0.36, 0.03, 1.26, M.shelfEdge, { pos: [nx, FLOOR + 0.34 + s * 0.36, nz], outline: 0.4 });
      for (let i = 0; i < 5; i++) {
        const c = productColor(i + s * 3 + 6, rng);
        builder.box(0.05, 0.26, 0.2, toon(c, { emissive: new THREE.Color(c).multiplyScalar(0.2).getHex() }), {
          pos: [nx + 0.12, FLOOR + 0.5 + s * 0.36, nz - 0.5 + i * 0.25], outline: 0.5,
        });
      }
    }
  })();
  // basket stack
  for (let i = 0; i < 5; i++) {
    builder.box(0.42, 0.1, 0.3, toon(0x3f6fd0, { emissive: 0x1c2f5a }), {
      pos: [IX0 + 0.45, FLOOR + 0.06 + i * 0.1, IZ1 - 1.9], outline: 0.6,
    });
  }
  // umbrella stand just inside the door
  builder.cyl(0.17, 0.14, 0.62, 12, M.metal, { pos: [IX0 + 1.9, FLOOR + 0.31, IZ1 - 1.15], outline: 1.0 });
  for (let i = 0; i < 4; i++) {
    const a = i * 1.5;
    builder.cyl(0.022, 0.022, 0.8, 6, toon(0x6a7484, { emissive: 0x2a3038 }), {
      pos: [IX0 + 1.9 + Math.cos(a) * 0.06, FLOOR + 0.5, IZ1 - 1.15 + Math.sin(a) * 0.06],
      rot: [0.12 * Math.cos(a), 0, 0.12 * Math.sin(a)], outline: 0.5,
    });
  }

  // =========================================================================
  // 6. lights
  // =========================================================================
  const mk = (x, y, z, col, i, d) => {
    const l = new THREE.PointLight(col, i, d, 2.0);
    l.position.set(x, y, z);
    scene.add(l);
    dynamic.lights.push(l);
    return l;
  };
  mk(icx, CEIL - 0.35, icz + 1.0, 0xffd894, 8.5, 16);
  mk(IX0 + 1.6, CEIL - 0.4, IZ0 + 2.4, 0xffe2ae, 5.0, 12);
  mk(IX1 - 1.2, CEIL - 0.4, IZ0 + 2.4, 0xffd894, 5.0, 12);
  mk(IX1 - 1.6, 2.0, cz, 0xffdc9e, 4.0, 8); // counter pool
  mk(2.8, 2.4, FRONT + 0.5, 0xffd9a0, 9, 9); // under the canopy
  mk(9.35, 4.6, 2.35, 0xbcd8ff, 6, 12); // pylon sign spill

  // forecourt light pools
  if (ctx.ground) {
    ctx.ground.addLight([2.8, 2.6, 0.6], [1.0, 0.82, 0.58], 6.5, 1.05);
    ctx.ground.addLight([3.8, 1.6, -1.6], [1.0, 0.88, 0.7], 9.0, 1.35);
    ctx.ground.addLight([6.5, 1.6, 0.4], [1.0, 0.9, 0.74], 7.0, 0.85);
    ctx.ground.addLight([9.35, 3.6, 2.35], [0.62, 0.76, 1.0], 6.0, 0.75);
    ctx.ground.addLight([2.8, 2.9, 1.4], [1.0, 0.86, 0.66], 4.0, 0.6);
    ctx.ground.addLight([-1.5, 1.6, -2.4], [1.0, 0.9, 0.74], 3.6, 0.6); // vending machine
  }

  // =========================================================================
  // 7. animation
  // =========================================================================
  const cam = new THREE.Vector3();
  let doorState = 0;
  let doorTimer = 3.5;

  function update(t, dt, camera) {
    if (camera) camera.getWorldPosition(cam);
    for (const m of dynamic.glassMats) m.uniforms.uTime.value = t;

    // sign flicker: mostly steady with occasional nervous dips
    const f = 1
      - 0.06 * Math.max(0, Math.sin(t * 0.7) * Math.sin(t * 3.1))
      - 0.10 * Math.max(0, Math.sin(t * 11.3) - 0.93) * 6;
    for (const m of dynamic.flickers) m.color.setScalar(clamp(1.35 * f, 0, 2.2));

    // automatic doors open on their own rhythm
    doorTimer -= dt;
    if (doorTimer <= 0) { doorTimer = 11 + Math.random() * 9; doorState = 1; }
    if (ctx.forceDoor) doorState = 1;
    if (doorState > 0) {
      const d = dynamic.doors[0];
      const open = ctx.forceDoor ? 1 : Math.sin(clamp(doorState, 0, 1) * Math.PI);
      d.left.position.x = lerp(d.x0, d.x0 - 0.92, open);
      d.right.position.x = lerp(d.x1, d.x1 + 0.92, open);
      doorState -= dt * 0.42;
      if (doorState < 0) doorState = 0;
    }
  }

  return { group, update, materials: M, glassMat };
}

Object.assign(__M.store, { buildStore });
})();
// ==== src/main.js ====
__M.main = {};
(function () {
'use strict';
const __THREE = window.THREE;
// ---------------------------------------------------------------------------
// Rainy-night convenience store corner — a miniature diorama you can orbit.
// ---------------------------------------------------------------------------
const THREE = __THREE;
const { OrbitControls } = __M.OrbitControls;
const { Builder, toon } = __M.toon;
const { buildGround } = __M.ground;
const { PostFX } = __M.postfx;
const { buildSky } = __M.sky;
const { buildStore } = __M.store;
const { buildProps } = __M.props;
const { buildRain } = __M.rain;
const { BASE, COLORS } = __M.config;

// --- query params (debug views / deterministic captures) ---------------------
const qs = new URLSearchParams(location.search);
const num = (k, d) => (qs.has(k) ? parseFloat(qs.get(k)) : d);

// --- renderer ----------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // graded in the composite pass
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = true;

// --- scene -------------------------------------------------------------------
const scene = new THREE.Scene();
const FOG = { color: new THREE.Color(0x0b1220), density: 0.0125 };
scene.fog = new THREE.FogExp2(FOG.color, FOG.density);

const camera = new THREE.PerspectiveCamera(31, innerWidth / innerHeight, 1.0, 320);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.72;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.7;
controls.screenSpacePanning = false;
controls.minDistance = 7;
controls.maxDistance = 78;
controls.minPolarAngle = 0.10;
controls.maxPolarAngle = 1.47;
controls.target.set(1.6, 1.05, -1.8);

// --- lights ------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0x3f548a, 0x2a2620, 1.45);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0x35497a, 0.85);
scene.add(ambient);

const moon = new THREE.DirectionalLight(0xc6d8ff, 1.35);
moon.position.set(-16, 26, 14);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 4;
moon.shadow.camera.far = 78;
moon.shadow.camera.left = -20;
moon.shadow.camera.right = 20;
moon.shadow.camera.top = 20;
moon.shadow.camera.bottom = -20;
moon.shadow.bias = -0.0012;
moon.shadow.normalBias = 0.035;
scene.add(moon);

// a soft warm bounce from the storefront onto the forecourt
const storeBounce = new THREE.PointLight(0xffd9a0, 11, 22, 2.0);
storeBounce.position.set(3.6, 2.1, 1.6);
scene.add(storeBounce);

// --- world -------------------------------------------------------------------
const builder = new Builder();
const sky = buildSky(scene);
const { ground } = buildGround(builder, renderer, scene);

const store = buildStore(builder, scene, { ground, forceDoor: qs.has('door') });
const props = buildProps(builder, scene, { ground });
const rain = buildRain(scene, { ground, splash: !qs.has('nosplash') });
ground.uniforms.uRipAmp.value = num('rip', 1);
ground.uniforms.uWaveScale.value = num('wave', 0.8);
ground.maxSize = num('rtsize', 896);
ground.uniforms.uDebugRefl.value = num('dbgr', 0);
document.documentElement.setAttribute('data-dbg', `rip=${ground.uniforms.uRipAmp.value} dbgr=${ground.uniforms.uDebugRefl.value} rt=${ground.rt.width} vp=${innerWidth}x${innerHeight} dpr=${renderer.getPixelRatio()}`);

const stats = builder.finalize();
scene.add(builder.root);
document.documentElement.setAttribute('data-stats', JSON.stringify({ ...stats, calls: renderer.info.render.calls }));

// --- post --------------------------------------------------------------------
const post = new PostFX(renderer, num('msaa', 4));

// --- 调参面板 ----------------------------------------------------------------
// 面板默认显示，按 H 可隐藏（隐藏后画面就是纯场景，没有任何 UI）
const ui = {
  wave: { u: ground.uniforms.uWaveScale, get: () => num('wave', 0.6), min: 0, max: 1.6, dp: 2 },
  rip: { u: ground.uniforms.uRipAmp, get: () => num('rip', 1), min: 0, max: 2, dp: 2 },
  refl: { u: ground.uniforms.uReflStrength, get: () => num('refl', 0.85), min: 0, max: 1.6, dp: 2 },
  dark: { u: ground.uniforms.uWaterDark, get: () => num('dark', 0.55), min: 0, max: 1, dp: 2 },
  spark: { u: ground.uniforms.uSparkle, get: () => num('spark', 0.02), min: 0, max: 0.2, dp: 3 },
  pool: { u: ground.uniforms.uPoolStrength, get: () => num('pool', 1.2), min: 0, max: 2.5, dp: 2 },
  rain: { get: () => num('rain', 1), min: 0, max: 1.5, dp: 2, apply: (v) => rain.setAmount(v) },
  expo: {
    get: () => num('expo', 1.62), min: 0.6, max: 2.2, dp: 2,
    apply: (v) => { post.composite.material.uniforms.uExposure.value = v; },
  },
};

const panel = document.getElementById('panel');
const showBtn = document.getElementById('show');

for (const [key, cfg] of Object.entries(ui)) {
  const slider = document.getElementById(`s-${key}`);
  const out = document.getElementById(`o-${key}`);
  if (!slider) continue;
  const v0 = cfg.get();
  slider.value = String(v0);
  if (out) out.textContent = v0.toFixed(cfg.dp);
  const apply = () => {
    const v = parseFloat(slider.value);
    if (cfg.u) cfg.u.value = v;
    if (cfg.apply) cfg.apply(v);
    if (out) out.textContent = v.toFixed(cfg.dp);
  };
  slider.addEventListener('input', apply);
  apply(); // URL 参数优先：先应用一次，让面板与画面一致
}

function setPanelVisible(visible) {
  panel.parentElement.classList.toggle('hidden', !visible);
  showBtn.classList.toggle('hidden', visible);
}
document.getElementById('hide').addEventListener('click', () => setPanelVisible(false));
showBtn.addEventListener('click', () => setPanelVisible(true));
addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') setPanelVisible(panel.parentElement.classList.contains('hidden'));
});
if (qs.has('nopanel')) {
  document.getElementById('ui').style.display = 'none';
  showBtn.style.display = 'none';
}

// --- camera framing ----------------------------------------------------------
function fitCamera(azDeg, elDeg, dist) {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  const r = dist;
  camera.position.set(
    controls.target.x + Math.sin(az) * Math.cos(el) * r,
    controls.target.y + Math.sin(el) * r,
    controls.target.z + Math.cos(az) * Math.cos(el) * r,
  );
  controls.update();
}

const DEFAULT_AZ = 24;
const DEFAULT_EL = 18;
function defaultDistance() {
  const aspect = innerWidth / innerHeight;
  return THREE.MathUtils.clamp(46 * (1.80 / aspect) ** 0.5, 30, 78);
}

const useCustomView = ['az', 'el', 'd'].some((k) => qs.has(k));
if (useCustomView) {
  controls.target.set(num('tx', 0.4), num('ty', 1.15), num('tz', -1.0));
  fitCamera(num('az', DEFAULT_AZ), num('el', DEFAULT_EL), num('d', defaultDistance()));
} else {
  fitCamera(DEFAULT_AZ, DEFAULT_EL, defaultDistance());
}

// --- resize ------------------------------------------------------------------
function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  post.setSize(w, h);
  const dpr = renderer.getPixelRatio();
  ground.setSize(w * dpr, h * dpr);
}
addEventListener('resize', resize);
resize();

// --- loop --------------------------------------------------------------------
const clock = new THREE.Clock();
const frozen = qs.has('t');
let elapsed = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed = frozen ? num('t', 0) : elapsed + dt;

  controls.update();
  sky.update(elapsed, camera);
  ground.update(elapsed);
  if (store.update) store.update(elapsed, dt, camera);
  if (props.update) props.update(elapsed, dt, camera);
  if (rain.update) rain.update(elapsed, dt, camera);

  ground.renderMirror(scene, camera);

  if (qs.has('nopost')) { renderer.setRenderTarget(null); renderer.render(scene, camera); }
  else {
    post.render(scene, camera, elapsed);
    if (qs.get('debug') === 'refl') {
      const u = post.composite.material.uniforms;
      u.tScene.value = ground.rt.texture;
      u.uBloom.value = 0;
      u.uExposure.value = 1.0;
      post.composite.render(renderer, null);
    }
  }
  requestAnimationFrame(frame);}
requestAnimationFrame(frame);

// --- debug hook --------------------------------------------------------------
window.__DIORAMA = { scene, camera, controls, renderer, post, stats, fitCamera, ground, store, props, rain, THREE };

})();
