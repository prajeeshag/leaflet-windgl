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

var drawVert = "#version 100\nprecision mediump float;attribute vec2 a_index;attribute float a_role;uniform vec2 u_particleTexRes;uniform sampler2D u_particlePosTex;uniform sampler2D u_particleAgeTex;varying vec2 v_particlePos;varying float v_particleAge;vec2 getPos(const vec2 index){vec4 color=texture2D(u_particlePosTex,index);return vec2(color.r/255.0+color.b,color.g/255.0+color.a);}float getAge(const vec2 index){vec4 color=texture2D(u_particleAgeTex,index);return color.r+color.g/255.0;}void main(){vec2 pos=getPos(a_index);vec2 nextIndex=vec2(a_index.x+1./u_particleTexRes.x,a_index.y);vec2 posNext=getPos(nextIndex);float age=getAge(a_index);float ageNext=getAge(nextIndex);float collapse=(1.-step(ageNext,age))*a_role;pos=mix(pos,posNext,collapse);v_particleAge=age;v_particlePos=pos;gl_Position=vec4(2.0*pos.x-1.0,1.0-2.0*pos.y,0.0,1.0);}"; // eslint-disable-line

var drawFrag = "#version 100\nprecision mediump float;uniform sampler2D u_windTex;uniform vec2 u_canvasOrigin;uniform vec2 u_canvasSize;uniform vec2 u_windMin;uniform vec2 u_windMax;uniform sampler2D u_colorRamp;uniform float u_timeFac;uniform float u_windSpdMin;uniform float u_windSpdMax;varying vec2 v_particlePos;varying float v_particleAge;vec2 lookup_wind(const vec2 uv){vec2 uvc=u_canvasOrigin+uv*u_canvasSize;vec4 wind=texture2D(u_windTex,uvc);return mix(wind.rg,wind.ba,u_timeFac);}void main(){vec2 wind=lookup_wind(v_particlePos);vec2 velocity=mix(u_windMin,u_windMax,wind);float speed_t=clamp((length(velocity)-u_windSpdMin)/(u_windSpdMax-u_windSpdMin),0.0,1.0);vec2 ramp_pos=vec2(fract(16.0*speed_t),floor(16.0*speed_t)/16.0);vec4 color=texture2D(u_colorRamp,ramp_pos);gl_FragColor=vec4(color.rgb,color.a*max((1.0-v_particleAge),0.2));}"; // eslint-disable-line

var quadVert = "#version 100\nprecision mediump float;attribute vec2 a_pos;varying vec2 v_tex_pos;void main(){v_tex_pos=a_pos;gl_Position=vec4(1.0-2.0*a_pos,0,1);}"; // eslint-disable-line

var screenFrag = "#version 100\nprecision mediump float;uniform sampler2D u_screen;uniform float u_opacity;varying vec2 v_tex_pos;void main(){vec4 color=texture2D(u_screen,1.-v_tex_pos);gl_FragColor=vec4(color.rgb,color.a*u_opacity);}"; // eslint-disable-line

var updateVert = "#version 100\nprecision mediump float;attribute vec2 a_index;varying vec2 v_index;void main(){v_index=a_index;gl_PointSize=1.0;gl_Position=vec4(a_index*2.0-1.0,0.0,1.0);}"; // eslint-disable-line

var updatePosFrag = "#version 100\nprecision highp float;uniform sampler2D u_particlePosTex;uniform sampler2D u_particleAgeTex;uniform sampler2D u_windTex;uniform vec2 u_windMin;uniform vec2 u_windMax;uniform vec2 u_windRes;uniform vec2 u_canvasOrigin;uniform vec2 u_canvasSize;uniform float u_randSeed;uniform float u_speedFactor;uniform float u_timeFac;uniform vec2 u_particleTexRes;varying vec2 v_index;vec2 lookup_wind(const vec2 uv){vec2 uvc=u_canvasOrigin+uv*u_canvasSize;vec4 wind=texture2D(u_windTex,uvc);return mix(wind.rg,wind.ba,u_timeFac);}const vec3 rand_constants=vec3(12.9898,78.233,4375.85453);float rand(const vec2 co){float t=dot(rand_constants.xy,co);return fract(sin(t)*(rand_constants.z+t));}vec2 getPos(const vec2 index){vec4 color=texture2D(u_particlePosTex,index);return vec2(color.r/255.0+color.b,color.g/255.0+color.a);}float getAge(const vec2 index){vec4 color=texture2D(u_particleAgeTex,index);return color.r+color.g/255.0;}float getAgeCounter(const vec2 index){vec4 color=texture2D(u_particleAgeTex,index);return color.b*255.0;}float isoutside(const vec2 pos){return min(step(1.0,abs(pos.x*2.-1.))+step(1.0,abs(pos.y*2.-1.)),1.0);}vec2 getRandPos(const vec2 pos,const vec2 index){vec2 seed=(pos+index)*u_randSeed;return vec2(rand(seed+1.3),rand(seed+2.1));}vec2 getVelocity(const vec2 pos){return mix(u_windMin,u_windMax,lookup_wind(pos));}vec2 getOffset(const vec2 pos){vec2 velocity=mix(u_windMin,u_windMax,lookup_wind(pos));return vec2(velocity.x,-velocity.y)*0.0001*u_speedFactor;}vec2 prevIndex(){return vec2(v_index.x-1.0/u_particleTexRes.x,v_index.y);}float ishead(){return step(v_index.x,1.0/u_particleTexRes.x);}void main(){vec2 pos=getPos(v_index);float age=getAge(v_index);vec2 posPrev=getPos(prevIndex());vec2 pos1=pos+getOffset(pos)*ishead();pos1=mix(pos1,pos,isoutside(pos1));float drop=floor(1.-getAge(v_index))*ishead();vec2 randomPos=getRandPos(pos,v_index);pos1=mix(pos1,randomPos,drop);pos1=mix(posPrev,pos1,ishead());gl_FragColor=vec4(fract(pos1*255.0),floor(pos1*255.0)/255.0);}"; // eslint-disable-line

var updateAgeFrag = "#version 100\nprecision highp float;uniform float u_particleLength;uniform float u_dropRate;uniform sampler2D u_particlePosTex;uniform sampler2D u_particleAgeTex;uniform sampler2D u_windTex;uniform vec2 u_windMin;uniform vec2 u_windMax;uniform vec2 u_windRes;uniform vec2 u_canvasOrigin;uniform vec2 u_canvasSize;uniform float u_randSeed;uniform float u_speedFactor;uniform float u_timeFac;uniform vec2 u_particleTexRes;varying vec2 v_index;vec2 lookup_wind(const vec2 uv){vec2 uvc=u_canvasOrigin+uv*u_canvasSize;vec4 wind=texture2D(u_windTex,uvc);return mix(wind.rg,wind.ba,u_timeFac);}const vec3 rand_constants=vec3(12.9898,78.233,4375.85453);float rand(const vec2 co){float t=dot(rand_constants.xy,co);return fract(sin(t)*(rand_constants.z+t));}vec2 getPos(const vec2 index){vec4 color=texture2D(u_particlePosTex,index);return vec2(color.r/255.0+color.b,color.g/255.0+color.a);}float getAge(const vec2 index){vec4 color=texture2D(u_particleAgeTex,index);return color.r+color.g/255.0;}float getAgeCounter(const vec2 index){vec4 color=texture2D(u_particleAgeTex,index);return color.b*255.0;}float isoutside(const vec2 pos){return min(step(1.0,abs(pos.x*2.-1.))+step(1.0,abs(pos.y*2.-1.)),1.0);}vec2 getRandPos(const vec2 pos,const vec2 index){vec2 seed=(pos+index)*u_randSeed;return vec2(rand(seed+1.3),rand(seed+2.1));}vec2 getVelocity(const vec2 pos){return mix(u_windMin,u_windMax,lookup_wind(pos));}vec2 getOffset(const vec2 pos){vec2 velocity=mix(u_windMin,u_windMax,lookup_wind(pos));return vec2(velocity.x,-velocity.y)*0.0001*u_speedFactor;}vec2 prevIndex(){return vec2(v_index.x-1.0/u_particleTexRes.x,v_index.y);}float ishead(){return step(v_index.x,1.0/u_particleTexRes.x);}void main(){float ageCounter=mod(floor(getAgeCounter(v_index)+1.),u_particleLength*0.9);float updateAge=1.-clamp(ageCounter,0.,1.);vec2 pos=getPos(v_index);vec2 pos1=pos+getOffset(v_index);float dropRate=mix(u_dropRate,1.-u_dropRate,isoutside(pos1));float age=getAge(v_index);float update0Age=floor(1.-fract(age));float prevAge=getAge(prevIndex());float age1=fract(min(age+dropRate,1.0));age1=mix(age,age1,min(updateAge+update0Age,1.0));age1=mix(prevAge,age1,ishead());vec2 age_encoded=vec2(floor(age1*255.0)/255.0,fract(age1*255.0));gl_FragColor=vec4(age_encoded,ageCounter/255.0,0.0);}"; // eslint-disable-line

const defaultRampColors = {
    0.0: 'rgba(44,123,182,0.2)', // blue
    0.1: 'rgba(0,166,202,0.2)', // cyan
    0.2: 'rgba(0,204,188,0.5)', // teal
    0.3: 'rgba(144,235,157,0.5)', // light green
    0.5: 'rgba(255,255,140,0.5)', // yellow
    0.7: 'rgba(249,208,87,0.7)', // orange
    0.8: 'rgba(242,158,46,0.7)', // orange-brown
    1.0: 'rgba(215,25,28,0.7)', // red
};
// const defaultRampColors = {
//     0.0: 'rgba(250,250,250,0.1)', // transparent
//     1.0: 'rgba(250,250,250,0.7)', // transparent
// }
// const defaultRampColors = {
//     0.0: 'rgba(250,250,250,1)', // transparent
//     1.0: 'rgba(250,250,250,1)', // transparent
// };
class WindGL {
    gl;
    fadeOpacity = 0.99; // how fast the particle trails fade on each frame
    speedFactor = 3.5; // how fast the particles move
    dropRate = 0.09; // how fast the particle will die off
    minSpeedColor = 1.0; // minimum color velocity
    maxSpeedColor = 15.0; // maximum color velocity
    _particleLength = 70; // length of a particle with its tail
    _pointsPerPixel = 0.5;
    _programs = {};
    _quadBuffer;
    _framebuffer;
    _screenTexture;
    _colorRampTexture;
    _particleTexRes;
    _numParticles;
    _particlePosTex = null; // this will hold the particle positions
    _particleAgeTex = null; // this will hold the particle properties (e.g. age)
    _particleCoordBuffer; // this will hold the particle coordinates
    _windTextures;
    _windData;
    _util;
    _timeFac = 0.0;
    _texIndex = 0;
    _canvasOrigin = [0, 0]; //[x0,y0] canvas position relative to the wind data grid all normalized to [0,1]
    _canvasSize = [0, 0]; //[x0,y0] canvas size relative to the wind data grid all normalized to [0,1]
    _lineCoordBuffer;
    _lineRoleBuffer;
    _currentOpacity;
    constructor(gl, windData) {
        this.gl = gl;
        this._util = new glUtil(gl);
        this._programs['draw'] = this._util.createProgram(drawVert, drawFrag);
        this._programs['screen'] = this._util.createProgram(quadVert, screenFrag);
        this._programs['updatePos'] = this._util.createProgram(updateVert, updatePosFrag);
        this._programs['updateAge'] = this._util.createProgram(updateVert, updateAgeFrag);
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
    setCanvasPos(x0, y0, width, height) {
        this._canvasOrigin = [x0, y0];
        this._canvasSize = [width, height];
    }
    _initParticles() {
        const pointsPerPixel = this._pointsPerPixel;
        const gl = this.gl;
        const numParticles = Math.min(Math.floor((pointsPerPixel * gl.canvas.width * gl.canvas.height) / this._particleLength), gl.getParameter(gl.MAX_TEXTURE_SIZE));
        // const numParticles = 50;  // for testing purposes, we use a fixed number of particles
        this._numParticles = numParticles;
        this._particleTexRes = [this._particleLength, numParticles];
        const particleRes = this._particleTexRes;
        const width = this._particleTexRes[0];
        const height = this._particleTexRes[1];
        // two sets of rgba texture, first for position, second for properties
        const particlePos = new Uint8Array(this._numPoints() * 4);
        const particleAge = new Uint8Array(this._numPoints() * 4); // age, ageUpdateCounter
        const pos = new Uint8Array(4);
        const age = new Uint8Array(4);
        for (let j = 0; j < height; j++) {
            for (let k = 0; k < 4; k++) {
                pos[k] = Math.floor(Math.random() * 256.);
                age[k] = Math.floor((Math.random() + 0.01) * 256.); // hack to avoid zero age at initial time
            }
            for (let i = 0; i < width; i++) {
                for (let k = 0; k < 4; k++) {
                    particlePos[(j * width + i) * 4 + k] = pos[k];
                    // particlePos[(j * width + i) * 4 + k] = Math.floor(Math.random() * 256.);
                    particleAge[(j * width + i) * 4 + k] = age[k];
                    // particleAge[(j * width + i) * 4 + k] = Math.floor(0.01 * 256)
                }
            }
        }
        if (this._particlePosTex !== null) {
            gl.deleteTexture(this._particlePosTex.read);
            gl.deleteTexture(this._particlePosTex.write);
        }
        if (this._particleAgeTex !== null) {
            gl.deleteTexture(this._particleAgeTex.read);
            gl.deleteTexture(this._particleAgeTex.write);
        }
        this._particlePosTex = {
            read: this._util.createTexture(gl.NEAREST, particlePos, particleRes[0], particleRes[1]),
            write: this._util.createTexture(gl.NEAREST, particlePos, particleRes[0], particleRes[1])
        };
        this._particleAgeTex = {
            read: this._util.createTexture(gl.NEAREST, particleAge, particleRes[0], particleRes[1]),
            write: this._util.createTexture(gl.NEAREST, particleAge, particleRes[0], particleRes[1])
        };
        const particleCount = width * height;
        const a_pos = new Float32Array(particleCount * 2);
        let i = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                a_pos[i++] = (x + 0.5) / width; // center of texel in X
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
                l_pos[i++] = (x + 0.5) / width; // center of texel in X
                l_pos[i++] = (y + 0.5) / height; // center of texel in Y
                l_pos[i++] = (x + 1.5) / width; // center of texel in X
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
    _initScreenTexture() {
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
        ];
    }
    _numPoints() {
        return this._numParticles * this._particleLength;
    }
    _numSegments() {
        return this._numParticles * 2 * (this._particleLength - 1);
    }
    draw(timeStep) {
        var dt = Math.min(Math.max(0.0, Math.min(0.99999, timeStep)) * this._windTextures.ntex, this._windTextures.ntex);
        this._texIndex = Math.floor(dt);
        const prevTimeFac = this._timeFac;
        this._timeFac = dt - this._texIndex;
        this._currentOpacity = this.fadeOpacity * (this._timeFac !== prevTimeFac ? 0.99 : 1.0);
        const gl = this.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        this._drawScreen();
        this._updateParticleAge();
        this._updateParticlePos();
    }
    _drawScreen() {
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
        this._screenTexture.reverse();
    }
    _drawTexture(texture, opacity) {
        const gl = this.gl;
        const program = this._programs.screen;
        gl.useProgram(program.program);
        this._util.bindTexture(program.u_screen, texture);
        gl.uniform1f(program.u_opacity, opacity);
        gl.uniform2f(program.u_canvasOrigin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvasSize, this._canvasSize[0], this._canvasSize[1]);
        this._util.bindTexture(program.u_windTex, this._windTextures.textures[this._texIndex]);
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
    _drawParticles() {
        const gl = this.gl;
        const program = this._programs.draw;
        gl.useProgram(program.program);
        const windTex = this._windTextures.textures[this._texIndex];
        this._util.bindAttribute(this._lineCoordBuffer, program.a_index, 2);
        this._util.bindAttribute(this._lineRoleBuffer, program.a_role, 1);
        this._util.bindTexture(program.u_windTex, windTex);
        gl.uniform1f(program.u_timeFac, this._timeFac);
        gl.uniform2f(program.u_canvasOrigin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvasSize, this._canvasSize[0], this._canvasSize[1]);
        gl.uniform2f(program.u_particleTexRes, this._particleTexRes[0], this._particleTexRes[1]);
        gl.uniform2f(program.u_windMin, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_windMax, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_windSpdMin, this.minSpeedColor);
        gl.uniform1f(program.u_windSpdMax, this.maxSpeedColor);
        this._util.bindTexture(program.u_colorRamp, this._colorRampTexture);
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
    _updateParticlePos() {
        const gl = this.gl;
        this._util.bindFramebuffer(this._framebuffer, this._particlePosTex.write);
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
        this._util.bindTexture(program.u_windTex, windTex);
        this._util.bindTexture(program.u_particlePosTex, this._particlePosTex.read);
        this._util.bindTexture(program.u_particleAgeTex, this._particleAgeTex.read);
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
            read: this._particlePosTex.write,
            write: this._particlePosTex.read
        };
    }
    _updateParticleAge() {
        const gl = this.gl;
        this._util.bindFramebuffer(this._framebuffer, this._particleAgeTex.write);
        gl.viewport(0, 0, this._particleTexRes[0], this._particleTexRes[1]);
        const program = this._programs.updateAge;
        const windTex = this._windTextures.textures[this._texIndex];
        gl.useProgram(program.program);
        this._util.bindAttribute(this._particleCoordBuffer, program.a_pos, 2);
        this._util.bindTexture(program.u_windTex, windTex);
        this._util.bindTexture(program.u_particlePosTex, this._particlePosTex.read);
        this._util.bindTexture(program.u_particleAgeTex, this._particleAgeTex.read);
        gl.uniform1f(program.u_timeFac, this._timeFac);
        gl.uniform2f(program.u_windRes, this._windData.width, this._windData.height);
        gl.uniform2f(program.u_canvasOrigin, this._canvasOrigin[0], this._canvasOrigin[1]);
        gl.uniform2f(program.u_canvasSize, this._canvasSize[0], this._canvasSize[1]);
        gl.uniform2f(program.u_windMin, this._windData.uMin, this._windData.vMin);
        gl.uniform2f(program.u_windMax, this._windData.uMax, this._windData.vMax);
        gl.uniform1f(program.u_windSpeedMin, this._windData.uMin);
        gl.uniform1f(program.u_windSpeedMax, this._windData.uMax);
        gl.uniform2f(program.u_particleTexRes, this._particleTexRes[0], this._particleTexRes[1]);
        gl.uniform1f(program.u_particleLength, this._particleLength);
        gl.uniform1f(program.u_dropRate, this.dropRate);
        gl.uniform1f(program.u_speedFactor, this.speedFactor);
        gl.drawArrays(gl.POINTS, 0, this._numPoints());
        // swap the read and write textures
        this._particleAgeTex = {
            read: this._particleAgeTex.write,
            write: this._particleAgeTex.read
        };
    }
    readUint8Texture(texture, width, height) {
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
        let pos = [];
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i] / 255.0 / 255.0; // normalize to [0, 1]
            const g = pixels[i + 1] / 255.0 / 255.0; // normalize to [0, 1]
            const b = pixels[i + 2] / 255.0;
            const a = pixels[i + 3] / 255.0;
            pos.push([r + b, g + a]);
        }
        return pos;
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

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Built-in value references. */
var Symbol = root.Symbol;

/** Used for built-in method references. */
var objectProto$1 = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto$1.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString$1 = objectProto$1.toString;

/** Built-in value references. */
var symToStringTag$1 = Symbol ? Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag$1),
      tag = value[symToStringTag$1];

  try {
    value[symToStringTag$1] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString$1.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag$1] = tag;
    } else {
      delete value[symToStringTag$1];
    }
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && baseGetTag(value) == symbolTag);
}

/** Used to match a single whitespace character. */
var reWhitespace = /\s/;

/**
 * Used by `_.trim` and `_.trimEnd` to get the index of the last non-whitespace
 * character of `string`.
 *
 * @private
 * @param {string} string The string to inspect.
 * @returns {number} Returns the index of the last non-whitespace character.
 */
function trimmedEndIndex(string) {
  var index = string.length;

  while (index-- && reWhitespace.test(string.charAt(index))) {}
  return index;
}

/** Used to match leading whitespace. */
var reTrimStart = /^\s+/;

/**
 * The base implementation of `_.trim`.
 *
 * @private
 * @param {string} string The string to trim.
 * @returns {string} Returns the trimmed string.
 */
function baseTrim(string) {
  return string
    ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, '')
    : string;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = baseTrim(value);
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

/**
 * Gets the timestamp of the number of milliseconds that have elapsed since
 * the Unix epoch (1 January 1970 00:00:00 UTC).
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Date
 * @returns {number} Returns the timestamp.
 * @example
 *
 * _.defer(function(stamp) {
 *   console.log(_.now() - stamp);
 * }, _.now());
 * // => Logs the number of milliseconds it took for the deferred invocation.
 */
var now = function() {
  return root.Date.now();
};

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked. The debounced function comes with a `cancel` method to cancel
 * delayed `func` invocations and a `flush` method to immediately invoke them.
 * Provide `options` to indicate whether `func` should be invoked on the
 * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
 * with the last arguments provided to the debounced function. Subsequent
 * calls to the debounced function return the result of the last `func`
 * invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is
 * invoked on the trailing edge of the timeout only if the debounced function
 * is invoked more than once during the `wait` timeout.
 *
 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
 *
 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
 * for details over the differences between `_.debounce` and `_.throttle`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to debounce.
 * @param {number} [wait=0] The number of milliseconds to delay.
 * @param {Object} [options={}] The options object.
 * @param {boolean} [options.leading=false]
 *  Specify invoking on the leading edge of the timeout.
 * @param {number} [options.maxWait]
 *  The maximum time `func` is allowed to be delayed before it's invoked.
 * @param {boolean} [options.trailing=true]
 *  Specify invoking on the trailing edge of the timeout.
 * @returns {Function} Returns the new debounced function.
 * @example
 *
 * // Avoid costly calculations while the window size is in flux.
 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
 *
 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
 * jQuery(element).on('click', _.debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * }));
 *
 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
 * var source = new EventSource('/stream');
 * jQuery(source).on('message', debounced);
 *
 * // Cancel the trailing debounced invocation.
 * jQuery(window).on('popstate', debounced.cancel);
 */
function debounce(func, wait, options) {
  var lastArgs,
      lastThis,
      maxWait,
      result,
      timerId,
      lastCallTime,
      lastInvokeTime = 0,
      leading = false,
      maxing = false,
      trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  wait = toNumber(wait) || 0;
  if (isObject(options)) {
    leading = !!options.leading;
    maxing = 'maxWait' in options;
    maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  function invokeFunc(time) {
    var args = lastArgs,
        thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    // Reset any `maxWait` timer.
    lastInvokeTime = time;
    // Start the timer for the trailing edge.
    timerId = setTimeout(timerExpired, wait);
    // Invoke the leading edge.
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    var timeSinceLastCall = time - lastCallTime,
        timeSinceLastInvoke = time - lastInvokeTime,
        timeWaiting = wait - timeSinceLastCall;

    return maxing
      ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time) {
    var timeSinceLastCall = time - lastCallTime,
        timeSinceLastInvoke = time - lastInvokeTime;

    // Either this is the first call, activity has stopped and we're at the
    // trailing edge, the system time has gone backwards and we're treating
    // it as the trailing edge, or we've hit the `maxWait` limit.
    return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
      (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
  }

  function timerExpired() {
    var time = now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart the timer.
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timerId = undefined;

    // Only invoke if we have `lastArgs` which means `func` has been
    // debounced at least once.
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timerId = undefined;
  }

  function flush() {
    return timerId === undefined ? result : trailingEdge(now());
  }

  function debounced() {
    var time = now(),
        isInvoking = shouldInvoke(time);

    lastArgs = arguments;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxing) {
        // Handle invocations in a tight loop.
        clearTimeout(timerId);
        timerId = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timerId === undefined) {
      timerId = setTimeout(timerExpired, wait);
    }
    return result;
  }
  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
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
        map.on('movestart resizestart zoomstart', this._stopAnimation, this);
        map.on('moveend resizeend zoomend', this._debounceDraw, this);
        this._draw();
        return this;
    }
    _debounceDraw = debounce(() => {
        this._draw();
    }, 16);
    onRemove(map) {
        map.getPanes().overlayPane.removeChild(this._canvas);
        map.off('movestart resizestart zoomstart', this._stopAnimation, this);
        map.off('moveend resizeend zoomend', this._draw, this);
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
        console.log('stopping animation');
    }
    _draw() {
        this._stopAnimation();
        // Define geographic bounds: 0 to 30N latitude, 20 to 65E longitude
        this._setCanvasBounds();
        this._windGl.reset();
        setTimeout(() => {
            console.log('starting animation');
            this._startAnimation();
        }, 1);
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
