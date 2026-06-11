# 신규 식별자 충돌 검토 결과

## 발견사항

### 1. [WARNING] `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` — spec 참조 잔존

- **target 신규 식별자**: 삭제 (`system-status.constants.ts` 에서 두 deprecated 상수를 제거)
- **기존 사용처**: `spec/5-system/16-system-status-api.md` 라인 90, 94 — 각각 `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD` 를 코드 상수명으로 직접 참조하고 있음
- **상세**: 구현에서 두 상수가 삭제됐으나 spec 의 해당 라인은 여전히 이 상수명을 기재하고 있어, spec ↔ 구현 불일치 상태가 됨. 실제로는 `getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()` getter 로 대체됐다. `plan/in-progress/spec-update-deadcode-cleanup.md` 가 이 spec 갱신을 필수 작업으로 추적 중이나 아직 미반영.
- **제안**: `spec/5-system/16-system-status-api.md` 라인 90, 94 의 상수명 참조를 getter 표현(`getFailedDegradedThreshold()`, `getDelayedDegradedThreshold()`)으로 즉시 갱신. `plan/in-progress/spec-update-deadcode-cleanup.md §1` 항목 이행.

---

### 2. [INFO] `FREEZE_BRANCH_CACHE` — spec 미등재 신규 exported 상수

- **target 신규 식별자**: `FREEZE_BRANCH_CACHE` (`parallel-executor.ts` 에서 `export const` 로 공개)
- **기존 사용처**: spec 어디에도 이 식별자 없음. `spec/4-nodes/1-logic/10-parallel.md` 및 `spec/5-system/4-execution-engine.md` 에 freeze 관련 언급 없음
- **상세**: `FREEZE_BRANCH_CACHE` 는 dev/test 환경 한정 불변성 가드로 내부 품질 메커니즘이다. public API 나 외부 소비 계약이 아니므로 충돌 위험은 없으나, `parallel-executor.ts` 에서 `export` 로 공개되어 spec 의 `parallel` 노드 설계 문서에 기재된 "값 객체 공유 invariant" 의 기계 강제 수단임이 spec 에 서술되지 않은 상태.
- **제안**: 충돌은 없음. 필요 시 `spec/4-nodes/1-logic/10-parallel.md` 또는 `spec/conventions/execution-context.md` 의 해당 invariant 항목에 dev/test 가드 존재 여부를 한 줄 주석으로 추가하면 spec-impl 정합성이 완전해진다. 의무는 아님.

---

### 3. [INFO] `toChatChannelEvent` rename — spec 참조 정합

- **target 신규 식별자**: `toChatChannelEvent` (기존 `toEiaEvent` alias 제거, 함수 본체 명칭 유지)
- **기존 사용처**: `spec/data-flow/14-chat-channel.md` 라인 116 에 `toChatChannelEvent` 가 이미 정규 명칭으로 기재되어 있음. `spec` 에 `toEiaEvent` 잔재 없음 (grep 결과 0건).
- **상세**: spec 은 이미 `toChatChannelEvent` 를 사용하고 있으므로 구현이 spec 과 정합됨. alias 제거는 충돌을 해소한 방향.
- **제안**: 추가 조치 불요.

---

## 요약

이번 변경이 도입한 신규 식별자 중 실질적 충돌은 없다. 단, 삭제된 `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 상수명이 `spec/5-system/16-system-status-api.md` 에 여전히 잔존해 spec ↔ 구현 불일치가 발생하며, 해당 spec 갱신을 추적하는 `plan/in-progress/spec-update-deadcode-cleanup.md` 가 존재하나 아직 미반영 상태다. 이 갱신은 WARNING 수준으로 조치가 필요하다. 나머지 신규 식별자(`FREEZE_BRANCH_CACHE`, `toChatChannelEvent`)는 기존 사용처와 충돌 없이 정합 상태다.

## 위험도

LOW
