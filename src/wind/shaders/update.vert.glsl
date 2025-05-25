#version 100
precision mediump float;

attribute vec2 a_index;

uniform vec2 u_particles_res;

varying vec2 v_tex_pos;

void main() {
    v_tex_pos = a_index;
    gl_PointSize = 1.0;
    gl_Position = vec4(v_tex_pos * 2.0 - 1.0, 0.0, 1.0);
}
