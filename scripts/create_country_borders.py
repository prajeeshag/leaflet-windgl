import geopandas as gpd  # type: ignore
import matplotlib.pyplot as plt  # type: ignore
import typer
import xarray as xr
from shapely.geometry import Polygon  # type: ignore

app = typer.Typer()


@app.command()
def create_country_borders(
    input_file: str,
    data_file: str,
    output_file: str,
) -> None:
    """
    Create country borders from a shapefile and save to GeoJSON.
    """
    # Load the country boundaries shapefile
    gdf = gpd.read_file(input_file)
    borders_gdf = gpd.GeoDataFrame(geometry=gdf.boundary)

    ds = xr.open_dataset(data_file)
    xlat = ds["lon"].values
    xlon = ds["lat"].values

    # Define a rectangular region using the bounds of the dataset
    min_lon, max_lon = xlon.min(), xlon.max()
    min_lat, max_lat = xlat.min(), xlat.max()
    polygon_area = [
        (min_lat, min_lon),
        (min_lat, max_lon),
        (max_lat, max_lon),
        (max_lat, min_lon),
        (min_lat, min_lon),
    ]

    clip_poly = Polygon(polygon_area)

    # Step 3: Manually intersect each LineString and keep resulting segments
    clipped_geoms = []

    for line in borders_gdf.geometry:
        clipped = line.intersection(clip_poly)
        if clipped.is_empty:
            continue
        if clipped.geom_type == "LineString":
            clipped_geoms.append(clipped)
        elif clipped.geom_type == "MultiLineString":
            clipped_geoms.extend([seg for seg in clipped.geoms if seg.length > 0])

    # Step 4: Create clipped GeoDataFrame of open border segments
    clipped_gdf = gpd.GeoDataFrame(geometry=clipped_geoms, crs="EPSG:3857")
    # clipped_gdf = gpd.GeoDataFrame(geometry=clipped_geoms)

    clipped_gdf.to_file(output_file, driver="GeoJSON")

    # Plot the clipped GeoDataFrame
    fig, ax = plt.subplots(figsize=(10, 10))
    clipped_gdf.plot(ax=ax, color="blue", linewidth=0.5)
    ax.set_title("Clipped Country Borders")
    plt.savefig("clipped_country_borders.png", dpi=300)


if __name__ == "__main__":
    app()
