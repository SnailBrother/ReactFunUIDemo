// MusicVisualization.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react'
import styles from './MusicVisualization.module.css'

class AudioVisualizerCore {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement
    this.ctx = canvasElement.getContext('2d')

    this.ac = null
    this.analyser = null
    this.source = null
    this.sourceBuffer = null

    this.isLoading = false
    this.isPlaying = false
    this.startTime = 0
    this.currentSong = null
    this.animationFrame = null
    this.abortController = null

    this.defaultOptions = {
      centerX: 0.5,
      centerY: 0.7,
      lineWidth: 3,
      lineSpacing: 2,
      lineColor: '#e93b81',
      lineColorOpacity: 1,
      shadowColor: '#231018',
      shadowColorOpacity: 1,
      shadowBlur: 2,
      isRound: true,
      fftSize: 128,
      backgroundColor: 'transparent'
    }

    this.options = { ...this.defaultOptions, ...options }

    this.onTimeUpdate = null
    this.onPlayStateChange = null
    this.onLoadStart = null
    this.onLoadEnd = null
    this.onError = null

    this.initAudioContext()
    this.handleResize()
    window.addEventListener('resize', () => this.handleResize())
  }

  initAudioContext() {
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)()
      this.analyser = this.ac.createAnalyser()
      this.analyser.fftSize = this.options.fftSize
      this.analyser.connect(this.ac.destination)
    } catch (error) {
      console.error('初始化 AudioContext 失败:', error)
      this.onError && this.onError('浏览器不支持 Web Audio API')
    }
  }

  setOptions(options) {
    this.options = { ...this.options, ...options }
  }

  colorToRGB(color) {
    if (!color || color.length !== 7 || !color.startsWith('#')) {
      return [0, 0, 0]
    }
    const rgb = []
    const hex = color.replace('#', '')
    for (let i = 0; i < 3; i++) {
      rgb.push(parseInt(hex.substring(i * 2, i * 2 + 2), 16))
    }
    return rgb
  }

  async play(songInfo) {
    if (!songInfo || !songInfo.url) {
      this.onError && this.onError('无效的音乐信息')
      return
    }

    if (this.currentSong?.url === songInfo.url && this.isPlaying) {
      return
    }

    this.stop()

    this.currentSong = songInfo
    this.isLoading = true
    this.onLoadStart && this.onLoadStart()

    this.onPlayStateChange && this.onPlayStateChange({
      state: 'loading',
      duration: 0,
      currentTime: 0
    })

    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()

    try {
      const response = await fetch(songInfo.url, {
        signal: this.abortController.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()

      if (this.currentSong?.url !== songInfo.url) {
        return
      }

      this.ac.decodeAudioData(arrayBuffer, (buffer) => {
        if (this.currentSong?.url !== songInfo.url) {
          return
        }

        this.sourceBuffer = buffer
        this.createAndPlaySource()
        this.isLoading = false
        this.onLoadEnd && this.onLoadEnd()

        this.startAnimation()
      }, (error) => {
        console.error('解码音频失败:', error)
        this.handleError('音频解码失败，请检查文件格式')
      })

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('请求已取消')
        return
      }
      console.error('加载音频失败:', error)
      this.handleError('加载音频失败，请检查网络或文件地址')
    }
  }

  createAndPlaySource() {
    if (!this.ac || !this.sourceBuffer) return

    if (this.ac.state === 'closed') {
      this.initAudioContext()
    }

    this.source = this.ac.createBufferSource()
    this.source.buffer = this.sourceBuffer
    this.source.connect(this.analyser)

    this.source.onended = () => {
      this.handlePlayEnd()
    }

    this.source.start(0)
    this.startTime = this.ac.currentTime
    this.isPlaying = true

    if (this.ac.state === 'suspended') {
      this.ac.resume()
    }

    this.onPlayStateChange && this.onPlayStateChange({
      state: 'playing',
      duration: this.sourceBuffer.duration,
      currentTime: 0
    })
  }

  handlePlayEnd() {
    this.isPlaying = false
    this.onPlayStateChange && this.onPlayStateChange({
      state: 'ended',
      duration: this.sourceBuffer?.duration || 0,
      currentTime: this.sourceBuffer?.duration || 0
    })
  }

  togglePlay() {
    if (!this.ac || !this.source) return

    if (this.ac.state === 'running') {
      this.ac.suspend()
      this.isPlaying = false
      this.onPlayStateChange && this.onPlayStateChange({
        state: 'paused',
        duration: this.sourceBuffer?.duration || 0,
        currentTime: this.getCurrentTime()
      })
    } else if (this.ac.state === 'suspended') {
      this.ac.resume()
      this.isPlaying = true
      this.onPlayStateChange && this.onPlayStateChange({
        state: 'playing',
        duration: this.sourceBuffer?.duration || 0,
        currentTime: this.getCurrentTime()
      })
    }
  }

  stop() {
    if (this.source) {
      try {
        this.source.onended = null
        this.source.stop()
      } catch (e) {
        // 忽略已停止的错误
      }
      this.source = null
    }
    this.sourceBuffer = null
    this.isPlaying = false
    this.startTime = 0
  }

  getCurrentTime() {
    if (!this.isPlaying || !this.sourceBuffer || this.startTime === 0) {
      return 0
    }
    const currentTime = this.ac.currentTime - this.startTime
    return Math.min(Math.max(0, currentTime), this.sourceBuffer.duration)
  }

  getDuration() {
    return this.sourceBuffer?.duration || 0
  }

  seekTo(time) {
    if (!this.sourceBuffer || !this.currentSong) return

    const targetTime = Math.min(Math.max(0, time), this.sourceBuffer.duration)
    const wasPlaying = this.isPlaying

    if (this.source) {
      try {
        this.source.stop()
      } catch (e) {}
    }

    this.source = this.ac.createBufferSource()
    this.source.buffer = this.sourceBuffer
    this.source.connect(this.analyser)
    this.source.start(0, targetTime)
    this.startTime = this.ac.currentTime - targetTime

    this.source.onended = () => {
      this.handlePlayEnd()
    }

    if (!wasPlaying && this.ac) {
      this.ac.suspend()
      this.isPlaying = false
    }
  }

  handleResize() {
    if (!this.canvas) return
    this.cw = this.canvas.width = this.canvas.clientWidth
    this.ch = this.canvas.height = this.canvas.clientHeight
  }
//确保柱子的数量与画布宽度相匹配
draw() {
  if (!this.ctx || !this.analyser) return

  const {
    lineColor, lineColorOpacity, shadowColor, shadowColorOpacity,
    shadowBlur, lineWidth, lineSpacing, isRound, backgroundColor
  } = this.options

  const bufferLen = this.analyser.frequencyBinCount
  const buffer = new Uint8Array(bufferLen)
  this.analyser.getByteFrequencyData(buffer)

  const cx = this.cw * this.options.centerX
  const bottomY = this.ch * 0.85
  
  const actualLineWidth = Math.max(2, lineWidth)  // 保持可见
  const spacing = actualLineWidth + lineSpacing

  this.ctx.clearRect(0, 0, this.cw, this.ch)

  if (backgroundColor !== 'transparent') {
    this.ctx.fillStyle = backgroundColor
    this.ctx.fillRect(0, 0, this.cw, this.ch)
  }

  this.ctx.beginPath()
  this.ctx.lineWidth = actualLineWidth
  this.ctx.shadowBlur = shadowBlur
  this.ctx.strokeStyle = `rgba(${this.colorToRGB(lineColor).join(',')}, ${lineColorOpacity})`
  this.ctx.shadowColor = `rgba(${this.colorToRGB(shadowColor).join(',')}, ${shadowColorOpacity})`
  this.ctx.lineCap = isRound ? 'round' : 'butt'

  // 计算能绘制的最大柱子数量
  const maxBars = Math.min(
    bufferLen,
    Math.floor(cx / spacing),  // 左侧最多
    Math.floor((this.cw - cx) / spacing)  // 右侧最多
  )

  for (let i = 0; i < maxBars; i++) {
    const value = buffer[i] / 255
    const height = Math.max(2, value * this.ch * 0.4)
    const yTop = bottomY - height
    const yBottom = bottomY
    
    // 左侧
    const xLeft = cx - (i + 1) * spacing
    this.ctx.moveTo(xLeft, yTop)
    this.ctx.lineTo(xLeft, yBottom)
    
    // 右侧
    const xRight = cx + i * spacing
    if (xRight !== xLeft) {  // 避免中心点重复绘制
      this.ctx.moveTo(xRight, yTop)
      this.ctx.lineTo(xRight, yBottom)
    }
  }

  this.ctx.stroke()
  this.ctx.closePath()
}
  startAnimation() {
    const animate = () => {
      this.draw()

      if (this.isPlaying && this.sourceBuffer) {
        this.onTimeUpdate && this.onTimeUpdate({
          currentTime: this.getCurrentTime(),
          duration: this.sourceBuffer.duration
        })

        this.onPlayStateChange && this.onPlayStateChange({
          state: 'playing',
          duration: this.sourceBuffer.duration,
          currentTime: this.getCurrentTime()
        })
      }

      this.animationFrame = requestAnimationFrame(animate)
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
    }
    this.animationFrame = requestAnimationFrame(animate)
  }

  handleError(message) {
    this.isLoading = false
    this.onError && this.onError(message)
    this.onPlayStateChange && this.onPlayStateChange({
      state: 'error',
      duration: 0,
      currentTime: 0
    })
  }

  destroy() {
    this.stop()

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    if (this.ac) {
      this.ac.close()
      this.ac = null
    }

    this.analyser = null
    this.source = null
    this.sourceBuffer = null
    this.currentSong = null
  }
}

const MusicVisualization = ({
  playlist = [],
  defaultSongIndex = 0,
  options = {},
  className = '',
  showControls = true,
  autoPlay = false,
  onPlayStateChange,
  onTimeUpdate,
  onError,
  onSongChange
}) => {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)
  const visualizerRef = useRef(null)
  
  const [localState, setLocalState] = useState({
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    error: null,
    currentSong: playlist[defaultSongIndex] || null,
    currentSongIndex: defaultSongIndex,
    playlist: playlist
  })

  // 格式化时间
  const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 处理进度条点击
  const handleProgressClick = useCallback((e) => {
    if (!visualizerRef.current || !containerRef.current) return
    const progressBar = containerRef.current.querySelector(`.${styles['progress-bar']}`)
    if (!progressBar) return
    const rect = progressBar.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const seekTime = percent * localState.duration
    visualizerRef.current.seekTo(seekTime)
  }, [localState.duration])

  // 播放指定歌曲
  const playSong = useCallback((song, index) => {
    if (!song || !song.url) {
      console.error('无效的歌曲信息')
      return
    }
    
    setLocalState(prev => ({
      ...prev,
      currentSong: song,
      currentSongIndex: index,
      isLoading: true,
      error: null
    }))
    
    visualizerRef.current?.play(song)
    onSongChange?.(song, index)
  }, [onSongChange])

  // 下一首
  const nextSong = useCallback(() => {
    if (localState.playlist.length === 0) return
    const nextIndex = (localState.currentSongIndex + 1) % localState.playlist.length
    playSong(localState.playlist[nextIndex], nextIndex)
  }, [localState.playlist, localState.currentSongIndex, playSong])

  // 上一首
  const prevSong = useCallback(() => {
    if (localState.playlist.length === 0) return
    const prevIndex = (localState.currentSongIndex - 1 + localState.playlist.length) % localState.playlist.length
    playSong(localState.playlist[prevIndex], prevIndex)
  }, [localState.playlist, localState.currentSongIndex, playSong])

  // 处理本地文件上传
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0]
    if (!file) return
    
    if (!file.type.startsWith('audio/')) {
      setLocalState(prev => ({ ...prev, error: '请选择音频文件' }))
      return
    }
    
    const url = URL.createObjectURL(file)
    const newSong = {
      url: url,
      title: file.name.replace(/\.[^/.]+$/, ''),
      isLocal: true
    }
    
    const newPlaylist = [newSong, ...localState.playlist]
    setLocalState(prev => ({
      ...prev,
      playlist: newPlaylist,
      currentSong: newSong,
      currentSongIndex: 0
    }))
    
    playSong(newSong, 0)
  }, [localState.playlist, playSong])

  // 初始化可视化器
  useEffect(() => {
    if (!canvasRef.current) return

    const visualizer = new AudioVisualizerCore(canvasRef.current, options)
    visualizerRef.current = visualizer

    visualizer.onPlayStateChange = (state) => {
      setLocalState(prev => ({
        ...prev,
        isPlaying: state.state === 'playing',
        isLoading: state.state === 'loading',
        duration: state.duration,
        error: state.state === 'error' ? '播放出错' : prev.error
      }))
      onPlayStateChange?.(state)
    }

    visualizer.onTimeUpdate = (timeInfo) => {
      setLocalState(prev => ({
        ...prev,
        currentTime: timeInfo.currentTime,
        duration: timeInfo.duration
      }))
      onTimeUpdate?.(timeInfo)
    }

    visualizer.onError = (message) => {
      setLocalState(prev => ({ ...prev, error: message, isLoading: false }))
      onError?.(message)
    }

    // 自动播放默认歌曲
    if (localState.currentSong?.url) {
      visualizer.play(localState.currentSong)
    }

    return () => {
      visualizer.destroy()
    }
  }, [])

  // 监听播放结束自动下一首
  useEffect(() => {
    if (localState.isPlaying === false && localState.currentTime >= localState.duration && localState.duration > 0) {
      nextSong()
    }
  }, [localState.isPlaying, localState.currentTime, localState.duration, nextSong])

  // 更新配置
  useEffect(() => {
    if (visualizerRef.current) {
      visualizerRef.current.setOptions(options)
    }
  }, [options])

  const handleTogglePlay = () => {
    visualizerRef.current?.togglePlay()
  }

  const handleSelectSong = (song, index) => {
    if (localState.currentSongIndex === index && visualizerRef.current?.isPlaying) {
      visualizerRef.current?.togglePlay()
    } else {
      playSong(song, index)
    }
  }

  return (
    <div ref={containerRef} className={`${styles['visualization-container']} ${className}`}>
      <canvas
        ref={canvasRef}
        className={styles['visualization-canvas']}
      />
      
      {/* 上传按钮 */}
      <div className={styles['upload-btn-wrapper']}>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button
          className={styles['upload-btn']}
          onClick={() => fileInputRef.current?.click()}
          title="上传本地音乐"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0-3-3m3 3 3-3M5 21h14" />
          </svg>
        </button>
      </div>
      
      {localState.isLoading && (
        <div className={styles['loading-overlay']}>
          <div className={styles['loading-spinner']} />
        </div>
      )}
      
      {localState.error && (
        <div className={styles['error-overlay']}>
          <div className={styles['error-message']}>{localState.error}</div>
          <button
            className={styles['error-retry']}
            onClick={() => localState.currentSong && playSong(localState.currentSong, localState.currentSongIndex)}
          >
            重试
          </button>
        </div>
      )}
      
      {/* 歌曲信息 */}
      <div className={styles['song-info']}>
        <div className={styles['song-title']}>
          {localState.currentSong?.title || '未播放'}
        </div>
        <div className={styles['song-artist']}>
          {localState.currentSong?.artist || '本地音乐'}
        </div>
      </div>
      
      {showControls && (
        <div className={styles.controls}>
          {/* 上一首 */}
          <button
            className={styles['control-btn']}
            onClick={prevSong}
            disabled={localState.playlist.length === 0}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <polygon points="19 5 10 12 19 19 19 5" />
              <rect x="5" y="5" width="3" height="14" />
            </svg>
          </button>
          
          {/* 播放/暂停 */}
          <button
            className={styles['play-btn']}
            onClick={handleTogglePlay}
            disabled={localState.isLoading || !!localState.error || !localState.currentSong}
          >
            {localState.isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
          
          {/* 下一首 */}
          <button
            className={styles['control-btn']}
            onClick={nextSong}
            disabled={localState.playlist.length === 0}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <polygon points="5 5 14 12 5 19 5 5" />
              <rect x="16" y="5" width="3" height="14" />
            </svg>
          </button>
          
          {/* 进度条 */}
          <div className={styles['progress-container']}>
            <div className={styles['progress-bar']} onClick={handleProgressClick}>
              <div
                className={styles['progress-fill']}
                style={{ width: `${(localState.currentTime / localState.duration) * 100 || 0}%` }}
              />
            </div>
          </div>
          
          {/* 时间显示 */}
          <div className={styles['time-display']}>
            {formatTime(localState.currentTime)} / {formatTime(localState.duration)}
          </div>
        </div>
      )}
      
      {/* 播放列表 */}
      {localState.playlist.length > 0 && (
        <div className={styles['playlist']}>
          <div className={styles['playlist-title']}>播放列表</div>
          <div className={styles['playlist-items']}>
            {localState.playlist.map((song, idx) => (
              <div
                key={idx}
                className={`${styles['playlist-item']} ${idx === localState.currentSongIndex ? styles['active'] : ''}`}
                onClick={() => handleSelectSong(song, idx)}
              >
                <div className={styles['playlist-item-icon']}>
                  {idx === localState.currentSongIndex && localState.isPlaying ? (
                    <div className={styles['playing-animation']}>
                      <span></span><span></span><span></span>
                    </div>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </div>
                <div className={styles['playlist-item-info']}>
                  <div className={styles['playlist-item-title']}>{song.title}</div>
                  <div className={styles['playlist-item-artist']}>{song.artist || '本地音乐'}</div>
                </div>
                {song.isLocal && (
                  <div className={styles['playlist-item-badge']}>本地</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default MusicVisualization