#version 100
precision mediump float;
attribute vec2 a_index;
attribute float a_role;

uniform vec2 u_particleTexRes;
uniform sampler2D u_particlePosTex;
uniform sampler2D u_particleAgeTex;

varying vec2 v_particlePos;
varying float v_particleAge;

vec2 getPos(const vec2 index) {
    vec4 color = texture2D(u_particlePosTex, index);
    return vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);
}

float getAge(const vec2 index) {
    vec4 color = texture2D(u_particleAgeTex, index);
    return color.r + color.g / 255.0;
}

void main() {
    vec2 pos = getPos(a_index);
    vec2 nextIndex = vec2(a_index.x + 1. / u_particleTexRes.x, a_index.y);
    vec2 posNext = getPos(nextIndex);

    float age = getAge(a_index);
    float ageNext = getAge(nextIndex);
    float collapse = (1. - step(ageNext, age)) * a_role; // for leading point check if collapsed
    pos = mix(pos, posNext, collapse);
    v_particleAge = age;
    v_particlePos = pos;
    gl_Position = vec4(2.0 * pos.x - 1.0, 1.0 - 2.0 * pos.y, 0.0, 1.0);
}