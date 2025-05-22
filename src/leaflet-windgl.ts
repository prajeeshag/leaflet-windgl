import { WindData } from './wind/windgl';
export { WindData };
import WindGL from './wind/windgl';

const L = globalThis.L as typeof import('leaflet');

const LeafletWindGL = L.Layer.extend({
    initialize: function (windData: WindData, options?: L.LayerOptions) {
        L.setOptions(this, options);
        this._windData = windData;
        this._frame = this._frame.bind(this)
        this._animationId = null;
    },

    onAdd: function (map: L.Map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-purple-canvas') as HTMLCanvasElement;
        if (!this._canvas) {
            throw new Error('Failed to create canvas element');
        }
        // get webgl from canvas
        const gl = this._canvas.getContext('webgl') as WebGLRenderingContext;
        if (!gl) {
            throw new Error('Failed to get WebGL context');
        }
        this._windGl = new WindGL(gl, this._windData);
        // Set the canvas size to the map size 
        this._canvas.style.position = 'absolute';
        this._updateSize();

        map.getPanes().overlayPane.appendChild(this._canvas);

        map.on('move resize zoom', this._reset, this);
        this._reset();
    },

    onRemove: function (map: L.Map) {
        map.getPanes().overlayPane.removeChild(this._canvas);
        map.off('move resize zoom', this._reset, this);
    },

    _updateSize: function () {
        // Don't set the size here as we'll set it in _draw based on the geographic bounds
    },

    _reset: function () {
        this._updateSize();
        this._draw();
    },

    _frame: function () {
        this._windGl.draw(this._delta_time);
        const time = performance.now();
        this._delta_time += (time - this._prev_time) * this._facAnim
        console.log(this._delta_time);
        this._delta_time = this._delta_time % 1.5;
        this._prev_time = time;
        this._animationId = requestAnimationFrame(this._frame);
    },

    _startAnimation: function () {
        if (this._animationId !== null) {
            cancelAnimationFrame(this._animationId);
        }
        this._animationId = requestAnimationFrame(this._frame);
    },

    _stopAnimation: function () {
        if (this._animationId !== null) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
    },

    _draw: function () {
        this._stopAnimation();
        // Define geographic bounds: 0 to 30N latitude, 20 to 65E longitude
        const southWest = L.latLng(0, 20);
        const northEast = L.latLng(30, 65);
        const bounds = L.latLngBounds(southWest, northEast);

        // Convert geographic bounds to layer points (relative to the map's top-left corner)
        const topLeft = this._map.latLngToLayerPoint(bounds.getNorthWest());
        const bottomRight = this._map.latLngToLayerPoint(bounds.getSouthEast());

        // Calculate rectangle dimensions in pixels
        const width = bottomRight.x - topLeft.x;
        const height = bottomRight.y - topLeft.y;

        // Position the canvas correctly using the offset of the overlay pane
        const pos = L.DomUtil.getPosition(this._map.getPanes().overlayPane);

        // Set the canvas dimensions and position
        this._canvas.width = width;
        this._canvas.height = height;
        this._canvas.style.width = width + 'px';
        this._canvas.style.height = height + 'px';

        // Position the canvas with respect to the overlay pane
        this._canvas.style.position = 'absolute';
        this._canvas.style.left = (topLeft.x + pos.x) + 'px';
        this._canvas.style.top = (topLeft.y + pos.y) + 'px';
        this._windGl.reset();
        this._prev_time = performance.now();
        this._delta_time = 0;
        this._facAnim = 0.001 / 120.;
        // const frame = () => {
        //     this._windGl.draw(this._delta_time);
        //     const time = performance.now();
        //     this._delta_time += (time - this._prev_time) * this._facAnim
        //     console.log(this._delta_time);
        //     this._delta_time = this._delta_time % 1.5;
        //     this._prev_time = time;
        //     requestAnimationFrame(frame);
        // }
        this._startAnimation();
    }
});

export function leafletWindGL(windData: WindData, options?: L.LayerOptions) {
    // @ts-ignore
    return new LeafletWindGL(windData, options);
}