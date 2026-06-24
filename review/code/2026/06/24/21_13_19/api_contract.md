# API 계약(API Contract) 리뷰

리뷰 대상: `refactor(execution-engine): C-1+M-7 — continuation publish 실패 fail-fast 통일`

---

## 발견사항

### [WARNING] REST `POST /executions/:id/stop` WAITING 분기 503 응답 — spec 미기술 상태에서 구현 선행

- **위치**: `codebase/backend/src/modules/executions/executions.service.ts` (WAITING 분기 추가 블록, 변경 diff +4~+22)
- **상세**: `POST /executions/:id/stop` 엔드포인트에 신규 503 응답 경로가 추가되었다. 이 동작(WAITING 분기 publish 실패 시 503 + `EXECUTION_ENQUEUE_FAILED`)은 현재 어떤 API spec(`spec/5-system/3-execution.md §9` 표, `spec/5-system/4-execution-engine.md §7.4·§7.5`)에도 기술되어 있지 않다. 기존 503 사용처는 shutdown 게이트(`§11.1 SERVER_SHUTTING_DOWN`)뿐이다. 클라이언트 입장에서는 이 엔드포인트에서 503이 새롭게 발생할 수 있게 된 것이 사전 공지 없이 계약에 추가된 것이다.
- **제안**: 코드 변경 자체는 올바른 방향(Redis 의존성 장애 = upstream 불가 → 503, api-convention §6 적합)이나, spec-sync PR에서 `spec/5-system/3-execution.md` 또는 `spec/5-system/4-execution-engine.md §7.4·§7.5`에 "WAITING 분기 publish 실패 시 503 `EXECUTION_ENQUEUE_FAILED` 반환" 을 1줄 추가해야 API 계약이 완성된다. 현재 commit 메시지에 "merge-gate: 동행 머지 권장"이 명시되어 있어 인지되고 있는 상태임.

---

### [INFO] 에러 응답 형식 — `ServiceUnavailableException` body 구조 일관성 확인

- **위치**: `codebase/backend/src/modules/executions/executions.service.ts` 추가 블록
- **상세**: `{ code, message }` 형태의 에러 body는 프로젝트의 표준 에러 응답 envelope(spec §3.2, `buildErrorEnvelope` 패턴)과 동일 구조다. `code` 필드에는 `ErrorCode` enum에 등재된 `EXECUTION_ENQUEUE_FAILED`를 사용하고 있어 일관성 측면에서 적합하다. `message`는 영문 평문으로 클라이언트에게 재시도를 권고하는 내용이며, 내부 오류 정보가 노출되지 않아 보안상 적절하다.
- **제안**: 현 구현 유지. 다만 NestJS의 `ServiceUnavailableException`이 body를 그대로 내보내는지, 혹은 중간에 래핑되는지 확인 필요 (실제 응답이 중첩 구조가 되지 않도록).

---

### [INFO] HTTP 상태 코드 선택 — 503 vs 502 근거 명시

- **위치**: `codebase/backend/src/modules/executions/executions.service.ts` WAITING 분기 주석
- **상세**: 코드 주석에 "api-convention §6 — Redis 의존성 장애 = upstream 불가용이므로 502가 아닌 503"이 명기되어 있다. Redis는 서버 자체의 의존 인프라이므로 "Service Unavailable(503)"이 "Bad Gateway(502)"보다 HTTP 시맨틱에 부합한다. 선택 근거가 코드 주석에 적절히 서술되어 있다.
- **제안**: 현 구현 유지. spec-sync 시 api-convention §6에 이 케이스의 분류 예시를 추가하면 향후 유사 결정의 가이드가 된다.

---

### [INFO] 에러코드 `EXECUTION_ENQUEUE_FAILED` — ErrorCode enum 등재 완료, 카탈로그 spec 등재 미완

- **위치**: `codebase/backend/src/nodes/core/error-codes.ts` (신규 enum 항목)
- **상세**: `EXECUTION_ENQUEUE_FAILED`가 `ErrorCode` enum에 적절한 JSDoc과 함께 등재되었다. `EXECUTION_*` 네임스페이스 준수(spec §7.5.2 요구사항)가 충족되었다. 단, `spec/5-system/3-error-handling.md §1` 에러코드 카탈로그에는 아직 미등재 상태이며, 이는 commit 메시지와 일관성 검토 보고서에서 "sibling planner spec-sync defer"로 이미 인지되고 있다.
- **제안**: spec-sync PR에서 `spec/5-system/3-error-handling.md §1`에 이 에러코드를 등재해야 API 계약 단일 진실 원칙이 완성된다.

---

### [INFO] 하위 호환성 — `cancelWaitingExecution` 내부 서명 변경, 외부 REST API 표면 무변경

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (메서드 서명 변경)
- **상세**: `cancelWaitingExecution`의 반환 타입이 `void` → `Promise<ContinuationPublishResult>`로 변경되었다. 그러나 이 메서드는 내부 서비스 간 인터페이스이며, 외부 REST API 클라이언트에게 노출되는 `POST /executions/:id/stop`의 응답 스키마는 성공 시 기존과 동일(업데이트된 Execution 객체 반환)하다. 실패 시에만 신규 503 응답이 추가되었다. 이는 기존 클라이언트에게 새로운 에러 케이스가 추가된 것으로, 성공 경로는 하위 호환성을 유지한다.
- **제안**: 클라이언트에게 이 신규 503 케이스를 공지하는 것이 권장된다(spec-sync, API changelog 등).

---

## 요약

이번 변경(C-1+M-7)은 내부 continuation publish 로직의 fail-fast 통일이 핵심이며, 외부 API 계약 관점에서의 실질적 변경은 `POST /executions/:id/stop`이 WAITING 상태 실행에 대해 신규 503 응답(`EXECUTION_ENQUEUE_FAILED`)을 반환할 수 있게 된 점이다. 에러 응답 형식과 HTTP 상태 코드 선택은 프로젝트 규약(api-convention §6)에 적합하고, `EXECUTION_ENQUEUE_FAILED` 에러코드는 `ErrorCode` enum에 올바르게 등재되었다. 주요 미완 사항은 이 503 동작과 에러코드가 spec(`spec/5-system/3-execution.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`)에 아직 미기술 상태라는 점으로, commit 메시지에 명시된 sibling spec-sync PR와의 동행 머지가 API 계약 완성을 위해 필요하다. 기존 성공 경로의 하위 호환성은 유지되며, CRITICAL 수준의 breaking change는 없다.

## 위험도

LOW
