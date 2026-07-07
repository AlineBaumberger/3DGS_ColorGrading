import * as THREE from "three";
import { SparkControls, SparkRenderer, SplatMesh, dyno, } from "@sparkjsdev/spark";
import "./pico.classless.min.css";

// Setup the scene and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

// Set the renderer size and camera parameters to match the window geometry
const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};
onResize();
window.addEventListener("resize", onResize);

// SparkRenderer is the one that draws the splats
scene.add(new SparkRenderer({renderer}));


// SparkControls allow you to move the camera with the keyboard and mouse
const controls = new SparkControls({canvas: renderer.domElement});

const backgroundSlider = document.getElementById("background-color") as HTMLInputElement;

const updateBackgroundColor = () => {
  const gray = backgroundSlider.valueAsNumber / 100; // 0 (noir) à 1 (blanc)
  scene.background = new THREE.Color(gray, gray, gray);
};
updateBackgroundColor(); // applique la couleur initiale au chargement
backgroundSlider.addEventListener("input", updateBackgroundColor);


// Add a colorful butterfly to the scene
const butterfly = new SplatMesh({url: "argente_resized.spz"});
butterfly.quaternion.set(1, 0, 0, 0);
butterfly.position.set(0, 0, -2);
scene.add(butterfly);

// Wait for the model to finish loading and retrieve the splats
await butterfly.initialized;
const splats = butterfly.packedSplats!;

console.log("SH extra data:", splats.extra);
console.log("A des sh1 ?", !!splats.extra?.sh1);
console.log("A des sh2 ?", !!splats.extra?.sh2);
console.log("A des sh3 ?", !!splats.extra?.sh3);

// Inclinaison
const butterflyGroup = new THREE.Group();
butterflyGroup.position.set(0, 0, -2); // la position se met sur le GROUPE
scene.add(butterflyGroup);

butterfly.quaternion.set(1, 0, 0, 0); // orientation de base, inchangée
butterfly.position.set(0, 0, 0);      // position relative au groupe = 0 (déjà géré par le groupe)
butterflyGroup.add(butterfly);        // le papillon devient enfant du groupe

const tiltSlider = document.getElementById("tilt") as HTMLInputElement;

const updateTilt = () => {
  const tiltDegrees = tiltSlider.valueAsNumber;
  butterflyGroup.rotation.x = THREE.MathUtils.degToRad(tiltDegrees);
};
updateTilt();
tiltSlider.addEventListener("input", updateTilt);
//
//iterate over the splats and transform them
const originalColors: THREE.Color[] = [];
splats.forEachSplat((index, center, scales, quat, opacity, color) => {
  originalColors[index] = color.clone();
});

//button pour activer/desactiver les harmoniques sphériques
const toggleShButton = document.getElementById("toggle-sh") as HTMLButtonElement;

const updateToggleShButtonLabel = () => {
  toggleShButton.textContent = `Harmoniques sphériques : ${butterfly.maxSh > 0 ? "ON" : "OFF"}`;
};

toggleShButton.addEventListener("click", () => {
  butterfly.maxSh = butterfly.maxSh > 0 ? 0 : 3;
  butterfly.updateGenerator();
  updateToggleShButtonLabel();
});

//

//sliders HUE, BRIGHT, SAT
const hueSlider= document.getElementById("hue") as HTMLInputElement;
const saturationSlider= document.getElementById("saturation") as HTMLInputElement;
const brightnessSlider= document.getElementById("brightness") as HTMLInputElement;

// Function to update the colors of the splats based on the slider values
const applyColorGrading = () => {
  const hueShift = hueSlider.valueAsNumber / 360; // Convert to range [0, 1]
  const satShift = saturationSlider.valueAsNumber / 100;
  const briShift = brightnessSlider.valueAsNumber / 100;

  const hsl = { h: 0, s: 0, l: 0 };

  splats.forEachSplat((index, center, scales, quat, opacity, color) => {
    // Convert original color to HSL
    originalColors[index].getHSL(hsl);

    // Apply shifts
    const h = (hsl.h + hueShift + 1) % 1;
    const s = Math.min(Math.max(hsl.s + satShift, 0), 1);
    const l = Math.min(Math.max(hsl.l + briShift, 0), 1);

    color.setHSL(h, s, l);

      splats.setSplat(index, center, scales, quat, opacity, color);
  });

  splats.needsUpdate = true;
};
// Add event listeners to the sliders to update colors when they change
hueSlider.addEventListener("change", applyColorGrading);
saturationSlider.addEventListener("change", applyColorGrading);
brightnessSlider.addEventListener("change", applyColorGrading);

//

const exampleColorPicker = document.getElementById("example-color-picker") as HTMLInputElement;
  //convert color pickers in values
const liftColorInput= document.getElementById("lift-color") as HTMLInputElement;
const gammaColorInput = document.getElementById("gamma-color") as HTMLInputElement;
const gainColorInput = document.getElementById("gain-color") as HTMLInputElement;

const recolor = new dyno.DynoVec3({ value: new THREE.Vector3(1, 1, 1) });
const liftDyno = new dyno.DynoVec3({ value: new THREE.Vector3(0, 0, 0) });
const gammaDyno = new dyno.DynoVec3({ value: new THREE.Vector3(1, 1, 1) });
const gainDyno = new dyno.DynoVec3({ value: new THREE.Vector3(1, 1, 1) });

butterfly.worldModifier = dyno.dynoBlock(
  { gsplat: dyno.Gsplat },
  { gsplat: dyno.Gsplat },
  ({ gsplat }) => {
    const oldRgb = dyno.splitGsplat(gsplat!).outputs.rgb;

    //1. recolor: multi simple recolor
    let rgb = dyno.mul(oldRgb, recolor);

    //2. lift, gamma, gain
    rgb = dyno.add(rgb, liftDyno);
    rgb = dyno.max(rgb, dyno.dynoConst("float", 0));
    rgb = dyno.pow(rgb, gammaDyno);
    rgb = dyno.mul(rgb, gainDyno);

    // clamp final, en deux étapes avec des bornes float (pas vec3)
    rgb = dyno.max(rgb, dyno.dynoConst("float", 0));
    rgb = dyno.min(rgb, dyno.dynoConst("float", 1));

    gsplat = dyno.combineGsplat({ gsplat: gsplat!, rgb });
    return { gsplat };
  }
);
butterfly.updateGenerator(); // compile le shader une fois

const updateRecolor = () => {
  const c = new THREE.Color(exampleColorPicker.value);
  recolor.value = new THREE.Vector3(c.r, c.g, c.b);
};
updateRecolor();
exampleColorPicker.addEventListener("input", updateRecolor);

//met a jour des pickers de couleur lift, gamma, gain
const updateLiftGammaGain = () => {
  const lift = new THREE.Color(liftColorInput.value);
  const gamma = new THREE.Color(gammaColorInput.value);
  const gain = new THREE.Color(gainColorInput.value);

  // Lift : centre sur 0 (gris 0.5 -> 0, noir -> -0.5, blanc -> +0.5)
  liftDyno.value = new THREE.Vector3(
    (lift.r - 0.5) * 0.3,
    (lift.g - 0.5) * 0.3,
    (lift.b - 0.5) * 0.3
  );

  // Gamma : gris (0.5) -> exposant neutre 1
  gammaDyno.value = new THREE.Vector3(
    Math.pow(2, (0.5 - gamma.r) * 2*0.5),
    Math.pow(2, (0.5 - gamma.g) * 2*0.5),
    Math.pow(2, (0.5 - gamma.b) * 2*0.5)
  );
  // Gain : gris (0.5) -> multiplicateur neutre 1, plage 0 a 2
  gainDyno.value = new THREE.Vector3(
    1+ (gain.r - 0.5) * 2 *0.5,
    1+ (gain.g - 0.5) * 2 *0.5,
    1+ (gain.b - 0.5) * 2 *0.5
  );
};
liftColorInput.addEventListener("change", updateLiftGammaGain);
gammaColorInput.addEventListener("change", updateLiftGammaGain);
gainColorInput.addEventListener("change", updateLiftGammaGain);


// nombre de splats dans console et sur page web
const packedSplats = butterfly.packedSplats;
if (packedSplats) {
  packedSplats.initialized.then(() => {
    console.log("Nombre de splats:", packedSplats.numSplats);

    const info= document.createElement("div");
    info.style.position = "absolute";
    info.style.top = "10px";
    info.style.left = "50%";
    info.style.transform = "translateX(-50%)";
    info.style.color = "white";
    info.style.fontFamily = "sans-serif";
    info.style.fontSize = "14px";
    info.textContent = `Nombre de splats: ${packedSplats.numSplats}`;
    document.body.appendChild(info);
  });
}

// Get notified when the value of each control changes
let rotationSpeed = 0;
const rotationSpeedRange = document.getElementById("rotation-speed") as HTMLInputElement;
const updateRotationSpeed = () => { rotationSpeed = rotationSpeedRange.valueAsNumber; };
updateRotationSpeed();
rotationSpeedRange.addEventListener("input", updateRotationSpeed);

// Function that updates the scene on every frame
renderer.setAnimationLoop(
  () => {
    butterfly.rotation.y += rotationSpeed;
    controls.update(camera);
    renderer.render(scene, camera);
  }
);
