# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

**리뷰 대상 커밋**: `e34d2db2 feat(execution-engine): Phase 1 hotfix — graceful shutdown + recovery 완화`
**검토 일자**: 2026-05-25

---

## 발견사항

### [WARNING] 실행·디버깅 흐름 변경 — `05-run-and-debug/` 갱신 누락

- **변경 파일**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`, `codebase/backend/src/modules/workflows/workflows.controller.ts`
- **매트릭스 항목**: "실행·디버깅 흐름 변경" → `codebase/frontend/src/content/docs/05-run-and-debug/`
- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx`
- **상세**:
  이번 변경은 실행 엔진의 핵심 흐름 두 가지를 변경했다.

  1. `recoverStuckExecutions` 대상 변경 (Phase 1.1): 서버 재시작 시 `WAITING_FOR_INPUT` 상태의 Execution이 `FAILED`로 일괄 처리되던 동작이 제거되었다. 이제 `WAITING_FOR_INPUT` 은 무기한 보존되며 사용자 입력이 도착하면 재개 경로로 진입한다. 이는 사용자에게 직접적으로 가시적인 동작 변화다 — 이전에는 서버 재배포 후 폼 대기 중이던 실행이 `실패`로 표시됐지만, 이제는 보존된다.

  2. 신규 `SERVER_INTERRUPTED` 에러 코드 (Phase 1.2): Graceful Shutdown 시 SIGTERM grace period 초과 후 남은 in-flight NodeExecution과 Execution에 `status=FAILED`, `error.code='SERVER_INTERRUPTED'`가 기록된다. 사용자가 실행 결과 페이지에서 이 에러 코드를 볼 수 있으나 `run-results.mdx`의 에러 코드 FieldTable에 설명이 없다.

  3. 신규 503 응답 (Phase 1.2): `workflows.controller.ts`가 SIGTERM 수신 후 신규 실행 요청에 `SERVER_SHUTTING_DOWN` 코드와 함께 503을 반환한다. `running-a-workflow.mdx` 또는 `error-handling.mdx`에서 이 시나리오 설명이 없다.

  현재 `run-results.mdx`의 에러 코드 FieldTable (line 132–140) 에 `NODE_EXECUTION_FAILED`, `EXECUTION_TIMEOUT`, `INVALID_EXPRESSION`, `INTEGRATION_ERROR`, `LLM_RATE_LIMITED`, `MAX_ITERATIONS_EXCEEDED`, `ERROR_PORT_FALLBACK` 7개만 등재되어 있으며 `SERVER_INTERRUPTED`가 누락되어 있다. 사용자는 이 코드를 보고 원인을 알 수 없다.

- **제안**:
  - `run-results.mdx` + `run-results.en.mdx` 의 에러 코드 FieldTable 에 `SERVER_INTERRUPTED` 행 추가. 설명 예시: "서버가 재시작(SIGTERM)될 때 처리 중이던 노드가 grace period 안에 완료되지 않아 강제 종료됐어요. 잠시 후 워크플로우를 다시 실행해 보세요."
  - (선택) `running-a-workflow.mdx` 또는 `error-handling.mdx` 에 서버 재시작/재배포 시 실행 상태 보존 정책(`WAITING_FOR_INPUT` 보존, `RUNNING` heartbeat 미응답 30분 후 FAILED) 을 한 단락으로 추가하면 사용자 이해도 향상.

---

### [INFO] 신규 errorCode `SERVER_INTERRUPTED` — backend-labels.ts ERROR_KO 매핑 현황

- **변경 파일**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
- **매트릭스 항목**: "신규 errorCode 발행 (`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 추가)" → "현재 `backend-labels.ts` 에 `ERROR_KO` 매핑 테이블이 없어 영문 message 가 그대로 노출됨. 후속 plan 에서 `ERROR_KO` 신설 검토 — 그 전까지는 errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시"
- **누락된 동반 갱신**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts`의 ERROR_KO 매핑 (미존재)
- **상세**:
  `SERVER_INTERRUPTED`는 `error-codes.ts`의 `ErrorCode` enum에 추가된 것이 아니라 `shutdown-state.service.ts`의 문자열 리터럴 `'SERVER_INTERRUPTED'`로 사용된다. 매트릭스 trigger는 `ErrorCode` enum 변경 기준이지만 실질적으로 동일한 사용자 노출 문제가 발생한다. `backend-labels.ts`에 현재 `ERROR_KO` 테이블이 존재하지 않으므로 (PROJECT.md 매트릭스 note "현재 ERROR_KO 매핑 테이블이 없어 영문 message 그대로 노출") 이 코드가 UI에 표시될 경우 영문 코드 그대로 노출된다. PR 본문 커밋 메시지에 사용자 가시 ko 노출 명시가 없다.

  `SERVER_SHUTTING_DOWN`은 HTTP 503 응답 body의 `code` 필드로 노출되는 별도 식별자이며, frontend가 이를 어떻게 처리하는지 확인이 필요하다.

- **제안**: 매트릭스 가이드에 따라 PR 본문(또는 커밋 메시지)에 "SERVER_INTERRUPTED 에러 코드는 현재 ERROR_KO 매핑 미존재로 영문 노출, 후속 ERROR_KO 신설 plan에서 처리" 를 명시하는 것이 정책 준수다. 본 변경에서 PR 본문 커밋 메시지에 이 내용이 없으므로 INFO 등급으로 기록.

---

## 요약

PROJECT.md §변경 유형 → 갱신 위치 매핑 매트릭스의 trigger 10개 중 "실행·디버깅 흐름 변경" trigger에 본 변경이 명확히 매칭된다. 변경 set(`codebase/backend/src/modules/execution-engine/` 다수 파일 + `workflows.controller.ts`)이 실행 엔진 핵심 동작 두 가지를 변경했으나 `codebase/frontend/src/content/docs/05-run-and-debug/` 산하 어떤 파일도 동반 갱신되지 않았다. 특히 `run-results.mdx` 에러 코드 FieldTable에 신규 `SERVER_INTERRUPTED` 코드 설명이 누락되어 사용자가 실행 결과에서 이 코드를 마주쳤을 때 원인을 파악할 수 없다. 매칭 trigger 1개, 누락 1건(WARNING). ERROR_KO 매핑 미존재 관련 INFO 1건 추가.

---

## 위험도

**MEDIUM**

`run-results.mdx`의 `SERVER_INTERRUPTED` 에러 코드 미등재로 사용자 가이드가 실제 동작과 불일치한다. 서버 재배포(SIGTERM) 시나리오는 운영 환경에서 주기적으로 발생하며, 영향을 받은 사용자가 실행 결과에서 `SERVER_INTERRUPTED` 코드를 보고 원인을 찾으려 할 때 가이드가 도움이 되지 않는다.
