import 'babel-polyfill'
import * as renderers from './renderers'

self.onmessage = function receiveMessage(event) {
  const [type, width, height, blockSize] = event.data
  const renderer = renderers[type]
  self.postMessage([type, 'begin'])
  for (let block of renderer(width, height, blockSize)) {
    self.postMessage([type, 'progress', block])
  }
  self.postMessage([type, 'end'])
}