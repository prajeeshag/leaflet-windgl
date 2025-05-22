#version 100
precision mediump float;

uniform sampler2D u_screen;
uniform sampler2D u_wind;
uniform float u_wind_spd_min;
uniform float u_wind_spd_max;
uniform float u_opacity;
uniform vec2 u_canvas_origin;
uniform vec2 u_canvas_size;
uniform float u_time_fac;
varying vec2 v_tex_pos;

#include "includes/lookup_wind.glsl"

void main() {
    vec4 color = texture2D(u_screen, 1. - v_tex_pos);

    float wind_speed = length(lookup_wind(1.0 - v_tex_pos));

    wind_speed = (wind_speed - u_wind_spd_min) / (u_wind_spd_max - u_wind_spd_min);
    float wind = smoothstep(0.3, 0.7, wind_speed);

    gl_FragColor = vec4(color * (u_opacity - (0.001 * (1. - wind))));
}
