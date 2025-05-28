#version 100
precision highp float;

uniform float u_particleLength;
uniform float u_dropRate;

#include "updateInc.glsl"

void main() {
    float ageCounter = mod(floor(getAgeCounter(v_index) + 1.), u_particleLength * 0.9);
    float updateAge = 1. - clamp(ageCounter, 0., 1.);
    vec2 pos = getPos(v_index);
    vec2 pos1 = pos + getOffset(v_index);
    float dropRate = mix(u_dropRate, 1. - u_dropRate, isoutside(pos1));

    float age = getAge(v_index);
    float update0Age = floor(1. - fract(age));
    float prevAge = getAge(prevIndex());
    float age1 = fract(min(age + dropRate, 1.0));
    age1 = mix(age, age1, min(updateAge + update0Age, 1.0));

    age1 = mix(prevAge, age1, ishead());

    vec2 age_encoded = vec2(floor(age1 * 255.0) / 255.0, fract(age1 * 255.0));
    gl_FragColor = vec4(age_encoded, ageCounter / 255.0, 0.0); // encode age in RGBA
}
