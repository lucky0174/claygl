define(function () {
return "// https://github.com/mitsuhiko/webgl-meincraft/blob/master/assets/shaders/fxaa.glsl\n@export qtek.compositor.fxaa\n\nuniform sampler2D texture;\nuniform vec2 viewportSize : [512, 512];\n\nvarying vec2 v_Texcoord;\n\n#define FXAA_REDUCE_MIN   (1.0/128.0)\n#define FXAA_REDUCE_MUL   (1.0/8.0)\n#define FXAA_SPAN_MAX     8.0\n\n@import qtek.util.rgbm\n\nvoid main()\n{\n    vec2 resolution = 1.0 / viewportSize;\n    vec3 rgbNW =  decodeHDR( texture2D( texture, ( gl_FragCoord.xy + vec2( -1.0, -1.0 ) ) * resolution ) ).xyz;\n    vec3 rgbNE = decodeHDR( texture2D( texture, ( gl_FragCoord.xy + vec2( 1.0, -1.0 ) ) * resolution ) ).xyz;\n    vec3 rgbSW = decodeHDR( texture2D( texture, ( gl_FragCoord.xy + vec2( -1.0, 1.0 ) ) * resolution ) ).xyz;\n    vec3 rgbSE = decodeHDR( texture2D( texture, ( gl_FragCoord.xy + vec2( 1.0, 1.0 ) ) * resolution ) ).xyz;\n    vec4 rgbaM  = decodeHDR( texture2D( texture,  gl_FragCoord.xy  * resolution ) );\n    vec3 rgbM  = rgbaM.xyz;\n    float opacity  = rgbaM.w;\n\n    vec3 luma = vec3( 0.299, 0.587, 0.114 );\n\n    float lumaNW = dot( rgbNW, luma );\n    float lumaNE = dot( rgbNE, luma );\n    float lumaSW = dot( rgbSW, luma );\n    float lumaSE = dot( rgbSE, luma );\n    float lumaM  = dot( rgbM,  luma );\n    float lumaMin = min( lumaM, min( min( lumaNW, lumaNE ), min( lumaSW, lumaSE ) ) );\n    float lumaMax = max( lumaM, max( max( lumaNW, lumaNE) , max( lumaSW, lumaSE ) ) );\n\n    vec2 dir;\n    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));\n    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));\n\n    float dirReduce = max( ( lumaNW + lumaNE + lumaSW + lumaSE ) * ( 0.25 * FXAA_REDUCE_MUL ), FXAA_REDUCE_MIN );\n\n    float rcpDirMin = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + dirReduce );\n    dir = min( vec2( FXAA_SPAN_MAX,  FXAA_SPAN_MAX),\n          max( vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),\n                dir * rcpDirMin)) * resolution;\n\n    vec3 rgbA = decodeHDR( texture2D( texture, gl_FragCoord.xy  * resolution + dir * ( 1.0 / 3.0 - 0.5 ) ) ).xyz;\n    rgbA += decodeHDR( texture2D( texture, gl_FragCoord.xy  * resolution + dir * ( 2.0 / 3.0 - 0.5 ) ) ).xyz;\n    rgbA *= 0.5;\n\n    vec3 rgbB = decodeHDR( texture2D( texture, gl_FragCoord.xy  * resolution + dir * -0.5 ) ).xyz;\n    rgbB += decodeHDR( texture2D( texture, gl_FragCoord.xy  * resolution + dir * 0.5 ) ).xyz;\n    rgbB *= 0.25;\n    rgbB += rgbA * 0.5;\n\n    float lumaB = dot( rgbB, luma );\n\n    if ( ( lumaB < lumaMin ) || ( lumaB > lumaMax ) )\n    {\n\n        gl_FragColor = encodeHDR( vec4( rgbA, opacity ) );\n\n    }\n    else {\n\n        gl_FragColor = encodeHDR( vec4( rgbB, opacity ) );\n\n    }\n}\n\n@end";
});