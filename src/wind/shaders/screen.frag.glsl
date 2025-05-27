#version 100
precision mediump float;

uniform sampler2D u_screen;
uniform float u_opacity;

varying vec2 v_tex_pos;

void main() {
    vec4 color = texture2D(u_screen, 1. - v_tex_pos);
    gl_FragColor = vec4(color * u_opacity);
}
