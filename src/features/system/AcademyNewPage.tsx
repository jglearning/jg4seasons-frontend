import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../shared/ui/Button'
import { RadioGroup, type RadioOption } from '../../shared/ui/RadioGroup'
import { TextField } from '../../shared/ui/TextField'
import { useSubmit } from '../../shared/useSubmit'
import { createAcademy } from './systemApi'
import { SYSTEM_COPY } from './systemCopy'
import styles from './System.module.css'

// O-02 학원 만들기(SYS-07, 7.2). 첫 관리자 비밀번호는 이 화면의 지역 state에만 두고 보낸 뒤 비운다(응답에도 없음).
// 사용권 적용은 기본값 없이 반드시 고른다(직영·연계를 잘못 만들면 학생 판정이 바로 달라진다).
// 규칙(주소 모양·타임존·비밀번호 길이)은 서버가 판정하고 칸 옆에 보인다 — 화면은 빈 칸만 막는다
type LicenseMode = 'direct' | 'linked'

const LICENSE_OPTIONS: RadioOption<LicenseMode>[] = [
  { value: 'direct', label: '직영', description: '모든 교재 제한 없이 사용' },
  { value: 'linked', label: '연계', description: '사용권을 지정한 교재만 사용' },
]

const DEFAULT_TIMEZONE = 'Asia/Seoul'

// 서버 errors[].field 이름(7.2 요청 본문 경로)
const FIELDS = [
  'name',
  'slug',
  'timezone',
  'licenseEnforced',
  'admin.loginId',
  'admin.name',
  'admin.password',
]
const FIELD_CODES = ['ACADEMY_SLUG_TAKEN', 'LOGIN_ID_TAKEN']

export function AcademyNewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)
  const [licenseMode, setLicenseMode] = useState<LicenseMode>()
  const [licenseMissing, setLicenseMissing] = useState(false)
  const [adminLoginId, setAdminLoginId] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const submit = useSubmit(SYSTEM_COPY)
  const formRef = useRef<HTMLFormElement>(null)

  // 서버가 칸 오류(400·409)를 주면 첫 오류 칸으로 포커스 — 긴 폼이라 버튼 자리에서는 위쪽 칸이 보이지 않는다
  useEffect(() => {
    if (submit.error === null) return
    formRef.current?.querySelector<HTMLElement>('input[aria-invalid="true"]')?.focus()
  }, [submit.error])

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (submit.pending) return
    if (licenseMode === undefined) {
      setLicenseMissing(true)
      // 보내지 않았으니 고칠 자리로 바로 — 첫 라디오에 포커스(오류 문구는 묶음 설명으로 읽힌다)
      event.currentTarget.querySelector<HTMLInputElement>('input[type="radio"]')?.focus()
      return
    }
    const trimmedTimezone = timezone.trim()
    const created = await submit.run(() =>
      createAcademy({
        name: name.trim(),
        slug: slug.trim(),
        // 비우면 보내지 않는다 — 서버 기본값 Asia/Seoul
        timezone: trimmedTimezone === '' ? undefined : trimmedTimezone,
        licenseEnforced: licenseMode === 'linked',
        admin: { loginId: adminLoginId.trim(), name: adminName.trim(), password: adminPassword },
      }),
    )
    setAdminPassword('')
    if (created === undefined) return
    void queryClient.invalidateQueries({ queryKey: ['system'] })
    navigate('/system/academies')
  }

  const generalError = submit.formError(FIELDS, FIELD_CODES)

  return (
    <>
      <Link to="/system/academies" className={styles.back}>
        ← 학원 관리
      </Link>
      <div className={styles.head}>
        <h1 className={styles.title}>학원 만들기</h1>
      </div>
      <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          size="teacher"
          label="학원 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
          error={submit.fieldError('name')}
        />
        <TextField
          size="teacher"
          label="학원 주소"
          hint="소문자·숫자·- 2~30자, 영문이나 숫자로 시작"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={30}
          required
          error={submit.fieldError('slug', ['ACADEMY_SLUG_TAKEN'])}
        />
        <TextField
          size="teacher"
          label="타임존"
          hint="IANA 이름(예: Asia/Seoul). 비우면 Asia/Seoul"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          error={submit.fieldError('timezone')}
        />
        <RadioGroup
          legend="사용권 적용"
          options={LICENSE_OPTIONS}
          value={licenseMode}
          onChange={(next) => {
            setLicenseMode(next)
            setLicenseMissing(false)
          }}
          required
          error={
            licenseMissing ? '직영 또는 연계를 고르세요' : submit.fieldError('licenseEnforced')
          }
        />
        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>첫 관리자</legend>
          <TextField
            size="teacher"
            label="아이디"
            hint="영문·숫자·. _ - 3~30자"
            value={adminLoginId}
            onChange={(e) => setAdminLoginId(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={30}
            required
            error={submit.fieldError('admin.loginId', ['LOGIN_ID_TAKEN'])}
          />
          <TextField
            size="teacher"
            label="이름"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            maxLength={30}
            required
            error={submit.fieldError('admin.name')}
          />
          <TextField
            size="teacher"
            type="password"
            label="비밀번호"
            hint="8자 이상"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            autoComplete="new-password"
            required
            error={submit.fieldError('admin.password')}
          />
        </fieldset>
        {generalError && (
          <p className={styles.formError} role="alert">
            {generalError}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" size="teacher" disabled={submit.pending}>
            {submit.pending ? '만드는 중' : '만들기'}
          </Button>
        </div>
      </form>
    </>
  )
}
