
import colormap from 'colormap'
import * as d3 from 'd3'
import Image from './image'

export function* noiseGenerator(width, height, blockSize = 128) {
  const blocksHoriz = width / blockSize
  const blocksVert = height / blockSize
  for (let blockX = 0; blockX < blocksHoriz; blockX++) {
    for (let blockY = 0; blockY < blocksVert; blockY++) {
      const image = new Image(blockSize, blockSize)
      const imageData = image.image
      const xPos = blockX * blockSize
      const yPos = blockY * blockSize
      for (let x = 0; x < blockSize; x++) {
        for (let y = 0; y < blockSize; y++) {
          image.setPixelColor(x, y, image.getRandomColor())
        }
      }
      yield { imageData, xPos, yPos, blockSize }
    }
  }
}

export function* mandelbrotGenerator(width, height, blockSize = 128, maxIterations = 16) {
  const blocksHoriz = width / blockSize
  const blocksVert = height / blockSize

  const palette = colormap({
    colormap: 'magma',
    nshades: maxIterations,
    format: 'hex'
  })

  const xScalar = d3.scaleLinear()
  .domain([0, width])
  .range([-2.5, 1])

  const yScalar = d3.scaleLinear()
  .domain([0, height])
  .range([-1, 1])

  console.log(xScalar(0), xScalar(1000))
  console.log(yScalar(0), yScalar(1000))
  for (let blockX = 0; blockX < blocksHoriz; blockX++) {
    for (let blockY = 0; blockY < blocksVert; blockY++) {
      const image = new Image(blockSize, blockSize)
      const imageData = image.image
      const xPos = blockX * blockSize
      const yPos = blockY * blockSize
      const histogram = {}
      for (let px = 0; px < blockSize; px++) {
        for (let py = 0; py < blockSize; py++) {
          const x0 = xScalar(xPos + px)
          const y0 = yScalar(yPos + py)
          let x = 0.0
          let y = 0.0
          let iteration = 0
          while (x * x + y * y < 4 && iteration < maxIterations) {
            let xtemp = x * x - y * y + x0
            y = 2 * x * y + y0
            x = xtemp
            iteration = iteration + 1
          }
          const color = palette[iteration]
          image.setPixelColor(px, py, color)
        }

        // histogram[iteration] = histogram[iteration]
        //   ? histogram[iteration]++
        //   : 1
        // total = 0
        // for (i = 0; i < max_iterations; i += 1) {
        //   total += histogram[i]
        // }

        // hue = 0.0;
        // for (i = 0; i <= iteration; i += 1) {
        //   hue += histogram[i] / total // Must be floating-point division.
        // }

        // color = palette[hue]

      }
      yield { imageData, xPos, yPos, blockSize }
    }
  }
}

/*
For each pixel (Px, Py) on the screen, do:
{
  x0 = scaled x coordinate of pixel (scaled to lie in the Mandelbrot X scale (-2.5, 1))
  y0 = scaled y coordinate of pixel (scaled to lie in the Mandelbrot Y scale (-1, 1))
  x = 0.0
  y = 0.0
  iteration = 0
  max_iteration = 1000
  while (x*x + y*y < 2*2  AND  iteration < max_iteration) {
    xtemp = x*x - y*y + x0
    y = 2*x*y + y0
    x = xtemp
    iteration = iteration + 1
  }
  color = palette[iteration]
  plot(Px, Py, color)
}
*/