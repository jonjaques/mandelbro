import useRendererStore from "../stores/renderer";

export function renderNoise(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
) {
  const state = useRendererStore.getState();
  console.log("renderNoise");
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const color = Math.floor(Math.random() * 255);
    imageData.data[i + 0] = color;
    imageData.data[i + 1] = color;
    imageData.data[i + 2] = color;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  state.renderDone();
}
