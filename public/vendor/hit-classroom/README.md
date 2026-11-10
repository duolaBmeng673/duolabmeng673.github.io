# Upstream classroom engine

`room-app.js` is an unmodified copy of `work/room-app.js` from
https://github.com/duolaBmeng673/hit-classroom-select

- Revision: `42256c0` (local source inspected on 2026-11-10).
- SHA-256: `cff85b4cd99b85153ec16608964416f6722ad0a7a48d56535a8d3d8241b31ef7`.
- The source repository belongs to the site owner; no separate license was present.
- No backend, login UI, diagnostic artifacts, credentials or snapshots are copied.

The Astro page mounts this engine in offline mode. Blog theme mapping and
copy adjustments live in `src/scripts/tools/classrooms.ts` and
`src/styles/tools/classrooms.css`, outside the upstream engine.

To update, review upstream changes, replace only this file, update this revision
and hash, and rerun the integration tests. Do not copy local exports or session
files into the public site.
