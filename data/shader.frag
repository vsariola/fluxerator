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
float glow;
vec3 ro;

#define r2(a)mat2(cos(a),sin(a),-sin(a),cos(a))

// 3D repetition
vec3 rep3(vec3 p, float r)
{
    return mod(p+r,2.*r)-r;
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

void pModPolar(inout vec2 p, float repetitions) {
    float angle = 2.*PI/repetitions;
    float a = atan(p.y, p.x) + angle/2.,
          r = length(p);          
    a = mod(a,angle) - angle/2.;
    p = vec2(cos(a), sin(a))*r;    
}

float map (in vec3 p) {    

    float res = 100.;

    vec3 s = vec3(p.xy - path(p.z),p.z);

    s = mix(s,abs(s),vec3(syncs[MIRROR_X],syncs[MIRROR_Y],0));    
        
    float h=0.;
    vec2 c=s.xz*3.;
    for(int i = 0; i<4; i++){
   	   h -= .2*abs(sin(c.x));       
       c *= mat2(0.8,-0.6,0.6, 0.8);
    }       
        
    float flr = s.y + 1. - h*syncs[LANDSCAPE];    
    res=min(res,flr);

    vec3 q = rep3(s+2.,2.);
    float dlattice = lattice(q);    
    res=min(res,dlattice-.2+syncs[BARS]);    
    glow += .0003/(.003+dlattice*dlattice)*syncs[LATTICEGLOW];                     


    float tube = syncs[WALLS]-length(s.xy);
    res=min(res,tube);    

    vec3 e = mod(s ,5.)-2.5;

    float index = floor(p.z/4.+.5);
    float rotspeed = sin(index*3.)*2.;

    e = s - vec3(4. * mod(index,2.)-2.,2.,-2.);       
    e.xy *= r2(rotspeed*syncs[ROW]/16.);
    pModPolar(e.xy,8.);
    e.z = mod(e.z,4.)-2.;

    float dw = length(e.yz)+.4-syncs[ENV_0]*.45+syncs[LASERS];
    res=min(res,dw);    
    glow += .00002/(.000003+dw*dw+syncs[LASERS]);                     

    pModPolar(s.xy,18.);
    s.z = mod(s.z,1.)-.5;

    float dg = sdSphere(s-vec3(syncs[WALLS],0,0),.1);
    res=min(res,dg);    
    glow += .00002/(.000003+dg*dg+syncs[LIGHTS])*max(syncs[ENV_2]*5.-4.,0.);            
        
    float z = ro.z+4.+sin(syncs[ROW]*PI/8.)+100.*(1.-syncs[EFFECT]);
    vec3 o = vec3(p.xy - path(z),p.z-z);
    o.xy *= r2(syncs[ROW]/7.);
    o.yz *= r2(syncs[ROW]/9.);
        
    q = abs(abs(o)-vec3(.25));
    float dball = sdSphere(q,.25);    
    res=min(res,dball);    
        
    s = abs(o);
    dw = length(s-(s.z+s.y+s.z)*vec3(1)/3.1)+.42-syncs[ENV_0]*.45;
    res=min(res,dw);    
    glow += .0002/(.0003+dw*dw);     

    return res;
}

vec3 image(in vec2 fragCoord) {
    vec2 uv = vec2(2.*fragCoord-iResolution.xy)/iResolution.y;
    vec3 col;
    vec3 pos, pos2;
    float m;
    float t,t2;
    vec3 normal;
    vec2 e = vec2(0, .001);    
    // Calculate the normalized ray direction
    vec3 rd = normalize(vec3(uv,1.8));
    // Camera origin
    float z = max(syncs[0],64.)*2.;

    col = texture(textSampler,clamp((fragCoord/iResolution-vec2(0.45,0.39))/.2,vec2(0),vec2(1))).rgb * syncs[CREDITS];

    if (abs(uv.y) < syncs[CLIP]*.78) {        
        // Roll-pitch-yaw rotations
        rd.xy *= r2(syncs[CAM_ROLL]);
        rd.yz *= r2(syncs[CAM_PITCH]);
        rd.xz *= r2(syncs[CAM_YAW]);
        
        ro = vec3(path(z),z);
        
        for(int i=0; i<MAXSTEP; i++) {
            pos = ro + rd*t;
            m = map(pos);            
            t += m/3.;        
            if (abs(m)<t*MINDIST || t>MAXDIST)
                break;
        }
        col += pow(glow * vec3(.4,1,.3) * (.2+syncs[ENV_0]),vec3(0.4545));                                
    }
    return col;
}

// -----------------------------
// when copying, copy up to here
// -----------------------------

vec3 ca(sampler2D t, vec2 u){
	const int n=10;
	vec3 c,f = vec3(1);	
	for(int i=0;i<n;++i){
		c.r+=texture(t,.5+.5*(u*f.r)).r;
		c.g+=texture(t,.5+.5*(u*f.g)).g;
		c.b+=texture(t,.5+.5*(u*f.b)).b;
        f*=vec3(.9988,.9982,.996);
	}
	return c/n;
}

vec4 post(vec2 f) {
    return vec4(ca(sampler,-1+2*f/iResolution),1);
}

void main()
{
    outcolor = syncs[ROW]<0 ? post(gl_FragCoord.xy) : vec4(image(gl_FragCoord.xy),1.0);    
}
