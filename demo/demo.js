import * as zarr from "https://cdn.jsdelivr.net/npm/zarrita/+esm";
import { leafletWindGL, WindData } from "/dist/leaflet-windgl.js";
// import { WindData } from "./windgl.js";
// import WindGL from "./windgl.js";

// Create map and test plugin
const map = L.map("map", {
    maxBounds: [[0, 20], [30, 65]]
}).setView([10, 47], 4);

// Set map background to black
map.getContainer().style.background = "black";
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// get the canvas element
// const canvas = document.getElementById("map")
// if (!canvas) {
//     throw new Error("Failed to get canvas element");
// }
// canvas.width = 800;
// canvas.height = 800;
// const gl = canvas.getContext("webgl");
// if (!gl) {
//     throw new Error("Failed to get WebGL context");
// }


const baseUrl = `${window.location.origin}/wind.zarr/`;
const _openZarr = (url) => {
    return zarr.open.v3(new zarr.FetchStore(baseUrl + url), { kind: "array" })
};

var store = await _openZarr('V10')
const vAttr = store.attrs
const vArr = await zarr.get(store)

var store = await _openZarr('U10')
const uAttr = store.attrs
const uArr = await zarr.get(store)
console.log(uArr);

const uData = uArr.data
const vData = vArr.data
const windData = new WindData(
    uData,
    vData,
    [uAttr.valid_min, uAttr.valid_max],
    [vAttr.valid_min, vAttr.valid_max],
    uArr.shape[2],
    uArr.shape[1],
    uArr.shape[0],
);

const windLayer = new leafletWindGL(windData)
windLayer.addTo(map);

// const windLayer = new WindGL(gl, windData);

// var prev_time = performance.now();
// var delta_time = 0;
// const frame = () => {
//     windLayer.draw(delta_time);
//     const time = performance.now();
//     delta_time = (time - prev_time) * 0.001;
//     prev_time = time;
//     requestAnimationFrame(frame);
// }
// requestAnimationFrame(frame);