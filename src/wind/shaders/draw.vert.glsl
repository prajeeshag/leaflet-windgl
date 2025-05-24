#version 100
precision mediump float;
attribute float a_index;

uniform vec2 u_particles_res;
uniform sampler2D u_particles;
uniform sampler2D u_particle_props;

varying vec2 v_particle_pos;
varying float v_particle_age;

vec2 getParticlePos(const vec2 coord) {
    vec4 color = texture2D(u_particles, coord);
    return vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);
}

float getParticleAge(const vec2 coord) {
    vec4 color = texture2D(u_particle_props, coord);
    return color.r + color.g / 255.0;
}

void main() {
    vec2 coord = vec2(fract(a_index / u_particles_res.x), floor(a_index / u_particles_res.x) / u_particles_res.y);
    v_particle_pos = getParticlePos(coord);
    v_particle_age = getParticleAge(coord);
    gl_PointSize = 4.;
    gl_Position = vec4(2.0 * v_particle_pos.x - 1.0, 1.0 - 2.0 * v_particle_pos.y, 0.0, 1.0);
}