# 성능(Performance) 리뷰 — chat-channel-binder 서비스 분리 (T2)

## 컨텍스트

이 변경은 `TriggersService` 의 private 메서드였던 `setupChatChannel` / `teardownChatChannel`
/ `buildCallbackUrl` 을 각각 `ChatChannelBinderService`(신규 provider) 와
`buildTriggerCallbackUrl`(신규 순수 함수)로 **동작 보존 이동**한 것이다(plan
`plan/in-progress/impl-chat-channel-binder-t2.md` 명시, diff 상으로도 로직 자체는
1:1로 옮겨졌을 뿐 새 알고리즘·새 반복문·새 DB 접근 패턴이 추가되지 않았다). 나머지 파일
(`triggers.module.ts`, `*.spec.ts`)은 DI 배선/테스트 provider 등록뿐이라 런타임 성능에
영향이 없다. 따라서 아래 발견사항은 대부분 **이번 diff 로 신규 도입된 회귀가 아니라
이동된 기존 코드에 원래 있던 특성**이며, 그렇게 표시했다.

`setupChatChannel` / `teardownChatChannel` 호출부는 `TriggersService.create` /
`update` / `remove` 세 곳뿐이고(전수 확인, `triggers.service.ts:448,565,855`), 모두
**트리거 1건당 1회** 호출되는 요청-핸들러 경로다. 반복문 안에서 호출되지 않으므로
N+1 패턴은 아니다.

### 발견사항

- **[INFO]** `setupChatChannel` 내 secret store 쓰기 3곳이 순차 `await` — 병렬화 가능한 구간이 있다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:133-160` (bot token rotate → provider-issued inbound-signing rotate)
  - 상세: `botTokenRef` 회전(129~139줄)과 `inboundSigningRef` 회전(150~160줄)은 서로 다른 secret-store 키를 대상으로 하고 서로의 결과값에 의존하지 않는다. 현재는 두 `await this.secrets.rotate(...)` 가 순차 실행되어 PATCH/POST 요청 지연시간에 두 왕복(round-trip)이 그대로 누적된다. 다만 이는 이번 diff 가 새로 만든 코드가 아니라 `TriggersService` 에서 로직 그대로 옮겨온 것이므로 **이번 변경으로 도입된 회귀는 아니다** — 순수 이동이라는 PR 목표(동작 보존)를 지키려면 이 최적화는 별도 후속 PR 대상이지 이 PR 의 스코프는 아니다.
  - 제안: 후속 작업으로 두 rotate 가 서로 독립임이 유지되는 한 `Promise.all([...])` 로 묶어 지연시간을 줄일 수 있다. (`storeUserSuppliedSecrets` 게이팅으로 조건부 실행이 갈리므로, 병렬화 시 조건 분기를 유지한 채 각 branch 결과를 `Promise.all` 후보 배열에 넣는 형태가 필요.)

- **[INFO]** 객체 스프레드로 인한 `ChatChannelConfig` 재구성이 성공/실패 경로 각각에서 반복됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:216-229` (`mergedChannel`/`newConfig`), `:258-261` (`fallbackConfig`)
  - 상세: `internalCfg`, `mergedChannel`, `newConfig`, `fallbackConfig` 모두 얕은 스프레드로 만들어지는 소규모 config 객체(필드 수 개)라 실질적 비용은 무시할 수준이다. 대량 데이터나 깊은 중첩 구조가 아니므로 CRITICAL/WARNING 대상은 아니다. 참고 수준으로만 기록.

- **[INFO]** `stripChatChannelPlaintext` 가 setup 경로마다 매번 재계산됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:165`
  - 상세: `chatChannelCfg` 는 요청 바디 크기(필드 수개)의 소규모 객체이고 함수는 트리거 1건당 1회만 호출되므로 캐싱 필요성이 없다. 문제 없음, 기록만.

### 점검했으나 이슈 없음

- **알고리즘 복잡도**: 반복문·재귀 없음, 모두 O(1) 필드 접근/스프레드. 문제 없음.
- **N+1 쿼리/호출**: `setupChatChannel`/`teardownChatChannel` 호출부 전수 확인 결과 트리거 컬렉션을 순회하며 호출하는 지점 없음(모두 단건 요청 핸들러). 문제 없음.
- **메모리 할당**: 대량 데이터 적재·누수 가능성 없음. 소규모 config 객체 스프레드뿐.
- **캐싱**: `ConfigService.get('app.url')` 은 Nest `ConfigService` 내부적으로 이미 캐시된 값을 반환 — 별도 캐싱 불필요.
- **블로킹 I/O**: 모든 secret store/adapter/repository 호출이 `await` 로 비동기 처리됨. 동기 I/O 없음.
- **불필요한 연산 / 문자열 누적**: `buildTriggerCallbackUrl`(`trigger-callback-url.ts:41-42`)은 정규식 치환 2회 + 템플릿 리터럴 1회로 O(1) 수준. 반복 호출로 누적되는 O(n²) 패턴 아님.
- **데이터 구조**: `Repository<Trigger>`, config 객체 리터럴 모두 용도에 적합.
- **지연 로딩**: 즉시 필요하지 않은 리소스를 미리 적재하는 지점 없음. `adapter` 는 필요 시점(`channelAdapterRegistry.get`)에만 조회.

### 뮤테이션 검증

이번 리뷰에서는 저장소 파일을 수정하지 않았다(정적 분석·grep·Read 만 사용). `git status --short` 로 확인한 잔여 변경 없음.

## 요약

이 PR 은 `TriggersService` 의 chat-channel 바인딩 로직(`setupChatChannel`/`teardownChatChannel`/callback URL 조립)을 새 `ChatChannelBinderService`·`buildTriggerCallbackUrl` 로 옮기는 순수 리팩터링이며, DB 접근 패턴·secret store 호출 횟수·알고리즘 복잡도가 이동 전과 동일하게 보존되어 있다(호출부 전수 확인 결과 트리거 1건당 1회 호출, 반복문 내 호출 없음). 새로 도입된 성능 회귀는 없고, secret store 쓰기 2건을 병렬화할 수 있는 기존 여지(INFO)만 후속 최적화 후보로 남는다.

## 위험도

NONE
