# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-spec-drift-resolve.md`
검토 기준 spec: `spec/4-nodes/1-logic/10-parallel.md`, `spec/5-system/6-websocket-protocol.md`, `spec/4-nodes/1-logic/0-common.md`, `spec/conventions/node-output.md`, `spec/4-nodes/6-presentation/0-common.md`

---

## 발견사항

### [CRITICAL] Parallel §5.2 의 `count` 제거 노트가 아직 잔존 — draft 전제("이미 적용")와 실제 파일 불일치

- **target 위치**: `plan/in-progress/spec-draft-spec-drift-resolve.md` §변경 1 — "이미 spec/ 본문에 적용된 변경을 consistency-check 대상으로 기술한 것이다"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/1-logic/10-parallel.md` §5.2 line 125
- **상세**: draft 는 "이미 spec 본문에 적용된 변경"으로 기술하지만, `10-parallel.md` §5.2 에는 여전히 `**\`count\` 필드는 제거됨** (P1.1 직교성 — \`branches.length\` 가 SSOT)` 노트가 잔존하고, JSON 예시 및 필드 표에도 `count` 가 없다. 즉 변경이 **적용되지 않은** 상태이다. 이로 인해 동일 파일 §5.2 의 기술과 다음 3개 spec 이 현재 시점에서 직접 모순 상태이다:
  - `spec/4-nodes/1-logic/0-common.md` §5 — `Parallel → { branches, count }` 명시
  - `spec/conventions/node-output.md` Principle 9.2 — `parallel → { branches: [...], count: N }` 명시
  - 엔진 구현 `execution-engine.service.ts` (draft 인용) — `{ branches, count: branchResults.length }` 방출
- **제안**: `spec/4-nodes/1-logic/10-parallel.md` 에 실제 변경(§5.2 JSON 예시·필드 표 `count` 추가, 노트 삭제, §5.7 완료 shape `count` 추가, Rationale 결정 B 추가)을 즉시 적용해야 한다. draft 의 "이미 적용됨" 전제를 철회하거나 변경을 실제로 적용한 뒤 이 consistency-check 를 재실행해야 한다.

---

### [CRITICAL] WS §4.4 `buttonConfig` 예시의 `timeout`/`timeoutAction`/`nodeOutput` 스테일 값이 아직 잔존

- **target 위치**: `plan/in-progress/spec-draft-spec-drift-resolve.md` §변경 2 (C2, C3)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.4 lines 406-408
- **상세**: draft 는 이 정정이 이미 적용됐다고 기술하나, WS 파일에는 `"timeout": 300, "timeoutAction": "cancel"` (line 406-407) 과 `"nodeOutput": { "type": "carousel", ... }` (line 408) 이 여전히 잔존한다. 이 값들은 각각 아래 두 spec 과 모순된다:
  - **C2 (timeout 제거)**: `spec/4-nodes/6-presentation/0-common.md` §3 line 83 — "사용자 인터랙션 대기 (외부 cancel/종료 전까지 **무제한 대기**)" 명시. 타임아웃 없음. `timeout: 300` / `timeoutAction: "cancel"` 예시는 해당 spec 의 "무제한 대기" 원칙과 직접 모순.
  - **C3 (nodeOutput shape 교체)**: `spec/conventions/node-output.md` Principle 1.1.4 — `type` 판별자 래퍼 금지. `{ "type": "carousel", ... }` shape 는 Principle 1.1.4 위반. 실제 `NodeHandlerOutput` 은 `{ config, output, meta?, port?, status? }` 5필드 shape 여야 한다.
- **제안**: `spec/5-system/6-websocket-protocol.md` §4.4 `buttonConfig` 예시에서 `timeout`/`timeoutAction` 필드를 제거하고 `nodeOutput` 을 `NodeHandlerOutput` 5필드 shape (`{ config, output, meta?, port?, status }`) 으로 교체한다. 필드 표 (`buttonConfig`, `buttonConfig.nodeOutput` 행) 도 함께 갱신해야 한다. Rationale C2/C3 추가 필요.

---

### [WARNING] 변경 1 기술에서 §5.7 "완료 shape" 갱신 언급 — 현재 §5.7 표도 `count` 누락 확인 필요

- **target 위치**: `plan/in-progress/spec-draft-spec-drift-resolve.md` §변경 1 — "§5.7 완료 shape 에 `count` 추가"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/1-logic/10-parallel.md` §5.7 (lines 133-146)
- **상세**: §5.7 의 "완료 (모든 분기 종료 후)" 행 `output 형태` 컬럼에 현재 `{ branches: Array<{status, value?|error?}> }` 로 기술되어 `count` 가 없다. `0-common.md §5` 및 `node-output.md` Principle 9.2 와 동일하게 `count` 가 포함되어야 한다. §5.2 수정과 함께 §5.7 도 반드시 동기화해야 한다.
- **제안**: §5.7 완료 행의 `output 형태` 컬럼을 `{ branches: Array<{status, value?|error?}>, count: N }` 으로 갱신한다. §5.2 와 §5.7 간 일관성을 유지한다.

---

### [INFO] `0-common.md §5` 표의 `count` 표기 — 다른 컨테이너 노드와 비교해 Parallel 행의 완성 여부

- **target 위치**: 변경 1 의 근거로 인용
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/1-logic/0-common.md` §5 line 115
- **상세**: `0-common.md §5` 는 `다운스트림은 $node["X"].output.count 로 실행된 개수에 접근한다` 고 명시하여 Parallel 의 `count` 방출을 이미 정확하게 기술하고 있다. 변경 없이 SoT 역할을 하고 있으며 이 파일 자체는 수정 불필요. 단, `10-parallel.md` 가 이 SoT 와 충돌하는 노트를 유지하는 동안 읽는 사람이 혼란을 겪는다.
- **제안**: 변경 1 적용 후 `0-common.md §5` 가 여전히 SoT 인지 재확인 (변경 불필요 예상). 문서화 완료 후 INFO 해소.

---

### [INFO] `conventions/node-output.md` Principle 9.2 — `parallel` 행이 이미 `count: N` 명시

- **target 위치**: 변경 1 근거로 인용
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/node-output.md` Principle 9.2
- **상세**: Principle 9.2 표는 `parallel → { branches: [...], count: N }` 이미 명시. 변경 대상 아님. 단 현재 `10-parallel.md §5.2` 가 이와 모순되어, 규약·공통문서는 정답이나 노드별 spec 이 부정확한 이례적 상태.
- **제안**: 변경 1 적용 후 Principle 9.2 는 동기화 확인만.

---

## 요약

이번 검토에서 발견된 가장 중요한 사항은, target draft 가 "이미 spec 본문에 적용된 변경"이라고 전제하지만, 실제로 두 대상 파일(`spec/4-nodes/1-logic/10-parallel.md` 와 `spec/5-system/6-websocket-protocol.md`) 모두 drift 상태 그대로 남아있다는 점이다. Parallel §5.2 의 `count 제거` 노트는 `spec/4-nodes/1-logic/0-common.md §5` 및 `spec/conventions/node-output.md` Principle 9.2 와 직접 모순(CRITICAL)이고, WS §4.4 의 `timeout`/`timeoutAction`/`nodeOutput` 스테일 예시는 `spec/4-nodes/6-presentation/0-common.md §3` 의 무제한 대기 원칙 및 Principle 1.1.4 와 직접 모순(CRITICAL)이다. 두 CRITICAL 항목 모두 신규 정책 도입이 아니라 이미 다른 spec 이 명시한 SoT 방향으로의 정정이며, drift 해소 자체에는 이견이 없다. 다만 실제 파일 수정이 수행되지 않은 채 consistency-check 가 진행된 것이 이번 검토의 핵심 문제다.

---

## 위험도

**CRITICAL**

- 변경 1·변경 2 모두 spec 파일에 아직 미적용 상태로 있어, `spec/4-nodes/1-logic/10-parallel.md §5.2` 와 관련 공통 규약·node-output.md 가 현재 직접 모순 상태이며, WS 프로토콜 예시도 Presentation 공통 규약·Principle 1.1.4 와 직접 모순된다.
