### 발견사항

- **[WARNING]** `spec-draft-eia-62-waiting-payload.md` 의 차단 해제 확인 체크리스트가 stale
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 (`error`/`durationMs` 행, 이번 diff)
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:365` — `- [ ] eia-terminal-payload.md 차단 해제 후 --impl-prep 재실행`
  - 상세: `eia-terminal-payload.md` 는 자신의 체크리스트에 `- [x] --impl-prep 재실행 BLOCK: NO (22_29_16)` 라고 명시적으로 완료를 기록했고, 그 사실은 `spec-draft-eia-62-waiting-payload.md` 자신을 언급하는 커밋(`11ba5bdbf`, 22:41 커밋 — impl-prep 재실행(22:29)보다 뒤)의 커밋 메시지에도 그대로 남아 있다. 즉 `spec-draft-eia-62-waiting-payload.md` 가 자신이 걸어 둔 "차단 해제 확인" 조건은 이미 충족됐는데, 그 plan 파일 자체의 체크박스는 여전히 `[ ]` 로 남아 있다 (git log 상 이 plan 파일은 `11ba5bdbf` 이후 갱신된 적이 없음). 두 plan 사이의 상호 참조 동기화가 한쪽만 이뤄졌다.
  - 제안: `spec-draft-eia-62-waiting-payload.md:365` 를 `[x]` 로 갱신하고 완료 근거(`22_29_16` impl-prep BLOCK:NO)를 남길 것. 기능적 blocking 은 아니지만(양쪽 plan 이 실제로는 정합한 상태를 서술) 다음 세션이 이 항목을 "아직 안 됨" 으로 오판해 중복 작업할 위험이 있다.

- **[INFO]** `execution.cancelled` 의 `error.nodeId`/`details` 부재가 followup backlog 에 항목화되지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 `error` 행 — "**`cancelled` 는 아직 `{code, message}` 를 손으로 만들어 `nodeId`/`details` 가 없다**" (이번 diff 신규 문구)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "미구현 항목" 절 (durationMs·result.outputs 만 `[ ]` 로 등재)
  - 상세: `failed` 는 이번 PR 로 4곳 전부 `toTerminalErrorPayload` 로 일원화됐지만 `emitCancelled`(`execution-engine.service.ts:1084`)는 손대지 않았고, 그 사실이 이번 diff 로 처음 명문화됐다. "아직" 이라는 표현은 향후 보완을 암시하지만, 이를 추적하는 `[ ]` 항목은 `eia-terminal-payload.md`("다음 PR" 절 = durationMs·result.outputs 뿐)에도 `spec-sync-external-interaction-api-gaps.md` 에도 없다. 다만 같은 문서의 "`execution.cancelled` 의 행동 계약(normative)" 절(§605~620, 이번 diff 밖)이 이미 시스템 취소 `error` 를 `{code, message?}` (nodeId/details 없음)로 정의하고 있어, "아직" 이 실제로는 "설계상 없음" 일 가능성도 있다 — 두 절의 뉘앙스가 살짝 엇갈리므로 backlog 화하거나 문구를 "설계상 없음" 으로 맞추는 것 중 하나가 필요하다. 코드/스펙 정합성 자체는 diff 범위 내에서 문제없어 CRITICAL/WARNING 은 아니다.
  - 제안: 실제로 향후 보완 의도가 있다면 `spec-sync-external-interaction-api-gaps.md` 에 `[ ]` 항목으로 등재. 설계상 영구히 없는 것이 맞다면 필드 표 문구에서 "아직" 을 빼고 §행동 계약과 표현을 통일.

그 외 확인한 항목(문제 없음, 참고용): `eia-terminal-payload.md`("정본" 부모 plan)의 자매 plan 갱신 주장(`spec-sync-external-interaction-api-gaps.md`·`spec-draft-eia-notification-payload-contract.md`·`node-output-redesign/README.md`)은 실측상 전부 실제로 반영돼 있었다. "일부 경로는 string" 구식 문구는 저장소 전체에서 target spec 자신(레거시 배포 경계 caveat, 의도적 유지)과 이미 갱신된 두 plan 파일에만 남아 있어 stale 없음. `retry-turn-terminal-guard.md` #2(`cancelledBy` 누락)는 이번 diff 의 `result.cancelledBy` 행과 정확히 교차 참조되어 있고 여전히 열린 상태로 정합하게 추적됨(코드도 미반영 확인). `1-data-model.md` §2.14 의 nullable `nodeId` 도 이미 반영 확인.

### 요약
이번 diff(`spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 정정)는 `eia-terminal-payload.md` 구현·리뷰 사이클의 자연스러운 산출물이며, 관련 자매 plan(`spec-sync-external-interaction-api-gaps.md`, `spec-draft-eia-notification-payload-contract.md`, `node-output-redesign/README.md`, `retry-turn-terminal-guard.md`)과의 교차 참조는 실측상 대부분 이미 정합했다. 유일하게 실질적인 갭은 `spec-draft-eia-62-waiting-payload.md` 의 차단 해제 확인 체크박스가 실제 완료 사실(같은 세션의 커밋 메시지에도 기록됨)을 반영하지 못하고 `[ ]` 로 남아 있는 것으로, 이는 blocking 은 아니지만 향후 세션의 오판을 유발할 수 있는 문서 동기화 누락이다. `cancelled` error 의 `nodeId`/`details` 부재에 대한 backlog 미등재는 참고용 INFO 로만 남긴다.

### 위험도
LOW
