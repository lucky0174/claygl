define(function () {
return "// Sousa_Graphics_Gems_CryENGINE3, Siggraph 2013\n// The Skylanders SWAP Force Depth-of-Field Shader in GPU Pro 4\n@export qtek.compositor.dof.coc\n\nuniform sampler2D depth;\n\nuniform float zNear: 0.1;\nuniform float zFar: 2000;\n\nuniform float focalDist: 3;\n// Object in range are perfectly in focus\nuniform float focalRange: 1;\n// 30mm\nuniform float focalLength: 30;\n// f/2.8\nuniform float fstop: 0.36;\n\nvarying vec2 v_Texcoord;\n\n@import qtek.util.encode_float\n\nvoid main()\n{\n    float z = texture2D(depth, v_Texcoord).r;\n\n    float dist = 2.0 * zNear * zFar / (zFar + zNear - z * (zFar - zNear));\n\n    float aperture = 1.0 / fstop;\n\n    float coc;\n\n    float uppper = focalDist + focalRange;\n    float lower = focalDist - focalRange;\n    if (dist <= uppper && dist >= lower) {\n        // Object in range are perfectly in focus\n        coc = 0.5;\n    }\n    else {\n        // Adjust focalDist\n        float focalAdjusted = dist > uppper ? uppper : lower;\n\n        // GPU Gems Depth of Field: A Survey of Techniques\n        coc = abs(aperture * (focalLength * (dist - focalAdjusted)) / (dist * (focalAdjusted - focalLength)));\n        // Clamp on the near focus plane and far focus plane\n        // PENDING\n        // Float value can only be [0.0 - 1.0)\n        coc = clamp(coc, 0.0, 0.4) / 0.4000001;\n\n        // Near field\n        if (dist < lower) {\n            coc = -coc;\n        }\n        coc = coc * 0.5 + 0.5;\n    }\n\n    // R: coc, < 0.5 is near field, > 0.5 is far field\n    gl_FragColor = encodeFloat(coc);\n}\n\n@end\n\n// Premutiply with coc to avoid bleeding in upsampling\n@export qtek.compositor.dof.premutiply\n\nuniform sampler2D texture;\nuniform sampler2D coc;\nvarying vec2 v_Texcoord;\n\n@import qtek.util.rgbm\n\n@import qtek.util.decode_float\n\nvoid main() {\n    float fCoc = max(abs(decodeFloat(texture2D(coc, v_Texcoord)) * 2.0 - 1.0), 0.1);\n    gl_FragColor = encodeHDR(\n        vec4(decodeHDR(texture2D(texture, v_Texcoord)).rgb * fCoc, 1.0)\n    );\n}\n@end\n\n\n// Get min coc tile\n@export qtek.compositor.dof.min_coc\nuniform sampler2D coc;\nvarying vec2 v_Texcoord;\nuniform vec2 textureSize : [512.0, 512.0];\n\n@import qtek.util.float\n\nvoid main()\n{\n    vec4 d = vec4(-1.0, -1.0, 1.0, 1.0) / textureSize.xyxy;\n\n    float fCoc = decodeFloat(texture2D(coc, v_Texcoord + d.xy));\n    fCoc = min(fCoc, decodeFloat(texture2D(coc, v_Texcoord + d.zy)));\n    fCoc = min(fCoc, decodeFloat(texture2D(coc, v_Texcoord + d.xw)));\n    fCoc = min(fCoc, decodeFloat(texture2D(coc, v_Texcoord + d.zw)));\n\n    gl_FragColor = encodeFloat(fCoc);\n}\n\n@end\n\n\n// Get max coc tile\n@export qtek.compositor.dof.max_coc\nuniform sampler2D coc;\nvarying vec2 v_Texcoord;\nuniform vec2 textureSize : [512.0, 512.0];\n\n@import qtek.util.float\n\nvoid main()\n{\n\n    vec4 d = vec4(-1.0, -1.0, 1.0, 1.0) / textureSize.xyxy;\n\n    float fCoc = decodeFloat(texture2D(coc, v_Texcoord + d.xy));\n    fCoc = max(fCoc, decodeFloat(texture2D(coc, v_Texcoord + d.zy)));\n    fCoc = max(fCoc, decodeFloat(texture2D(coc, v_Texcoord + d.xw)));\n    fCoc = max(fCoc, decodeFloat(texture2D(coc, v_Texcoord + d.zw)));\n\n    gl_FragColor = encodeFloat(fCoc);\n}\n\n@end\n\n\n\n\n@export qtek.compositor.dof.coc_upsample\n\n#define HIGH_QUALITY\n\nuniform sampler2D coc;\nuniform vec2 textureSize : [512, 512];\n\nvarying vec2 v_Texcoord;\n\n@import qtek.util.float\n\nvoid main()\n{\n\n#ifdef HIGH_QUALITY\n    // 9-tap bilinear upsampler (tent filter)\n    vec4 d = vec4(1.0, 1.0, -1.0, 0.0) / textureSize.xyxy;\n\n    float s;\n    s  = decodeFloat(texture2D(coc, v_Texcoord - d.xy));\n    s += decodeFloat(texture2D(coc, v_Texcoord - d.wy)) * 2.0;\n    s += decodeFloat(texture2D(coc, v_Texcoord - d.zy));\n\n    s += decodeFloat(texture2D(coc, v_Texcoord + d.zw)) * 2.0;\n    s += decodeFloat(texture2D(coc, v_Texcoord       )) * 4.0;\n    s += decodeFloat(texture2D(coc, v_Texcoord + d.xw)) * 2.0;\n\n    s += decodeFloat(texture2D(coc, v_Texcoord + d.zy));\n    s += decodeFloat(texture2D(coc, v_Texcoord + d.wy)) * 2.0;\n    s += decodeFloat(texture2D(coc, v_Texcoord + d.xy));\n\n    gl_FragColor = encodeFloat(s / 16.0);\n#else\n    // 4-tap bilinear upsampler\n    vec4 d = vec4(-1.0, -1.0, +1.0, +1.0) / textureSize.xyxy;\n\n    float s;\n    s  = decodeFloat(texture2D(coc, v_Texcoord + d.xy));\n    s += decodeFloat(texture2D(coc, v_Texcoord + d.zy));\n    s += decodeFloat(texture2D(coc, v_Texcoord + d.xw));\n    s += decodeFloat(texture2D(coc, v_Texcoord + d.zw));\n\n    gl_FragColor = encodeFloat(s / 4.0);\n#endif\n}\n\n@end\n\n\n\n\n\n\n\n\n@export qtek.compositor.dof.coc_helper\n\nvoid packCocToRGBM(inout vec4 rgbm, float coc) {\n#if defined(RGBM_ENCODE) || defined(RGBM)\n    // Pack alpha with two half byte value, coc and multiplier of RGBM\n\n    // There is no round function in the glsl\n    float m = floor(rgbm.a * 123.0 + 0.5);\n    coc = floor(coc + 0.5);\n\n    rgbm.a = (m * 4.0 + coc) / 255.0;\n#else\n    rgbm.a = coc;\n#endif\n}\n\nfloat unpackCocFromRGBM(inout vec4 rgbm) {\n#if defined(RGBM_DECODE) || defined(RGBM)\n    float a = rgbm.a * 255.0;\n    rgbm.a = floor(a);\n    float coc = a - rgbm.a * 4.0;\n    rgbm.a /= 123.0;\n    return coc;\n#else\n    float coc = rgbm.a;\n    return coc;\n#endif\n}\n@end\n\n\n\n@export qtek.compositor.dof.hexagonal_blur_frag\n\n@import qtek.util.float\n\n\nvec4 doBlur(sampler2D targetTexture, vec2 offset) {\n#ifdef BLUR_COC\n    float cocSum = 0.0;\n#else\n    vec4 color = vec4(0.0);\n#endif\n\n    float weightSum = 0.0;\n    float kernelWeight = 1.0 / float(KERNEL_SIZE);\n\n    for (int i = 0; i < KERNEL_SIZE; i++) {\n        vec2 coord = v_Texcoord + offset * float(i);\n\n        float w = kernelWeight;\n#ifdef BLUR_COC\n        float fCoc = decodeFloat(texture2D(targetTexture, coord)) * 2.0 - 1.0;\n        // Blur coc in nearfield\n        cocSum += clamp(fCoc, -1.0, 0.0) * w;\n#else\n        float fCoc = decodeFloat(texture2D(coc, coord)) * 2.0 - 1.0;\n        vec4 texel = texture2D(targetTexture, coord);\n    #if !defined(BLUR_NEARFIELD)\n        w *= abs(fCoc);\n    #endif\n        color += decodeHDR(texel) * w;\n#endif\n\n        weightSum += w;\n    }\n#ifdef BLUR_COC\n    return encodeFloat(clamp(cocSum / weightSum, -1.0, 0.0) * 0.5 + 0.5);\n#else\n    return color / weightSum;\n#endif\n}\n\n@end\n\n\n@export qtek.compositor.dof.hexagonal_blur_1\n\n#define KERNEL_SIZE 5\n\nuniform sampler2D texture;\nuniform sampler2D coc;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 1.0;\n\nuniform vec2 textureSize : [512.0, 512.0];\n\n@import qtek.util.rgbm\n\n@import qtek.compositor.dof.hexagonal_blur_frag\n\nvoid main()\n{\n    vec2 offset = blurSize / textureSize;\n\n#if !defined(BLUR_NEARFIELD) && !defined(BLUR_COC)\n    offset *= abs(decodeFloat(texture2D(coc, v_Texcoord)) * 2.0 - 1.0);\n#endif\n\n    // TOP\n    gl_FragColor = doBlur(texture, vec2(0.0, offset.y));\n#if !defined(BLUR_COC)\n    gl_FragColor = encodeHDR(gl_FragColor);\n#endif\n}\n\n@end\n\n@export qtek.compositor.dof.hexagonal_blur_2\n\n#define KERNEL_SIZE 5\n\nuniform sampler2D texture;\nuniform sampler2D coc;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 1.0;\n\nuniform vec2 textureSize : [512.0, 512.0];\n\n@import qtek.util.rgbm\n\n@import qtek.compositor.dof.hexagonal_blur_frag\n\nvoid main()\n{\n    vec2 offset = blurSize / textureSize;\n#if !defined(BLUR_NEARFIELD) && !defined(BLUR_COC)\n    offset *= abs(decodeFloat(texture2D(coc, v_Texcoord)) * 2.0 - 1.0);\n#endif\n\n    offset.y /= 2.0;\n\n    // BOTTOM LEFT\n    gl_FragColor = doBlur(texture, -offset);\n#if !defined(BLUR_COC)\n    gl_FragColor = encodeHDR(gl_FragColor);\n#endif\n}\n@end\n\n@export qtek.compositor.dof.hexagonal_blur_3\n\n#define KERNEL_SIZE 5\n\nuniform sampler2D texture1;\nuniform sampler2D texture2;\nuniform sampler2D coc;\n\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 1.0;\n\nuniform vec2 textureSize : [512.0, 512.0];\n\n@import qtek.util.rgbm\n\n@import qtek.compositor.dof.hexagonal_blur_frag\n\nvoid main()\n{\n    vec2 offset = blurSize / textureSize;\n\n#if !defined(BLUR_NEARFIELD) && !defined(BLUR_COC)\n    offset *= abs(decodeFloat(texture2D(coc, v_Texcoord)) * 2.0 - 1.0);\n#endif\n\n    offset.y /= 2.0;\n    vec2 vDownRight = vec2(offset.x, -offset.y);\n\n    // Down left\n    vec4 texel1 = doBlur(texture1, -offset);\n    // Down right\n    vec4 texel2 = doBlur(texture1, vDownRight);\n    // Down right\n    vec4 texel3 = doBlur(texture2, vDownRight);\n\n#ifdef BLUR_COC\n    float coc1 = decodeFloat(texel1) * 2.0 - 1.0;\n    float coc2 = decodeFloat(texel2) * 2.0 - 1.0;\n    float coc3 = decodeFloat(texel3) * 2.0 - 1.0;\n    gl_FragColor = encodeFloat(\n        ((coc1 + coc2 + coc3) / 3.0) * 0.5 + 0.5\n    );\n\n#else\n    vec4 color = (texel1 + texel2 + texel3) / 3.0;\n    gl_FragColor = encodeHDR(color);\n#endif\n}\n\n@end\n\n@export qtek.compositor.dof.composite\n\n#define DEBUG 0\n\nuniform sampler2D original;\nuniform sampler2D blurred;\nuniform sampler2D nearfield;\nuniform sampler2D coc;\nuniform sampler2D nearcoc;\nvarying vec2 v_Texcoord;\n\n@import qtek.util.rgbm\n@import qtek.util.float\n\nvoid main()\n{\n    vec4 blurredColor = decodeHDR(texture2D(blurred, v_Texcoord));\n    vec4 originalColor = decodeHDR(texture2D(original, v_Texcoord));\n\n    float fCoc = decodeFloat(texture2D(coc, v_Texcoord));\n\n    // FIXME blur after premultiply will have white edge\n    fCoc = abs(fCoc * 2.0 - 1.0);\n\n    float weight = smoothstep(0.0, 1.0, fCoc);\n\n#ifdef NEARFIELD_ENABLED\n    vec4 nearfieldColor = decodeHDR(texture2D(nearfield, v_Texcoord));\n    float fNearCoc = decodeFloat(texture2D(nearcoc, v_Texcoord));\n    fNearCoc = abs(fNearCoc * 2.0 - 1.0);\n\n\n    // blurredColor.rgb /= max(fCoc, 0.1);\n    // nearfieldColor.rgb /= max(fCoc, 0.1);\n    // FIXME\n    gl_FragColor = encodeHDR(\n        mix(\n            nearfieldColor, vec4(mix(originalColor.rgb, blurredColor.rgb, weight), 1.0),\n            // near field blur is too unobvious if use linear blending\n            pow(1.0 - fNearCoc, 4.0)\n        )\n    );\n#else\n    gl_FragColor = encodeHDR(vec4(mix(originalColor.rgb, blurredColor.rgb, weight), 1.0));\n#endif\n\n#if DEBUG == 1\n    // Show coc\n    gl_FragColor = vec4(vec3(fCoc), 1.0);\n#elif DEBUG == 2\n    // Show near coc\n    gl_FragColor = vec4(vec3(fNearCoc), 1.0);\n#elif DEBUG == 3\n    gl_FragColor = encodeHDR(blurredColor);\n#elif DEBUG == 4\n    // gl_FragColor = vec4(vec3(nearfieldTexel.a), 1.0);\n    gl_FragColor = encodeHDR(nearfieldColor);\n#endif\n}\n\n@end";
});