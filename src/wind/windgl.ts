
import Util from './util';


import drawVert from './shaders/draw.vert.glsl';
// import { getDrawVertShader } from './shaders/drawVert';
import drawFrag from './shaders/draw.frag.glsl';

import quadVert from './shaders/quad.vert.glsl';

import screenFrag from './shaders/screen.frag.glsl';
import updateFrag from './shaders/update.frag.glsl';
import updatePropFrag from './shaders/updateProp.frag.glsl'

const defaultRampColors = {
    0.0: 'rgba(44,123,182,0.5)',    // blue
    0.1: 'rgba(0,166,202,0.7)',     // cyan
    0.2: 'rgba(0,204,188,0.8)',     // teal
    0.3: 'rgba(144,235,157,0.8)',   // light green
    0.5: 'rgba(255,255,140,0.9)',   // yellow
    0.7: 'rgba(249,208,87,1)',    // orange
    0.8: 'rgba(242,158,46,1)',    // orange-brown
    1.0: 'rgba(215,25,28,1)',     // red
};

// const defaultRampColors = {
//     0.0: 'rgba(250,250,250,0.3)', // transparent
//     1.0: 'rgba(250,250,250,0.8)', // transparent
// };

export default class WindGL {
    gl: WebGLRenderingContext
    fadeOpacity = 0.0; // how fast the particle trails fade on each frame
    speedFactor = 1.9; // how fast the particles move
    dropRate = 0.009; // how fast the particle will die off
    minSpeedColor = 1.0; // minimum color velocity
    maxSpeedColor = 15.0; // maximum color velocity
    private _particleLength: number = 30; // length of a particle with its tail
    private _particlesPerPixel: number = 0.02
    private _programs: { [key: string]: any } = {}
    private _quadBuffer: any;
    private _framebuffer!: WebGLFramebuffer;
    private _screenTexture!: [WebGLTexture, WebGLTexture];
    private _colorRampTexture: WebGLTexture;
    private _particleStateResolution!: number;
    private _numParticles!: number;
    private _particlePosTexture: WebGLTexture[] = []
    private _particlePropTexture: WebGLTexture[] = []
    private _particleIndexBuffer!: WebGLBuffer;
    private _windTextures: WindTexture
    private _windData: WindData;
    private _util: Util;
    private _timeFactor: number = 0.0;
    private _texIndex: number = 0;
    private _canvasOrigin: [number, number] = [0, 0]; //[x0,y0] canvas position relative to the wind data grid all normalized to [0,1]
    private _canvasSize: [number, number] = [0, 0]; //[x0,y0] canvas size relative to the wind data grid all normalized to [0,1]

    constructor(gl: WebGLRenderingContext, windData: WindData) {
        this.gl = gl;
        this._util = new Util(gl);
        console.log(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS))
        console.log(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS))
        // const drawVert = getDrawVertShader(1);
        console.log(drawVert);
        this._programs['draw'] = this._util.createProgram(drawVert, drawFrag);
        this._programs['screen'] = this._util.createProgram(quadVert, screenFrag);
        this._programs['update'] = this._util.createProgram(quadVert, updateFrag);
        this._programs['updateProp'] = this._util.createProgram(quadVert, updatePropFrag)

        this._quadBuffer = this._util.createBuffer(new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
        this._colorRampTexture = this._util.createTexture(this.gl.LINEAR, getColorRamp(defaultRampColors), 16, 16);

        this._windData = windData;
        this._windTextures = new WindTexture(windData, gl);

        // we create a square texture where each pixel will hold a particle position encoded as RGBA
        this.reset();
    }

    set particlesPerPixel(value: number) {
        value = Math.max(0.0, Math.min(1.0, value));
        this._particlesPerPixel = value;
        this.reset();
    }

    get particlesPerPixel(): number {
        return this._particlesPerPixel;
    }

    private _initParticles() {
        const particlesPerPixel = this._particlesPerPixel;
        const gl = this.gl;
        const numParticles = Math.floor(particlesPerPixel * gl.canvas.width * gl.canvas.height);
        // const numParticles = 16;  // for testing purposes, we use a fixed number of particles
        const particleRes = this._particleStateResolution = Math.floor(Math.sqrt(numParticles));
        this._numParticles = particleRes * particleRes;
        const numParticlesRGBA = this._numParticles * 4;
        // two sets of rgba texture, first for position, second for properties
        const particleState = new Uint8Array(numParticlesRGBA);
        const particleProp = new Uint8Array(numParticlesRGBA);
        for (let i = 0; i < numParticlesRGBA; i++) {
            particleState[i] = Math.floor(Math.random() * 256); // randomize the initial particle positions
        }
        for (let i = 0; i < numParticlesRGBA; i++) {
            particleProp[i] = 0; // initial particle age
        }
        for (let i = 0; i < this._particlePosTexture.length; i++) {
            gl.deleteTexture(this._particlePosTexture[i]!)
        }
        this._particlePosTexture.length = 0;
        for (let i = 0; i < this._particleLength; i++) {
            this._particlePosTexture.push(
                this._util.createTexture(gl.NEAREST, particleState, particleRes, particleRes),
            );
        }

        for (let i = 0; i < this._particlePropTexture.length; i++) {
            gl.deleteTexture(this._particlePropTexture[i]!)
        }
        this._particlePropTexture.length = 0;
        for (let i = 0; i < this._particleLength; i++) {
            this._particlePropTexture.push(
                this._util.createTexture(gl.NEAREST, particleState, particleRes, particleRes),
            );
        }

        const pointIndices = new Float32Array(this._numParticles);
        for (let i = 0; i < this._numParticles; i++) pointIndices[i] = i;
        if (this._particleIndexBuffer) {
            gl.deleteBuffer(this._particleIndexBuffer);
        }
        this._particleIndexBuffer = this._util.createBuffer(pointIndices);
    }

    private _initScreenTexture() {
        const gl = this.gl;
        const emptyPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
        // First delete the old texture
        if (this._screenTexture) {
            gl.deleteTexture(this._screenTexture[0]);
            gl.deleteTexture(this._screenTexture[1]);
        }
        this._screenTexture = [
            this._util.createTexture(gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height),
            this._util.createTexture(gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height)
        ]
    }

    reset() {
        if (this._framebuffer) {
            this.gl.deleteFramebuffer(this._framebuffer);
        }
        this._framebuffer = this.gl.createFramebuffer();
        this._initParticles();
        this._initScreenTexture();
    }

    setCanvasPos(x0: number, y0: number, width: number, height: number) {
        this._canvasOrigin = [x0, y0];
        this._canvasSize = [width, height];
    }

    draw(timeStep: number) {
        var dt = Math.min(Math.max(0.0, Math.min(0.99999, timeStep)) * this._windTextures.ntex, this._windTextures.ntex);
        this._texIndex = Math.floor(dt);
        this._timeFactor = dt - this._texIndex;
        const gl = this.gl;
        // console.log(this._tex_index, this._time_factor);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        this._drawScreen();
        this._updateParticleProp();
        this._updateParticlePos();
    }

    private _drawScreen() {
        const gl = this.gl;
        // draw the screen into a temporary framebuffer to retain it as the background on the next frame
        this._util.bindFramebuffer(this._framebuffer, this._screenTexture[0]);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        // this._drawTexture(this._screenTexture[1], this.fadeOpacity);
        this._drawParticles();

        this._util.bindFramebuffer(null);
        // enable blending to support drawing on top of an existing background (e.g. a map)
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this._drawTexture(this._screenTexture[0], 1.0);
        gl.disable(gl.BLEND);
        // this._screenTexture.reverse()
    }

    private _drawTexture(texture: WebGLTexture, opacity: number) {
        const gl = this.gl;
        const program = this._programs.screen;
        gl.useProgram(program.program);
        const windTex = this._windTextures.textures[this._texIndex];
        gl.uniform1f(program.u_time_fac, this._timeFactor);
        gl.uniform2f(program.u_wind_res, this._windData.width, this._windData.height);
        gl.uniform2f(program.u_canvas_origin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvas_size, this._canvasSize[0], this._canvasSize[1]);

        this._util.bindTexture(program.u_wind, windTex!)
        this._util.bindAttribute(this._quadBuffer, program.a_pos, 2);
        this._util.bindTexture(program.u_screen, texture)
        gl.uniform1f(program.u_opacity, opacity);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    private _drawParticles() {
        const gl = this.gl;
        const program = this._programs.draw;
        gl.useProgram(program.program);
        const windTex = this._windTextures.textures[this._texIndex];
        this._util.bindAttribute(this._particleIndexBuffer, program.a_index, 1);

        this._util.bindTexture(program.u_wind, windTex!)
        gl.uniform1f(program.u_time_fac, this._timeFactor);
        gl.uniform2f(program.u_canvas_origin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvas_size, this._canvasSize[0], this._canvasSize[1]);
        gl.uniform1f(program.u_particles_res, this._particleStateResolution);
        gl.uniform2f(program.u_wind_min, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_wind_max, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_wind_spd_min, this.minSpeedColor);
        gl.uniform1f(program.u_wind_spd_max, this.maxSpeedColor);
        this._util.bindTexture(program.u_color_ramp, this._colorRampTexture)
        const particleLen = this._particleLength;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        for (let i = 0; i < particleLen; i++) {
            this._util.bindTexture(program[`u_particles`], this._particlePosTexture[particleLen - 1 - i]!);
            this._util.bindTexture(program[`u_particle_props`], this._particlePropTexture[particleLen - 1 - i]!);
            gl.drawArrays(gl.POINTS, 0, this._numParticles);
        }
        gl.disable(gl.BLEND);
    }

    private _updateParticlePos() {
        const gl = this.gl;
        const newHeadTex = this._particlePosTexture.shift();
        this._util.bindFramebuffer(this._framebuffer, newHeadTex!);
        gl.viewport(0, 0, this._particleStateResolution, this._particleStateResolution);

        const program = this._programs.update;
        const windTex = this._windTextures.textures[this._texIndex];
        if (!windTex) {
            throw new Error('Wind texture not found');
        }
        gl.useProgram(program.program);
        this._util.bindAttribute(this._quadBuffer, program.a_pos, 2);

        this._util.bindTexture(program.u_wind, windTex)
        this._util.bindTexture(program.u_particles, this._particlePosTexture[this._particlePosTexture.length - 1]!)
        this._util.bindTexture(program.u_particle_props, this._particlePropTexture[this._particlePropTexture.length - 1]!)

        gl.uniform1f(program.u_time_fac, this._timeFactor);
        gl.uniform1f(program.u_rand_seed, Math.random());
        gl.uniform2f(program.u_wind_res, this._windData.width, this._windData.height);
        gl.uniform2f(program.u_canvas_origin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvas_size, this._canvasSize[0], this._canvasSize[1]);
        gl.uniform2f(program.u_wind_min, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_wind_max, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_speed_factor, this.speedFactor);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this._particlePosTexture.push(newHeadTex!);
    }

    private _updateParticleProp() {
        const gl = this.gl;
        const newHeadTex = this._particlePropTexture.shift();
        this._util.bindFramebuffer(this._framebuffer, newHeadTex!);
        gl.viewport(0, 0, this._particleStateResolution, this._particleStateResolution);

        const program = this._programs.updateProp;
        const windTex = this._windTextures.textures[this._texIndex];
        gl.useProgram(program.program);

        this._util.bindAttribute(this._quadBuffer, program.a_pos, 2);

        this._util.bindTexture(program.u_wind, windTex!)
        this._util.bindTexture(program.u_particles, this._particlePosTexture[this._particlePosTexture.length - 1]!)
        this._util.bindTexture(program.u_particle_props, this._particlePropTexture[this._particlePropTexture.length - 1]!)
        gl.uniform1f(program.u_time_fac, this._timeFactor);
        gl.uniform2f(program.u_wind_res, this._windData.width, this._windData.height);
        gl.uniform2f(program.u_canvas_origin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvas_size, this._canvasSize[0], this._canvasSize[1]);
        gl.uniform2f(program.u_wind_min, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_wind_max, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_wind_speed_min, this._windData.uMin);
        gl.uniform1f(program.u_wind_speed_max, this._windData.uMax);
        gl.uniform1f(program.u_drop_rate, this.dropRate);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this._particlePropTexture.push(newHeadTex!);
    }
}

function getColorRamp(colors: { [x: string]: string; }) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get canvas context');
    }

    canvas.width = 256;
    canvas.height = 1;

    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    for (const stop in colors) {
        const color = colors[stop];
        if (typeof color === 'string') {
            gradient.addColorStop(+stop, color);
        }
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);
    return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
}

export class WindData {
    uwind: Uint8Array;
    vwind: Uint8Array;
    width: number;
    height: number;
    uMin: number;
    vMin: number;
    uMax: number;
    vMax: number;
    ntime: number;
    constructor(
        uwind: Uint8Array,
        vwind: Uint8Array,
        uwindMinMax: [number, number],
        vwindMinMax: [number, number],
        width: number,
        height: number,
        ntime: number = 1
    ) {
        // some sanity checks
        if (uwind.length !== vwind.length) {
            throw new Error('U and V wind arrays must be the same length');
        }
        if (uwind.length !== width * height * ntime) {
            throw new Error('Wind arrays length must be equal to width * height * ntime');
        }
        this.width = width;
        this.height = height;
        this.ntime = ntime;
        this.uMin = uwindMinMax[0]
        this.uMax = uwindMinMax[1]
        this.vMin = vwindMinMax[0]
        this.vMax = vwindMinMax[1]
        this.uwind = uwind;
        this.vwind = vwind;
    }
}

class WindTexture {
    textures: WebGLTexture[] = [];
    uMin: number;
    vMin: number;
    uMax: number;
    vMax: number;
    height: number;
    width: number;
    ntex: number;
    constructor(windData: WindData, gl: WebGLRenderingContext) {
        const uwind = windData.uwind;
        const vwind = windData.vwind;
        this.width = windData.width;
        this.height = windData.height;
        this.uMin = windData.uMin;
        this.uMax = windData.uMax;
        this.vMin = windData.vMin;
        this.vMax = windData.vMax;

        this.ntex = windData.ntime - 1;
        if (windData.ntime === 1) {
            this.ntex = 1;
        }

        const util = new Util(gl);
        const wh = this.width * this.height;
        for (let t = 0; t < this.ntex; t++) {
            const t1 = t
            var t2 = t + 1;
            if (this.ntex === 1) {
                t2 = t;
            }
            const uwind1 = uwind.subarray(t1 * wh, (t1 + 1) * wh);
            const vwind1 = vwind.subarray(t1 * wh, (t1 + 1) * wh);
            const uwind2 = uwind.subarray(t2 * wh, (t2 + 1) * wh);
            const vwind2 = vwind.subarray(t2 * wh, (t2 + 1) * wh);
            const windArray = new Uint8Array(wh * 4);
            for (let i = 0; i < wh; i++) {
                const u1 = uwind1[i] ?? 0;
                const v1 = vwind1[i] ?? 0;
                const u2 = uwind2[i] ?? 0;
                const v2 = vwind2[i] ?? 0;
                windArray[i * 4] = u1
                windArray[i * 4 + 1] = v1;
                windArray[i * 4 + 2] = u2;
                windArray[i * 4 + 3] = v2;
            }
            const texture = util.createTexture(gl.LINEAR, windArray, windData.width, windData.height);
            this.textures.push(texture);
        }
    }
}


