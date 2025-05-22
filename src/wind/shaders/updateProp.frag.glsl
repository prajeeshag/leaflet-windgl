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

#include "includes/lookup_wind.glsl"

void main() {
    vec4 color = texture2D(u_particles, v_tex_pos);
    vec2 pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a); // decode particle position from pixel RGBA
    vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(pos));
    // float speed_age = step(length(velocity), 0.5);
    // float speed_age = step(length(velocity), 3.0);
    float speed_age = 1. - smoothstep(0.0, 0.5, length(velocity) / length(u_wind_max));
    vec4 color1 = texture2D(u_particle_props, v_tex_pos);
    float age = (color1.r + color1.g / 255.0);
    age = age + u_drop_rate * speed_age + u_drop_rate * 0.001;
    age = age * step(0.0, 1.0 - age); // kill particles that are older than 1.0

    // encode the new particle position back into RGBA
    gl_FragColor = vec4(vec2(floor(age * 255.0) / 255.0, fract(age * 255.0)), 0, 0);
}
