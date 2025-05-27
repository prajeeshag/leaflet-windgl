#version 100
precision mediump float;

attribute vec2 a_index;

varying vec2 v_index;

void main() {
    v_index = a_index;
    gl_PointSize = 1.0;
    gl_Position = vec4(a_index * 2.0 - 1.0, 0.0, 1.0);
}
