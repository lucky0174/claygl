export default "@export clay.prez.vertex\n#define SHADER_NAME prez\nuniform mat4 WVP : WORLDVIEWPROJECTION;\nattribute vec3 pos : POSITION;\nattribute vec2 uv : TEXCOORD_0;\nuniform vec2 uvRepeat : [1.0, 1.0];\nuniform vec2 uvOffset : [0.0, 0.0];\n@import clay.chunk.skinning_header\n@import clay.chunk.instancing_header\n@import clay.util.logdepth_vertex_header\nvarying vec2 v_Texcoord;\nvoid main()\n{\n vec4 P = vec4(pos, 1.0);\n#ifdef SKINNING\n @import clay.chunk.skin_matrix\n P = skinMatrixWS * P;\n#endif\n#ifdef INSTANCING\n @import clay.chunk.instancing_matrix\n P = instanceMat * P;\n#endif\n gl_Position = WVP * P;\n v_Texcoord = uv * uvRepeat + uvOffset;\n @import clay.util.logdepth_vertex_main\n}\n@end\n@export clay.prez.fragment\nuniform sampler2D alphaMap;\nuniform float alphaCutoff: 0.0;\n@import clay.util.logdepth_fragment_header\nvarying vec2 v_Texcoord;\nvoid main()\n{\n if (alphaCutoff > 0.0) {\n if (texture2D(alphaMap, v_Texcoord).a <= alphaCutoff) {\n discard;\n }\n }\n gl_FragColor = vec4(0.0,0.0,0.0,1.0);\n @import clay.util.logdepth_fragment_main\n}\n@end";
