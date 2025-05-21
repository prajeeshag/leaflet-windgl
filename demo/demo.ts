import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as zarr from "zarrita";

// Create map and test plugin
const map = L.map("map").setView([0, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const baseUrl = `${window.location.origin}/wind.zarr/`;
var store = await zarr.open.v3(new zarr.FetchStore(baseUrl + "U10/"));
