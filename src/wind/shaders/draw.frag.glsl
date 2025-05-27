#version 100
precision mediump float;

uniform sampler2D u_windTex;
uniform vec2 u_canvasOrigin;
uniform vec2 u_canvasSize;
uniform vec2 u_windMin;
uniform vec2 u_windMax;
uniform sampler2D u_colorRamp;
uniform float u_timeFac;
uniform float u_windSpdMin;
uniform float u_windSpdMax;

varying vec2 v_particlePos;
varying float v_particleAge;

#include "includes/lookup_wind.glsl"

void main() {
    vec2 wind = lookup_wind(v_particlePos);
    vec2 velocity = mix(u_windMin, u_windMax, wind);
    float speed_t = clamp((length(velocity) - u_windSpdMin) / (u_windSpdMax - u_windSpdMin), 0.0, 1.0);

    // color ramp is encoded in a 16x16 texture
    vec2 ramp_pos = vec2(fract(16.0 * speed_t), floor(16.0 * speed_t) / 16.0);

    vec4 color = texture2D(u_colorRamp, ramp_pos);
    gl_FragColor = vec4(color.rgb, color.a * max((1.0 - v_particleAge), 0.2));
}
