define(function () {
return "@export qtek.deferred.chunk.light_head\n\nuniform sampler2D gBufferTexture1;\nuniform sampler2D gBufferTexture2;\nuniform sampler2D gBufferTexture3;\n\nuniform vec2 viewportSize;\n\nuniform mat4 viewProjectionInv;\n\nconst vec3 LUM = vec3(0.2125, 0.7154, 0.0721);\n\n\n#ifdef DEPTH_ENCODED\n@import qtek.util.decode_float\n#endif\n\n@end\n\n@export qtek.deferred.chunk.gbuffer_read\n    // Extract\n    // - N, z, position\n    // - albedo, metalness, specularColor, diffuseColor\n\n    vec2 uv = gl_FragCoord.xy / viewportSize;\n\n    vec4 texel1 = texture2D(gBufferTexture1, uv);\n    // Is empty\n    if (dot(texel1.rgb, vec3(1.0)) == 0.0) {\n        discard;\n    }\n    float glossiness = texel1.b;\n    float metalness = texel1.a * 2.0 - 1.0;\n\n\n    vec3 N;\n    N.xy = texel1.rg * 2.0 - 1.0;\n    N.z = sign(metalness) * sqrt(clamp(1.0 - dot(N.xy, N.xy), 0.0, 1.0));\n    N = normalize(N);\n\n    metalness = abs(metalness);\n\n#ifdef DEPTH_ENCODED\n    vec4 depthTexel = texture2D(gBufferTexture2, uv);\n\n    // FXIME premultiplied alpha when blend is enabled?\n    // FIXME Mobile and PC are different(mobile don't need it)\n    #ifdef PREMULTIPLIED_ALPHA\n    depthTexel.rgb /= depthTexel.a;\n    #endif\n    float z = decodeFloat(depthTexel) * 2.0 - 1.0;\n#else\n    // Depth buffer range is 0.0 - 1.0\n    float z = texture2D(gBufferTexture2, uv).r * 2.0 - 1.0;\n#endif\n\n    vec2 xy = uv * 2.0 - 1.0;\n\n    vec4 projectedPos = vec4(xy, z, 1.0);\n    vec4 p4 = viewProjectionInv * projectedPos;\n\n    vec3 position = p4.xyz / p4.w;\n\n    vec3 albedo = texture2D(gBufferTexture3, uv).rgb;\n\n    vec3 diffuseColor = albedo * (1.0 - metalness);\n    vec3 specularColor = mix(vec3(0.04), albedo, metalness);\n@end\n\n@export qtek.deferred.chunk.light_equation\n\nfloat D_Phong(in float g, in float ndh) {\n    // from black ops 2\n    float a = pow(8192.0, g);\n    return (a + 2.0) / 8.0 * pow(ndh, a);\n}\n\nfloat D_GGX(in float g, in float ndh) {\n    float r = 1.0 - g;\n    float a = r * r;\n    float tmp = ndh * ndh * (a - 1.0) + 1.0;\n    return a / (3.1415926 * tmp * tmp);\n}\n\n// Fresnel\nvec3 F_Schlick(in float ndv, vec3 spec) {\n    return spec + (1.0 - spec) * pow(1.0 - ndv, 5.0);\n}\n\nvec3 lightEquation(\n    in vec3 lightColor, in vec3 diffuseColor, in vec3 specularColor,\n    in float ndl, in float ndh, in float ndv, in float g\n)\n{\n    return ndl * lightColor\n        * (diffuseColor + D_Phong(g, ndh) * F_Schlick(ndv, specularColor));\n}\n\n@end";
});