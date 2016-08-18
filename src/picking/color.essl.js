define(function () {
return "@export buildin.picking.color.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_COUNT] : SKIN_MATRIX;\n#endif\n\nvoid main(){\n\n    vec3 skinnedPosition = position;\n\n    #ifdef SKINNING\n\n        @import buildin.chunk.skin_matrix\n\n        skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n    #endif\n\n    gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0);\n}\n\n@end\n\n@end\n@export buildin.picking.color.fragment\n\nuniform vec4 color : [1.0, 1.0, 1.0, 1.0];\n\nvoid main(){\n    gl_FragColor = color;\n}\n\n@end";
});