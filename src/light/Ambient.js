define(function(require) {

    var Light = require('../Light');
    var Shader = require('../Shader');

    /**
     * @constructor qtek.light.Ambient
     * @extends qtek.Light
     */
    var AmbientLight = Light.derive({
        castShadow : false
    }, {

        type : 'AMBIENT_LIGHT',

        uniformTemplates : {
            'ambientLightColor' : {
                type : '3f',
                value : function(instance) {
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [color[0]*intensity, color[1]*intensity, color[1]*intensity];
                }
            }
        }
        /**
         * @method
         * @name clone
         * @return {qtek.light.Ambient}
         * @memberOf qtek.light.Ambient.prototype
         */
    })

    return AmbientLight;
})