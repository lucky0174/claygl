// Spherical Harmonic Helpers
define(function (require) {

    var Texture = require('../Texture');
    var FrameBuffer = require('../FrameBuffer');
    var Texture2D = require('../Texture2D');
    var TextureCube = require('../TextureCube');
    var textureUtil = require('./texture');
    var Pass = require('../compositor/Pass');
    var vendor = require('../core/vendor');
    var Skybox = require('../plugin/Skybox');
    var Skydome = require('../plugin/Skydome');
    var EnvironmentMapPass = require('../prePass/EnvironmentMap');
    var Scene = require('../Scene');
    var glmatrix = require('../dep/glmatrix');
    var vec3 = glmatrix.vec3;
    var mat3 = glmatrix.mat3;

    var sh = {};

    var projectEnvMapShaderCode = require('./shader/projectEnvMap.essl');

    var targets = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

    // Project on gpu, but needs browser to support readPixels as Float32Array.
    function projectEnvironmentMapGPU(renderer, envMap) {
        var shTexture = new Texture2D({
            width: 9,
            height: 1,
            type: Texture.FLOAT
        });
        var pass = new Pass({
            fragment: projectEnvMapShaderCode
        });
        pass.material.shader.define('fragment', 'TEXTURE_SIZE', envMap.width);
        pass.setUniform('environmentMap', envMap);

        var framebuffer = new FrameBuffer();
        framebuffer.attach(shTexture);
        pass.render(renderer, framebuffer);

        framebuffer.bind(renderer);
        // TODO Only chrome and firefox support Float32Array
        var pixels = new vendor.Float32Array(9 * 4);
        renderer.gl.readPixels(0, 0, 9, 1, Texture.RGBA, Texture.FLOAT, pixels);

        var coeff = new vendor.Float32Array(9 * 3);
        for (var i = 0; i < 9; i++) {
            coeff[i * 3] = pixels[i * 4];
            coeff[i * 3 + 1] = pixels[i * 4 + 1];
            coeff[i * 3 + 2] = pixels[i * 4 + 2];
        }
        framebuffer.unbind(renderer);

        framebuffer.dispose(renderer.gl);
        pass.dispose(renderer.gl);
        return coeff;
    }

    function harmonics(normal, index){
        var x = normal[0];
        var y = normal[1];
        var z = normal[2];

        if (index === 0) {
            return 1.0;
        }
        else if (index === 1) {
            return x;
        }
        else if (index === 2) {
            return y;
        }
        else if (index === 3) {
            return z;
        }
        else if (index === 4) {
            return x * z;
        }
        else if (index === 5) {
            return y * z;
        }
        else if (index === 6) {
            return x * y;
        }
        else if (index === 7) {
            return 3.0 * z * z - 1.0;
        }
        else {
            return x * x - y * y;
        }
    }

    var normalTransform = {
        px: [2, 1, 0, -1, -1, 1],
        nx: [2, 1, 0, 1, -1, -1],
        py: [0, 2, 1, 1, -1, -1],
        ny: [0, 2, 1, 1, 1, 1],
        pz: [0, 1, 2, -1, -1, -1],
        nz: [0, 1, 2, 1, -1, 1]
    };

    // Project on cpu.
    function projectEnvironmentMapCPU(renderer, cubePixels, width, height) {
        var coeff = new vendor.Float32Array(9 * 3);
        var normal = vec3.create();
        var texel = vec3.create();
        var fetchNormal = vec3.create();
        for (var m = 0; m < 9; m++) {
            var result = vec3.create();
            for (var k = 0; k < targets.length; k++) {
                var pixels = cubePixels[targets[k]];

                var sideResult = vec3.create();
                var divider = 0;
                var i = 0;
                var transform = normalTransform[targets[k]];
                for (var y = 0; y < height; y++) {
                    for (var x = 0; x < width; x++) {

                        normal[0] = x / (width - 1.0) * 2.0 - 1.0;
                        // TODO Flip y?
                        normal[1] = y / (height - 1.0) * 2.0 - 1.0;
                        normal[2] = -1.0;
                        vec3.normalize(normal, normal);

                        fetchNormal[0] = normal[transform[0]] * transform[3];
                        fetchNormal[1] = normal[transform[1]] * transform[4];
                        fetchNormal[2] = normal[transform[2]] * transform[5];

                        texel[0] = pixels[i++] / 255;
                        texel[1] = pixels[i++] / 255;
                        texel[2] = pixels[i++] / 255;
                        // RGBM Decode
                        var scale = pixels[i++] / 255 * 51.5;
                        texel[0] *= scale;
                        texel[1] *= scale;
                        texel[2] *= scale;

                        vec3.scaleAndAdd(sideResult, sideResult, texel, harmonics(fetchNormal, m) * -normal[2]);
                        // -normal.z equals cos(theta) of Lambertian
                        divider += -normal[2];
                    }
                }
                vec3.scaleAndAdd(result, result, sideResult, 1 / divider);
            }

            coeff[m * 3] = result[0] / 6.0;
            coeff[m * 3 + 1] = result[1] / 6.0;
            coeff[m * 3 + 2] = result[2] / 6.0;
        }
        return coeff;
    }

    /**
     * @param  {qtek.Renderer} renderer
     * @param  {qtek.Texture} envMap
     * @param  {Object} [textureOpts]
     * @param  {Object} [textureOpts.lod]
     * @param  {boolean} [textureOpts.decodeRGBM]
     */
    sh.projectEnvironmentMap = function (renderer, envMap, opts) {

        opts = opts || {};
        opts.lod = opts.lod || 0;

        var skybox;
        var dummyScene = new Scene();
        if (envMap instanceof Texture2D) {
            skybox = new Skydome({
                scene: dummyScene,
                environmentMap: envMap
            });
        }
        else {
            skybox = new Skybox({
                scene: dummyScene,
                environmentMap: envMap
            });
        }
        // Convert to rgbm
        var width = 128;
        var height = 128;
        var rgbmTexture = new Texture2D({
            width: width,
            height: height
        });
        var framebuffer = new FrameBuffer();
        skybox.material.shader.define('fragment', 'RGBM_ENCODE');
        if (opts.decodeRGBM) {
            skybox.material.shader.define('fragment', 'RGBM_DECODE');
        }
        skybox.material.set('lod', opts.lod);
        var envMapPass = new EnvironmentMapPass({
            texture: rgbmTexture
        });
        var cubePixels = {};
        for (var i = 0; i < targets.length; i++) {
            cubePixels[targets[i]] = new Uint8Array(width * height * 4);
            var camera = envMapPass.getCamera(targets[i]);
            camera.fov = 90;
            framebuffer.attach(rgbmTexture);
            framebuffer.bind(renderer);
            renderer.render(dummyScene, camera);
            renderer.gl.readPixels(
                0, 0, width, height,
                Texture.RGBA, Texture.UNSIGNED_BYTE, cubePixels[targets[i]]
            );
            framebuffer.unbind(renderer);
        }

        skybox.dispose(renderer.gl);
        framebuffer.dispose(renderer.gl);
        rgbmTexture.dispose(renderer.gl);

        return projectEnvironmentMapCPU(renderer, cubePixels, width, height);
    };

    return sh;
});