# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토일: 2026-06-27
검토 대상: `spec/7-channel-web-chat/` + diff `origin/main...HEAD` (worktree: `webchat-composer-loading`)
구현 범위: `codebase/channel-web-chat/src/widget/components/composer.tsx`, `composer.test.tsx`, `panel.tsx`, `panel.test.tsx`

---

## 전체 위험도

**LOW** — Critical 없음. WARNING 2건(i18n 규약 위반, plan 파일 부재). INFO 2건(코드 주석 spec 귀속 표기 미세 부정확, spec locale 전략 미명시). 기능 동작 및 데이터 모델에는 영향 없음.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | `aria-label="AI 응답 중"` 한국어 문자열 JSX attribute 하드코딩 — `i18n-userguide Principle 1` 위반 | `composer.tsx` (신규 추가 라인: `aria-label={loading ? "AI 응답 중" : "전송"}`) | `spec/conventions/i18n-userguide.md` Principle 1 ("JSX attribute에 한국어 문자열을 직접 박는 행위 금지") | 단기: `spec/7-channel-web-chat/1-widget-app.md §2` 에 "v1 KO 고정, locale='en' 지원은 후속" 부기. 중기: 위젯 내 `t(key)` 메커니즘 도입으로 locale boot config 연동. 자동 가드(`hardcoded-korean-ratchet.test.ts`)는 `channel-web-chat/` 경로를 미스캔하므로 빌드 차단 불발 — 수동 조치 필요 |
| W-2 | Plan Coherence | worktree `webchat-composer-loading`에 대응하는 `plan/in-progress/webchat-composer-loading.md` 부재 — spec `pending_plans` 라이프사이클 추적 단절 | `plan/in-progress/` (파일 없음) | `spec/7-channel-web-chat/1-widget-app.md` frontmatter `pending_plans` 라이프사이클 규약 (`.claude/docs/plan-lifecycle.md`) | `plan/in-progress/webchat-composer-loading.md` 생성 후 `1-widget-app.md` `pending_plans`에 등록. 완료 후 `plan/complete/`로 이동하고 `pending_plans`에서 제거 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec + Rationale Continuity (통합) | 코드 주석·테스트 describe가 스피너·aria-busy 동작의 SoT를 `§R6`으로 단독 귀속. 시각 명세 primary SoT는 `§2 입력창 행`이며, §R6은 게이팅 조건 근거이고 §2를 cross-reference함 | `composer.tsx` JSDoc `"spec 1-widget-app §R6"`, `composer.test.tsx` describe `"§R6 AI 응답 중"`, `panel.test.tsx` describe `"§R6 게이팅"` | 코드 주석·test describe 제목을 `"§2 입력창 / §R6 게이팅 조건"` 형태로 교정해 spec SoT 추적 혼란 방지. 코드 동작·spec 정합에는 영향 없음 |
| I-2 | Convention Compliance | `spec/7-channel-web-chat/1-widget-app.md §2`가 Korean 고정 aria-label을 규정하면서 `locale` boot config와의 관계(v1 KO 고정 여부, locale-aware 전환 계획)를 침묵 — `i18n-userguide Principle 1`의 spirit과 거리감 | `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행 | `1-widget-app.md §2`에 locale 처리 전략("v1 KO 고정. locale-aware aria-label은 후속") 추가. 또는 `2-sdk.md §4` BootConfig `locale` 필드 설명에 v1 접근성 레이블 미지원 명시 |
| I-3 | Plan Coherence | `plan/in-progress/webchat-eager-start.md`의 `[ ] plan complete 이동` 미완료 — 이번 diff와 독립적이나 spec `pending_plans`에서 eager-start 제거의 선행 조건 | `plan/in-progress/webchat-eager-start.md` 마지막 체크박스 | 이번 diff와 별도로 eager-start plan을 `plan/complete/`로 이동 처리 (비차단 cleanup) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·API 계약·상태기계·RBAC 모두 충돌 없음. 코드 주석 §R6 단독 참조 부정확(INFO) |
| Rationale Continuity | NONE | 기각된 대안 재도입·invariant 위반·결정 번복 없음. 테스트 주석 §R6 귀속 미세 부정확(INFO, Cross-Spec과 동일 근원) |
| Convention Compliance | LOW | `i18n-userguide Principle 1` 위반 — `composer.tsx` Korean aria-label 하드코딩(WARNING). spec locale 전략 미명시(INFO). frontmatter·문서구조·명명·금지패턴 모두 준수 |
| Plan Coherence | LOW | `plan/in-progress/webchat-composer-loading.md` 부재로 spec pending_plans 라이프사이클 추적 단절(WARNING). eager-start plan complete 이동 미완료(INFO) |
| Naming Collision | NONE | `loading` prop, `wc-composer-spinner`, `wc-spin` keyframe, `aria-label="AI 응답 중"` 모두 기존 식별자·네임스페이스와 충돌 없음 |

---

## 권장 조치사항

1. **(W-2 즉시)** `plan/in-progress/webchat-composer-loading.md` 생성 및 `spec/7-channel-web-chat/1-widget-app.md` frontmatter `pending_plans` 등록 — plan 라이프사이클 추적 단절 해소.
2. **(W-1 단기)** `spec/7-channel-web-chat/1-widget-app.md §2` 에 "v1 KO 고정, locale-aware 지원은 후속" 부기 — spec이 locale 전략을 명시하는 것으로 규약과의 거리감을 줄이고 INFO I-2도 동시 해소.
3. **(I-1 선택)** `composer.tsx` JSDoc 및 `composer.test.tsx`, `panel.test.tsx` describe 제목을 `§2 입력창 / §R6 게이팅 조건` 형태로 교정해 spec 추적 가독성 개선.
4. **(I-3 비차단)** `plan/in-progress/webchat-eager-start.md` `plan complete 이동`을 별도로 처리해 spec `pending_plans`에서 eager-start 제거 경로 확보.
5. **(W-1 중기)** 위젯 내 `t(key)` 메커니즘 도입으로 `locale` boot config 연동 — `aria-label` 등 접근성 문자열을 locale-aware로 제공해 `i18n-userguide` 근본 준수.