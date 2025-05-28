#version 100
precision mediump float;

uniform vec2 u_canvasSize;
uniform vec2 u_canvasOrigin;
uniform sampler2D u_windTex;
uniform float u_timeFac;
uniform vec2 u_windMin;
uniform vec2 u_windMax;
uniform float u_windSpdMin;
uniform float u_windSpdMax;
uniform sampler2D u_colorRamp;

varying vec2 v_tex_pos;

#include "includes/lookup_wind.glsl"

void main() {
    vec2 velocity = mix(u_windMin, u_windMax, lookup_wind(vec2(1. - v_tex_pos.x, v_tex_pos.y)));
    float speed_t = clamp((length(velocity) - u_windSpdMin) / (u_windSpdMax - u_windSpdMin), 0.0, 1.0);
    vec2 ramp_pos = vec2(fract(16.0 * speed_t), floor(16.0 * speed_t) / 16.0);
    vec4 color = texture2D(u_colorRamp, ramp_pos);
    gl_FragColor = color;
}
