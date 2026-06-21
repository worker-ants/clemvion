# Architecture Review — M-7 채널 Authorizer 도메인 역전 (fresh review)

## 발견사항

### 발견사항 1
- **[INFO]** DIP + OCP 명시적 달성 — Strategy 패턴 도입
  - 위치: `codebase/backend/src/modules/websocket/channel-authorizer.ts`, `websocket.module.ts`, `websocket.gateway.ts`
  - 상세: `ChannelAuthorizer` 인터페이스와 `CHANNEL_AUTHORIZER` Symbol 토큰을 순수 token 파일(모듈 의존 없음)로 분리해 순환을 유발하지 않는다. `WebsocketGateway`는 추상화(`ChannelAuthorizer[]`)에만 의존하며 도메인 구체 클래스를 직접 알지 못한다. 신규 채널 추가 시 `gateway.ts`와 `handleSubscribe`는 무수정이고 도메인 모듈에 authorizer + factory inject 한 줄이 추가 편집 지점의 전부다. 전형적 Strategy 패턴의 교과서적 적용이다.
  - 제안: 현행 구조 유지.

### 발견사항 2
- **[INFO]** 레이어 책임 분리 — 채널 인가 로직의 도메인 귀속 완성
  - 위치: `executions/execution-channel-authorizer.ts`, `executions/background-runs/background-run-channel-authorizer.ts`, `workflows/workflow-channel-authorizer.ts`, `knowledge-base/kb-channel-authorizer.ts`, `websocket/notifications-channel-authorizer.ts`
  - 상세: 인프라/프레젠테이션 레이어인 `WebsocketGateway`가 도메인 서비스를 직접 주입해 인가 규칙을 인라인으로 소유하던 안티패턴이 제거됐다. 각 authorizer가 자기 도메인 모듈 소속으로 이동하여 "도메인이 자기 자원의 접근 정책을 소유한다"는 레이어 책임 원칙이 달성됐다. gateway는 ack 계약(spec §3) 처리만 남는다.
  - 제안: 유지.

### 발견사항 3
- **[INFO]** SRP 준수 — 각 authorizer의 응집도 최적
  - 위치: 5개 `*-channel-authorizer.ts` 파일
  - 상세: 각 클래스는 단일 채널 prefix의 매칭(`matches`)과 인가(`authorize`) 두 역할만 담당한다. 의존성은 자기 도메인 서비스 최대 1개(또는 0개, `NotificationsChannelAuthorizer`)로 최소화됐다. 인터페이스가 `matches`/`authorize` 2개 메서드로 단순하며 인터페이스 분리 원칙(ISP)도 준수한다.
  - 제안: 유지.

### 발견사항 4
- **[INFO]** `common/utils/uuid.ts` 승격 — 적절한 추상화 수준
  - 위치: `codebase/backend/src/common/utils/uuid.ts`
  - 상세: gateway 로컬 함수에서 여러 authorizer가 공유하는 `common/utils/` 위치로 승격됐다. 순수 함수라 모듈 결합을 유발하지 않고, 동일 정규식이 각 authorizer에 중복될 위험을 제거했다. UUID v1~v5 검증과 variant nibble 검증을 포함해 기능 완결성도 적절하다.
  - 제안: 유지.

### 발견사항 5
- **[INFO]** fail-closed 기본 거부(W-5) 구현 확인
  - 위치: `websocket/websocket.gateway.ts` `handleSubscribe` 내 매칭 authorizer 미발견 분기
  - 상세: `isValidChannel` 통과 채널에 매칭 authorizer가 없을 때 `success:false, 'Not authorized for this channel'`을 반환하는 fail-closed 분기가 구현됐고 gateway spec에 빈 authorizer 배열로 이 분기를 강제하는 테스트가 추가됐다. 현재 모든 valid prefix에 authorizer가 존재하므로 정상 경로는 무영향이나 방어적 구조로서 올바르다.
  - 제안: 유지.

### 발견사항 6
- **[WARNING]** `useFactory` 명시 집계 — 신규 채널 추가 시 2곳 편집 필요
  - 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` providers 블록 `inject` 배열 및 `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` 동일 구조
  - 상세: NestJS 11 환경에서 `multi: true` provider 집계가 last-write-wins로 작동해 `useFactory` 명시 집계로 전환됐다. 이로 인해 신규 authorizer 추가 시 (1) 도메인 모듈 authorizer + export, (2) `websocket.module.ts` factory `inject` 배열 한 줄, 두 지점을 편집해야 한다. spec 파일에도 동일 inject 배열이 미러링되어 있어 spec 갱신을 누락하면 production wiring과 다른 wiring으로 테스트가 통과하는 거짓 자신감 위험이 있다. 다만 gateway spec의 authorizer 개수 assertion(5개)이 이 drift를 조기 감지하는 안전망 역할을 한다.
  - 제안: 현재 위험도는 낮으나 `websocket.module.ts`에서 `buildChannelAuthorizerProvider()` 헬퍼를 export하고 spec이 이를 import하거나, inject 배열을 분리 상수로 관리해 단일 진실화하면 더 견고하다. 이번 변경 범위에서는 수용 가능.

### 발견사항 7
- **[WARNING]** 모듈-레벨 양방향 순환(C-2 클러스터) 잔존
  - 위치: `websocket/websocket.module.ts` — `forwardRef(() => ExecutionsModule)`, `forwardRef(() => KnowledgeBaseModule)`, `forwardRef(() => WorkflowsModule)` 등
  - 상세: M-7은 gateway 생성자의 서비스-레벨 forwardRef 3개(workflows/kb/background-runs)를 제거했으나, 도메인 모듈이 WS 모듈을 import(spec §4.4 단일 sink emit)하고 WS 모듈이 도메인 모듈을 import(authorizer 집계)하는 모듈-레벨 양방향 순환은 구조적으로 잔존한다. 이는 의도된 결과이며 plan 문서에 명시됐고 e2e 205 PASS로 부팅 안정성이 확인됐다. 그러나 NestJS 초기화 순서 취약성을 내포하며 향후 모듈 추가 시 순환이 확장될 위험이 있다.
  - 제안: C-2 클러스터 처리 과제에서 구조적 해소(예: 공유 이벤트 버스 도입, 도메인→WS 방향만 허용하는 단방향화) 검토. 이번 범위에서는 수용.

### 발견사항 8
- **[INFO]** `BackgroundRunsService` export 잔존 — 캡슐화 여지
  - 위치: `codebase/backend/src/modules/executions/executions.module.ts` exports 배열
  - 상세: M-7로 WS 모듈의 `BackgroundRunsService` 직접 의존이 제거됐으나 `exports`에 여전히 포함돼 있다. 다른 소비자가 없다면 export를 제거해 모듈 경계를 강화할 수 있다. RESOLUTION.md에 "별도 audit 후 후속 PR 검토"로 명시됐다.
  - 제안: 소비처 audit 후 후속 PR에서 제거 검토. 이번 범위에서는 수용.

### 발견사항 9
- **[INFO]** `WebsocketGateway`의 `ExecutionsService` 이중 역할(inbound command + 인가) — SRP 잔존 과제
  - 위치: `websocket/websocket.gateway.ts`
  - 상세: M-7 이후 gateway가 `ExecutionsService`를 inbound command 핸들러(continueExecution/handleClickButton/retryLastTurn 등 8회)에서 직접 소비하는 구조가 남아 있다. authorizer 역전과 별도로 gateway의 SRP 위반(인프라 레이어가 도메인 서비스를 직접 소유)은 부분적으로 잔존한다. plan §M-8 god-component 이슈와 연계된 후속 과제다.
  - 제안: inbound command 핸들러를 전용 커맨드 프로세서로 분리하는 과제를 백로그에 등록. 이번 범위에서는 수용.

---

## 요약

M-7 변경은 `WebsocketGateway`가 도메인 서비스 3개를 `forwardRef`로 직접 주입해 채널 인가 규칙을 인라인으로 소유하던 안티패턴을 `ChannelAuthorizer` 인터페이스 + `CHANNEL_AUTHORIZER` Symbol 토큰 중심의 Strategy 패턴 + DIP 역전 구조로 전환한 아키텍처적으로 우수한 리팩터링이다. 각 authorizer가 자기 도메인 모듈에 귀속되어 SRP·OCP·레이어 책임 분리가 동시 달성됐고, `common/utils/uuid.ts` 승격으로 UUID 검증 로직 중복이 제거됐으며 fail-closed 기본 거부(W-5)까지 보강됐다. 이전 리뷰에서 지적된 `KbChannelAuthorizer`의 UUID 검증 누락도 RESOLUTION에서 수정됐다. 잔존 이슈인 NestJS 11 `multi: true` 미지원으로 인한 `useFactory` 명시 집계(신규 채널 추가 시 2곳 편집)와 C-2 클러스터 모듈-레벨 양방향 순환은 plan에 명시된 의도된 수용 범위이며 단기 구조적 결함으로 보기 어렵다. 전반적으로 의존성 방향이 명확히 개선됐고 신규 채널 확장 비용이 최소화됐다.

## 위험도

LOW

STATUS: SUCCESS
