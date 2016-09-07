define(function () {
return "\n// http://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_shading_model\n\n@export qtek.phong.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\nuniform vec2 uvOffset : [0.0, 0.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\nattribute vec4 tangent : TANGENT;\n\n#ifdef VERTEX_COLOR\nattribute vec4 color : COLOR;\n#endif\n\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_COUNT] : SKIN_MATRIX;\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Barycentric;\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n#endif\n\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\n\nvoid main()\n{\n\n    vec3 skinnedPosition = position;\n    vec3 skinnedNormal = normal;\n    vec3 skinnedTangent = tangent.xyz;\n#ifdef SKINNING\n\n    @import qtek.chunk.skin_matrix\n\n    skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n    // Upper 3x3 of skinMatrix is orthogonal\n    skinnedNormal = (skinMatrixWS * vec4(normal, 0.0)).xyz;\n    skinnedTangent = (skinMatrixWS * vec4(tangent.xyz, 0.0)).xyz;\n#endif\n\n    gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0);\n\n    v_Texcoord = texcoord * uvRepeat + uvOffset;\n    v_WorldPosition = (world * vec4(skinnedPosition, 1.0)).xyz;\n    v_Barycentric = barycentric;\n\n    v_Normal = normalize((worldInverseTranspose * vec4(skinnedNormal, 0.0)).xyz);\n\n#ifdef NORMALMAP_ENABLED\n    v_Tangent = normalize((worldInverseTranspose * vec4(skinnedTangent, 0.0)).xyz);\n    v_Bitangent = normalize(cross(v_Normal, v_Tangent) * tangent.w);\n#endif\n\n#ifdef VERTEX_COLOR\n    v_Color = color;\n#endif\n}\n\n@end\n\n\n@export qtek.phong.fragment\n\nuniform mat4 viewInverse : VIEWINVERSE;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\nuniform sampler2D normalMap;\n#endif\n\n#ifdef DIFFUSEMAP_ENABLED\nuniform sampler2D diffuseMap;\n#endif\n\n#ifdef SPECULARMAP_ENABLED\nuniform sampler2D specularMap;\n#endif\n\n#ifdef ENVIRONMENTMAP_ENABLED\nuniform samplerCube environmentMap;\n#endif\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\nuniform float shininess : 30;\n\nuniform vec3 specularColor : [1.0, 1.0, 1.0];\nuniform vec3 emission : [0.0, 0.0, 0.0];\n\nuniform float reflectivity : 0.5;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_COUNT\n@import qtek.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_COUNT\n@import qtek.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_COUNT\n@import qtek.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_COUNT\n@import qtek.header.spot_light\n#endif\n\n// Import util functions and uniforms needed\n@import qtek.util.calculate_attenuation\n\n@import qtek.util.edge_factor\n\n@import qtek.plugin.compute_shadow_map\n\nvoid main()\n{\n    vec4 finalColor = vec4(color, alpha);\n\n    vec3 eyePos = viewInverse[3].xyz;\n    vec3 viewDirection = normalize(eyePos - v_WorldPosition);\n\n#ifdef DIFFUSEMAP_ENABLED\n    vec4 tex = texture2D(diffuseMap, v_Texcoord);\n#ifdef SRGB_DECODE\n    tex.rgb = pow(tex.rgb, vec3(2.2));\n#endif\n    finalColor.rgb *= tex.rgb;\n#ifdef DIFFUSEMAP_ALPHA_ALPHA\n    finalColor.a *= tex.a;\n#endif\n#endif\n\n    vec3 spec = specularColor;\n    #ifdef SPECULARMAP_ENABLED\n        spec *= texture2D(specularMap, v_Texcoord).rgb;\n    #endif\n\n    vec3 normal = v_Normal;\n#ifdef NORMALMAP_ENABLED\n    normal = texture2D(normalMap, v_Texcoord).xyz * 2.0 - 1.0;\n    mat3 tbn = mat3(v_Tangent, v_Bitangent, v_Normal);\n    normal = normalize(tbn * normal);\n#endif\n\n    // Diffuse part of all lights\n    vec3 diffuseTerm = vec3(0.0, 0.0, 0.0);\n    // Specular part of all lights\n    vec3 specularTerm = vec3(0.0, 0.0, 0.0);\n\n#ifdef AMBIENT_LIGHT_COUNT\n    for(int i = 0; i < AMBIENT_LIGHT_COUNT; i++)\n    {\n        diffuseTerm += ambientLightColor[i];\n    }\n#endif\n#ifdef POINT_LIGHT_COUNT\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsPoint[POINT_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfPointLights(v_WorldPosition, shadowContribsPoint);\n    }\n#endif\n    for(int i = 0; i < POINT_LIGHT_COUNT; i++)\n    {\n        vec3 lightPosition = pointLightPosition[i];\n        vec3 lightColor = pointLightColor[i];\n        float range = pointLightRange[i];\n\n        vec3 lightDirection = lightPosition - v_WorldPosition;\n\n        // Calculate point light attenuation\n        float dist = length(lightDirection);\n        float attenuation = lightAttenuation(dist, range);\n\n        // Normalize vectors\n        lightDirection /= dist;\n        vec3 halfVector = normalize(lightDirection + viewDirection);\n\n        float ndh = dot(normal, halfVector);\n        ndh = clamp(ndh, 0.0, 1.0);\n\n        float ndl = dot(normal,  lightDirection);\n        ndl = clamp(ndl, 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n        if(shadowEnabled)\n        {\n            shadowContrib = shadowContribsPoint[i];\n        }\n#endif\n\n        vec3 li = lightColor * ndl * attenuation * shadowContrib;\n\n        diffuseTerm += li;\n        if (shininess > 0.0)\n        {\n            specularTerm += li * pow(ndh, shininess);\n        }\n\n    }\n#endif\n\n#ifdef DIRECTIONAL_LIGHT_COUNT\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsDir[DIRECTIONAL_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfDirectionalLights(v_WorldPosition, shadowContribsDir);\n    }\n#endif\n    for(int i = 0; i < DIRECTIONAL_LIGHT_COUNT; i++)\n    {\n\n        vec3 lightDirection = -normalize(directionalLightDirection[i]);\n        vec3 lightColor = directionalLightColor[i];\n\n        vec3 halfVector = normalize(lightDirection + viewDirection);\n\n        float ndh = dot(normal, halfVector);\n        ndh = clamp(ndh, 0.0, 1.0);\n\n        float ndl = dot(normal, lightDirection);\n        ndl = clamp(ndl, 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n        if(shadowEnabled)\n        {\n            shadowContrib = shadowContribsDir[i];\n        }\n#endif\n\n        vec3 li = lightColor * ndl * shadowContrib;\n\n        diffuseTerm += li;\n        if (shininess > 0.0)\n        {\n            specularTerm += li * pow(ndh, shininess);\n        }\n    }\n#endif\n\n#ifdef SPOT_LIGHT_COUNT\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsSpot[SPOT_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfSpotLights(v_WorldPosition, shadowContribsSpot);\n    }\n#endif\n    for(int i = 0; i < SPOT_LIGHT_COUNT; i++)\n    {\n        vec3 lightPosition = spotLightPosition[i];\n        vec3 spotLightDirection = -normalize(spotLightDirection[i]);\n        vec3 lightColor = spotLightColor[i];\n        float range = spotLightRange[i];\n        float a = spotLightUmbraAngleCosine[i];\n        float b = spotLightPenumbraAngleCosine[i];\n        float falloffFactor = spotLightFalloffFactor[i];\n\n        vec3 lightDirection = lightPosition - v_WorldPosition;\n        // Calculate attenuation\n        float dist = length(lightDirection);\n        float attenuation = lightAttenuation(dist, range);\n\n        // Normalize light direction\n        lightDirection /= dist;\n        // Calculate spot light fall off\n        float c = dot(spotLightDirection, lightDirection);\n\n        float falloff;\n        // Fomular from real-time-rendering\n        falloff = clamp((c - a) /( b - a), 0.0, 1.0);\n        falloff = pow(falloff, falloffFactor);\n\n        vec3 halfVector = normalize(lightDirection + viewDirection);\n\n        float ndh = dot(normal, halfVector);\n        ndh = clamp(ndh, 0.0, 1.0);\n\n        float ndl = dot(normal, lightDirection);\n        ndl = clamp(ndl, 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n        if (shadowEnabled)\n        {\n            shadowContrib = shadowContribsSpot[i];\n        }\n#endif\n\n        vec3 li = lightColor * ndl * attenuation * (1.0-falloff) * shadowContrib;\n\n        diffuseTerm += li;\n        if (shininess > 0.0)\n        {\n            specularTerm += li * pow(ndh, shininess);\n        }\n    }\n#endif\n\n    finalColor.rgb *= diffuseTerm;\n    finalColor.rgb += specularTerm * spec;\n    finalColor.rgb += emission;\n\n#ifdef ENVIRONMENTMAP_ENABLED\n    vec3 envTexel = textureCube(environmentMap, reflect(-viewDirection, normal)).xyz;\n    finalColor.rgb = finalColor.rgb + envTexel * reflectivity;\n#endif\n\n    if(lineWidth > 0.01)\n    {\n        finalColor.rgb = finalColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n\n#ifdef GAMMA_ENCODE\n    finalColor.rgb = pow(finalColor.rgb, vec3(1 / 2.2));\n#endif\n\n    gl_FragColor = finalColor;\n}\n\n@end";
});