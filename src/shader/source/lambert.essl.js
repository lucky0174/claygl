define(function () {
return "/**\n * http://en.wikipedia.org/wiki/Lambertian_reflectance\n */\n\n@export buildin.lambert.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\nuniform vec2 uvOffset : [0.0, 0.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\n\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_COUNT] : SKIN_MATRIX;\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Barycentric;\n\nvoid main()\n{\n\n    vec3 skinnedPosition = position;\n    vec3 skinnedNormal = normal;\n\n#ifdef SKINNING\n\n    @import buildin.chunk.skin_matrix\n\n    skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n    // Upper 3x3 of skinMatrix is orthogonal\n    skinnedNormal = (skinMatrixWS * vec4(normal, 0.0)).xyz;\n#endif\n\n    gl_Position = worldViewProjection * vec4( skinnedPosition, 1.0 );\n\n    v_Texcoord = texcoord * uvRepeat + uvOffset;\n    v_Normal = normalize( ( worldInverseTranspose * vec4(skinnedNormal, 0.0) ).xyz );\n    v_WorldPosition = ( world * vec4( skinnedPosition, 1.0) ).xyz;\n\n    v_Barycentric = barycentric;\n}\n\n@end\n\n\n@export buildin.lambert.fragment\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\nuniform sampler2D diffuseMap;\nuniform sampler2D alphaMap;\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform vec3 emission : [0.0, 0.0, 0.0];\nuniform float alpha : 1.0;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_COUNT\n@import buildin.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_COUNT\n@import buildin.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_COUNT\n@import buildin.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_COUNT\n@import buildin.header.spot_light\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n// Import util functions and uniforms needed\n@import buildin.util.calculate_attenuation\n\n@import buildin.util.edge_factor\n\n@import buildin.plugin.compute_shadow_map\n\nvoid main()\n{\n#ifdef RENDER_NORMAL\n    gl_FragColor = vec4(v_Normal * 0.5 + 0.5, 1.0);\n    return;\n#endif\n#ifdef RENDER_TEXCOORD\n    gl_FragColor = vec4(v_Texcoord, 1.0, 1.0);\n    return;\n#endif\n\n    gl_FragColor = vec4(color, alpha);\n\n#ifdef DIFFUSEMAP_ENABLED\n    vec4 tex = texture2D( diffuseMap, v_Texcoord );\n#ifdef SRGB_DECODE\n    tex.rgb = pow(tex.rgb, vec3(2.2));\n#endif\n    gl_FragColor.rgb *= tex.rgb;\n#ifdef DIFFUSEMAP_ALPHA_ALPHA\n    gl_FragColor.a *= tex.a;\n#endif\n#endif\n\n    vec3 diffuseColor = vec3(0.0, 0.0, 0.0);\n\n#ifdef AMBIENT_LIGHT_COUNT\n    for(int i = 0; i < AMBIENT_LIGHT_COUNT; i++)\n    {\n        diffuseColor += ambientLightColor[i];\n    }\n#endif\n// Compute point light color\n#ifdef POINT_LIGHT_COUNT\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsPoint[POINT_LIGHT_COUNT];\n    if( shadowEnabled )\n    {\n        computeShadowOfPointLights(v_WorldPosition, shadowContribsPoint);\n    }\n#endif\n    for(int i = 0; i < POINT_LIGHT_COUNT; i++)\n    {\n\n        vec3 lightPosition = pointLightPosition[i];\n        vec3 lightColor = pointLightColor[i];\n        float range = pointLightRange[i];\n\n        vec3 lightDirection = lightPosition - v_WorldPosition;\n\n        // Calculate point light attenuation\n        float dist = length(lightDirection);\n        float attenuation = lightAttenuation(dist, range);\n\n        // Normalize vectors\n        lightDirection /= dist;\n\n        float ndl = dot( v_Normal, lightDirection );\n\n        float shadowContrib = 1.0;\n#if defined(POINT_LIGHT_SHADOWMAP_COUNT)\n        if( shadowEnabled )\n        {\n            shadowContrib = shadowContribsPoint[i];\n        }\n#endif\n\n        diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * attenuation * shadowContrib;\n    }\n#endif\n#ifdef DIRECTIONAL_LIGHT_COUNT\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsDir[DIRECTIONAL_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfDirectionalLights(v_WorldPosition, shadowContribsDir);\n    }\n#endif\n    for(int i = 0; i < DIRECTIONAL_LIGHT_COUNT; i++)\n    {\n        vec3 lightDirection = -directionalLightDirection[i];\n        vec3 lightColor = directionalLightColor[i];\n\n        float ndl = dot(v_Normal, normalize(lightDirection));\n\n        float shadowContrib = 1.0;\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n        if( shadowEnabled )\n        {\n            shadowContrib = shadowContribsDir[i];\n        }\n#endif\n\n        diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * shadowContrib;\n    }\n#endif\n\n#ifdef SPOT_LIGHT_COUNT\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n    float shadowContribsSpot[SPOT_LIGHT_COUNT];\n    if(shadowEnabled)\n    {\n        computeShadowOfSpotLights(v_WorldPosition, shadowContribsSpot);\n    }\n#endif\n    for(int i = 0; i < SPOT_LIGHT_COUNT; i++)\n    {\n        vec3 lightPosition = -spotLightPosition[i];\n        vec3 spotLightDirection = -normalize( spotLightDirection[i] );\n        vec3 lightColor = spotLightColor[i];\n        float range = spotLightRange[i];\n        float a = spotLightUmbraAngleCosine[i];\n        float b = spotLightPenumbraAngleCosine[i];\n        float falloffFactor = spotLightFalloffFactor[i];\n\n        vec3 lightDirection = lightPosition - v_WorldPosition;\n        // Calculate attenuation\n        float dist = length(lightDirection);\n        float attenuation = lightAttenuation(dist, range);\n\n        // Normalize light direction\n        lightDirection /= dist;\n        // Calculate spot light fall off\n        float c = dot(spotLightDirection, lightDirection);\n\n        float falloff;\n        falloff = clamp((c - a) /( b - a), 0.0, 1.0);\n        falloff = pow(falloff, falloffFactor);\n\n        float ndl = dot(v_Normal, lightDirection);\n        ndl = clamp(ndl, 0.0, 1.0);\n\n        float shadowContrib = 1.0;\n#if defined(SPOT_LIGHT_SHADOWMAP_COUNT)\n        if( shadowEnabled )\n        {\n            shadowContrib = shadowContribsSpot[i];\n        }\n#endif\n        diffuseColor += lightColor * ndl * attenuation * (1.0-falloff) * shadowContrib;\n    }\n#endif\n\n    gl_FragColor.rgb *= diffuseColor;\n    gl_FragColor.rgb += emission;\n    if(lineWidth > 0.01)\n    {\n        gl_FragColor.rgb = gl_FragColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n}\n\n@end";
});