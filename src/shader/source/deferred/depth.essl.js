define(function () {
return "@export qtek.deferred.depth.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_COUNT] : SKIN_MATRIX;\n#endif\n\nvarying vec4 v_ProjPos;\n\nvoid main(){\n\n    vec3 skinnedPosition = position;\n\n#ifdef SKINNING\n\n    @import qtek.chunk.skin_matrix\n\n    skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n#endif\n\n    v_ProjPos = worldViewProjection * vec4(skinnedPosition, 1.0);\n    gl_Position = v_ProjPos;\n\n}\n@end\n\n\n@export qtek.deferred.depth.fragment\n\nvarying vec4 v_ProjPos;\n@import qtek.util.encode_float\n\nvoid main()\n{\n    float depth = v_ProjPos.z / v_ProjPos.w;\n\n    gl_FragColor = encodeFloat(depth * 0.5 + 0.5);\n}\n\n@end";
});