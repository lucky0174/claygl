define(function () {
return "uniform samplerCube environmentMap;\n\nvarying vec2 v_Texcoord;\n\n#define TEXTURE_SIZE 16\n\nmat3 front = mat3(\n 1.0, 0.0, 0.0,\n 0.0, 1.0, 0.0,\n 0.0, 0.0, 1.0\n);\n\nmat3 back = mat3(\n -1.0, 0.0, 0.0,\n 0.0, 1.0, 0.0,\n 0.0, 0.0, -1.0\n);\n\nmat3 left = mat3(\n 0.0, 0.0, -1.0,\n 0.0, 1.0, 0.0,\n 1.0, 0.0, 0.0\n);\n\nmat3 right = mat3(\n 0.0, 0.0, 1.0,\n 0.0, 1.0, 0.0,\n -1.0, 0.0, 0.0\n);\n\nmat3 up = mat3(\n 1.0, 0.0, 0.0,\n 0.0, 0.0, 1.0,\n 0.0, -1.0, 0.0\n);\n\nmat3 down = mat3(\n 1.0, 0.0, 0.0,\n 0.0, 0.0, -1.0,\n 0.0, 1.0, 0.0\n);\n\n\nfloat harmonics(vec3 normal){\n int index = int(gl_FragCoord.x);\n\n float x = normal.x;\n float y = normal.y;\n float z = normal.z;\n\n if(index==0){\n return 1.0;\n }\n else if(index==1){\n return x;\n }\n else if(index==2){\n return y;\n }\n else if(index==3){\n return z;\n }\n else if(index==4){\n return x*z;\n }\n else if(index==5){\n return y*z;\n }\n else if(index==6){\n return x*y;\n }\n else if(index==7){\n return 3.0*z*z - 1.0;\n }\n else{\n return x*x - y*y;\n }\n}\n\nvec3 sampleSide(mat3 rot)\n{\n\n vec3 result = vec3(0.0);\n float divider = 0.0;\n for (int i = 0; i < TEXTURE_SIZE * TEXTURE_SIZE; i++) {\n float x = mod(float(i), float(TEXTURE_SIZE));\n float y = float(i / TEXTURE_SIZE);\n\n vec2 sidecoord = ((vec2(x, y) + vec2(0.5, 0.5)) / vec2(TEXTURE_SIZE)) * 2.0 - 1.0;\n vec3 normal = normalize(vec3(sidecoord, -1.0));\n vec3 fetchNormal = rot * normal;\n vec3 texel = textureCube(environmentMap, fetchNormal).rgb;\n\n result += harmonics(fetchNormal) * texel * -normal.z;\n\n divider += -normal.z;\n }\n\n return result / divider;\n}\n\nvoid main()\n{\n vec3 result = (\n sampleSide(front) +\n sampleSide(back) +\n sampleSide(left) +\n sampleSide(right) +\n sampleSide(up) +\n sampleSide(down)\n ) / 6.0;\n gl_FragColor = vec4(result, 1.0);\n}";
});