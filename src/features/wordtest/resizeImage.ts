// 찍은 답안지 사진을 올리기 전에 줄인다(#171): 긴 변 1600px 이하, JPEG 품질 0.85.
// 캔버스에 다시 그리므로 EXIF(위치 정보 포함)가 빠진다.
// 방향: <img>는 EXIF 회전을 적용해 그리고(image-orientation: from-image가 기본 — Chrome 81·Safari 13.1부터),
// naturalWidth·naturalHeight도 돌린 뒤의 크기라 그대로 캔버스에 그리면 바로 선 사진이 된다.
// createImageBitmap은 Safari의 EXIF 처리가 버전마다 달라 쓰지 않는다. 실기기 확인 항목(세로 사진이 눕지 않는지)
export const MAX_EDGE = 1600
export const JPEG_QUALITY = 0.85

/** 긴 변이 max를 넘으면 비율대로 줄인 크기. 작은 사진은 키우지 않는다 */
export function fitSize(width: number, height: number, max = MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image decode failed'))
    image.src = url
  })
}

/** 사진 파일 → 줄인 JPEG. 읽을 수 없는 그림(안드로이드의 HEIC 등)이면 실패 */
export async function resizeImage(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const { width, height } = fitSize(image.naturalWidth, image.naturalHeight)
    if (width === 0 || height === 0) throw new Error('empty image')
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('no canvas context')
    context.drawImage(image, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('jpeg encode failed'))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
