/**
 * WebGL2-based HDR rendering surface.
 *
 * Uploads Float32 RGBA chunk data as half-float texture sub-images and renders
 * a fullscreen quad. Combined with `drawingBufferColorSpace: "display-p3"`,
 * values > 1.0 render brighter than SDR white on HDR displays.
 */

const VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_tex;
void main() {
  fragColor = texture(u_tex, v_uv);
}`;

export interface WebGLPainter {
  gl: WebGL2RenderingContext;
  texture: WebGLTexture;
  program: WebGLProgram;
  width: number;
  height: number;
  /** Upload a chunk's float RGBA data at (0, y) and redraw. */
  paintChunk(
    buffer: ArrayBuffer,
    chunkWidth: number,
    chunkY: number,
    chunkHeight: number,
  ): void;
  /** Fill the texture with black. */
  clear(): void;
  /** Resize the texture to match new canvas dimensions. */
  resize(width: number, height: number): void;
  /** Redraw the fullscreen quad (call after paintChunk batch). */
  flush(): void;
  /** Clean up GL resources. */
  destroy(): void;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info ?? "unknown"}`);
  }
  return shader;
}

/**
 * Initialize a WebGL2 HDR rendering surface on the given canvas.
 * Returns null if WebGL2 or required extensions are unavailable.
 */
export function createWebGLPainter(
  canvas: HTMLCanvasElement,
): WebGLPainter | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    premultipliedAlpha: false,
    antialias: false,
  });
  if (!gl) return null;

  if ("drawingBufferColorSpace" in gl) {
    (
      gl as WebGL2RenderingContext & { drawingBufferColorSpace: string }
    ).drawingBufferColorSpace = "display-p3";
  }

  const halfFloatExt = gl.getExtension("EXT_color_buffer_half_float");
  if (!halfFloatExt) {
    // Fall back — can still work with RGBA8 but no HDR brightness
  }

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  const posLoc = gl.getAttribLocation(program, "a_pos");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let w = canvas.width;
  let h = canvas.height;
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, null);

  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, "u_tex"), 0);

  const painter: WebGLPainter = {
    gl,
    texture,
    program,
    width: w,
    height: h,

    paintChunk(buffer, chunkWidth, chunkY, chunkHeight) {
      const data = new Float32Array(buffer);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // WebGL2 Y=0 is bottom; canvas chunk Y=0 is top. Flip.
      const glY = h - chunkY - chunkHeight;
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        glY,
        chunkWidth,
        chunkHeight,
        gl.RGBA,
        gl.FLOAT,
        data,
      );
    },

    clear() {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        w,
        h,
        0,
        gl.RGBA,
        gl.FLOAT,
        null,
      );
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },

    resize(newWidth, newHeight) {
      w = newWidth;
      h = newHeight;
      painter.width = w;
      painter.height = h;
      gl.viewport(0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        w,
        h,
        0,
        gl.RGBA,
        gl.FLOAT,
        null,
      );
    },

    flush() {
      gl.viewport(0, 0, w, h);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    destroy() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };

  return painter;
}
