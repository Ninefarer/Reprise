"""Compare Windows PE icon resources with an approved ICO without executing the PE.

Windows only; Python standard library. Use resource ID 32512 for Tauri apps,
103 for NSIS installers/uninstallers. No shell icon APIs or caches are involved.
"""

import argparse
import ctypes
import hashlib
import struct
from pathlib import Path


def ico_frames(path):
    data = path.read_bytes()
    reserved, kind, count = struct.unpack_from("<HHH", data)
    if (reserved, kind) != (0, 1) or not count:
        raise ValueError(f"Invalid ICO: {path}")
    frames = []
    for index in range(count):
        offset = 6 + index * 16
        size, start = struct.unpack_from("<II", data, offset + 8)
        payload = data[start:start + size]
        if len(payload) != size:
            raise ValueError("Truncated ICO frame")
        # RC normalizes ICO planes=0 to planes=1. Compare dimensions, depth,
        # size and the complete image bytes, excluding only that header field.
        metadata = data[offset:offset + 4] + data[offset + 6:offset + 12]
        frames.append((metadata, payload))
    return frames


def pe_frames(path, group_id):
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    signatures = {
        "LoadLibraryExW": ([ctypes.c_wchar_p, ctypes.c_void_p, ctypes.c_uint], ctypes.c_void_p),
        "FindResourceW": ([ctypes.c_void_p] * 3, ctypes.c_void_p),
        "LoadResource": ([ctypes.c_void_p] * 2, ctypes.c_void_p),
        "SizeofResource": ([ctypes.c_void_p] * 2, ctypes.c_uint),
        "LockResource": ([ctypes.c_void_p], ctypes.c_void_p),
        "FreeLibrary": ([ctypes.c_void_p], ctypes.c_int),
    }
    for name, (args, result) in signatures.items():
        function = getattr(kernel, name)
        function.argtypes, function.restype = args, result

    # LOAD_LIBRARY_AS_DATAFILE: map resources only, never run application code.
    handle = kernel.LoadLibraryExW(str(path.resolve()), None, 2)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())

    def resource(kind, name):
        entry = kernel.FindResourceW(handle, name, kind)
        if not entry:
            raise ctypes.WinError(ctypes.get_last_error())
        size = kernel.SizeofResource(handle, entry)
        pointer = kernel.LockResource(kernel.LoadResource(handle, entry))
        if not pointer or not size:
            raise ValueError(f"Empty resource {kind}/{name}")
        return ctypes.string_at(pointer, size)

    try:
        group = resource(14, group_id)  # RT_GROUP_ICON
        frames = []
        for index in range(struct.unpack_from("<H", group, 4)[0]):
            offset = 6 + index * 14
            image_id = struct.unpack_from("<H", group, offset + 12)[0]
            metadata = group[offset:offset + 4] + group[offset + 6:offset + 12]
            frames.append((metadata, resource(3, image_id)))
        return frames
    finally:
        kernel.FreeLibrary(handle)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ico", required=True, type=Path)
    parser.add_argument("--resource-id", type=int, default=32512)
    parser.add_argument("files", nargs="+", type=Path)
    args = parser.parse_args()
    expected = ico_frames(args.ico)
    for path in args.files:
        actual = pe_frames(path, args.resource_id)
        if actual != expected:
            raise SystemExit(f"FAIL: {path}: resource differs from {args.ico}")
        digest = hashlib.sha256(b"".join(frame[1] for frame in actual)).hexdigest()
        print(f"PASS: {path}: {len(actual)} frames; payload SHA256 {digest}")


if __name__ == "__main__":
    main()
