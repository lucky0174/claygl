export default "@export qtek.basic.vertex\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform vec2 uvRepeat : [1.0, 1.0];\nuniform vec2 uvOffset : [0.0, 0.0];\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 position : POSITION;\nattribute vec3 barycentric;\n@import qtek.chunk.skinning_header\nvarying vec2 v_Texcoord;\nvarying vec3 v_Barycentric;\nvoid main()\n{\n    vec3 skinnedPosition = position;\n#ifdef SKINNING\n    @import qtek.chunk.skin_matrix\n    skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n#endif\n    v_Texcoord = texcoord * uvRepeat + uvOffset;\n    v_Barycentric = barycentric;\n    gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0);\n}\n@end\n@export qtek.basic.fragment\nvarying vec2 v_Texcoord;\nuniform sampler2D diffuseMap;\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform vec3 emission : [0.0, 0.0, 0.0];\nuniform float alpha : 1.0;\n#ifdef ALPHA_TEST\nuniform float alphaCutoff: 0.9;\n#endif\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n@import qtek.util.edge_factor\n@import qtek.util.rgbm\n@import qtek.util.srgb\nvoid main()\n{\n#ifdef RENDER_TEXCOORD\n    gl_FragColor = vec4(v_Texcoord, 1.0, 1.0);\n    return;\n#endif\n    gl_FragColor = vec4(color, alpha);\n#ifdef DIFFUSEMAP_ENABLED\n    vec4 tex = decodeHDR(texture2D(diffuseMap, v_Texcoord));\n#ifdef SRGB_DECODE\n    tex = sRGBToLinear(tex);\n#endif\n#if defined(DIFFUSEMAP_ALPHA_ALPHA)\n    gl_FragColor.a = tex.a;\n#endif\n    gl_FragColor.rgb *= tex.rgb;\n#endif\n    gl_FragColor.rgb += emission;\n    if( lineWidth > 0.01)\n    {\n        gl_FragColor.rgb = gl_FragColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n#ifdef GAMMA_ENCODE\n    gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1 / 2.2));\n#endif\n#ifdef ALPHA_TEST\n    if (gl_FragColor.a < alphaCutoff) {\n        discard;\n    }\n#endif\n    gl_FragColor = encodeHDR(gl_FragColor);\n}\n@end";
