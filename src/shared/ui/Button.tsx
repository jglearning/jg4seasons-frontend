import type { ComponentPropsWithRef } from 'react'
import { Link, type LinkProps } from 'react-router'
import styles from './Button.module.css'

// 디자인 가이드 §5 Button. 주 버튼은 ink, 레벨 색 버튼은 없다
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
