import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { string } from 'rollup-plugin-string';
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
            string({ include: 'src/**/*.glsl' }),
            resolve(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: true,
                declarationDir: 'dist/wind/types'
            }),
        ]
    },
    {
        input: 'src/leaflet-windgl.ts',
        output: {
            file: 'dist/leaflet-windgl.js',
            name: 'LeafletWindGL',
            sourcemap: true,
        },
        plugins: [
            string({ include: 'src/**/*.glsl' }),
            resolve(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: true,
                declarationDir: 'dist/types'
            }),
        ]
    }
]);