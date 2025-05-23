class glUtil {
    _gl;
    _texUnitMap;
    texNextUnit;
    constructor(gl) {
        this._gl = gl;
        this._texUnitMap = new Map();
        this.texNextUnit = 0;
    }
    bindTexture(location, texture) {
        const gl = this._gl;
        let unit;
        if (this._texUnitMap.has(location)) {
            unit = this._texUnitMap.get(location);
        }
        else {
            unit = this.texNextUnit++;
            this._texUnitMap.set(location, unit);
        }
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(location, unit);
    }
    _createShader(type, source) {
        const shader = this._gl.createShader(type);
        if (!shader) {
            throw new Error('Error creating shader');
        }
        this._gl.shaderSource(shader, source);
        this._gl.compileShader(shader);
        if (!this._gl.getShaderParameter(shader, this._gl.COMPILE_STATUS)) {
            throw new Error(this._gl.getShaderInfoLog(shader) || 'Unknown shader compile error');
        }
        return shader;
    }
    createProgram(vertexSource, fragmentSource) {
        const program = this._gl.createProgram();
        const vertexShader = this._createShader(this._gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this._createShader(this._gl.FRAGMENT_SHADER, fragmentSource);
        this._gl.attachShader(program, vertexShader);
        this._gl.attachShader(program, fragmentShader);
        this._gl.linkProgram(program);
        if (!this._gl.getProgramParameter(program, this._gl.LINK_STATUS)) {
            throw new Error(this._gl.getProgramInfoLog(program) || 'Unknown program link error');
        }
        const wrapper = { 'program': program };
        const numAttributes = this._gl.getProgramParameter(program, this._gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttributes; i++) {
            const attribute = this._gl.getActiveAttrib(program, i);
            if (!attribute) {
                throw new Error('Error getting attribute');
            }
            const attrLoc = this._gl.getAttribLocation(program, attribute.name);
            if (attrLoc < 0) {
                throw new Error('Error getting attribute location');
            }
            wrapper[attribute.name] = attrLoc;
        }
        const numUniforms = this._gl.getProgramParameter(program, this._gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const uniform = this._gl.getActiveUniform(program, i);
            if (!uniform) {
                throw new Error('Error getting uniform');
            }
            wrapper[uniform.name] = this._gl.getUniformLocation(program, uniform.name);
        }
        return wrapper;
    }
    createTexture(filter, data, width = 0, height = 0) {
        const texture = this._gl.createTexture();
        this._gl.bindTexture(this._gl.TEXTURE_2D, texture);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, filter);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, filter);
        if (data instanceof Uint8Array) {
            this._gl.texImage2D(this._gl.TEXTURE_2D, 0, this._gl.RGBA, width, height, 0, this._gl.RGBA, this._gl.UNSIGNED_BYTE, data);
        }
        else {
            this._gl.texImage2D(this._gl.TEXTURE_2D, 0, this._gl.RGBA, this._gl.RGBA, this._gl.UNSIGNED_BYTE, data);
        }
        this._gl.bindTexture(this._gl.TEXTURE_2D, null);
        return texture;
    }
    createBuffer(data) {
        const buffer = this._gl.createBuffer();
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, buffer);
        this._gl.bufferData(this._gl.ARRAY_BUFFER, data, this._gl.STATIC_DRAW);
        return buffer;
    }
    bindAttribute(buffer, attribute, numComponents) {
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, buffer);
        this._gl.enableVertexAttribArray(attribute);
        this._gl.vertexAttribPointer(attribute, numComponents, this._gl.FLOAT, false, 0, 0);
    }
    bindFramebuffer(framebuffer, texture = null) {
        this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, framebuffer);
        if (texture) {
            this._gl.framebufferTexture2D(this._gl.FRAMEBUFFER, this._gl.COLOR_ATTACHMENT0, this._gl.TEXTURE_2D, texture, 0);
        }
    }
}

var drawVert = "#version 100\nprecision mediump float;attribute float a_index;uniform sampler2D u_particles;uniform sampler2D u_particle_props;uniform float u_particles_res;varying vec2 v_particle_pos;varying float v_particle_age;void main(){vec2 coord=vec2(fract(a_index/u_particles_res),floor(a_index/u_particles_res)/u_particles_res);vec4 color=texture2D(u_particles,coord);v_particle_pos=vec2(color.r/255.0+color.b,color.g/255.0+color.a);color=texture2D(u_particle_props,coord);v_particle_age=color.r+color.g/255.0;gl_PointSize=1.;gl_Position=vec4(2.0*v_particle_pos.x-1.0,1.0-2.0*v_particle_pos.y,0,1);}"; // eslint-disable-line

var drawFrag = "#version 100\nprecision mediump float;uniform sampler2D u_wind;uniform vec2 u_canvas_origin;uniform vec2 u_canvas_size;uniform vec2 u_wind_min;uniform vec2 u_wind_max;uniform sampler2D u_color_ramp;uniform float u_time_fac;uniform float u_wind_spd_min;uniform float u_wind_spd_max;varying vec2 v_particle_pos;varying float v_particle_age;vec2 lookup_wind(const vec2 uv){vec2 uvc=u_canvas_origin+uv*u_canvas_size;vec4 wind=texture2D(u_wind,uvc);return mix(wind.rg,wind.ba,u_time_fac);}void main(){vec2 wind=lookup_wind(v_particle_pos);vec2 velocity=mix(u_wind_min,u_wind_max,wind);float speed_t=clamp((length(velocity)-u_wind_spd_min)/(u_wind_spd_max-u_wind_spd_min),0.0,1.0);vec2 ramp_pos=vec2(fract(16.0*speed_t),floor(16.0*speed_t)/16.0);vec4 color=texture2D(u_color_ramp,ramp_pos);gl_FragColor=vec4(color);}"; // eslint-disable-line

var quadVert = "#version 100\nprecision mediump float;attribute vec2 a_pos;varying vec2 v_tex_pos;void main(){v_tex_pos=a_pos;gl_Position=vec4(1.0-2.0*a_pos,0,1);}"; // eslint-disable-line

var screenFrag = "#version 100\nprecision mediump float;uniform sampler2D u_screen;uniform sampler2D u_wind;uniform float u_wind_spd_min;uniform float u_wind_spd_max;uniform float u_opacity;uniform vec2 u_canvas_origin;uniform vec2 u_canvas_size;uniform vec2 u_wind_min;uniform vec2 u_wind_max;uniform float u_time_fac;varying vec2 v_tex_pos;vec2 lookup_wind(const vec2 uv){vec2 uvc=u_canvas_origin+uv*u_canvas_size;vec4 wind=texture2D(u_wind,uvc);return mix(wind.rg,wind.ba,u_time_fac);}void main(){vec4 color=texture2D(u_screen,1.-v_tex_pos);vec2 wind=lookup_wind(1.0-v_tex_pos);vec2 velocity=mix(u_wind_min,u_wind_max,wind);float speed_t=length(velocity);float speed_opacity=smoothstep(0.0,4.0,speed_t);gl_FragColor=vec4(color*(u_opacity-(0.001*speed_opacity)));}"; // eslint-disable-line

var updateFrag = "#version 100\nprecision highp float;uniform sampler2D u_particles;uniform sampler2D u_particle_props;uniform sampler2D u_wind;uniform vec2 u_wind_res;uniform vec2 u_canvas_origin;uniform vec2 u_canvas_size;uniform vec2 u_wind_min;uniform vec2 u_wind_max;uniform float u_rand_seed;uniform float u_speed_factor;uniform float u_time_fac;varying vec2 v_tex_pos;const vec3 rand_constants=vec3(12.9898,78.233,4375.85453);float rand(const vec2 co){float t=dot(rand_constants.xy,co);return fract(sin(t)*(rand_constants.z+t));}vec2 lookup_wind(const vec2 uv){vec2 uvc=u_canvas_origin+uv*u_canvas_size;vec4 wind=texture2D(u_wind,uvc);return mix(wind.rg,wind.ba,u_time_fac);}void main(){vec4 color=texture2D(u_particles,v_tex_pos);vec2 pos=vec2(color.r/255.0+color.b,color.g/255.0+color.a);color=texture2D(u_particle_props,v_tex_pos);float age=color.r+color.g/255.0;vec2 velocity=mix(u_wind_min,u_wind_max,lookup_wind(pos));float speed_t=length(velocity)/length(u_wind_max);vec2 offset=vec2(velocity.x,-velocity.y)*0.0001*u_speed_factor;pos=pos+offset;float drop1=step(1.0,abs(1.-2.*pos.x));float drop2=step(1.0,abs(1.-2.*pos.y));drop1=max(drop1,drop2);vec2 seed=(pos+v_tex_pos)*u_rand_seed;float drop=step(age,0.0);vec2 random_pos=vec2(rand(seed+1.3),rand(seed+2.1));drop=max(drop,drop1);pos=mix(pos,random_pos,drop);gl_FragColor=vec4(fract(pos*255.0),floor(pos*255.0)/255.0);}"; // eslint-disable-line

var updatePropFrag = "#version 100\nprecision mediump float;uniform float u_drop_rate;uniform float u_time_fac;uniform vec2 u_wind_res;uniform vec2 u_wind_max;uniform vec2 u_wind_min;uniform vec2 u_canvas_origin;uniform vec2 u_canvas_size;uniform sampler2D u_wind;uniform sampler2D u_particle_props;uniform sampler2D u_particles;varying vec2 v_tex_pos;vec2 lookup_wind(const vec2 uv){vec2 uvc=u_canvas_origin+uv*u_canvas_size;vec4 wind=texture2D(u_wind,uvc);return mix(wind.rg,wind.ba,u_time_fac);}void main(){vec4 color=texture2D(u_particles,v_tex_pos);vec2 pos=vec2(color.r/255.0+color.b,color.g/255.0+color.a);vec2 velocity=mix(u_wind_min,u_wind_max,lookup_wind(pos));float speed_age=1.-smoothstep(0.0,0.5,length(velocity)/length(u_wind_max));vec4 color1=texture2D(u_particle_props,v_tex_pos);float age=(color1.r+color1.g/255.0);age=age+u_drop_rate*speed_age+u_drop_rate*0.001;age=age*step(0.0,1.0-age);gl_FragColor=vec4(vec2(floor(age*255.0)/255.0,fract(age*255.0)),0,0);}"; // eslint-disable-line

const defaultRampColors = {
    0.0: 'rgba(44,123,182,0.5)', // blue
    0.1: 'rgba(0,166,202,0.7)', // cyan
    0.2: 'rgba(0,204,188,0.8)', // teal
    0.3: 'rgba(144,235,157,0.8)', // light green
    0.5: 'rgba(255,255,140,0.9)', // yellow
    0.7: 'rgba(249,208,87,1)', // orange
    0.8: 'rgba(242,158,46,1)', // orange-brown
    1.0: 'rgba(215,25,28,1)', // red
};
// const defaultRampColors = {
//     0.0: '#ffffff',
//     1.0: '#ffffff',
// };
class WindGL {
    gl;
    fadeOpacity = 0.99; // how fast the particle trails fade on each frame
    speedFactor = 1.5; // how fast the particles move
    dropRate = 0.009; // how fast the particle will die off
    minSpeedColor = 1.0; // minimum color velocity
    maxSpeedColor = 15.0; // maximum color velocity
    _particlesPerPixel = 0.03;
    _programs = {};
    _quadBuffer;
    _framebuffer;
    _screenTexture;
    _colorRampTexture;
    _particleStateResolution;
    _numParticles;
    _particlePosTexture;
    _particlePropTexture;
    _particleIndexBuffer;
    _windTextures;
    _windData;
    _util;
    _timeFactor = 0.0;
    _texIndex = 0;
    _canvasOrigin = [0, 0]; //[x0,y0] canvas position relative to the wind data grid all normalized to [0,1]
    _canvasSize = [0, 0]; //[x0,y0] canvas size relative to the wind data grid all normalized to [0,1]
    constructor(gl, windData) {
        this.gl = gl;
        this._util = new glUtil(gl);
        this._programs['draw'] = this._util.createProgram(drawVert, drawFrag);
        this._programs['screen'] = this._util.createProgram(quadVert, screenFrag);
        this._programs['update'] = this._util.createProgram(quadVert, updateFrag);
        this._programs['updateProp'] = this._util.createProgram(quadVert, updatePropFrag);
        this._quadBuffer = this._util.createBuffer(new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
        this._colorRampTexture = this._util.createTexture(this.gl.LINEAR, getColorRamp(defaultRampColors), 16, 16);
        this._windData = windData;
        this._windTextures = new WindTexture(windData, gl);
        // we create a square texture where each pixel will hold a particle position encoded as RGBA
        this.reset();
    }
    set particlesPerPixel(value) {
        value = Math.max(0.0, Math.min(1.0, value));
        this._particlesPerPixel = value;
        this.reset();
    }
    get particlesPerPixel() {
        return this._particlesPerPixel;
    }
    _initParticles() {
        const particlesPerPixel = this._particlesPerPixel;
        const gl = this.gl;
        const numParticles = Math.floor(particlesPerPixel * gl.canvas.width * gl.canvas.height);
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
            particleProp[i] = 128; // randomize the initial particle positions
        }
        // textures to hold the particle state for the current and the next frame
        if (this._particlePosTexture) {
            gl.deleteTexture(this._particlePosTexture[0]);
            gl.deleteTexture(this._particlePosTexture[1]);
        }
        this._particlePosTexture = [
            this._util.createTexture(gl.NEAREST, particleState, particleRes, particleRes),
            this._util.createTexture(gl.NEAREST, particleState, particleRes, particleRes)
        ];
        if (this._particlePropTexture) {
            gl.deleteTexture(this._particlePropTexture[0]);
            gl.deleteTexture(this._particlePropTexture[1]);
        }
        this._particlePropTexture = [
            this._util.createTexture(gl.NEAREST, particleState, particleRes, particleRes),
            this._util.createTexture(gl.NEAREST, particleState, particleRes, particleRes)
        ];
        const particleIndices = new Float32Array(this._numParticles);
        for (let i = 0; i < this._numParticles; i++)
            particleIndices[i] = i;
        if (this._particleIndexBuffer) {
            gl.deleteBuffer(this._particleIndexBuffer);
        }
        this._particleIndexBuffer = this._util.createBuffer(particleIndices);
    }
    _initScreenTexture() {
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
        ];
    }
    reset() {
        if (this._framebuffer) {
            this.gl.deleteFramebuffer(this._framebuffer);
        }
        this._framebuffer = this.gl.createFramebuffer();
        this._initParticles();
        this._initScreenTexture();
    }
    setCanvasPos(x0, y0, width, height) {
        this._canvasOrigin = [x0, y0];
        this._canvasSize = [width, height];
    }
    draw(timeStep) {
        var dt = Math.min(Math.max(0.0, Math.min(0.99999, timeStep)) * this._windTextures.ntex, this._windTextures.ntex);
        this._texIndex = Math.floor(dt);
        this._timeFactor = dt - this._texIndex;
        const gl = this.gl;
        // console.log(this._tex_index, this._time_factor);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        this._drawScreen();
        this._updateParticleProp();
        this._updateParticles();
        this._particlePosTexture.reverse();
        this._particlePropTexture.reverse();
    }
    _drawScreen() {
        const gl = this.gl;
        // draw the screen into a temporary framebuffer to retain it as the background on the next frame
        this._util.bindFramebuffer(this._framebuffer, this._screenTexture[0]);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        this._drawTexture(this._screenTexture[1], this.fadeOpacity);
        this._drawParticles();
        this._util.bindFramebuffer(null);
        // enable blending to support drawing on top of an existing background (e.g. a map)
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this._drawTexture(this._screenTexture[0], 1.0);
        gl.disable(gl.BLEND);
        this._screenTexture.reverse();
        // save the current screen as the background for the next frame
    }
    _drawTexture(texture, opacity) {
        const gl = this.gl;
        const program = this._programs.screen;
        gl.useProgram(program.program);
        const windTex = this._windTextures.textures[this._texIndex];
        gl.uniform1f(program.u_time_fac, this._timeFactor);
        gl.uniform2f(program.u_wind_res, this._windData.width, this._windData.height);
        gl.uniform2f(program.u_canvas_origin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvas_size, this._canvasSize[0], this._canvasSize[1]);
        this._util.bindTexture(program.u_wind, windTex);
        this._util.bindAttribute(this._quadBuffer, program.a_pos, 2);
        this._util.bindTexture(program.u_screen, texture);
        gl.uniform1f(program.u_opacity, opacity);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    _drawParticles() {
        const gl = this.gl;
        const program = this._programs.draw;
        gl.useProgram(program.program);
        const windTex = this._windTextures.textures[this._texIndex];
        this._util.bindAttribute(this._particleIndexBuffer, program.a_index, 1);
        this._util.bindTexture(program.u_wind, windTex);
        gl.uniform1f(program.u_time_fac, this._timeFactor);
        gl.uniform2f(program.u_canvas_origin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvas_size, this._canvasSize[0], this._canvasSize[1]);
        this._util.bindTexture(program.u_particles, this._particlePosTexture[0]);
        this._util.bindTexture(program.u_particle_props, this._particlePropTexture[0]);
        this._util.bindTexture(program.u_color_ramp, this._colorRampTexture);
        gl.uniform1f(program.u_particles_res, this._particleStateResolution);
        gl.uniform2f(program.u_wind_min, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_wind_max, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_wind_spd_min, this.minSpeedColor);
        gl.uniform1f(program.u_wind_spd_max, this.maxSpeedColor);
        gl.drawArrays(gl.POINTS, 0, this._numParticles);
    }
    _updateParticles() {
        const gl = this.gl;
        this._util.bindFramebuffer(this._framebuffer, this._particlePosTexture[1]);
        gl.viewport(0, 0, this._particleStateResolution, this._particleStateResolution);
        const program = this._programs.update;
        const windTex = this._windTextures.textures[this._texIndex];
        if (!windTex) {
            throw new Error('Wind texture not found');
        }
        gl.useProgram(program.program);
        this._util.bindAttribute(this._quadBuffer, program.a_pos, 2);
        this._util.bindTexture(program.u_wind, windTex);
        this._util.bindTexture(program.u_particles, this._particlePosTexture[0]);
        this._util.bindTexture(program.u_particle_props, this._particlePropTexture[0]);
        gl.uniform1f(program.u_time_fac, this._timeFactor);
        gl.uniform1f(program.u_rand_seed, Math.random());
        gl.uniform2f(program.u_wind_res, this._windData.width, this._windData.height);
        gl.uniform2f(program.u_canvas_origin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvas_size, this._canvasSize[0], this._canvasSize[1]);
        gl.uniform2f(program.u_wind_min, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_wind_max, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_speed_factor, this.speedFactor);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    _updateParticleProp() {
        const gl = this.gl;
        this._util.bindFramebuffer(this._framebuffer, this._particlePropTexture[1]);
        gl.viewport(0, 0, this._particleStateResolution, this._particleStateResolution);
        const program = this._programs.updateProp;
        const windTex = this._windTextures.textures[this._texIndex];
        gl.useProgram(program.program);
        this._util.bindAttribute(this._quadBuffer, program.a_pos, 2);
        this._util.bindTexture(program.u_wind, windTex);
        this._util.bindTexture(program.u_particles, this._particlePosTexture[0]);
        this._util.bindTexture(program.u_particle_props, this._particlePropTexture[0]);
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
    }
}
function getColorRamp(colors) {
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
class WindData {
    uwind;
    vwind;
    width;
    height;
    uMin;
    vMin;
    uMax;
    vMax;
    ntime;
    constructor(uwind, vwind, uwindMinMax, vwindMinMax, width, height, ntime = 1) {
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
        this.uMin = uwindMinMax[0];
        this.uMax = uwindMinMax[1];
        this.vMin = vwindMinMax[0];
        this.vMax = vwindMinMax[1];
        this.uwind = uwind;
        this.vwind = vwind;
    }
}
class WindTexture {
    textures = [];
    uMin;
    vMin;
    uMax;
    vMax;
    height;
    width;
    ntex;
    constructor(windData, gl) {
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
        const util = new glUtil(gl);
        const wh = this.width * this.height;
        for (let t = 0; t < this.ntex; t++) {
            const t1 = t;
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
                windArray[i * 4] = u1;
                windArray[i * 4 + 1] = v1;
                windArray[i * 4 + 2] = u2;
                windArray[i * 4 + 3] = v2;
            }
            const texture = util.createTexture(gl.LINEAR, windArray, windData.width, windData.height);
            this.textures.push(texture);
        }
    }
}

const L = globalThis.L;
class LeafletWindGL extends L.Layer {
    _windData;
    _canvas;
    _windGl;
    // private _map!: L.Map;
    _animationId = null;
    _tPos = 0;
    _canvasExists = false;
    _northWest;
    _southEast;
    constructor(windData, bounds, options) {
        super(options);
        L.setOptions(this, options);
        this._windData = windData;
        this._frame = this._frame.bind(this);
        this._northWest = L.latLng(bounds.latN, bounds.lonW);
        this._southEast = L.latLng(bounds.latS, bounds.lonE);
    }
    onAdd(map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-purple-canvas');
        if (!this._canvas) {
            throw new Error('Failed to create canvas element');
        }
        const gl = this._canvas.getContext('webgl');
        if (!gl) {
            throw new Error('Failed to get WebGL context');
        }
        this._windGl = new WindGL(gl, this._windData);
        this._canvas.style.position = 'absolute';
        map.getPanes().overlayPane.appendChild(this._canvas);
        map.on('move resize zoom', this._draw, this);
        this._draw();
        return this;
    }
    onRemove(map) {
        map.getPanes().overlayPane.removeChild(this._canvas);
        map.off('move resize zoom', this._draw, this);
        this._stopAnimation();
        return this;
    }
    setTimePos(tPos) {
        this._tPos = tPos;
    }
    _frame() {
        this._windGl.draw(this._tPos);
        this._animationId = requestAnimationFrame(this._frame);
    }
    _startAnimation() {
        if (this._animationId !== null) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
        if (!this._canvasExists) {
            return;
        }
        this._animationId = requestAnimationFrame(this._frame);
    }
    _stopAnimation() {
        if (this._animationId !== null) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
    }
    _draw() {
        this._stopAnimation();
        // Define geographic bounds: 0 to 30N latitude, 20 to 65E longitude
        this._setCanvasBounds();
        this._windGl.reset();
        this._startAnimation();
    }
    _setCanvasGrid(canvasBound, gridBound) {
        const tlCanvas2L = { x: canvasBound.tl.x, y: canvasBound.tl.y };
        const brCanvas2L = { x: canvasBound.br.x, y: canvasBound.br.y };
        const tlGrid2L = { x: gridBound.tl.x, y: gridBound.tl.y };
        const brGrid2L = { x: gridBound.br.x, y: gridBound.br.y };
        // Calculate the top-left and bottom-right corners of the canvas in grid coordinates
        const tlCanvas2G = { x: tlCanvas2L.x - tlGrid2L.x, y: tlCanvas2L.y - tlGrid2L.y };
        const brCanvas2G = { x: brCanvas2L.x - tlGrid2L.x, y: brCanvas2L.y - tlGrid2L.y };
        // Normalize the coordinates to the range [0, 1]
        const tlCanvas2Gn = {
            x: tlCanvas2G.x / (brGrid2L.x - tlGrid2L.x),
            y: tlCanvas2G.y / (brGrid2L.y - tlGrid2L.y),
        };
        const brCanvas2Gn = {
            x: brCanvas2G.x / (brGrid2L.x - tlGrid2L.x),
            y: brCanvas2G.y / (brGrid2L.y - tlGrid2L.y),
        };
        const CanvasSize = {
            width: Math.abs(brCanvas2Gn.x - tlCanvas2Gn.x),
            height: Math.abs(brCanvas2Gn.y - tlCanvas2Gn.y),
        };
        this._windGl.setCanvasPos(tlCanvas2Gn.x, tlCanvas2Gn.y, CanvasSize.width, CanvasSize.height);
    }
    _setCanvasBounds() {
        const northWest = this._northWest;
        const southEast = this._southEast;
        // Convert geographic bounds to layer points 
        // this is also the bound of Wind Grid in pixels
        const tlWind2L = this._map.latLngToLayerPoint(northWest);
        const brWind2L = this._map.latLngToLayerPoint(southEast);
        const tlWind2C = this._map.latLngToContainerPoint(northWest);
        const brWind2C = this._map.latLngToContainerPoint(southEast);
        const containerSize = this._map.getSize();
        // Calculate the top-left and bottom-right corners of the canvas in Layer coordinates
        const tlCanvas2L = { x: tlWind2L.x, y: tlWind2L.y };
        const brCanvas2L = { x: brWind2L.x, y: brWind2L.y };
        if (tlWind2C.x < 0) {
            tlCanvas2L.x = tlCanvas2L.x - tlWind2C.x;
        }
        if (tlWind2C.y < 0) {
            tlCanvas2L.y = tlCanvas2L.y - tlWind2C.y;
        }
        if (brWind2C.x > containerSize.x) {
            brCanvas2L.x = brCanvas2L.x - (brWind2C.x - containerSize.x);
        }
        if (brWind2C.y > containerSize.y) {
            brCanvas2L.y = brCanvas2L.y - (brWind2C.y - containerSize.y);
        }
        // Calculate rectangle dimensions in pixels
        const width = Math.max(brCanvas2L.x - tlCanvas2L.x, 0);
        const height = Math.max(brCanvas2L.y - tlCanvas2L.y, 0);
        this._canvasExists = width * height > 0;
        // Set the canvas dimensions and position
        this._canvas.width = width;
        this._canvas.height = height;
        this._canvas.style.width = width + 'px';
        this._canvas.style.height = height + 'px';
        // Position the canvas with respect to the overlay pane
        this._canvas.style.position = 'absolute';
        this._canvas.style.left = tlCanvas2L.x + 'px';
        this._canvas.style.top = tlCanvas2L.y + 'px';
        if (this._canvasExists) {
            this._setCanvasGrid({ tl: tlCanvas2L, br: brCanvas2L }, { tl: tlWind2L, br: brWind2L });
        }
    }
}

export { LeafletWindGL, WindData };
//# sourceMappingURL=leaflet-windgl.js.map
