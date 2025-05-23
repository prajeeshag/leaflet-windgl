import numpy as np
import typer
import xarray as xr

app = typer.Typer()


def compute_offset_scale(
    data: np.ndarray, target_dtype: str = "u2"
) -> tuple[float, float, float, float]:
    """
    Compute offset and scale to quantize float data into an integer range.

    Args:
        data: Input float32/float64 array.
        target_dtype: Target integer dtype (e.g., 'u2', 'i2').

    Returns:
        offset, scale such that:
            encoded = ((data - offset) / scale).round().astype(target_dtype)
            decoded = (encoded.astype('f4') * scale) + offset
    """
    kind = np.dtype(target_dtype).kind
    info = np.iinfo(target_dtype)
    print(np.dtype(target_dtype))

    data_min, data_max = np.nanmin(data), np.nanmax(data)
    offset = data_min

    # compute required integer range
    int_min = 0 if kind == "u" else info.min
    int_max = info.max
    print(f"dtype {target_dtype}: range {int_min} to {int_max}")
    scale = (data_max - data_min) / (int_max - int_min)

    return scale, offset, data_min, data_max


@app.command()
def process_data(input_file: str, output_file: str) -> None:
    ds = xr.open_dataset(input_file)
    dtype = "u1"
    for v in ds.data_vars:
        var = ds[v]
        scale, offset, dmin, dmax = compute_offset_scale(
            var.values,
            target_dtype=dtype,
        )
        var.values = ((var.values - offset) / scale).round().astype(dtype)
        # flip y-axis
        var.attrs["scale_factor"] = scale
        var.attrs["add_offset"] = offset
        var.attrs["valid_min"] = dmin
        var.attrs["valid_max"] = dmax
        ds[v] = var
        # Ensure Zarr metadata uses the correct dtype
        encoding = {v: {"dtype": var.dtype, "compressors": None}}
        print(
            f"Variable {v} has been quantized to {dtype} with scale {scale} and offset {offset}."
        )
    ds.to_zarr(output_file, mode="w", consolidated=False, encoding=encoding)


if __name__ == "__main__":
    app()
