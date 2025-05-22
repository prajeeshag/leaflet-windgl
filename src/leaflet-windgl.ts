import { WindData } from './wind/windgl';
export { WindData };
import WindGL from './wind/windgl';

const L = globalThis.L as typeof import('leaflet');

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

    private _setCanvasBounds() {
        const southWest = L.latLng(0, 20);
        const northEast = L.latLng(30, 65);
        //const bounds = L.latLngBounds(southWest, northEast);
        const bounds = new L.LatLngBounds(southWest, northEast);

        // Convert geographic bounds to layer points (relative to the map's top-left corner)
        const topLeftL = this._map.latLngToLayerPoint(bounds.getNorthWest());
        const bottomRightL = this._map.latLngToLayerPoint(bounds.getSouthEast());
        const topLeftC = this._map.latLngToContainerPoint(bounds.getNorthWest());
        const bottomRightC = this._map.latLngToContainerPoint(bounds.getSouthEast());

        const containerSize = this._map.getSize();

        const topLeft = { x: topLeftL.x, y: topLeftL.y };
        const bottomRight = { x: bottomRightL.x, y: bottomRightL.y };

        if (topLeftC.x < 0) {
            topLeft.x = topLeft.x - topLeftC.x;
        }
        if (topLeftC.y < 0) {
            topLeft.y = topLeft.y - topLeftC.y;
        }
        if (bottomRightC.x > containerSize.x) {
            bottomRight.x = bottomRight.x - (bottomRightC.x - containerSize.x);
        }
        if (bottomRightC.y > containerSize.y) {
            bottomRight.y = bottomRight.y - (bottomRightC.y - containerSize.y);
        }

        // Calculate rectangle dimensions in pixels
        const width = Math.max(bottomRight.x - topLeft.x, 0);
        const height = Math.max(bottomRight.y - topLeft.y, 0);
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
        this._canvas.style.left = topLeft.x + 'px';
        this._canvas.style.top = topLeft.y + 'px';
    }
}