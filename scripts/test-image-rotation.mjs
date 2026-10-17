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
