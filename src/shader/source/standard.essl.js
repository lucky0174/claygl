define(function () {
return "\n\n@export qtek.standard.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\nuniform vec2 uvOffset : [0.0, 0.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\n\n#if defined(AOMAP_ENABLED)\nattribute vec2 texcoord2 : TEXCOORD_1;\n#endif\n\nattribute vec3 normal : NORMAL;\nattribute vec4 tangent : TANGENT;\n\n#ifdef VERTEX_COLOR\nattribute vec4 color : COLOR;\n#endif\n\nattribute vec3 barycentric;\n\n@import qtek.chunk.skinning_header\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Barycentric;\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n#endif\n\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\n\n\n#if defined(AOMAP_ENABLED)\nvarying vec2 v_Texcoord2;\n#endif\n\nvoid main()\n{\n\n vec3 skinnedPosition = position;\n vec3 skinnedNormal = normal;\n vec3 skinnedTangent = tangent.xyz;\n#ifdef SKINNING\n\n @import qtek.chunk.skin_matrix\n\n skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n skinnedNormal = (skinMatrixWS * vec4(normal, 0.0)).xyz;\n skinnedTangent = (skinMatrixWS * vec4(tangent.xyz, 0.0)).xyz;\n#endif\n\n gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0);\n\n v_Texcoord = texcoord * uvRepeat + uvOffset;\n v_WorldPosition = (world * vec4(skinnedPosition, 1.0)).xyz;\n v_Barycentric = barycentric;\n\n v_Normal = normalize((worldInverseTranspose * vec4(skinnedNormal, 0.0)).xyz);\n\n#ifdef NORMALMAP_ENABLED\n v_Tangent = normalize((worldInverseTranspose * vec4(skinnedTangent, 0.0)).xyz);\n v_Bitangent = normalize(cross(v_Normal, v_Tangent) * tangent.w);\n#endif\n\n#ifdef VERTEX_COLOR\n v_Color = color;\n#endif\n\n#if defined(AOMAP_ENABLED)\n v_Texcoord2 = texcoord2;\n#endif\n}\n\n@end\n\n\n@export qtek.standard.fragment\n\n#define PI 3.14159265358979\n#define ALPHA_TEST_THRESHOLD 0.5\n\n#define GLOSS_CHANEL 0\n#define ROUGHNESS_CHANEL 0\n#define METALNESS_CHANEL 1\n\nuniform mat4 viewInverse : VIEWINVERSE;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\nuniform sampler2D normalMap;\n#endif\n\n#ifdef DIFFUSEMAP_ENABLED\nuniform sampler2D diffuseMap;\n#endif\n\n#ifdef SPECULARMAP_ENABLED\nuniform sampler2D specularMap;\n#endif\n\n#ifdef USE_ROUGHNESS\nuniform float roughness : 0.5;\n #ifdef ROUGHNESSMAP_ENABLED\nuniform sampler2D roughnessMap;\n #endif\n#else\nuniform float glossiness: 0.5;\n #ifdef GLOSSMAP_ENABLED\nuniform sampler2D glossMap;\n #endif\n#endif\n\n#ifdef METALNESSMAP_ENABLED\nuniform sampler2D metalnessMap;\n#endif\n\n#ifdef ENVIRONMENTMAP_ENABLED\nuniform samplerCube environmentMap;\n\n #ifdef PARALLAX_CORRECTED\nuniform vec3 environmentBoxMin;\nuniform vec3 environmentBoxMax;\n #endif\n\n#endif\n\n#ifdef BRDFLOOKUP_ENABLED\nuniform sampler2D brdfLookup;\n#endif\n\n#ifdef EMISSIVEMAP_ENABLED\nuniform sampler2D emissiveMap;\n#endif\n\n#ifdef SSAOMAP_ENABLED\nuniform sampler2D ssaoMap;\nuniform vec4 viewport : VIEWPORT;\n#endif\n\n#ifdef AOMAP_ENABLED\nuniform sampler2D aoMap;\nuniform float aoIntensity;\nvarying vec2 v_Texcoord2;\n#endif\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n\n#ifdef USE_METALNESS\nuniform float metalness : 0.0;\n#else\nuniform vec3 specularColor : [0.1, 0.1, 0.1];\n#endif\n\nuniform vec3 emission : [0.0, 0.0, 0.0];\n\nuniform float emissionIntensity: 1;\n\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef ENVIRONMENTMAP_PREFILTER\nuniform float maxMipmapLevel: 5;\n#endif\n\n#ifdef AMBIENT_LIGHT_COUNT\n@import qtek.header.ambient_light\n#endif\n\n#ifdef AMBIENT_SH_LIGHT_COUNT\n@import qtek.header.ambient_sh_light\n#endif\n\n#ifdef AMBIENT_CUBEMAP_LIGHT_COUNT\n@import qtek.header.ambient_cubemap_light\n#endif\n\n#ifdef POINT_LIGHT_COUNT\n@import qtek.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_COUNT\n@import qtek.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_COUNT\n@import qtek.header.spot_light\n#endif\n\n@import qtek.util.calculate_attenuation\n\n@import qtek.util.edge_factor\n\n@import qtek.util.rgbm\n\n@import qtek.util.srgb\n\n@import qtek.plugin.compute_shadow_map\n\n@import qtek.util.parallax_correct\n\n\nfloat G_Smith(float g, float ndv, float ndl)\n{\n float roughness = 1.0 - g;\n float k = roughness * roughness / 2.0;\n float G1V = ndv / (ndv * (1.0 - k) + k);\n float G1L = ndl / (ndl * (1.0 - k) + k);\n return G1L * G1V;\n}\nvec3 F_Schlick(float ndv, vec3 spec) {\n return spec + (1.0 - spec) * pow(1.0 - ndv, 5.0);\n}\n\nfloat D_Phong(float g, float ndh) {\n float a = pow(8192.0, g);\n return (a + 2.0) / 8.0 * pow(ndh, a);\n}\n\nfloat D_GGX(float g, float ndh) {\n float r = 1.0 - g;\n float a = r * r;\n float tmp = ndh * ndh * (a - 1.0) + 1.0;\n return a / (PI * tmp * tmp);\n}\n\n\nvoid main()\n{\n vec4 albedoColor = vec4(color, alpha);\n vec3 eyePos = viewInverse[3].xyz;\n vec3 V = normalize(eyePos - v_WorldPosition);\n\n#ifdef DIFFUSEMAP_ENABLED\n vec4 texel = texture2D(diffuseMap, v_Texcoord);\n #ifdef SRGB_DECODE\n texel = sRGBToLinear(texel);\n #endif\n albedoColor.rgb *= texel.rgb;\n #ifdef DIFFUSEMAP_ALPHA_ALPHA\n albedoColor.a *= texel.a;\n #endif\n\n#endif\n\n\n#ifdef USE_METALNESS\n float m = metalness;\n\n #ifdef METALNESSMAP_ENABLED\n float m2 = texture2D(metalnessMap, v_Texcoord)[METALNESS_CHANEL];\n m = clamp(m2 + (m - 0.5) * 2.0, 0.0, 1.0);\n #endif\n\n vec3 baseColor = albedoColor.rgb;\n albedoColor.rgb = baseColor * (1.0 - m);\n vec3 spec = mix(vec3(0.04), baseColor, m);\n#else\n vec3 spec = specularColor;\n#endif\n\n#ifdef USE_ROUGHNESS\n float g = 1.0 - roughness;\n #ifdef ROUGHNESSMAP_ENABLED\n float g2 = 1.0 - texture2D(roughnessMap, v_Texcoord)[ROUGHNESS_CHANEL];\n g = clamp(g2 + (g - 0.5) * 2.0, 0.0, 1.0);\n #endif\n#else\n float g = glossiness;\n #ifdef GLOSSMAP_ENABLED\n float g2 = texture2D(glossMap, v_Texcoord)[GLOSS_CHANEL];\n g = clamp(g2 + (g - 0.5) * 2.0, 0.0, 1.0);\n #endif\n#endif\n\n#ifdef SPECULARMAP_ENABLED\n spec *= texture2D(specularMap, v_Texcoord).rgb;\n#endif\n\n vec3 N = v_Normal;\n#ifdef NORMALMAP_ENABLED\n if (dot(v_Tangent, v_Tangent) > 0.0) {\n vec3 normalTexel = texture2D(normalMap, v_Texcoord).xyz;\n if (dot(normalTexel, normalTexel) > 0.0) { N = normalTexel * 2.0 - 1.0;\n mat3 tbn = mat3(v_Tangent, v_Bitangent, v_Normal);\n N = normalize(tbn * N);\n }\n }\n#endif\n\n vec3 diffuseTerm = vec3(0.0, 0.0, 0.0);\n vec3 specularTerm = vec3(0.0, 0.0, 0.0);\n\n float ndv = clamp(dot(N, V), 0.0, 1.0);\n vec3 fresnelTerm = F_Schlick(ndv, spec);\n\n#ifdef AMBIENT_LIGHT_COUNT\n for(int _idx_ = 0; _idx_ < AMBIENT_LIGHT_COUNT; _idx_++)\n {{\n diffuseTerm += ambientLightColor[_idx_];\n }}\n#endif\n\n#ifdef AMBIENT_SH_LIGHT_COUNT\n for(int _idx_ = 0; _idx_ < AMBIENT_SH_LIGHT_COUNT; _idx_++)\n {{\n diffuseTerm += calcAmbientSHLight(_idx_, N) * ambientSHLightColor[_idx_];\n }}\n#endif\n\n#ifdef POINT_LIGHT_COUNT\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n float shadowContribsPoint[POINT_LIGHT_COUNT];\n if(shadowEnabled)\n {\n computeShadowOfPointLights(v_WorldPosition, shadowContribsPoint);\n }\n#endif\n for(int _idx_ = 0; _idx_ < POINT_LIGHT_COUNT; _idx_++)\n {{\n\n vec3 lightPosition = pointLightPosition[_idx_];\n vec3 lc = pointLightColor[_idx_];\n float range = pointLightRange[_idx_];\n\n vec3 L = lightPosition - v_WorldPosition;\n\n float dist = length(L);\n float attenuation = lightAttenuation(dist, range);\n L /= dist;\n vec3 H = normalize(L + V);\n float ndl = clamp(dot(N, L), 0.0, 1.0);\n float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n float shadowContrib = 1.0;\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n if(shadowEnabled)\n {\n shadowContrib = shadowContribsPoint[_idx_];\n }\n#endif\n\n vec3 li = lc * ndl * attenuation * shadowContrib;\n diffuseTerm += li;\n specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n }}\n#endif\n\n#ifdef DIRECTIONAL_LIGHT_COUNT\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n float shadowContribsDir[DIRECTIONAL_LIGHT_COUNT];\n if(shadowEnabled)\n {\n computeShadowOfDirectionalLights(v_WorldPosition, shadowContribsDir);\n }\n#endif\n for(int _idx_ = 0; _idx_ < DIRECTIONAL_LIGHT_COUNT; _idx_++)\n {{\n\n vec3 L = -normalize(directionalLightDirection[_idx_]);\n vec3 lc = directionalLightColor[_idx_];\n\n vec3 H = normalize(L + V);\n float ndl = clamp(dot(N, L), 0.0, 1.0);\n float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n float shadowContrib = 1.0;\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n if(shadowEnabled)\n {\n shadowContrib = shadowContribsDir[_idx_];\n }\n#endif\n\n vec3 li = lc * ndl * shadowContrib;\n\n diffuseTerm += li;\n specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n }}\n#endif\n\n#ifdef SPOT_LIGHT_COUNT\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n float shadowContribsSpot[SPOT_LIGHT_COUNT];\n if(shadowEnabled)\n {\n computeShadowOfSpotLights(v_WorldPosition, shadowContribsSpot);\n }\n#endif\n for(int i = 0; i < SPOT_LIGHT_COUNT; i++)\n {\n vec3 lightPosition = spotLightPosition[i];\n vec3 spotLightDirection = -normalize(spotLightDirection[i]);\n vec3 lc = spotLightColor[i];\n float range = spotLightRange[i];\n float a = spotLightUmbraAngleCosine[i];\n float b = spotLightPenumbraAngleCosine[i];\n float falloffFactor = spotLightFalloffFactor[i];\n\n vec3 L = lightPosition - v_WorldPosition;\n float dist = length(L);\n float attenuation = lightAttenuation(dist, range);\n\n L /= dist;\n float c = dot(spotLightDirection, L);\n\n float falloff;\n falloff = clamp((c - a) /( b - a), 0.0, 1.0);\n falloff = pow(falloff, falloffFactor);\n\n vec3 H = normalize(L + V);\n float ndl = clamp(dot(N, L), 0.0, 1.0);\n float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n float shadowContrib = 1.0;\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n if (shadowEnabled)\n {\n shadowContrib = shadowContribsSpot[i];\n }\n#endif\n\n vec3 li = lc * attenuation * (1.0 - falloff) * shadowContrib * ndl;\n\n diffuseTerm += li;\n specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n }\n#endif\n\n vec4 outColor = albedoColor;\n outColor.rgb *= diffuseTerm;\n\n outColor.rgb += specularTerm;\n\n\n#ifdef AMBIENT_CUBEMAP_LIGHT_COUNT\n vec3 L = reflect(-V, N);\n float rough2 = clamp(1.0 - g, 0.0, 1.0);\n float bias2 = rough2 * 5.0;\n vec2 brdfParam2 = texture2D(ambientCubemapLightBRDFLookup[0], vec2(rough2, ndv)).xy;\n vec3 envWeight2 = spec * brdfParam2.x + brdfParam2.y;\n vec3 envTexel2;\n for(int _idx_ = 0; _idx_ < AMBIENT_CUBEMAP_LIGHT_COUNT; _idx_++)\n {{\n envTexel2 = RGBMDecode(textureCubeLodEXT(ambientCubemapLightCubemap[_idx_], L, bias2), 51.5);\n outColor.rgb += ambientCubemapLightColor[_idx_] * envTexel2 * envWeight2;\n }}\n#endif\n\n#ifdef ENVIRONMENTMAP_ENABLED\n\n vec3 envWeight = g * fresnelTerm;\n vec3 L = reflect(-V, N);\n\n #ifdef PARALLAX_CORRECTED\n L = parallaxCorrect(L, v_WorldPosition, environmentBoxMin, environmentBoxMax);\n #endif\n\n #ifdef ENVIRONMENTMAP_PREFILTER\n float rough = clamp(1.0 - g, 0.0, 1.0);\n float bias = rough * maxMipmapLevel;\n vec3 envTexel = decodeHDR(textureCubeLodEXT(environmentMap, L, bias)).rgb;\n\n #ifdef BRDFLOOKUP_ENABLED\n vec2 brdfParam = texture2D(brdfLookup, vec2(rough, ndv)).xy;\n envWeight = spec * brdfParam.x + brdfParam.y;\n #endif\n\n #else\n vec3 envTexel = textureCube(environmentMap, L).xyz;\n #endif\n\n outColor.rgb += envTexel * envWeight;\n#endif\n\n float aoFactor = 1.0;\n#ifdef SSAOMAP_ENABLED\n aoFactor = min(texture2D(ssaoMap, (gl_FragCoord.xy - viewport.xy) / viewport.zw).r, aoFactor);\n#endif\n\n#ifdef AOMAP_ENABLED\n aoFactor = min(1.0 - clamp((1.0 - texture2D(aoMap, v_Texcoord2).r) * aoIntensity, 0.0, 1.0), aoFactor);\n#endif\n\n outColor.rgb *= aoFactor;\n\n vec3 lEmission = emission;\n#ifdef EMISSIVEMAP_ENABLED\n lEmission *= texture2D(emissiveMap, v_Texcoord).rgb;\n#endif\n outColor.rgb += lEmission * emissionIntensity;\n\n#ifdef GAMMA_ENCODE\n outColor.rgb = pow(outColor.rgb, vec3(1 / 2.2));\n#endif\n\n if(lineWidth > 0.)\n {\n outColor.rgb = mix(lineColor, vec3(outColor.rgb), edgeFactor(lineWidth));\n }\n\n#ifdef ALPHA_TEST\n if (outColor.a < ALPHA_TEST_THRESHOLD) {\n discard;\n }\n#endif\n\n gl_FragColor = encodeHDR(outColor);\n}\n\n@end\n";
});