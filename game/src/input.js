// Keyboard + mouse input for VAULTBREAK.
// The sim only ever sees a plain object: {mx, my, run, clicked, clickX, clickY}.
// In Node (tests, shots) there is no DOM, so makeHeadlessInput supplies the same shape.

const MOVE_KEYS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function makeHeadlessInput() {
  return {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    clickQueue: [],
    isDown(code) {
      return this.keys.has(code);
    },
    press(code) {
      this.keys.add(code);
    },
    release(code) {
      this.keys.delete(code);
    },
    clickAt(x, y) {
      this.clickQueue.push({ x, y });
    },
    axis() {
      let x = 0;
      let y = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    running() {
      return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    },
    takeClick() {
      return this.clickQueue.shift() || null;
    },
  };
}

export function attachInput(canvas) {
  const pad = makeHeadlessInput();

  const onKeyDown = (event) => {
    if (MOVE_KEYS[event.code] || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      event.preventDefault();
    }
    pad.press(event.code);
    if (typeof pad.onKey === 'function') pad.onKey(event.code, true);
  };
  const onKeyUp = (event) => {
    pad.release(event.code);
    if (typeof pad.onKey === 'function') pad.onKey(event.code, false);
  };
  const onMouseMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    pad.mouseX = ((event.clientX - rect.left) / rect.width) * 960;
    pad.mouseY = ((event.clientY - rect.top) / rect.height) * 600;
  };
  const onMouseDown = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 960;
    const y = ((event.clientY - rect.top) / rect.height) * 600;
    pad.clickAt(x, y);
  };
  const onBlur = () => {
    pad.keys.clear();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('blur', onBlur);

  pad.detach = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('blur', onBlur);
  };
  return pad;
}
