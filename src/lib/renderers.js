
import colormap from 'colormap'
import * as d3 from 'd3'
import Image from './image'
const magma = colormap({
    colormap: 'magma',
    nshades: 16,
    format: 'hex'
})

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
