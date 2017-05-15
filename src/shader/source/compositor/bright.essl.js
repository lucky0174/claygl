define(function () {
return "@export qtek.compositor.bright\n\nuniform sampler2D texture;\n\nuniform float threshold : 1;\nuniform float scale : 1.0;\n\nuniform vec2 textureSize: [512, 512];\n\nvarying vec2 v_Texcoord;\n\nconst vec3 lumWeight = vec3(0.2125, 0.7154, 0.0721);\n\n@import qtek.util.rgbm\n\n\nvec4 median(vec4 a, vec4 b, vec4 c)\n{\n    return a + b + c - min(min(a, b), c) - max(max(a, b), c);\n}\n\nvoid main()\n{\n    vec4 texel = decodeHDR(texture2D(texture, v_Texcoord));\n\n#ifdef ANTI_FLICKER\n            vec3 d = 1.0 / textureSize.xyx * vec3(1.0, 1.0, 0.0);\n\n    vec4 s1 = decodeHDR(texture2D(texture, v_Texcoord - d.xz));\n    vec4 s2 = decodeHDR(texture2D(texture, v_Texcoord + d.xz));\n    vec4 s3 = decodeHDR(texture2D(texture, v_Texcoord - d.zy));\n    vec4 s4 = decodeHDR(texture2D(texture, v_Texcoord + d.zy));\n    texel = median(median(texel, s1, s2), s3, s4);\n\n#endif\n\n    float lum = dot(texel.rgb, lumWeight);\n    vec4 color;\n    if (lum > threshold)\n    {\n        color = vec4(texel.rgb * scale, texel.a);\n    }\n    else\n    {\n        color = vec4(vec3(0.0), 1.0);\n    }\n\n    gl_FragColor = encodeHDR(color);\n}\n@end\n";
});