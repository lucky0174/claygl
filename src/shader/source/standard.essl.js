define(function () {
return "\n// http://blog.selfshadow.com/publications/s2013-shading-course/\n\n@export qtek.standard.vertex\n\n@import qtek.phong.vertex\n\n@end\n\n\n@export qtek.standard.fragment\n\n#define PI 3.14159265358979\n\n#define GLOSS_CHANEL 0\n#define ROUGHNESS_CHANEL 0\n#define METALNESS_CHANEL 1\n\nuniform mat4 viewInverse : VIEWINVERSE;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\nuniform sampler2D normalMap;\n#endif\n\n#ifdef DIFFUSEMAP_ENABLED\nuniform sampler2D diffuseMap;\n#endif\n\n#ifdef SPECULARMAP_ENABLED\nuniform sampler2D specularMap;\n#endif\n\n#ifdef GLOSSMAP_ENABLED\nuniform sampler2D glossinessMap;\n#elif defined(ROUGHNESSMAP_ENABLED)\nuniform sampler2D roughnessMap;\n#endif\n\n#ifdef METALNESSMAP_ENABLED\nuniform sampler2D metalnessMap;\n#endif\n\n#ifdef ENVIRONMENTMAP_ENABLED\nuniform samplerCube environmentMap;\n#endif\n\n#ifdef BRDFLOOKUP_ENABLED\nuniform sampler2D brdfLookup;\n#endif\n\n#ifdef EMISSIVEMAP_ENABLED\nuniform sampler2D emissiveMap;\n#endif\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\nuniform float glossiness : 0.5;\n\n#ifdef USE_METALNESS\n// metalness workflow\nuniform float metalness : 0.0;\n#else\n// specular workflow\nuniform vec3 specularColor : [0.1, 0.1, 0.1];\n#endif\n\nuniform vec3 emission : [0.0, 0.0, 0.0];\n\nuniform float emissionIntensity: 1;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n// For selection\nuniform vec3 mixColor: [1.0, 1.0, 0.0];\nuniform float mixIntensity: 0.0;\n\n// Max mipmap level of environment map\n#ifdef ENVIRONMENTMAP_PREFILTER\nuniform float maxMipmapLevel: 5;\n#endif\n\n#ifdef AMBIENT_LIGHT_COUNT\n@import qtek.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_COUNT\n@import qtek.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_COUNT\n@import qtek.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_COUNT\n@import qtek.header.spot_light\n#endif\n\n// Import util functions and uniforms needed\n@import qtek.util.calculate_attenuation\n\n@import qtek.util.edge_factor\n\n@import qtek.util.rgbm\n\n@import qtek.plugin.compute_shadow_map\n\n\nfloat G_Smith(float glossiness, float ndv, float ndl)\n{\n    // float k = (roughness+1.0) * (roughness+1.0) * 0.125;\n    float roughness = 1.0 - glossiness;\n    float k = roughness * roughness / 2.0;\n    float G1V = ndv / (ndv * (1.0 - k) + k);\n    float G1L = ndl / (ndl * (1.0 - k) + k);\n    return G1L * G1V;\n}\n// Fresnel\nvec3 F_Schlick(float ndv, vec3 spec) {\n    return spec + (1.0 - spec) * pow(1.0 - ndv, 5.0);\n}\n\nfloat D_Phong(float g, float ndh) {\n    // from black ops 2\n    float a = pow(8192.0, g);\n    return (a + 2.0) / 8.0 * pow(ndh, a);\n}\n\nfloat D_GGX(float g, float ndh) {\n    float r = 1.0 - g;\n    float a = r * r;\n    float tmp = ndh * ndh * (a - 1.0) + 1.0;\n    return a / (PI * tmp * tmp);\n}\n\nvoid main()\n{\n    vec4 outColor = vec4(color, alpha);\n    vec3 eyePos = viewInverse[3].xyz;\n    vec3 V = normalize(eyePos - v_WorldPosition);\n\n#ifdef DIFFUSEMAP_ENABLED\n    vec4 tex = texture2D(diffuseMap, v_Texcoord);\n    #ifdef SRGB_DECODE\n    tex.rgb = pow(tex.rgb, vec3(2.2));\n    #endif\n    outColor.rgb *= tex.rgb;\n    #ifdef DIFFUSEMAP_ALPHA_ALPHA\n    outColor.a *= tex.a;\n    #endif\n#endif\n\n\n#ifdef USE_METALNESS\n    float m = metalness;\n\n    #ifdef METALNESSMAP_ENABLED\n    m = texture2D(metalnessMap, v_Texcoord)[METALNESS_CHANEL];\n    #endif\n\n    vec3 baseColor = outColor.rgb;\n    outColor.rgb = baseColor * (1.0 - m);\n    vec3 spec = mix(vec3(0.04), baseColor, m);\n#else\n    vec3 spec = specularColor;\n#endif\n\n    float g = glossiness;\n\n#ifdef GLOSSMAP_ENABLED\n    // PENDING Replace or multiply\n    g = texture2D(glossinessMap, v_Texcoord)[GLOSS_CHANEL];\n#elif defined(ROUGHNESSMAP_ENABLED)\n    g = 1.0 - texture2D(roughnessMap, v_Texcoord)[ROUGHNESS_CHANEL];\n#endif\n\n#ifdef SPECULARMAP_ENABLED\n    spec *= texture2D(specularMap, v_Texcoord).rgb;\n#endif\n\n    vec3 N = v_Normal;\n#ifdef NORMALMAP_ENABLED\n    N = texture2D(normalMap, v_Texcoord).xyz * 2.0 - 1.0;\n    mat3 tbn = mat3(v_Tangent, v_Bitangent, v_Normal);\n    N = normalize(tbn * N);\n#endif\n\n    // Diffuse part of all lights\n    vec3 diffuseTerm = vec3(0.0, 0.0, 0.0);\n    // Specular part of all lights\n    vec3 specularTerm = vec3(0.0, 0.0, 0.0);\n\n    float ndv = clamp(dot(N, V), 0.0, 1.0);\n    vec3 fresnelTerm = F_Schlick(ndv, spec);\n\n#ifdef AMBIENT_LIGHT_COUNT\n    for(int i = 0; i < AMBIENT_LIGHT_COUNT; i++)\n    {\n        diffuseTerm += ambientLightColor[i];\n    }\n#endif\n\n#ifdef AMBIENT_SH_LIGHT_COUNT\n    for(int i = 0; i < AMBIENT_LIGHT_COUNT; i++)\n    {\n        diffuseTerm += calcAmbientSHLight(i) * ambientSHLightColor[i];\n    }\n#endif\n\n#ifdef POINT_LIGHT_COUNT\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsPoint[POINT_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfPointLights(v_WorldPosition, shadowContribsPoint);\n    }\n#endif\n    for(int i = 0; i < POINT_LIGHT_COUNT; i++)\n    {\n\n        vec3 lightPosition = pointLightPosition[i];\n        vec3 lc = pointLightColor[i];\n        float range = pointLightRange[i];\n\n        vec3 L = lightPosition - v_WorldPosition;\n\n        // Calculate point light attenuation\n        float dist = length(L);\n        float attenuation = lightAttenuation(dist, range);\n        L /= dist;\n        vec3 H = normalize(L + V);\n        float ndl = clamp(dot(N, L), 0.0, 1.0);\n        float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n        if(shadowEnabled)\n        {\n            shadowContrib = shadowContribsPoint[i];\n        }\n#endif\n\n        vec3 li = lc * ndl * attenuation * shadowContrib;\n        diffuseTerm += li;\n        specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n    }\n#endif\n\n#ifdef DIRECTIONAL_LIGHT_COUNT\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsDir[DIRECTIONAL_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfDirectionalLights(v_WorldPosition, shadowContribsDir);\n    }\n#endif\n    for(int i = 0; i < DIRECTIONAL_LIGHT_COUNT; i++)\n    {\n\n        vec3 L = -normalize(directionalLightDirection[i]);\n        vec3 lc = directionalLightColor[i];\n\n        vec3 H = normalize(L + V);\n        float ndl = clamp(dot(N, L), 0.0, 1.0);\n        float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n        if(shadowEnabled)\n        {\n            shadowContrib = shadowContribsDir[i];\n        }\n#endif\n\n        vec3 li = lc * ndl * shadowContrib;\n\n        diffuseTerm += li;\n        specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n    }\n#endif\n\n#ifdef SPOT_LIGHT_COUNT\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsSpot[SPOT_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfSpotLights(v_WorldPosition, shadowContribsSpot);\n    }\n#endif\n    for(int i = 0; i < SPOT_LIGHT_COUNT; i++)\n    {\n        vec3 lightPosition = spotLightPosition[i];\n        vec3 spotLightDirection = -normalize(spotLightDirection[i]);\n        vec3 lc = spotLightColor[i];\n        float range = spotLightRange[i];\n        float a = spotLightUmbraAngleCosine[i];\n        float b = spotLightPenumbraAngleCosine[i];\n        float falloffFactor = spotLightFalloffFactor[i];\n\n        vec3 L = lightPosition - v_WorldPosition;\n        // Calculate attenuation\n        float dist = length(L);\n        float attenuation = lightAttenuation(dist, range);\n\n        // Normalize light direction\n        L /= dist;\n        // Calculate spot light fall off\n        float c = dot(spotLightDirection, L);\n\n        float falloff;\n        // Fomular from real-time-rendering\n        falloff = clamp((c - a) /( b - a), 0.0, 1.0);\n        falloff = pow(falloff, falloffFactor);\n\n        vec3 H = normalize(L + V);\n        float ndl = clamp(dot(N, L), 0.0, 1.0);\n        float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n        if (shadowEnabled)\n        {\n            shadowContrib = shadowContribsSpot[i];\n        }\n#endif\n\n        vec3 li = lc * attenuation * (1.0 - falloff) * shadowContrib * ndl;\n\n        diffuseTerm += li;\n        specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n    }\n#endif\n\n    outColor.rgb *= diffuseTerm;\n    outColor.rgb += specularTerm;\n\n    vec3 lEmission = emission;\n#ifdef EMISSIVEMAP_ENABLED\n    lEmission *= texture2D(emissiveMap, v_Texcoord);\n#endif\n    outColor.rgb += lEmission * emissionIntensity;\n\n#ifdef ENVIRONMENTMAP_ENABLED\n\n    vec3 envWeight = g * fresnelTerm;\n\n    #ifdef ENVIRONMENTMAP_PREFILTER\n    // FIXME simply 1 minus roughness ?\n    float roughness = clamp(1.0 - glossiness, 0.0, 1.0);\n    float bias = roughness * maxMipmapLevel;\n    vec3 L = reflect(-V, N);\n    vec3 envTexel = textureCubeLodEXT(environmentMap, L, bias).rgb;\n\n        #ifdef BRDFLOOKUP_ENABLED\n    vec2 brdfParam = texture2D(brdfLookup, vec2(roughness, ndv)).xy;\n    envWeight = spec * brdfParam.x + brdfParam.y;\n        #endif\n\n    #else\n    vec3 envTexel = textureCube(environmentMap, reflect(-V, N)).xyz;\n    #endif\n\n    outColor.rgb = outColor.rgb + envTexel * envWeight;\n#endif\n\n#ifdef GAMMA_ENCODE\n    // Not linear\n    outColor.rgb = pow(outColor.rgb, vec3(1 / 2.2));\n#endif\n\n    outColor.rgb = mix(outColor.rgb, mixColor, mixIntensity);\n\n    if(lineWidth > 0.)\n    {\n        outColor.rgb = mix(lineColor, vec3(outColor.rgb), edgeFactor(lineWidth));\n    }\n\n    gl_FragColor = encodeHDR(outColor);\n}\n\n@end\n\n\n@export qtek.physical.vertex\n\n@import qtek.standard.vertex\n\n@end\n\n@export qtek.physical.fragment\n\n@import qtek.standard.fragment\n\n@end";
});