define(function (require) {

    'use strict';

    var Base = require('./core/Base');
    var TextureCube = require('./TextureCube');
    var glinfo = require('./core/glinfo');
    var glenum = require('./core/glenum');
    var Cache = require('./core/Cache');

    var KEY_FRAMEBUFFER = 'framebuffer';
    var KEY_RENDERBUFFER = 'renderbuffer';
    var KEY_RENDERBUFFER_WIDTH = KEY_RENDERBUFFER + '_width';
    var KEY_RENDERBUFFER_HEIGHT = KEY_RENDERBUFFER + '_height';
    var KEY_RENDERBUFFER_ATTACHED = KEY_RENDERBUFFER + '_attached';
    var KEY_DEPTHTEXTURE_ATTACHED = 'depthtexture_attached';

    var GL_FRAMEBUFFER = glenum.FRAMEBUFFER;
    var GL_RENDERBUFFER = glenum.RENDERBUFFER;
    var GL_DEPTH_ATTACHMENT = glenum.DEPTH_ATTACHMENT;
    var GL_COLOR_ATTACHMENT0 = glenum.COLOR_ATTACHMENT0;
    /**
     * @constructor qtek.FrameBuffer
     * @extends qtek.core.Base
     */
    var FrameBuffer = Base.extend(
    /** @lends qtek.FrameBuffer# */
    {
        /**
         * If use depth buffer
         * @type {boolean}
         */
        depthBuffer: true,

        /**
         * @type {Object}
         */
        viewport: null,

        _textures: null,

        _width: 0,
        _height: 0,

        _boundGL: null,
    }, function () {
        // Use cache
        this._cache = new Cache();

        this._textures = {};
    },

    /**@lends qtek.FrameBuffer.prototype. */
    {
        /**
         * Bind the framebuffer to given renderer before rendering
         * @param  {qtek.Renderer} renderer
         */
        bind: function (renderer) {

            var _gl = renderer.gl;

            _gl.bindFramebuffer(GL_FRAMEBUFFER, this._getFrameBufferGL(_gl));
            this._boundGL = _gl;
            var cache = this._cache;

            cache.put('viewport', renderer.viewport);

            if (this.viewport) {
                renderer.setViewport(this.viewport);
            }
            else {
                renderer.setViewport(0, 0, this._width, this._height, 1);
            }

            for (var attachment in this._textures) {
                var obj = this._textures[attachment];
                // Attach textures
                this._doAttach(_gl, obj.texture, attachment, obj.target);
            }

            var attachedTextures = cache.get('attached_textures');
            if (attachedTextures) {
                for (var attachment in attachedTextures) {
                    if (!this._textures[attachment]) {
                        var target = attachedTextures[attachment];
                        this._doDetach(_gl, attachment, target);
                    }
                }
            }
            if (!cache.get(KEY_DEPTHTEXTURE_ATTACHED) && this.depthBuffer) {
                // Create a new render buffer
                if (cache.miss(KEY_RENDERBUFFER)) {
                    cache.put(KEY_RENDERBUFFER, _gl.createRenderbuffer());
                }
                var width = this._width;
                var height = this._height;
                var renderbuffer = cache.get(KEY_RENDERBUFFER);

                if (width !== cache.get(KEY_RENDERBUFFER_WIDTH)
                     || height !== cache.get(KEY_RENDERBUFFER_HEIGHT)) {
                    _gl.bindRenderbuffer(GL_RENDERBUFFER, renderbuffer);
                    _gl.renderbufferStorage(GL_RENDERBUFFER, _gl.DEPTH_COMPONENT16, width, height);
                    cache.put(KEY_RENDERBUFFER_WIDTH, width);
                    cache.put(KEY_RENDERBUFFER_HEIGHT, height);
                    _gl.bindRenderbuffer(GL_RENDERBUFFER, null);
                }
                if (!cache.get(KEY_RENDERBUFFER_ATTACHED)) {
                    _gl.framebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, renderbuffer);
                    cache.put(KEY_RENDERBUFFER_ATTACHED, true);
                }
            }
        },
        /**
         * Unbind the frame buffer after rendering
         * @param  {qtek.Renderer} renderer
         */
        unbind: function (renderer) {
            var _gl = renderer.gl;

            _gl.bindFramebuffer(GL_FRAMEBUFFER, null);
            this._boundGL = null;

            this._cache.use(_gl.__GLID__);
            var viewport = this._cache.get('viewport');
            // Reset viewport;
            if (viewport) {
                renderer.setViewport(viewport);
            }

            // Because the data of texture is changed over time,
            // Here update the mipmaps of texture each time after rendered;
            // PENDGING
            for (var attachment in this._textures) {
                var texture = this._textures[attachment].texture;
                if (!texture.NPOT && texture.useMipmap) {
                    var target = texture instanceof TextureCube ? glenum.TEXTURE_CUBE_MAP : glenum.TEXTURE_2D;
                    _gl.bindTexture(target, texture.getWebGLTexture(_gl));
                    _gl.generateMipmap(target);
                    _gl.bindTexture(target, null);
                }
            }
        },

        _getFrameBufferGL: function (_gl) {
            var cache = this._cache;
            cache.use(_gl.__GLID__);

            if (cache.miss(KEY_FRAMEBUFFER)) {
                cache.put(KEY_FRAMEBUFFER, _gl.createFramebuffer());
            }

            return cache.get(KEY_FRAMEBUFFER);
        },

        /**
         * Attach a texture(RTT) to the framebuffer
         * @param  {qtek.Texture} texture
         * @param  {number} [attachment=gl.COLOR_ATTACHMENT0]
         * @param  {number} [target=gl.TEXTURE_2D]
         */
        attach: function (texture, attachment, target) {

            if (!texture.width) {
                throw new Error('The texture attached to color buffer is not a valid.');
            }
            // TODO width and height check

            // If the depth_texture extension is enabled, developers
            // Can attach a depth texture to the depth buffer
            // http://blog.tojicode.com/2012/07/using-webgldepthtexture.html
            attachment = attachment || GL_COLOR_ATTACHMENT0;
            target = target || glenum.TEXTURE_2D;

            var _gl = this._boundGL;
            var attachedTextures;

            if (_gl) {
                var cache = this._cache;
                cache.use(_gl.__GLID__);
                attachedTextures = cache.get('attached_textures');
            }
            // Always update width and height
            this._width = texture.width;
            this._height = texture.height;

            // Check if texture attached
            var previous = this._textures[attachment];
            if (previous && previous.target === target
                && previous.texture === texture
                && (attachedTextures && attachedTextures[attachment] != null)
            ) {
                return;
            }

            var canAttach = true;
            if (_gl) {
                canAttach = this._doAttach(_gl, texture, attachment, target);
            }

            if (canAttach) {
                this._textures[attachment] = this._textures[attachment] || {};
                this._textures[attachment].texture = texture;
                this._textures[attachment].target = target;
            }
        },

        _doAttach: function (_gl, texture, attachment, target) {

            // Make sure texture is always updated
            // Because texture width or height may be changed and in this we can't be notified
            // FIXME awkward;
            var webglTexture = texture.getWebGLTexture(_gl);
            // Assume cache has been used.
            var attachedTextures = this._cache.get('attached_textures');
            if (attachedTextures && attachedTextures[attachment]) {
                var obj = attachedTextures[attachment];
                // Check if texture and target not changed
                if (obj.texture === texture && obj.target === target) {
                    return;
                }
            }
            attachment = +attachment;

            var canAttach = true;
            if (attachment === GL_DEPTH_ATTACHMENT || attachment === glenum.DEPTH_STENCIL_ATTACHMENT) {
                var extension = glinfo.getExtension(_gl, 'WEBGL_depth_texture');

                if (!extension) {
                    console.error('Depth texture is not supported by the browser');
                    canAttach = false;
                }
                if (texture.format !== glenum.DEPTH_COMPONENT
                    && texture.format !== glenum.DEPTH_STENCIL
                ) {
                    console.error('The texture attached to depth buffer is not a valid.');
                    canAttach = false;
                }

                // Dispose render buffer created previous
                if (canAttach) {
                    var renderBuffer = this._cache.get(KEY_RENDERBUFFER);
                    if (renderBuffer) {
                        _gl.deleteRenderbuffer(renderBuffer);
                        this._cache.put(KEY_RENDERBUFFER, false);
                    }

                    this._cache.put(KEY_RENDERBUFFER_ATTACHED, false);
                    this._cache.put(KEY_DEPTHTEXTURE_ATTACHED, true);
                }
            }

            // Mipmap level can only be 0
            _gl.framebufferTexture2D(GL_FRAMEBUFFER, attachment, target, webglTexture, 0);

            if (!attachedTextures) {
                attachedTextures = {};
                this._cache.put('attached_textures', attachedTextures);
            }
            attachedTextures[attachment] = attachedTextures[attachment] || {};
            attachedTextures[attachment].texture = texture;
            attachedTextures[attachment].target = target;

            return canAttach;
        },

        _doDetach: function (_gl, attachment, target) {
            // Detach a texture from framebuffer
            // https://github.com/KhronosGroup/WebGL/blob/master/conformance-suites/1.0.0/conformance/framebuffer-test.html#L145
            _gl.framebufferTexture2D(GL_FRAMEBUFFER, attachment, target, null, 0);

            // Assume cache has been used.
            var attachedTextures = this._cache.get('attached_textures');
            if (attachedTextures && attachedTextures[attachment]) {
                attachedTextures[attachment] = null;
            }

            this._cache.put(KEY_RENDERBUFFER_ATTACHED, false);
            this._cache.put(KEY_DEPTHTEXTURE_ATTACHED, true);
        },

        /**
         * Detach a texture
         * @param  {number} [attachment=gl.COLOR_ATTACHMENT0]
         * @param  {number} [target=gl.TEXTURE_2D]
         */
        detach: function (attachment, target) {
            // TODO depth extension check ?
            this._textures[attachment] = null;
            if (this._boundGL) {
                var cache = this._cache;
                cache.use(this._boundGL.__GLID__);
                this._doDetach(this._boundGL, attachment, target);
            }
        },
        /**
         * Dispose
         * @param  {WebGLRenderingContext} _gl
         */
        dispose: function (_gl) {

            var cache = this._cache;

            cache.use(_gl.__GLID__);

            var renderBuffer = cache.get(KEY_RENDERBUFFER);
            if (renderBuffer) {
                _gl.deleteRenderbuffer(renderBuffer);
            }
            var frameBuffer = cache.get(KEY_FRAMEBUFFER);
            if (frameBuffer) {
                _gl.deleteFramebuffer(frameBuffer);
            }
            cache.deleteContext(_gl.__GLID__);

            // Clear cache for reusing
            this._textures = {};
            this._width = this._height = 0;

        }
    });

    FrameBuffer.DEPTH_ATTACHMENT = GL_DEPTH_ATTACHMENT;
    FrameBuffer.COLOR_ATTACHMENT0 = GL_COLOR_ATTACHMENT0;
    FrameBuffer.STENCIL_ATTACHMENT = glenum.STENCIL_ATTACHMENT;
    FrameBuffer.DEPTH_STENCIL_ATTACHMENT = glenum.DEPTH_STENCIL_ATTACHMENT;

    return FrameBuffer;
});