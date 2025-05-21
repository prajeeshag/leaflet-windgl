import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Import your plugin from relative path

// Create map and test plugin
const map = L.map("map").setView([0, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
