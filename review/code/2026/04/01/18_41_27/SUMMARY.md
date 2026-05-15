파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 `review/2026-04-01_18-41-27/SUMMARY.md`에 통합 보고서를 저장하겠습니다.

아래는 13개 에이전트 리뷰를 통합한 최종 보고서입니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Form 노드 blocking 기능 구현에서 XSS, 인가 부재, 아키텍처 순환 의존성, 실행 취소 시 메모리 누수 등 고위험 이슈 다수 발견

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (XSS) | `dangerouslySetInnerHTML`에 서버 응답 HTML을 무방비로 삽입. 악의적 워크플로우 실행 시 XSS 가능 | `run-results-drawer.tsx` — `ChartContent`, `TemplateContent` | `DOMPurify.sanitize(data.rendered)` 적용 필수 |
| 2 | 아키텍처 | `ExecutionEngineModule ↔ WebsocketModule` 양방향 순환 의존성을 `forwardRef`로 임시 해결. 레이어 경계 위반이며 부트스트랩 초기화 순서 버그의 잠재적 원인 | `execution-engine.module.ts`, `websocket.module.ts` | `EventEmitter2` 기반 이벤트 버스 패턴으로 분리 |
| 3 | 아키텍처 | `ExecutionsController`가 `ExecutionsService`를 우회하여 `ExecutionEngineService`를 직접 호출. 레이어 책임 원칙 위반 | `executions.controller.ts:19`, `executions.module.ts` | `ExecutionsService.continueExecution()` 위임 메서드 추가 후 컨트롤러는 `ExecutionsService`만 참조 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / 인가 | REST 엔드포인트와 WebSocket 핸들러 모두 실행 소유자 검증 없음 (IDOR) | `executions.controller.ts:39-47`, `websocket.gateway.ts:156-178` | JWT Guard + `execution.userId === req.user.sub` 소유권 검증 추가 |
| 2 | 기능 버그 | `stop()`이 DB를 `CANCELLED`로 변경하지만 `pendingContinuations` Promise를 reject하지 않음 → 실행 루프 영구 블로킹 (메모리 누수) | `executions.service.ts:80-98` | `stop()` 내에서 `cancelWaitingExecution(id)` 함께 호출 |
| 3 | 보안 / DoS | `pendingContinuations` Map에 TTL 없음. 미제출 시 영구 잔류, 다수 생성 시 메모리 고갈 가능 | `execution-engine.service.ts` | TTL(30분) 설정 후 자동 만료 및 Map 상한선 설정 |
| 4 | 보안 | WebSocket 응답에 내부 에러 메시지 노출 (`No pending continuation for execution: ${id}`) | `websocket.gateway.ts` — catch 블록 | 클라이언트엔 일반 메시지만, 상세 내용은 서버 로그에만 기록 |
| 5 | 보안 | JWT secret fallback 하드코딩(`'fallback'`). 환경변수 미설정 시 토큰 위조 가능 | `websocket.module.ts` | `configService.getOrThrow<string>('jwt.secret')` 사용 |
| 6 | 보안 | WebSocket CORS `origin: '*'`과 `credentials: true` 조합. 허용 도메인 미명시 | `websocket.gateway.ts` | `origin`을 `process.env.ALLOWED_ORIGINS`로 환경변수화 |
| 7 | API / 검증 | `formData`에 DTO 및 `ValidationPipe` 미적용. 크기 제한 없음 | `executions.controller.ts:48`, `websocket.gateway.ts` | `ContinueExecutionDto` 클래스 생성 및 `class-validator` 적용 |
| 8 | API / 오류 | 비즈니스 예외("No pending continuation")가 500으로 노출 | `executions.controller.ts:45-52` | `try/catch`로 감싸고 `NotFoundException` throw |
| 9 | 데이터베이스 | 재개 시 `node_execution` + `execution` 상태 전환이 트랜잭션 없이 수행됨. 서버 장애 시 두 테이블 간 상태 불일치 가능 | `execution-engine.service.ts` — `waitForFormSubmission()` | 재개 로직을 `dataSource.transaction()`으로 묶어 원자성 보장 |
| 10 | 데이터베이스 | 서버 재시작 시 `WAITING_FOR_INPUT` 레코드가 DB에 잔류하지만 Promise resolver 소실 → 영구 고착 | `execution-engine.service.ts` | `OnModuleInit`에서 해당 상태를 `CANCELLED`로 전환하는 복구 로직 추가 |
| 11 | 데이터베이스 | `(execution_id, node_id)` 복합 인덱스 없음. `findOne` 쿼리에서 테이블 전체 스캔 가능 | `execution-engine.service.ts:357` | `@Index(['executionId', 'nodeId'])` 추가 |
| 12 | 기능 / 상태 | Form 재개 시 `EXECUTION_STARTED` 이벤트 재사용 → 프론트엔드 히스토리와 상태 리셋 위험 | `execution-engine.service.ts` — 재개 이벤트 발행 | `execution.resumed` 이벤트 별도 추가 또는 동일 executionId 수신 시 리셋 방지 분기 처리 |
| 13 | 테스트 누락 | `POST :id/continue` 컨트롤러, `stop()` WAITING_FOR_INPUT 처리, `handleSubmitForm` WS 핸들러 테스트 누락 | `executions.controller.ts`, `executions.service.ts`, `websocket.gateway.spec.ts` | 각 케이스별 spec 파일에 성공/실패/엣지케이스 테스트 추가 |
| 14 | 테스트 누락 | `DynamicFormUI` 컴포넌트 단위 테스트 없음 | `run-results-drawer.tsx` — `DynamicFormUI` | `run-results-drawer.test.tsx` 생성하여 field type별 렌더링 및 submit 동작 테스트 |
| 15 | 성능 | `waiting_for_input` 상태에서도 2초 간격 폴링 지속 (10분 대기 시 ~300회 불필요한 API 호출) | `use-execution-events.ts` — `pollExecutionStatus` | `waiting_for_input` 감지 후 폴링 backoff 또는 일시 중단 |
| 16 | 동시성 | `stop()` ↔ `cancelWaitingExecution()` 동시 호출 시 DB 중복 저장 가능 | `executions.service.ts`, `execution-engine.service.ts` | `stop()`에서 `cancelWaitingExecution()` 통합 호출 |
| 17 | 동시성 | 컴포넌트 언마운트 후에도 `pauseForForm` 호출될 수 있음 (`cancelledRef` 체크 누락) | `use-execution-events.ts` — `pollExecutionStatus()` | `waiting_for_input` 처리 블록 앞에 `if (cancelledRef.current) return true;` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `waitForFormSubmission`이 상태 전환·DB·WS 이벤트·Promise 대기·출력 병합을 ~60줄에서 처리 (SRP 위반) | `execution-engine.service.ts` | private helper 메서드로 분리 |
| 2 | 유지보수성 | `run-results-drawer.tsx` 단일 파일에 13개 컴포넌트/함수 (~550줄+) | `run-results-drawer.tsx` | `presentation-renderers/` 디렉토리로 분리 |
| 3 | 유지보수성 | `renderField`가 React 컴포넌트 규칙 미준수 (소문자, Hook 사용 불가) | `run-results-drawer.tsx` | `FormField` 컴포넌트로 승격 |
| 4 | 유지보수성 | 폴링과 WS 두 경로에서 `pauseForForm` 중복 호출 가능성 | `use-execution-events.ts` | 동일 `waitingNodeId`이면 스킵하는 idempotency 가드 추가 |
| 5 | 유지보수성 | `__execution__` 매직 스트링 여러 파일에 하드코딩 | `execution-store.ts`, 테스트 코드 | `EXECUTION_ERROR_KEY` 상수로 추출 |
| 6 | 유지보수성 | `handleWaitingForInput`에서 `waitingNodeType !== "form"` 케이스 조용히 무시 | `use-execution-events.ts:94-102` | `else` 분기에 `console.warn` 추가 |
| 7 | 성능 | `waitForFormSubmission`에서 이미 메모리에 있는 `NodeExecution`을 DB에서 재조회 | `execution-engine.service.ts` | 상위 로직에서 반환된 인스턴스를 파라미터로 전달 |
| 8 | 성능 | `addNodeResult`에서 `Array.some()` + `Array.map()` O(n) 탐색 두 번 | `execution-store.ts` | `Map<string, NodeResult>`으로 관리하여 O(1) 처리 |
| 9 | 성능 | Zustand store 액션들이 `useEffect` deps 배열에 포함 | `use-execution-events.ts` | `useExecutionStore.getState().action()` 패턴으로 deps에서 제거 |
| 10 | 타입 | `waitingFormConfig: unknown` 타입으로 소비 측에서 매번 타입 단언 필요 | `execution-store.ts:40` | `FormConfig` 인터페이스를 공유 타입으로 정의 |
| 11 | 문서 | `POST /api/executions/:id/continue`가 스펙 §9 API 표에 누락 | `spec/3-workflow-editor/3-execution.md` §9 | §9 API 표에 행 추가 |
| 12 | 문서 | `ExecutionCancelledError`, `waitForFormSubmission`, `continueExecution`에 `@throws` JSDoc 누락 | `execution-engine.service.ts` | `@throws` 태그 추가 |
| 13 | 문서 | `PRESENTATION_TYPES` 상수에 목적 주석 없음 | `use-execution-events.ts:22` | 백엔드와의 동기화 필요성 명시 주석 추가 |
| 14 | 요구사항 | 상태 바에 스펙 §3.4에 명시된 Form 노드 라벨 미포함 (`"Waiting for input..."` 문자열만 표시) | `run-results-drawer.tsx` | `waitingFormConfig.title`에서 노드 라벨 가져와 표시 |
| 15 | 요구사항 | `DynamicFormUI`에서 `checkbox` 타입에 `required` 검증 미적용 | `run-results-drawer.tsx` — `renderField` checkbox | JS 레벨 required 검증 추가 |
| 16 | 테스트 | `flushPromises` 단일 호출로 다단계 비동기 체인이 완전히 해소되지 않을 수 있음 | `execution-engine.service.spec.ts:417, 437` | `flushPromises` 다중 호출 또는 `jest.runAllTimersAsync()` 패턴 사용 |
| 17 | 데이터베이스 | TypeORM `findOne`에서 `order` 옵션 미공식 지원 (타입 오류 가능) | `execution-engine.service.ts:357` | `find({ where, order, take: 1 })` 패턴으로 변경 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | **HIGH** | XSS (dangerouslySetInnerHTML), 인가 부재 (IDOR), JWT fallback secret, CORS 와일드카드 |
| architecture | **HIGH** | ExecutionEngineModule ↔ WebsocketModule 순환 의존성, Controller 레이어 위반 |
| side_effect | **HIGH** | 인가 부재, stop() 시 메모리 누수, XSS |
| api_contract | **MEDIUM** | 인가 부재, 500 오류 노출, stop() ↔ cancelWaiting 연동 누락, DTO 미적용 |
| concurrency | **MEDIUM** | stop/cancelWaiting 원자성 부재, pauseForForm 중복 호출, unmount 후 상태 업데이트 |
| database | **MEDIUM** | 트랜잭션 미적용, 서버 재시작 시 고착 실행 복구 없음, 인덱스 누락 |
| maintainability | **MEDIUM** | 순환 의존성, 파일 크기 초과, waitForFormSubmission SRP 위반 |
| performance | **MEDIUM** | waiting_for_input 중 폴링 지속, 불필요한 DB 재조회 |
| testing | **MEDIUM** | controller/gateway/service 신규 엔드포인트 테스트 누락, DynamicFormUI 테스트 없음 |
| requirement | **MEDIUM** | execution.started 이벤트 재사용 상태 리셋 위험, stop() 연동 누락 |
| dependency | **LOW** | forwardRef 순환, 단일 인스턴스 제약 미문서화 |
| documentation | **LOW** | REST 엔드포인트 스펙 누락, @throws JSDoc 부재 |
| scope | **LOW** | REST + WebSocket 채널 중복, addNodeResult 동작 변경 |

---

## 발견 없는 에이전트
없음 (전 에이전트에서 발견사항 존재)

---

## 권장 조치사항

1. **[즉시]** XSS 취약점 제거 — `DOMPurify.sanitize()` 적용
2. **[즉시]** 인가 검증 추가 — REST 및 WebSocket 폼 제출 핸들러에 소유자 검증
3. **[즉시]** `stop()` 연동 수정 — `WAITING_FOR_INPUT` 상태 시 `cancelWaitingExecution()` 함께 호출
4. **[즉시]** 서버 재시작 복구 로직 — `OnModuleInit`에서 고착 실행 `CANCELLED` 전환
5. **[즉시]** JWT fallback secret 제거 — `configService.getOrThrow()` 사용
6. **[단기]** 아키텍처 순환 의존성 해소 — EventEmitter 기반 분리, Controller 레이어 위반 수정
7. **[단기]** 오류 처리 개선 — `NotFoundException` 변환, 내부 메시지 노출 제거
8. **[단기]** 누락 테스트 추가 — controller, gateway, service, DynamicFormUI
9. **[단기]** DB 개선 — 복합 인덱스 추가, 재개 시 트랜잭션 적용
10. **[단기]** 폼 재개 이벤트 분리 — `execution.resumed` 이벤트 신설
11. **[중기]** `pendingContinuations` TTL 추가 — 자동 만료 및 상한선 설정
12. **[중기]** CORS 환경변수화 — 허용 도메인 명시
13. **[중기]** 폴링 최적화 — `waiting_for_input` 상태 시 backoff 적용
14. **[낮은 우선순위]** 스펙 문서 보완 및 `FormConfig` 공유 타입 정의