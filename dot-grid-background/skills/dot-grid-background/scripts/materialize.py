#!/usr/bin/env python3
"""Create a standalone dot-grid preview or a runtime asset directory."""

import argparse
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--mode", choices=("standalone", "runtime"), default="runtime")
    args = parser.parse_args()

    destination = args.destination.expanduser().resolve()
    if destination.exists():
        parser.error("Destination already exists; choose a new folder.")

    template = Path(__file__).resolve().parents[1] / "assets" / "template"
    destination.mkdir(parents=True)

    names = ("index.html", "styles.css", "app.js", "dot-grid.js") if args.mode == "standalone" else ("styles.css", "dot-grid.js")
    for name in names:
        shutil.copyfile(template / name, destination / name)

    print(f"Created {args.mode}: {destination}")


if __name__ == "__main__":
    main()
