#version 430

// SYNCS - do not touch this line, will be replaced with sync definitions

layout(location = 0) uniform sampler2D textSampler;
layout(location = 1, binding = 1) uniform sampler2D sampler;
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
        
    h = s.y + 1. - h*syncs[LANDSCAPE];    
    res=min(res,h);

    vec3 q = rep3(s+2.,2.);
    h = lattice(q);    
    res=min(res,h-.2+syncs[BARS]);    
    glow += .0003/(.003+h*h)*syncs[LATTICEGLOW];                     


    h = syncs[WALLS]-length(s.xy);
    res=min(res,h);    

    vec3 e = mod(s ,5.)-2.5;

    float index = floor(p.z/4.+.5);
    float rotspeed = sin(index*3.)*2.;

    e = s - vec3(4. * mod(index,2.)-2.,2.,-2.);       
    e.xy *= r2(rotspeed*syncs[ROW]/16.);
    pModPolar(e.xy,8.);
    e.z = mod(e.z,4.)-2.;

    h = length(e.yz)+.4-syncs[ENV_0]*.45+syncs[LASERS];
    res=min(res,h);    
    glow += .00002/(.000003+h*h+syncs[LASERS]);                     

    pModPolar(s.xy,18.);
    s.z = mod(s.z,1.)-.5;

    h = sdSphere(s-vec3(syncs[WALLS],0,0),.1);
    res=min(res,h);    
    glow += .00002/(.000003+h*h+syncs[LIGHTS])*max(syncs[ENV_2]*5.-4.,0.);            
        
    h = ro.z+4.+sin(syncs[ROW]*PI/8.)+100.*(1.-syncs[EFFECT]);
    vec3 o = vec3(p.xy - path(h),p.z-h);
    o.xy *= r2(syncs[ROW]/7.);
    o.yz *= r2(syncs[ROW]/9.);
        
    q = abs(abs(o)-vec3(.25));
    h = sdSphere(q,.25);    
    res=min(res,h);    
        
    s = abs(o);
    h = length(s-(s.z+s.y+s.z)*vec3(1)/3.1)+.42-syncs[ENV_0]*.45;
    res=min(res,h);    
    glow += .0002/(.0003+h*h);     

    return res;
}

vec3 image(vec2 uv) {    
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

void main()
{   
    vec2 u = 2*gl_FragCoord.xy-iResolution;    
    const int n=10;
    vec3 c,f = vec3(1);	
    if (syncs[ROW]<0) {        
        u/=iResolution;                
	    for(int i=0;i<n;++i){
		    c.r+=texture(sampler,.5+.5*(u*f.r)).r;
		    c.g+=texture(sampler,.5+.5*(u*f.g)).g;
		    c.b+=texture(sampler,.5+.5*(u*f.b)).b;
            f*=vec3(.9988,.9982,.996);
	    }    
        c /= n;
        c += texture(textSampler,clamp((u+vec2(.13,.22))/.4,vec2(0),vec2(1))).rgb * syncs[CREDITS];
    } else {
        u/=iResolution.y;                
        c = image(u);        
    }
    outcolor = vec4(c,1);
}
