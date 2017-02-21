/**
 * Mainly do the parse and compile of shader string
 * Support shader code chunk import and export
 * Support shader semantics
 * http://www.nvidia.com/object/using_sas.html
 * https://github.com/KhronosGroup/collada2json/issues/45
 *
 * TODO: Use etpl or other string template engine
 */
define(function (require) {

    'use strict';

    var Base = require('./core/Base');
    var util = require('./core/util');
    var Cache = require('./core/Cache');
    var vendor = require('./core/vendor');
    var glMatrix = require('./dep/glmatrix');
    var glInfo = require('./core/glinfo');
    var mat2 = glMatrix.mat2;
    var mat3 = glMatrix.mat3;
    var mat4 = glMatrix.mat4;

    var uniformRegex = /uniform\s+(bool|float|int|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube)\s+([\w\,]+)?(\[.*?\])?\s*(:\s*([\S\s]+?))?;/g;
    var attributeRegex = /attribute\s+(float|int|vec2|vec3|vec4)\s+(\w*)\s*(:\s*(\w+))?;/g;
    var defineRegex = /#define\s+(\w+)?(\s+[\w-.]+)?\s*;?\s*\n/g;
    var loopRegex = /for\s*?\(int\s*?_idx_\s*\=\s*([\w-]+)\;\s*_idx_\s*<\s*([\w-]+);\s*_idx_\s*\+\+\s*\)\s*\{\{([\s\S]+?)(?=\}\})\}\}/g;

    var uniformTypeMap = {
        'bool': '1i',
        'int': '1i',
        'sampler2D': 't',
        'samplerCube': 't',
        'float': '1f',
        'vec2': '2f',
        'vec3': '3f',
        'vec4': '4f',
        'ivec2': '2i',
        'ivec3': '3i',
        'ivec4': '4i',
        'mat2': 'm2',
        'mat3': 'm3',
        'mat4': 'm4'
    };

    var uniformValueConstructor = {
        'bool': function () {return true;},
        'int': function () {return 0;},
        'float': function () {return 0;},
        'sampler2D': function () {return null;},
        'samplerCube': function () {return null;},

        'vec2': function () {return [0, 0];},
        'vec3': function () {return [0, 0, 0];},
        'vec4': function () {return [0, 0, 0, 0];},

        'ivec2': function () {return [0, 0];},
        'ivec3': function () {return [0, 0, 0];},
        'ivec4': function () {return [0, 0, 0, 0];},

        'mat2': function () {return mat2.create();},
        'mat3': function () {return mat3.create();},
        'mat4': function () {return mat4.create();},

        'array': function () {return [];}
    };

    var attribSemantics = [
        'POSITION',
        'NORMAL',
        'BINORMAL',
        'TANGENT',
        'TEXCOORD',
        'TEXCOORD_0',
        'TEXCOORD_1',
        'COLOR',
        // Skinning
        // https://github.com/KhronosGroup/glTF/blob/master/specification/README.md#semantics
        'JOINT',
        'WEIGHT'
    ];
    var uniformSemantics = [
        'SKIN_MATRIX',
        // Information about viewport
        'VIEWPORT_SIZE',
        'VIEWPORT',
        // Window size for window relative coordinate
        // https://www.opengl.org/sdk/docs/man/html/gl_FragCoord.xhtml
        'WINDOW_SIZE',
        // Infomation about camera
        'NEAR',
        'FAR'
    ];
    var matrixSemantics = [
        'WORLD',
        'VIEW',
        'PROJECTION',
        'WORLDVIEW',
        'VIEWPROJECTION',
        'WORLDVIEWPROJECTION',
        'WORLDINVERSE',
        'VIEWINVERSE',
        'PROJECTIONINVERSE',
        'WORLDVIEWINVERSE',
        'VIEWPROJECTIONINVERSE',
        'WORLDVIEWPROJECTIONINVERSE',
        'WORLDTRANSPOSE',
        'VIEWTRANSPOSE',
        'PROJECTIONTRANSPOSE',
        'WORLDVIEWTRANSPOSE',
        'VIEWPROJECTIONTRANSPOSE',
        'WORLDVIEWPROJECTIONTRANSPOSE',
        'WORLDINVERSETRANSPOSE',
        'VIEWINVERSETRANSPOSE',
        'PROJECTIONINVERSETRANSPOSE',
        'WORLDVIEWINVERSETRANSPOSE',
        'VIEWPROJECTIONINVERSETRANSPOSE',
        'WORLDVIEWPROJECTIONINVERSETRANSPOSE'
    ];

    // Enable attribute operation is global to all programs
    // Here saved the list of all enabled attribute index
    // http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
    var enabledAttributeList = {};

    var SHADER_STATE_TO_ENABLE = 1;
    var SHADER_STATE_KEEP_ENABLE = 2;
    var SHADER_STATE_PENDING = 3;

    /**
     * @constructor qtek.Shader
     * @extends qtek.core.Base
     *
     * @example
     *     // Create a phong shader
     *     var shader = new qtek.Shader({
     *         vertex: qtek.Shader.source('qtek.phong.vertex'),
     *         fragment: qtek.Shader.source('qtek.phong.fragment')
     *     });
     *     // Enable diffuse texture
     *     shader.enableTexture('diffuseMap');
     *     // Use alpha channel in diffuse texture
     *     shader.define('fragment', 'DIFFUSEMAP_ALPHA_ALPHA');
     */
    var Shader = Base.extend(function () {
        return /** @lends qtek.Shader# */ {
            /**
             * Vertex shader code
             * @type {string}
             */
            vertex: '',

            /**
             * Fragment shader code
             * @type {string}
             */
            fragment: '',


            // FIXME mediump is toooooo low for depth on mobile
            precision: 'highp',

            // Properties follow will be generated by the program
            attribSemantics: {},
            matrixSemantics: {},
            uniformSemantics: {},
            matrixSemanticKeys: [],

            uniformTemplates: {},
            attributeTemplates: {},

            /**
             * Custom defined values in the vertex shader
             * @type {Object}
             */
            vertexDefines: {},
            /**
             * Custom defined values in the vertex shader
             * @type {Object}
             */
            fragmentDefines: {},

            /**
             * Enabled extensions
             * @type {Array.<string>}
             */
            extensions: [
                'OES_standard_derivatives',
                'EXT_shader_texture_lod'
            ],

            /**
             * Used light group. default is all zero
             */
            lightGroup: 0,

            // Defines the each type light number in the scene
            // AMBIENT_LIGHT
            // AMBIENT_SH_LIGHT
            // AMBIENT_CUBEMAP_LIGHT
            // POINT_LIGHT
            // SPOT_LIGHT
            // AREA_LIGHT
            lightNumber: {},

            _textureSlot: 0,

            _attacheMaterialNumber: 0,

            _uniformList: [],
            // {
            //  enabled: true
            //  shaderType: "vertex",
            // }
            _textureStatus: {},

            _vertexProcessed: '',
            _fragmentProcessed: '',

            _currentLocationsMap: {}
        };
    }, function () {

        this._cache = new Cache();

        // All context use same code
        this._codeDirty = true;

        this._updateShaderString();
    },
    /** @lends qtek.Shader.prototype */
    {
        isEqual: function (otherShader) {
            if (!otherShader) {
                return false;
            }
            if (this === otherShader) {
                if (this._codeDirty) {
                    // Still needs update and rebind.
                    return false;
                }
                return true;
            }
            if (otherShader._codeDirty) {
                otherShader._updateShaderString();
            }
            if (this._codeDirty) {
                this._updateShaderString();
            }
            return !(otherShader._vertexProcessed !== this._vertexProcessed
                || otherShader._fragmentProcessed !== this._fragmentProcessed);
        },
        /**
         * Set vertex shader code
         * @param {string} str
         */
        setVertex: function (str) {
            this.vertex = str;
            this._updateShaderString();
            this.dirty();
        },

        /**
         * Set fragment shader code
         * @param {string} str
         */
        setFragment: function (str) {
            this.fragment = str;
            this._updateShaderString();
            this.dirty();
        },

        /**
         * Bind shader program
         * Return true or error msg if error happened
         * @param {WebGLRenderingContext} _gl
         */
        bind: function (_gl) {
            var cache = this._cache;
            cache.use(_gl.__GLID__, getCacheSchema);

            this._currentLocationsMap = cache.get('locations');

            // Reset slot
            this._textureSlot = 0;

            if (this._codeDirty) {
                // PENDING
                // var availableExts = [];
                // var extensions = this.extensions;
                // for (var i = 0; i < extensions.length; i++) {
                //     if (glInfo.getExtension(_gl, extensions[i])) {
                //         availableExts.push(extensions[i]);
                //     }
                // }
                this._updateShaderString();
            }

            if (cache.isDirty('program')) {
                var errMsg = this._buildProgram(_gl, this._vertexProcessed, this._fragmentProcessed);
                cache.fresh('program');

                if (errMsg) {
                    return errMsg;
                }
            }

            _gl.useProgram(cache.get('program'));
        },

        /**
         * Mark dirty and update program in next frame
         */
        dirty: function () {
            var cache = this._cache;
            this._codeDirty = true;
            cache.dirtyAll('program');
            for (var i = 0; i < cache._caches.length; i++) {
                if (cache._caches[i]) {
                    var context = cache._caches[i];
                    context['locations'] = {};
                    context['attriblocations'] = {};
                }
            }
        },

        _updateShaderString: function (extensions) {

            if (this.vertex !== this._vertexPrev ||
                this.fragment !== this._fragmentPrev
            ) {

                this._parseImport();

                this.attribSemantics = {};
                this.matrixSemantics = {};
                this._textureStatus = {};

                this._parseUniforms();
                this._parseAttributes();
                this._parseDefines();

                this._vertexPrev = this.vertex;
                this._fragmentPrev = this.fragment;
            }

            this._addDefineExtensionAndPrecision(extensions);

            this._vertexProcessed = this._unrollLoop(this._vertexProcessed, this.vertexDefines);
            this._fragmentProcessed = this._unrollLoop(this._fragmentProcessed, this.fragmentDefines);

            this._codeDirty = false;
        },

        /**
         * Add a #define micro in shader code
         * @param  {string} shaderType Can be vertex, fragment or both
         * @param  {string} symbol
         * @param  {number} [val]
         */
        define: function (shaderType, symbol, val) {
            var vertexDefines = this.vertexDefines;
            var fragmentDefines = this.fragmentDefines;
            val = val != null ? val : null;
            if (shaderType !== 'vertex' && shaderType !== 'fragment' && shaderType !== 'both'
                && arguments.legnth < 3
            ) {
                // shaderType default to be 'both'
                val = symbol;
                symbol = shaderType;
                shaderType = 'both';
            }
            if (shaderType === 'vertex' || shaderType === 'both') {
                if (vertexDefines[symbol] !== val) {
                    vertexDefines[symbol] = val;
                    // Mark as dirty
                    this.dirty();
                }
            }
            if (shaderType === 'fragment' || shaderType === 'both') {
                if (fragmentDefines[symbol] !== val) {
                    fragmentDefines[symbol] = val;
                    if (shaderType !== 'both') {
                        this.dirty();
                    }
                }
            }
        },

        /**
         * @param  {string} shaderType Can be vertex, fragment or both
         * @param  {string} symbol
         */
        unDefine: function (shaderType, symbol) {
            if (shaderType !== 'vertex' && shaderType !== 'fragment' && shaderType !== 'both'
                && arguments.legnth < 2
            ) {
                // shaderType default to be 'both'
                symbol = shaderType;
                shaderType = 'both';
            }
            if (shaderType === 'vertex' || shaderType === 'both') {
                if (this.isDefined('vertex', symbol)) {
                    delete this.vertexDefines[symbol];
                    // Mark as dirty
                    this.dirty();
                }
            }
            if (shaderType === 'fragment' || shaderType === 'both') {
                if (this.isDefined('fragment', symbol)) {
                    delete this.fragmentDefines[symbol];
                    if (shaderType !== 'both') {
                        this.dirty();
                    }
                }
            }
        },

        /**
         * @param  {string} shaderType Can be vertex, fragment or both
         * @param  {string} symbol
         */
        isDefined: function (shaderType, symbol) {
            switch(shaderType) {
                case 'vertex':
                    return this.vertexDefines[symbol] !== undefined;
                case 'fragment':
                    return this.fragmentDefines[symbol] !== undefined;
            }
        },
        /**
         * @param  {string} shaderType Can be vertex, fragment or both
         * @param  {string} symbol
         */
        getDefine: function (shaderType, symbol) {
            switch(shaderType) {
                case 'vertex':
                    return this.vertexDefines[symbol];
                case 'fragment':
                    return this.fragmentDefines[symbol];
            }
        },
        /**
         * Enable a texture, actually it will add a #define micro in the shader code
         * For example, if texture symbol is diffuseMap, it will add a line `#define DIFFUSEMAP_ENABLED` in the shader code
         * @param  {string} symbol
         */
        enableTexture: function (symbol) {
            if (symbol instanceof Array) {
                for (var i = 0; i < symbol.length; i++) {
                    this.enableTexture(symbol[i]);
                }
                return;
            }

            var status = this._textureStatus[symbol];
            if (status) {
                var isEnabled = status.enabled;
                if (!isEnabled) {
                    status.enabled = true;
                    this.dirty();
                }
            }
        },
        /**
         * Enable all textures used in the shader
         */
        enableTexturesAll: function () {
            var textureStatus = this._textureStatus;
            for (var symbol in textureStatus) {
                textureStatus[symbol].enabled = true;
            }

            this.dirty();
        },
        /**
         * Disable a texture, it remove a #define micro in the shader
         * @param  {string} symbol
         */
        disableTexture: function (symbol) {
            if (symbol instanceof Array) {
                for (var i = 0; i < symbol.length; i++) {
                    this.disableTexture(symbol[i]);
                }
                return;
            }

            var status = this._textureStatus[symbol];
            if (status) {
                var isDisabled = ! status.enabled;
                if (!isDisabled) {
                    status.enabled = false;
                    this.dirty();
                }
            }
        },
        /**
         * Disable all textures used in the shader
         */
        disableTexturesAll: function () {
            var textureStatus = this._textureStatus;
            for (var symbol in textureStatus) {
                textureStatus[symbol].enabled = false;
            }

            this.dirty();
        },
        /**
         * @param  {string}  symbol
         * @return {boolean}
         */
        isTextureEnabled: function (symbol) {
            var textureStatus = this._textureStatus;
            return textureStatus[symbol]
                && textureStatus[symbol].enabled;
        },

        getEnabledTextures: function () {
            var enabledTextures = [];
            var textureStatus = this._textureStatus;
            for (var symbol in textureStatus) {
                if (textureStatus[symbol].enabled) {
                    enabledTextures.push(symbol);
                }
            }
            return enabledTextures;
        },

        hasUniform: function (symbol) {
            var location = this._currentLocationsMap[symbol];
            return location !== null && location !== undefined;
        },

        currentTextureSlot: function () {
            return this._textureSlot;
        },

        resetTextureSlot: function (slot) {
            this._textureSlot = slot || 0;
        },

        useCurrentTextureSlot: function (_gl, texture) {
            var textureSlot = this._textureSlot;

            this.useTextureSlot(_gl, texture, textureSlot);

            this._textureSlot++;

            return textureSlot;
        },

        useTextureSlot: function (_gl, texture, slot) {
            if (texture) {
                _gl.activeTexture(_gl.TEXTURE0 + slot);
                // Maybe texture is not loaded yet;
                if (texture.isRenderable()) {
                    texture.bind(_gl);
                }
                else {
                    // Bind texture to null
                    texture.unbind(_gl);
                }
            }
        },

        setUniform: function (_gl, type, symbol, value) {
            var locationMap = this._currentLocationsMap;
            var location = locationMap[symbol];
            // Uniform is not existed in the shader
            if (location === null || location === undefined) {
                return false;
            }
            switch (type) {
                case 'm4':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix4fv(location, false, value);
                    break;
                case '2i':
                    _gl.uniform2i(location, value[0], value[1]);
                    break;
                case '2f':
                    _gl.uniform2f(location, value[0], value[1]);
                    break;
                case '3i':
                    _gl.uniform3i(location, value[0], value[1], value[2]);
                    break;
                case '3f':
                    _gl.uniform3f(location, value[0], value[1], value[2]);
                    break;
                case '4i':
                    _gl.uniform4i(location, value[0], value[1], value[2], value[3]);
                    break;
                case '4f':
                    _gl.uniform4f(location, value[0], value[1], value[2], value[3]);
                    break;
                case '1i':
                    _gl.uniform1i(location, value);
                    break;
                case '1f':
                    _gl.uniform1f(location, value);
                    break;
                case '1fv':
                    _gl.uniform1fv(location, value);
                    break;
                case '1iv':
                    _gl.uniform1iv(location, value);
                    break;
                case '2iv':
                    _gl.uniform2iv(location, value);
                    break;
                case '2fv':
                    _gl.uniform2fv(location, value);
                    break;
                case '3iv':
                    _gl.uniform3iv(location, value);
                    break;
                case '3fv':
                    _gl.uniform3fv(location, value);
                    break;
                case '4iv':
                    _gl.uniform4iv(location, value);
                    break;
                case '4fv':
                    _gl.uniform4fv(location, value);
                    break;
                case 'm2':
                case 'm2v':
                    _gl.uniformMatrix2fv(location, false, value);
                    break;
                case 'm3':
                case 'm3v':
                    _gl.uniformMatrix3fv(location, false, value);
                    break;
                case 'm4v':
                    // Raw value
                    if (value instanceof Array) {
                        var array = new vendor.Float32Array(value.length * 16);
                        var cursor = 0;
                        for (var i = 0; i < value.length; i++) {
                            var item = value[i];
                            for (var j = 0; j < 16; j++) {
                                array[cursor++] = item[j];
                            }
                        }
                        _gl.uniformMatrix4fv(location, false, array);
                    }
                    else if (value instanceof vendor.Float32Array) {   // ArrayBufferView
                        _gl.uniformMatrix4fv(location, false, value);
                    }
                    break;
            }
            return true;
        },

        setUniformOfSemantic: function (_gl, semantic, val) {
            var semanticInfo = this.uniformSemantics[semantic];
            if (semanticInfo) {
                return this.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, val);
            }
            return false;
        },

        // Enable the attributes passed in and disable the rest
        // Example Usage:
        // enableAttributes(_gl, ["position", "texcoords"])
        enableAttributes: function (_gl, attribList, vao) {

            var program = this._cache.get('program');

            var locationMap = this._cache.get('attriblocations');

            var enabledAttributeListInContext;
            if (vao) {
                enabledAttributeListInContext = vao.__enabledAttributeList;
            }
            else {
                enabledAttributeListInContext = enabledAttributeList[_gl.__GLID__];
            }
            if (! enabledAttributeListInContext) {
                // In vertex array object context
                // PENDING Each vao object needs to enable attributes again?
                if (vao) {
                    enabledAttributeListInContext
                        = vao.__enabledAttributeList
                        = [];
                }
                else {
                    enabledAttributeListInContext
                        = enabledAttributeList[_gl.__GLID__]
                        = [];
                }
            }
            var locationList = [];
            for (var i = 0; i < attribList.length; i++) {
                var symbol = attribList[i];
                if (!this.attributeTemplates[symbol]) {
                    locationList[i] = -1;
                    continue;
                }
                var location = locationMap[symbol];
                if (location === undefined) {
                    location = _gl.getAttribLocation(program, symbol);
                    // Attrib location is a number from 0 to ...
                    if (location === -1) {
                        locationList[i] = -1;
                        continue;
                    }
                    locationMap[symbol] = location;
                }
                locationList[i] = location;

                if (!enabledAttributeListInContext[location]) {
                    enabledAttributeListInContext[location] = SHADER_STATE_TO_ENABLE;
                }
                else {
                    enabledAttributeListInContext[location] = SHADER_STATE_KEEP_ENABLE;
                }
            }

            for (var i = 0; i < enabledAttributeListInContext.length; i++) {
                switch(enabledAttributeListInContext[i]){
                    case SHADER_STATE_TO_ENABLE:
                        _gl.enableVertexAttribArray(i);
                        enabledAttributeListInContext[i] = SHADER_STATE_PENDING;
                        break;
                    case SHADER_STATE_KEEP_ENABLE:
                        enabledAttributeListInContext[i] = SHADER_STATE_PENDING;
                        break;
                    // Expired
                    case SHADER_STATE_PENDING:
                        _gl.disableVertexAttribArray(i);
                        enabledAttributeListInContext[i] = 0;
                        break;
                }
            }

            return locationList;
        },

        _parseImport: function () {

            this._vertexProcessedWithoutDefine = Shader.parseImport(this.vertex);
            this._fragmentProcessedWithoutDefine = Shader.parseImport(this.fragment);

        },

        _addDefineExtensionAndPrecision: function (extensions) {

            extensions = extensions || this.extensions;
            // Extension declaration must before all non-preprocessor codes
            // TODO vertex ? extension enum ?
            var extensionStr = [];
            for (var i = 0; i < extensions.length; i++) {
                extensionStr.push('#extension GL_' + extensions[i] + ' : enable');
            }

            // Add defines
            // VERTEX
            var defineStr = this._getDefineStr(this.vertexDefines);
            this._vertexProcessed = defineStr + '\n' + this._vertexProcessedWithoutDefine;

            // FRAGMENT
            var defineStr = this._getDefineStr(this.fragmentDefines);
            var code = defineStr + '\n' + this._fragmentProcessedWithoutDefine;

            // Add precision
            this._fragmentProcessed = extensionStr.join('\n') + '\n'
                + ['precision', this.precision, 'float'].join(' ') + ';\n'
                + ['precision', this.precision, 'int'].join(' ') + ';\n'
                // depth texture may have precision problem on iOS device.
                + ['precision', this.precision, 'sampler2D'].join(' ') + ';\n'
                + code;
        },

        _getDefineStr: function (defines) {

            var lightNumber = this.lightNumber;
            var textureStatus = this._textureStatus;
            var defineStr = [];
            for (var lightType in lightNumber) {
                var count = lightNumber[lightType];
                if (count > 0) {
                    defineStr.push('#define ' + lightType.toUpperCase() + '_COUNT ' + count);
                }
            }
            for (var symbol in textureStatus) {
                var status = textureStatus[symbol];
                if (status.enabled) {
                    defineStr.push('#define ' + symbol.toUpperCase() + '_ENABLED');
                }
            }
            // Custom Defines
            for (var symbol in defines) {
                var value = defines[symbol];
                if (value === null) {
                    defineStr.push('#define ' + symbol);
                }
                else{
                    defineStr.push('#define ' + symbol + ' ' + value.toString());
                }
            }
            return defineStr.join('\n');
        },

        _unrollLoop: function (shaderStr, defines) {
            // Loop unroll from three.js, https://github.com/mrdoob/three.js/blob/master/src/renderers/webgl/WebGLProgram.js#L175
            // In some case like shadowMap in loop use 'i' to index value much slower.

            // Loop use _idx_ and increased with _idx_++ will be unrolled
            // Use {{ }} to match the pair so the if statement will not be affected
            // Write like following
            // for (int _idx_ = 0; _idx_ < 4; _idx_++) {{
            //     vec3 color = texture2D(textures[_idx_], uv).rgb;
            // }}
            function replace(match, start, end, snippet) {
                var unroll = '';
                // Try to treat as define
                if (isNaN(start)) {
                    if (start in defines) {
                        start = defines[start];
                    }
                    else {
                        start = lightNumberDefines[start];
                    }
                }
                if (isNaN(end)) {
                    if (end in defines) {
                        end = defines[end];
                    }
                    else {
                        end = lightNumberDefines[end];
                    }
                }
                // TODO Error checking

                for (var idx = parseInt(start); idx < parseInt(end); idx++) {
                    // PENDING Add scope?
                    unroll += '{'
                        + snippet
                            .replace(/float\s*\(\s*_idx_\s*\)/g, idx.toFixed(1))
                            .replace(/_idx_/g, idx)
                    + '\n' + '}';
                }

                return unroll;
            }

            var lightNumberDefines = {};
            for (var lightType in this.lightNumber) {
                lightNumberDefines[lightType + '_COUNT'] = this.lightNumber[lightType];
            }
            return shaderStr.replace(loopRegex, replace);
        },

        _parseUniforms: function () {
            var uniforms = {};
            var self = this;
            var shaderType = 'vertex';
            this._uniformList = [];

            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace(uniformRegex, _uniformParser);
            shaderType = 'fragment';
            this._fragmentProcessedWithoutDefine = this._fragmentProcessedWithoutDefine.replace(uniformRegex, _uniformParser);

            self.matrixSemanticKeys = Object.keys(this.matrixSemantics);

            function _uniformParser(str, type, symbol, isArray, semanticWrapper, semantic) {
                if (type && symbol) {
                    var uniformType = uniformTypeMap[type];
                    var isConfigurable = true;
                    var defaultValueFunc;
                    if (uniformType) {
                        self._uniformList.push(symbol);
                        if (type === 'sampler2D' || type === 'samplerCube') {
                            // Texture is default disabled
                            self._textureStatus[symbol] = {
                                enabled: false,
                                shaderType: shaderType
                            };
                        }
                        if (isArray) {
                            uniformType += 'v';
                        }
                        if (semantic) {
                            // This case is only for SKIN_MATRIX
                            // TODO
                            if (attribSemantics.indexOf(semantic) >= 0) {
                                self.attribSemantics[semantic] = {
                                    symbol: symbol,
                                    type: uniformType
                                };
                                isConfigurable = false;
                            }
                            else if (matrixSemantics.indexOf(semantic) >= 0) {
                                var isTranspose = false;
                                var semanticNoTranspose = semantic;
                                if (semantic.match(/TRANSPOSE$/)) {
                                    isTranspose = true;
                                    semanticNoTranspose = semantic.slice(0, -9);
                                }
                                self.matrixSemantics[semantic] = {
                                    symbol: symbol,
                                    type: uniformType,
                                    isTranspose: isTranspose,
                                    semanticNoTranspose: semanticNoTranspose
                                };
                                isConfigurable = false;
                            }
                            else if (uniformSemantics.indexOf(semantic) >= 0) {
                                self.uniformSemantics[semantic] = {
                                    symbol: symbol,
                                    type: uniformType
                                };
                                isConfigurable = false;
                            }
                            else {
                                // The uniform is not configurable, which means it will not appear
                                // in the material uniform properties
                                if (semantic === 'unconfigurable') {
                                    isConfigurable = false;
                                }
                                else {
                                    // Uniform have a defalut value, like
                                    // uniform vec3 color: [1, 1, 1];
                                    defaultValueFunc = self._parseDefaultValue(type, semantic);
                                    if (!defaultValueFunc) {
                                        throw new Error('Unkown semantic "' + semantic + '"');
                                    }
                                    else {
                                        semantic = '';
                                    }
                                }
                            }
                        }

                        if (isConfigurable) {
                            uniforms[symbol] = {
                                type: uniformType,
                                value: isArray ? uniformValueConstructor['array'] : (defaultValueFunc || uniformValueConstructor[type]),
                                semantic: semantic || null
                            };
                        }
                    }
                    return ['uniform', type, symbol, isArray].join(' ') + ';\n';
                }
            }

            this.uniformTemplates = uniforms;
        },

        _parseDefaultValue: function (type, str) {
            var arrayRegex = /\[\s*(.*)\s*\]/;
            if (type === 'vec2' || type === 'vec3' || type === 'vec4') {
                var arrayStr = arrayRegex.exec(str)[1];
                if (arrayStr) {
                    var arr = arrayStr.split(/\s*,\s*/);
                    return function () {
                        return new vendor.Float32Array(arr);
                    };
                }
                else {
                    // Invalid value
                    return;
                }
            }
            else if (type === 'bool') {
                return function () {
                    return str.toLowerCase() === 'true' ? true : false;
                };
            }
            else if (type === 'float') {
                return function () {
                    return parseFloat(str);
                };
            }
            else if (type === 'int') {
                return function () {
                    return parseInt(str);
                };
            }
        },

        // Create a new uniform instance for material
        createUniforms: function () {
            var uniforms = {};

            for (var symbol in this.uniformTemplates){
                var uniformTpl = this.uniformTemplates[symbol];
                uniforms[symbol] = {
                    type: uniformTpl.type,
                    value: uniformTpl.value()
                };
            }

            return uniforms;
        },

        // Attached to material
        attached: function () {
            this._attacheMaterialNumber++;
        },

        // Detached to material
        detached: function () {
            this._attacheMaterialNumber--;
        },

        isAttachedToAny: function () {
            return this._attacheMaterialNumber !== 0;
        },

        _parseAttributes: function () {
            var attributes = {};
            var self = this;
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace(
                attributeRegex, _attributeParser
            );

            function _attributeParser(str, type, symbol, semanticWrapper, semantic) {
                if (type && symbol) {
                    var size = 1;
                    switch (type) {
                        case 'vec4':
                            size = 4;
                            break;
                        case 'vec3':
                            size = 3;
                            break;
                        case 'vec2':
                            size = 2;
                            break;
                        case 'float':
                            size = 1;
                            break;
                    }

                    attributes[symbol] = {
                        // Can only be float
                        type: 'float',
                        size: size,
                        semantic: semantic || null
                    };

                    if (semantic) {
                        if (attribSemantics.indexOf(semantic) < 0) {
                            throw new Error('Unkown semantic "' + semantic + '"');
                        }
                        else {
                            self.attribSemantics[semantic] = {
                                symbol: symbol,
                                type: type
                            };
                        }
                    }
                }

                return ['attribute', type, symbol].join(' ') + ';\n';
            }

            this.attributeTemplates = attributes;
        },

        _parseDefines: function () {
            var self = this;
            var shaderType = 'vertex';
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace(defineRegex, _defineParser);
            shaderType = 'fragment';
            this._fragmentProcessedWithoutDefine = this._fragmentProcessedWithoutDefine.replace(defineRegex, _defineParser);

            function _defineParser(str, symbol, value) {
                var defines = shaderType === 'vertex' ? self.vertexDefines : self.fragmentDefines;
                if (!defines[symbol]) { // Haven't been defined by user
                    if (value == 'false') {
                        defines[symbol] = false;
                    }
                    else if (value == 'true') {
                        defines[symbol] = true;
                    }
                    else {
                        defines[symbol] = value ? parseFloat(value) : null;
                    }
                }
                return '';
            }
        },

        // Return true or error msg if error happened
        _buildProgram: function (_gl, vertexShaderString, fragmentShaderString) {
            var cache = this._cache;
            if (cache.get('program')) {
                _gl.deleteProgram(cache.get('program'));
            }
            var program = _gl.createProgram();

            var vertexShader = _gl.createShader(_gl.VERTEX_SHADER);
            _gl.shaderSource(vertexShader, vertexShaderString);
            _gl.compileShader(vertexShader);

            var fragmentShader = _gl.createShader(_gl.FRAGMENT_SHADER);
            _gl.shaderSource(fragmentShader, fragmentShaderString);
            _gl.compileShader(fragmentShader);

            var msg = checkShaderErrorMsg(_gl, vertexShader, vertexShaderString);
            if (msg) {
                return msg;
            }
            msg = checkShaderErrorMsg(_gl, fragmentShader, fragmentShaderString);
            if (msg) {
                return msg;
            }

            _gl.attachShader(program, vertexShader);
            _gl.attachShader(program, fragmentShader);
            // Force the position bind to location 0;
            if (this.attribSemantics['POSITION']) {
                _gl.bindAttribLocation(program, 0, this.attribSemantics['POSITION'].symbol);
            }
            else {
                // Else choose an attribute and bind to location 0;
                var keys = Object.keys(this.attributeTemplates);
                _gl.bindAttribLocation(program, 0, keys[0]);
            }

            _gl.linkProgram(program);

            if (!_gl.getProgramParameter(program, _gl.LINK_STATUS)) {
                return 'Could not link program\n' + 'VALIDATE_STATUS: ' + _gl.getProgramParameter(program, _gl.VALIDATE_STATUS) + ', gl error [' + _gl.getError() + ']';
            }

            // Cache uniform locations
            for (var i = 0; i < this._uniformList.length; i++) {
                var uniformSymbol = this._uniformList[i];
                var locationMap = cache.get('locations');
                locationMap[uniformSymbol] = _gl.getUniformLocation(program, uniformSymbol);
            }

            _gl.deleteShader(vertexShader);
            _gl.deleteShader(fragmentShader);

            cache.put('program', program);
        },

        /**
         * Clone a new shader
         * @return {qtek.Shader}
         */
        clone: function () {
            var shader = new Shader({
                vertex: this.vertex,
                fragment: this.fragment,
                vertexDefines: util.clone(this.vertexDefines),
                fragmentDefines: util.clone(this.fragmentDefines)
            });
            for (var name in this._textureStatus) {
                shader._textureStatus[name] = util.clone(this._textureStatus[name]);
            }
            return shader;
        },
        /**
         * Dispose given context
         * @param  {WebGLRenderingContext} _gl
         */
        dispose: function (_gl) {
            var cache = this._cache;

            cache.use(_gl.__GLID__);
            var program = cache.get('program');
            if (program) {
                _gl.deleteProgram(program);
            }
            cache.deleteContext(_gl.__GLID__);

            this._locations = {};
        }
    });

    function getCacheSchema() {
        return {
            locations: {},
            attriblocations: {}
        };
    }

    // Return true or error msg if error happened
    function checkShaderErrorMsg(_gl, shader, shaderString) {
        if (!_gl.getShaderParameter(shader, _gl.COMPILE_STATUS)) {
            return [_gl.getShaderInfoLog(shader), addLineNumbers(shaderString)].join('\n');
        }
    }

    // some util functions
    function addLineNumbers(string) {
        var chunks = string.split('\n');
        for (var i = 0, il = chunks.length; i < il; i ++) {
            // Chrome reports shader errors on lines
            // starting counting from 1
            chunks[i] = (i + 1) + ': ' + chunks[i];
        }
        return chunks.join('\n');
    }

    var importRegex = /(@import)\s*([0-9a-zA-Z_\-\.]*)/g;
    Shader.parseImport = function (shaderStr) {
        shaderStr = shaderStr.replace(importRegex, function (str, importSymbol, importName) {
            var str = Shader.source(importName);
            if (str) {
                // Recursively parse
                return Shader.parseImport(str);
            }
            else {
                console.error('Shader chunk "' + importName + '" not existed in library');
                return '';
            }
        });
        return shaderStr;
    };

    var exportRegex = /(@export)\s*([0-9a-zA-Z_\-\.]*)\s*\n([\s\S]*?)@end/g;

    /**
     * Import shader source
     * @param  {string} shaderStr
     * @memberOf qtek.Shader
     */
    Shader['import'] = function (shaderStr) {
        shaderStr.replace(exportRegex, function (str, exportSymbol, exportName, code) {
            var code = code.replace(/(^[\s\t\xa0\u3000]+)|([\u3000\xa0\s\t]+\x24)/g, '');
            if (code) {
                var parts = exportName.split('.');
                var obj = Shader.codes;
                var i = 0;
                var key;
                while (i < parts.length - 1) {
                    key = parts[i++];
                    if (!obj[key]) {
                        obj[key] = {};
                    }
                    obj = obj[key];
                }
                key = parts[i];
                obj[key] = code;
            }
            return code;
        });
    };

    /**
     * Library to store all the loaded shader codes
     * @type {Object}
     * @readOnly
     * @memberOf qtek.Shader
     */
    Shader.codes = {};

    /**
     * Get shader source
     * @param  {string} name
     * @return {string}
     * @memberOf qtek.Shader
     */
    Shader.source = function (name) {
        var parts = name.split('.');
        var obj = Shader.codes;
        var i = 0;
        while (obj && i < parts.length) {
            var key = parts[i++];
            obj = obj[key];
        }
        if (typeof obj !== 'string') {
            // FIXME Use default instead
            console.error('Shader "' + name + '" not existed in library');
            return '';
        }
        return obj;
    };

    return Shader;
});