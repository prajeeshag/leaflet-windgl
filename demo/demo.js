import * as zarr from "https://cdn.jsdelivr.net/npm/zarrita/+esm";
import { WindData, LeafletWindGL } from "./js/leaflet-windgl.js";
import { TimeSlider } from "./js/leaflet-timeslider.js";

const baseUrl = `${window.location}`;
const baseDataUrl = `${baseUrl}/data.zarr/`;
const _openZarr = (url) => {
    return zarr.open.v3(new zarr.FetchStore(baseDataUrl + url), { kind: "array" })
};

var store = await _openZarr('100v')
const vAttr = store.attrs
const vArr = await zarr.get(store)

var store = await _openZarr('100u')
const uAttr = store.attrs
const uArr = await zarr.get(store)

const shape = vArr.shape

var store = await _openZarr('lon')
const lonW = await zarr.get(store, [0])
const lonE = await zarr.get(store, [shape[2] - 1])
var store = await _openZarr('lat')
const latN = await zarr.get(store, [0])
const latS = await zarr.get(store, [shape[1] - 1])

const lat0 = (latN + latS) * 0.5;
const lon0 = (lonE + lonW) * 0.5;

const uData = uArr.data
const vData = vArr.data

const map = L.map("map", {
    crs: L.CRS.EPSG4326,
    maxBounds: [[latS, lonW], [latN, lonE]]
}).setView([lat0, lon0], 2);

// // Set map background to black
map.getContainer().style.background = "black";


fetch(`${baseUrl}/countryMap.geojson`)
    .then(res => res.json())
    .then(geojson => {
        const borderLayer = L.geoJSON(geojson, {
            style: {
                color: 'gray',
                weight: 1,
                fill: false
            }
        })
        borderLayer.addTo(map)
    })


// // L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// create a const wind field of type uint18array
// const tempData = new Uint8Array(uArr.shape[0] * uArr.shape[1] * uArr.shape[2]).fill(254);
// const windData = new WindData(
//     tempData,
//     tempData,
//     [0, -10],
//     [0, 10],
//     uArr.shape[2],
//     uArr.shape[1],
//     uArr.shape[0],
// );
const windData = new WindData(
    uData,
    vData,
    [uAttr.valid_min, uAttr.valid_max],
    [vAttr.valid_min, vAttr.valid_max],
    uArr.shape[2],
    uArr.shape[1],
    uArr.shape[0],
);

const windLayer = new LeafletWindGL(windData, { lonE, lonW, latS, latN })

const slider = new TimeSlider({
    position: 'bottomleft',
    ticks: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    tickLabelColor: 'white',
});

slider.addListener(windLayer.setTimePos.bind(windLayer));

windLayer.addTo(map);
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