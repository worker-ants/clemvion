# Plan 정합성 검토 — `spec/conventions/` (impl-done, diff-base origin/main)

## 검토 범위 재확인

`origin/main...HEAD` 실측 (`git diff --stat`):

- `spec/conventions/error-codes.md` — 11줄 추가 / 1줄 변경 (target 유일 델타)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 27줄 추가
- `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` — 신규 198줄
- `plan/in-progress/spec-conventions-engine-error-code-surface.md` — 62줄 (체크리스트 갱신)
- `plan/in-progress/harness-review-gate-followups.md` — 46줄 (신규 후속 2건 + 인용문 체크박스 판정 완료)
- `plan/complete/spec-draft-error-code-two-surfaces.md` — 신규 150줄 (developer draft 보존물)

## 발견사항

### [INFO] `error-codes.md` §Overview 편집은 해당 plan 의 체크리스트와 문자 그대로 일치한다

- target 위치: `spec/conventions/error-codes.md` §Overview "적용 범위" 문단 (diff: `대표 surface
  중 하나...`, `대표 surface 는 둘이다...` 두 문단 삽입)
- 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 할 일 1번째 항목
  (`[x] spec/conventions/error-codes.md §Overview 두 surface 병기 — 완료 (2026-09-01)`)
- 상세: plan 이 "목적지 필드 매핑은 §Overview 책임이 아니라 `3-error-handling.md §1` 로 위임하고,
  존재·자매 관계·키 disjoint 만 적는다" 고 접근을 명시했고, 실제 diff 도 정확히 그 셋(같은 파일·
  자매 const·경계 비대칭)만 적고 목적지 매핑을 재서술하지 않는다. `EngineErrorCode` 존재
  전제(`exec-intake-followups.md` ARCH#5, 2026-08-31 머지)도 실측상 이미 코드에 있다
  (`codebase/backend/src/nodes/core/error-codes.ts`).
- 충돌 없음 — 조치 불요.

### [INFO] "언제 sibling const 를 만드는가" 판단 기준은 의도적으로 미기재 — 관련 미해결 결정과 충돌하지 않는다

- target 위치: `spec/conventions/error-codes.md` §Overview (신설 두 문단)
- 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` "함께 볼 것" 절 +
  `plan/complete/exec-intake-followups.md` ARCH#5 ⑤ (의식적 이탈, "해석의 여지가 있다" 유보)
- 상세: `RETRY_*` 선례(레이어가 달라도 단일 enum)와 이번 `EngineErrorCode` 자매 const 신설이
  형태상 어긋나는데, 그 판단 기준을 규약으로 승격할지는 ARCH#5 ⑤ 가 유보한 사안이다. target
  편집은 이 유보를 우회해 기준을 성문화하지 **않고** 사실 관계(존재·비대칭·기존 실무 명문화)만
  적었다 — plan 이 스스로 "기준을 쓰려면 먼저 유보를 닫아야 한다" 고 적은 그대로 지켰다.
- 조치 불요. 재개 조건(세 번째 자매 const 등장 시 판정)도 plan 에 이미 명시돼 있다.

### [INFO] `spec-update-node-cancellation-shutdown-classification.md` 의 "나란히 가는 plan" 충돌 경고 — 실제로는 충돌 없음 (clobber 미발생)

- target 위치: `spec/conventions/error-codes.md` §3 예외 레지스트리 `AbortError` 행
- 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` "나란히 가는 plan"
  절 (두 plan 이 같은 파일을 편집하면 서로의 문단을 덮을 수 있다는 경고) ·
  `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §3 (AbortError 등재
  위임 — 단 그 등재는 2026-07-27 에 이미 별도로 이행 완료, 이번 결정과 무관)
- 상세: `git diff origin/main...HEAD -- spec/conventions/error-codes.md` 로 실측 — 이번 PR 의
  편집은 §Overview 문단 삽입뿐이고 §3 표(§3 `AbortError` 행 포함)는 손대지 않았다. 두 plan 이
  경고한 "착수 순서 겹침" 은 이번 세션에서 발생하지 않았다.
- `spec-update-node-cancellation-shutdown-classification.md` 최상위 (a)/(b) 택일 결정(SIGTERM/
  timeout 유발 abort 를 `failed` 유지 vs `cancelled` 재정의)은 여전히 미해결이지만, 이번 target
  편집은 그 결정 영역(§1 카탈로그·상태 분류)에 손대지 않아 충돌 없음.
- 조치 불요.

### [INFO] `stray-tool-tags.test.ts` 신규 build-차단 가드가 `spec-impl-evidence.md §4.2` SoT 에 미등재 — 이미 plan 에 정확히 반영된 의도적 유예

- target 위치: `spec/conventions/spec-impl-evidence.md §4.2` (표 "build 차단 4건" — 실측 확인:
  `spec-link-integrity.test.ts` / `spec-area-index.test.ts` / `plan-frontmatter.test.ts` /
  `spec-plan-completion.test.ts` 4건만 등재, `stray-tool-tags.test.ts` 없음)
- 관련 plan: `plan/in-progress/harness-review-gate-followups.md` (이번 PR 이 새로 추가한 항목)
  "신규 가드를 `spec-impl-evidence.md §4.2` SoT 에 등재" (미체크, "이번 PR 에서 안 하는 이유" +
  재개 신호 명시)
- 상세: `spec/conventions/` 스코프 델타는 `error-codes.md` 하나뿐이라 `spec-impl-evidence.md` 는
  이번 diff 에 없다. 신규 가드(`stray-tool-tags.test.ts`, 198줄)는 §4.2 규약이 요구하는 등재
  대상이지만 이번 PR 은 "spec 축이 이미 과하게 묶였다" 는 같은 리뷰의 별건 지적을 근거로 의도적
  으로 미룬다. `grep -rl stray-tool-tags plan/in-progress/` 결과 이 항목을 추적하는 plan 은
  `harness-review-gate-followups.md` 하나뿐이고, 다른 plan 과의 중복·누락은 없다.
- 이것은 "누락" 이 아니라 "추적됨" 이다 — target(spec/conventions/) 관점에서 실제 drift(§4.2
  카운트가 5건 실재를 4건으로 서술)가 존재하는 것은 사실이지만, 그 drift 를 해소할 후속이
  plan 에 정확히 등재돼 있어 plan-coherence 위반은 아니다. 다음 harness 가드 추가 시 함께
  처리하기로 한 재개 신호도 명확하다.
- 제안: 조치 불요 — 다만 이 항목이 "다음 harness 가드 추가" 시 실제로 집행되는지는 후속 세션
  에서 추적할 가치가 있다(이번이 그 재개 신호의 첫 발생임에도 이번에도 미룬 것이므로, 두 번째
  기회에 또 미루면 누적 drift 로 격상될 수 있다).

## 요약

target 델타(`spec/conventions/error-codes.md` §Overview 두 surface 병기)는 그 편집을 전담하는
`plan/in-progress/spec-conventions-engine-error-code-surface.md` 의 체크리스트·접근 변경 이력과
문자 그대로 일치하며, plan 이 스스로 유보한 "sibling const 판단 기준" 은 target 이 성문화하지
않아 그 유보를 우회하지 않았다. 같은 파일을 겨누던 다른 plan(`spec-update-node-cancellation-
shutdown-classification.md`)의 clobber 경고는 이번 diff 가 §3 표를 건드리지 않아 실현되지
않았고, 그 plan 의 상위 미해결 (a)/(b) 결정과도 영역이 겹치지 않는다. diff 에 동반된 코드
변경(`stray-tool-tags.test.ts` 신규 build-차단 가드)이 `spec-impl-evidence.md §4.2` SoT 카운트를
실제로 stale 하게 만들지만, 이 drift 는 `harness-review-gate-followups.md` 에 정확한 근거·재개
신호와 함께 이미 등재돼 있어 "후속 항목 누락" 에 해당하지 않는다. CRITICAL/WARNING 급 결정
충돌이나 미반영 후속을 발견하지 못했다.

## 위험도

NONE
