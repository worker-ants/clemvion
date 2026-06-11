# Convention Compliance — 정식 규약 준수 검토

**검토 범위**: dead code 제거 03 M-6·m-2 + parallel branch dev/test deep freeze 06 M-5
**diff-base**: origin/main
**검토 일시**: 2026-06-10

---

## 발견사항

### [WARNING] `spec/5-system/16-system-status-api.md` — 삭제된 상수명이 spec 본문에 잔류

- **target 위치**: `spec/5-system/16-system-status-api.md` line 90, line 94
- **위반 규약**: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" — spec 은 구현 현실을 반영해야 한다. `spec/conventions/spec-impl-evidence.md §3` 의 `status: implemented` 의무 (`code:` 매치 ≥1) 는 구현 상태와 spec 서술이 정합하는 것을 전제한다.
- **상세**: 이번 PR 에서 `system-status.constants.ts` 의 deprecated export 상수 `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 가 삭제됐다. 그러나 `spec/5-system/16-system-status-api.md §3` line 90·94 는 여전히 이 삭제된 상수명을 직접 참조한다. `plan/in-progress/spec-update-deadcode-cleanup.md §1` 에서 해당 spec 갱신(getter 표현으로 교체)을 draft 로 명시하고 `spec_impact` 에 `spec/5-system/16-system-status-api.md` 를 등재했으나, 실제 spec 파일 변경이 이 PR 에 포함되지 않았다. project-planner 위임 draft 로 처리한 것은 규약에 부합하지만, PR merge 시 spec 이 삭제된 식별자를 참조하는 상태가 유지된다.
- **제안**: `spec/5-system/16-system-status-api.md §3` line 90의 `FAILED_DEGRADED_THRESHOLD` → `getFailedDegradedThreshold()`, `DELAYED_DEGRADED_THRESHOLD` → `getDelayedDegradedThreshold()` 로 갱신하거나, `spec-update-deadcode-cleanup.md` plan 을 project-planner 가 즉시 반영해 merge 전에 spec 과 코드를 정합시킬 것을 권장한다 (draft plan이 존재하므로 해당 경로는 이미 설정됨).

---

### [INFO] `spec/4-nodes/1-logic/10-parallel.md` — `nodeOutputCache` shallow copy + freeze 설계가 spec 에 미서술

- **target 위치**: `spec/4-nodes/1-logic/10-parallel.md §4`, line 69 (분기 `ExecutionContext` shallow clone 설명)
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `parallel-executor.ts` 에 추가된 `FREEZE_BRANCH_CACHE` (dev/test deep freeze invariant 가드) 는 `spec/4-nodes/1-logic/10-parallel.md §4 line 4` 의 설계 메모 "분기 간 `variables` 는 `structuredClone` 으로 deep clone, `nodeOutputCache` 는 shallow copy 로 격리된다" 에 근거한 구현이다. 본 PR 의 JSDoc 주석(parallel-executor.ts L27–62)이 "spec `4-nodes/1-logic/10-parallel.md` 명시 설계" 라고 spec 을 참조하지만, spec 본문에는 "값 객체 내부를 mutate 하면 안 된다는 invariant" 가 명시적으로 기술되어 있지 않다 — spec 에는 shallow copy 사실만 서술되어 있고, 해당 invariant 의 이유(deep clone 비용 회피)와 mutate 금지 계약은 JSDoc 에만 존재한다.
- **제안**: 사소한 서술 갭이므로 강제는 아니지만, `spec/4-nodes/1-logic/10-parallel.md §4` 또는 `## Rationale` 에 "값 객체 내부 mutate 금지 invariant (deep clone 비용 회피 설계) — dev/test 환경에서 `FREEZE_BRANCH_CACHE` 로 기계 강제" 문장을 추가하면 spec-impl 대응이 완전해진다.

---

### [INFO] `spec/data-flow/14-chat-channel.md` — spec-impl-evidence frontmatter 없음 (기존 상태, 이번 diff 변경 없음)

- **target 위치**: `spec/data-flow/14-chat-channel.md` line 1 (frontmatter 없음)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — `spec/data-flow/**.md` 는 적용 대상 목록에 포함되어 있지 않다. (적용 대상은 `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/`.)
- **상세**: `spec/data-flow/` 경로는 `spec-impl-evidence.md §1` 의 적용 대상 inclusive list 에 포함되지 않아 frontmatter 의무 대상이 아니다. 따라서 이 파일에 frontmatter 가 없는 것은 현재 규약 위반이 아니다. — 본 INFO 는 이번 diff 와 무관한 기존 상태이고, 규약 자체가 data-flow 를 포함하지 않아 위반이 아님을 확인 차원으로만 기록한다.
- **제안**: 조치 불요 (규약 대상 아님). data-flow 를 spec-impl-evidence 적용 범위에 추가하려면 규약 갱신이 필요하다.

---

## 요약

이번 diff (dead code 제거 03 M-6·m-2 + parallel branch dev/test deep freeze 06 M-5) 에서 정식 규약 직접 위반 사항은 발견되지 않았다. `FREEZE_BRANCH_CACHE` export 명명(SCREAMING_SNAKE_CASE), `toChatChannelEvent` 함수명 rename, deprecated export 상수 삭제, `ContinuationBusService.on()` 제거 모두 규약(명명·식별자·dead code 제거)에 부합한다. 단, `spec/5-system/16-system-status-api.md §3` 의 삭제된 상수명(`FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD`) 참조가 spec 본문에 잔류하는 상태가 WARNING 수준으로 남는다 — `plan/in-progress/spec-update-deadcode-cleanup.md` 에 project-planner 위임 draft 가 준비되어 있어 경로는 명확하지만, merge 전 반영 여부를 확인할 것을 권장한다. `spec/4-nodes/1-logic/10-parallel.md` 에 값 객체 mutate 금지 invariant 미기술은 사소한 서술 갭(INFO)이다.

## 위험도

LOW

---

STATUS: SUCCESS
