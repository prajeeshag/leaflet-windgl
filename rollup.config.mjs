import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { default as glslOptimize } from 'rollup-plugin-glsl-optimize';
import resolve from '@rollup/plugin-node-resolve';

const buildConfigs = [
    {
        input: 'src/leaflet-windgl.ts',
        output: {
            file: 'dist/leaflet-windgl.js',
        },
    },
    {
        input: 'src/leaflet-timeslider.ts',
        output: {
            file: 'dist/leaflet-timeslider.js',
        },
    },
];

function createConfig({ input, output }) {
    return {
        input,
        output: {
            file: output.file,
            name: output.name,
            sourcemap: true,
        },
        plugins: [
            glslOptimize({
                include: ['src/**/*.glsl'],
                optimize: false,
                sourceMap: true,
            }),
            resolve(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: true,
                // declarationDir: 'dist/types',
            }),
        ],
        watch: {
            include: ['src/**', 'src/**/*.glsl'],
            clearScreen: true,
        },
    };
}

export default defineConfig(buildConfigs.map(createConfig));
