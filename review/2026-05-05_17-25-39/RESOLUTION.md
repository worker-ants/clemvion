# RESOLUTION — Stage 10 (Step F+G+H) 최종 ai-review 조치

대상 변경: Step F (a3f3c18) + Step G (80557a8) + Step H (441272b).

원본 리뷰: `review/2026-05-05_17-25-39/SUMMARY.md`

전체 위험도(원본): MEDIUM — Critical 0 / Warning 8 / Info 11. 본 조치로 Warning 6건 처리, 2건 deferred + Info 4건 처리.

---

## Warning 조치 (6/8)

| # | 원본 | 조치 |
|---|---|---|
| W-1 | reset-password 테스트 부재 (describe 이름이 약속한 커버리지 미충족) | describe 이름을 `"a11y smoke — forgot-password page"` 로 축소 (옵션 B). 정확히 검증한 페이지만 명시. |
| W-2 | StatusBadge `aria-hidden` 부분 적용 (skipped 만) | `Loader2`/`CheckCircle`/`XCircle`/`PauseCircle` 4 케이스 아이콘에 일괄 `aria-hidden="true"` 적용. |
| W-3 | VoiceOver 미수행 상태에서 NF-A11Y-03 ✅ 처리 | PRD 의 NF-A11Y-03 상태를 `🚧 (사용자 수행 대기)` 로 정정. voiceover-notes 상단에도 명시. 사용자가 macOS VoiceOver 검증 후 수동으로 ✅ 로 전환. |
| W-4 | 키보드 진입 assertion 과허용 (`A/INPUT/BUTTON` 셋 중 하나) | `expect(focusedTag).toBe("INPUT")` 로 정밀화. forgot-password 의 첫 Tab 이 정확히 email INPUT 으로 도달하는지 검증. |
| W-6 | `getPasswordStrength` 두 파일 중복 | `frontend/src/lib/utils/password.ts` 신규 — register/reset-password 둘 다 import. |
| W-8 | stages.md DoD 미체크 박스 잔류 (라이프사이클 위반) | `[ ]` 체크박스 → 일반 리스트 + 제목을 "각 stage 가 충족해야 했던 기준 템플릿" 으로 명확화. |

### Deferred (2건)

| # | 사유 |
|---|---|
| W-5 (forgot-password 디버깅 로그 부재) | login 패턴 따라 console.log 보강이 가능하나, 최초 fail 시 axe HTML report 가 violations 를 자동 출력하므로 디버깅 가능. 별도 helper 추출 (scanPage) 은 e2e 파일이 더 커진 후 가치. |
| W-7 (`--muted-foreground` 변경의 에디터·캔버스 영향) | 색 대비 향상은 의도된 전역 개선 — 어둡게 변한 텍스트는 모든 화면에서 가독성 ↑. 회귀가 아니므로 정량 추가 검증보다는 사용자가 dark/light 양쪽 둘러보고 자연스럽지 않은 곳을 지적하는 방식. axe smoke 의 추가 페이지 커버는 인증 필요해 본 작업 범위 외 (CI/auth fixture 도입 후). |

---

## Info 조치 (4 건)

| # | 조치 |
|---|---|
| I-2 | forgot-password 에 h1 1개 존재 테스트 추가 — login/register 와 대칭. forgot-password CardTitle 도 `as="h1"` 로 변경 + reset-password 의 3 CardTitle 도 모두 `as="h1"`. |
| I-4 | globals.css `--muted-foreground` 주석에 saturation 변경 의도 (가독성 강화) 명기. |
| I-5 | login-form 에 underline 항시 노출의 WCAG 1.4.1 근거 주석 추가 (대표 한 곳). |
| I-7 | voiceover-notes.md 상단에 `**상태**: 🚧 검증 미수행 (사용자 수행 대기)` 명기. |

### Deferred (Info 7 건)

- I-1 / AuthLink 컴포넌트 추출: 4개 파일 6개 지점 분산. 사용처 더 늘면 추출.
- I-3 / register·forgot 의 전체 위반 0 회귀 미적용: login 의 0 위반은 검증된 baseline. 다른 페이지는 일부 위반이 남을 가능성이 있어 critical 0 만 강제. 향후 0 위반 도달 시 회귀로 전환.
- I-6 / `git mv` 미사용 (plan 이동): rename detection 동작 확인됐으므로 history 보존됨 (git log --follow). 향후 명시적 git mv 권장.
- I-8 / globals.css "Stage 10" 주석 태그: 코드 주석은 WCAG 4.5:1 등 본질만 남겼고 stage 명은 제거함 (이번 차에 함께).
- I-9 / e2e `page.goto` 중복: 7개 테스트 규모에서는 단순한 흐름이 가독성에 우선. 25+ 테스트 도달 시 beforeEach 도입.
- I-10, I-11 / 보안 일반: 기존 코드 영역, 별도 보안 audit 영역.

---

## 변경 파일

- `frontend/src/components/editor/run-results/result-detail.tsx` — 4 StatusBadge 아이콘 aria-hidden
- `frontend/e2e/a11y/smoke.spec.ts` — describe 축소, h1/critical 0 테스트, 키보드 정밀화
- `frontend/src/lib/utils/password.ts` (신규) — getPasswordStrength
- `frontend/src/components/auth/{register,reset-password}-form.tsx` — util import + CardTitle as="h1" (reset-password 의 success/invalid/title 3 곳)
- `frontend/src/components/auth/forgot-password-form.tsx` — CardTitle as="h1" (2 곳)
- `frontend/src/components/auth/login-form.tsx` — 인라인 링크에 WCAG 주석
- `frontend/src/app/globals.css` — saturation 주석 보강, "Stage 10" 태그 제거
- `prd/5-non-functional.md` — NF-A11Y-03 → 🚧 (VoiceOver 수동 대기 명시)
- `plan/complete/feature-roadmap/stages.md` — DoD 체크박스 → 일반 리스트
- `review/2026-05-05_a11y/voiceover-notes.md` — 상단 "검증 미수행" 명기

## 재검증

- lint, vitest 102 suites / 1154 tests, e2e 8/8 (login 3 + register 2 + forgot-password 3) 모두 통과
- build 성공
