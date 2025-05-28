import Util from './util';


import drawVert from './shaders/draw.vert.glsl';
// import { getDrawVertShader } from './shaders/drawVert';
import drawFrag from './shaders/draw.frag.glsl';

import quadVert from './shaders/quad.vert.glsl';
import screenFrag from './shaders/screen.frag.glsl';

import updateVert from './shaders/update.vert.glsl';
import updatePosFrag from './shaders/updatePos.frag.glsl';
import updateAgeFrag from './shaders/updateAge.frag.glsl'

// const defaultRampColors = {
//     0.0: 'rgba(44,123,182,0.5)',    // blue
//     0.1: 'rgba(0,166,202,0.7)',     // cyan
//     0.2: 'rgba(0,204,188,0.8)',     // teal
//     0.3: 'rgba(144,235,157,0.8)',   // light green
//     0.5: 'rgba(255,255,140,0.9)',   // yellow
//     0.7: 'rgba(249,208,87,1)',    // orange
//     0.8: 'rgba(242,158,46,1)',    // orange-brown
//     1.0: 'rgba(215,25,28,1)',     // red
// };

const defaultRampColors = {
    0.0: 'rgba(250,250,250,0.1)', // transparent
    1.0: 'rgba(250,250,250,0.7)', // transparent
}

// const defaultRampColors = {
//     0.0: 'rgba(250,250,250,1)', // transparent
//     1.0: 'rgba(250,250,250,1)', // transparent
// };

export default class WindGL {
    gl: WebGLRenderingContext
    fadeOpacity = 0.997; // how fast the particle trails fade on each frame
    speedFactor = 3.5; // how fast the particles move
    dropRate = 0.09; // how fast the particle will die off
    minSpeedColor = 1.0; // minimum color velocity
    maxSpeedColor = 15.0; // maximum color velocity
    private _particleLength: number = 70; // length of a particle with its tail
    private _pointsPerPixel: number = 0.5
    private _programs: { [key: string]: any } = {}
    private _quadBuffer: any;
    private _framebuffer!: WebGLFramebuffer;
    private _screenTexture!: [WebGLTexture, WebGLTexture];
    private _colorRampTexture: WebGLTexture;
    private _particleTexRes!: [number, number];
    private _numParticles!: number;
    private _particlePosTex: { read: WebGLTexture, write: WebGLTexture } | null = null; // this will hold the particle positions
    private _particleAgeTex: { read: WebGLTexture, write: WebGLTexture } | null = null; // this will hold the particle properties (e.g. age)
    private _particleCoordBuffer!: WebGLBuffer; // this will hold the particle coordinates
    private _windTextures: WindTexture
    private _windData: WindData;
    private _util: Util;
    private _timeFac: number = 0.0;
    private _texIndex: number = 0;
    private _canvasOrigin: [number, number] = [0, 0]; //[x0,y0] canvas position relative to the wind data grid all normalized to [0,1]
    private _canvasSize: [number, number] = [0, 0]; //[x0,y0] canvas size relative to the wind data grid all normalized to [0,1]
    private _lineCoordBuffer!: WebGLBuffer;
    private _lineRoleBuffer!: WebGLBuffer;
    private _currentOpacity!: number

    constructor(gl: WebGLRenderingContext, windData: WindData) {
        this.gl = gl;
        this._util = new Util(gl);
        this._programs['draw'] = this._util.createProgram(drawVert, drawFrag);
        this._programs['screen'] = this._util.createProgram(quadVert, screenFrag);
        this._programs['updatePos'] = this._util.createProgram(updateVert, updatePosFrag);
        this._programs['updateAge'] = this._util.createProgram(updateVert, updateAgeFrag)

        this._colorRampTexture = this._util.createTexture(this.gl.LINEAR, getColorRamp(defaultRampColors), 16, 16);

        this._windData = windData;
        this._windTextures = new WindTexture(windData, gl);

        this.reset();
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


    private _initParticles() {
        const pointsPerPixel = this._pointsPerPixel;
        const gl = this.gl;
        const numParticles = Math.min(Math.floor((pointsPerPixel * gl.canvas.width * gl.canvas.height) / this._particleLength), gl.getParameter(gl.MAX_TEXTURE_SIZE));
        // const numParticles = 50;  // for testing purposes, we use a fixed number of particles
        this._numParticles = numParticles;
        this._particleTexRes = [this._particleLength, numParticles]
        const particleRes = this._particleTexRes;
        const width = this._particleTexRes[0];
        const height = this._particleTexRes[1];
        // two sets of rgba texture, first for position, second for properties
        const particlePos = new Uint8Array(this._numPoints() * 4);
        const particleAge = new Uint8Array(this._numPoints() * 4); // age, ageUpdateCounter

        const pos = new Uint8Array(4)
        const age = new Uint8Array(4)
        for (let j = 0; j < height; j++) {
            for (let k = 0; k < 4; k++) {
                pos[k] = Math.floor(Math.random() * 256.);
                age[k] = Math.floor((Math.random() + 0.01) * 256.); // hack to avoid zero age at initial time
            }
            for (let i = 0; i < width; i++) {
                for (let k = 0; k < 4; k++) {
                    particlePos[(j * width + i) * 4 + k] = pos[k]!
                    // particlePos[(j * width + i) * 4 + k] = Math.floor(Math.random() * 256.);
                    particleAge[(j * width + i) * 4 + k] = age[k]!
                    // particleAge[(j * width + i) * 4 + k] = Math.floor(0.01 * 256)
                }
            }
        }

        if (this._particlePosTex !== null) {
            gl.deleteTexture(this._particlePosTex.read)
            gl.deleteTexture(this._particlePosTex.write)
        }
        if (this._particleAgeTex !== null) {
            gl.deleteTexture(this._particleAgeTex.read)
            gl.deleteTexture(this._particleAgeTex.write)
        }

        this._particlePosTex = {
            read: this._util.createTexture(gl.NEAREST, particlePos, particleRes[0], particleRes[1]),
            write: this._util.createTexture(gl.NEAREST, particlePos, particleRes[0], particleRes[1])
        }
        this._particleAgeTex = {
            read: this._util.createTexture(gl.NEAREST, particleAge, particleRes[0], particleRes[1]),
            write: this._util.createTexture(gl.NEAREST, particleAge, particleRes[0], particleRes[1])
        }

        const particleCount = width * height;
        const a_pos = new Float32Array(particleCount * 2);
        let i = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                a_pos[i++] = (x + 0.5) / width;  // center of texel in X
                a_pos[i++] = (y + 0.5) / height; // center of texel in Y
            }
        }
        if (this._particleCoordBuffer) {
            gl.deleteBuffer(this._particleCoordBuffer);
        }
        this._particleCoordBuffer = this._util.createBuffer(a_pos);

        const lineCount = (width - 1) * height;
        const l_pos = new Float32Array(lineCount * 2 * 2);
        const l_role = new Float32Array(lineCount * 2);
        i = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width - 1; x++) {
                l_pos[i++] = (x + 0.5) / width;  // center of texel in X
                l_pos[i++] = (y + 0.5) / height; // center of texel in Y
                l_pos[i++] = (x + 1.5) / width;  // center of texel in X
                l_pos[i++] = (y + 0.5) / height; // center of texel in Y
            }
        }

        i = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width - 1; x++) {
                l_role[i++] = 1; // first point in segment 
                l_role[i++] = 0; // second point in segment
            }
        }
        if (this._lineCoordBuffer) {
            gl.deleteBuffer(this._lineCoordBuffer);
        }
        this._lineCoordBuffer = this._util.createBuffer(l_pos);
        if (this._lineRoleBuffer) {
            gl.deleteBuffer(this._lineRoleBuffer);
        }
        this._lineRoleBuffer = this._util.createBuffer(l_role);
    }

    private _initScreenTexture() {
        const gl = this.gl;
        if (gl.isBuffer(this._quadBuffer)) {
            this.gl.deleteBuffer(this._quadBuffer);
        }
        this._quadBuffer = this._util.createBuffer(new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
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

    private _numPoints(): number {
        return this._numParticles * this._particleLength;
    }

    private _numSegments(): number {
        return this._numParticles * 2 * (this._particleLength - 1);
    }

    draw(timeStep: number) {
        var dt = Math.min(Math.max(0.0, Math.min(0.99999, timeStep)) * this._windTextures.ntex, this._windTextures.ntex);
        this._texIndex = Math.floor(dt);
        const prevTimeFac = this._timeFac;
        this._timeFac = dt - this._texIndex;
        this._currentOpacity = this.fadeOpacity * (this._timeFac !== prevTimeFac ? 0.996 : 1.0);
        const gl = this.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);

        this._drawScreen();
        this._updateParticleAge();
        this._updateParticlePos();
    }

    private _drawScreen() {
        const gl = this.gl;
        // draw the screen into a temporary framebuffer to retain it as the background on the next frame
        this._util.bindFramebuffer(this._framebuffer, this._screenTexture[0]);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.clearColor(0.5, 0.5, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

        this._drawTexture(this._screenTexture[1], this._currentOpacity);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this._drawParticles();
        this._util.bindFramebuffer(null);
        // enable blending to support drawing on top of an existing background (e.g. a map)
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this._drawTexture(this._screenTexture[0], 1.0);
        gl.disable(gl.BLEND);
        this._screenTexture.reverse()
    }

    private _drawTexture(texture: WebGLTexture, opacity: number) {
        const gl = this.gl;
        const program = this._programs.screen;
        gl.useProgram(program.program);
        this._util.bindTexture(program.u_screen, texture)
        gl.uniform1f(program.u_opacity, opacity);
        gl.uniform2f(program.u_canvasOrigin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvasSize, this._canvasSize[0], this._canvasSize[1]);
        this._util.bindTexture(program.u_windTex, this._windTextures.textures[this._texIndex]!)
        gl.uniform2f(program.u_windMin, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_windMax, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_windSpdMin, this.minSpeedColor);
        gl.uniform1f(program.u_windSpdMax, this.maxSpeedColor);
        gl.uniform1f(program.u_timeFac, this._timeFac);
        this._util.bindAttribute(this._quadBuffer, program.a_pos, 2);
        this._util.bindAttribute(this._quadBuffer, program.a_pos, 2);
        this._util.bindAttribute(this._quadBuffer, program.a_pos, 2);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    private _drawParticles() {
        const gl = this.gl;
        const program = this._programs.draw;
        gl.useProgram(program.program);
        const windTex = this._windTextures.textures[this._texIndex];
        this._util.bindAttribute(this._lineCoordBuffer, program.a_index, 2);
        this._util.bindAttribute(this._lineRoleBuffer, program.a_role, 1);

        this._util.bindTexture(program.u_windTex, windTex!)
        gl.uniform1f(program.u_timeFac, this._timeFac);
        gl.uniform2f(program.u_canvasOrigin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvasSize, this._canvasSize[0], this._canvasSize[1]);
        gl.uniform2f(program.u_particleTexRes, this._particleTexRes[0], this._particleTexRes[1]);
        gl.uniform2f(program.u_windMin, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_windMax, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_windSpdMin, this.minSpeedColor);
        gl.uniform1f(program.u_windSpdMax, this.maxSpeedColor);
        this._util.bindTexture(program.u_colorRamp, this._colorRampTexture)

        // gl.enable(gl.BLEND);
        // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        if (!this._particlePosTex || !this._particleAgeTex) {
            throw new Error('Particle textures not initialized');
        }
        this._util.bindTexture(program.u_particlePosTex, this._particlePosTex.read);
        this._util.bindTexture(program.u_particleAgeTex, this._particleAgeTex.read);
        gl.drawArrays(gl.LINES, 0, this._numSegments());
        // gl.disable(gl.BLEND);
    }

    private _updateParticlePos() {
        const gl = this.gl;
        this._util.bindFramebuffer(this._framebuffer, this._particlePosTex!.write);
        gl.viewport(0, 0, this._particleTexRes[0], this._particleTexRes[1]);

        const program = this._programs.updatePos;
        const windTex = this._windTextures.textures[this._texIndex];
        if (!windTex) {
            throw new Error('Wind texture not found');
        }
        gl.useProgram(program.program);
        if (!this._particleCoordBuffer) {
            throw new Error('Particle coordinate buffer not initialized');
        }
        this._util.bindAttribute(this._particleCoordBuffer, program.a_pos, 2);
        this._util.bindTexture(program.u_windTex, windTex)
        this._util.bindTexture(program.u_particlePosTex, this._particlePosTex!.read)
        this._util.bindTexture(program.u_particleAgeTex, this._particleAgeTex!.read)

        gl.uniform1f(program.u_timeFac, this._timeFac);
        gl.uniform1f(program.u_randSeed, Math.random());
        gl.uniform2f(program.u_windRes, this._windData.width, this._windData.height);
        gl.uniform2f(program.u_canvasOrigin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvasSize, this._canvasSize[0], this._canvasSize[1]);
        gl.uniform2f(program.u_windMin, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_windMax, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_speedFactor, this.speedFactor);
        gl.uniform2f(program.u_particleTexRes, this._particleTexRes[0], this._particleTexRes[1]);
        gl.drawArrays(gl.POINTS, 0, this._numPoints());
        this._particlePosTex = {
            read: this._particlePosTex!.write,
            write: this._particlePosTex!.read
        };
    }

    private _updateParticleAge() {
        const gl = this.gl;
        this._util.bindFramebuffer(this._framebuffer, this._particleAgeTex!.write);
        gl.viewport(0, 0, this._particleTexRes[0], this._particleTexRes[1]);

        const program = this._programs.updateAge;
        const windTex = this._windTextures.textures[this._texIndex];
        gl.useProgram(program.program);

        this._util.bindAttribute(this._particleCoordBuffer, program.a_pos, 2);
        this._util.bindTexture(program.u_windTex, windTex!)
        this._util.bindTexture(program.u_particlePosTex, this._particlePosTex!.read)
        this._util.bindTexture(program.u_particleAgeTex, this._particleAgeTex!.read)
        gl.uniform1f(program.u_timeFac, this._timeFac);
        gl.uniform2f(program.u_windRes, this._windData.width, this._windData.height);
        gl.uniform2f(program.u_canvasOrigin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvasSize, this._canvasSize[0], this._canvasSize[1]);
        gl.uniform2f(program.u_windMin, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_windMax, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_windSpeedMin, this._windData.uMin);
        gl.uniform1f(program.u_windSpeedMax, this._windData.uMax);
        gl.uniform2f(program.u_particleTexRes, this._particleTexRes[0], this._particleTexRes[1]);
        gl.uniform1f(program.u_particleLength, this._particleLength)
        gl.uniform1f(program.u_dropRate, this.dropRate);
        gl.uniform1f(program.u_speedFactor, this.speedFactor);

        gl.drawArrays(gl.POINTS, 0, this._numPoints());
        // swap the read and write textures
        this._particleAgeTex = {
            read: this._particleAgeTex!.write,
            write: this._particleAgeTex!.read
        };
    }

    private readUint8Texture(texture: WebGLTexture, width: number, height: number) {
        const gl = this.gl;
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        const pixels = new Uint8Array(width * height * 4); // RGBA

        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(framebuffer);

        // decode positions from RGBA to XY coordinates
        // vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a)
        let pos = []
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i]! / 255.0 / 255.0; // normalize to [0, 1]
            const g = pixels[i + 1]! / 255.0 / 255.0; // normalize to [0, 1]
            const b = pixels[i + 2]! / 255.0;
            const a = pixels[i + 3]! / 255.0;
            pos.push([r + b, g + a]);
        }
        return pos;
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


