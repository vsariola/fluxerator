#version 430
#define w(a)mat2(cos(a),sin(a),-sin(a),cos(a))

// SYNCS - do not touch this line, will be replaced with sync definitions

uniform sampler2D textSampler;
layout(binding = 1) uniform sampler2D postSampler;
layout(location = 0) uniform float syncs[NUM_SYNCS];

out vec3 outcolor;

// ----------------------------
// when copying, copy from here
// ----------------------------

const float PI = 3.14159265358;
const float MINDIST = .0001;
const float MAXDIST = 125;
const int MAXSTEP = 160;

// globals
float t;
float res;
float h;
float z = syncs[CAM_ZPOS]*32;

vec3 path(float z) {
    return vec3(sin(vec2(z/11,z/5)+sin(vec2(z/7,z/9))*2)*syncs[PATH_MAG],z);
}

vec2 pModPolar(vec2 p, float r) {
    r = 6.28/r;
    r = mod(atan(p.y, p.x) + r/2,r)-r/2;
    return vec2(cos(r), sin(r))*length(p);
}

// -----------------------------
// when copying, copy up to here
// -----------------------------

void main()
{
    vec2 iResolution = vec2(@XRES@,@YRES@), u = 2*gl_FragCoord.xy-iResolution;
    const int n=10;
    vec3 rd = normalize(vec3(u/iResolution.y,1.8)), p = path(z),q=vec3(.5),s, glow;
    p.x += syncs[CAM_X];
    u/=iResolution;
    if (syncs[ROW]<0) {
	    for(int i=0;i<n;i++){
		    outcolor.r+=texture(postSampler,.5+u*q.r).r;
		    outcolor.g+=texture(postSampler,.5+u*q.g).g;
		    outcolor.b+=texture(postSampler,.5+u*q.b).b;
            q *= vec3(.999,.998,.996)*syncs[SCREEN_ZOOM];
	    }
        outcolor /= n;
    } else {
        if (abs(u.y) < syncs[SCREEN_CLIP]*.78) {
            // Roll-pitch-yaw rotations
            rd.xy *= w(syncs[CAM_ROLL]);
            rd.yz *= w(syncs[CAM_PITCH]);
            rd.xz *= w(syncs[CAM_YAW]);

            for(int i=0; i<MAXSTEP; i++) {                
                s = vec3((p.xy - path(p.z).xy)*w((p.z-z)*syncs[PATH_TWIST]),p.z);
                q = vec3(syncs[MIRROR_X],syncs[MIRROR_Y],0);
                s = s + q*abs(s) - s*abs(q);

                h = s.y + 1;

                q = s * 3;
                for(int i = 0; i<4; i++){
   	               h += abs(sin(q.x))*syncs[LANDSCAPE];
                   q.xz *= w(.6);
                }

                res=min(MAXDIST,h);

                q = abs(mod(s,4)-2);
	            q = max(q,q.yzx);
	            q = min(q,q.yzx);
	            h = min(q,q.yzx).x;

                res=min(res,h-.2+syncs[LATTICE_SIZE]);
                glow += .0003/(.003+h*h)*syncs[LATTICE_GLOW];

                h = syncs[TUNNEL_RADIUS]-length(s.xy);
                res=min(res,h);

                h = floor(p.z/4+.5);
                q.xy = pModPolar((s.xy-vec2(4 * mod(h,2)-2,2))*w(sin(h)*syncs[ROW]/8),8);
                q.z = mod(s.z+2,4)-2;

                h = length(q.yz)+.4-syncs[ENV_0]*.45+syncs[LASERS];
                res=min(res,h);
                glow += .00002/(.000003+h*h+syncs[LASERS]);

                q.xy = pModPolar(s.xy,syncs[TUNNEL_LIGHT_REP]);
                q.z = mod(s.z,1)-.5;

                h = length(q-vec3(syncs[TUNNEL_RADIUS],0,0))-.1;
                res=min(res,h);
                glow += .00002/(.000003+h*h+syncs[TUNNEL_LIGHTS])*max(syncs[ENV_2]*5-4,0);

                q = p - path(z+sin(syncs[ROW]*.4)+syncs[FRACTAL_Z]);
                q.xy *= w(syncs[ROW]/7);
                q.yz *= w(syncs[ROW]/9);

                s = q * 20;
                h = 20;
                for(int i = 0; i<4; i++) {
                   s -= clamp(s,-1,1) * 1.93;
                   h *= 17/dot(s,s); s *= 17/dot(s,s);
                }
                h = length(max(abs(s)/h-.07,0));
                res=min(res,h);

                q = abs(q);
                h = length(q-(q.z+q.y+q.z)/3.1)+.42-syncs[ENV_0]*.45;
                res=min(res,h);
                glow += .0002/(.0003+h*h) * vec3(1/syncs[FRACTAL_COLOR],syncs[FRACTAL_COLOR],1/syncs[FRACTAL_COLOR]);

                t += res/3;
                p += rd * res/3;
                if (abs(res)<t*MINDIST || t>MAXDIST)
                    break;
            }
        }
        outcolor = pow(glow * vec3(.4,1,.3) * (.3+syncs[ENV_0]),vec3(.4545)) +
            texture(textSampler,
                clamp(
                    u+vec2(syncs[TEXT_WIDTH]/2,.52),
                    vec2(0),
                    vec2(syncs[TEXT_WIDTH],1)
                )+vec2(syncs[TEXT_START],0)
            ).rgb;
    }
}
