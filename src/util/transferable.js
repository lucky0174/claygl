import util from '../core/util';
import Geometry from '../Geometry';
import BoundingBox from '../math/BoundingBox';
import Vector3 from '../math/Vector3';

var META = {
    version: 1.0,
    type: 'Geometry',
    generator: 'util.transferable.toObject'
};

/**
 * @alias clay.util.transferable
 */
var transferableUtil = {
    /**
     * Convert geometry to a object containing transferable data
     * @param {Geometry} geometry geometry
     * @param {Boolean} shallow whether shallow copy
     * @returns {Object} { data : data, buffers : buffers }, buffers is the transferable list
     */
    toObject : function (geometry, shallow) {
        if (!geometry) {
            return null;
        }
        var data = {
            metadata : util.extend({}, META)
        };
        //transferable buffers
        var buffers = [];

        //dynamic
        data.dynamic = geometry.dynamic;

        //bounding box
        if (geometry.boundingBox) {
            data.boundingBox = {
                min : geometry.boundingBox.min.toArray(),
                max : geometry.boundingBox.max.toArray()
            };
        }

        //indices
        if (geometry.indices && geometry.indices.length > 0) {
            data.indices = copyIfNecessary(geometry.indices, shallow);
            buffers.push(data.indices.buffer);
        }

        //attributes
        data.attributes = {};
        for (var p in geometry.attributes) { 
            if (geometry.attributes.hasOwnProperty(p)) {
                var attr = geometry.attributes[p];
                //ignore empty attributes
                if (attr && attr.value && attr.value.length > 0) {
                    attr = data.attributes[p] = copyAttribute(attr, shallow);
                    buffers.push(attr.value.buffer);
                }
            }
        }

        return {
            data : data,
            buffers : buffers
        };
    },
    
    /**
     * Reproduce a geometry from object generated by toObject
     * @param {Object} object object generated by toObject
     * @returns {Geometry} geometry
     */
    toGeometry : function (object) {
        if (!object) {
            return null;
        }
        if (object.data && object.buffers) {
            return transferableUtil.toGeometry(object.data);
        }
        if (!object.metadata || object.metadata.generator !== META.generator) {
            throw new Error('[util.transferable.toGeometry] the object is not generated by util.transferable.');
        }

        //basic options
        var options = {
            dynamic : object.dynamic,
            indices : object.indices
        };

        if (object.boundingBox) {
            var min = new Vector3().setArray(object.boundingBox.min);
            var max = new Vector3().setArray(object.boundingBox.max);
            options.boundingBox = new BoundingBox(min, max);
        }

        //attributes
        var attributes = {};
        for (var p in object.attributes) {
            if (object.attributes.hasOwnProperty(p)) {
                var attr = object.attributes[p];
                attributes[p] = new Geometry.Attribute(attr.name, attr.type, attr.size, attr.semantic);
                attributes[p].value = attr.value;
            }
        }
        options.attributes = attributes;

        return new Geometry(options);
    }
    
}

function copyAttribute(attr, shallow) {
    return {
        name : attr.name,
        type : attr.type,
        size : attr.size,
        semantic : attr.semantic,
        value : copyIfNecessary(attr.value, shallow)
    };
}

function copyIfNecessary(arr, shallow) {
    if (!shallow) {
        return new arr.constructor(arr);
    } else {
        return arr;
    }
}

export default transferableUtil;
