# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 없음 — 순수 내부 리팩터링
  - 위치: `codebase/backend/src/modules/triggers/` (전체 diff), `git diff --name-only origin/main...HEAD` 로 확인
  - 상세: 이번 변경셋(`chat-channel-binder.service.ts`(신규) · `trigger-callback-url.ts`(신규) · `triggers.module.ts` · `triggers.service.ts` 및 관련 `*.spec.ts`)에는 `package.json`/`pnpm-lock.yaml` 변경이 전혀 없다(`git diff --stat origin/main...HEAD -- '**/package.json'` 결과 없음). `TriggersService` 의 `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` 로직을 각각 `ChatChannelBinderService`, `buildTriggerCallbackUrl` 로 옮긴 **내부 모듈 재배치**이며, import 는 모두 이미 존재하던 `@nestjs/common`·`@nestjs/config`·`@nestjs/typeorm`·`typeorm` 및 프로젝트 내부 모듈(`../chat-channel/*`, `../secret-store/*`)뿐이다. 버전 고정·라이선스·취약점·번들 크기 항목은 해당 없음(N/A).
  - 제안: 없음 — 그대로 유지.

- **[INFO]** 신규 내부 의존성 엣지: `TriggersService → ChatChannelBinderService` (단방향, 순환 없음)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 생성자(`private readonly chatChannelBinder: ChatChannelBinderService`) / `codebase/backend/src/modules/triggers/triggers.module.ts` (`providers: [TriggersService, ChatChannelBinderService, ...]`, `exports: [TriggersService]`)
  - 상세: `ChatChannelBinderService` 가 `TriggersModule` 의 provider 로 새로 추가되고 `export` 되지 않는다(모듈 내부 전용, 문서화된 의도와 일치). `ChatChannelBinderService` 자신은 `../chat-channel/channel-adapter.registry`·`../chat-channel/channel-listener.registry`·`../chat-channel/types`·`../secret-store/secret-resolver.service`·`../secret-store/secret-ref` 만 import 하며 `triggers.service.ts` 를 역참조하지 않는다. `chat-channel/chat-channel.module.ts` 쪽도 `Trigger` **엔티티 타입**만 import 할 뿐 `TriggersModule`/`TriggersService` 를 참조하지 않아, `#676`(`e827ed2a7`)에서 제거한 `chat-channel↔triggers` 순환(`forwardRef`)이 재도입되지 않았음을 확인했다(`grep -rn "triggers" codebase/backend/src/modules/chat-channel/*.module.ts` → 엔티티 import 1건뿐). 순환 의존 위험 없음.
  - 제안: 없음 — 현재 구조가 module doc comment(“의존 방향의 실측”)와 일치함을 확인했다.

- **[INFO]** DI 테스트 하네스 결합 확산 — 8개 spec 파일에 `ChatChannelBinderService` provider 추가 필요
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`createBaseProviders` 및 7개 개별 `describe` 블록), `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` (`makeService`)
  - 상세: `TriggersService` 생성자에 새 의존성이 추가되면서, `Test.createTestingModule` 로 `TriggersService` 를 직접 인스턴스화하는 모든 테스트 스위트가 `ChatChannelBinderService` 를 provider 목록에 추가해야만 컴파일/실행된다. 실제로 `triggers.service.spec.ts` 8곳, `triggers.web-chat.spec.ts` 1곳이 이 diff 에 포함돼 있다. 이는 새 기능 결함이 아니라 Nest DI 테스트 관례의 자연스러운 비용이며, 각 provider 가 실제 mock 이 아닌 실 클래스(`ChatChannelBinderService`)로 주입되므로 그 내부의 4개 협력자(repository/registry×2/secrets/config)도 함께 만족돼야 하는지 확인이 필요하다 — 다만 `chat-channel-binder.service.spec.ts` 는 별도의 `new ChatChannelBinderService(...)` 직접 생성 패턴을 쓰고, `triggers.service.spec.ts`/`triggers.web-chat.spec.ts` 쪽은 `ChatChannelBinderService` 를 provider 로만 등록하므로 Nest 가 해당 클래스의 나머지 의존성(`InjectRepository(Trigger)`, `ChannelAdapterRegistry`, `ChannelListenerRegistry`, `SecretResolverService`, `ConfigService`)도 테스트 모듈 안에서 해석 가능해야 한다. 기존 `createBaseProviders`/각 describe 가 이미 이 협력자들을 mock 으로 제공하고 있어(트리거 리포지토리·registry·secrets·config 모두 기존에 `TriggersService` 자체가 쓰던 것과 동일) 회귀 위험은 낮아 보이나, "동일 mock 인스턴스를 두 provider(TriggersService·ChatChannelBinderService)가 공유하는지"는 개별 describe 마다 실측 필요.
  - 제안: 정보 제공 목적 — 실패 시 원인은 대개 `ChatChannelBinderService` 생성자 의존성 미충족(`Nest can't resolve dependencies`)이므로, 향후 유사 리팩터 시 이 체크리스트(8개 spec 파일 동반 갱신)를 재사용할 것.

- **[INFO]** 알려진 로직 중복(callback URL 조립) — 통합 보류는 문서화됨, 신규 이슈 아님
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts` (JSDoc, “알려진 중복 — 통합 대상” 단락)
  - 상세: `buildTriggerCallbackUrl` 이 `common/utils/app-base-url.ts` 의 `getAppBaseUrl()` 과 동일한 fallback 리터럴·후행 슬래시 제거 로직을 갖는다. 파일 내 주석이 이 중복을 이미 인지하고 있고, 통합하지 않는 이유(`ConfigService` mock 을 통한 테스트 제어권 보존, DI 변경이 필요해 별 PR 로 분리)를 명시했다. 의존성 관점에서는 "표준 라이브러리/기존 의존성으로 대체 가능"에 해당하지만, 통합 시 트리거 단위 테스트 14블록의 통제 방식이 바뀌는 **DI 변경**이라 이번 PR(순수 이동) 스코프 밖으로 명시적으로 배제된 상태다. 새로 발견된 결함이 아니라 기존에 추적 중인 기술 부채의 재확인이다.
  - 제안: 없음 — 이미 별 PR 대상으로 문서화됨. 재지적 불필요.

## 요약

이번 변경은 `TriggersService` 에서 chat-channel adapter 바인딩(setup/teardown)과 callback URL 조립 로직을 각각 신규 내부 provider(`ChatChannelBinderService`)와 순수 함수(`buildTriggerCallbackUrl`)로 추출하는 순수 리팩터링으로, `package.json`/lockfile 변경이 전혀 없어 새 외부 의존성·버전 고정·라이선스·취약점·번들 크기 항목은 모두 해당 없음(N/A)이다. 유일하게 의미 있는 축은 내부 의존성 그래프 변경인데, `ChatChannelBinderService` 가 `TriggersModule` 비-export provider로 추가되고 `chat-channel/*` 를 단방향으로만 참조해 과거 제거된 `chat-channel↔triggers` 순환(`forwardRef`)이 재도입되지 않았음을 직접 확인했다. 부수 비용으로 8개 테스트 스위트가 새 provider 를 DI 컨테이너에 추가해야 했으나 이는 Nest 테스트 관례상 불가피하며 회귀 신호는 없다. 문서화된 `trigger-callback-url.ts`/`common/utils/app-base-url.ts` 간 로직 중복은 이미 추적 중인 기술 부채로 이번 리뷰에서 새로 플래그할 사안이 아니다.

## 위험도

NONE
