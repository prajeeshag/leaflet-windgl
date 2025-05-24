
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

    vec2 getParticlePos(const vec2 coord, const sampler2D texture) {
        vec4 color = texture2D(texture, coord);
        return vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);
    }

    float getParticleAge(const vec2 coord, const sampler2D texture) {
        vec4 color = texture2D(texture, coord);
        return color.r + color.g / 255.0;
    }

    void main() {
        float p_index = floor(a_index / ${particleLength}.0);
        vec2 coord = vec2(fract(p_index / u_particles_res), floor(p_index / u_particles_res) / u_particles_res);

        float wgt_0 = 1.0 - min(mod((a_index + ${particleLength}.0 - 0.0), ${particleLength}.0), 1.0);
        vec2 v_particle_pos_0 = getParticlePos(coord, u_particles_0) * wgt_0; 
        float v_particle_age_0 = getParticleAge(coord, u_particle_props_0) * wgt_0;

        float wgt_1 = 1.0 - min(mod((a_index + ${particleLength}.0 - 1.0), ${particleLength}.0), 1.0);
        vec2 v_particle_pos_1 = getParticlePos(coord, u_particles_1) * wgt_1; 
        float v_particle_age_1 = getParticleAge(coord, u_particle_props_1) * wgt_1;

        v_particle_pos = v_particle_pos_0 + v_particle_pos_1;
        v_particle_age = v_particle_age_0 + v_particle_age_1;

        gl_PointSize = 1.;
        gl_Position = vec4(2.0 * v_particle_pos.x - 1.0, 1.0 - 2.0 * v_particle_pos.y, 0.0, 1.0);
    }
`
}