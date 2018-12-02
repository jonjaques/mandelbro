
import {rgb} from 'd3'
import parseColor from './parse-color'

export default class Image {
  constructor(...args) {
    this.image = new ImageData(...args);
  }

  setPixelColor(x, y, color = '#000') {
    const r = this.getPixelIndicesStart(x, y)
    const parsed = parseColor(color)
    this.image.data[r] = parsed[0]
    this.image.data[r + 1] = parsed[1]
    this.image.data[r + 2] = parsed[2]
    this.image.data[r + 3] = 255
  }

  getPixelColor(x, y) {
    const [r, g, b, a] = this.getPixelIndices(x, y)
    return rgb(r, g, b, a / 255)
  }

  getPixelIndicesStart(x, y) {
    return y * (this.image.width * 4) + x * 4
  }

  getPixelIndices(x, y) {
    const rIdx = this.getPixelIndicesStart(x, y)
    const gIdx = rIdx + 1
    const bIdx = rIdx + 2
    const aIdx = rIdx + 3
    return [rIdx, gIdx, bIdx, aIdx]
  }

  getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
}