// Canvas-drawn textures for the chamber: the Jalur Gemilang, a crest in the spirit of the Jata Negara, a songket band,
// fluted teak panelling, the clock face and brass nameplates. Drawn once, no image files.

import * as THREE from "three";

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
};
const texture = (c: HTMLCanvasElement, repeat?: [number, number]) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
};

function star(g: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number) {
  g.beginPath();
  for (let k = 0; k < 28; k++) {
    const r = k % 2 ? inner : outer;
    const a = (k * Math.PI) / 14 - Math.PI / 2;
    g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  g.closePath();
  g.fill();
}

export function flagTexture() {
  const { c, g } = canvas(280, 140);
  for (let k = 0; k < 14; k++) {
    g.fillStyle = k % 2 ? "#ffffff" : "#cc0001";
    g.fillRect(0, k * 10, 280, 10);
  }
  g.fillStyle = "#010066";
  g.fillRect(0, 0, 140, 80);
  g.fillStyle = "#ffcc00";
  g.beginPath();
  g.arc(50, 40, 27, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#010066";
  g.beginPath();
  g.arc(58, 40, 23, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffcc00";
  star(g, 100, 40, 22, 9);
  return texture(c);
}

/** A crest above the Speaker: a striped shield under a crescent and star, in a gold roundel. */
export function crestTexture() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = "#c9a24a";
  g.beginPath();
  g.arc(128, 128, 124, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#7a5a1c";
  g.lineWidth = 6;
  g.stroke();
  g.save();
  g.beginPath();
  g.moveTo(78, 100);
  g.lineTo(178, 100);
  g.lineTo(178, 170);
  g.quadraticCurveTo(128, 215, 78, 170);
  g.closePath();
  g.clip();
  ["#cc0001", "#ffffff", "#010066", "#ffcc00", "#cc0001"].forEach((col, k) => {
    g.fillStyle = col;
    g.fillRect(78 + k * 20, 100, 20, 120);
  });
  g.restore();
  g.fillStyle = "#ffcc00";
  g.beginPath();
  g.arc(112, 62, 26, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#c9a24a";
  g.beginPath();
  g.arc(120, 58, 23, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffcc00";
  star(g, 150, 62, 17, 7);
  return texture(c);
}

/** A band of songket: gold diamonds on deep red. */
export function songketTexture() {
  const { c, g } = canvas(128, 32);
  g.fillStyle = "#5a0c12";
  g.fillRect(0, 0, 128, 32);
  g.strokeStyle = "#d9b45a";
  g.fillStyle = "#d9b45a";
  g.lineWidth = 2;
  for (let x = 0; x < 128; x += 32) {
    g.beginPath();
    g.moveTo(x + 16, 3);
    g.lineTo(x + 29, 16);
    g.lineTo(x + 16, 29);
    g.lineTo(x + 3, 16);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.arc(x + 16, 16, 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillRect(0, 0, 128, 2);
  g.fillRect(0, 30, 128, 2);
  return texture(c, [24, 1]);
}

/** Fluted teak: vertical grooves and a little grain. */
export function teakTexture() {
  const { c, g } = canvas(256, 256);
  const grad = g.createLinearGradient(0, 0, 256, 0);
  for (let k = 0; k <= 8; k++) {
    grad.addColorStop(k / 8, k % 2 ? "#5d3a20" : "#7a4d2a");
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.globalAlpha = 0.12;
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = y % 2 ? "#2b180b" : "#a06a3c";
    g.fillRect(0, y, 256, 1);
  }
  g.globalAlpha = 1;
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = "rgba(20,10,4,0.55)";
    g.fillRect(x, 0, 2, 256);
    g.fillStyle = "rgba(255,220,170,0.12)";
    g.fillRect(x + 2, 0, 1, 256);
  }
  return texture(c, [12, 2]);
}

/** The clock over the Speaker: ivory face, brass ring, hands at a stately ten past ten. */
export function clockTexture() {
  const { c, g } = canvas(128, 128);
  g.fillStyle = "#c9a24a";
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f4ecd8";
  g.beginPath();
  g.arc(64, 64, 54, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1b1712";
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    g.fillRect(64 + Math.cos(a) * 46 - 2, 64 + Math.sin(a) * 46 - 2, 4, 4);
  }
  g.strokeStyle = "#1b1712";
  g.lineCap = "round";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(64, 64);
  g.lineTo(64 + Math.cos(-Math.PI / 2 - (Math.PI / 6) * 2) * 28, 64 + Math.sin(-Math.PI / 2 - (Math.PI / 6) * 2) * 28);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 64);
  g.lineTo(64 + Math.cos(-Math.PI / 2 + (Math.PI / 6) * 2) * 40, 64 + Math.sin(-Math.PI / 2 + (Math.PI / 6) * 2) * 40);
  g.stroke();
  return texture(c);
}

/** A brass nameplate. */
export function plateTexture(title: string, name: string) {
  const { c, g } = canvas(256, 64);
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "#e3c27a");
  grad.addColorStop(1, "#a8822f");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = "#6e5420";
  g.lineWidth = 3;
  g.strokeRect(2, 2, 252, 60);
  g.fillStyle = "#2a1d08";
  g.textAlign = "center";
  g.font = "bold 17px Georgia, serif";
  g.fillText(title.toUpperCase(), 128, 26);
  g.font = "16px Georgia, serif";
  g.fillText(name.length > 26 ? `${name.slice(0, 25)}…` : name, 128, 50);
  return texture(c);
}
