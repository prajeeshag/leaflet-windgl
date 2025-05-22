import { WindData } from './wind/windgl';
export { WindData };
import WindGL from './wind/windgl';

const L = globalThis.L as typeof import('leaflet');

type Bound = {
    tl: { x: number; y: number };
    br: { x: number; y: number };
};

export class LeafletWindGL extends L.Layer {
    private _windData: WindData;
    private _canvas!: HTMLCanvasElement;
    private _windGl!: WindGL;
    // private _map!: L.Map;
    private _animationId: number | null = null;
    private _prev_time!: number;
    private _delta_time: number = 0;
    private _facAnim: number = 0.001 / 120.;
    private _canvasExists: boolean = false;

    constructor(windData: WindData, options?: L.LayerOptions) {
        super(options);
        L.setOptions(this, options);
        this._windData = windData;
        this._frame = this._frame.bind(this);
    }

    onAdd(map: L.Map): this {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-purple-canvas') as HTMLCanvasElement;
        if (!this._canvas) {
            throw new Error('Failed to create canvas element');
        }
        const gl = this._canvas.getContext('webgl') as WebGLRenderingContext;
        if (!gl) {
            throw new Error('Failed to get WebGL context');
        }
        this._windGl = new WindGL(gl, this._windData);
        this._canvas.style.position = 'absolute';
        this._updateSize();

        map.getPanes().overlayPane.appendChild(this._canvas);

        map.on('move resize zoom', this._reset, this);
        this._reset();
        return this;
    }

    onRemove(map: L.Map): this {
        map.getPanes().overlayPane.removeChild(this._canvas);
        map.off('move resize zoom', this._reset, this);
        this._stopAnimation();
        return this;
    }

    private _updateSize() {
        // Don't set the size here as we'll set it in _draw based on the geographic bounds
    }

    private _reset = () => {
        this._updateSize();
        this._draw();
    };

    private _frame() {
        this._windGl.draw(this._delta_time);
        const time = performance.now();
        this._delta_time += (time - this._prev_time) * this._facAnim;
        this._delta_time = this._delta_time % 1.5;
        this._prev_time = time;
        this._animationId = requestAnimationFrame(this._frame);
    }

    private _startAnimation() {
        if (this._animationId !== null) {
            cancelAnimationFrame(this._animationId);
        }
        if (!this._canvasExists) {
            return;
        }
        this._animationId = requestAnimationFrame(this._frame);
    }

    private _stopAnimation() {
        if (this._animationId !== null) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
    }

    private _draw() {
        this._stopAnimation();
        // Define geographic bounds: 0 to 30N latitude, 20 to 65E longitude
        this._setCanvasBounds();
        this._windGl.reset();
        this._prev_time = performance.now();
        this._delta_time = 0;
        this._facAnim = 0.001 / 120.;
        this._startAnimation();
    }

    private _setCanvasGrid(canvasBound: Bound, gridBound: Bound) {
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

    private _setCanvasBounds() {
        const northWest = L.latLng(30, 20);
        const southEast = L.latLng(0, 65);

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
        // Position the canvas correctly using the offset of the overlay pane
        // const pos = L.DomUtil.getPosition(this._map.getPanes().overlayPane);

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