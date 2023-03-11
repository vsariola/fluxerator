#version 430
#define w(a)mat2(cos(a),sin(a),-sin(a),cos(a))

// SYNCS - do not touch this line, will be replaced with sync definitions

layout(location = 0) uniform sampler2D textSampler;
layout(location = 1, binding = 1) uniform sampler2D sampler;
layout(location = 2) uniform float syncs[NUM_SYNCS];

out vec3 outcolor;
vec2 iResolution = vec2(@XRES@,@YRES@);

// ----------------------------
// when copying, copy from here
// ----------------------------

const float PI = 3.14159265358;
const float MINDIST = .0001;
const float MAXDIST = 125;
const int MAXSTEP = 160;

// globals
float glow;
vec3 ro;

vec2 path(float z) {        
    return sin(vec2(z/11,z/5)+sin(vec2(z/7,z/9))*2)*vec2(syncs[PATH_X],syncs[PATH_Y]);
}

void pModPolar(inout vec2 p, float repetitions) {
    float angle = 2*PI/repetitions;
    float a = mod(atan(p.y, p.x) + angle/2,angle)-angle/2;          
    p = vec2(cos(a), sin(a))*length(p);    
}

float map (vec3 p) {    

    float res = 100;
    float h=0;

    vec3 s=vec3(p.xy - path(p.z),p.z),q = vec3(syncs[MIRROR_X],syncs[MIRROR_Y],0);
    s = (1-abs(q))*s + q*abs(s);           

    vec2 c=s.xz*3;
    for(int i = 0; i<4; i++){
   	   h -= .2*abs(sin(c.x));       
       c *= mat2(.8,-.6,.6, .8);
    }       
            
    res=min(res,s.y + 1 - h*syncs[LANDSCAPE]);

    q = abs(mod(s,4)-2);            
	q = max(q,q.yzx);
	q = min(q,q.yzx);
	h = min(q,q.yzx).x;    
	
    res=min(res,h-.2+syncs[LATTICE_SIZE]);    
    glow += .0003/(.003+h*h)*syncs[LATTICE_GLOW];                     

    h = syncs[TUNNEL_RADIUS]-length(s.xy);
    res=min(res,h);        

    h = floor(p.z/4+.5);    

    q = s - vec3(4 * mod(h,2)-2,2,-2);       
    q.xy *= w(sin(h)*syncs[ROW]/8);
    pModPolar(q.xy,8);
    q.z = mod(q.z,4)-2;

    h = length(q.yz)+.4-syncs[ENV_0]*.45+syncs[LASERS];
    res=min(res,h);    
    glow += .00002/(.000003+h*h+syncs[LASERS]);                     

    pModPolar(s.xy,syncs[TUNNEL_LIGHT_REP]);
    s.z = mod(s.z,1)-.5;

    h = length(s-vec3(syncs[TUNNEL_RADIUS],0,0))-.1;
    res=min(res,h);    
    glow += .00002/(.000003+h*h+syncs[TUNNEL_LIGHTS])*max(syncs[ENV_2]*5-4,0);            
        
    h = ro.z+sin(syncs[ROW]*PI/8)+syncs[EFFECT];
    q = vec3(p.xy - path(h),p.z-h);
    q.xy *= w(syncs[ROW]/7);
    q.yz *= w(syncs[ROW]/9);
            
    h = length(abs(abs(q)-.25))-.25;    
    res=min(res,h);    
        
    s = abs(q);
    h = length(s-(s.z+s.y+s.z)/3.1)+.42-syncs[ENV_0]*.45;
    res=min(res,h);    
    glow += .0002/(.0003+h*h);     

    return res;
}

// -----------------------------
// when copying, copy up to here
// -----------------------------

void main()
{   
    vec2 u = 2*gl_FragCoord.xy-iResolution;    
    const int n=10;
    vec3 f = vec3(1), rd = normalize(vec3(u/iResolution.y,1.8));
    u/=iResolution; 
    if (syncs[ROW]<0) {                               
	    for(int i=0;i<n;++i){
		    outcolor.r+=texture(sampler,.5+.5*u*f.r).r;
		    outcolor.g+=texture(sampler,.5+.5*u*f.g).g;
		    outcolor.b+=texture(sampler,.5+.5*u*f.b).b;
            f*=vec3(.9988,.9982,.996)*syncs[SCREEN_ZOOM];
	    }            
        outcolor /= n;                
    } else {                                
        float m;
        float t;                
        float z = max(syncs[0],64)*2;    

        if (abs(u.y) < syncs[SCREEN_CLIP]*.78) {        
            // Roll-pitch-yaw rotations
            rd.xy *= w(syncs[CAM_ROLL]);
            rd.yz *= w(syncs[CAM_PITCH]);
            rd.xz *= w(syncs[CAM_YAW]);
        
            ro = vec3(path(z)+vec2(syncs[CAM_X],syncs[CAM_Y]),z);

            for(int i=0; i<MAXSTEP; i++) {            
                m = map(ro + rd*t);            
                t += m/3;        
                if (abs(m)<t*MINDIST || t>MAXDIST)
                    break;
            }                                      
        }
        outcolor = pow(glow * vec3(.4,1,.3) * (.2+syncs[ENV_0]),vec3(.4545)) + 
            texture(textSampler,            
                clamp(
                    u+vec2(syncs[TEXT_WIDTH]/2,.52),
                    vec2(0),
                    vec2(syncs[TEXT_WIDTH],1)
                )+vec2(syncs[TEXT_START],0)            
            ).rgb;
    }    
}
