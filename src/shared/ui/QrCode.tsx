import type { create as createQr } from 'qrcode'

// QR 그리기(#38에서 A-02 카드에 처음 씀, #71에서 T-02 반 QR도 씀 — 공용으로 옮김).
// 라이브러리 불러오기는 useQrLibrary. 주소는 화면에서 바로 만든다 — 외부 QR 생성 서비스에 코드를 보내지 않는다

/**
 * QR 모듈을 SVG 경로 하나로(검은 칸마다 1×1 사각형). 주변 여백 2칸 — 나머지 조용한 영역은 부르는 쪽 흰 여백.
 * 크기·색(fill)은 className으로 정한다
 */
export function QrSvg({
  create,
  text,
  className,
  label,
}: {
  create: typeof createQr
  text: string
  className?: string
  /** 읽어 줄 이름. 없으면 장식(aria-hidden) */
  label?: string
}) {
  const modules = create(text, { errorCorrectionLevel: 'M' }).modules
  const { size } = modules
  const margin = 2
  let d = ''
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules.get(row, col)) d += `M${col + margin},${row + margin}h1v1h-1z`
    }
  }
  const box = size + margin * 2
  return (
    <svg
      className={className}
      viewBox={`0 0 ${box} ${box}`}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={d} />
    </svg>
  )
}
