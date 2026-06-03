# 신규 식별자 충돌 검토 결과

## 검토 대상

`plan/in-progress/spec-draft-spec-drift-resolve.md` — 두 가지 변경:
- **변경 1**: `spec/4-nodes/1-logic/10-parallel.md` §5.2 / §5.7 / Rationale 에 `count` 복원
- **변경 2**: `spec/5-system/6-websocket-protocol.md` §4.4 `buttonConfig` 예시 + 필드 표 + Rationale 정정

---

## 발견사항

### [INFO] `output.count` — Parallel 고유 필드가 아닌 컨테이너 공통 식별자 (충돌 없음)
- target 신규 식별자: `output.count` (parallel `done` 포트 결과 내)
- 기존 사용처:
  - `spec/4-nodes/1-logic/0-common.md` §5 — 컨테이너 공통 `{ <컬렉션>, count }` 규약에 이미 `parallel` 포함
  - `spec/4-nodes/1-logic/0-common.md` §9.1 표 — `parallel` 행이 `{ branches: [...], count }` 로 명시됨
  - `spec/conventions/node-output.md` Principle 9.2 — `parallel` 행이 `{ branches: [...], count: N }` 으로 명시됨
- 상세: target 이 "신규 도입" 하는 것이 아니라, 이미 공통 규약 두 곳에서 `count` 가 parallel 에도 적용되어야 한다고 명시하는 상태에서 `10-parallel.md` 의 예시와 노트만 stale 하게 누락된 것을 복원하는 작업이다. `count` 라는 필드명은 이미 동일 의미(종료 항목 수)로 loop/foreach/map 에 정착되어 있으며, parallel 복원은 그 일관성 적용이다. 충돌 없음.
- 제안: 해당 없음. 복원이 올바름.

### [INFO] `buttonConfig.nodeOutput` shape 변경 — `NodeHandlerOutput` 5필드로 교체 (충돌 없음)
- target 신규 식별자: `buttonConfig.nodeOutput` 의 shape `{ config, output, meta?, port?, status }` (기존 예시의 `{ "type": "carousel", ... }` 를 5필드로 대체)
- 기존 사용처:
  - `spec/conventions/node-output.md` Principle 0 — `NodeHandlerOutput` 의 5필드 `{ config, output, meta?, port?, status? }` 이미 정의됨
  - `spec/conventions/node-output.md` Principle 1.1.4 — `output.view.type` 판별자 패턴 폐기 명시
  - `spec/4-nodes/6-presentation/0-common.md` §4 (Principle 1.1.4 적용 대상)
  - `spec/5-system/6-websocket-protocol.md` §4.4 필드 표 (`buttonConfig.nodeOutput` 행) — 이미 `NodeHandlerOutput: { config, output, meta?, port?, status }` + `type` 판별자 금지로 갱신되어 있음
- 상세: target 의 변경은 이미 spec 에 반영된 상태이다. `6-websocket-protocol.md` §4.4 의 예시 JSON 블록, 필드 표, Rationale 모두 현재 파일에서 C2/C3 정정이 적용된 형태로 확인됨. 예시 내 `{ "type": "carousel", ... }` 형태의 판별자는 이미 제거되어 있고, 5필드 구조가 사용 중이다. 충돌 없음.
- 제안: 해당 없음. 이미 정정 완료.

### [INFO] `timeout` / `timeoutAction` 필드 — 예시에서만 존재했던 stale 식별자 (충돌 없음)
- target 신규 식별자: 제거 대상 (target 이 도입하는 것이 아니라 기존 stale 예시에서 삭제하는 것)
- 기존 사용처: `spec/4-nodes/6-presentation/0-common.md` 에 `timeout`/`timeoutAction` 은 등장하지 않음. `spec/5-system/6-websocket-protocol.md` §4.4 의 이전 예시 JSON 에만 존재했다가 이미 제거된 상태
- 상세: C2 정정이 완료된 현재 파일(`6-websocket-protocol.md`)의 §4.4 `buttonConfig` 예시에 `timeout`/`timeoutAction` 이 없음을 확인. Rationale 에서 기각 사유만 기록. 다른 어떤 spec 파일에서도 `buttonConfig.timeout` 또는 `buttonConfig.timeoutAction` 식별자를 참조하는 곳 없음.
- 제안: 해당 없음.

---

## 요약

target 이 기술하는 두 변경(`count` 복원, `buttonConfig` 예시 정정)은 신규 식별자를 도입하지 않는다. 변경 1 의 `count` 필드는 이미 `spec/4-nodes/1-logic/0-common.md` §5·§9.1, `spec/conventions/node-output.md` Principle 9.2 에 동일 의미로 정의된 컨테이너 공통 식별자이며, parallel 문서의 stale 누락을 복원하는 것이다. 변경 2 의 `buttonConfig.nodeOutput` shape 변경과 `timeout`/`timeoutAction` 제거도 기존 Principle(`NodeHandlerOutput` 5필드, 판별자 금지)에 정합하는 정정으로, 신규 의미의 식별자 도입이 없다. 기존 식별자와의 의미 충돌, API endpoint 충돌, 이벤트/메시지명 충돌, ENV var 충돌, 파일 경로 충돌은 모두 해당 없음.

---

## 위험도

NONE
