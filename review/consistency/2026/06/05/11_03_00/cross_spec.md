## 발견사항

### [WARNING] `RESUME_INCOMPATIBLE_STATE` 트리거 조건 — websocket-protocol 미동기

- target 위치: `spec/5-system/4-execution-engine.md` §7.5 "Rehydration 실패 케이스" 표 (행: `RESUME_INCOMPATIBLE_STATE`)
- 충돌 대상: `spec/5-system/6-websocket-protocol.md` line 298
- 상세: target 에서 `RESUME_INCOMPATIBLE_STATE` 의 트리거 조건이 기존 "부재 또는 손상" 2가지에서 **"부재 · 손상 · 미래 버전(`schemaVersion` 이 현재 코드 `CHECKPOINT_SCHEMA_VERSION` 초과)"** 3가지로 확장됐다. 그러나 `6-websocket-protocol.md` §4.2 에러 코드 표는 여전히 "부재(기능 배포 이전 waiting row) 또는 손상(schema drift 로 재구성 실패)" 만 기술해 새로 추가된 미래 버전 케이스가 누락된 상태다. 동일 에러 코드에 대한 두 spec 의 트리거 설명이 불일치한다.
- 제안: `spec/5-system/6-websocket-protocol.md` line 298 의 `RESUME_INCOMPATIBLE_STATE` 설명에 "·**미래 버전**(`schemaVersion` 이 현재 코드 `CHECKPOINT_SCHEMA_VERSION` 초과 — 롤링 배포 중 구 인스턴스가 신 포맷 pickup)" 을 추가해 4-execution-engine.md §7.5 와 동기화한다.

---

### [WARNING] `_resumeCheckpoint` 소비 설명 — 1-ai-agent.md 미동기

- target 위치: `spec/5-system/4-execution-engine.md` §1.3 `_resumeCheckpoint` 소비 bullet ("소비: §7.5 rehydration 이 … 버전 검사 → … 미래 버전 시 graceful reset")
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` line 703 생명주기 비교표 `_resumeCheckpoint` 행의 "소비" 열
- 상세: 1-ai-agent.md 의 `_resumeCheckpoint` 소비 설명은 "부재/손상 시 graceful reset (§7.5 `RESUME_INCOMPATIBLE_STATE`)" 로 기술되어 있고, 새로 추가된 버전 검사 단계(`→ 버전 검사 →`) 와 미래 버전 graceful reset 케이스가 반영되지 않았다. 또한 "핵심 필드 누락 시 기본값 보강" 동작도 소비 설명에 미언급 상태다.
- 제안: `spec/4-nodes/3-ai/1-ai-agent.md` line 703 의 소비 열을 `4-execution-engine.md §1.3` 의 개정된 소비 불릿과 동기화한다: "부재/손상/미래 버전 시 graceful reset (`RESUME_INCOMPATIBLE_STATE`)" + 버전 검사 단계 반영.

---

### [WARNING] `_resumeCheckpoint` 설명 — node-output.md 미동기

- target 위치: `spec/5-system/4-execution-engine.md` §1.3 `_resumeCheckpoint` 소비 bullet
- 충돌 대상: `spec/conventions/node-output.md` line 208 Principle 4.2.1
- 상세: `node-output.md` §4.2.1 의 `_resumeCheckpoint` 설명 마지막에 "부재/손상 시 graceful reset (`RESUME_INCOMPATIBLE_STATE`)" 라고만 기술되어 있어, 미래 버전 케이스가 누락됐다. 또한 재구성 시 "핵심 필드 누락 시 기본값 보강" 동작이 반영되지 않은 상태다.
- 제안: `spec/conventions/node-output.md` line 208 을 "부재/손상/미래 버전 시 graceful reset (`RESUME_INCOMPATIBLE_STATE`)" 으로 수정하고, 버전 검사 및 기본값 보강 동작을 간략히 추가한다.

---

### [INFO] `schemaVersion` 필드 — `_retryState` 와의 비교 표 미언급

- target 위치: `spec/5-system/4-execution-engine.md` §1.3 `_resumeCheckpoint` shape 서술
- 충돌 대상: `spec/conventions/node-output.md` §4.2.1 및 `spec/4-nodes/3-ai/1-ai-agent.md` 생명주기 비교표
- 상세: target 이 `_resumeCheckpoint` 에 `schemaVersion` 필드를 추가했지만, node-output.md §4.2.1 에서 `_resumeCheckpoint` 포함 필드 목록("messages / turnCount / model / temperature / maxTokens / …" — 현재는 `_retryState` 포함 필드로만 나열)에 `schemaVersion` 이 언급되지 않았다. `_retryState` 에는 같은 `schemaVersion` 이 포함되지 않는다는 차이도 명시적으로 서술되지 않았다.
- 제안: `spec/conventions/node-output.md` §4.2.1 의 `_resumeCheckpoint` 설명에 `schemaVersion` 포함 여부를 명시하고, `_retryState` 와의 포함 필드 차이를 정리한다(정보 동기화 권장 수준).

---

## 요약

이번 변경(`spec/5-system/4-execution-engine.md` A2a checkpoint 견고화)은 `_resumeCheckpoint` 에 `schemaVersion`/`CHECKPOINT_SCHEMA_VERSION` 버전 스탬프를 추가하고 `RESUME_INCOMPATIBLE_STATE` 트리거 조건을 3가지로 확장했다. 핵심 충돌은 동일 에러 코드(`RESUME_INCOMPATIBLE_STATE`)와 `_resumeCheckpoint` 소비 흐름을 독립적으로 기술하는 3개 문서(`6-websocket-protocol.md` · `1-ai-agent.md` · `node-output.md`)가 새로운 "미래 버전" 케이스와 버전 검사 단계를 반영하지 않아 불일치가 생긴 것이다. 직접 모순은 아니지만(기존 케이스는 여전히 유효), 운용상 미래 버전 케이스가 발생했을 때 다른 spec 을 보는 독자는 RESUME_INCOMPATIBLE_STATE 원인을 특정하지 못하게 된다. 3개 문서의 해당 구절을 target 과 동기화하면 완전히 해소된다.

## 위험도

LOW
