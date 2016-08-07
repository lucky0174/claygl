define(function () {
return "@export buildin.deferred.sphere_light\n\n@import buildin.deferred.chunk.light_head\n\n@import buildin.util.calculate_attenuation\n\n@import buildin.deferred.chunk.light_equation\n\nuniform vec3 lightPosition;\nuniform vec3 lightColor;\nuniform float lightRange;\nuniform float lightRadius;\n\nuniform vec3 eyePosition;\n\nvarying vec3 v_Position;\n\nvoid main()\n{\n    @import buildin.deferred.chunk.gbuffer_read\n\n\n    vec3 L = lightPosition - position;\n\n    vec3 V = normalize(eyePosition - position);\n\n    float dist = length(L);\n    // Light pos fix\n    vec3 R = reflect(V, N);\n    float tmp = dot(L, R);\n    vec3 cToR = tmp * R - L;\n    float d = length(cToR);\n    L = L + cToR * clamp(lightRadius / d, 0.0, 1.0);\n\n    L = normalize(L);\n\n    vec3 H = normalize(L + V);\n\n    float ndl = clamp(dot(N, L), 0.0, 1.0);\n    float ndh = clamp(dot(N, H), 0.0, 1.0);\n    float attenuation = lightAttenuation(dist, lightRange);\n    // Diffuse term\n    gl_FragColor.rgb = lightColor * ndl * attenuation;\n    if (dot(gl_FragColor.rgb, vec3(1.0)) == 0.0) // Reduce blending\n    {\n        discard;\n    }\n\n    // Specular fix\n    glossiness = clamp(glossiness - lightRadius / 2.0 / dist, 0.0, 1.0);\n\n    // Specular luminance\n    gl_FragColor.a = dot(LUM, gl_FragColor.rgb * D_Phong(glossiness, ndh));\n    // gl_FragColor.a = 1.0;\n}\n@end";
});