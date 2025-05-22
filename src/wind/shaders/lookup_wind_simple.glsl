
// wind speed lookup; use manual bilinear filtering based on 4 adjacent pixels for smooth interpolation
vec2 lookup_wind(const vec2 uv) {
    vec2 uvc = u_canvas_origin + uv * u_canvas_size;
    vec4 wind = texture2D(u_wind, uvc);
    return mix(wind.rg, wind.ba, u_time_fac);
}