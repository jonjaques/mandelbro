import {memoize} from 'lodash'

export default memoize(parseColor)

const test = [17, 1, 0.062272]

function parseColor(input) {
  if (input.substr(0,1) === '#') {
    const collen = (input.length - 1) / 3
    const fact = test[collen-1]
    return [
      Math.round(parseInt(input.substr(1,collen),16) * fact),
      Math.round(parseInt(input.substr(1 + collen, collen),16) * fact),
      Math.round(parseInt(input.substr(1 + 2 * collen, collen),16) * fact)
    ]
  }
  const rgb = input.split('(')[1].split(")")[0].split(",")
  return rgb.map(x => parseInt(x, 10))
}

