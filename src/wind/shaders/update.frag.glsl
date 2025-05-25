#version 100
precision highp float;

uniform sampler2D u_particles;
uniform sampler2D u_particle_props;
uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_canvas_origin;
uniform vec2 u_canvas_size;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_rand_seed;
uniform float u_speed_factor;
uniform float u_time_fac;
uniform vec2 u_particles_res;

varying vec2 v_tex_pos;

// pseudo-random generator
const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

#include "includes/lookup_wind.glsl"

void main() {
    float head = step(v_tex_pos.x, 1.0 / u_particles_res.x);
    vec2 shift_pos = vec2(v_tex_pos.x - 1.0 / u_particles_res.x, v_tex_pos.y);

    vec4 color = texture2D(u_particles, shift_pos);
    vec2 pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a); // decode particle position from pixel RGBA

    color = texture2D(u_particle_props, v_tex_pos);
    float age = color.r + color.g / 255.0;

    vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(pos));
    float speed_t = length(velocity) / length(u_wind_max);

    // take EPSG:4236 distortion into account for calculating where the particle moved
    //float distortion = cos(radians(pos.y * 180.0 - 90.0));
    // float distortion = 1.0;
    vec2 offset = vec2(velocity.x, -velocity.y) * 0.0001 * u_speed_factor;

    // update particle position, wrapping around the date line
    // pos = fract(1.0 + pos + offset);
    pos = pos + offset * head;

    pos = clamp(pos, 0.0, 1.0); // clamp position to [0, 1] range

    // a random seed to use for the particle drop
    vec2 seed = (pos + v_tex_pos) * u_rand_seed;

    float drop = floor(age);
    vec2 random_pos = vec2(rand(seed + 1.3), rand(seed + 2.1));

    pos = mix(pos, random_pos, drop * head);

    // encode the new particle position back into RGBA
    gl_FragColor = vec4(fract(pos * 255.0), floor(pos * 255.0) / 255.0);
}
