define(function(require) {
    
    'use strict'

    var Base = require("./core/Base");
    var util = require("./core/util");
    var glenum = require("./core/glenum");
    var Cache = require("./core/Cache");

    // PENDING put the buffer data in attribute ? 
    function Attribute(name, type, size, semantic, isDynamic) {
        this.name = name;
        this.type = type;
        this.size = size;
        if (semantic) {
            this.semantic = semantic;
        }
        if (isDynamic) {
            this._isDynamic = true;
            this.value = [];
        } else {
            this._isDynamic = false;
            this.value = null
        }
    }

    Attribute.prototype.init = function(nVertex) {
        if (!this._isDynamic) {
            if (!this.value || this.value.length != nVertex * this.size) {
                var ArrayConstructor;
                switch(this.type) {
                    case "byte":
                        ArrayConstructor = Int8Array;
                        break;
                    case "ubyte":
                        ArrayConstructor = Uint8Array;
                        break;
                    case "short":
                        ArrayConstructor = Int16Array;
                        break;
                    case "ushort":
                        ArrayConstructor = Uint16Array;
                        break;
                    default:
                        ArrayConstructor = Float32Array;
                        break;
                }
                this.value = new ArrayConstructor(nVertex * this.size);
            }
        } else {
            console.warn('Dynamic geometry not support init method');
        }
    }

    Attribute.prototype.clone = function(copyValue) {
        var ret = new Attribute(this.name, this.type, this.size, this.semantic, this._isDynamic);
        if (copyValue) {
            console.warn('todo');
        }

        return ret;
    }

    function AttributeBuffer(name, type, buffer, size, semantic) {
        this.name = name;
        this.type = type;
        this.buffer = buffer;
        this.size = size;
        this.semantic = semantic;

        // To be set in mesh
        // symbol in the shader
        this.symbol = '';
    }

    function IndicesBuffer(buffer, count) {
        this.buffer = buffer;
        this.count = count;
    }

    function notImplementedWarn() {
        console.warn('Geometry doesn\'t implement this method, use DynamicGeometry or StaticGeometry instead');
    }

    /**
     * @constructor qtek.Geometry
     */
    var Geometry = Base.derive(
    /** @lends qtek.Geometry# */
    {
        /**
         * @type {qtek.math.BoundingBox}
         */
        boundingBox : null,
        
        /**
         * Vertex attributes
         * @type {object}
         */
        attributes : {},

        faces : null,

        /**
         * @type {boolean}
         */
        useFace : true,

        //Max Value of Uint16, i.e. 0xffff
        chunkSize : 65535
        
    }, function() {
        // Use cache
        this._cache = new Cache();

        this._attributeList = Object.keys(this.attributes);
    }, {
        dirty : notImplementedWarn,
        isDirty : notImplementedWarn,
        getVertexNumber : notImplementedWarn,
        getFaceNumber : notImplementedWarn,
        isUseFace : notImplementedWarn,
        isStatic : notImplementedWarn,
        getEnabledAttributes : notImplementedWarn,
        getBufferChunks : notImplementedWarn,
        generateVertexNormals : notImplementedWarn,
        generateFaceNormals : notImplementedWarn,
        isUniqueVertex : notImplementedWarn,
        generateUniqueVertex : notImplementedWarn,
        generateTangents : notImplementedWarn,
        generateBarycentric : notImplementedWarn,
        applyTransform : notImplementedWarn,
        dispose : notImplementedWarn
    });

    Geometry.STATIC_DRAW = glenum.STATIC_DRAW;
    Geometry.DYNAMIC_DRAW = glenum.DYNAMIC_DRAW;
    Geometry.STREAM_DRAW = glenum.STREAM_DRAW;

    Geometry.AttributeBuffer = AttributeBuffer;
    Geometry.IndicesBuffer = IndicesBuffer;
    Geometry.Attribute = Attribute;

    return Geometry
});