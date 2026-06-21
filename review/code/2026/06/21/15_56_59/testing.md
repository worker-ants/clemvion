# Testing Review — M-7 채널 Authorizer 도메인 역전

## 발견사항

### **[INFO]** `isValidUuid` 공유 유틸 단위 테스트 부재
- 위치: `codebase/backend/src/common/utils/uuid.ts`
- 상세: `isValidUuid` 함수가 authorizer 5개에서 공유되는 보안-크리티컬 경계값 함수임에도 전용 단위 테스트 파일이 없다. 각 authorizer 스펙에서 비-UUID 입력 케이스를 통해 간접 검증되기 때문에 기능적 오탐은 낮지만, UUID 정규식 자체의 경계값(빈 문자열, v0, v6, 대소문자 혼합, 하이픈 없는 32자, NULL 바이트 포함)을 명시적으로 문서화한 테스트가 없다.
- 제안: `codebase/backend/src/common/utils/uuid.spec.ts` 를 신설해 `isValidUuid` 에 대한 경계값 테이블 테스트(valid v1~v5, empty string, non-UUID string, UUID without hyphens, v0, v6) 를 추가한다. 특히 `[0-9a-f]{3}-[89ab]` 부분(variant 비트)이 올바로 거부하는지 검증 케이스가 필요하다.

### **[INFO]** `KbChannelAuthorizer` — UUID 가드 없이 DB 조회 직행
- 위치: `codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` 및 `kb-channel-authorizer.spec.ts`
- 상세: `execution:`/`workflow:`/`background:run:` authorizer 는 모두 `isValidUuid` 로 non-UUID 입력을 DB 조회 전에 차단(W-6)하는데, `KbChannelAuthorizer` 는 documentId 에 대한 UUID 형식 검증 없이 `verifyDocumentOwnership` 을 직접 호출한다. KB document ID 가 UUID 가 아닌 슬러그/임의 문자열일 수 있다면 의도된 설계이지만, spec 내 KB document ID 형식이 UUID 라면 W-6 방어 누락이다. 테스트도 UUID 가드 케이스가 없다.
- 제안: spec 을 확인해 KB document ID 형식이 UUID 라면 `isValidUuid` 가드를 추가하고, `.spec.ts` 에 비-UUID documentId 입력에 대한 거부 케이스를 추가한다. UUID가 아닌 식별자라면 현행이 맞으나, 테스트에 `matches` 케이스에서 빈 문자열 또는 `:` 뒤가 없는 채널(`kb:`) 에 대한 케이스를 보완한다.

### **[INFO]** `KbChannelAuthorizer` 테스트 — `verifyDocumentOwnership` 이 `false` 를 반환하는 경로 미테스트
- 위치: `codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.spec.ts`
- 상세: 다른 authorizer 스펙(`BackgroundRunChannelAuthorizer`, `ExecutionChannelAuthorizer`)은 서비스가 `false`(또는 `undefined`)를 반환할 때 거부하는 케이스를 명시적으로 검증한다. `KbChannelAuthorizer` 의 `verifyDocumentOwnership` 은 throw 방식(`.catch(() => false)` 패턴)이므로 `false` 직접 반환 경로가 없을 수 있으나, `verifyDocumentOwnership` 시그니처가 `Promise<boolean>` 이라면 `false` 반환 케이스가 커버되지 않는다.
- 제안: `verifyDocumentOwnership` 이 `false` 를 resolve 하는 케이스를 테스트에 추가한다. throw 전용이라면 테스트 주석으로 명시한다.

### **[INFO]** `NotificationsChannelAuthorizer` — 인스턴스 공유로 인한 테스트 격리 잠재 이슈
- 위치: `codebase/backend/src/modules/websocket/notifications-channel-authorizer.spec.ts` (라인 1348)
- 상세: `const authorizer = new NotificationsChannelAuthorizer()` 를 `describe` 블록 최상위에서 단일 인스턴스로 선언해 모든 `it` 블록이 공유한다. `NotificationsChannelAuthorizer` 는 상태가 없으므로 현재는 격리 문제가 없다. 그러나 향후 상태(예: rate limiting, cache)가 추가될 경우 테스트 간 오염이 발생할 수 있다.
- 제안: 각 `it` 블록 또는 `beforeEach` 에서 인스턴스를 새로 생성하는 패턴으로 변경한다. 현재 동작에는 영향 없으나 일관성과 미래 안전성을 위한 방어 코딩이다.

### **[INFO]** `gateway.spec.ts` — 전체 파일 diff 미제공으로 인한 커버리지 갭 파악 불완전
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`
- 상세: diff 가 DI wiring 부분(126~151행)만 제공되고 기존 테스트 케이스 본문 전체가 포함되지 않아 `handleSubscribe` 의 `authorizer` 가 없는 채널(예: 미등록 채널 또는 `isValidChannel` 통과 but authorizer 없음), `workspaceId` 빈 값 즉시 거부 분기, `MAX_SUBSCRIPTIONS_PER_CONNECTION` 도달 후 authorizer 호출 방지 순서를 커버하는 테스트가 있는지 확인할 수 없다. 커밋 메시지에는 "기존 subscribe 인가 동작 테스트가 그대로 유효"라고 명시되어 있어 회귀 보호가 있는 것으로 보이나 검증 불가하다.
- 제안: 리뷰어 측 확인 사항: `handleSubscribe` 에서 `authorizer` 를 찾지 못한 채널(예: `VALID_CHANNEL_PREFIXES` 에는 있으나 authorizer 배열에는 없는 채널) 로 구독 시 통과하는지 또는 거부하는지 명시적인 테스트가 있어야 한다. `websocket.gateway.ts:2009` 의 `authorizer` 가 undefined 이면 인가 단계가 skipped 되어 join 이 허용된다 — 이 동작(의도적 or 버그)을 커버하는 테스트가 필요하다.

### **[WARNING]** `handleSubscribe` — authorizer 미매칭 채널에 대한 인가 스킵 동작 테스트 부재
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` 라인 2009-2031
- 상세: `const authorizer = this.channelAuthorizers.find((a) => a.matches(channel))` 의 결과가 `undefined` 이면 인가 블록 전체가 `if (authorizer)` 로 스킵되어 `client.join(channel)` 이 실행된다. `VALID_CHANNEL_PREFIXES` 는 `isValidChannel` 에서 prefix 필터를 제공하지만, `VALID_CHANNEL_PREFIXES` 와 authorizer 배열의 동기화가 코드 수준에서 보장되지 않는다. 현재는 5채널 모두 authorizer 가 있어 문제없으나, 신규 채널을 `VALID_CHANNEL_PREFIXES` 에 추가하되 authorizer 는 빠뜨리면 인가 없이 join 이 허용되는 보안 구멍이 생긴다. 이 경로를 커버하는 테스트가 없다.
- 제안: (1) `gateway.spec.ts` 에 `CHANNEL_AUTHORIZER` 배열에서 특정 authorizer 를 제거했을 때 해당 채널 구독이 통과하는지 또는 거부하는지를 명시적으로 테스트하는 케이스를 추가한다. (2) 혹은 `handleSubscribe` 내에서 authorizer 가 없을 때 기본 거부하는 방어 코드를 추가한다(`if (!authorizer) { return { event: 'subscribed', data: { success: false, error: 'Unknown channel' } }; }`). 후자가 더 안전하고 테스트하기 쉬운 구조다.

### **[INFO]** `BackgroundRunChannelAuthorizer` 테스트 — `verifyBackgroundRunOwnership` throw 경로 미테스트
- 위치: `codebase/backend/src/modules/executions/background-runs/background-run-channel-authorizer.spec.ts`
- 상세: 구현체는 `.catch(() => false)` 패턴으로 throw 를 `false` 로 평탄화한다. `ExecutionChannelAuthorizer` 스펙은 "rejects when ownership throws (NotFound — IDOR/enumeration 차단)" 케이스를 명시적으로 테스트하지만, `BackgroundRunChannelAuthorizer` 스펙에는 `verifyBackgroundRunOwnership` 이 throw 하는 케이스가 없다.
- 제안: `verifyBackgroundRunOwnership` 이 `Error` 를 throw 할 때 `{ error: 'Not authorized for this background run' }` 을 반환하는 케이스를 추가한다. (IDOR enumeration 차단 동작을 문서화하는 목적도 있다.)

## 요약

M-7 변경은 테스트 측면에서 전반적으로 우수하다. 5개 authorizer 각각에 도메인-로컬 단위 스펙이 신설되었고, `gateway.spec.ts` 도 실 authorizer + useFactory wiring 으로 DI 역전을 함께 검증하는 구조로 갱신되었으며, `TEST WORKFLOW: lint·build·unit(40)·e2e 205 PASS` 로 회귀 보호가 확인되었다. 발견된 이슈는 모두 INFO 또는 WARNING 등급이며: (1) 공유 `isValidUuid` 유틸의 전용 단위 테스트 부재, (2) `KbChannelAuthorizer` 의 UUID 가드 및 `false` 반환 경로 테스트 누락, (3) `handleSubscribe` 에서 authorizer 미매칭 채널이 인가 없이 통과되는 잠재 보안 구멍과 해당 테스트 부재가 주요 갭이다. 특히 (3)은 신규 채널 추가 시 개발자 실수를 방지하는 안전망이 코드 수준에서 없다는 점에서 WARNING 으로 분류하며, `handleSubscribe` 에 기본 거부 방어 코드 또는 명시적 테스트 추가를 권장한다.

## 위험도

LOW
