define(function () {
return "@export qtek.compositor.hdr.log_lum\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\n@import qtek.util.rgbm\n\nvoid main()\n{\n    vec4 tex = decodeHDR(texture2D(texture, v_Texcoord));\n    float luminance = dot(tex.rgb, w);\n    luminance = log(luminance + 0.001);\n\n    gl_FragColor = encodeHDR(vec4(vec3(luminance), 1.0));\n}\n\n@end\n\n@export qtek.compositor.hdr.lum_adaption\nvarying vec2 v_Texcoord;\n\nuniform sampler2D adaptedLum;\nuniform sampler2D currentLum;\n\nuniform float frameTime : 0.02;\n\n@import qtek.util.rgbm\n\nvoid main()\n{\n    float fAdaptedLum = decodeHDR(texture2D(adaptedLum, vec2(0.5, 0.5))).r;\n    float fCurrentLum = exp(encodeHDR(texture2D(currentLum, vec2(0.5, 0.5))).r);\n\n    fAdaptedLum += (fCurrentLum - fAdaptedLum) * (1.0 - pow(0.98, 30.0 * frameTime));\n    gl_FragColor = encodeHDR(vec4(vec3(fAdaptedLum), 1.0));\n}\n@end\n\n@export qtek.compositor.hdr.composite\n\nuniform sampler2D texture;\n#ifdef BLOOM_ENABLED\nuniform sampler2D bloom;\n#endif\n#ifdef LENSFLARE_ENABLED\nuniform sampler2D lensflare;\nuniform sampler2D lensdirt;\n#endif\n\n#ifdef LUM_ENABLED\nuniform sampler2D lum;\n#endif\n\n#ifdef LUT_ENABLED\nuniform sampler2D lut;\n#endif\n\n#ifdef VIGNETTE\nuniform float vignetteDarkness: 1.0;\nuniform float vignetteOffset: 1.0;\n#endif\n\nuniform float exposure : 1.0;\nuniform float bloomIntensity : 0.25;\nuniform float lensflareIntensity : 1;\n\nvarying vec2 v_Texcoord;\n\nconst vec3 whiteScale = vec3(11.2);\n\n@import qtek.util.srgb\n\nvec3 uncharted2ToneMap(vec3 x)\n{\n    const float A = 0.22;       const float B = 0.30;       const float C = 0.10;       const float D = 0.20;       const float E = 0.01;       const float F = 0.30;   \n    return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;\n}\n\nvec3 filmicToneMap(vec3 color)\n{\n    vec3 x = max(vec3(0.0), color - 0.004);\n    return (x*(6.2*x+0.5))/(x*(6.2*x+1.7)+0.06);\n}\n\nvec3 ACESToneMapping(vec3 color)\n{\n    const float A = 2.51;\n    const float B = 0.03;\n    const float C = 2.43;\n    const float D = 0.59;\n    const float E = 0.14;\n    return (color * (A * color + B)) / (color * (C * color + D) + E);\n}\n\nfloat eyeAdaption(float fLum)\n{\n    return mix(0.2, fLum, 0.5);\n}\n\n#ifdef LUT_ENABLED\nvec3 lutTransform(vec3 color) {\n    float blueColor = color.b * 63.0;\n\n    vec2 quad1;\n    quad1.y = floor(floor(blueColor) / 8.0);\n    quad1.x = floor(blueColor) - (quad1.y * 8.0);\n\n    vec2 quad2;\n    quad2.y = floor(ceil(blueColor) / 8.0);\n    quad2.x = ceil(blueColor) - (quad2.y * 8.0);\n\n    vec2 texPos1;\n    texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.r);\n    texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.g);\n\n    vec2 texPos2;\n    texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.r);\n    texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.g);\n\n    vec4 newColor1 = texture2D(lut, texPos1);\n    vec4 newColor2 = texture2D(lut, texPos2);\n\n    vec4 newColor = mix(newColor1, newColor2, fract(blueColor));\n    return newColor.rgb;\n}\n#endif\n\n@import qtek.util.rgbm\n\nvoid main()\n{\n        vec4 texel = vec4(0.0);\n#ifdef TEXTURE_ENABLED\n    texel += decodeHDR(texture2D(texture, v_Texcoord));\n#endif\n\n#ifdef BLOOM_ENABLED\n    texel += decodeHDR(texture2D(bloom, v_Texcoord)) * bloomIntensity;\n#endif\n\n#ifdef LENSFLARE_ENABLED\n    texel += decodeHDR(texture2D(lensflare, v_Texcoord)) * texture2D(lensdirt, v_Texcoord) * lensflareIntensity;\n#endif\n\n#ifdef LUM_ENABLED\n    float fLum = texture2D(lum, vec2(0.5, 0.5)).r;\n    float adaptedLumDest = 3.0 / (max(0.1, 1.0 + 10.0*eyeAdaption(fLum)));\n    float exposureBias = adaptedLumDest * exposure;\n#else\n    float exposureBias = exposure;\n#endif\n    texel.rgb *= exposureBias;\n\n                texel.rgb = ACESToneMapping(texel.rgb);\n    texel = linearTosRGB(texel);\n\n#ifdef LUT_ENABLED\n    texel.rgb = lutTransform(clamp(texel.rgb,vec3(0.0),vec3(1.0)));\n#endif\n\n#ifdef VIGNETTE\n    vec2 uv = (v_Texcoord - vec2(0.5)) * vec2(vignetteOffset);\n    texel.rgb = mix(texel.rgb, vec3(1.0 - vignetteDarkness), dot(uv, uv));\n#endif\n\n    gl_FragColor = encodeHDR(texel);\n\n#ifdef DEBUG\n        #if DEBUG == 1\n    gl_FragColor = encodeHDR(decodeHDR(texture2D(texture, v_Texcoord)));\n        #elif DEBUG == 2\n    gl_FragColor = encodeHDR(decodeHDR(texture2D(bloom, v_Texcoord)) * bloomIntensity);\n        #elif DEBUG == 3\n    gl_FragColor = encodeHDR(decodeHDR(texture2D(lensflare, v_Texcoord) * lensflareIntensity));\n    #endif\n#endif\n}\n\n@end";
});