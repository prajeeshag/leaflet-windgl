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
uniform vec2 u_particles_res;
uniform float u_updateAge;

varying vec2 v_tex_pos;

#include "includes/lookup_wind.glsl"

void main() {
    float head = step(v_tex_pos.x, 1.0 / u_particles_res.x);
    vec2 shift_pos = vec2(v_tex_pos.x - 1.0 / u_particles_res.x, v_tex_pos.y);

    vec4 color = texture2D(u_particles, shift_pos);
    vec2 pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);

    vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(pos));
    float speed_age = 1. - smoothstep(0.0, 0.5, length(velocity));

    // float speed_age = 0.0;
    vec4 color1 = texture2D(u_particle_props, shift_pos);
    float age = (color1.r + color1.g / 255.0);

    age = mod(age, 1.0); // incoming age 1.0 means it jumped to a random position, set it to 0.0
    age = age + (u_drop_rate * speed_age + u_drop_rate) * head * u_updateAge; // add age based on speed
    age = min(age, 1.0); // clamp age to 1.0, if age is 1.0 it will jump to new position

    vec2 age_encoded = vec2(floor(age * 255.0) / 255.0, fract(age * 255.0));
    gl_FragColor = vec4(age_encoded, 0.0, 0.0); // encode age in RGBA
}
