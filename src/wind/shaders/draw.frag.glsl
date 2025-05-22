#version 100
precision mediump float;

uniform sampler2D u_wind;
uniform vec2 u_canvas_origin;
uniform vec2 u_canvas_size;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform sampler2D u_color_ramp;
uniform float u_time_fac;

varying vec2 v_particle_pos;
varying float v_particle_age;

#include "includes/lookup_wind.glsl"

void main() {
    vec2 wind = lookup_wind(v_particle_pos);
    vec2 velocity = mix(u_wind_min, u_wind_max, wind);
    float speed_t = length(velocity) / length(u_wind_max);

    // color ramp is encoded in a 16x16 texture
    vec2 ramp_pos = vec2(fract(16.0 * speed_t), floor(16.0 * speed_t) / 16.0);

    vec4 color = texture2D(u_color_ramp, ramp_pos);
    gl_FragColor = vec4(color.rgb, 0.9);
}
