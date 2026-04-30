/** Tiny WebGL helpers. Throws on any failure to keep the demo terse. */

export interface GLContext {
  /**
   * The actual rendering context. Typed as the WebGL1 base since that's the
   * narrowest API that satisfies all callers; the `isWebGL2` flag tells the
   * caller whether they can rely on WebGL2-only features (integer textures,
   * GLSL ES 3.00) downstream.
   */
  gl: WebGLRenderingContext;
  isWebGL2: boolean;
}

/**
 * Try WebGL2 first so we can exercise integer textures (uint16 ndarrays);
 * fall back to WebGL1 if unavailable. The caller must consult `isWebGL2`
 * before sampling integer textures.
 */
export function getGL(canvas: HTMLCanvasElement): GLContext {
  const opts: WebGLContextAttributes = { antialias: false, premultipliedAlpha: true };
  const gl2 = canvas.getContext("webgl2", opts);
  if (gl2) return { gl: gl2 as unknown as WebGLRenderingContext, isWebGL2: true };
  const gl1 = canvas.getContext("webgl", opts);
  if (gl1) return { gl: gl1, isWebGL2: false };
  throw new Error("WebGL is not supported in this browser");
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "(no log)";
    gl.deleteShader(shader);
    throw new Error("shader compile failed: " + log);
  }
  return shader;
}

export function createProgram(gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  const vs = compileShader(gl, gl.VERTEX_SHADER, vert);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "(no log)";
    gl.deleteProgram(program);
    throw new Error("program link failed: " + log);
  }
  return program;
}

/** Allocate and bind a static fullscreen-quad VBO (two triangles). */
export function createFullscreenQuad(gl: WebGLRenderingContext, attribLocation: number): void {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("createBuffer failed");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(attribLocation);
  gl.vertexAttribPointer(attribLocation, 2, gl.FLOAT, false, 0, 0);
}

// ---- Shader sources -------------------------------------------------------
//
// Two variants: WebGL1 (GLSL ES 1.00) lays out a 2x2 grid; WebGL2 (GLSL ES 3.00)
// lays out a 3x2 grid that adds the uint16 ndarray quadrant sampled through a
// `usampler2D` and its uint8-downcast neighbour for visual comparison.
//
// Cell layout (UV origin = bottom-left):
//   WebGL1 2x2:                WebGL2 3x2:
//     +--------+--------+        +--------+--------+--------+
//     | canvas | image  |        | canvas | image  | video  |
//     +--------+--------+        +--------+--------+--------+
//     | video  | uint8  |        | uint8  | uint16 | info   |
//     +--------+--------+        +--------+--------+--------+

export const VERT_SRC_GL1 = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAG_SRC_GL1 = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_canvas;
uniform sampler2D u_image;
uniform sampler2D u_video;
uniform sampler2D u_ndarray;
void main() {
  vec2 cell = v_uv * 2.0;
  vec2 local = fract(cell);
  bool top = cell.y > 1.0;
  bool right = cell.x > 1.0;
  vec4 color;
  if (top && !right) {
    color = texture2D(u_canvas, local);
  } else if (top && right) {
    color = texture2D(u_image, local);
  } else if (!top && !right) {
    color = texture2D(u_video, local);
  } else {
    color = texture2D(u_ndarray, local);
  }
  gl_FragColor = color;
}
`;

export const VERT_SRC_GL2 = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// 3x2 grid. The uint16 cell samples a `usampler2D` and divides by 65535.0 to
// get a normalized float, demonstrating the WebGL2 integer-texture path. The
// bottom-right `info` cell is rendered as a flat dark colour (the sidebar
// carries the actual info text).
export const FRAG_SRC_GL2 = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
in vec2 v_uv;
uniform sampler2D u_canvas;
uniform sampler2D u_image;
uniform sampler2D u_video;
uniform sampler2D u_uint8;
uniform usampler2D u_uint16;
out vec4 fragColor;
void main() {
  vec2 cell = v_uv * vec2(3.0, 2.0);
  vec2 local = fract(cell);
  int col = int(floor(cell.x));
  bool top = cell.y > 1.0;
  vec4 color;
  if (top && col == 0) {
    color = texture(u_canvas, local);
  } else if (top && col == 1) {
    color = texture(u_image, local);
  } else if (top && col == 2) {
    color = texture(u_video, local);
  } else if (!top && col == 0) {
    color = texture(u_uint8, local);
  } else if (!top && col == 1) {
    color = vec4(texture(u_uint16, local)) / 65535.0;
  } else {
    // Info cell: a subtle dark panel so it reads as "no texture here".
    color = vec4(0.06, 0.07, 0.10, 1.0);
  }
  fragColor = color;
}
`;
