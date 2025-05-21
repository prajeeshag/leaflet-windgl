import * as L from 'leaflet';

const PurpleCanvasLayer = L.Layer.extend({
    initialize: function (options?: L.LayerOptions) {
        L.setOptions(this, options);
    },

    onAdd: function (map: L.Map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-purple-canvas') as HTMLCanvasElement;
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
        const size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        this._canvas.style.width = size.x + 'px';
        this._canvas.style.height = size.y + 'px';
    },

    _reset: function () {
        this._updateSize();
        this._draw();
    },

    _draw: function () {
        const ctx = this._canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        ctx.fillStyle = 'purple';
        ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    }
});

export function purpleCanvasLayer(options?: L.LayerOptions) {
    // @ts-ignore
    return new PurpleCanvasLayer(options);
}