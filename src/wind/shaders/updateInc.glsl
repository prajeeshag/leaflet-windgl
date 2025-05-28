uniform sampler2D u_particlePosTex;
uniform sampler2D u_particleAgeTex;
uniform sampler2D u_windTex;

uniform vec2 u_windMin;
uniform vec2 u_windMax;
uniform vec2 u_windRes;

uniform vec2 u_canvasOrigin;
uniform vec2 u_canvasSize;

uniform float u_randSeed;
uniform float u_speedFactor;
uniform float u_timeFac;
uniform vec2 u_particleTexRes;

varying vec2 v_index;

// pseudo-random generator
#include "includes/lookup_wind.glsl"

const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

vec2 getPos(const vec2 index) {
    vec4 color = texture2D(u_particlePosTex, index);
    return vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a); // decode particle position from pixel RGBA
}

float getAge(const vec2 index) {
    vec4 color = texture2D(u_particleAgeTex, index);
    return color.r + color.g / 255.0; // decode particle age from pixel RGBA
}

float getAgeCounter(const vec2 index) {
    vec4 color = texture2D(u_particleAgeTex, index);
    return color.b * 255.0; // decode particle age from pixel RGBA
}

float isoutside(const vec2 pos) {
    return min(step(1.0, abs(pos.x * 2. - 1.)) + step(1.0, abs(pos.y * 2. - 1.)), 1.0);
}

vec2 getRandPos(const vec2 pos, const vec2 index) {
    vec2 seed = (pos + index) * u_randSeed;
    return vec2(rand(seed + 1.3), rand(seed + 2.1));
}

vec2 getVelocity(const vec2 pos) {
    return mix(u_windMin, u_windMax, lookup_wind(pos));
}

vec2 getOffset(const vec2 pos) {
    vec2 velocity = mix(u_windMin, u_windMax, lookup_wind(pos));
    return vec2(velocity.x, -velocity.y) * 0.0001 * u_speedFactor;
}

vec2 prevIndex() {
    return vec2(v_index.x - 1.0 / u_particleTexRes.x, v_index.y);
}

float ishead() {
    return step(v_index.x, 1.0 / u_particleTexRes.x);
}