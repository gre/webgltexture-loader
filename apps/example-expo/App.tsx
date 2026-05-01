import { CameraView, useCameraPermissions } from "expo-camera";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LoaderResolver } from "webgltexture-loader";
// Side-effect import: registers ExpoCameraTextureLoader on the global registry
// so `resolver.resolve(cameraRef)` matches it.
import "webgltexture-loader-expo-camera";

type Status = "idle" | "loading" | "ready" | "rendering" | "error";

// Camera resolution reported back through the status bar. expo-camera
// doesn't surface the actual sensor frame size synchronously, and the
// shader just samples 0..1, so any sensible default works.
const CAMERA_WIDTH = 720;
const CAMERA_HEIGHT = 1280;

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Grayscale + invert. The Y flip keeps the live preview right-side-up
// regardless of the camera's native texture orientation on iOS/Android.
const FRAG_SRC = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
void main() {
  vec4 c = texture2D(u_tex, vec2(v_uv.x, 1.0 - v_uv.y));
  float g = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(vec3(1.0 - g), 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("gl.createShader returned null");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "(no info log)";
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

function linkProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error("gl.createProgram returned null");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? "(no info log)";
    gl.deleteProgram(prog);
    throw new Error(`program link failed: ${log}`);
  }
  return prog;
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const resolverRef = useRef<LoaderResolver | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Tear down RAF + GPU resources on unmount. The GLView destroys its EXGL
  // context independently, but the loader holds an EXGL camera-texture id
  // that we must free explicitly via `resolver.dispose()`.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      resolverRef.current?.dispose();
      resolverRef.current = null;
    };
  }, []);

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Loading camera permission status...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission required.</Text>
        <Text style={styles.muted}>Grant access in system settings to run the smoke test.</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    try {
      const cam = cameraRef.current;
      if (!cam) {
        setStatus("error");
        setErrorMsg("camera ref not yet attached when GLView initialised");
        return;
      }

      setStatus("loading");
      const resolver = new LoaderResolver(gl);
      resolverRef.current = resolver;
      // Pass the explicit `{ camera, width, height }` form: per the loader's
      // own warning, the bare ref returns 0/0 dimensions and the cache then
      // sticks at 0/0 even after a re-load.
      const input = { camera: cam, width: CAMERA_WIDTH, height: CAMERA_HEIGHT } as const;
      const loader = resolver.resolve(input);
      if (!loader) {
        setStatus("error");
        setErrorMsg("no loader matched the camera ref (registry empty?)");
        return;
      }

      const result = await loader.load(input);
      setSize({ w: result.width, h: result.height });
      setStatus("ready");

      const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      const prog = linkProgram(gl, vs, fs);

      // Two triangles covering NDC [-1,1]^2.
      const verts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

      gl.useProgram(prog);
      const aPos = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const uTex = gl.getUniformLocation(prog, "u_tex");
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, result.texture);
      // The camera-texture is an external texture; CLAMP_TO_EDGE + LINEAR is
      // the safe default that all OpenGL ES 2 stacks accept.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(uTex, 0);

      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 1);

      setStatus("rendering");
      const draw = () => {
        // The loader contract requires `update()` per frame for live
        // sources so the texture re-syncs with the latest camera frame.
        loader.update(input);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.endFrameEXP();
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  // CameraView fills the screen so the native camera session has a real
  // preview size, then the GLView fully covers it — the visible output
  // (inverted grayscale) comes from the loader, not the raw preview.
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      <View style={styles.statusBar}>
        <Text style={styles.text}>status: {status}</Text>
        {size ? (
          <Text style={styles.text}>
            texture: {size.w}x{size.h}
          </Text>
        ) : null}
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#000",
  },
  statusBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Menlo",
  },
  muted: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  error: {
    color: "#ff8a8a",
    fontSize: 12,
    fontFamily: "Menlo",
    marginTop: 4,
  },
});
