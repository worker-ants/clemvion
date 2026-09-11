# 성능(Performance) 리뷰 — chat-channel-binder 서비스 분리 (T2, 2라운드)

## 컨텍스트

이번 diff 는 `codebase/backend/src/modules/triggers/` 하위 8개 파일(신규 4·수정 4)로 구성된다.
핵심은 `TriggersService` 의 private 메서드 `setupChatChannel`/`teardownChatChannel`/
`buildCallbackUrl` 을 신규 provider `ChatChannelBinderService` 와 신규 순수 함수
`buildTriggerCallbackUrl` 로 옮기는 **동작 보존 이동**이다. `git diff origin/main` 으로 실제
diff 를 직접 열어 대조한 결과, 이동된 로직은 알고리즘·반복문·DB 접근 패턴·secret store 호출
횟수 모두 이동 전과 바이트 단위로 동일하다(단, `buildCallbackUrl(endpointPath)` 위치 인자
호출이 `buildTriggerCallbackUrl({ baseUrl, endpointPath })` 이름 인자 호출로 바뀌었으나 이는
런타임 비용에 영향 없는 시그니처 변경이다).

이 diff 는 같은 브랜치의 이전 라운드(`review/code/2026/09/11/18_04_36`)가 검토한 것과 **같은
프로덕션 코드**에 (a) 신규 테스트 파일 2개(`trigger-callback-url.spec.ts`,
`chat-channel-binder.service.spec.ts` — teardown 경로 4케이스), (b) 기존 spec 파일에 provider
등록/위임 단언 추가, (c) `buildTriggerCallbackUrl` 인자를 위치 기반에서 이름 기반으로 바꾼
시그니처 변경만 더해진 상태다. 이 셋 모두 런타임 성능에 영향이 없으므로, 이전 라운드의 성능
분석 결론은 이번 라운드에도 그대로 유지된다 — 아래에 재확인 결과로 다시 적는다.

`setupChatChannel`/`teardownChatChannel` 호출부는 `triggers.service.ts` 의 `create()`(448행
부근) / `update()`(565행 부근) / `remove()`(855행 부근) 세 곳뿐이며 모두 **트리거 1건당 1회**
호출되는 요청-핸들러 경로다. 반복문 안에서 호출되는 지점은 없다 — N+1 패턴 아님.

## 발견사항

- **[INFO]** `setupChatChannel` 내 secret store 쓰기가 순차 `await` — 병렬화 가능한 구간 존재 (사전 존재, 이번 diff 가 만든 것 아님)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:134-139`(bot token rotate) 및 `:154-158`(provider-issued inbound-signing rotate)
  - 상세: 두 `await this.secrets.rotate(...)` 는 서로 다른 secret-store 키(`botTokenRef` vs `inboundSigningRef`)를 대상으로 하고 서로의 결과값에 의존하지 않는데, 순차 실행되어 두 왕복(round-trip) 지연이 요청 처리 시간에 그대로 누적된다. `storeUserSuppliedSecrets` 게이팅으로 조건부 실행이 갈리므로 항상 둘 다 실행되는 것은 아니지만, 둘 다 실행되는 경로(생성 시 `storeUserSuppliedSecrets: true` + provider-issued plaintext 존재)에서는 두 번의 순차 I/O 가 그대로 발생한다. 이는 `TriggersService` 원본에 있던 패턴을 그대로 옮긴 것으로, **이번 이동 diff 가 새로 만든 회귀는 아니다** — "순수 이동(단언 diff 0줄)" 이라는 이 PR 의 명시적 목표를 지키려면 최적화는 별도 후속 PR 스코프다.
  - 제안: 두 rotate 가 서로 독립임이 유지되는 한 후속 작업에서 `Promise.all([...])` 로 묶어 지연시간을 줄일 수 있다.

- **[INFO]** 객체 스프레드로 `ChatChannelConfig` 재구성이 성공/실패 경로 각각에서 반복됨 (사전 존재)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:216-229`(`mergedChannel`/`newConfig`), `:258-261`(`fallbackConfig`)
  - 상세: `internalCfg`→`mergedChannel`→`newConfig`(및 실패 경로의 `fallbackConfig`) 모두 필드 수개 수준의 얕은 스프레드로, 트리거 1건당 1회씩만 만들어진다. 대량 데이터·깊은 중첩이 아니므로 실질 비용은 무시할 수준. 참고 기록만.

- **[INFO]** 신규 테스트 파일 2개는 순수 함수/단일 클래스에 대한 동기 단위 테스트로, 성능 관점에서 문제 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.spec.ts`, `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts`
  - 상세: 두 파일 모두 mock 협력자(`jest.fn()`)로 `new` 직접 생성하거나 인자 없이 순수 함수를 호출하는 형태다. 반복 실행되는 loop·fixture 크기 확대 없음, 테스트 스위트 자체의 실행 시간에 유의미한 영향 없음.

## 점검했으나 이슈 없음

- **알고리즘 복잡도**: 반복문·재귀 없음, 전부 O(1) 필드 접근/스프레드. `buildTriggerCallbackUrl` 은 정규식 치환 2회 + 템플릿 리터럴 1회로 입력 길이에 선형(사실상 O(1) 수준의 짧은 문자열), 반복 호출로 누적되는 이차 패턴 아님.
- **N+1 쿼리/호출**: 호출부 전수 확인 결과(`create`/`update`/`remove`) 트리거 컬렉션을 순회하며 setup/teardown 을 호출하는 지점 없음. 문제 없음.
- **메모리 할당**: 대량 데이터 적재·누수 가능성 없음. 소규모 config 객체 스프레드뿐이며 새 provider 인스턴스는 Nest DI singleton scope 로 부트스트랩 시 1회만 생성된다.
- **캐싱**: `ConfigService.get('app.url')` 은 Nest `ConfigService` 내부 캐시된 값 반환 — 별도 캐싱 불필요. 두 호출부(`chat-channel-binder.service.ts`, `triggers.service.ts` 의 `rotateBotToken`)가 각자 `configService.get()` 을 호출하지만 둘 다 트리거 1건당 최대 1회이므로 문제 없음.
- **블로킹 I/O**: 모든 secret store/adapter/repository 호출이 `await` 로 처리됨. 동기 I/O 없음.
- **불필요한 연산 / 문자열 누적**: 이번 diff 에서 O(n²) 문자열 연결 패턴 없음.
- **데이터 구조**: `Repository<Trigger>`, config 객체 리터럴 모두 용도에 적합. 신규 provider 도 기존 협력자(4개 주입)를 그대로 재사용하는 얇은 위임 계층.
- **지연 로딩**: 즉시 필요하지 않은 리소스를 미리 적재하는 지점 없음. `adapter` 는 `channelAdapterRegistry.get()` 으로 필요 시점에만 조회.

## 뮤테이션 검증

이번 리뷰에서는 저장소 파일을 수정하지 않았다 — `git diff`/`git log -p`/`Read` 만 사용해 정적으로
대조했다. `git status --short` 로 잔여 변경 없음을 확인했다(아무것도 쓰지 않았으므로 애초에
잔여물이 생기지 않는다).

## 요약

이 diff 는 `TriggersService` 의 chat-channel 바인딩 로직을 신규 `ChatChannelBinderService`/
`buildTriggerCallbackUrl` 로 옮기는 순수 리팩터링이며, 이전 라운드(18_04_36) 이후 추가된 변경분
(신규 단위 테스트 2개, DI provider 등록, 인자 이름-바인딩 시그니처 변경)도 전부 런타임 성능에
영향이 없다. DB 접근 패턴·secret store 호출 횟수·알고리즘 복잡도가 이동 전후 동일하게 보존되어
있고(호출부 전수 확인 결과 트리거 1건당 1회, 반복문 내 호출 없음), 새로 도입된 성능 회귀는 없다.
secret store 쓰기 2건을 병렬화할 수 있는 기존 여지(INFO)만 사전 존재하는 후속 최적화 후보로
남는다.

## 위험도

NONE
