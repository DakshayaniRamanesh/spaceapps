# Featured real-data snapshot

Five D3 / 12-arcminute preview snapshots contain 22 genuine exposures. The default Explorer loads the R Draconis field at ICRS RA 248.167611°, Dec
66.754979°, FOV 12 arcminutes, detector D3. The shared IRSA processor selected
the default two exposures from a bounded assessment of the archive metadata, not from a
generated star field. See each manifest and inventory for exact records.

The `original/` directory contains the exact unmodified IRSA FITS cutout response
bytes. Filenames are their SHA-256 hashes. `.npz` files contain derived, masked,
north-up science/variance/wavelength/bandwidth arrays. PNGs are display previews
using one reproducible asinh stretch. The manifest records the grid, units,
flags policy, foreground treatment, data source, UTC times and pair verdicts.

These snapshots are deliberately available without a live archive connection.
They do not update silently. New custom requests use runtime caches with TTLs.
Regenerate into a fresh output directory with
`python backend/tools/prepare_featured.py --target r-dra --output backend/data/new-snapshot`,
review the result, and promote the directory intentionally.

Verify without network: `python backend/tools/verify_featured.py`.

No scientific subtraction, variability detection, or measured proper motion is
certified by these previews. The comparison evidence explains the limitations.

This publication makes use of data products from the Spectro-Photometer for the
History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which
is a joint project of the Jet Propulsion Laboratory and the California Institute
of Technology, and is funded by the National Aeronautics and Space Administration.
