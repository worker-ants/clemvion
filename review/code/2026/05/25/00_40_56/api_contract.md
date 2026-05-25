# API 계약(API Contract) 리뷰

**리뷰 대상**: workflow-resumable-execution Phase 1.1 / 1.2
**리뷰 일자**: 2026-05-25
**분석 파일**: 총 23개 (API 관련 실질 변경 4개)

---

## 발견사항

### [WARNING] 503 응답 바디의 에러 형식이 기존 API 규약과 조율 미확인

- **위치**: `codebase/backend/src/modules/workflows/workflows.controller.ts` — 신규 shutdown gate 블록
- **상세**: `ServiceUnavailableException` 에 전달하는 바디가 `{ code: 'SERVER_SHUTTING_DOWN', message: '...' }` 형태이다. 기존 NestJS 전역 예외 필터가 이 객체를 어떻게 직렬화하는지에 따라 클라이언트가 받는 최종 JSON 구조가 달라진다. 일반적으로 NestJS 기본 필터는 `{ statusCode, message, error }` 형태로 감싸며, 커스텀 필터가 있다면 해당 필터의 출력 형식을 따른다. `code` 필드가 최상위에 노출되는지, 아니면 `message` 내부에 중첩되는지 프로젝트 기존 에러 응답 형식과의 일치 여부가 불명확하다. 일관성 검토(review/consistency SUMMARY W-3)에서도 "§11 503 응답이 api-convention 과 미조율"로 이미 지적된 사항이다.
- **제안**: 기존 API 에러 응답 형식(예: `{ error: { code, message } }` 또는 `{ statusCode, code, message }`)을 확인하고 동일한 구조로 맞출 것. 전역 예외 필터의 동작을 단위 테스트(`workflows.controller.spec.ts`)에서 검증하거나, `@HttpCode` + 수동 `res.json()` 방식으로 응답 형식을 명시적으로 제어하는 것을 권장한다.

---

### [WARNING] 503 응답에 `Retry-After` 헤더 설정 방식 — `@Res` passthrough 사용

- **위치**: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `@Res({ passthrough: true }) res: Response` 주입 및 `res.setHeader('Retry-After', ...)`
- **상세**: `@Res({ passthrough: true })`는 NestJS 가 응답 직렬화를 계속 관장하면서 raw `Response` 객체에 접근하는 올바른 방식이다. 사용 자체는 적절하다. 다만 `Retry-After` 헤더가 `throw new ServiceUnavailableException(...)` 이전에 `res.setHeader`로 설정되는데, NestJS 예외 필터가 헤더를 덮어쓰지 않는다는 전제가 있어야 한다. 예외 필터가 `res.clearHeaders()`를 내부에서 호출하거나 새 응답 객체를 생성하면 헤더가 소실될 수 있다.
- **제안**: `workflows.controller.spec.ts`에 503 응답의 `Retry-After` 헤더 존재 여부를 검증하는 테스트 케이스를 추가하라. 현재 스펙 파일(`workflows.controller.spec.ts`)에 해당 검증이 포함되어 있는지 확인 필요.

---

### [INFO] `recoverStuckExecutions` 에러 메시지 변경 — API 응답이 아닌 DB 저장 값

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `recoverStuckExecutions()` 내 `.set({ error: { message: 'Execution failed: worker heartbeat timeout' } })`
- **상세**: 에러 메시지가 `'server restarted while waiting for user input'`에서 `'worker heartbeat timeout'`으로 변경된다. 이 값은 `Execution` 엔티티의 `error` 컬럼에 저장되고, 이후 실행 조회 API(`GET /executions/:id` 등)를 통해 클라이언트에 노출된다. 기존에 이 문자열에 의존하는 클라이언트 코드(에러 메시지 파싱, 로그 알림 룰, 모니터링 필터 등)가 있다면 breaking change가 된다. 단, 이는 내부 복구 경로에서만 발생하며 정상 플로우의 응답 형식은 변경되지 않는다.
- **제안**: 클라이언트가 메시지 문자열 대신 `error.code` 등 구조화된 필드를 사용하도록 안내하거나, `error` 객체에 `code: 'WORKER_HEARTBEAT_TIMEOUT'` 필드를 추가하여 프로그래매틱 식별을 가능하게 할 것. 현재 코드는 `{ message: '...' }` 만 저장하고 `code` 가 없어 클라이언트 측 분기 처리에 불리하다.

---

### [INFO] `ShutdownStateService.onApplicationShutdown` 에서 DB에 기록하는 `SERVER_INTERRUPTED` 코드 — 클라이언트 노출 경로

- **위치**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` (diff 생략됨으로 spec 및 테스트에서 내용 추론)
- **상세**: `shutdown-state.service.spec.ts`에서 확인되는 바, `onApplicationShutdown` 실행 시 `status: NodeExecutionStatus.FAILED, error: { code: 'SERVER_INTERRUPTED' }`가 DB에 기록된다. 이 코드는 `GET /node-executions/:id` 등 노드 실행 조회 API를 통해 클라이언트에 노출될 수 있다. `SERVER_INTERRUPTED`가 기존 에러 코드 목록(`spec/1-data-model.md §2.13`)에 신규 추가되는 코드임이 일관성 검토(W-5)에서 지적되었으며, 구체 삽입 위치가 spec에 명시되지 않은 상태다. 클라이언트 SDK 또는 프론트엔드가 알려진 에러 코드 목록으로 분기 처리한다면 이 코드를 인식하지 못할 수 있다.
- **제안**: `spec/1-data-model.md §2.13` 에러 코드 목록에 `SERVER_INTERRUPTED` 를 명시적으로 추가하고, 프론트엔드/클라이언트에 해당 코드 처리 가이드라인을 반영하라.

---

### [INFO] 신규 에러 코드 `RESUME_QUEUED`의 WebSocket ack 표현 방식 불일치

- **위치**: `spec-draft` (plan 문서 참조) — `execution.submit_form` / `execution.submit_message` ack
- **상세**: 이번 변경 세트 자체에는 WebSocket 핸들러 변경이 없으나, 이번 변경이 활성화하는 Phase 2 rehydration 경로에서 `RESUME_QUEUED` 코드가 WebSocket ack 에러 코드 표에 "성공 변형"으로 정의될 예정이다. 기존 WebSocket ack 설계는 `{ resumed: boolean, error?: { code, message } }` 구조에서 `error` 객체는 실패 전용이다. `RESUME_QUEUED`를 에러 코드 표에 성공 변형으로 넣으면 클라이언트가 `error` 객체 유무를 성공/실패 판별에 사용하는 기존 패턴이 깨진다. 일관성 검토(W-8, convention_compliance.md)에서 이미 지적되었으며, 현재 구현 코드에는 반영되지 않은 Phase 2 설계 사항이다.
- **제안**: Phase 2 구현 시 ack payload에 `queued: boolean` 또는 `resumeStrategy: 'direct' | 'queued'` 필드를 별도로 추가하고, `RESUME_QUEUED`를 에러 코드 표에서 제외하는 방향으로 확정할 것. 현재 Phase 1.2 구현에는 직접 영향 없으나, 향후 API 계약 breaking change 위험으로 사전 기록한다.

---

## 요약

이번 변경의 핵심 API 계약 관련 변경은 두 가지다. 첫째, `POST /workflows/:id/trigger` (또는 동등한 실행 시작 엔드포인트)에 SIGTERM 수신 후 503 게이트가 추가되었으며, `Retry-After` 헤더와 함께 `{ code: 'SERVER_SHUTTING_DOWN', message: '...' }` 바디를 반환한다. 503 바디 형식이 프로젝트 기존 에러 응답 형식(전역 예외 필터 출력)과 일치하는지 검증이 필요하며, `Retry-After` 헤더가 예외 필터를 거친 후에도 보존되는지 테스트 커버리지가 필요하다. 둘째, `recoverStuckExecutions`가 DB에 기록하는 에러 메시지가 변경되어 기존 에러 메시지 문자열에 의존하는 클라이언트 코드에 breaking change가 될 수 있으나, 구조화된 `code` 필드 없이 `message` 만 저장하는 현행 패턴은 개선이 필요하다. `SERVER_INTERRUPTED` 신규 에러 코드의 공식 spec 등재가 누락된 상태이며, Phase 2에서 도입될 `RESUME_QUEUED` 의 WebSocket ack 표현 방식은 기존 ack 설계와 충돌 위험이 있어 사전 조율이 필요하다. 전반적으로 하위 호환성 위험은 낮지만 에러 응답 형식의 일관성 측면에서 보완이 권장된다.

---

## 위험도

MEDIUM

`recoverStuckExecutions` 에러 메시지 변경이 클라이언트 파싱 패턴을 깨뜨릴 수 있고, 503 응답 바디 형식의 일관성이 검증되지 않았으며, `SERVER_INTERRUPTED` 에러 코드가 공식 spec에 미등재 상태이다. Phase 2 설계의 `RESUME_QUEUED` ack 표현 방식도 기존 계약과 충돌 예정이어서 사전 결정이 필요하다.
