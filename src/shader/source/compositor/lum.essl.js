define(function () {
return "@export qtek.compositor.hdr.log_lum\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\n@import qtek.util.rgbm\n\nvoid main()\n{\n    vec4 tex = decodeHDR(texture2D(texture, v_Texcoord));\n    float luminance = dot(tex.rgb, w);\n    luminance = log(luminance + 0.001);\n\n    gl_FragColor = encodeHDR(vec4(vec3(luminance), 1.0));\n}\n\n@end\n\n@export qtek.compositor.hdr.lum_adaption\nvarying vec2 v_Texcoord;\n\nuniform sampler2D adaptedLum;\nuniform sampler2D currentLum;\n\nuniform float frameTime : 0.02;\n\n@import qtek.util.rgbm\n\nvoid main()\n{\n    float fAdaptedLum = decodeHDR(texture2D(adaptedLum, vec2(0.5, 0.5))).r;\n    float fCurrentLum = exp(encodeHDR(texture2D(currentLum, vec2(0.5, 0.5))).r);\n\n    fAdaptedLum += (fCurrentLum - fAdaptedLum) * (1.0 - pow(0.98, 30.0 * frameTime));\n    gl_FragColor = encodeHDR(vec4(vec3(fAdaptedLum), 1.0));\n}\n@end\n\n@export qtek.compositor.lum\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord );\n    float luminance = dot(tex.rgb, w);\n\n    gl_FragColor = vec4(vec3(luminance), 1.0);\n}\n\n@end";
});