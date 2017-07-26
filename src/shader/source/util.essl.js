define(function () {
return "\n@export qtek.util.rand\nhighp float rand(vec2 uv) {\n const highp float a = 12.9898, b = 78.233, c = 43758.5453;\n highp float dt = dot(uv.xy, vec2(a,b)), sn = mod(dt, 3.141592653589793);\n return fract(sin(sn) * c);\n}\n@end\n\n@export qtek.util.calculate_attenuation\n\nuniform float attenuationFactor : 5.0;\n\nfloat lightAttenuation(float dist, float range)\n{\n float attenuation = 1.0;\n attenuation = dist*dist/(range*range+1.0);\n float att_s = attenuationFactor;\n attenuation = 1.0/(attenuation*att_s+1.0);\n att_s = 1.0/(att_s+1.0);\n attenuation = attenuation - att_s;\n attenuation /= 1.0 - att_s;\n return clamp(attenuation, 0.0, 1.0);\n}\n\n@end\n\n@export qtek.util.edge_factor\n\nfloat edgeFactor(float width)\n{\n vec3 d = fwidth(v_Barycentric);\n vec3 a3 = smoothstep(vec3(0.0), d * width, v_Barycentric);\n return min(min(a3.x, a3.y), a3.z);\n}\n\n@end\n\n@export qtek.util.encode_float\nvec4 encodeFloat(const in float depth)\n{\n \n \n const vec4 bitShifts = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);\n const vec4 bit_mask = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);\n vec4 res = fract(depth * bitShifts);\n res -= res.xxyz * bit_mask;\n\n return res;\n}\n@end\n\n@export qtek.util.decode_float\nfloat decodeFloat(const in vec4 color)\n{\n \n \n const vec4 bitShifts = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);\n return dot(color, bitShifts);\n}\n@end\n\n\n@export qtek.util.float\n@import qtek.util.encode_float\n@import qtek.util.decode_float\n@end\n\n\n\n@export qtek.util.rgbm_decode\nvec3 RGBMDecode(vec4 rgbm, float range) {\n return range * rgbm.rgb * rgbm.a;\n }\n@end\n\n@export qtek.util.rgbm_encode\nvec4 RGBMEncode(vec3 color, float range) {\n if (dot(color, color) == 0.0) {\n return vec4(0.0);\n }\n vec4 rgbm;\n color /= range;\n rgbm.a = clamp(max(max(color.r, color.g), max(color.b, 1e-6)), 0.0, 1.0);\n rgbm.a = ceil(rgbm.a * 255.0) / 255.0;\n rgbm.rgb = color / rgbm.a;\n return rgbm;\n}\n@end\n\n@export qtek.util.rgbm\n@import qtek.util.rgbm_decode\n@import qtek.util.rgbm_encode\n\nvec4 decodeHDR(vec4 color)\n{\n#if defined(RGBM_DECODE) || defined(RGBM)\n return vec4(RGBMDecode(color, 51.5), 1.0);\n#else\n return color;\n#endif\n}\n\nvec4 encodeHDR(vec4 color)\n{\n#if defined(RGBM_ENCODE) || defined(RGBM)\n return RGBMEncode(color.xyz, 51.5);\n#else\n return color;\n#endif\n}\n\n@end\n\n\n@export qtek.util.srgb\n\nvec4 sRGBToLinear(in vec4 value) {\n return vec4(mix(pow(value.rgb * 0.9478672986 + vec3(0.0521327014), vec3(2.4)), value.rgb * 0.0773993808, vec3(lessThanEqual(value.rgb, vec3(0.04045)))), value.w);\n}\n\nvec4 linearTosRGB(in vec4 value) {\n return vec4(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.w);\n}\n@end\n\n\n@export qtek.chunk.skinning_header\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\n#ifdef USE_SKIN_MATRICES_TEXTURE\nuniform sampler2D skinMatricesTexture;\nuniform float skinMatricesTextureSize: unconfigurable;\nmat4 getSkinMatrix(float idx) {\n float j = idx * 4.0;\n float x = mod(j, skinMatricesTextureSize);\n float y = floor(j / skinMatricesTextureSize) + 0.5;\n vec2 scale = vec2(skinMatricesTextureSize);\n\n return mat4(\n texture2D(skinMatricesTexture, vec2(x + 0.5, y) / scale),\n texture2D(skinMatricesTexture, vec2(x + 1.5, y) / scale),\n texture2D(skinMatricesTexture, vec2(x + 2.5, y) / scale),\n texture2D(skinMatricesTexture, vec2(x + 3.5, y) / scale)\n );\n}\n#else\nuniform mat4 skinMatrix[JOINT_COUNT] : SKIN_MATRIX;\nmat4 getSkinMatrix(float idx) {\n return skinMatrix[int(idx)];\n}\n#endif\n\n#endif\n\n@end\n\n@export qtek.chunk.skin_matrix\n\nmat4 skinMatrixWS;\nif (joint.x >= 0.0)\n{\n skinMatrixWS = getSkinMatrix(joint.x) * weight.x;\n}\nif (joint.y >= 0.0)\n{\n skinMatrixWS += getSkinMatrix(joint.y) * weight.y;\n}\nif (joint.z >= 0.0)\n{\n skinMatrixWS += getSkinMatrix(joint.z) * weight.z;\n}\nif (joint.w >= 0.0)\n{\n skinMatrixWS += getSkinMatrix(joint.w) * (1.0-weight.x-weight.y-weight.z);\n}\n@end\n\n\n\n@export qtek.util.parallax_correct\n\nvec3 parallaxCorrect(in vec3 dir, in vec3 pos, in vec3 boxMin, in vec3 boxMax) {\n vec3 first = (boxMax - pos) / dir;\n vec3 second = (boxMin - pos) / dir;\n\n vec3 further = max(first, second);\n float dist = min(further.x, min(further.y, further.z));\n\n vec3 fixedPos = pos + dir * dist;\n vec3 boxCenter = (boxMax + boxMin) * 0.5;\n\n return normalize(fixedPos - boxCenter);\n}\n\n@end\n\n\n\n@export qtek.util.clamp_sample\nvec4 clampSample(const in sampler2D texture, const in vec2 coord)\n{\n#ifdef STEREO\n float eye = step(0.5, coord.x) * 0.5;\n vec2 coordClamped = clamp(coord, vec2(eye, 0.0), vec2(0.5 + eye, 1.0));\n#else\n vec2 coordClamped = clamp(coord, vec2(0.0), vec2(1.0));\n#endif\n return texture2D(texture, coordClamped);\n}\n@end";
});