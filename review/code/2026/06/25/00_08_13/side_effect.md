# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] InteractionService 생성자 시그니처 변경 — 새 의존성 주입 파라미터 추가
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` L62-64
- 상세: `InteractionService` 생성자에 `@InjectRepository(NodeExecution) private readonly nodeExecutionRepository: Repository<NodeExecution>` 가 두 번째 파라미터로 추가됨. NestJS DI 컨테이너를 통해 주입되므로 기존 런타임 호출자(controller, other services)에는 영향 없음. 단 테스트 코드처럼 `new InteractionService(...)` 를 직접 생성하는 코드는 파라미터 순서·개수 갱신 필요 — 이번 변경의 `interaction.service.spec.ts` 에서 이미 `nodeRepo as never` 를 두 번째 인자로 추가해 반영 완료.
- 제안: 문제 없음. 다른 테스트 파일이 동일 생성자를 직접 호출하는지 확인(e2e spec 포함) 권장.

### [INFO] ExternalInteractionModule — TypeORM forFeature 에 NodeExecution 엔티티 추가
- 위치: `codebase/backend/src/modules/external-interaction/external-interaction.module.ts` L65-71
- 상세: `TypeOrmModule.forFeature([..., NodeExecution])` 추가. NodeExecution 이 이미 `node-executions` 모듈에서 `forFeature` 등록돼 있다면 동일 DataSource 내 중복 등록이나, TypeORM/NestJS 는 같은 커넥션 내 복수 모듈 중복 등록을 허용하므로 런타임 충돌 없음. 외부 모듈 scope 추가는 DB 스키마 변경·마이그레이션을 유발하지 않음.
- 제안: 문제 없음.

### [WARNING] getStatus 의 새 DB 조회 — 호출 빈도에 따른 N 쿼리 부작용
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` L1160-1167
- 상세: `getStatus` 가 `execution.status === WAITING_FOR_INPUT` 일 때 `nodeExecutionRepository.findOne({ where: { executionId, status: WAITING_FOR_INPUT }, order: { startedAt: 'DESC' }, relations: ['node'] })` 를 추가 실행. 이전에는 단일 `executionRepository.findOne` 만 실행했으나 이제 조건부 두 번째 쿼리가 추가됨. 위젯이 start/restore 직후 `getStatus` 를 즉시 호출하는 패턴(신규 `seedWaitingFromStatus`)으로 인해 대화 시작 시 DB 조회 횟수가 증가. 단일 엔드포인트 호출당 최대 2 쿼리로 제한적이나, 많은 동시 세션에서 미리보기 open 시 연관 JOIN 쿼리가 집중될 수 있음.
- 제안: `(executionId, status)` 복합 인덱스가 NodeExecution 테이블에 존재하는지 확인 권장. 없으면 풀스캔 위험 있음.

### [INFO] seedWaitingFromStatus — 실패 시 console.warn 로 soft 처리, 상태 오염 없음
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L1838-1864
- 상세: `getStatus` 호출 실패(네트워크 오류, 4xx/5xx)를 `catch` 해 `console.warn` 후 진행(soft). `dispatch` 는 성공 시에만 호출되므로, 실패해도 위젯 상태(`widgetReducer`)는 변경되지 않음. 의도치 않은 상태 변경 없음. `useCallback` 의존성 배열이 빈 배열 `[]` 이므로 클로저가 최초 렌더 시점 값을 캡처 — `client` / `session` 은 파라미터로 전달받아 문제 없음.
- 제안: 문제 없음.

### [INFO] openStream 에 lastEventId="0" 하드코딩 — start·restore 양쪽 적용
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L2878, L2897
- 상세: start 경로와 restore 경로 모두 `openStream(session, "0")` 으로 고정. 이전에는 `openStream(session)` (lastEventId 없음 또는 undefined). 위젯이 SSE 연결 시 `lastEventId=0` 쿼리 파라미터를 항상 포함하게 됨. SSE 어댑터가 seq≥1 이벤트를 replay 하므로 replay 부피가 최대화될 수 있으나, Redis buffer 용량 정책(5분 TTL) 이 상한을 결정. 기존에 `lastEventId` 없이 연결하던 세션(restore 포함)도 이제 buffer replay 를 시도 — restore 시 이미 수신했던 이벤트가 재전달될 수 있음. 위젯 reducer 가 중복 이벤트를 멱등 처리하는지 확인 필요.
- 제안: 위젯 `handleEiaEvent` 가 이미 수신한 seq 의 이벤트를 중복 처리하지 않도록 seq dedup 로직 존재 여부를 확인 권장.

### [INFO] seedWaitingFromStatus 가 start 경로에서 `await` 로 호출 — startWorkflow 내 async 순서 변경
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L2877
- 상세: 기존 `openStream(session)` 단일 동기 호출이었던 자리에 `await seedWaitingFromStatus(client, session)` 가 선행 삽입됨. `getStatus` 호출이 완료될 때까지 `openStream` 이 지연. `seedWaitingFromStatus` 는 실패를 soft 처리하므로 `openStream` 이 차단되지는 않지만, 네트워크 지연 시 SSE 연결 시작이 늦어짐. 단 이 지연은 ms 단위이고 replay 메커니즘이 누락 이벤트를 보정하므로 실용 영향 미미.
- 제안: 문제 없음. 의도된 순서 변경(시드 후 스트림 오픈).

### [INFO] 환경 변수 참조 — 기존 WEB_CHAT_WIDGET_ORIGINS 사용, 신규 도입 없음
- 위치: `k8s/README.md`, `spec/7-channel-web-chat/4-security.md`
- 상세: 신규 환경 변수 도입 없음. 기존 `WEB_CHAT_WIDGET_ORIGINS` 의 분리 배포 시 필수 설정 요건을 문서에 명시한 것. 코드 레벨 환경 변수 읽기/쓰기 변경 없음.
- 제안: 문제 없음.

### [INFO] 테스트 전용 변경 — spec 파일의 ExecRepoMocks 인터페이스 재사용
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`
- 상세: `ExecRepoMocks` 인터페이스(`{ findOne: Mock }`)를 `nodeRepo` 에도 재사용. 실제 `NodeExecution` repo 의 API 는 `findOne` 외 추가 메서드가 있으나, 이번 테스트에서 사용하는 경로는 `findOne` 만이므로 `as never` 캐스팅으로 충분. 프로덕션 코드에 영향 없음.
- 제안: 문제 없음.

---

## 요약

이번 변경의 핵심 부작용 위험은 **`getStatus` 엔드포인트의 추가 DB 쿼리**이다. `waiting_for_input` 상태에서 `NodeExecution` JOIN 쿼리가 추가 실행되며, 대화 시작 직후 위젯이 `seedWaitingFromStatus` 로 `getStatus` 를 자동 호출하는 패턴이 결합되어 동시 세션 환경에서 DB 부하가 증가할 수 있다. `(executionId, status)` 복합 인덱스가 없다면 쿼리가 풀스캔으로 실행된다. 그 외 `InteractionService` 생성자 파라미터 추가는 NestJS DI 로 주입되므로 런타임 호출자에 영향이 없고, 테스트 코드도 동행 수정되어 정합성이 유지된다. `openStream` 에 `lastEventId="0"` 하드코딩으로 restore 경로에서 이미 수신한 이벤트가 재전달될 수 있으나, 위젯 reducer 가 seq dedup 을 처리한다면 상태 오염은 없다. 전반적으로 의도치 않은 전역 상태 변경·파일시스템 부작용·환경 변수 신규 읽기/쓰기·외부 네트워크 호출 추가는 없다.

## 위험도

LOW
