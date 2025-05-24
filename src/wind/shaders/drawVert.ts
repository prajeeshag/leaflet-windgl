
export function getDrawVertShader(particleLength: number) {

    var particleUniformDef = ""
    for (let i = 0; i < particleLength; i++) {
        particleUniformDef += `uniform sampler2D u_particles_${i};\nuniform sampler2D u_particle_props_${i};\n`;
    }

    return `#version 100
    precision mediump float;
    attribute float a_index;
    uniform float u_particles_res;

    ${particleUniformDef}

    varying vec2 v_particle_pos;
    varying float v_particle_age;

    void main() {
        vec2 coord = vec2(fract(a_index / u_particles_res), floor(a_index / u_particles_res) / u_particles_res);
        vec4 color = texture2D(u_particles_0, coord);
        // decode current particle position from the pixel's RGBA value
        v_particle_pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);
        color = texture2D(u_particle_props_0, coord);
        v_particle_age = color.r + color.g / 255.0;
        gl_PointSize = 1.;
        gl_Position = vec4(2.0 * v_particle_pos.x - 1.0, 1.0 - 2.0 * v_particle_pos.y, 0, 1);
    }
`
}