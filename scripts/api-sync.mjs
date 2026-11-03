// openapi.json → src/api/generated/schema.d.ts
//   npm run api:sync               백엔드 저장소 파일, 없으면 로컬 서버
//   npm run api:sync -- --server   로컬 서버(http://localhost:8080/v3/api-docs)에서만
//   npm run api:sync -- --check    파일을 쓰지 않고 생성 결과가 커밋본과 같은지만 검사(다르면 exit 1)
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SPEC_FILE = resolve(root, '../jg4seasons-backend/docs/api/openapi.json')
const SPEC_URL = 'http://localhost:8080/v3/api-docs'
const OUT_FILE = resolve(root, 'src/api/generated/schema.d.ts')

const args = new Set(process.argv.slice(2))
const fromServer = args.has('--server')
const checkOnly = args.has('--check')

async function pickSource() {
  if (!fromServer && existsSync(SPEC_FILE)) {
    return { url: pathToFileURL(SPEC_FILE), label: SPEC_FILE }
  }
  if (!fromServer) console.warn(`[api:sync] ${SPEC_FILE} 없음 → ${SPEC_URL} 시도`)
  try {
    const res = await fetch(SPEC_URL, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (e) {
    throw new Error(
      `[api:sync] 명세를 찾지 못했습니다. 백엔드 openapi.json을 만들거나 백엔드 서버를 띄워 주세요 (${SPEC_URL}: ${e.message})`,
    )
  }
  return { url: new URL(SPEC_URL), label: SPEC_URL }
}

// process.exit()은 Windows에서 fetch 연결이 남아 있으면 libuv assertion으로 죽어 종료 코드가 깨진다 → exitCode만 설정
async function main() {
  const { url, label } = await pickSource()
  const ast = await openapiTS(url)
  const header = '// 생성 파일 — 직접 고치지 않는다. npm run api:sync\n\n'
  const next = header + astToString(ast)

  if (checkOnly) {
    const current = existsSync(OUT_FILE) ? await readFile(OUT_FILE, 'utf8') : ''
    if (current !== next) {
      console.error(`[api:sync] ${OUT_FILE}가 명세(${label})와 다릅니다`)
      return 1
    }
    console.log('[api:sync] 최신 상태')
    return 0
  }
  await mkdir(dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, next)
  console.log(`[api:sync] ${label} → ${OUT_FILE}`)
  return 0
}

process.exitCode = await main().catch((e) => {
  console.error(e.message)
  return 1
})
