import type { ComponentPropsWithRef } from 'react'
import { Link, type LinkProps } from 'react-router'
import styles from './Button.module.css'

// 학생(size student): DESIGN.md 1.2 턱 버튼 — 주 버튼은 레벨 진한 색(--L-deep), 누르면 3px 내려감.
// 교사(size teacher): 05 디자인가이드 §5 — 주 버튼은 ink, 그림자 없음
type Look = {
  variant?: 'primary' | 'secondary'
  size?: 'student' | 'teacher'
  block?: boolean
}

type ButtonProps = ComponentPropsWithRef<'button'> & Look

function classesOf({ variant = 'primary', size = 'student', block = false }: Look, extra?: string) {
  return [styles.button, styles[variant], styles[size], block && styles.block, extra]
    .filter(Boolean)
    .join(' ')
}

export function Button({ variant, size, block, type = 'button', className, ...rest }: ButtonProps) {
  return <button type={type} className={classesOf({ variant, size, block }, className)} {...rest} />
}

// 다른 화면으로 가는 동작은 <a href>여야 한다(§8) — 버튼 모양의 링크
type ButtonLinkProps = LinkProps & Look

export function ButtonLink({ variant, size, block, className, ...rest }: ButtonLinkProps) {
  const extra = [styles.link, typeof className === 'string' ? className : undefined]
    .filter(Boolean)
    .join(' ')
  return <Link className={classesOf({ variant, size, block }, extra)} {...rest} />
}
