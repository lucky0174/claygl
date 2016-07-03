define(function () {
return "@export buildin.deferred.chunk.light_head\nuniform sampler2D normalTex;\nuniform vec2 viewportSize;\n\nuniform mat4 viewProjectionInv;\n\nconst vec3 LUM = vec3(0.2125, 0.7154, 0.0721);\n@end\n\n@export buildin.deferred.chunk.gbuffer_read\n    vec2 uv = gl_FragCoord.xy / viewportSize;\n\n    vec4 tex = texture2D(normalTex, uv);\n    // Is empty\n    if (dot(tex.rgb, vec3(1.0)) == 0.0) {\n        discard;\n    }\n\n    vec3 N;\n    N.xy = tex.rg * 2.0 - 1.0;\n    N.z = sqrt(1.0 - dot(N.xy, N.xy));\n\n    // Depth value in depth texture is 0 - 1\n    // float z = texture2D(depthTex, uv).r * 2.0 - 1.0;\n    float z = tex.b;\n\n    float glossiness = tex.a;\n\n    vec2 xy = uv * 2.0 - 1.0;\n\n    vec4 projectedPos = vec4(xy, z, 1.0);\n    vec4 p4 = viewProjectionInv * projectedPos;\n\n    vec3 position = p4.xyz / p4.w;\n@end\n\n@export buildin.deferred.chunk.light_equation\n\nfloat D_Phong(float g, float ndh) {\n    // from black ops 2\n    float a = pow(8192.0, g);\n    return (a + 2.0) / 8.0 * pow(ndh, a);\n}\n\n@end";
});