# Code Review 통합 보고서

## 전체 위험도
**LOW** — 아키텍처적으로 우수한 DI 역전 리팩터링. 핵심 보안 통제는 유지·강화됨. 즉각 차단 수준 이슈 없음. 유지보수성 경고(채널 prefix 중복, useFactory inject 목록 이중 관리)와 테스트 갭(authorizer 미매칭 시 인가 스킵 경로) 해소 필요.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 해당 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항/아키텍처 | `KbChannelAuthorizer` UUID 검증 누락 — `execution:`/`workflow:`/`background:run:` authorizer 는 모두 `isValidUuid` 로 비-UUID 입력을 DB 쿼리 전에 차단(W-6)하지만 `KbChannelAuthorizer` 는 `documentId` UUID 검증 없이 `verifyDocumentOwnership` 을 직접 호출한다. KB document ID 가 UUID 라면 W-6 정책 일관성 위반. | `codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` 전체; `kb-channel-authorizer.spec.ts` | documentId 가 UUID 라면 `isValidUuid(documentId)` 가드 추가 및 spec §3.3 `kb:` 행에 "(비-UUID 선차단)" 명기. UUID 아닌 형식이면 `authorize` 상단에 이유 주석 추가. |
| 2 | 요구사항/보안 | `NotificationsChannelAuthorizer` 의 `workspaceId` 선행 가드 의도 불명확 — `handleSubscribe` 의 `!workspaceId` 가드가 `notifications:` 채널에도 적용된다. `notifications:` 는 `userId` 만 검증해야 하는 채널이며 JWT `workspaceId` 가 optional 타입이므로 workspaceId 없는 JWT 사용 시 정상 알림 구독이 차단된다. 현재는 "JWT 에 항상 workspaceId 포함" 전제로 문제없으나 타입 수준 보장이 없다. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` handleSubscribe `!workspaceId` 블록 | `notifications:` 채널에 대해 `workspaceId` 가드 분기 또는 JWT 타입을 `workspaceId: string` (non-optional) 으로 강화해 전제를 코드로 표현. |
| 3 | 유지보수성 | 채널 prefix 리터럴 이중 관리 — `VALID_CHANNEL_PREFIXES` 배열과 각 authorizer `matches`/`slice` 에 동일 prefix 문자열이 중복 존재. prefix 변경 시 두 곳 동시 수정 필요; 한 쪽 누락 시 `isValidChannel` 과 `matches` 불일치로 채널 검증 로직이 조용히 깨진다. | `websocket/websocket.gateway.ts` VALID_CHANNEL_PREFIXES; 각 `*-channel-authorizer.ts` matches/slice 리터럴 | 각 authorizer 에 `static readonly PREFIX` 상수 선언 후 `VALID_CHANNEL_PREFIXES` 를 authorizer 에서 파생하거나, `isValidChannel` 을 주입된 `channelAuthorizers` 배열 기반으로 단순화. |
| 4 | 유지보수성 | `useFactory` inject 목록 이중 관리 — `websocket.module.ts` 와 `websocket.gateway.spec.ts` 에 동일 `inject` 배열 + `useFactory` 서명이 복사됨. 신규 authorizer 추가 시 두 파일 동시 수정 필요; spec 파일 갱신 누락 시 production 과 다른 wiring 으로 테스트가 통과하는 거짓 자신감 발생. | `websocket/websocket.module.ts` L39-45; `websocket/websocket.gateway.spec.ts` L140-150 | spec 에서 실 `WebsocketModule` provider 목록을 재사용하거나, `buildChannelAuthorizerProvider` helper 를 export 해 spec 이 동일 팩토리 정의를 import 하도록 구성. |
| 5 | 테스팅 | `handleSubscribe` authorizer 미매칭 채널 인가 스킵 동작 테스트 부재 — `this.channelAuthorizers.find(...)` 가 `undefined` 이면 `if (authorizer)` 블록 전체가 스킵되어 `client.join(channel)` 이 실행됨. `VALID_CHANNEL_PREFIXES` 와 authorizer 배열 동기화가 코드 수준에서 보장되지 않아 신규 채널 prefix 추가 시 authorizer 누락 → 인가 없이 join 허용 보안 구멍 가능. | `websocket/websocket.gateway.ts` handleSubscribe L2009-2031; `websocket.gateway.spec.ts` | (1) `gateway.spec.ts` 에 authorizer 없는 채널 구독 시 거부 테스트 추가, 또는 (2) `handleSubscribe` 에 `if (!authorizer) return { event: 'subscribed', data: { success: false, error: 'Unknown channel' } }` 기본 거부 방어 코드 추가(추천). |
| 6 | 아키텍처 | `useFactory` 명시 집계 방식 — NestJS 11 `multi: true` 미지원으로 `useFactory` 명시 집계 전환. 신규 채널 authorizer 추가 시 "(1) 도메인 모듈 authorizer + export, (2) WS module factory inject 한 줄" 2곳 편집 필요. | `websocket/websocket.module.ts` providers 배열 useFactory 블록 | authorizer 개수 assertion 테스트 추가로 불일치 조기 감지 권장. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec §3.3 `channelAuthorizers` 표기가 gateway 인라인 배열 구조를 암시 — M-7 구현 후 `channelAuthorizers` 는 더 이상 인라인 배열이 아니라 `CHANNEL_AUTHORIZER` 토큰으로 주입되는 배열. spec 의 OCP 설명은 의미상 옳으나 구체적 메커니즘이 불일치. | `spec/5-system/6-websocket-protocol.md` §3.3 | 코드 유지 + spec 갱신: §3.3 의 `channelAuthorizers` 참조를 "각 도메인 모듈이 `CHANNEL_AUTHORIZER` 토큰으로 등록한 `ChannelAuthorizer[]` 를 gateway 가 주입받는 구조(OCP)" 로 갱신 (project-planner 위임). |
| 2 | 보안 | `notifications:` 채널 구독 시 `workspaceId` 없으면 fail-closed — 정책적으로 안전하나 의도한 채널(userId 전용)에서 정상 구독 차단 가능. | `websocket.gateway.ts` handleSubscribe `!workspaceId` 블록 | JWT 에 항상 workspaceId 포함 전제 변경 시 채널별 세분화 필요. |
| 3 | 보안 | inbound command 핸들러 `executionId` UUID 검증 누락 — subscribe 경로는 UUID 검증 있으나 form/button/message/retry 핸들러는 isValidUuid 없이 `verifyOwnership` 에 직접 전달. ORM 파라미터화 쿼리로 실질 인젝션 차단됨. | `websocket.gateway.ts` 각 `@SubscribeMessage` 핸들러 | 각 inbound command 핸들러에서 `executionId`/`nodeExecutionId` 에 `isValidUuid` 검증 추가. |
| 4 | 아키텍처 | WS 모듈-레벨 순환 의존 잔존 — 이번 변경 의도된 결과이며 plan 명시됨. | `websocket/websocket.module.ts` forwardRef 블록 | C-2 클러스터 처리 시 재검토. |
| 5 | 아키텍처 | `BackgroundRunsService` export 과잉 가능성 — M-7 이후 gateway 직접 참조 제거됨. | `executions/executions.module.ts` exports 배열 | 다른 외부 소비처 확인 후 없다면 후속 PR 에서 export 제거 검토. |
| 6 | 아키텍처 | `ExecutionsService` gateway 이중 역할(inbound command + 스냅샷) — 향후 SRP 개선 여지. M-7 범위 밖. | `websocket/websocket.gateway.ts` emitExecutionSnapshot, handleSubmitForm 등 | C-1/C-2 다음 단계에서 inbound command 핸들러 분리 검토. |
| 7 | 유지보수성 | `NotificationsChannelAuthorizer.authorize` 동기 로직을 `Promise.resolve()` 로 감싸 반환 — 다른 authorizer 는 `async` 키워드 사용, 패턴 불일치. | `notifications-channel-authorizer.ts` L17-25 | `async authorize(...)` 형태로 일관화. |
| 8 | 유지보수성 | `handleSubscribe` 내 `enriched` 타입 캐스팅 이중 선언. | `websocket.gateway.ts` handleSubscribe 바디 | 함수 상단 단일 캐스팅 후 재사용. |
| 9 | 테스팅 | `isValidUuid` 공유 유틸 전용 단위 테스트 부재 — 보안-크리티컬 경계값 함수임에도 uuid.spec.ts 없음. | `codebase/backend/src/common/utils/uuid.ts` | `uuid.spec.ts` 신설해 경계값 테이블 테스트 추가. |
| 10 | 테스팅 | `KbChannelAuthorizer` — `verifyDocumentOwnership` 이 `false` 반환하는 경로 미테스트. | `kb-channel-authorizer.spec.ts` | `false` resolve 케이스 추가 또는 throw 전용임을 주석 명시. |
| 11 | 테스팅 | `BackgroundRunChannelAuthorizer` — `verifyBackgroundRunOwnership` throw 경로 미테스트. | `background-run-channel-authorizer.spec.ts` | throw 시 거부 반환 케이스 추가. |
| 12 | 테스팅 | `NotificationsChannelAuthorizer` 단일 인스턴스 공유 — 현재 무상태라 무해하나 향후 상태 추가 시 테스트 오염 가능. | `notifications-channel-authorizer.spec.ts` | `beforeEach` 에서 인스턴스 새로 생성 패턴 권장. |
| 13 | 보안 | debug 로그에 `error.message` 출력 — 서버 측 로그이므로 클라이언트 미노출. | `websocket.gateway.ts` emitExecutionSnapshot catch 블록 | 현재 구조 유지. |
| 14 | 보안 | 개발용 JWT secret fallback `'dev-jwt-secret'` — `assertProductionConfig` 가 차단 보장. 기존 코드. | `websocket.module.ts` JwtModule.registerAsync useFactory | 현재 구조 유지. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | UUID 검증 정책 일관성(KbChannelAuthorizer), inbound command executionId 검증 누락 — 즉각 취약점 아님 |
| architecture | LOW | useFactory 명시 집계(2곳 편집), 모듈-레벨 순환 잔존 — 구조 결함 아님, 수용 |
| requirement | LOW | KbChannelAuthorizer UUID 가드 누락(W-6 정책 불일치), notifications workspaceId 가드 의도 불명확; SPEC-DRIFT(spec §3.3 메커니즘 불일치) |
| scope | NONE | 변경 범위가 M-7 목적과 일치. 즉시 차단 불필요. |
| side_effect | NONE | 의도치 않은 부작용 없음. 공개 API 변경 최소. |
| maintainability | LOW | 채널 prefix 이중 관리, useFactory inject 목록 이중 관리 — 신규 채널 추가 시 누락 가능성 |
| testing | LOW | authorizer 미매칭 채널 인가 스킵 경로 테스트 부재(보안 구멍 가능), isValidUuid 전용 단위 테스트 부재 |
| documentation | NONE | 전반적으로 양호. README/CHANGELOG 업데이트 불필요. |

## 발견 없는 에이전트

scope, side_effect, documentation — 위험도 NONE, 즉각 조치 불필요.

## 권장 조치사항

1. **[WARNING-5 / 보안]** `handleSubscribe` 에 `if (!authorizer) return { event: 'subscribed', data: { success: false, error: 'Unknown channel' } }` 기본 거부 방어 코드 추가 — `VALID_CHANNEL_PREFIXES` 와 authorizer 배열 불일치 시 인가 없이 join 허용되는 구멍 차단.
2. **[WARNING-1 / 보안·요구사항]** `KbChannelAuthorizer` 의 `documentId` 가 UUID 인지 확인 후: UUID 라면 `isValidUuid` 가드 추가 + `kb-channel-authorizer.spec.ts` 비-UUID 거부 케이스 추가; UUID 아닌 식별자라면 `authorize` 상단에 이유 주석 추가.
3. **[WARNING-2 / 요구사항]** JWT 타입의 `workspaceId` 를 non-optional (`workspaceId: string`) 로 강화하거나 `notifications:` 채널에 대해 가드 분기 처리 — 타입 수준에서 전제를 명시.
4. **[WARNING-3 / 유지보수성]** 각 authorizer 에 `static readonly PREFIX` 상수 선언, `VALID_CHANNEL_PREFIXES` 를 authorizer PREFIX 에서 파생 — prefix 중복 관리 제거.
5. **[WARNING-4 / 유지보수성]** `websocket.module.ts` 의 factory provider 빌더를 export 하거나 spec 이 실 모듈 provider 를 재사용하도록 구성 — inject 목록 이중 관리 해소.
6. **[WARNING-6 / 아키텍처]** authorizer 개수 assertion 테스트 추가 — `VALID_CHANNEL_PREFIXES` 와 주입된 authorizer 배열 크기 불일치를 조기 감지.
7. **[INFO-1 / SPEC-DRIFT]** `spec/5-system/6-websocket-protocol.md §3.3` 의 `channelAuthorizers` 참조를 DI 주입 구조로 갱신 (project-planner 위임).
8. **[INFO-9 / 테스팅]** `codebase/backend/src/common/utils/uuid.spec.ts` 신설 — `isValidUuid` 경계값 테이블 테스트 추가.

## 라우터 결정

- **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation (8명, 전원 forced)
- **제외**: performance, dependency, database, concurrency, api_contract, user_guide_sync (6명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |