#version 100
precision mediump float;

uniform sampler2D u_screen;
uniform sampler2D u_wind;
uniform float u_wind_spd_min;
uniform float u_wind_spd_max;
uniform float u_opacity;
uniform vec2 u_canvas_origin;
uniform vec2 u_canvas_size;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_time_fac;
varying vec2 v_tex_pos;

#include "includes/lookup_wind.glsl"

void main() {
    vec4 color = texture2D(u_screen, 1. - v_tex_pos);

    vec2 wind = lookup_wind(1.0 - v_tex_pos);
    vec2 velocity = mix(u_wind_min, u_wind_max, wind);
    float speed_t = length(velocity);

    float speed_opacity = smoothstep(0.0, 4.0, speed_t);

    gl_FragColor = vec4(color * (u_opacity - (0.001 * speed_opacity)));
}
