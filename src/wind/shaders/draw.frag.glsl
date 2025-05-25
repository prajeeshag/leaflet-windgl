#version 100
precision mediump float;

uniform sampler2D u_wind;
uniform vec2 u_canvas_origin;
uniform vec2 u_canvas_size;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform sampler2D u_color_ramp;
uniform float u_time_fac;
uniform float u_wind_spd_min;
uniform float u_wind_spd_max;

varying vec2 v_particle_pos;
varying float v_particle_age;
varying float v_valid;

#include "includes/lookup_wind.glsl"

void main() {
    vec2 wind = lookup_wind(v_particle_pos);
    vec2 velocity = mix(u_wind_min, u_wind_max, wind);
    float speed_t = clamp((length(velocity) - u_wind_spd_min) / (u_wind_spd_max - u_wind_spd_min), 0.0, 1.0);

    // color ramp is encoded in a 16x16 texture
    vec2 ramp_pos = vec2(fract(16.0 * speed_t), floor(16.0 * speed_t) / 16.0);

    vec4 color = texture2D(u_color_ramp, ramp_pos);
    gl_FragColor = vec4(color.rgb, color.a * (1.0 - v_particle_age)) * v_valid; // use age as alpha
}
