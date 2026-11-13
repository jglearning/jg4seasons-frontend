import { createPortal } from 'react-dom'
import { levelProps } from '../../shared/level'
import { qrJoinUrl } from '../../shared/qrJoin'
import { Button } from '../../shared/ui/Button'
import { QrSvg } from '../../shared/ui/QrCode'
import { useQrLibrary } from '../../shared/ui/useQrLibrary'
import { Table, type Column } from '../../shared/ui/Table'
import type { AdminClass } from './adminApi'
import { levelSeasonLabel } from './format'
import type { PersonalCodeItem } from './studentsApi'
import styles from './CodeCards.module.css'

// 개인 코드 발급 결과(A-02, ADM-02·AUTH-05). 평문 코드는 부모 화면의 지역 state로만 들어오고,
// 화면을 떠나면 사라진다(다시 볼 수 없음 — 잃어버리면 재발급, ADR-22).
// 인쇄: 카드 묶음을 body 바로 아래에 그려 두고(portal) 인쇄 때만 그것만 보인다(#root는 숨김). A4 한 장에 8장(2×4)
type CodeCardsProps = {
  /** 결과 제목(예: "등록 결과 3명") */
  title: string
  klass: Pick<AdminClass, 'name' | 'accessCode' | 'levelCode' | 'season' | 'level'>
  items: PersonalCodeItem[]
}

const SERVICE_NAME = '제이G 4 Seasons'
const SITE = 'www.jg4seasons.com'

// QR은 공용 QrCode(#71로 옮김). 불러오지 못하면 QR 없이 인쇄한다(코드는 글자로도 있다)
export function CodeCards({ title, klass, items }: CodeCardsProps) {
  const qr = useQrLibrary()
  const columns: Column<PersonalCodeItem>[] = [
    { key: 'name', header: '이름', cell: (s) => s.name },
    {
      key: 'code',
      header: '개인 코드',
      cell: (s) => <span className={styles.code}>{s.personalCode}</span>,
    },
  ]
  const level = levelSeasonLabel(klass.levelCode, klass.season)

  return (
    <section className={styles.result} aria-labelledby="code-cards-title">
      <div className={styles.head}>
        <h2 id="code-cards-title" className={styles.title}>
          {title}
        </h2>
        {/* QR을 불러오는 동안(짧음)에는 QR 없는 카드가 인쇄되지 않게 막는다 */}
        <Button size="teacher" onClick={() => window.print()} disabled={qr.status === 'loading'}>
          카드 인쇄
        </Button>
      </div>
      <p className={styles.note} role="note">
        이 화면을 떠나면 개인 코드를 다시 볼 수 없음. 잃어버리면 재발급
      </p>
      <Table caption="개인 코드" columns={columns} rows={items} rowKey={(s) => s.id} />
      {createPortal(
        // 칸(점선 = 자르는 선) 안에 카드. 왼쪽 열은 글자, 오른쪽 위는 QR(#38 — 찍으면 두 코드가 채워진 S-01).
        // 레벨 칩 색은 반 응답의 level.colorHex(값이 이상하면 기본 ink)
        <div className={styles.sheet} aria-hidden="true" {...levelProps(klass.level.colorHex)}>
          {items.map((s) => (
            <div key={s.id} className={styles.cell}>
              <div className={styles.card}>
                <div className={styles.main}>
                  <div className={styles.top}>
                    <span className={styles.service}>{SERVICE_NAME}</span>
                    <span className={styles.chip}>{level}</span>
                  </div>
                  <p className={styles.classLine}>{klass.name}</p>
                  <p className={styles.name}>{s.name}</p>
                  <dl className={styles.codes}>
                    <div className={styles.codeBox}>
                      <dt>가입 코드</dt>
                      <dd>{klass.accessCode}</dd>
                    </div>
                    <div className={styles.codeBox}>
                      <dt>개인 코드</dt>
                      <dd>{s.personalCode}</dd>
                    </div>
                  </dl>
                  <p className={styles.site}>{SITE}</p>
                  {/* 카드 사진이 곧 두 코드다(ADR 0033) — 퍼뜨리지 않게(#72) */}
                  <p className={styles.warn}>카드 사진은 남에게 보내지 마세요</p>
                </div>
                {qr.status === 'ready' && (
                  <div className={styles.qr}>
                    <QrSvg
                      className={styles.qrImage}
                      create={qr.create}
                      text={qrJoinUrl(window.location.origin, klass.accessCode, s.personalCode)}
                    />
                    {/* 카드 QR은 자동으로 들어가지 않는다 — 찍은 뒤 "들어가기"를 한 번(ADR 0033, #72) */}
                    <p className={styles.qrNote}>찍고 &apos;들어가기&apos;를 눌러요</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </section>
  )
}
