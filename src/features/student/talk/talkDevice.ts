// 대화 중에만 쓰는 기기 기능: 화면 꺼짐 방지(Wake Lock), 마이크 요청, 음량 막대.
// 모두 지원하지 않는 기기에서는 조용히 빠진다(대화는 그대로 된다)

/** 화면 꺼짐 방지를 건다. 돌려준 함수로 푼다. 지원하지 않거나 거절되면 아무것도 하지 않는다 */
export function holdScreen(): () => void {
  let released = false
  let sentinel: WakeLockSentinel | undefined
  const wakeLock = typeof navigator !== 'undefined' ? navigator.wakeLock : undefined
  if (wakeLock) {
    wakeLock.request('screen').then(
      (lock) => {
        if (released) void lock.release()
        else sentinel = lock
      },
      () => undefined,
    )
  }
  return () => {
    released = true
    void sentinel?.release().catch(() => undefined)
    sentinel = undefined
  }
}

/** "시작하기" 탭 안에서 부른다. 에코 제거를 켜야 스피커로 할 때 캐릭터 목소리가 학생 말로 들어가지 않는다 */
export function requestMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
}

/** 마이크 거부(권한·정책) */
export function isMicDenied(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'SecurityError')
  )
}

/**
 * 음량 막대 — 지금 소리(학생 마이크 또는 캐릭터 소리)의 크기를 0~1로 막대 요소의 scaleX에 넣는다.
 * AudioContext는 "시작하기" 탭 안에서 만들어야 아이폰에서 멈춰 있지 않다(그래서 생성자를 탭 핸들러에서 부른다)
 */
export class LevelMeter {
  private readonly context: AudioContext | undefined
  private analyser: AnalyserNode | undefined
  private source: MediaStreamAudioSourceNode | undefined
  private frame = 0
  private bar: HTMLElement | null = null
  private readonly data = new Uint8Array(256)

  constructor() {
    const Context = typeof window !== 'undefined' ? window.AudioContext : undefined
    if (!Context) return
    try {
      this.context = new Context()
      void this.context.resume().catch(() => undefined)
    } catch {
      this.context = undefined
    }
  }

  attachBar(bar: HTMLElement | null) {
    this.bar = bar
  }

  /** 잴 소리를 바꾼다(null이면 0) */
  listen(stream: MediaStream | null) {
    this.source?.disconnect()
    this.source = undefined
    if (!this.context || !stream || stream.getAudioTracks().length === 0) {
      this.paint(0)
      return
    }
    // 장식이라 실패해도 대화는 이어진다 — 닫힌 AudioContext·샘플레이트 불일치 등에서 막대만 끈다(리뷰 11/25)
    try {
      if (!this.analyser) {
        this.analyser = this.context.createAnalyser()
        this.analyser.fftSize = 512
      }
      this.source = this.context.createMediaStreamSource(stream)
      this.source.connect(this.analyser)
    } catch (error) {
      console.warn('[talk] 음량 막대 끔', { name: (error as { name?: string }).name })
      this.source = undefined
      this.paint(0)
      return
    }
    if (this.frame === 0) this.loop()
  }

  close() {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.source?.disconnect()
    void this.context?.close().catch(() => undefined)
    this.paint(0)
  }

  private loop = () => {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.data)
      let sum = 0
      for (const value of this.data) {
        const centered = (value - 128) / 128
        sum += centered * centered
      }
      const rms = Math.sqrt(sum / this.data.length)
      this.paint(Math.min(1, rms * 4))
    }
    this.frame = requestAnimationFrame(this.loop)
  }

  private paint(level: number) {
    if (this.bar) this.bar.style.transform = `scaleX(${Math.max(0.04, level).toFixed(3)})`
  }
}
