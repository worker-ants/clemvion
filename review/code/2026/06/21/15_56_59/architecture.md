# Architecture Review

## 발견사항

### 발견사항 1
- **[INFO]** 의존성 역전 원칙(DIP) 및 개방-폐쇄 원칙(OCP) 명시적 달성
  - 위치: `websocket/channel-authorizer.ts`, `websocket/websocket.gateway.ts`, `websocket/websocket.module.ts`
  - 상세: `WebsocketGateway` 가 `BackgroundRunsService` / `KnowledgeBaseService` / `WorkflowsService` 3개 도메인 서비스를 `forwardRef` 로 직접 주입받던 구조를 `ChannelAuthorizer` 추상 인터페이스 + `CHANNEL_AUTHORIZER` Symbol 토큰으로 역전했다. gateway 는 이제 추상화에만 의존하고 도메인 구체 클래스를 모른다. 새 채널 추가 시 gateway 코드를 수정하지 않고 도메인 모듈에 authorizer provider + export, WS module factory inject 한 줄 추가만으로 확장된다.
  - 제안: 현행 구조 유지. OCP 달성 수준이 명확하다.

### 발견사항 2
- **[INFO]** 레이어 책임 분리 — 채널 인가 로직의 도메인 모듈 귀속
  - 위치: `executions/execution-channel-authorizer.ts`, `executions/background-runs/background-run-channel-authorizer.ts`, `workflows/workflow-channel-authorizer.ts`, `knowledge-base/kb-channel-authorizer.ts`
  - 상세: 옛 구조에서는 gateway(프레젠테이션/인프라 레이어)가 도메인 서비스를 직접 주입해 채널 인가 규칙을 인라인으로 소유했다. 이번 변경으로 각 authorizer 가 자기 도메인 모듈 소속이 되어 도메인 레이어가 자신의 자원 접근 정책을 소유하는 구조가 됐다. 프레젠테이션 레이어(gateway)는 authorizer 인터페이스 배열만 소비한다.
  - 제안: 이상적인 레이어 분리. 유지.

### 발견사항 3
- **[INFO]** 단일 책임 원칙(SRP) 준수 — 각 authorizer 의 응집도
  - 위치: 5개 authorizer 파일
  - 상세: `ExecutionChannelAuthorizer`, `BackgroundRunChannelAuthorizer`, `WorkflowChannelAuthorizer`, `KbChannelAuthorizer`, `NotificationsChannelAuthorizer` 각각이 단일 채널 prefix 에 대한 매칭과 인가만 담당한다. `matches` / `authorize` 의 2개 메서드로 인터페이스가 단순하며, 의존성도 각자의 도메인 서비스 1개(또는 0개)로 최소화됐다.
  - 제안: 유지.

### 발견사항 4
- **[INFO]** `common/utils/uuid.ts` 승격 — 적절한 추상화 수준
  - 위치: `codebase/backend/src/common/utils/uuid.ts`
  - 상세: gateway 로컬 함수였던 `isValidUuid` 를 여러 authorizer 가 공유해야 하는 상황에서 `common/utils/` 로 승격한 것은 DRY 원칙에 부합하고 추상화 수준이 적절하다. 순수 함수라 모듈 간 결합을 유발하지 않는다.
  - 제안: 유지.

### 발견사항 5
- **[WARNING]** WS 모듈 수준의 순환 의존(모듈-레벨 forwardRef)이 잔존 — 범위 외 이슈이나 명시 필요
  - 위치: `websocket/websocket.module.ts` — `forwardRef(() => ExecutionEngineModule)`, `forwardRef(() => KnowledgeBaseModule)`, `forwardRef(() => WorkflowsModule)`
  - 상세: 이번 M-7 변경은 gateway 생성자의 서비스-레벨 forwardRef 3개를 제거했지만, 도메인 모듈이 WS 모듈을 import 하고(emit 경로, spec §4.4) WS 모듈이 도메인 모듈을 import 하는 양방향 모듈-레벨 순환은 그대로다. 이는 의도된 결과이고 plan 문서에도 명시돼 있다. 단, 이 순환은 NestJS 부팅 시 초기화 순서 취약성을 내포하므로 e2e 부팅 스모크 외에 구조적 해소(C-2 클러스터 처리)가 장기 과제로 남는다.
  - 제안: 이번 PR 범위에서는 수용. C-2 클러스터 처리 시 `llm`·`chat-channel` 등과 함께 재검토.

### 발견사항 6
- **[WARNING]** `useFactory` 명시 집계 방식 — 신규 채널 추가 시 2곳 편집 필요
  - 위치: `websocket/websocket.module.ts` (providers 배열의 `useFactory` 블록), `websocket/websocket.gateway.spec.ts` (테스트 내 동일 구조)
  - 상세: 원안의 NestJS `multi: true` provider 패턴이 본 환경(NestJS 11)에서 last-write-wins 로 작동해 `useFactory` 명시 집계로 전환됐다. 이로 인해 신규 채널 authorizer 추가 시 "(1) 도메인 모듈 authorizer + export, (2) WS module factory inject 한 줄" 2곳을 수정해야 한다. 순수 OCP 를 위해서는 1곳이 이상적이나, NestJS multi-provider 제약 하에서 현실적인 차선책이다. 코드 내 주석으로 이 제약을 설명하고 있어 미래 유지보수자가 실수할 위험은 낮다.
  - 제안: `useFactory` 의 `inject` 배열과 도메인 모듈 export 목록이 항상 동기화돼야 함을 강조하는 간단한 테스트(e.g. authorizer 개수 assertion)를 추가하면 불일치를 조기에 감지할 수 있다. 단, 현재 구조도 수용 가능.

### 발견사항 7
- **[INFO]** `KbChannelAuthorizer` 만 UUID 검증 누락 — 인터페이스 일관성 관찰
  - 위치: `knowledge-base/kb-channel-authorizer.ts`
  - 상세: `execution:`, `workflow:`, `background:run:` authorizer 는 UUID 검증 후 DB 조회를 수행하는데, `kb:` authorizer 는 `documentId` 에 대한 UUID 검증 없이 `verifyDocumentOwnership` 을 직접 호출한다. `documentId` 가 non-UUID slug 일 수 있다면 현행 설계가 맞지만, UUID 라면 W-6 방어 정책과 일관성이 깨진다. plan 에 이 판단의 근거가 기록되어 있지 않다.
  - 제안: `kb:` 채널의 `documentId` 포맷이 UUID 라면 `isValidUuid` 가드를 추가해 W-6 정책 일관성을 유지할 것을 권장한다. 비-UUID라면 spec 문서나 코드 주석에 이유를 명시할 것.

### 발견사항 8
- **[INFO]** `BackgroundRunsService` export 가 여전히 노출됨 — 캡슐화 검토
  - 위치: `executions/executions.module.ts` — `exports: [ExecutionsService, BackgroundRunsService, ...]`
  - 상세: 옛 코드 주석("WebsocketGateway 가 채널 subscribe 가드 호출 때문에 export 한다. 다른 사용처가 없으면 줄일 수 있다 — follow-up")을 삭제하고 계속 export 한다. M-7 로 gateway 의 직접 의존이 제거됐으니 `BackgroundRunsService` 의 WS 모듈 소비 이유가 사라졌다. 만약 다른 소비자가 없다면 export 목록에서 제거해 캡슐화를 강화할 수 있다.
  - 제안: `BackgroundRunsService` 를 외부 모듈이 소비하는 사례를 확인해, 없다면 exports 에서 제거하는 follow-up 을 C-2 또는 별도 태스크로 등록할 것.

### 발견사항 9
- **[INFO]** `WebsocketGateway` 내 `executionsService` 의 이중 역할(inbound command + 스냅샷) — 응집도 관찰
  - 위치: `websocket/websocket.gateway.ts` — `emitExecutionSnapshot`, `handleSubmitForm`, `handleClickButton` 등
  - 상세: M-7 이후 gateway 에 `ExecutionsService` 가 남은 이유(inbound command 핸들러 8회 사용)는 plan 에 명시돼 있고 이번 변경 범위가 아니다. 그러나 gateway 가 여전히 "채널 인가 외" 도메인 서비스를 직접 소유하는 구조는 추가적인 SRP 개선 여지가 있다. 이 점은 C-1 / C-2 / M-7 다음 단계에서 다룰 수 있다.
  - 제안: 이번 변경 범위에서는 수용. 이후 inbound command 핸들러를 별도 커맨드 처리기로 분리하는 과제를 백로그에 검토할 것.

---

## 요약

이번 M-7 변경은 `WebsocketGateway` 가 도메인 서비스 3개(`BackgroundRunsService`, `KnowledgeBaseService`, `WorkflowsService`)를 `forwardRef` 로 직접 주입해 인라인 배열로 채널 인가 규칙을 소유하던 구조를, `ChannelAuthorizer` 인터페이스와 `CHANNEL_AUTHORIZER` Symbol 토큰을 중심으로 한 Strategy 패턴 + DIP 역전 구조로 전환한 아키텍처적으로 우수한 리팩터링이다. 각 authorizer 가 단일 채널에 대한 매칭·인가만 담당하고 자기 도메인 모듈에 귀속됨으로써 SRP, OCP, 레이어 책임 분리가 동시에 달성됐다. NestJS 11 `multi: true` 미지원으로 `useFactory` 명시 집계가 필요해진 점, 모듈-레벨 양방향 순환(C-2)이 잔존하는 점, `KbChannelAuthorizer` 의 UUID 검증 일관성 문제는 관찰 대상이나 구조적 결함으로 보기 어렵다. 전반적으로 의존성 방향이 명확히 개선됐고 신규 채널 확장 비용이 최소화됐다.

## 위험도

LOW
