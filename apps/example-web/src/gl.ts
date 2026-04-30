/** Tiny WebGL helpers. Throws on any failure to keep the demo terse. */

export function getGL(canvas: HTMLCanvasElement): WebGLRenderingContext {
  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: true });
  if (!gl) throw new Error("WebGL is not supported in this browser");
  return gl;
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

export const VERT_SRC = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAG_SRC = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_canvas;
uniform sampler2D u_image;
uniform sampler2D u_video;
uniform sampler2D u_ndarray;
void main() {
  // 2x2 grid: (0,0) bottom-left, (1,1) top-right (WebGL UV origin = bottom-left).
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
