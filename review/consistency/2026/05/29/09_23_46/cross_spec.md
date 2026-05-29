# Cross-Spec 일관성 검토

- **대상 (target)**: `spec/5-system/4-execution-engine.md` — Phase 3.1 변경 (변경 2.3 + DLQ 모니터링)
- **변경 범위**: §7.5.1 구현 상태 주석 갱신 + §9.3 Dead-letter 모니터링 섹션 신설
- **검토 일시**: 2026-05-29

---

## 발견사항

- **[INFO]** §7.5 `removeOnComplete: true` 단독 기술 — `removeOnFail: false` 미언급
  - target 위치: `spec/5-system/4-execution-engine.md` line 823 (§7.5 "Rehydration 멱등성")
  - 충돌 대상: 동일 파일 line 930 (§9.3 Dead-letter 모니터링, 신설)
  - 상세: line 823 은 `execution-continuation` 큐의 BullMQ 옵션으로 `removeOnComplete: true` 만 기술하고 `removeOnFail: false` 를 언급하지 않는다. 신설된 §9.3 은 `removeOnFail: false` 를 큐 운영의 전제로 명시한다. 두 값은 BullMQ 의 별개 옵션이므로 논리적 모순은 아니지만, §7.5 를 단독으로 읽을 때 failed job 이 자동 제거되는지(`removeOnFail` 의 기본값이 기재되지 않아 독자가 true 로 가정할 수 있음) 오해의 소지가 있다. 구현 코드(`continuation-execution.queue.ts`)는 `removeOnComplete: true` + `removeOnFail: false` 를 함께 선언한다.
  - 제안: `spec/5-system/4-execution-engine.md` §7.5 line 823 을 "BullMQ `removeOnComplete: true` + `removeOnFail: false` + `attempts: RESUME_BULLMQ_ATTEMPTS` (기본 3)" 으로 갱신해 §9.3 과 정합성 확보.

- **[INFO]** `POST :id/continue` 422 `INVALID_STATE` — REST API 목록에 endpoint 미등재
  - target 위치: `spec/5-system/4-execution-engine.md` §7.5.1 구현 상태 주석 (line 861)
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md` §8 API 목록 (line 299–301)
  - 상세: 구현 상태 주석이 "REST `POST :id/continue` 는 422 `INVALID_STATE`" 를 반환한다고 기술하지만, `spec/3-workflow-editor/3-execution.md` 의 REST 엔드포인트 목록에 `POST /api/executions/:id/continue` 가 등재되어 있지 않다 (`stop` 만 있음). 이는 cross-spec 논리 모순이 아니라 spec-coverage 갭이지만, 해당 endpoint 의 공식 contract (request shape, 에러 응답)가 다른 spec 파일 어디에도 정의되지 않은 상태이다.
  - 제안: `spec/3-workflow-editor/3-execution.md` 또는 `spec/5-system/4-execution-engine.md §7.4` 에 `POST /api/executions/:id/continue` 의 request/response shape 과 422 `INVALID_STATE` 반환 조건을 공식 등재.

- **[INFO]** EIA 외부 진입점의 `409 STATE_MISMATCH` — 기존 EIA spec 과의 cross-link 부재
  - target 위치: `spec/5-system/4-execution-engine.md` §7.5.1 구현 상태 주석 (line 861)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 line 305; EIA-IN-13
  - 상세: 타겟 주석은 EIA `interaction.service` 가 invalid lookup(0건/다중 row) 시 `409 STATE_MISMATCH` 를 반환한다고 기술한다. EIA spec line 305 의 `STATE_MISMATCH` 정의("현재 노드/실행 상태와 명령 불일치")는 이 케이스를 의미적으로 포괄하며 모순이 없다. 단, EIA spec 은 `STATE_MISMATCH` 에 publisher 측 사전 검증(`INVALID_EXECUTION_STATE` 상당) 케이스가 포함된다는 명시가 없어 두 문서 교차 독자가 대응 관계를 역추적하기 어렵다.
  - 제안: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표의 `STATE_MISMATCH` 행에 "publisher 측 사전 검증 실패 포함 — [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state) 참조" 주석 추가.

---

## 요약

이번 변경(§7.5.1 구현 상태 갱신 + §9.3 DLQ 모니터링 신설)은 `spec/5-system/6-websocket-protocol.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/14-external-interaction-api.md`, `spec/data-flow/3-execution.md` 등 관련 spec 과 논리적으로 충돌하지 않는다. `INVALID_EXECUTION_STATE`(WS) / `INVALID_STATE`(REST 422) / `STATE_MISMATCH`(EIA 409) 삼자 분리 정책은 기존 정의와 일치하며, DLQ 모니터링 환경 변수 4종(`CONTINUATION_DLQ_*`)은 기존 env var 네임스페이스와 중복이 없다. 발견된 항목 3건은 모두 INFO 등급으로, (1) §7.5 에 `removeOnFail: false` 를 기술하지 않은 불완전성, (2) `POST /api/executions/:id/continue` endpoint 가 REST API 목록에 미등재된 spec-coverage 갭, (3) EIA `STATE_MISMATCH` 와 `INVALID_EXECUTION_STATE` 간 역방향 cross-link 부재이다. 어느 항목도 두 spec 영역 중 하나를 작동 불가로 만드는 직접 모순에 해당하지 않는다.

---

## 위험도

LOW

---

STATUS: SUCCESS
