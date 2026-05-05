# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능·안전성 위반은 없으나, `reset-password` e2e 커버리지 공백과 VoiceOver 미완 상태에서 Stage 완료 처리된 점이 품질 추적 가능성을 저하시킴

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement | `reset-password` 페이지 테스트 전무 — describe 블록 제목에 명시됐으나 axe scan·h1·키보드 테스트 모두 없음 | `smoke.spec.ts` describe `"…forgot-password / reset-password"` | `/reset-password?token=test` 경로에 axe critical scan + h1 count 추가, 또는 describe 이름을 `"…forgot-password"` 로 축소 |
| 2 | Testing / A11y | `StatusBadge` 내 `aria-hidden` 부분 적용 — `skipped`의 `MinusCircle`에만 추가, `Loader2·CheckCircle·XCircle·PauseCircle` 누락 | `result-detail.tsx:73` | 나머지 4개 케이스 아이콘 전부 `aria-hidden="true"` 일괄 적용 |
| 3 | Testing / Requirement | VoiceOver 체크리스트 미수행 상태에서 NF-A11Y-03 `✅` 처리 — "검증 일시/결과" 필드 공백, 전 항목 `[ ]` | `voiceover-notes.md`, `prd/5-non-functional.md` | 수동 검증 수행 후 결과 기입, 또는 검증 완료 전까지 PRD 상태를 `🚧` 유지 |
| 4 | Testing | 키보드 진입 assertion 과도하게 허용적 — 주석은 "email input 도달" 의도이나 `A/INPUT/BUTTON` 셋 중 하나면 통과 | `smoke.spec.ts:98-106` | `expect(focused).toBe("INPUT")` 또는 `page.locator("input[type='email']").evaluate(el => el === document.activeElement)` 로 정밀화 |
| 5 | Testing | forgot-password axe 실패 시 위반 내용 디버깅 로그 없음 — login 테스트와 패턴 불일치 | `smoke.spec.ts:84-91` | login 테스트의 `console.log` 디버깅 블록을 복사하거나 `scanPage` 공통 헬퍼로 추출 |
| 6 | Maintainability / Architecture | `getPasswordStrength` 동일 함수 두 파일에 중복 정의 | `register-form.tsx:37-46`, `reset-password-form.tsx:25-34` | `@/lib/utils/password.ts` 로 추출 후 양쪽에서 import |
| 7 | Side Effect | `--muted-foreground` 전역 CSS 변수 변경이 auth 외 전체 앱에 영향 — 에디터·캔버스·사이드바 등 axe smoke 범위 밖 컴포넌트 미검증 | `globals.css:17`, `globals.css:41` | 에디터·대시보드 화면에 axe smoke 보완 추가, 또는 `[data-layout="auth"]` 스코프 분리 검토 |
| 8 | Documentation / Scope | `stages.md`가 `plan/complete/`에 위치하지만 미체크 체크박스 6개 잔류 — CLAUDE.md 라이프사이클 규약 위반 | `plan/complete/feature-roadmap/stages.md:32-37` | "완료 정의" 섹션을 일반 리스트로 변환하거나 "참고용 DoD 템플릿" 주석 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | 인라인 링크 스타일이 4개 파일 6개 지점에 분산 — 향후 정책 변경 시 shotgun surgery 유발 | `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` | `AuthLink` 컴포넌트 또는 `@layer components` 추출 (현 규모에서는 4개 이상 추가 사용처 생길 때 리팩토링 권장) |
| 2 | Testing | `forgot-password` h1 count 테스트 없음 — login/register에는 있음 | `smoke.spec.ts` forgot-password describe 블록 | `expect(await page.locator("h1").count()).toBe(1)` 추가 |
| 3 | Testing | register/forgot-password는 critical=0만 검사, 전체 위반 0 회귀 테스트가 login 페이지에만 존재 | `smoke.spec.ts:50-69` | 동일 기준 적용 또는 의도를 주석으로 명시 |
| 4 | Side Effect / Requirement | `globals.css` saturation 변경(`16.3% → 25%`)이 주석에 미기재 — lightness만 언급 | `globals.css:17` | 주석에 saturation 변경 이유 병기, 또는 의도 아닐 경우 `215.4 16.3% 35%` 로 복원 |
| 5 | Documentation | 링크 `underline` 항시 노출 변경에 WCAG 근거 주석 없음 — 미래 개발자가 `hover:underline`으로 되돌릴 위험 | `login-form.tsx:256` 외 | 대표 파일 한 곳에 `{/* WCAG 1.4.1: link-in-text-block — underline 항시 노출 */}` 추가 |
| 6 | Scope / Architecture | plan 이동 시 `git mv` 미사용 — history 단절 가능성 | `plan/complete/feature-roadmap/stages.md`, `10-a11y.md` | `git log --follow` 로 history 확인, 다음 이동 시 `git mv` 적용 |
| 7 | Documentation | `voiceover-notes.md` 상단에 "검증 대기" 상태 미표기 — plan/complete의 "완료" 기술과 충돌 | `voiceover-notes.md` | 상단에 `**상태**: 검증 미완 (사용자 수행 대기)` 표기 추가 |
| 8 | Maintainability | `globals.css` 주석 내 `(Stage 10 a11y)` 태그 — 값 변경 시 stale 컨텍스트 잔류 | `globals.css:18-19`, `globals.css:43-44` | 태그 제거, WCAG 대비비 수치만 남김 |
| 9 | Performance | E2E 테스트 내 동일 URL `page.goto` 중복 호출 — CI 누적 비용 | `smoke.spec.ts` forgot-password describe | `test.beforeEach`로 공통 네비게이션 공유 |
| 10 | Security | 서버 에러 메시지 UI 직접 노출 (기존 코드) | `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` | 백엔드 에러 메시지 화이트리스트 정책 수립 또는 프론트 에러 코드 번역 레이어 추가 |
| 11 | Security | `API_BASE_URL` HTTP fallback (기존 코드) — 환경변수 미설정 시 비암호화 통신 | `login-form.tsx:29`, `register-form.tsx:25` | 빌드 시 환경변수 누락 검증 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | **MEDIUM** | `reset-password` 커버리지 공백, assertion 과허용, `aria-hidden` 불균등 적용 |
| Maintainability | **LOW** | `getPasswordStrength` 중복, 링크 스타일 분산, axe 패턴 불일치 |
| Architecture | **LOW** | `getPasswordStrength` 중복, `reset-password` 테스트 공백, `aria-hidden` 일관성 |
| Requirement | **LOW** | VoiceOver 미완 → ✅ 처리, `reset-password` 커버리지 공백, `aria-hidden` 불균등 |
| Scope | **LOW** | `git mv` 미사용, VoiceOver 상태 불명확, `result-detail.tsx` axe 미커버 |
| Side Effect | **LOW** | `--muted-foreground` 전역 변경 범위, saturation 변경 미기재 |
| Performance | **LOW** | E2E 중복 `page.goto` |
| Documentation | **LOW** | `stages.md` 미체크 박스, describe 이름 과잉 약속, `underline` WCAG 근거 미기재 |
| Security | **NONE** | 이번 변경 신규 취약점 없음 (기존 코드 잠재 이슈만 언급) |
| Database | **NONE** | 해당 없음 |
| API Contract | **NONE** | 해당 없음 |
| Dependency | **NONE** | 신규 의존성 없음 |
| Concurrency | **NONE** | 해당 없음 |

---

## 발견 없는 에이전트

**Database**, **API Contract**, **Dependency**, **Concurrency** — 4개 에이전트 모두 이번 변경(순수 프론트엔드 a11y 개선)과 무관하여 위험도 NONE 판정

---

## 권장 조치사항

1. **[즉시]** `reset-password` axe scan 테스트 추가 또는 describe 이름 축소 — 선언된 커버리지와 실제 커버리지 불일치 해소
2. **[즉시]** `StatusBadge` 모든 상태 아이콘(`Loader2·CheckCircle·XCircle·PauseCircle`)에 `aria-hidden="true"` 일괄 적용
3. **[즉시]** VoiceOver 수동 검증 수행 후 `voiceover-notes.md` 결과 기입, 완료 전까지 PRD `NF-A11Y-03` 상태를 `🚧`로 변경
4. **[단기]** 키보드 진입 assertion을 `expect(focused).toBe("INPUT")` 으로 정밀화
5. **[단기]** forgot-password axe 테스트에 login 스타일 디버깅 로그 추가 (`scanPage` 헬퍼 추출 권장)
6. **[단기]** `getPasswordStrength` 공유 유틸로 추출 (`@/lib/utils/password.ts`)
7. **[단기]** `globals.css` saturation 변경 의도 확인 후 주석 보완 또는 복원
8. **[검토]** `--muted-foreground` 변경이 에디터·캔버스 영역 UI에 미치는 시각 영향 육안 확인 및 필요 시 axe smoke 보완
9. **[정리]** `stages.md` "완료 정의" 섹션 체크박스 → 일반 리스트 전환, `globals.css` Stage 태그 주석 제거
10. **[다음 이동 시]** plan 문서 이동에 `git mv` 적용하여 git history 보존