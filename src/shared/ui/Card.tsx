import type { ComponentPropsWithoutRef } from 'react'
import styles from './Card.module.css'

// 디자인 가이드 §4 카드 — 1px line 테두리, 그림자 없음. 학생 반경 16·여백 20 / 교사 반경 10·여백 14~16
type CardProps = ComponentPropsWithoutRef<'section'> & { size?: 'student' | 'teacher' }

export function Card({ size = 'student', className, ...rest }: CardProps) {
  return (
    <section
      className={[styles.card, styles[size], className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
