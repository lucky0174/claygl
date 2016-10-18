define(function () {
return "\n@export qtek.util.rand\n// // http://stackoverflow.com/questions/4200224/random-noise-functions-for-glsl\n// float rand(vec2 co){\n//     return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\n// }\n\n// expects values in the range of [0,1]x[0,1], returns values in the [0,1] range.\n// do not collapse into a single function per: http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/\nhighp float rand(vec2 uv) {\n    const highp float a = 12.9898, b = 78.233, c = 43758.5453;\n    highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, 3.141592653589793 );\n    return fract(sin(sn) * c);\n}\n@end\n\n// Use light attenuation formula in\n// http://blog.slindev.com/2011/01/10/natural-light-attenuation/\n@export qtek.util.calculate_attenuation\n\nuniform float attenuationFactor : 5.0;\n\nfloat lightAttenuation(float dist, float range)\n{\n    float attenuation = 1.0;\n    attenuation = dist*dist/(range*range+1.0);\n    float att_s = attenuationFactor;\n    attenuation = 1.0/(attenuation*att_s+1.0);\n    att_s = 1.0/(att_s+1.0);\n    attenuation = attenuation - att_s;\n    attenuation /= 1.0 - att_s;\n    return clamp(attenuation, 0.0, 1.0);\n}\n\n@end\n\n//http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/\n@export qtek.util.edge_factor\n\nfloat edgeFactor(float width)\n{\n    vec3 d = fwidth(v_Barycentric);\n    vec3 a3 = smoothstep(vec3(0.0), d * width, v_Barycentric);\n    return min(min(a3.x, a3.y), a3.z);\n}\n\n@end\n\n// Pack depth\n// !!!! Float value can only be [0.0 - 1.0)\n@export qtek.util.encode_float\nvec4 encodeFloat(const in float depth)\n{\n    // const float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)\n    // const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );\n    // const float ShiftRight8 = 1. / 256.;\n\n    // vec4 r = vec4(fract(depth * PackFactors), depth);\n    // r.yzw -= r.xyz * ShiftRight8; // tidy overflow\n    // return r * PackUpscale;\n\n    const vec4 bitShifts = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);\n    const vec4 bit_mask  = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);\n    vec4 res = fract(depth * bitShifts);\n    res -= res.xxyz * bit_mask;\n\n    return res;\n}\n@end\n\n@export qtek.util.decode_float\nfloat decodeFloat(const in vec4 color)\n{\n    // const float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)\n    // const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );\n    // const vec4 UnpackFactors = UnpackDownscale / vec4(PackFactors, 1.);\n\n    // return dot(color, UnpackFactors);\n\n    const vec4 bitShifts = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0 );\n    return dot(color, bitShifts);\n}\n@end\n\n\n@export qtek.util.float\n@import qtek.util.encode_float\n@import qtek.util.decode_float\n@end\n\n\n// http://graphicrants.blogspot.com/2009/04/rgbm-color-encoding.html\n@export qtek.util.rgbm_decode\nvec3 RGBMDecode(vec4 rgbm, float range) {\n  return range * rgbm.rgb * rgbm.a;\n  // Premultiply alpha ?\n  // return range * rgbm.rgb;\n}\n@end\n\n@export qtek.util.rgbm_encode\nvec4 RGBMEncode(vec3 color, float range) {\n    if (dot(color, color) == 0.0) {\n        return vec4(0.0);\n    }\n    vec4 rgbm;\n    color /= range;\n    rgbm.a = clamp(max(max(color.r, color.g), max(color.b, 1e-6 ) ), 0.0, 1.0);\n    rgbm.a = ceil(rgbm.a * 255.0) / 255.0;\n    rgbm.rgb = color / rgbm.a;\n    return rgbm;\n}\n@end\n\n@export qtek.util.rgbm\n@import qtek.util.rgbm_decode\n@import qtek.util.rgbm_encode\n\nvec4 decodeHDR(vec4 color)\n{\n#if defined(RGBM_DECODE) || defined(RGBM)\n    return vec4(RGBMDecode(color, 51.5), 1.0);\n#else\n    return color;\n#endif\n}\n\nvec4 encodeHDR(vec4 color)\n{\n#if defined(RGBM_ENCODE) || defined(RGBM)\n    return RGBMEncode(color.xyz, 51.5);\n#else\n    return color;\n#endif\n}\n\n@end\n\n\n\n\n@export qtek.chunk.skin_matrix\n\n// Weighted Sum Skinning Matrix\nmat4 skinMatrixWS;\nif (joint.x >= 0.0)\n{\n    skinMatrixWS = skinMatrix[int(joint.x)] * weight.x;\n}\nif (joint.y >= 0.0)\n{\n    skinMatrixWS += skinMatrix[int(joint.y)] * weight.y;\n}\nif (joint.z >= 0.0)\n{\n    skinMatrixWS += skinMatrix[int(joint.z)] * weight.z;\n}\nif (joint.w >= 0.0)\n{\n    skinMatrixWS += skinMatrix[int(joint.w)] * (1.0-weight.x-weight.y-weight.z);\n}\n@end\n";
});