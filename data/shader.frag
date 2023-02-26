#version 330

uniform float syncs[8];
out vec4 outcolor;
vec2 iResolution = vec2(@XRES@,@YRES@);

void main()
{
    vec2 uv = gl_FragCoord.xy/iResolution.xy;

    vec3 col = 0.5 + 0.5*cos(uv.xyx+vec3(0,2,4));

    outcolor = vec4(sqrt(col)-syncs[0]-mod(syncs[0]*4,1),1);
}