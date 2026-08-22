# Rationale 연속성 검토 — spec/4-nodes/7-trigger/ (impl-done)

## 검토 범위 확인

diff (`origin/main...HEAD -- code_areas`) 는 단 1개 파일, 단 1개 hunk다:

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` — 기존 `describe('resolveTriggerParametersRejectingMasked', ...)` 블록에 캐너리 테스트 `it('[캐너리] 무관한 필드의 coerce 실패가 ② 마커 검사를 선점한다', ...)` 1개 신규 추가.

spec 본문(`.md`) 변경분은 diff 에 없다 — 이번 변경은 순수 테스트 추가이며 설계 결정 자체는 이미 `1-manual-trigger.md`(§Rationale)와 `14-external-interaction-api.md`(§R17)에 확정돼 있다.

## 발견사항

없음 (CRITICAL/WARNING 대상 없음).

### 대조 결과 (근거)

추가된 테스트는 새 설계를 도입하지 않고, 기존 Rationale 이 이미 확정한 트레이드오프를 **기계로 고정(pin)** 하는 캐너리다.

1. **`masked_value_resubmitted` raw+resolve 2단계 검사** — `spec/4-nodes/7-trigger/1-manual-trigger.md` §Rationale "`masked_value_resubmitted` 검사 시점 — raw 우선 + resolve 후 재검사 (2026-08-21)" 은 "phase 를 합쳐 한 번에 던지지 않는 이유" 로 "raw 에서 걸린 뒤에도 resolve 를 강행하면 `coerce_failed` 가 섞여 안내가 다시 흐려진다" 를 명시한다. 신규 테스트는 정확히 이 문장이 서술하는 현상(무관한 필드의 `coerce_failed` 가 raw 단계에서 이미 잡힌 다른 필드의 `masked_value_resubmitted` 를 가리는 것이 아니라, **resolve 단계 전체가 스킵되면서 raw 통과 후 남은 마커가 보고되지 않는 경우**)을 회귀 캐너리로 굳힌다 — 새 결정이 아니라 기존 결정의 하네스화다.
2. **"직후 한 지점으로 되돌리지 말 것"** — 같은 Rationale 블록의 경고("이 문장을 '직후' 한 지점으로 되돌리지 말 것. 첫 구현이 그랬고 boolean 우회를 리뷰어 셋이 독립적으로 잡아야 했다")와, 테스트 docstring 의 "여기가 RED 면 버그가 아니라 결정 신호다... 두 phase 를 합쳐 한 번에 보고하도록 바꾸면 깨진다" 는 동일한 방향의 진술이다. 즉 테스트는 Rationale 의 의도를 정확히 반영해 향후 무근거 번복을 조기 탐지하는 가드 역할이며, Rationale 과 충돌하지 않는다.
3. **wrapper-only 설계(base 에 넣지 않음)** — `14-external-interaction-api.md` §R17 "**구현 위치**" 블록 및 `1-manual-trigger.md` "마커 재제출 거부는 base 가 아니라 wrapper 가 한다" 문단은 `resolveTriggerParametersRejectingMasked` wrapper 가 Manual 경로에서만 raw 검사를 수행한다고 규정한다. 신규 테스트는 이 wrapper 함수(`resolveTriggerParametersRejectingMasked`)를 직접 호출해 검증하며, base(`resolveTriggerParameters`)를 우회하거나 공유 함수에 검사를 흡수시키는 시도가 없다 — 기각된 대안("base 에 넣기")을 재도입하지 않는다.
4. **정확 일치(exact-match)만 감지하는 경계** — `14-external-interaction-api.md` §R17 "보장의 경계 — 정확 일치만 감지한다" 원칙과 배치되지 않는다. 신규 테스트는 `jsonWithMarker = '{"apiKey":"${VALUE_MASK_MARKER}"}'` 를 object 필드(`payload`, type `object`)에 넣어 파싱 후 leaf 정확 일치를 검증하는 대조군(control)까지 포함하므로, 오히려 "raw 만으로는 object/array 파라미터의 JSON 문자열 안 마커를 못 잡는다"(같은 Rationale §2번째 표 행)는 기존 결정을 뒷받침하는 형태다.
5. **마커 SoT 공유 패키지 참조** — 테스트가 import 하는 `VALUE_MASK_MARKER` 는 §R17 "마커 집합과 깊이 상한의 SoT 는 공유 패키지 `@workflow/masked-markers`" 결정(2026-08-21 이관)과 일치하는 식별자로, backend 로컬 하드코딩 마커 문자열을 재도입하지 않는다.

## 요약

이번 diff 는 spec 본문 변경이 없는 순수 테스트-전용 PR 이며, 추가된 캐너리 테스트는 `spec/4-nodes/7-trigger/1-manual-trigger.md` §Rationale("raw 우선 + resolve 후 재검사", "phase 를 합치지 말 것")와 `spec/5-system/14-external-interaction-api.md` §R17("wrapper-only 강제", "정확 일치만 감지", "마커 SoT 공유 패키지")이 이미 명시적으로 확정한 결정들을 그대로 반영·고정할 뿐, 기각된 대안을 재도입하거나 합의 원칙을 위반하거나 무근거로 결정을 번복하는 지점이 없다. 오히려 이 테스트 자체가 Rationale 이 경고한 회귀("직후 한 지점으로 되돌리는 것")를 미래에 조기 탐지하기 위한 안전장치로 기능한다.

## 위험도

NONE
