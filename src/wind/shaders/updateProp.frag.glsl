#version 100
precision mediump float;

uniform float u_drop_rate;
uniform float u_time_fac;
uniform vec2 u_wind_res;
uniform vec2 u_wind_max;
uniform vec2 u_wind_min;
uniform vec2 u_canvas_origin;
uniform vec2 u_canvas_size;
uniform sampler2D u_wind;
uniform sampler2D u_particle_props;
uniform sampler2D u_particles;

varying vec2 v_tex_pos;

#include "lookup_wind.glsl"

void main() {
    vec4 color = texture2D(u_particles, v_tex_pos);
    vec2 pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a); // decode particle position from pixel RGBA
    vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(pos));
    // float speed_age = step(length(velocity), 0.5);
    float speed_age = 1. / max(length(velocity), 0.000001);
    vec4 color1 = texture2D(u_particle_props, v_tex_pos);
    float age = (color1.r + color1.g / 255.0) + u_drop_rate + (0.01 * speed_age);
    age = age * step(0.0, 1.0 - age);

    // encode the new particle position back into RGBA
    gl_FragColor = vec4(vec2(floor(age * 255.0) / 255.0, fract(age * 255.0)), 0, 0);
}
