import React, {Component} from 'react'

export default class Renderer extends Component {
  constructor(props) {
    super(props)
    this.state = { rendering: false }
    this.renderer = React.createRef()
    this.registerWorker()
  }

  componentDidMount() {
    this.registerListeners()
    this.registerContext()
    this.startRender()
  }

  handleMouseWheel(e) {
    console.log('mouseWheel', e)
  }

  handleGesture(e) {
    console.log('gesture', e)
  }

  handleClick(e) {
    console.log('click', e)
  }

  getCanvas() {
    return this.renderer.current
  }

  registerListeners() {
    const canvas = this.getCanvas()
    canvas.addEventListener('mousewheel', this.handleMouseWheel.bind(this))
    canvas.addEventListener('gesturechange', this.handleGesture.bind(this))
    canvas.addEventListener('click', this.handleClick.bind(this))
  }

  registerContext() {
    const canvas = this.getCanvas()
    this.scale = window.devicePixelRatio
    this.width = document.body.clientWidth
    this.height = document.body.clientHeight
    this.scaledWidth = canvas.width = this.width * this.scale
    this.scaledHeight = canvas.height = this.height * this.scale
    this.ctx = canvas.getContext('2d')
    this.ctx.scale(this.scale, this.scale)
  }

  registerWorker() {
    this.worker = new Worker('../lib/worker.js')
    this.worker.addEventListener('message', this.handleMessage.bind(this))
  }

  handleMessage(e) {
    const [_, step, data] = e.data
    if (step === 'start') {
      this.setState({ rendering: true })
    } else if (step === 'progress') {
      this.draw(data.imageData, data.xPos, data.yPos)
    } else if (step === 'end') {
      this.setState({ rendering: false })
    }
  }

  draw(image, xPos, yPos) {
    requestAnimationFrame(() => {
      this.ctx.putImageData(image, xPos, yPos)
    })
  }

  clear() {
    this.ctx.clearRect(0, 0, this.scaledWidth, this.scaledHeight)
  }

  startRender() {
    this.setState({ rendering: true })
    this.worker.postMessage([
      'mandelbrotGenerator',
      this.scaledWidth,
      this.scaledHeight
    ])
  }

  render() {
    return <div className="renderer">
      <canvas id="canvas" ref={this.renderer} />
      {this.state.rendering && <div className="loading">
        Rendering...
      </div>}
    </div>
  }
}