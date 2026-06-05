# 테스트(Testing) 리뷰 결과

리뷰 일시: 2026-06-05  
대상: rag-rerank-followup 변경 (26개 파일)

---

## 발견사항

### [INFO] 리뷰 대상 변경이 전부 spec/review 문서 전용 — 구현 코드 변경 없음

- 위치: 변경된 26개 파일 전체
- 상세: 이번 커밋 범위의 변경은 `spec/**/*.md`, `review/**/*.md` 문서에만 해당하며, `codebase/` 하위에 추가·수정된 `.ts` 파일이 없다. 따라서 "변경 코드에 대한 테스트" 관점의 직접 점검 대상 구현 코드는 존재하지 않는다.
- 제안: 테스트 관점 리뷰는 해당 spec 이 가리키는 이미 구현된 코드와 현존 테스트 커버리지 간의 갭으로 범위를 전환한다.

---

### [WARNING] `summaryModel` / `extractionModel` 신규 필드에 대한 단위 테스트 갭

- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §12.12` + `spec/5-system/17-agent-memory.md §3`
- 상세: `summaryModel` / `extractionModel` 두 optional 필드가 **과거 기각 결정의 번복**으로 도입됐다. spec 은 fallback 체인 `extractionModel → model → llmConfig.defaultModel`을 정의하고 "미설정 시 기존 동작 100% 유지"를 보장한다고 명시한다. 이 fallback 체인은 3-depth(설정값 존재 / 미설정 + 노드 model 존재 / 미설정 + 노드 model 없음)의 경계 케이스를 갖는다. 해당 fallback 로직을 검증하는 전용 단위 테스트가 현존하는지 확인되지 않으며, spec 에도 테스트 필요성 메모가 없다. 결정 번복 후 미설정 경로에서 regression이 발생해도 탐지가 어렵다.
- 제안: AI Agent 핸들러의 요약 LLM 콜 경로(`1-ai-agent.handler.ts` 또는 유사)에 다음 케이스를 커버하는 단위 테스트 추가:
  1. `summaryModel` 설정 시 → 해당 모델 사용
  2. `summaryModel` 미설정 + 노드 `model` 설정 시 → 노드 model 사용
  3. `summaryModel` 미설정 + 노드 `model` 미설정 시 → `llmConfig.defaultModel` 사용
  `extractionModel` 경로도 동형으로 필요.

---

### [WARNING] `information_extractor` `_resumeCheckpoint` 확장에 대한 rehydration 테스트 갭

- 위치: `spec/5-system/4-execution-engine.md §1.3 / §7.5` + `spec/4-nodes/3-ai/3-information-extractor.md`
- 상세: 이번 spec 변경은 `_resumeCheckpoint` 적용 범위를 `ai_agent` 한정에서 `information_extractor` 까지 확장했다. 추가된 IE 고유 runtime state(`partialResult` / `collectionRetryCount`)가 checkpoint allow-list 에 등재되고 `buildRetryReentryState` 재구성기가 이를 처리하는 경로는 회귀 위험이 있다. 현재 `/codebase/backend/src/nodes.integration.spec.ts` 등 통합 테스트가 존재하나, IE의 재시작 후 재개(`RESUME_INCOMPATIBLE_STATE` 경로 포함) 시나리오를 명시적으로 커버하는지 확인되지 않는다. `partialResult` 가 있는 상태에서 재개 시 기존 값이 보존되는지, `schemaVersion` 불일치 시 graceful reset이 올바르게 동작하는지가 테스트 부재 시 blind spot이 된다.
- 제안: 다음 케이스를 커버하는 통합 또는 단위 테스트 추가:
  1. IE `waiting_for_input` → 인스턴스 재시작 → 재개 시 `partialResult` / `collectionRetryCount` 무손실 복원
  2. `schemaVersion` 이 현재 코드 버전 초과인 checkpoint 로드 시 `RESUME_INCOMPATIBLE_STATE` 발생
  3. checkpoint 부재(v1 이전 row) 시 graceful reset (기존 동작 회귀 없음)

---

### [WARNING] `Execution.conversation_thread` durable commit 경로 테스트 미확인

- 위치: `spec/conventions/conversation-thread.md §4 / §8.4` + `spec/5-system/4-execution-engine.md §6.2`
- 상세: spec 은 `waiting_for_input` park 진입 시 `context.conversationThread` 전체를 `Execution.conversation_thread jsonb` 컬럼에 commit 하고 rehydration 이 이 컬럼에서 무손실 복원한다고 약속한다. 이 spec은 "기존 `rehydrateContext`가 빈 thread로 리셋하는 drift"를 수정한 것으로, 수정 전·후 동작 차이가 있다. 해당 경로를 커버하는 테스트가 없으면 (a) park 시 commit이 실제로 실행되는지, (b) rehydration 이 해당 컬럼을 우선 로드하는지, (c) `runningSummary` / `summarizedUpToSeq` 가 park→재시작 후에도 보존되는지를 자동화 검증할 방법이 없다.
- 제안: 다음 케이스를 커버하는 e2e 또는 통합 테스트 추가:
  1. AI Agent multi-turn park → `Execution.conversation_thread` 컬럼에 thread snapshot이 기록됨 (DB assertion)
  2. park 후 인스턴스 재시작 시뮬레이션 → rehydration 이 해당 컬럼에서 thread 복원 (`runningSummary` 포함)
  3. Redis `ExecutionContext` 미존재 + `conversation_thread` 컬럼 존재 상태에서 정상 재개 확인

---

### [WARNING] `active_running_ms` 누적 및 `EXECUTION_TIME_LIMIT_EXCEEDED` 판정 테스트 갭

- 위치: `spec/5-system/4-execution-engine.md §8` + `spec/1-data-model.md` (`active_running_ms` 컬럼)
- 상세: spec 은 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 환경 변수 기반 판정(`>=` 경계 포함), `waiting_for_input` park 시간 제외, graceful shutdown 시 under-count 허용 trade-off를 상세히 기술한다. 이 로직은 다음 경계값 케이스를 갖는다:
  - `activeNow === maxActiveRunningMs` (경계 정확히 일치) → failed 처리 (spec `>=`)
  - `EXECUTION_MAX_ACTIVE_RUNNING_MS=0` (무제한) → 타임아웃 미발생
  - park 시간이 긴 실행에서 `active_running_ms`가 park 시간을 포함하지 않음
  - 위 케이스들을 검증하는 테스트의 존재 여부가 불명확하다.
- 제안: `execution-engine.service.ts`의 `assertActiveTimeWithinLimit` 및 `updateExecutionStatus` 관련 로직에 단위 테스트 추가:
  1. `activeNow < max` → 정상 진행
  2. `activeNow === max` → `EXECUTION_TIME_LIMIT_EXCEEDED` (경계 포함)
  3. `activeNow > max` → `EXECUTION_TIME_LIMIT_EXCEEDED`
  4. `max === 0` → 무제한(타임아웃 미발생)
  5. park 구간 동안 `active_running_ms` 증가 없음 확인

---

### [WARNING] Agent Memory 관리 API (`AGM-12` / `AGM-13`) 권한 테스트 필요

- 위치: `spec/5-system/17-agent-memory.md §6` + `spec/2-navigation/16-agent-memory.md §2`
- 상세: spec은 `GET /agent-memories/scopes`, `GET /agent-memories`는 viewer+, `DELETE /agent-memories/:id` 및 `DELETE /agent-memories?scopeKey=`는 editor+ 로 권한을 명시한다. 또한 단건 삭제 시 `WHERE id = $1 AND workspace_id = $ws`로 cross-workspace 차단을 요구한다. 이 권한 정책과 격리 강제는 보안 회귀 위험이 있는 항목이다.
- 제안: 다음 케이스를 커버하는 통합 또는 e2e 테스트 추가:
  1. viewer 로 `DELETE` 시도 → 403 반환
  2. editor+ 로 `DELETE /agent-memories/:id` 성공
  3. 다른 workspace의 메모리 `id` 로 삭제 시도 → 404 반환 (cross-workspace 격리)
  4. `DELETE /agent-memories?scopeKey=` scope 전체 삭제 성공 + 해당 scope만 삭제됨 확인

---

### [INFO] `schemaVersion` 경계값 테스트 — 과거 버전 checkpoint 하위호환 보강 케이스

- 위치: `spec/5-system/4-execution-engine.md §1.3`
- 상세: spec은 `schemaVersion` 이 현재 코드 버전 이하면 "누락 필드를 기본값으로 보강해 backward-compatible 재구성"하고, 버전 초과 시 graceful reset한다고 명시한다. 버전 누락(null/undefined, 기능 배포 이전 row)과 버전이 1 이하인 구버전 payload에서 필수 필드가 없을 때 기본값이 올바르게 채워지는지 확인하는 테스트가 필요하다.
- 제안: `buildRetryReentryState` 유닛 테스트에 다음 케이스 추가:
  1. `schemaVersion` 필드 없는 payload → 기본값 보강 후 정상 재구성
  2. 현재 버전 미만 payload + 일부 필드 누락 → 기본값 채움
  3. 현재 버전 초과 payload → `RESUME_INCOMPATIBLE_STATE` throw

---

### [INFO] RerankConfig CRUD API 권한 테스트 확인 필요

- 위치: `spec/5-system/1-auth.md §3.2` (Rerank Config 권한 매트릭스 추가)
- 상세: spec 에 `Rerank Config: CRUD(owner/admin), R(member/viewer)` 권한 행이 추가됐다. LLMConfig 와 동일 패턴의 sibling 리소스이므로 LLMConfig 권한 테스트가 존재한다면 동형의 테스트 커버리지를 RerankConfig 에도 적용해야 한다.
- 제안: LLMConfig 권한 테스트 파일이 있다면 `rerank-configs.controller.spec.ts` 또는 e2e 테스트에서 viewer가 CRUD mutation 시 403을 받는 케이스 커버 여부 확인.

---

### [INFO] `execution-run` 큐 추가 — `system-status` 큐 카운트 테스트 동기화 필요

- 위치: `spec/5-system/16-system-status-api.md` + `spec/data-flow/9-observability.md` (12개 → 13개)
- 상세: BullMQ 큐 수가 12개에서 13개로 변경됐다. `SystemStatusService` 가 큐 목록을 정적 배열로 관리한다면 해당 서비스의 단위/통합 테스트에 하드코딩된 큐 수 또는 큐 이름 목록이 있을 수 있으며, 이 경우 `execution-run` 누락으로 테스트가 실패하거나 잘못된 상태를 반환할 수 있다.
- 제안: `system-status.service.spec.ts` 또는 관련 테스트에서 큐 카탈로그 목록이 `execution-run`을 포함하는지 확인.

---

## 요약

이번 변경은 26개 파일 전체가 spec(`spec/**`) 및 review(`review/**`) 문서 변경으로, 직접 구현 코드 수정은 없다. 그러나 변경된 spec들이 기술하는 기능들(summaryModel/extractionModel fallback, IE _resumeCheckpoint 확장, conversation_thread durable commit, active_running_ms 타임아웃, Agent Memory 관리 API)은 테스트 관점에서 중요한 커버리지 갭을 노출한다. 특히 (1) summaryModel/extractionModel 3-depth fallback 체인, (2) IE rehydration 경로, (3) conversation_thread park commit + rehydration 무손실 복원, (4) active_running_ms 경계값 판정은 결정 번복 또는 신규 경로여서 회귀 위험이 높음에도 전용 테스트가 확인되지 않는다. Agent Memory 관리 API의 권한·격리 테스트 갭도 보안 회귀 경로로 WARNING 수준이다.

---

## 위험도

MEDIUM
