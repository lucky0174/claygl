export default "@export clay.basic.vertex\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform vec2 uvRepeat : [1.0, 1.0];\nuniform vec2 uvOffset : [0.0, 0.0];\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 position : POSITION;\nattribute vec3 barycentric;\n@import clay.chunk.skinning_header\nvarying vec2 v_Texcoord;\nvarying vec3 v_Barycentric;\n#ifdef VERTEX_COLOR\nattribute vec4 a_Color : COLOR;\nvarying vec4 v_Color;\n#endif\nvoid main()\n{\n    vec3 skinnedPosition = position;\n#ifdef SKINNING\n    @import clay.chunk.skin_matrix\n    skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n#endif\n    v_Texcoord = texcoord * uvRepeat + uvOffset;\n    v_Barycentric = barycentric;\n    gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0);\n#ifdef VERTEX_COLOR\n    v_Color = a_Color;\n#endif\n}\n@end\n@export clay.basic.fragment\nvarying vec2 v_Texcoord;\nuniform sampler2D diffuseMap;\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform vec3 emission : [0.0, 0.0, 0.0];\nuniform float alpha : 1.0;\n#ifdef ALPHA_TEST\nuniform float alphaCutoff: 0.9;\n#endif\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\nuniform float lineWidth : 0.0;\nuniform vec4 lineColor : [0.0, 0.0, 0.0, 0.6];\nvarying vec3 v_Barycentric;\n@import clay.util.edge_factor\n@import clay.util.rgbm\n@import clay.util.srgb\n@import clay.util.ACES\nvoid main()\n{\n#ifdef RENDER_TEXCOORD\n    gl_FragColor = vec4(v_Texcoord, 1.0, 1.0);\n    return;\n#endif\n    gl_FragColor = vec4(color, alpha);\n#ifdef VERTEX_COLOR\n    gl_FragColor *= v_Color;\n#endif\n#ifdef DIFFUSEMAP_ENABLED\n    vec4 tex = decodeHDR(texture2D(diffuseMap, v_Texcoord));\n#ifdef SRGB_DECODE\n    tex = sRGBToLinear(tex);\n#endif\n#if defined(DIFFUSEMAP_ALPHA_ALPHA)\n    gl_FragColor.a = tex.a;\n#endif\n    gl_FragColor.rgb *= tex.rgb;\n#endif\n    gl_FragColor.rgb += emission;\n    if( lineWidth > 0.)\n    {\n        gl_FragColor.rgb = mix(gl_FragColor.rgb, lineColor.rgb, (1.0 - edgeFactor(lineWidth)) * lineColor.a);\n    }\n#ifdef ALPHA_TEST\n    if (gl_FragColor.a < alphaCutoff) {\n        discard;\n    }\n#endif\n#ifdef TONEMAPPING\n    gl_FragColor.rgb = ACESToneMapping(gl_FragColor.rgb);\n#endif\n#ifdef SRGB_ENCODE\n    gl_FragColor = linearTosRGB(gl_FragColor);\n#endif\n    gl_FragColor = encodeHDR(gl_FragColor);\n}\n@end";
