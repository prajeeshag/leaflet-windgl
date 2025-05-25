#version 100
precision mediump float;
attribute vec2 a_index;

uniform vec2 u_particles_res;
uniform sampler2D u_particles;
uniform sampler2D u_particle_props;

varying vec2 v_particle_pos;
varying float v_particle_age;
varying float v_valid;

vec2 getParticlePos(const vec2 coord) {
    vec4 color = texture2D(u_particles, coord);
    return vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);
}

float getParticleAge(const vec2 coord) {
    vec4 color = texture2D(u_particle_props, coord);
    return color.r + color.g / 255.0;
}

void main() {
    vec2 tail_index = vec2(a_index.x + 1.0 / u_particles_res.x, a_index.y);
    vec2 head_index = vec2(a_index.x - 1.0 / u_particles_res.x, a_index.y);
    v_particle_pos = getParticlePos(a_index);
    vec2 tail_particle_pos = getParticlePos(tail_index);

    v_particle_age = getParticleAge(a_index);
    float tail_particle_age = getParticleAge(tail_index);
    float alive = step(tail_particle_age, v_particle_age);
    v_valid = alive; 
    // gl_PointSize = 1.0;
    gl_Position = vec4(2.0 * v_particle_pos.x - 1.0, 1.0 - 2.0 * v_particle_pos.y, 0.0, 1.0);
}