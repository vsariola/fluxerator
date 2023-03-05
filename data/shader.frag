#version 430

// SYNCS - do not touch this line, will be replaced with sync definitions

layout(location = 0) uniform sampler2D sampler;
layout(location = 1, binding = 1) uniform sampler2D textSampler;
layout(location = 2) uniform float syncs[NUM_SYNCS];

out vec4 outcolor;
const vec2 iResolution = vec2(@XRES@,@YRES@);

// ----------------------------
// when copying, copy from here
// ----------------------------

const float PI = 3.14159265358;
const float MINDIST = .0001;
const float MAXDIST = 125.;
const int MAXSTEP = 160;

// globals
vec3 glow;

#define r2(a) mat2(cos(a),sin(a),-sin(a),cos(a))

// SDF-merge, with materials
void dmin(inout vec3 d, float x, float y, float z)
{
	if( x < d.x ) d = vec3(x, y, z);
}

// 3D repetition
vec3 rep3(vec3 p, float r)
{
    return mod(p+r,2.*r)-r;
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


float lattice(vec3 p)
{
	p = abs(p);
	p = max(p,p.yzx);
	p = min(p,p.yzx);
	p = min(p,p.yzx);
	return p.x;
}

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



vec3 hsv2rgb( in vec3 c ) {
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return c.z * mix( vec3(1.0), rgb, c.y);
}

vec3 map (in vec3 p) {    

    vec3 res = vec3(100.,0.,1.);

    vec3 s = vec3(p.xy - path(p.z),p.z);

    s = mix(s,abs(s),vec3(syncs[MIRROR_X],syncs[MIRROR_Y],0));    
        
    float flr = s.y + 1.;
    dmin(res,flr,0.,.001);

    vec3 q = rep3(s+2.,2.);
    float dlattice = lattice(q)-.2+syncs[BARS];
    dmin(res, dlattice,0.,0.);

    float tube = 4.-length(s.xy);
    dmin(res, tube,0.,0.);

    vec3 e = mod(s ,5.)-2.5;
    float db = sdSphere(e,2.+syncs[ENV_0]*.2-syncs[MAP_SPHERES]);    


    float index = floor(p.z/4.+.5);
    float rotspeed = sin(index*3.)*2.;

    e = s - vec3(4. * mod(index,2.)-2.,2.,-2.);       
    e.xy *= r2(rotspeed*syncs[ROW]/16.);
    pModPolar(e.xy,8.);
    e.z = mod(e.z,4.)-2.;

    float dw = length(e.yz)+.4-syncs[ENV_0]*.45+syncs[LASERS];
    dmin(res, dw,1.,0.);    
    glow += .00002/(.000003+dw*dw+syncs[LASERS])*vec3(.4,1,.3);                     

    pModPolar(s.xy,18.);
    s.z = mod(s.z,1.)-.5;

    float dg = sdSphere(s-vec3(4,0,0),.1);
    dmin(res, dg,0.,0.);
    glow += .00002/(.000003+dg*dg+syncs[LIGHTS])*vec3(.4,.8,.5)*max(syncs[ENV_2]*5.-4.,0.);            
        
    float z = syncs[0]*2.+4.+sin(syncs[ROW]*PI/8.)+100.*(1.-syncs[EFFECT]);
    vec3 o = vec3(p.xy - path(z),p.z-z);
    o.xy *= r2(syncs[ROW]/7.);
    o.yz *= r2(syncs[ROW]/9.);
        
    q = abs(abs(o)-vec3(.25));
    float dball = sdSphere(q,.25);    
    dmin(res, dball,1.,0.);    
        
    s = abs(o);
    dw = length(s-(s.z+s.y+s.z)*vec3(1)/3.1)+.42-syncs[ENV_0]*.45;
    dmin(res, dw,1.,0.);    
    glow += .0002/(.0003+dw*dw)*vec3(.4,1,.3);     

    return res;
}

vec3 image(in vec2 fragCoord) {
    vec2 uv = vec2(2.*fragCoord-iResolution.xy)/iResolution.y;
    vec3 col;
    vec3 pos, pos2;
    vec3 m,m2;
    float t,t2;
    vec3 normal;
    vec2 e = vec2(0, .001);    
    if (abs(uv.y) < syncs[CLIP]*.78) {        

        // Calculate the normalized ray direction
        vec3 rd = normalize(vec3(uv,1.8));

        // Roll-pitch-yaw rotations
        rd.xy *= r2(syncs[CAM_ROLL]);
        rd.yz *= r2(syncs[CAM_PITCH]);
        rd.xz *= r2(syncs[CAM_YAW]);
        
        // Camera origin
        float z = syncs[0]*2.;
        vec3 ro = vec3(path(z),z);
        
        for(int i=0; i<MAXSTEP; i++) {
            pos = ro + rd*t;
            m = map(pos);            
            t += m.x/3.;        
            if (abs(m.x)<t*MINDIST || t>MAXDIST)
                break;
        }
        col += glow;        
                
        return pow(col * (.2+ syncs[ENV_0]), vec3(0.4545));
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
        outcolor = vec4(image(gl_FragCoord.xy),1.0);
        outcolor.rgb += texture(textSampler,clamp((gl_FragCoord.xy/iResolution-vec2(0.45,0.39))/.2,vec2(0),vec2(1))).rgb * syncs[CREDITS];
    }    
}
