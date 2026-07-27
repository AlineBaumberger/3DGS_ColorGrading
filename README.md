# Color Grading & Relighting for 3D Gaussian Splats

This project explores color grading and relighting of objects reconstructed with **3D Gaussian Splatting (3DGS)**, directly in the browser, using [Spark](https://sparkjs.dev) and [Three.js](https://threejs.org).

A scanned insect (3DGS) serves as the subject of experimentation: it lets you adjust its appearance in real time (color, exposure, simulated lighting) and export the result.

## Overview

This project offers several levels of intervention on Gaussian Splats and more precisely Spherical Harmonics from global recoloring to point light simulation with Blinn-Phong and exporting the baked lighting into the spherical harmonics.

## Run
- npm run dev

## Tech stack

| Tool | Role |
|---|---|
| [Node.js](https://nodejs.org) / npm | JS runtime and dependency management |
| [Vite](https://vitejs.dev) | Development server and bundler |
| [TypeScript](https://www.typescriptlang.org) | Static typing on top of JavaScript |
| [Three.js](https://threejs.org) | Generic 3D engine (scene, camera, WebGL rendering) |
| [Spark](https://sparkjs.dev) | Gaussian Splat rendering within Three.js |
| Dyno (part of Spark) | Shader graph system for writing rendering modifications in TypeScript, compiled to GLSL and run on the GPU |
| [Pico CSS](https://picocss.com) | Minimal styling for native HTML controls (sliders, buttons) |

## Features

- **Loading and displaying** a `.spz` (Gaussian Splat) file, with adjustable rotation and tilt
- **Recoloring**: a global multiplicative tint applied to the object
- **Hue / Saturation / Brightness**: classic color adjustments, applied per splat (CPU)
- **Lift / Gamma / Gain**: cinema-style color grading (shadows / midtones / highlights), implemented on the GPU via Dyno for better performance and to also affect the spherical harmonics
- **Spherical harmonics toggle**, to observe their effect on the render depending on viewing angle
- **Adjustable background** (grayscale level)
- **Splat normal estimation** (`GsplatNormal`) with false-color visualization


## Project structure

```
.
├── index.html          
├── src/
│   └── main.ts          
├── public/
│   └── *.spz           
├── package.json
└── vite.config.ts
```

## Technical notes

- **Hue/saturation/brightness** adjustments modify the splat's CPU data directly (`forEachSplat` / `setSplat`), which remains correct for a moderate number of splats but is less performant at scale.
- **Recolor / lift / gamma / gain** are implemented via a Dyno `worldModifier`, running entirely on the GPU and able to affect the spherical harmonics contribution.
- Spherical harmonics aren't guaranteed to be meaningful in every `.spz` file; their visual effect depends on the directional variation captured during the scan (very diffuse lighting at scan time yields small coefficients, hence a subtle effect).

## Resources

- [Spark documentation](https://sparkjs.dev/docs/)
- [Blinn-Phong model](https://cientistavuador.github.io/articles/1_en-us.html) // todo
- [PBR Book Roughness & Microfacet Theory](https://pbr-book.org/4ed/Reflection_Models/Roughness_Using_Microfacet_Theory)
