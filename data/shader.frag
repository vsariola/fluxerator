#version 430

// SYNCS - do not touch this line, will be replaced with sync definitions

layout(location = 0) uniform sampler2D sampler;
layout(location = 1) uniform float syncs[NUM_SYNCS];

out vec4 outcolor;
const vec2 iResolution = vec2(@XRES@,@YRES@);

// ----------------------------
// when copying, copy from here
// ----------------------------

#define r2(a) mat2(cos(a),sin(a),-sin(a),cos(a))

const float PI = 3.14159265358;
const float MINDIST = .0001;
const float MAXDIST = 125.;
const int MAXSTEP = 160;

vec3 glow;
vec3 glowp = vec3(0);

vec2 path(in float z) {
    vec2 p =sin(vec2(z/7.,z/9.));
    p = sin(vec2(z/11.,z/5.)+p*2.);
    return p;
}

float pModPolar(inout vec2 p, float repetitions) {
    float angle = 2.*PI/repetitions;
    float a = atan(p.y, p.x) + angle/2.,
          r = length(p),
          c = floor(a/angle);
    a = mod(a,angle) - angle/2.;
    p = vec2(cos(a), sin(a))*r;
    if (abs(c) >= (repetitions/2.)) c = abs(c);
    return c;
}

float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdSphere( vec3 p, float s )
{
  return length(p)-s;
}

vec3 hsv2rgb( in vec3 c ) {
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return c.z * mix( vec3(1.0), rgb, c.y);
}

vec2 map (in vec3 p) {

    vec2 res = vec2(100.,0.);

    vec3 s = vec3(p.xy - path(p.z),p.z);

    vec3 c = s;
    c.xy *= r2(PI/4.);

    vec3 o = mod(c,10.)-5.;


    float dbox = sdBox(o,vec3(4,4,1.)-syncs[MAP_CUBES]);
    res = vec2(dbox,0.);


    vec3 e = mod(s ,5.)-2.5;
    float db = sdSphere(e,2.+syncs[ENV_0]*.2-syncs[MAP_SPHERES]);
    if (db < res.x ) {
        res = vec2(db,0.);
    }

    e = s;
    e.xy *= r2(p.z+syncs[ROW]/16.);
    pModPolar(e.xy,3.);
    e.z = mod(e.z,10.)-5.;
    float dw = length(e.xz-vec2(1.5));
    if (dw < res.x ) {
        res = vec2(dw,0.);
    }
    glow += .00005/(.000003+dw*dw+syncs[LASERS])*vec3(.4,1,.3);



    pModPolar(s.xy,20.);
    s.z = mod(s.z,1.)-.5;

    float dg = sdSphere(s-vec3(2.5,0,0),0.01);
    if (dg < res.x ) {
        res = vec2(dg,0.);
    }

    glow += .0001/(.000003+dg*dg+syncs[LIGHTS])*hsv2rgb(vec3(p.z*.0025,.4,.6));

    return res;
}

vec2 march(vec3 ro, vec3 rd) {
    float d =  0.,m = -1.;
    for(int i=0;i<MAXSTEP;i++) {
        vec3 p = ro + rd * d;
        vec2 t = map(p);
        if (abs(t.x)<d*MINDIST || d>MAXDIST)
            break;
        d += t.x/3.;
        m  = t.y;
    }
    return vec2(d,m);
}

vec4 image(vec2 f) {
    vec2 uv = vec2(2.*f-iResolution.xy)/iResolution.x;
    if (abs(uv.y) < syncs[CLIP]) {
        uv -= 2.*max(uv-vec2(syncs[MIRROR_X],syncs[MIRROR_Y]),0.);

        // Calculate the normalized ray direction
        vec3 rd = normalize(vec3(uv,1.5));

        rd.xy *= r2(syncs[CAM_ROLL]);
        rd.yz *= r2(syncs[CAM_PITCH]);
        rd.xz *= r2(syncs[CAM_YAW]);

        float z = syncs[0];
        vec3 ro = vec3(path(z),z);

        vec2 t = march(ro,rd);

        vec3 col = 0.*t.y + abs(glow*.65);

        return vec4(pow(col, vec3(0.4545)),1.0);
    }
}

// -----------------------------
// when copying, copy up to here
// -----------------------------

vec3 ca(sampler2D t, vec2 u){
	const int n=10;
	vec3 c=vec3(0);
	float rf=1,gf=1,bf=1;
	for(int i=0;i<n;++i){
		c.r+=texture(t,.5+.5*(u*rf)).r;
		c.g+=texture(t,.5+.5*(u*gf)).g;
		c.b+=texture(t,.5+.5*(u*bf)).b;
		rf*=.9988;
		gf*=.9982;
        bf*=.996;
	}
	return c/n;
}

vec4 post(vec2 f) {
    return vec4(ca(sampler,-1+2*f/iResolution),1);
}

void main()
{
    if (syncs[ROW]<0) {
	    outcolor = post(gl_FragCoord.xy);
    } else {
        outcolor = image(gl_FragCoord.xy);
    }
}
