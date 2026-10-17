import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../public/admin/image-tools.js", import.meta.url), "utf8");
const calls = [];
const ctx = {
  setTransform: (...args) => calls.push(["reset", ...args]),
  clearRect: (...args) => calls.push(["clear", ...args]),
  fillRect: (...args) => calls.push(["fill", ...args]),
  translate: (...args) => calls.push(["center", ...args]),
  rotate: (...args) => calls.push(["rotate", ...args]),
  drawImage: (...args) => calls.push(["draw", ...args.slice(1)])
};
function canvas(width, height) {
  return {
    width, height,
    getContext: name => name === "2d" ? ctx : null,
    toDataURL: () => "data:image/jpeg;base64,SGVsbG8="
  };
}
const created = [];
let closed = 0;
const sandbox = {
  window: {},
  createImageBitmap: async () => ({width: 1600, height: 800, close: () => closed++}),
  document: {createElement: name => {
    assert.equal(name, "canvas");
    const c = canvas(0, 0);
    created.push(c);
    return c;
  }}
};
vm.runInNewContext(src, sandbox);
const {draw, toJpegData, angle} = sandbox.window.GarageImageTools;

// Clockwise and counterclockwise are normalized, including 270° and -90°.
assert.equal(angle(90), 90);
assert.equal(angle(-90), 270);
assert.equal(angle(450), 90);
assert.equal(angle(-360), 0);

const source = {width: 80, height: 40};
draw(canvas(200,120), source, 90, 10);
assert.equal(calls.find(x => x[0] === "rotate")[1], Math.PI / 2);
assert.deepEqual(calls.find(x => x[0] === "center").slice(1), [100,60]);
assert.deepEqual(calls.find(x => x[0] === "draw").slice(1), [-50,-25,100,50]);
calls.length = 0;
draw(canvas(200,120), source, -90, 10);
assert.equal(calls.find(x => x[0] === "rotate")[1], Math.PI * 1.5);
calls.length = 0;

// 90° orientation swaps dimensions in a full-size editor upload.
const editorJPEG = await toJpegData({},90,"editor");
assert.match(editorJPEG,/^data:image\/jpeg;base64,/);
assert.equal(created[0].width,750);
assert.equal(created[0].height,1500);
assert.equal(calls.find(x => x[0] === "rotate")[1],Math.PI/2);
calls.length=0;

// Batches retain their existing 4:5 padded framing and rotate actual pixels.
await toJpegData({},270,"batch");
assert.equal(created[1].width,1200);
assert.equal(created[1].height,1500);
assert.equal(calls.find(x => x[0] === "rotate")[1],Math.PI*1.5);
assert.equal(closed,2);
console.log("Image rotation: preview math, 90°/270° transforms, JPEG output and cleanup verified.");


// A large generated PNG may become a JPEG above the API limit. The encoder
// must retry at smaller dimensions instead of rejecting the user's image.
let encodeCount = 0;
const beforeCount = created.length;
sandbox.document.createElement = name => {
  assert.equal(name, "canvas");
  const next = canvas(0, 0);
  next.toDataURL = () => {
    encodeCount++;
    return encodeCount <= 4 ? "data:image/jpeg;base64," + "a".repeat(2700000) : "data:image/jpeg;base64,SGVsbG8=";
  };
  created.push(next);
  return next;
};
const compressed = await toJpegData({}, 0, "editor");
assert.match(compressed, /^data:image\/jpeg;base64,/);
assert.equal(encodeCount, 5);
assert.equal(created.length, beforeCount + 2);
assert.ok(created[beforeCount+1].width < created[beforeCount].width);
console.log("Oversized image: adaptive re-encoding and downscaling verified.");
