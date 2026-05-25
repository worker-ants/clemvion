# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md`
검토 모드: `--spec` (spec draft 검토)
검토일: 2026-05-25

---

## 발견사항

### [CRITICAL] §11 참조 대상 섹션이 실재하지 않음

- **target 위치**: target 문서 전체 — "spec §11 step 1", "spec §11 step 4" 반복 참조
- **충돌 대상**: `spec/5-system/4-execution-engine.md` 전체 구조
- **상세**: target 은 `spec/5-system/4-execution-engine.md §11` 을 현존 섹션으로 전제하여 step 1, step 4 의 본문을 직접 인용하고 수정안을 제안한다. 그러나 실제 `spec/5-system/4-execution-engine.md` 의 최상위 섹션은 §1 ~ §10 + Rationale 로 구성되며, **§11 (Graceful Shutdown) 섹션 자체가 존재하지 않는다**. C-1 발견사항 원문이 참조하는 "POST /api/executions/start 및 WS `execution.start` 가 503 응답" 텍스트도 해당 파일 어디에도 없다.
- **제안**: target 을 채택하려면 먼저 `spec/5-system/4-execution-engine.md` 에 §11 Graceful Shutdown 섹션 자체를 신설하는 선행 작업이 필요하다. 현재 target 문서는 존재하지 않는 본문을 수정하는 형태라 그대로 project-planner 가 반영할 수 없다. §11 신설 draft 와 본 phase-scope 보정 draft 를 단일 작업으로 묶거나 순서를 명시해야 한다.

---

### [CRITICAL] 데이터 모델 §2.13 error.code 어휘가 현재 spec 에 미정의 상태

- **target 위치**: "spec/1-data-model.md §2.13 error.code 어휘 보완 (W-21 연관)" 섹션 — 기존 텍스트로 `"엔진 인프라 차원의 코드를 포함한다 — SERVER_INTERRUPTED (...), RESUME_FAILED / ..."` 가 이미 있다고 전제
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution.error` 필드 현재 본문
- **상세**: 실제 `spec/1-data-model.md` §2.13 `Execution.error` 필드 설명은 `"에러 정보. 최초 failed NodeExecution의 에러를 참조/복사 (아래 참조)"` 로만 되어 있다. target 이 "현재:" 인용으로 가정한 `SERVER_INTERRUPTED`, `RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE` 코드 어휘가 실제 파일에는 없다. 전체 `spec/` 트리에서 이 코드들이 단 하나도 검색되지 않는다. target 이 기술한 "제안 (추가)" 는 실은 기존 어휘를 보완하는 형태가 아니라 어휘 자체를 최초로 정의하는 것이다.
- **제안**: target 의 §2.13 보완 제안을 "기존 어휘에 추가"가 아니라 "어휘 섹션 신설" 로 재기술해야 한다. 동시에 `SERVER_INTERRUPTED` / `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` 의 출처가 되는 §11 및 §7.5 섹션이 먼저 신설되어야 어휘 정의가 순환 참조가 되지 않는다.

---

### [CRITICAL] §7.5 참조 대상 섹션이 실재하지 않음

- **target 위치**: "제안 (추가)" 내 `RESUME_FAILED / RESUME_CHECKPOINT_MISSING / RESUME_INCOMPATIBLE_STATE (continuation rehydration 실패, §7.5)` 참조
- **충돌 대상**: `spec/5-system/4-execution-engine.md` §7 장애 복구 — §7.1 (Worker Heartbeat), §7.2 (체크포인트 기반 Resume), §7.3 (멱등성), §7.4 (분산 실행)
- **상세**: 현재 §7 은 §7.4 까지만 존재한다. target 이 참조하는 `§7.5 (continuation rehydration 실패)` 섹션이 없다. `RESUME_FAILED` 계열 코드의 출처 섹션이 부재하므로 데이터 모델 어휘 보완의 "§7.5" 링크가 dangling reference 가 된다.
- **제안**: §7.5 섹션을 신설하거나, 해당 내용을 §7.2 에 흡수하는 방향을 명시해야 한다. §11 신설과 함께 단일 PR 로 묶는 것을 권장한다.

---

### [WARNING] HTTP 실행 시작 endpoint 명칭 불일치

- **target 위치**: "spec/5-system/4-execution-engine.md §11 step 1 보정" — 제안 본문의 `POST /api/workflows/:id/execute`
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md §8.2 / §9` — `POST /api/workflows/:id/execute`, `spec/4-nodes/7-trigger/0-common.md` — `POST /workflows/:id/execute { parameterValues }`
- **상세**: 기존 spec 에서 HTTP 실행 시작 endpoint 는 `POST /api/workflows/:id/execute` 로 정의되어 있으며, target 의 제안 역시 이를 사용한다. 이 부분은 일치한다. 그러나 발견사항 원문(C-1) 과 "현황 분석" 섹션은 각각 `"POST /api/executions/start"` (C-1) 와 `"WS execution.start"` 를 대등하게 나열한다. `POST /api/executions/start` 는 어느 spec 에도 정의되지 않은 endpoint 이다. C-1 원문이 존재하지 않는 endpoint 이름을 사용하는 오류가 포함되어 있으며, target 이 이를 정정하지 않고 "현황 분석" 에서 그대로 언급한다.
- **제안**: target 의 "현황 분석" C-1 단락에서 `POST /api/executions/start` 를 `POST /api/workflows/:id/execute` 로 정정해야 한다. 또는 발견사항 원문 C-1 이 타 spec 과 불일치함을 명시해야 한다.

---

### [WARNING] 503 HTTP 상태 코드가 API 규약에 미정의

- **target 위치**: "spec/5-system/4-execution-engine.md §11 step 1 보정" 제안 — `503 Service Unavailable` + `Retry-After` 헤더
- **충돌 대상**: `spec/5-system/2-api-convention.md §6 HTTP 상태 코드` 테이블
- **상세**: `spec/5-system/2-api-convention.md §6` 의 상태 코드 테이블은 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500 만 정의하며 503 이 없다. target 은 503 응답을 기정사실로 사용하지만 API 규약에 추가 없이는 서버 구현팀이 표준 코드 목록 밖의 응답을 발행해야 하는 상황이 된다.
- **제안**: `spec/5-system/2-api-convention.md §6` 에 `503 Service Unavailable — 서버 종료 중 (Graceful Shutdown 게이트)` 행을 추가하거나, §11 신설 시 "이 섹션의 503 은 일반 API 규약 §6 의 예외이며 Graceful Shutdown gate 전용" 임을 명시해야 한다. API 규약 파일도 함께 갱신 대상 spec 으로 포함할 것을 권장한다.

---

### [WARNING] WS execution.start 명령이 실제로는 현재 spec 에 정의되어 있음

- **target 위치**: "현황 분석 C-1" — "WS `execution.start` 명령 자체가 현재 미구현 (Phase 2 예정)"
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md §8.2 WebSocket 명령` 테이블
- **상세**: target 문서는 WS `execution.start` 가 "현재 미구현 상태" 라고 기술한다. 그러나 `spec/3-workflow-editor/3-execution.md §8.2` 는 `execution.start | workflowId, input, fromNodeId?` 를 명령 테이블에 정의하고 있다. 이는 spec 차원에서는 WS 명령이 이미 정의된 상태임을 의미한다. 구현 현황(gateway 에 핸들러 없음)과 spec 정의(명령 스키마 기재)의 차이를 target 이 "미구현" 한 단어로 혼용하여 spec 과 impl 의 경계가 모호해진다.
- **제안**: "WS `execution.start` 는 spec 에는 정의되어 있으나 Phase 1 구현 범위에서 제외됨 (gateway handler 미구현)" 으로 표현을 수정하거나, §11 step 1 Phase 1 범위 주석에서 "WS 명령 자체는 §8.2 에 정의되어 있으나 shutdown gate 는 Phase 2 에서 추가" 로 명확히 구분해야 한다. spec 본문에 이미 정의된 WS 명령을 삭제할 필요는 없다.

---

### [INFO] WORKER_HEARTBEAT_TIMEOUT 코드의 출처 섹션 정보 불완전

- **target 위치**: "spec/1-data-model.md §2.13 error.code 어휘 보완" 제안 — `WORKER_HEARTBEAT_TIMEOUT (부팅 시 recovery — 30분 이상 heartbeat 없는 RUNNING Execution, §7.4)`
- **충돌 대상**: `spec/5-system/4-execution-engine.md §7.4 분산 실행 (Multi-instance)` — Recovery 설명
- **상세**: §7.4 Recovery 단락은 stuck recovery 의 30분 임계값을 기술하지만 `WORKER_HEARTBEAT_TIMEOUT` 이라는 오류 코드를 명시하지 않는다. target 이 §7.4 를 출처로 제시하는데 실제 §7.4 본문에 코드가 없어 추적성이 끊긴다.
- **제안**: §11 신설 PR 에 §7.4 에 `WORKER_HEARTBEAT_TIMEOUT` 코드 언급을 추가하거나, 데이터 모델 어휘 추가 시 해당 코드가 어디서 설정되는지(recovery 로직)를 §7.4 에 인라인으로 먼저 명시하는 것이 권장된다.

---

### [INFO] Spec 내부 링크 `./2-api-convention.md` 경로 점검 필요

- **target 위치**: "spec/5-system/4-execution-engine.md §11 step 1 보정" 제안 — `[Spec API 규약](./2-api-convention.md)` 링크
- **충돌 대상**: `spec/5-system/2-api-convention.md` 실제 경로
- **상세**: `spec/5-system/4-execution-engine.md` 와 `spec/5-system/2-api-convention.md` 는 같은 디렉터리에 있으므로 상대 경로 `./2-api-convention.md` 는 유효하다. 문제 없음 — 정보성 확인.
- **제안**: 없음. 경로 형식은 일관됨.

---

## 요약

target 문서는 `spec/5-system/4-execution-engine.md §11 (Graceful Shutdown)` 과 `§7.5 (continuation rehydration)` 를 현존 섹션으로 전제하여 해당 본문을 수정하는 형태로 구성되어 있으나, 두 섹션 모두 현재 spec 에 존재하지 않는다. 또한 `spec/1-data-model.md §2.13` 의 `error.code` 어휘(`SERVER_INTERRUPTED`, `RESUME_FAILED` 계열) 역시 실제 파일에 없어 "기존 어휘에 WORKER_HEARTBEAT_TIMEOUT 을 추가한다" 는 전제 자체가 성립하지 않는다. 이 세 가지 CRITICAL 사항은 target 을 그대로 반영하면 project-planner 가 존재하지 않는 spec 본문을 편집하는 상황이 되므로 채택 전 §11 / §7.5 신설 및 §2.13 어휘 초기 정의 작업이 선행되어야 한다. 추가로 API 규약 §6 에 503 상태 코드 미정의, WS `execution.start` 의 spec 정의/구현 경계 혼용 표현은 WARNING 수준이며 §11 신설 시 함께 정정이 필요하다.

---

## 위험도

**HIGH**
