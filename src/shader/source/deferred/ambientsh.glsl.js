export default "@export clay.deferred.ambient_sh_light\nuniform sampler2D gBufferTexture1;\nuniform sampler2D gBufferTexture3;\nuniform vec3 lightColor;\nuniform vec3 lightCoefficients[9];\nuniform vec2 windowSize: WINDOW_SIZE;\nvec3 calcAmbientSHLight(vec3 N) {\n    return lightCoefficients[0]\n        + lightCoefficients[1] * N.x\n        + lightCoefficients[2] * N.y\n        + lightCoefficients[3] * N.z\n        + lightCoefficients[4] * N.x * N.z\n        + lightCoefficients[5] * N.z * N.y\n        + lightCoefficients[6] * N.y * N.x\n        + lightCoefficients[7] * (3.0 * N.z * N.z - 1.0)\n        + lightCoefficients[8] * (N.x * N.x - N.y * N.y);\n}\nvoid main()\n{\n    vec2 uv = gl_FragCoord.xy / windowSize;\n    vec4 texel1 = texture2D(gBufferTexture1, uv);\n    if (dot(texel1.rgb, vec3(1.0)) == 0.0) {\n        discard;\n    }\n    vec3 N = texel1.rgb * 2.0 - 1.0;\n    vec3 albedo = texture2D(gBufferTexture3, uv).rgb;\n    gl_FragColor.rgb = lightColor * albedo * calcAmbientSHLight(N);\n    gl_FragColor.a = 1.0;\n}\n@end";
