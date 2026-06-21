### 발견사항

- **[INFO]** `UUID_PATTERN` 상수가 모듈-레벨 클로저 변수로 선언됨
  - 위치: `/codebase/backend/src/common/utils/uuid.ts` L1
  - 상세: `UUID_PATTERN`은 `const`로 선언된 파일-스코프 불변 정규식이다. JS 엔진은 이를 한 번만 컴파일하므로 공유 상태 문제가 없다. `RegExp#test()`는 `lastIndex`를 변경하지 않는다(비-global, 비-sticky 플래그). 부작용 없음.
  - 제안: 없음.

- **[INFO]** `isValidUuid`가 `websocket.gateway.ts`의 로컬 함수에서 공유 유틸로 승격
  - 위치: `websocket.gateway.ts` 삭제 diff + `common/utils/uuid.ts` 신설
  - 상세: 동일 정규식·동일 시그니처(`(value: string) => boolean`)를 유지하며 공유 경로로 이동한 것이다. 기존 호출자(게이트웨이 로컬 함수)는 삭제되었고, 신규 호출자(authorizer 4개)로 대체되었다. 함수 시그니처·반환 타입·동작이 동일하므로 의도치 않은 변경 없음.
  - 제안: 없음.

- **[INFO]** `WebsocketGateway` 생성자 시그니처 변경 — 서비스 3개 제거 + `channelAuthorizers` 배열 주입 추가
  - 위치: `websocket.gateway.ts` L62-79 (변경 diff)
  - 상세: `BackgroundRunsService`, `KnowledgeBaseService`, `WorkflowsService` 파라미터가 제거되었다. 이 세 서비스는 채널 인가 목적으로만 사용되었으며, 다른 핸들러에서는 참조가 없음이 diff로 확인된다. `channelAuthorizers: ChannelAuthorizer[]`가 `@Inject(CHANNEL_AUTHORIZER)`로 대체된다. NestJS DI가 직접 관리하므로 외부에서 이 생성자를 직접 호출하는 코드가 없는 한 호환성 문제 없음. 테스트(`websocket.gateway.spec.ts`)도 같은 PR에서 갱신되었다.
  - 제안: 없음.

- **[INFO]** `executions.module.ts` exports 배열 확장 — `ExecutionChannelAuthorizer`, `BackgroundRunChannelAuthorizer` 추가
  - 위치: `executions.module.ts` L37-41
  - 상세: 기존 `exports: [ExecutionsService, BackgroundRunsService]`에 두 authorizer 클래스가 추가되었다. 이 변경은 WS 모듈의 useFactory inject가 두 클래스를 참조하기 위해 필요하다. exports 추가는 기존 소비자(다른 모듈)에 추가 노출만 일어날 뿐 기존 export를 제거하거나 변경하지 않아 회귀 없음.
  - 제안: 없음.

- **[INFO]** `knowledge-base.module.ts` exports 재작성 — 인라인 배열을 명시 배열로 교체
  - 위치: `knowledge-base.module.ts` L102-108 (변경 diff)
  - 상세: 기존 `exports: [KnowledgeBaseService, RagSearchService, EmbeddingService]`가 `[KnowledgeBaseService, RagSearchService, EmbeddingService, KbChannelAuthorizer]`로 확장되었다. 기존 세 항목은 그대로 유지되며 누락 없음. 확인 필요 지점: diff의 전체 파일 컨텍스트에서 세 서비스가 모두 exports에 포함됨이 검증된다.
  - 제안: 없음.

- **[INFO]** `websocket.module.ts`의 CHANNEL_AUTHORIZER useFactory 집계 — `multi: true` 대신 명시적 배열 반환
  - 위치: `websocket.module.ts` providers 배열 내 factory 정의
  - 상세: `useFactory: (...authorizers: ChannelAuthorizer[]): ChannelAuthorizer[] => authorizers`는 inject 목록의 5개 authorizer를 인자로 받아 배열을 반환한다. inject 순서가 곧 배열 순서가 되며, prefix가 상호 배타적이므로 순서는 인가 결과에 영향을 주지 않는다. 단, inject 목록에서 누락된 authorizer는 조용히 무시되므로, 향후 채널 추가 시 inject 목록도 함께 편집해야 한다는 OCP 미흡 지점이 있으나 이는 이미 주석으로 명시되어 있다.
  - 제안: 없음(현 범위에서 부작용 없음).

- **[INFO]** `KbChannelAuthorizer.authorize`에서 UUID 검증 미실시
  - 위치: `kb-channel-authorizer.ts` L22-27
  - 상세: `execution:`·`workflow:`·`background:run:` authorizer는 `isValidUuid(id)` 검증으로 비-UUID 입력을 DB 조회 전에 차단하지만, `KbChannelAuthorizer`는 documentId에 대한 UUID 사전 검증을 하지 않는다. `verifyDocumentOwnership`이 임의 문자열을 인자로 받는다. 이것이 의도된 차이(문서 ID가 UUID가 아닌 다른 형식일 수 있음)인지 또는 누락인지는 `KnowledgeBaseService.verifyDocumentOwnership`의 내부 구현에 달려 있다. 부작용 관점에서 DB 쿼리가 불필요하게 실행될 수 있는 가능성이 있다. 그러나 기존 게이트웨이 인라인 authorizer에서도 동일하게 UUID 검증이 없었으므로 행동 변경은 아니다.
  - 제안: 다른 authorizer와 일관성을 위해 `isValidUuid(documentId)` 검증 추가를 검토할 것을 권장하나, 현 PR의 부작용 범위 밖 이슈다.

- **[INFO]** `handleSubscribe`의 `workspaceId` 공백 가드가 `notifications:` 채널에도 적용됨
  - 위치: `websocket.gateway.ts` L2016-2021 (전체 파일 컨텍스트)
  - 상세: `if (!workspaceId)` 가드가 authorizer를 찾은 경우에 진입하며, `notifications:` authorizer도 이 분기를 통과한다. 주석("notifications: 는 user 단위지만, 인증된 소켓은 JWT 에 workspaceId 를 함께 담으므로 본 가드는 정상 경로를 막지 않는다")이 이 동작을 설명한다. JWT에 workspaceId가 항상 포함된다는 전제가 유지되어야 한다. 이는 기존 코드와 동일한 전제이므로 행동 변화 없음.
  - 제안: 없음.

- **[INFO]** `BackgroundRunsService`가 `executions.module.ts`의 exports에 여전히 포함됨
  - 위치: `executions.module.ts` exports 배열
  - 상세: 리팩터 전 주석("BackgroundRunsService 는 WebsocketGateway 가 채널 subscribe 가드 호출 때문에 export 한다")이 삭제되고 M-7 주석으로 대체되었다. gateway가 더 이상 `BackgroundRunsService`를 직접 주입받지 않지만, 다른 소비자가 있는지 확인이 필요하다. 그러나 부작용 관점에서는 export를 유지하는 것이 기존 소비자를 깨뜨리지 않으므로 보수적으로 올바른 선택이다.
  - 제안: 없음(후속에서 실제 사용처 확인 후 export 축소 가능).

### 요약

이번 변경은 `WebsocketGateway`의 채널 인가 로직을 인라인 배열에서 DI 역전 패턴(`CHANNEL_AUTHORIZER` 토큰 + 도메인 모듈 소유 authorizer)으로 전환한다. 의도치 않은 상태 변경·전역 변수 도입·파일시스템 부작용·환경 변수 오용·네트워크 호출·이벤트/콜백 변경은 존재하지 않는다. `isValidUuid`의 모듈-레벨 상수 승격은 불변 정규식이므로 안전하다. 공개 API 변경은 `websocket.module.ts`의 provider 배열 및 각 도메인 모듈의 exports 확장에 한정되며 기존 export는 전부 유지된다. `KbChannelAuthorizer`의 UUID 사전 검증 누락은 기존 행동의 보존이지 이번 변경이 도입한 회귀가 아니다. 전체적으로 의도치 않은 부작용 위험은 발견되지 않는다.

### 위험도

NONE
