#!/usr/bin/env python3
"""Copy the independent standalone demo or its particle renderer to a new folder."""
import argparse
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', required=True, type=Path)
    parser.add_argument('--mode', choices=['standalone', 'runtime'], default='runtime')
    args = parser.parse_args()
    destination = args.destination.expanduser().resolve()
    if destination.exists():
        parser.error('Destination already exists; choose a new folder to preserve existing files.')
    template = Path(__file__).resolve().parents[1] / 'assets/template'
    if args.mode == 'standalone':
        shutil.copytree(template, destination)
    else:
        destination.mkdir(parents=True)
        for name in ['particle-engine.js', 'LICENSE']:
            shutil.copyfile(template / name, destination / name)
    print(f'Created {args.mode}: {destination}')


if __name__ == '__main__':
    main()
