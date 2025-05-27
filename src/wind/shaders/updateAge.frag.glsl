#version 100
precision highp float;

uniform float u_particleLength;
uniform float u_dropRate;

#include "updateInc.glsl"

void main() {
    float ageCounter = mod(floor(getAgeCounter(v_index) + 1.), u_particleLength);
    float updateAge = 1. - clamp(ageCounter, 0., 1.);

    float age = getAge(v_index);
    float update0Age = floor(1. - fract(age));
    float prevAge = getAge(prevIndex());
    float age1 = fract(min(age + u_dropRate, 1.0));
    age1 = mix(age, age1, updateAge + update0Age);

    vec2 pos1 = getPos(v_index) + getOffset(v_index) * ishead();
    age1 = mix(age1, 0.0, isoutside(pos1));
    // age1 = mix(age1, 0.0, 1.0);

    age1 = mix(prevAge, age1, ishead());

    vec2 age_encoded = vec2(floor(age1 * 255.0) / 255.0, fract(age1 * 255.0));
    gl_FragColor = vec4(age_encoded, ageCounter / 255.0, 0.0); // encode age in RGBA
}
