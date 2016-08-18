define(function () {
return "\n// http://blog.selfshadow.com/publications/s2013-shading-course/\n\n@export buildin.standard.vertex\n\n@import buildin.phong.vertex\n\n@end\n\n\n@export buildin.standard.fragment\n\n#define PI 3.14159265358979\n\nuniform mat4 viewInverse : VIEWINVERSE;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n#endif\n\nuniform sampler2D diffuseMap;\nuniform sampler2D normalMap;\nuniform sampler2D specularMap;\nuniform samplerCube environmentMap;\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\nuniform float glossiness : 0.5;\n\nuniform vec3 specularColor : [0.1, 0.1, 0.1];\nuniform vec3 emission : [0.0, 0.0, 0.0];\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_COUNT\n@import buildin.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_COUNT\n@import buildin.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_COUNT\n@import buildin.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_COUNT\n@import buildin.header.spot_light\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n\n// Import util functions and uniforms needed\n@import buildin.util.calculate_attenuation\n\n@import buildin.util.edge_factor\n\n@import buildin.plugin.compute_shadow_map\n\n\nfloat G_Smith(float glossiness, float ndv, float ndl)\n{\n    // float k = (roughness+1.0) * (roughness+1.0) * 0.125;\n    float roughness = 1.0 - glossiness;\n    float k = roughness * roughness / 2.0;\n    float G1V = ndv / (ndv * (1.0 - k) + k);\n    float G1L = ndl / (ndl * (1.0 - k) + k);\n    return G1L * G1V;\n}\n// Fresnel\nvec3 F_Schlick(float ndv, vec3 spec) {\n    return spec + (1.0 - spec) * pow(1.0 - ndv, 5.0);\n}\n\nfloat D_Phong(float g, float ndh) {\n    // from black ops 2\n    float a = pow(8192.0, g);\n    return (a + 2.0) / 8.0 * pow(ndh, a);\n}\n\nfloat D_GGX(float g, float ndh) {\n    float r = 1.0 - g;\n    float a = r * r;\n    float tmp = ndh * ndh * (a - 1.0) + 1.0;\n    return a / (PI * tmp * tmp);\n}\n\nvoid main()\n{\n#ifdef RENDER_TEXCOORD\n    gl_FragColor = vec4(v_Texcoord, 1.0, 1.0);\n    return;\n#endif\n\n    vec4 finalColor = vec4(color, alpha);\n\n    vec3 eyePos = viewInverse[3].xyz;\n    vec3 V = normalize(eyePos - v_WorldPosition);\n    float g = glossiness;\n\n#ifdef DIFFUSEMAP_ENABLED\n    vec4 tex = texture2D(diffuseMap, v_Texcoord);\n#ifdef SRGB_DECODE\n    tex.rgb = pow(tex.rgb, vec3(2.2));\n#endif\n    finalColor.rgb *= tex.rgb;\n#ifdef DIFFUSEMAP_ALPHA_ALPHA\n    finalColor.a *= tex.a;\n#endif\n#ifdef DIFFUSEMAP_ALPHA_GLOSS\n    g *= tex.a;\n#endif\n#endif\n\n    vec3 spec = specularColor;\n#ifdef SPECULARMAP_ENABLED\n    spec *= texture2D(specularMap, v_Texcoord).rgb;\n#endif\n\n    vec3 N = v_Normal;\n#ifdef NORMALMAP_ENABLED\n    N = texture2D(normalMap, v_Texcoord).xyz * 2.0 - 1.0;\n    mat3 tbn = mat3(v_Tangent, v_Bitangent, v_Normal);\n    N = normalize(tbn * N);\n#endif\n\n#ifdef RENDER_NORMAL\n    gl_FragColor = vec4(N, 1.0);\n    return;\n#endif\n\n#ifdef RENDER_GLOSSINESS\n    gl_FragColor = vec4(vec3(g), 1.0);\n    return;\n#endif\n\n    // Diffuse part of all lights\n    vec3 diffuseTerm = vec3(0.0, 0.0, 0.0);\n    // Specular part of all lights\n    vec3 specularTerm = vec3(0.0, 0.0, 0.0);\n\n    vec3 fresnelTerm = F_Schlick(clamp(dot(N, V), 0.0, 1.0), spec);\n\n#ifdef AMBIENT_LIGHT_COUNT\n    for(int i = 0; i < AMBIENT_LIGHT_COUNT; i++)\n    {\n        // Hemisphere ambient lighting from cryengine\n        diffuseTerm += ambientLightColor[i] * (clamp(N.y * 0.7, 0.0, 1.0) + 0.3);\n        // diffuseTerm += ambientLightColor[i];\n    }\n#endif\n#ifdef POINT_LIGHT_COUNT\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsPoint[POINT_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfPointLights(v_WorldPosition, shadowContribsPoint);\n    }\n#endif\n    for(int i = 0; i < POINT_LIGHT_COUNT; i++)\n    {\n\n        vec3 lightPosition = pointLightPosition[i];\n        vec3 lc = pointLightColor[i];\n        float range = pointLightRange[i];\n\n        vec3 L = lightPosition - v_WorldPosition;\n\n        // Calculate point light attenuation\n        float dist = length(L);\n        float attenuation = lightAttenuation(dist, range);\n        L /= dist;\n        vec3 H = normalize(L + V);\n        float ndl = clamp(dot(N, L), 0.0, 1.0);\n        float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n        if(shadowEnabled)\n        {\n            shadowContrib = shadowContribsPoint[i];\n        }\n#endif\n\n        vec3 li = lc * ndl * attenuation * shadowContrib;\n        diffuseTerm += li;\n        specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n    }\n#endif\n\n#ifdef DIRECTIONAL_LIGHT_COUNT\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsDir[DIRECTIONAL_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfDirectionalLights(v_WorldPosition, shadowContribsDir);\n    }\n#endif\n    for(int i = 0; i < DIRECTIONAL_LIGHT_COUNT; i++)\n    {\n\n        vec3 L = -normalize(directionalLightDirection[i]);\n        vec3 lc = directionalLightColor[i];\n\n        vec3 H = normalize(L + V);\n        float ndl = clamp(dot(N, L), 0.0, 1.0);\n        float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n        if(shadowEnabled)\n        {\n            shadowContrib = shadowContribsDir[i];\n        }\n#endif\n\n        vec3 li = lc * ndl * shadowContrib;\n\n        diffuseTerm += li;\n        specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n    }\n#endif\n\n#ifdef SPOT_LIGHT_COUNT\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsSpot[SPOT_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfSpotLights(v_WorldPosition, shadowContribsSpot);\n    }\n#endif\n    for(int i = 0; i < SPOT_LIGHT_COUNT; i++)\n    {\n        vec3 lightPosition = spotLightPosition[i];\n        vec3 spotLightDirection = -normalize(spotLightDirection[i]);\n        vec3 lc = spotLightColor[i];\n        float range = spotLightRange[i];\n        float a = spotLightUmbraAngleCosine[i];\n        float b = spotLightPenumbraAngleCosine[i];\n        float falloffFactor = spotLightFalloffFactor[i];\n\n        vec3 L = lightPosition - v_WorldPosition;\n        // Calculate attenuation\n        float dist = length(L);\n        float attenuation = lightAttenuation(dist, range);\n\n        // Normalize light direction\n        L /= dist;\n        // Calculate spot light fall off\n        float c = dot(spotLightDirection, L);\n\n        float falloff;\n        // Fomular from real-time-rendering\n        falloff = clamp((c - a) /( b - a), 0.0, 1.0);\n        falloff = pow(falloff, falloffFactor);\n\n        vec3 H = normalize(L + V);\n        float ndl = clamp(dot(N, L), 0.0, 1.0);\n        float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n        if (shadowEnabled)\n        {\n            shadowContrib = shadowContribsSpot[i];\n        }\n#endif\n\n        vec3 li = lc * attenuation * (1.0-falloff) * shadowContrib * ndl;\n\n        diffuseTerm += li;\n        specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n    }\n#endif\n\n    finalColor.rgb *= diffuseTerm;\n    finalColor.rgb += specularTerm;\n    finalColor.rgb += emission;\n\n#ifdef ENVIRONMENTMAP_ENABLED\n    vec3 envTex = textureCube(environmentMap, reflect(-V, N)).xyz;;\n    finalColor.rgb = finalColor.rgb + envTex * g * fresnelTerm;\n#endif\n\n    if(lineWidth > 0.)\n    {\n        finalColor.rgb = finalColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n\n#ifdef GAMMA_ENCODE\n    finalColor.rgb = pow(finalColor.rgb, vec3(1 / 2.2));\n#endif\n    gl_FragColor = finalColor;\n}\n\n@end\n\n\n@export buildin.physical.vertex\n\n@import buildin.standard.vertex\n\n@end\n\n@export buildin.physical.fragment\n\n@import buildin.standard.fragment\n\n@end";
});