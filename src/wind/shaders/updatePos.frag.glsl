#version 100
precision highp float;

#include "updateInc.glsl"

void main() {
    vec2 pos = getPos(v_index);
    float age = getAge(v_index);
    vec2 posPrev = getPos(prevIndex());

    vec2 pos1 = pos + getOffset(pos) * ishead(); // update pos based of wind field only for head
    pos1 = mix(pos1, pos, isoutside(pos1)); // if updated pos is outside keep the old

    float drop = floor(1. - getAge(v_index)) * ishead();
    vec2 randomPos = getRandPos(pos, v_index);
    pos1 = mix(pos1, randomPos, drop); // jump to a new random position if age is 0 and if it is head
    // pos1 = mix(pos1, randomPos, isoutside(pos1)); // if updated pos is outside keep the old

    pos1 = mix(posPrev, pos1, ishead()); // just copy the previous position if this is not the head particle

    gl_FragColor = vec4(fract(pos1 * 255.0), floor(pos1 * 255.0) / 255.0);
}
