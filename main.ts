// Vice City Cover — the hand-in program (Node 22, standard library only).
//
// This entry is a plain offline web app: app/index.html plus its own
// scripts, styles, bundled OFL fonts and sample photos, with no build step
// and no network request. This program's only job is to hand that app in:
// it copies app/ and screenshots/ from beside this file into the output
// directory and writes output/dossier.json with the kit's vendored
// buildDossier, the summary the judge reads.
//
// Run it outside the grader like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader MAKEFUN_OUTPUT_DIR is unset and /output is used.
//
// Serve the app locally with `node serve.ts`, then open
// http://localhost:8080 in desktop Chrome.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Caps from the scorer's gate: app/ stays under 993 files and 48 MiB,
// screenshots at most 4 files of 256 KiB each, and the dossier text is
// capped at 160 KiB, so the whole output fits the platform's own limits.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
