import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { default as glslOptimize } from 'rollup-plugin-glsl-optimize';
import resolve from '@rollup/plugin-node-resolve';

export default defineConfig([
    {
        input: 'src/wind/windgl.ts',
        output: {
            file: 'dist/wind/windgl.js',
            name: 'WindGL',
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
                declarationDir: 'dist/wind/types',
            }),
        ],
        watch: {
            include: 'src/**',
            clearScreen: true,
        },
    },
    {
        input: 'src/leaflet-windgl.ts',
        output: {
            file: 'dist/leaflet-windgl.js',
            name: 'LeafletWindGL',
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
                declarationDir: 'dist/types',
            }),
        ],
        watch: {
            include: ['src/**', 'src/**/*.glsl'],
            clearScreen: true,
        },
    },
]);