## 발견사항

### [WARNING] i18n 모듈의 공개 API 문서 부재
- **위치**: `frontend/src/lib/i18n/` (신규 모듈 전반)
- **상세**: `useT`, `translate`, `useLocale`, `LocaleSync`, `TranslationKey` 등 새로운 공개 API가 대규모로 도입되었으나, 모듈 수준 문서(README, JSDoc, 또는 인라인 가이드)가 없음. 특히 ① `useT` vs `translate` 사용 구분 기준, ② 새 번역 키 추가 방법, ③ 지원 로케일(`ko`, `en`) 목록, ④ `LocaleSync`의 역할이 문서화되지 않음.
- **제안**: `frontend/src/lib/i18n/README.md` 또는 `index.ts` 상단에 최소한 다음을 기술: React 컴포넌트 → `useT()`, 비-React 컨텍스트(useEffect 내부, 유틸 함수) → `translate(locale, key)`, 새 키 추가 절차.

---

### [WARNING] `date.ts`, `execution-status.ts`에 `"use client"` 추가 — 서버 컴포넌트 제약 미고지
- **위치**: `frontend/src/lib/utils/date.ts:1`, `frontend/src/lib/utils/execution-status.ts:1`
- **상세**: 두 파일에 `"use client"` 지시어가 추가되었지만, 이 변경이 이 유틸리티를 서버 컴포넌트에서 직접 임포트할 수 없게 만든다는 아키텍처 제약이 어디에도 기록되지 않음. 기존에 서버 컴포넌트에서 사용하던 호출자가 있다면 런타임 오류가 발생할 수 있음.
- **제안**: 함수 시그니처 변경(`locale?: Locale` 파라미터 추가)과 함께 각 함수 상단에 한 줄 주석으로 제약을 명시하거나, 서버 환경용 순수 함수 버전을 별도로 분리하는 방안을 고려.

---

### [WARNING] 의미 있는 인라인 주석 다수 삭제
- **위치**:
  - `accept-invitation-content.tsx:36` — 워크스페이스 목록 갱신 후 컨텍스트 전환 이유 설명 삭제
  - `security/page.tsx:~52` — `twoFactorEnabled` 필드가 백엔드 노출 전제임을 설명한 주석 삭제
  - `restore-confirm-dialog.tsx:~27` — `window.location.reload()` 호출 이유(인메모리 에디터 상태 무효화) 설명 삭제
  - `canvas-empty-state.tsx` — 컴포넌트 표시 기준과 DOM 유지 전략 설명 JSDoc 삭제
- **상세**: 삭제된 주석들은 WHY(비즈니스 로직, 아키텍처적 결정)를 설명하는 것으로, CLAUDE.md 지침("WHY가 비자명한 경우에만 주석 추가")에 해당하는 유형. i18n 리팩터링의 부수 효과로 삭제된 것으로 보임.
- **제안**: `window.location.reload()`, `twoFactorEnabled` 가정, 워크스페이스 컨텍스트 전환 로직에 대한 주석은 복원 권장.

---

### [WARNING] `formatDate`에서 `"date"` 포맷 분기 암묵적 제거
- **위치**: `frontend/src/lib/utils/date.ts:65–75`
- **상세**: `format === "date"` 명시 분기가 제거되어 default 반환으로 fall-through됨. 기능상 동일하지만 코드 독자가 `"date"` 포맷을 의도적으로 지원하는지 알 수 없음. 테스트는 통과하지만 문서화된 API 계약이 불분명해짐.
- **제안**: 주석 또는 분기를 유지하거나, 함수 시그니처 JSDoc에 지원 포맷 값(`"date"`, `"datetime"`, `"iso"`)을 명시.

---

### [INFO] `ForgotPasswordForm` 이중 컴포넌트 패턴 미설명
- **위치**: `frontend/src/components/auth/forgot-password-form.tsx:107–113`
- **상세**: `ForgotPasswordFormInner`/`ForgotPasswordForm` 분리 및 `key={locale}`로 로케일 변경 시 강제 remount하는 패턴이 도입되었으나, 기존 주석(이메일 열거 방지 의도)과 달리 이 패턴의 이유는 설명되지 않음. 파일 내에 추가된 주석(`// defined inside component so validation messages pick up the current locale via t()`)은 schema 위치 이유를 설명하지만, 컴포넌트 분리 이유는 빠져 있음.
- **제안**: `export function ForgotPasswordForm()` 위에 한 줄 주석 추가: `// key={locale} forces schema re-init so zod messages use the new locale`

---

### [INFO] 테스트에서 `useLocaleStore.setState({ locale: "en" })` 패턴 — 설정 문서 없음
- **위치**: 테스트 파일 6개(`execution-detail-page.test.tsx`, `execution-list-page.test.tsx`, `node-palette.test.tsx` 등)
- **상세**: 모든 테스트 파일 `beforeEach`에 동일한 locale 초기화 패턴이 추가되었지만, 왜 필요한지(store 기본값이 `"ko"`이고 테스트는 영문 문자열을 기대), 그리고 새 테스트 파일 작성 시 이 패턴을 따라야 함이 어디에도 기록되지 않음.
- **제안**: `vitest.setup.ts` 또는 테스트 유틸리티에 locale 초기화를 전역 `beforeEach`로 추출하거나, 프로젝트 테스트 가이드에 해당 관례를 기록.

---

### [INFO] `i18n/__tests__/i18n.test.ts` — 번역 키 네임스페이스 구조 유추 가능
- **위치**: `frontend/src/lib/i18n/__tests__/i18n.test.ts`
- **상세**: 테스트가 번역 키의 구조(`common.*`, `auth.*`, `time.*`, `schedules.*`)를 간접적으로 문서화하고 있어 긍정적. 그러나 `$now`, `$schedule.id` 같은 특수 플레이스홀더가 치환되지 않아야 하는 이유(시스템 변수로 런타임에 다른 레이어에서 처리)가 설명되지 않음.
- **제안**: 해당 테스트에 한 줄 주석으로 특수 플레이스홀더의 목적 설명.

---

## 요약

이번 변경은 프론트엔드 전체에 걸쳐 i18n 시스템을 도입하는 대규모 리팩터링으로, 코드 품질 자체는 양호하다. 그러나 문서화 관점에서 두 가지 주요 문제가 있다: 첫째, 새로운 `@/lib/i18n` 모듈의 공개 API와 사용 관례(언제 `useT`를 쓰고 언제 `translate`를 쓰는지, 새 키를 어디에 추가하는지)가 전혀 문서화되지 않아 이후 기여자가 올바른 패턴을 추론해야 한다. 둘째, `date.ts`와 `execution-status.ts`에 `"use client"` 추가로 인한 서버 컴포넌트 사용 제한이 명시되지 않았고, i18n 리팩터링 과정에서 아키텍처적 결정을 설명하던 의미 있는 인라인 주석들이 부수적으로 삭제되었다.

## 위험도

**MEDIUM**