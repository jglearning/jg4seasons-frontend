import { createPortal } from 'react-dom'
import { Button } from '../../shared/ui/Button'
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
  klass: Pick<AdminClass, 'name' | 'accessCode' | 'levelCode' | 'season'>
  items: PersonalCodeItem[]
}

const SERVICE_NAME = '제이G 4 Seasons'
const SITE = 'www.jg4seasons.com'

export function CodeCards({ title, klass, items }: CodeCardsProps) {
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
        <Button size="teacher" onClick={() => window.print()}>
          카드 인쇄
        </Button>
      </div>
      <p className={styles.note} role="note">
        이 화면을 떠나면 개인 코드를 다시 볼 수 없음. 잃어버리면 재발급
      </p>
      <Table caption="개인 코드" columns={columns} rows={items} rowKey={(s) => s.id} />
      {createPortal(
        // 칸(점선 = 자르는 선) 안에 카드.
        // 레벨 칩 색: 지금은 기본(--level = ink). 반 응답 level.colorHex로 칠하는 것은 남은 일(issues)
        <div className={styles.sheet} aria-hidden="true">
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
                </div>
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </section>
  )
}
