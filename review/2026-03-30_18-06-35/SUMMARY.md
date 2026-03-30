# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 테스트 커버리지 심각 부족, 인증 누락, N+1 쿼리, 비원자적 DB 쓰기 등 다수의 구조적 문제가 복합적으로 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 빌드 아티팩트 | `backend/.next/` Next.js 빌드 결과물이 git에 추적되고 있음. `"failed":true` 빌드 실패 흔적 포함. NestJS 백엔드에 Next.js 빌드가 존재하는 것 자체도 구조적으로 이상함 | `backend/.next/trace`, `backend/.next/trace-build` | `backend/.gitignore`에 `.next/` 추가 및 git 추적 제거 즉시 필요 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `saveCanvas` 서비스 메서드에 대한 테스트 전무. 트랜잭션 내 복잡한 upsert/delete 로직임에도 커버리지 없음 | `workflows.service.spec.ts` | `saveCanvas` 시나리오별 테스트 추가 (노드 생성/수정/삭제, 엣지 재생성, 버전 증가, NotFoundException) |
| 2 | 테스트 | `ManualTriggerHandler` 신규 파일에 단위 테스트 없음 | `handlers/trigger/manual-trigger.handler.ts` | `manual-trigger.handler.spec.ts` 생성 (pass-through 동작 및 validate 검증) |
| 3 | 테스트 | `POST /:id/execute`, `POST /:id/save` 컨트롤러 엔드포인트 테스트 없음 | `workflows.controller.ts` | 컨트롤러 spec에 정상 실행, 권한 없는 워크스페이스 접근 케이스 추가 |
| 4 | 테스트 | `WebsocketService` mock은 주입되었으나 `emitExecutionEvent`/`emitNodeEvent` 실제 호출 여부·인자·순서 검증 없음 | `execution-engine.service.spec.ts` | STARTED/COMPLETED/FAILED 이벤트 방출 assertion 추가 |
| 5 | 테스트 | `create()` 테스트가 `manual_trigger` 노드 자동 생성 부작용을 검증하지 않음 | `workflows.service.spec.ts` | `nodeRepository.save`가 `manual_trigger` 타입으로 호출되는지 assertion 추가 |
| 6 | 보안/인증 | `POST /:id/save` 엔드포인트에 `@CurrentUser()` 데코레이터 없음. 워크플로우 소유권 확인 없이 캔버스 수정 가능 | `workflows.controller.ts` — `saveCanvas()` | `@CurrentUser() user: JwtPayload` 추가 및 소유권 검증 로직 구현 |
| 7 | 데이터베이스 | `saveCanvas` 노드 upsert 루프에서 N+1 쿼리 발생. 노드 N개당 N번 INSERT/UPDATE 쿼리 실행 | `workflows.service.ts` — `saveCanvas()` node upsert 루프 | 엔티티 배열 구성 후 `manager.save(Node, nodesToSave)` 단일 호출로 교체 |
| 8 | 데이터베이스 | 엣지도 루프 내 개별 `manager.save(Edge, ...)` 호출로 N+1 발생 | `workflows.service.ts` — `saveCanvas()` edge 저장 루프 | `manager.save(Edge, newEdges)` 배열 단위 단일 호출로 교체 |
| 9 | 데이터베이스/안정성 | `create()`에서 워크플로우 저장과 트리거 노드 저장이 별도 트랜잭션. 노드 저장 실패 시 트리거 없는 고아 워크플로우 생성 가능 | `workflows.service.ts` — `create()` | `dataSource.transaction()`으로 두 작업을 원자적으로 묶음 |
| 10 | 요구사항 | Manual Trigger 삭제 방지(`ND-MT-04`)와 중복 방지(`ND-MT-05`)가 프론트엔드에만 구현됨. API 직접 호출로 우회 가능 | `workflows.service.ts` — `saveCanvas()` | 서버에서 `manual_trigger` 노드 존재 여부 및 1개 초과 여부 검증 추가 |
| 11 | 요구사항/기능 | `duplicate()`가 워크플로우 메타데이터만 복사하고 노드/엣지를 복제하지 않음 | `workflows.service.ts` — `duplicate()` | 원본 워크플로우의 노드/엣지를 함께 복제하는 로직 추가 |
| 12 | 동시성 | WebSocket `EXECUTION_COMPLETED` 이벤트가 `outputData` 저장 및 `executionRepository.save()` 완료 이전에 emit됨. 클라이언트가 결과 조회 시 불완전한 데이터 수신 가능 | `execution-engine.service.ts` — 실행 완료 처리 | 모든 DB 저장 완료 후 이벤트 emit하도록 순서 조정 |
| 13 | 동시성 | `handleRun`에서 `saveWorkflow()` 실패해도 에러를 감지할 수 없어 이전 버전으로 실행이 진행됨 | `editor-toolbar.tsx` — `handleRun()` | `saveWorkflow`가 성공/실패를 반환하도록 수정하고 실패 시 실행 중단 |
| 14 | API 계약 | `POST /:id/execute` 응답이 `{ data: { executionId } }` 이중 중첩. 프론트엔드에서 `.data.data.executionId`로 이중 언래핑 필요 | `workflows.controller.ts` — `execute()`, `frontend/src/lib/api/workflows.ts` | `return { executionId }` 또는 일관된 래퍼 구조로 통일 |
| 15 | 보안 | 실행 실패 시 `error.message`를 WebSocket 이벤트에 그대로 포함. DB 오류 메시지, 내부 경로 등 민감 정보 노출 가능 | `execution-engine.service.ts` — EXECUTION_FAILED, NODE_FAILED 이벤트 | 에러 메시지를 사용자 친화적 메시지로 정제, 상세 에러는 서버 로그에만 기록 |
| 16 | 아키텍처 | `WorkflowsController`가 `ExecutionEngineService`를 직접 주입받아 Workflow/Execution 도메인 경계 침범 | `workflows.controller.ts`, `workflows.module.ts` | 별도 `ExecutionsController` 분리 또는 `WorkflowsService.executeWorkflow()` 위임 메서드 추가 |
| 17 | 아키텍처/유지보수 | `ExecutionEngineService`에 WebSocket 이벤트 발행 로직이 직접 인라인으로 혼재 (SRP 위반). 이벤트 발행 방식 변경 시 엔진 핵심 로직 수정 필요 | `execution-engine.service.ts` — 전반 | NestJS `EventEmitter2` 기반 도메인 이벤트 패턴 도입, 별도 Listener가 WebSocket 발행 처리 |
| 18 | 유지보수 | `saveCanvas()` 메서드가 90줄 이상, 워크플로우 이름 업데이트·노드 동기화·엣지 동기화 세 책임 혼재 | `workflows.service.ts` — `saveCanvas()` | `syncNodes()`, `syncEdges()` private 메서드로 분리 |
| 19 | 데이터베이스 | `NodeCategory` enum에 `TRIGGER` 추가 시 PostgreSQL `ALTER TYPE` 마이그레이션은 트랜잭션 내 실행 불가. 마이그레이션 없이 배포 시 constraint violation 발생 | `node.entity.ts` — `NodeCategory` | 마이그레이션 파일 생성, `{ transaction: false }` 옵션 명시 확인 |
| 20 | 코드 품질 | `edgeRepository`가 `@InjectRepository(Edge)`로 주입되나 실제로 미사용 (모든 엣지 조작이 DataSource 트랜잭션 매니저를 통해 수행됨) | `workflows.service.ts` L15-17 | `edgeRepository` 주입 및 관련 테스트 mock 제거 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 검증 | `SaveCanvasNodeDto.id`가 `@IsString() @MaxLength(36)`만 검증. `containerId`, `toolOwnerId`는 `@IsUUID()` 사용과 대조됨 | `save-canvas.dto.ts` | `@IsUUID('4')` 데코레이터 추가 |
| 2 | 성능 | 스펙(0-canvas.md)에 2초 debounce 명시되어 있으나 `saveWorkflow` 호출부에 debounce 미구현 | `editor-store.ts` — `saveWorkflow()` | 호출부에 `debounce(saveWorkflow, 2000)` 적용 또는 store 내부에 타이머 내장 |
| 3 | UX/안정성 | `saveWorkflow()` 저장 실패 시 `console.error`만 출력하고 사용자에게 알림 없음. `isDirty`는 유지되나 사용자가 실패를 인지 불가 | `editor-store.ts` — `saveWorkflow()` catch 블록 | toast 알림 또는 store에 에러 상태 노출 |
| 4 | 동시성 | `saveCanvas` 내 `workflow.currentVersion` 증가가 애플리케이션 레벨에서 수행됨. 동시 요청 시 같은 버전 번호 저장 가능 | `workflows.service.ts` — `saveCanvas()` | `manager.increment(Workflow, { id }, 'currentVersion', 1)` DB 레벨 원자적 증가 적용 |
| 5 | 보안 | `config`(노드), `condition`(엣지) 필드가 `Record<string, unknown>`으로 임의 중첩 객체 허용. 향후 표현식 평가·코드 실행 노드 추가 시 인젝션 벡터 가능성 | `save-canvas.dto.ts` | 노드 타입별 config 스키마 검증 레이어 추가 또는 최소 중첩 깊이 제한 |
| 6 | API | `saveCanvas` 응답에 `@HttpCode()` 미명시 (기본 200). `execute`의 202, `create`의 201과 패턴 불일치 | `workflows.controller.ts` — `saveCanvas()` | `@HttpCode(HttpStatus.OK)` 명시적 선언 |
| 7 | 요구사항 | `exportWorkflow()`에 nodes/edges 미포함 상태로 주석만 존재. 이번 변경으로 Node/Edge repo가 주입되었으나 미완성 유지 | `workflows.service.ts` — `exportWorkflow()` | Node/Edge 포함하도록 구현하거나 `// TODO:` 추적 주석 명확화 |
| 8 | 아키텍처 | `editor-store.ts`가 `workflowsApi`를 직접 import. 테스트 격리 어려움 | `editor-store.ts` L4 | `useSaveWorkflow` 커스텀 훅으로 분리 고려 또는 현 구조 유지 시 의도 주석 명시 |
| 9 | 유지보수 | `"manual_trigger"` 문자열 리터럴이 프론트엔드 여러 파일에 하드코딩 | `workflow-canvas.tsx` onKeyDown, onDrop 콜백 | `node-definitions/index.ts`에 `MANUAL_TRIGGER_TYPE` 상수 정의 후 공유 |
| 10 | 유지보수 | `editor-store.ts`의 `saveWorkflow()` 내 `(n.data as Record<string, unknown>).xxx as string` 이중 캐스팅 5회 반복 | `editor-store.ts` — `saveWorkflow()` nodes.map() | `const d = n.data as CustomNodeData` 지역 변수로 추출 |
| 11 | 문서화 | `POST /:id/execute`, `POST /:id/save` Swagger 데코레이터(`@ApiOperation`, `@ApiResponse`) 없음 | `workflows.controller.ts` | Swagger 데코레이터 추가 |
| 12 | 문서화 | `void config; void context;` 패턴이 코드를 처음 보는 개발자에게 의도 불명확 | `manual-trigger.handler.ts` — `execute()` | `// Intentionally unused — passes input through as-is` 주석 추가 |
| 13 | API | `POST /:id/execute`가 `@HttpCode(202 Accepted)`이나 현재 구현은 동기적 실행 완료 후 반환 | `workflows.controller.ts` — `execute()` | 비동기 처리 계획이 없다면 `200 OK`로 변경, 비동기라면 실제로 비동기 처리 구현 |
| 14 | 유지보수 | Manual Trigger 초기 배치 좌표 `positionX: 250, positionY: 300` 하드코딩 | `workflows.service.ts` — `create()` | `MANUAL_TRIGGER_DEFAULT_POSITION` 상수로 추출 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | **HIGH** | saveCanvas·ManualTriggerHandler·execute 엔드포인트 테스트 전무, WebSocket 이벤트 assertion 부재 |
| database | **MEDIUM** | saveCanvas N+1 쿼리, create() 비원자적 트랜잭션, NodeCategory enum 마이그레이션 위험 |
| concurrency | **MEDIUM** | WebSocket emit/DB commit 순서 불일치, save 실패 시 execute 진행, saveCanvas 동시 요청 데드락 가능성 |
| security | **MEDIUM** | saveCanvas 인가 누락, 에러 메시지 WebSocket 노출, config 필드 무제한 중첩 |
| architecture | **MEDIUM** | Controller가 ExecutionEngineService 직접 의존, ExecutionEngine이 WebSocket에 직접 결합 |
| api_contract | **MEDIUM** | execute 응답 이중 중첩, saveCanvas 인증 누락, 엣지 전략 불일치 |
| requirement | **MEDIUM** | Manual Trigger 삭제/중복 방지가 서버 미구현, duplicate()에 노드/엣지 복제 없음 |
| performance | **MEDIUM** | saveCanvas N+1 쿼리, create() 비원자성, debounce 미구현 |
| maintainability | **MEDIUM** | WebSocket emit 패턴 반복, saveCanvas 메서드 과잉 책임, 타입 캐스팅 중복 |
| side_effect | **MEDIUM** | create() 비원자적 쓰기, saveCanvas 동시 편집 충돌, 저장 실패 silent fail |
| dependency | **LOW** | backend/.next/ git 추적, 모듈 간 결합도 증가 |
| scope | **LOW** | backend/.next/ git 추적, edgeRepository 미사용 주입 |
| documentation | **LOW** | 신규 엔드포인트 Swagger 미작성, void 패턴 주석 없음 |

---

## 발견 없는 에이전트
없음 (모든 에이전트가 1개 이상의 발견사항 보고)

---

## 권장 조치사항

1. **[즉시] `backend/.next/` git 추적 제거** — `.gitignore` 추가 및 `git rm -r --cached backend/.next/` 실행
2. **[즉시] `saveCanvas` 인증 추가** — `@CurrentUser()` 데코레이터 추가 및 워크플로우 소유권 검증 구현
3. **[고우선] 테스트 추가** — `saveCanvas` 서비스 테스트, `ManualTriggerHandler` 단위 테스트, 컨트롤러 엔드포인트 테스트, WebSocket 이벤트 emission assertion 작성
4. **[고우선] `create()` 트랜잭션 원자성 보장** — `dataSource.transaction()`으로 워크플로우·트리거 노드 생성을 하나의 트랜잭션으로 묶음
5. **[고우선] Manual Trigger 서버 측 유효성 검증** — `saveCanvas`에서 `manual_trigger` 노드 존재 여부 및 1개 초과 여부 검증 추가
6. **[중우선] N+1 쿼리 제거** — `saveCanvas`의 노드/엣지 저장을 배열 단위 `manager.save()` 단일 호출로 교체
7. **[중우선] WebSocket emit 순서 조정** — 모든 DB 저장 완료 후 이벤트 emit
8. **[중우선] `handleRun` 저장 실패 처리** — 저장 실패 시 실행 중단, 사용자 알림 추가
9. **[중우선] `NodeCategory` enum 마이그레이션** — TypeORM 마이그레이션 파일 생성 및 `{ transaction: false }` 옵션 확인
10. **[일반] execute 응답 구조 통일** — 이중 중첩 제거하여 다른 엔드포인트와 일관된 형식 적용
11. **[일반] `edgeRepository` 미사용 주입 제거** — 코드 및 테스트 mock 정리
12. **[일반] `duplicate()` 노드/엣지 복제 구현** — 원본 워크플로우의 전체 그래프 복사
13. **[일반] 에러 메시지 정제** — WebSocket으로 전송되는 에러 메시지를 사용자 친화적으로 변환, 상세 에러는 서버 로그 전용
14. **[일반] debounce 구현** — 스펙 요구사항인 2초 자동저장 debounce 적용
15. **[일반] `"manual_trigger"` 문자열 상수화** — 프론트/백엔드 공통 상수 정의