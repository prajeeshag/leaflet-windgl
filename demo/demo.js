import * as zarr from "https://cdn.jsdelivr.net/npm/zarrita/+esm";
import { WindData, LeafletWindGL } from "/dist/leaflet-windgl.js";
import { TimeSlider } from "/dist/leaflet-timeslider.js";

// import { WindData } from "./windgl.js";
// import WindGL from "./windgl.js";

// Create map and test plugin
const map = L.map("map", {
    // crs: crsLambert,
    maxBounds: [[0, 20], [30, 65]]
}).setView([10, 47], 5);




// Set map background to black
map.getContainer().style.background = "black";
// L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

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

const windLayer = new LeafletWindGL(windData)
windLayer.addTo(map);

const slider = new TimeSlider({
    position: 'bottomleft',
    ticks: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    tickLabelColor: 'white',
    onChange: idx => { console.log('Selected:', idx); }
});
map.addControl(slider);

// var store = await _openZarr('lon')
// const lonAttr = store.attrs
// const lonArr = await zarr.get(store)

// var store = await _openZarr('lat')
// const latAttr = store.attrs
// const latArr = await zarr.get(store)

// console.log(lonArr)
// console.log(latArr)
// const shape = lonArr.shape
// const stride = lonArr.stride
// const lonbl = getValueAtIndex(lonArr, [0, 0]);
// const lontl = getValueAtIndex(lonArr, [shape[0] - 1, 0]);
// const lontr = getValueAtIndex(lonArr, [shape[0] - 1, shape[1] - 1]);
// const lonbr = getValueAtIndex(lonArr, [0, shape[1] - 1]);
// const latbl = getValueAtIndex(latArr, [0, 0]);
// const lattl = getValueAtIndex(latArr, [shape[0] - 1, 0]);
// const lattr = getValueAtIndex(latArr, [shape[0] - 1, shape[1] - 1]);
// const latbr = getValueAtIndex(latArr, [0, shape[1] - 1]);

// console.log({ lonbl, latbl, lontl, lattl, lontr, lattr, lonbr, latbr });

// const xybl = map.latLngToLayerPoint([latbl, lonbl]);
// const xytl = map.latLngToLayerPoint([lattl, lontl]);
// const xytr = map.latLngToLayerPoint([lattr, lontr]);
// const xybr = map.latLngToLayerPoint([latbr, lonbr]);
// console.log({ xybl, xytl, xytr, xybr });


// function getValueAtIndex(data, indexes) {
//     if (data.shape.length !== indexes.length) {
//         throw new Error("Shape and indexes must have the same length");
//     }
//     let idx = 0;
//     let stride = 1;
//     for (let i = data.shape.length - 1; i >= 0; i--) {
//         idx += indexes[i] * stride;
//         stride *= data.shape[i];
//     }
//     return data.data[idx];
// }


// // create a const wind field of type uint18array
// // const tempData = new Uint8Array(uArr.shape[0] * uArr.shape[1] * uArr.shape[2]).fill(254);
// // const windData = new WindData(
// //     tempData,
// //     tempData,
// //     [0, 0],
// //     [0, 10],
// //     uArr.shape[2],
// //     uArr.shape[1],
// //     uArr.shape[0],
// // );



// const crsLambert = new L.Proj.CRS('EPSG:3035',
//     '+proj=lcc +lat_1=18 +lat_2=27 +lat_0=24 +lon_0=45 +ellps=GRS80 +units=m +no_defs',
//     {
//         resolutions: [
//             4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1
//         ],
//     }
// );