import * as THREE from "three";
import { SparkControls, SparkRenderer, SplatMesh, dyno } from "@sparkjsdev/spark";
import "./pico.classless.min.css";

// Setup the scene and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};
onResize();
window.addEventListener("resize", onResize);

scene.add(new SparkRenderer({ renderer }));
const controls = new SparkControls({ canvas: renderer.domElement });


//sparse "#RRGGBB" in {r,g,b} between 0 - 1,

const parseHexColor = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
};

// Background
const backgroundSlider = document.getElementById("background-color") as HTMLInputElement;
const updateBackgroundColor = () => {
  const gray = backgroundSlider.valueAsNumber / 100;
  scene.background = new THREE.Color(gray, gray, gray);
};
updateBackgroundColor();
backgroundSlider.addEventListener("input", updateBackgroundColor);

// Tilt and rotation controls
const insectGroup = new THREE.Group();
insectGroup.position.set(0, 0, -2);
scene.add(insectGroup);

const tiltSlider = document.getElementById("tilt") as HTMLInputElement;
const updateTilt = () => {
  insectGroup.rotation.x = THREE.MathUtils.degToRad(tiltSlider.valueAsNumber);
};
updateTilt();
tiltSlider.addEventListener("input", updateTilt);

// Ui controls
const toggleShButton = document.getElementById("toggle-sh") as HTMLButtonElement;
const hueSlider = document.getElementById("hue") as HTMLInputElement;
const saturationSlider = document.getElementById("saturation") as HTMLInputElement;
const brightnessSlider = document.getElementById("brightness") as HTMLInputElement;
const exampleColorPicker = document.getElementById("example-color-picker") as HTMLInputElement;
const liftColorInput = document.getElementById("lift-color") as HTMLInputElement;
const gammaColorInput = document.getElementById("gamma-color") as HTMLInputElement;
const gainColorInput = document.getElementById("gain-color") as HTMLInputElement;
const rotationSpeedRange = document.getElementById("rotation-speed") as HTMLInputElement;
const insectSelector = document.getElementById("insect-selector") as HTMLSelectElement;

let rotationSpeed = 0;
const updateRotationSpeed = () => { rotationSpeed = rotationSpeedRange.valueAsNumber; };
updateRotationSpeed();
rotationSpeedRange.addEventListener("input", updateRotationSpeed);

// Dyno variables used for every example
const recolor = new dyno.DynoVec3({ value: new THREE.Vector3(1, 1, 1) });
const liftDyno = new dyno.DynoVec3({ value: new THREE.Vector3(0, 0, 0) });
const gammaDyno = new dyno.DynoVec3({ value: new THREE.Vector3(1, 1, 1) });
const gainDyno = new dyno.DynoVec3({ value: new THREE.Vector3(1, 1, 1) });


let insect: SplatMesh;
let splats: NonNullable<SplatMesh["packedSplats"]>;
let originalColors: THREE.Color[] = [];

// Used functions for every sample
const applyColorPipeline = () => {
  insect.worldModifier = dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      const oldRgb = dyno.splitGsplat(gsplat!).outputs.rgb;

      let rgb = dyno.mul(oldRgb, recolor);

      rgb = dyno.add(rgb, liftDyno);
      rgb = dyno.max(rgb, dyno.dynoConst("float", 0));
      rgb = dyno.pow(rgb, gammaDyno);
      rgb = dyno.mul(rgb, gainDyno);

      rgb = dyno.max(rgb, dyno.dynoConst("float", 0));
      rgb = dyno.min(rgb, dyno.dynoConst("float", 1));

      gsplat = dyno.combineGsplat({ gsplat: gsplat!, rgb });
      return { gsplat };
    }
  );
  insect.updateGenerator();
};

const applyColorGrading = () => {
  const hueShift = hueSlider.valueAsNumber / 360;
  const satShift = saturationSlider.valueAsNumber / 100;
  const briShift = brightnessSlider.valueAsNumber / 100;

  const hsl = { h: 0, s: 0, l: 0 };

  splats.forEachSplat((index, center, scales, quat, opacity, color) => {
    originalColors[index].getHSL(hsl);

    const h = (hsl.h + hueShift + 1) % 1;
    const s = Math.min(Math.max(hsl.s + satShift, 0), 1);
    const l = Math.min(Math.max(hsl.l + briShift, 0), 1);

    color.setHSL(h, s, l);
    splats.setSplat(index, center, scales, quat, opacity, color);
  });

  splats.needsUpdate = true;
};

// use of parseHexColor instead of new THREE.Color(hex)
const updateRecolor = () => {
  const c = parseHexColor(exampleColorPicker.value);
  recolor.value = new THREE.Vector3(c.r, c.g, c.b);
};


const updateLiftGammaGain = () => {
  const lift = parseHexColor(liftColorInput.value);
  const gamma = parseHexColor(gammaColorInput.value);
  const gain = parseHexColor(gainColorInput.value);

  // Lift (gray 0.5 -> 0, black -> -0.5, white -> +0.5)
  liftDyno.value = new THREE.Vector3(
    (lift.r - 0.5) * 0.3,
    (lift.g - 0.5) * 0.3,
    (lift.b - 0.5) * 0.3
  );

  // Gamma (gray 0.5) 
  gammaDyno.value = new THREE.Vector3(
    Math.pow(2, (0.5 - gamma.r) * 2 * 0.5),
    Math.pow(2, (0.5 - gamma.g) * 2 * 0.5),
    Math.pow(2, (0.5 - gamma.b) * 2 * 0.5)
  );

  // Gain (gray 0.5) 
  gainDyno.value = new THREE.Vector3(
    1 + (gain.r - 0.5) * 2 * 0.5,
    1 + (gain.g - 0.5) * 2 * 0.5,
    1 + (gain.b - 0.5) * 2 * 0.5
  );
};

const updateToggleShButtonLabel = () => {
  toggleShButton.textContent = `Spherical Harmonics : ${insect.maxSh > 0 ? "ON" : "OFF"}`;
};

const updateSplatCountDisplay = () => {
  console.log("Nombre de splats:", splats.numSplats);

  let info = document.getElementById("splat-count-info");
  if (!info) {
    info = document.createElement("div");
    info.id = "splat-count-info";
    info.style.position = "absolute";
    info.style.top = "10px";
    info.style.left = "50%";
    info.style.transform = "translateX(-50%)";
    info.style.color = "white";
    info.style.fontFamily = "sans-serif";
    info.style.fontSize = "14px";
    document.body.appendChild(info);
  }
  info.textContent = `Nombre de splats: ${splats.numSplats}`;
};

// Load 3dgs
const loadInsect = async (url: string) => {
  // Unloads the previous insect if it exists
  if (insect) {
    insectGroup.remove(insect);
    insect.dispose();
  }

  insect = new SplatMesh({ url });
  insect.quaternion.set(1, 0, 0, 0);
  insect.position.set(0, 0, 0); // relative to insectGroup
  insectGroup.add(insect);

  await insect.initialized;
  splats = insect.packedSplats!;

  originalColors = [];
  splats.forEachSplat((index, center, scales, quat, opacity, color) => {
    originalColors[index] = color.clone();
  });

  applyColorPipeline();
  updateRecolor();
  updateLiftGammaGain();
  applyColorGrading();
  updateToggleShButtonLabel();
  updateSplatCountDisplay();
};

// Event listeners
hueSlider.addEventListener("change", applyColorGrading);
saturationSlider.addEventListener("change", applyColorGrading);
brightnessSlider.addEventListener("change", applyColorGrading);

exampleColorPicker.addEventListener("input", updateRecolor);
liftColorInput.addEventListener("change", updateLiftGammaGain);
gammaColorInput.addEventListener("change", updateLiftGammaGain);
gainColorInput.addEventListener("change", updateLiftGammaGain);

toggleShButton.addEventListener("click", () => {
  insect.maxSh = insect.maxSh > 0 ? 0 : 3;
  insect.updateGenerator();
  updateToggleShButtonLabel();
});

insectSelector.addEventListener("change", () => {
  loadInsect(insectSelector.value);
});

// Renderer
await loadInsect(insectSelector.value);

renderer.setAnimationLoop(() => {
  if (insect) {
    insect.rotation.y += rotationSpeed;
  }
  controls.update(camera);
  renderer.render(scene, camera);
});
