export default "@export qtek.compositor.hdr.composite\nuniform sampler2D texture;\n#ifdef BLOOM_ENABLED\nuniform sampler2D bloom;\n#endif\n#ifdef LENSFLARE_ENABLED\nuniform sampler2D lensflare;\nuniform sampler2D lensdirt;\n#endif\n#ifdef LUM_ENABLED\nuniform sampler2D lum;\n#endif\n#ifdef LUT_ENABLED\nuniform sampler2D lut;\n#endif\n#ifdef COLOR_CORRECTION\nuniform float brightness : 0.0;\nuniform float contrast : 1.0;\nuniform float saturation : 1.0;\n#endif\n#ifdef VIGNETTE\nuniform float vignetteDarkness: 1.0;\nuniform float vignetteOffset: 1.0;\n#endif\nuniform float exposure : 1.0;\nuniform float bloomIntensity : 0.25;\nuniform float lensflareIntensity : 1;\nvarying vec2 v_Texcoord;\n@import qtek.util.srgb\nvec3 ACESToneMapping(vec3 color)\n{\n    const float A = 2.51;\n    const float B = 0.03;\n    const float C = 2.43;\n    const float D = 0.59;\n    const float E = 0.14;\n    return (color * (A * color + B)) / (color * (C * color + D) + E);\n}\nfloat eyeAdaption(float fLum)\n{\n    return mix(0.2, fLum, 0.5);\n}\n#ifdef LUT_ENABLED\nvec3 lutTransform(vec3 color) {\n    float blueColor = color.b * 63.0;\n    vec2 quad1;\n    quad1.y = floor(floor(blueColor) / 8.0);\n    quad1.x = floor(blueColor) - (quad1.y * 8.0);\n    vec2 quad2;\n    quad2.y = floor(ceil(blueColor) / 8.0);\n    quad2.x = ceil(blueColor) - (quad2.y * 8.0);\n    vec2 texPos1;\n    texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.r);\n    texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.g);\n    vec2 texPos2;\n    texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.r);\n    texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.g);\n    vec4 newColor1 = texture2D(lut, texPos1);\n    vec4 newColor2 = texture2D(lut, texPos2);\n    vec4 newColor = mix(newColor1, newColor2, fract(blueColor));\n    return newColor.rgb;\n}\n#endif\n@import qtek.util.rgbm\nvoid main()\n{\n    vec4 texel = vec4(0.0);\n    vec4 originalTexel = vec4(0.0);\n#ifdef TEXTURE_ENABLED\n    texel = decodeHDR(texture2D(texture, v_Texcoord));\n    originalTexel = texel;\n#endif\n#ifdef BLOOM_ENABLED\n    vec4 bloomTexel = decodeHDR(texture2D(bloom, v_Texcoord));\n    texel.rgb += bloomTexel.rgb * bloomIntensity;\n    texel.a += bloomTexel.a * bloomIntensity;\n#endif\n#ifdef LENSFLARE_ENABLED\n    texel += decodeHDR(texture2D(lensflare, v_Texcoord)) * texture2D(lensdirt, v_Texcoord) * lensflareIntensity;\n#endif\n    texel.a = min(texel.a, 1.0);\n#ifdef LUM_ENABLED\n    float fLum = texture2D(lum, vec2(0.5, 0.5)).r;\n    float adaptedLumDest = 3.0 / (max(0.1, 1.0 + 10.0*eyeAdaption(fLum)));\n    float exposureBias = adaptedLumDest * exposure;\n#else\n    float exposureBias = exposure;\n#endif\n    texel.rgb *= exposureBias;\n    texel.rgb = ACESToneMapping(texel.rgb);\n    texel = linearTosRGB(texel);\n#ifdef LUT_ENABLED\n    texel.rgb = lutTransform(clamp(texel.rgb,vec3(0.0),vec3(1.0)));\n#endif\n#ifdef COLOR_CORRECTION\n    texel.rgb = clamp(texel.rgb + vec3(brightness), 0.0, 1.0);\n    texel.rgb = clamp((texel.rgb - vec3(0.5))*contrast+vec3(0.5), 0.0, 1.0);\n    float lum = dot(texel.rgb, vec3(0.2125, 0.7154, 0.0721));\n    texel.rgb = mix(vec3(lum), texel.rgb, saturation);\n#endif\n#ifdef VIGNETTE\n    vec2 uv = (v_Texcoord - vec2(0.5)) * vec2(vignetteOffset);\n    texel.rgb = mix(texel.rgb, vec3(1.0 - vignetteDarkness), dot(uv, uv));\n#endif\n    gl_FragColor = encodeHDR(texel);\n#ifdef DEBUG\n    #if DEBUG == 1\n    gl_FragColor = encodeHDR(decodeHDR(texture2D(texture, v_Texcoord)));\n    #elif DEBUG == 2\n    gl_FragColor = encodeHDR(decodeHDR(texture2D(bloom, v_Texcoord)) * bloomIntensity);\n    #elif DEBUG == 3\n    gl_FragColor = encodeHDR(decodeHDR(texture2D(lensflare, v_Texcoord) * lensflareIntensity));\n    #endif\n#endif\n    if (originalTexel.a <= 0.01 && gl_FragColor.a > 1e-5) {\n        gl_FragColor.a = dot(gl_FragColor.rgb, vec3(0.2125, 0.7154, 0.0721));\n    }\n#ifdef PREMULTIPLY_ALPHA\n    gl_FragColor.rgb *= gl_FragColor.a;\n#endif\n}\n@end";
