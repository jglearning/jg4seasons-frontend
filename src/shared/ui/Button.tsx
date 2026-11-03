import type { ComponentPropsWithRef } from 'react'
import styles from './Button.module.css'

// 디자인 가이드 §5 Button. 주 버튼은 ink, 레벨 색 버튼은 없다
type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary'
  size?: 'student' | 'teacher'
  block?: boolean
}

export function Button({
  variant = 'primary',
  size = 'student',
  block = false,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], block && styles.block, className]
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...rest} />
}
