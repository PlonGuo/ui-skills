#!/usr/bin/env python3
"""Create a standalone floating-dots preview or its three runtime modules."""

import argparse
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', required=True, type=Path)
    parser.add_argument('--mode', choices=('runtime', 'standalone'), default='runtime')
    args = parser.parse_args()
    destination = args.destination.expanduser().absolute()
    if destination.exists() or destination.is_symlink():
        parser.error('Destination already exists; choose a new folder to preserve existing files.')

    template = Path(__file__).resolve().parents[1] / 'assets' / 'template'
    try:
        if args.mode == 'standalone':
            shutil.copytree(template, destination)
        else:
            destination.mkdir(parents=True)
            for name in ('floating-dots-engine.js', 'motion.js', 'noise-field.js', 'LICENSE', 'NOTICE.md'):
                shutil.copyfile(template / name, destination / name)
    except OSError as error:
        parser.exit(1, f'Could not create {args.mode}: {error}\n')
    print(f'Created {args.mode}: {destination}')


if __name__ == '__main__':
    main()
