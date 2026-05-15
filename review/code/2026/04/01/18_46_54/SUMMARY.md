파일 쓰기 권한이 필요합니다. 아래는 통합 보고서 내용입니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Form 노드 대기/재개 구현에서 XSS, 인가 누락, 수평 확장 불가 등 복수의 CRITICAL 보안·아키텍처 이슈가 존재하며 즉각 조치 필요

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (XSS) | `dangerouslySetInnerHTML`에 서버 HTML을 sanitize 없이 렌더링. 외부 API 응답이 워크플로우를 통과하면 XSS 공격 가능 | `run-results-drawer.tsx` — `ChartContent`, `TemplateContent` | `DOMPurify.sanitize()` 적용 후 렌더링 |
| 2 | 보안 (인가) | `execution.submit_form` WS 핸들러에 `@ConnectedSocket()` 없어 실행 소유자 검증 불가. 인증된 임의 사용자가 타인의 실행에 폼 데이터 주입 가능 | `websocket.gateway.ts` — `handleSubmitForm()` | `@ConnectedSocket() client: Socket` 추가 후 `execution.executedBy === client.userId` 검증 |
| 3 | 보안 (입력 검증) | `formData`가 `unknown` 타입으로 크기 제한·스키마 검증 없이 DB 저장. 대형 페이로드 DoS 및 다운스트림 인젝션 위험 | `execution-engine.service.ts` — `continueExecution()` | Form 노드 config `fields` 스펙 기반 서버 측 검증 로직 추가 |
| 4 | 아키텍처 (순환 의존) | `ExecutionEngineService` ↔ `WebsocketGateway` 양방향 순환 의존을 `forwardRef`로 임시 해소. 레이어 경계 위반 | `execution-engine.service.ts:101`, `websocket.gateway.ts:43` | `EventEmitter2` 또는 도메인 이벤트 버스 도입으로 단방향 의존성 확보 |
| 5 | 아키텍처 (확장성) | `pendingContinuations`가 프로세스 로컬 in-memory Map. 서버 재시작 시 대기 중 실행 복구 불가, 다중 인스턴스 배포 시 continuation 라우팅 실패 | `execution-engine.service.ts:82-90` | 단기: 서버 시작 시 `WAITING_FOR_INPUT` 상태 실행을 `FAILED`로 처리. 장기: Redis Pub/Sub 또는 분산 이벤트 버스 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 에러 메시지 `No pending continuation for execution: {id}`가 클라이언트에 그대로 노출 — 내부 구현 정보 유출 | `execution-engine.service.ts`, `websocket.gateway.ts` catch 블록 | 제네릭 메시지로 래핑 |
| 2 | 보안 | `CarouselContent`의 `item.image`가 검증 없이 `<img src>`에 바인딩 | `run-results-drawer.tsx` — `CarouselContent` | `/^https?:\/\//` 정규식 검증 후 렌더링 |
| 3 | 보안 | WebSocket CORS `origin: '*'`으로 모든 출처 허용 | `websocket.gateway.ts` — `@WebSocketGateway` | 환경변수 `ALLOWED_ORIGINS`로 허용 origin 명시 |
| 4 | 성능 | `waiting_for_input` 상태에서도 폴링 2초 간격 유지 — 불필요한 서버 부하 | `use-execution-events.ts` — `pollExecutionStatus()` | 해당 상태 시 폴링 간격 증가 또는 WS 재개 신호 전까지 중단 |
| 5 | 성능 | `waitForFormSubmission`에 타임아웃 없어 폼 미제출 시 Promise 무기한 대기, 메모리 누수 | `execution-engine.service.ts` — `waitForFormSubmission()` | `Promise.race`로 30분 타임아웃 후 `ExecutionCancelledError` throw |
| 6 | 성능 | `executeNode` 내 `executionPath` 업데이트 시 노드마다 `findOneBy` + `save` 반복 — N+1 패턴 | `execution-engine.service.ts` — `executeNode()` | `executionPath` 메모리 누적 후 완료 시점 일괄 저장 |
| 7 | 성능 | `waitForFormSubmission`에서 방금 생성된 `NodeExecution`을 불필요하게 `findOne`으로 재조회 | `execution-engine.service.ts` — `waitForFormSubmission()` | 엔티티를 인자로 직접 전달 |
| 8 | 데이터베이스 | `waitForFormSubmission`의 4단계 상태 전환 DB write가 트랜잭션 없이 수행. 중간 장애 시 상태 불일치 | `execution-engine.service.ts` — `waitForFormSubmission()` | `QueryRunner`로 상태 전환 원자화 |
| 9 | 기능 완전성 | Form 노드 실행 후 `NODE_COMPLETED` 이벤트 emit 직후 `WAITING_FOR_INPUT` 재전환 — 이중 상태 이벤트 발생 | `execution-engine.service.ts` — `executeNode()` + `waitForFormSubmission()` | Form 타입 노드는 `executeNode()` 내 `NODE_COMPLETED` emit 생략, `waitForFormSubmission` 완료 후 emit |
| 10 | 기능 완전성 | `cancelWaitingExecution()`이 구현되어 있으나 어떤 엔드포인트에서도 호출되지 않음 — 사용자가 Form 대기 중 취소 불가 | `execution-engine.service.ts:432-438` | WS `execution.cancel_form` 핸들러 또는 REST 엔드포인트에서 호출 |
| 11 | 기능 완전성 | `waiting_for_input` 폴링 중 `formConfig` 미발견 시에도 `return false`로 폴링 무한 지속 | `use-execution-events.ts:230-250` | 폴링 최대 횟수 제한 또는 `pauseForForm(nodeId, null)` 호출 |
| 12 | API 계약 | `formConfig`가 `nodeOutput.formConfig`로 암묵적 위치. WS 경로와 폴링 경로가 서로 다른 접근 경로 사용 | `execution-engine.service.ts:396`, `use-execution-events.ts:93, 220-235` | `formConfig`를 페이로드 최상위 필드로 명시, 추출 로직을 단일 헬퍼 함수로 통합 |
| 13 | API 계약 | `execution.form_submitted` 응답 이벤트를 클라이언트가 수신하는 코드 없어 성공/실패 피드백 미반영 | `run-results-drawer.tsx`, `use-execution-events.ts` | 이벤트 리스너 등록 또는 Socket.IO ACK 패턴으로 변경 |
| 14 | 상태 일관성 | 폼 제출 시 서버 응답 확인 없이 즉시 `resumeFromForm()`으로 `running` 전환 — 오류 시 UI 불일치 | `run-results-drawer.tsx` — `handleFormSubmit()`, `execution-store.ts` | `execution.form_submitted`의 `success: true` 확인 후 `resumeFromForm()` 호출 |
| 15 | 아키텍처 (SRP) | `waitForFormSubmission`이 상태 전환·DB·WS emit·Promise 대기·출력 병합 등 7가지 이상 책임 | `execution-engine.service.ts` — `waitForFormSubmission()` | `transitionToWaiting()`, `mergeFormOutput()`, `transitionToResumed()`로 분리 |
| 16 | 아키텍처 | `runExecution` catch 블록에서 취소/실패 처리 코드 중복 | `execution-engine.service.ts:305-341` | `finalizeExecution(execution, status, error?)` 헬퍼 메서드로 추출 |
| 17 | 테스트 누락 | `handleSubmitForm` WS 핸들러 테스트 전무 — 성공/예외 두 분기 모두 미검증 | `websocket.gateway.spec.ts` | `continueExecution` 정상/예외 케이스 테스트 추가 |
| 18 | 테스트 누락 | 실시간 WS `execution.waiting_for_input` 이벤트 핸들러(`handleWaitingForInput`) 테스트 없음 | `use-execution-events.test.ts` | WS 핸들러 직접 호출, `waitingNodeId`·`waitingFormConfig` 상태 반영 검증 |
| 19 | 테스트 누락 | `handleNodeCompleted`의 `PRESENTATION_TYPES` 분기 결과 수집 로직 미검증 | `use-execution-events.test.ts` | presentation/non-presentation 타입별 `addNodeResult` 호출 여부 테스트 추가 |
| 20 | 테스트 누락 | `run-results-drawer.tsx` 테스트 파일 전무 — `DynamicFormUI`, `handleFormSubmit`, WS emit 핵심 동작 미검증 | `frontend/src/components/editor/run-results/` | `DynamicFormUI` 단위 테스트 및 폼 제출 통합 테스트 추가 |
| 21 | 동시성 | 컴포넌트 언마운트 시 서버 측 `pendingContinuations` 대기 Promise 미취소 — 서버에 좀비 실행 잔류 | `use-execution-events.ts` — `useEffect` cleanup | cleanup 시 `waiting_for_input` 상태라면 WS `execution.cancel` 또는 REST 취소 요청 전송 |
| 22 | 의존성 | Gateway 레이어가 `ExecutionEngineService` 비즈니스 메서드 직접 호출 — 레이어 역전 및 삼각 의존 | `websocket.gateway.ts:14, 43` | Gateway → `ExecutionCommandService` 경유 또는 이벤트 emit 방식으로 계층 분리 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `PdfContent`의 `data.url`이 검증 없이 `<a href>`에 사용 — `javascript:` 프로토콜 주입 가능 | `run-results-drawer.tsx` — `PdfContent` | `http(s)://` URL만 허용 검증 |
| 2 | 아키텍처 | `ExecutionCancelledError`가 파일 내부에만 정의되어 외부에서 `instanceof` 검사 불가 | `execution-engine.service.ts:66-71` | `execution-errors.ts`로 분리 export |
| 3 | 타입 안전성 | `waitingFormConfig: unknown`이 실제 shape `{ fields: FormField[], title?: string, ... }`와 괴리 | `execution-store.ts:40` | `FormConfig` 인터페이스를 공유 타입으로 추출 |
| 4 | 데이터베이스 | `(executionId, nodeId)` 복합 인덱스 부재 시 `findOne`에서 전체 스캔 가능 | `NodeExecution` 엔티티 | 복합 인덱스 추가 검토 |
| 5 | 유지보수성 | `PRESENTATION_TYPES`와 백엔드 핸들러 등록 목록 동기화 책임 미문서화 | `use-execution-events.ts:21-28` | `// Must stay in sync with presentation handlers` 주석 추가 |
| 6 | 유지보수성 | 폴링·WS 핸들러 양쪽에 프레젠테이션 노드 결과 수집 로직 중복 | `use-execution-events.ts:123-158, 210-228` | `tryAddPresentationResult(nodeId, outputData)` 헬퍼 함수로 추출 |
| 7 | 유지보수성 | `continueExecution` / `cancelWaitingExecution` 접두사 비대칭 | `execution-engine.service.ts` | `continueExecution` → `resumeExecution`으로 rename |
| 8 | 유지보수성 | 하드코딩된 색상값 `text-[#EC4899]` | `run-results-drawer.tsx` — `HistoryEntry` | Tailwind 커스텀 컬러 토큰으로 추출 |
| 9 | 동시성 | WS emit → `pendingContinuations.set` 순서 의존성 암묵적 | `execution-engine.service.ts` — `waitForFormSubmission()` | `set`을 emit 이전에 실행하도록 순서 변경 |
| 10 | 동시성 | `waiting_for_input` 폴링 중 `pauseForForm`이 2초마다 반복 호출 — 불필요한 리렌더링 | `use-execution-events.ts` | `waitingNodeId` 동일 시 early-return 처리 |
| 11 | API 계약 | `EXECUTION_STARTED` 이벤트를 실행 재개 시 재사용 — 의미론적 부정확 | `execution-engine.service.ts:420-424` | `EXECUTION_RESUMED` 전용 이벤트 타입 도입 또는 주석 보강 |
| 12 | 문서화 | `FormField` 인터페이스의 허용 `type` 값 목록 미기재 | `run-results-drawer.tsx` — `FormField` | JSDoc으로 허용 `type` 값 명시 |
| 13 | 테스트 | `waitForFormSubmission`에서 `findOne`이 `null` 반환하는 케이스 미검증 | `execution-engine.service.spec.ts` | `mockResolvedValue(null)` 케이스 추가 |
| 14 | 테스트 | 동일 `executionId`로 `continueExecution` 이중 호출 경계값 케이스 미검증 | `execution-engine.service.spec.ts` | 이중 호출 테스트 추가 |
| 15 | 범위 초과 | `run-results-drawer.tsx`에서 탭→히스토리 전면 재설계 및 5개 렌더러 추가 — Form 기능 범위 초과 | `run-results-drawer.tsx` | Form 기능과 UI 리팩토링을 별도 커밋/PR로 분리 권장 |
| 16 | 범위 초과 | 삭제된 `// Note: "cancelled" maps to "failed"...` 주석 — 비직관적 동작 설명 손실 | `use-execution-events.ts` | 주석 복원 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | HIGH | XSS(dangerouslySetInnerHTML), 인가 누락(submit_form), formData 입력 검증 부재 |
| architecture | HIGH | 순환 의존(forwardRef), in-memory Map 확장성, SRP 위반, XSS |
| concurrency | HIGH | 다중 인스턴스 continuation 라우팅 실패, 폼 제출 타임아웃 없음, 낙관적 상태 전환 |
| database | MEDIUM | 비원자적 상태 전환, N+1 쿼리, 서버 재시작 시 대기 실행 복구 불가 |
| performance | MEDIUM | waiting_for_input 중 무한 폴링, pendingContinuations 메모리 누수, N+1 DB 조회 |
| requirement | MEDIUM | 이중 상태 이벤트, cancelWaitingExecution 미노출, 인가 검증 누락 |
| testing | MEDIUM | handleSubmitForm 테스트 전무, WS waiting 핸들러 미검증, UI 컴포넌트 테스트 부재 |
| api_contract | MEDIUM | 인가 누락, formConfig 경로 불일치, form_submitted 미수신 |
| side_effect | MEDIUM | 낙관적 상태 전환, WAITING_FOR_INPUT→RUNNING 상태 머신 미확인, XSS |
| maintainability | MEDIUM | waitForFormSubmission 과도한 책임, 인가 검증 누락, 결과 수집 로직 중복 |
| dependency | LOW | 삼각 의존 구조, 컴포넌트-전송 레이어 결합 |
| documentation | LOW | dangerouslySetInnerHTML 안전성 주석 누락, FormField 타입 미문서화 |
| scope | LOW | run-results-drawer UI 전면 재설계가 Form 기능 범위 초과 |

---

## 발견 없는 에이전트
없음 (전 에이전트 발견사항 존재)

---

## 권장 조치사항

### 즉시 (CRITICAL)
1. **XSS 수정**: `ChartContent`, `TemplateContent`에 `DOMPurify.sanitize()` 적용
2. **인가 검증 추가**: `handleSubmitForm`에 `@ConnectedSocket()` 추가 및 execution 소유자 검증
3. **formData 서버 검증**: Form 노드 config `fields` 스펙 기반 입력 크기·구조 검증
4. **서버 재시작 복구**: 시작 시 `WAITING_FOR_INPUT` 상태 실행을 `FAILED`로 일괄 처리

### 단기 (WARNING — 필수)
5. **폼 제출 타임아웃**: `Promise.race`로 30분 타임아웃 + 자동 취소
6. **낙관적 상태 전환 제거**: `execution.form_submitted` 성공 응답 수신 후 `resumeFromForm()` 호출
7. **테스트 보완**: `handleSubmitForm`, WS `waiting_for_input` 핸들러, 프레젠테이션 분기, `run-results-drawer` 컴포넌트 테스트
8. **이중 상태 이벤트 해결**: Form 노드 `NODE_COMPLETED` emit 순서 정리
9. **취소 경로 노출**: `cancelWaitingExecution()` 호출 가능한 WS 핸들러 또는 REST 엔드포인트
10. **비원자적 DB 연산 수정**: `waitForFormSubmission` 상태 전환을 트랜잭션으로 묶기
11. **에러 메시지 제네릭화**: 내부 구현 정보 클라이언트 노출 차단
12. **URL 검증**: `CarouselContent`, `PdfContent`에 프로토콜 검증 추가

### 중기 (아키텍처 개선)
13. **이벤트 버스 도입**: `EventEmitter2`로 순환 의존 제거
14. **책임 분리**: `waitForFormSubmission` 로직을 `FormContinuationService`로 분리
15. **cleanup 연동**: 컴포넌트 언마운트 시 서버 측 대기 Promise 취소 요청
16. **단일 인스턴스 제약 명시**: 현재 구조가 단일 인스턴스 전용임을 주석·문서에 명시