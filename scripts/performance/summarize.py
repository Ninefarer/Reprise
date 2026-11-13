"""Summarize metadata-only QA snapshots against explicit observation markers."""
import argparse
from collections import Counter
import json
from math import ceil
from pathlib import Path
from statistics import median

STATES = {
    "main-visible_capture-hidden": {"main": (True, False), "capture": (False, False)},
    "main-hidden_capture-hidden": {"main": (False, False), "capture": (False, False)},
    "main-minimized_capture-hidden": {"main": (True, True), "capture": (False, False)},
    "main-hidden_capture-visible": {"main": (False, False), "capture": (True, False)},
}


def summarize(rows, markers):
    results = []
    for index, marker in enumerate(markers):
        phase = marker["phase"]
        if phase not in STATES:
            continue
        start = marker["at_ms"]
        end = start + 90_000
        if index + 1 >= len(markers) or markers[index + 1]["at_ms"] < end:
            raise ValueError(f"Incomplete 90-second observation: {phase}")
        sample = [r for r in rows if start <= r["at_ms"] < end
                  and r["reason"] in ("timer", "event", "explicit")]
        windows = {}
        for window, state in STATES[phase].items():
            selected = [r for r in sample if r["window"] == window]
            if not selected:
                raise ValueError(f"No snapshots for {phase}/{window}")
            if any((r["visible"], r["minimized"]) != state for r in selected):
                raise ValueError(f"Window state changed within {phase}/{window}")
            if any(r["tasks"] != 100 or r["notifications"] != 100 for r in selected):
                raise ValueError("Synthetic profile size changed")
            timings = sorted(r["phases"]["snapshot_total_ms"] for r in selected)
            windows[window] = {
                "snapshots": len(selected),
                "reasons": dict(Counter(r["reason"] for r in selected)),
                "per_minute": len(selected) / 1.5,
                "logical_json_bytes": sum(r["bytes"] for r in selected),
                "backend_median_ms": round(median(timings), 4),
                "backend_p95_ms": round(timings[ceil(len(timings) * .95) - 1], 4),
                "native_visible": state[0],
                "native_minimized": state[1],
                "document_visibility": sorted({r.get("document_visibility", "not recorded")
                                               for r in selected}),
            }
        results.append({"phase": phase, "duration_seconds": 90, "windows": windows})
    if len(results) != len(STATES):
        raise ValueError("All four window-state observations are required")
    return {"profile": {"tasks": 100, "notifications": 100},
            "excluded": "startup, focus, transitions and samples outside each first 90 seconds",
            "observations": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("log", type=Path)
    parser.add_argument("markers", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    rows = [json.loads(line) for line in args.log.read_text(encoding="utf-8").splitlines()]
    markers = json.loads(args.markers.read_text(encoding="utf-8"))
    result = summarize(rows, markers)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
