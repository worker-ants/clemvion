# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 레이어 책임 재배치 — 올바른 방향의 근본 수정
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (검증 제거) / `codebase/backend/src/modules/chat-channel/types.ts` (`escapeControlText` 신설) / `providers/{telegram,slack,discord}/*.adapter.ts`
  - 상세: 종전 `LanguageHintsRawSendValidator`는 API 입력 검증(DTO) 레이어가 telegram MarkdownV2 렌더링 규칙이라는 프레젠테이션 관심사를 알아야 했던 leaky abstraction이었다(`provider === 'telegram'`이라는 provider-specific 분기가 DTO validator 안에 박혀 있었음). 이번 변경은 그 지식을 소유해야 할 계층 — provider adapter — 으로 옮겨 `escapeControlText`를 `ChatChannelAdapter` 인터페이스의 필수 멤버로 신설했다. `HooksService`(orchestration 레이어)는 escape 규칙을 모른 채 `adapter.escapeControlText(text)`만 호출하고, telegram/slack/discord 각 adapter가 자신의 렌더 표면 규칙을 캡슐화한다. DTO 레이어는 순수 구조적 검증(placeholder whitelist 등)만 남기고, provider별 escape 정책은 프레젠테이션 계층에 완전히 귀속됐다.
  - 제안: (없음 — 방향 자체가 SRP/레이어 분리 관점에서 개선)

- **[INFO]** 인터페이스 확장의 다형성 강제 — mandatory member로 컴파일타임 커버리지 보장
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` L509-L423, `providers/{telegram,slack,discord}/*.adapter.ts`, `channel-adapter.registry.spec.ts`(`FakeAdapter`)
  - 상세: `escapeControlText`를 `revokeBotToken?`/`openFormModal?`처럼 optional이 아니라 필수 멤버로 추가했다. 이 판단이 적절하다 — escape 정책은 (설령 discord처럼 identity라도) 모든 provider가 명시적으로 결정해야 하는 계약이고, `implements ChatChannelAdapter`로 구조적 타입 검사를 받는 모든 구현체(FakeAdapter 포함)가 컴파일 타임에 강제로 구현하게 된다. 종전 F-5 검증기는 `provider === 'telegram'`으로 특정 provider만 하드코딩 커버했던 것과 대조적으로, 새 설계는 향후 4번째 provider 추가 시 escape 정책 누락을 컴파일 에러로 막는다 — OCP/확장성 관점에서 유의미한 개선.
  - 제안: (없음)

- **[WARNING]** control-plane 직접 발송 escape 호출이 단일 choke point 없이 4곳에 분산 — 구조적 강제력 상실
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L357-370(`/help`), L897-911(`formValidationFailed`), L915-928(`formNextField`), L993-1006(`sendBestEffortNotice` 헬퍼 — `surfaceMismatch`/`executionStillRunning`/`groupChatRefusal`/`unsupportedMessageKind`가 경유)
  - 상세: `renderNode`를 우회해 `adapter.sendMessage`로 raw text를 직접 보내는 지점이 4곳인데, 이 중 1곳(`sendBestEffortNotice`)만 헬퍼 내부에서 `escapeControlText`를 강제하고 나머지 3곳(`/help`, `formValidationFailed`, `formNextField`)은 호출부마다 `adapter.escapeControlText(...)`를 개별적으로 inline 호출한다. 즉 "renderNode를 우회하는 모든 direct-send는 반드시 escape를 거친다"는 불변식이 코드 구조로 강제되지 않고, 각 호출부 작성자의 기억(convention)에 의존한다. 이번 PR 이전에는 F-5 DTO validator가 (레이어는 잘못됐지만) 모든 telegram 발송에 대한 단일 백스톱 역할을 했는데, 그 백스톱이 완전히 제거되면서 이제 "누락 시 잡아주는 안전망"이 사라졌다. 향후 8번째 control-plane 안내 문구가 추가되고 개발자가 `sendBestEffortNotice`를 쓰지 않고 `adapter.sendMessage`를 직접 호출하며 `escapeControlText`를 빠뜨리면, 이번에 고친 것과 동일한 cross-provider 리터럴 노출 버그가 조용히 재발하고 이를 잡아줄 컴파일/런타임 가드가 전혀 없다.
  - 제안: raw text kind의 direct-send를 모두 단일 private 헬퍼(예: 기존 `sendBestEffortNotice`를 확장하거나 `sendControlPlaneText(conversationKey, text, adapter, config, { swallow: boolean })` 같은 형태)로 강제 경유시켜, escape 호출이 헬퍼 내부에 캡슐화되고 호출부는 raw text만 넘기도록 리팩터링을 권장한다. 최소한 4개 호출부를 하나의 유틸 함수로 통일하면 "escape를 잊는" 클래스의 회귀를 원천 차단할 수 있다.

- **[INFO]** 인터페이스 내 sync/async 시그니처 불일치 (경미)
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `escapeControlText(text: string): string` vs 동일 인터페이스의 `renderNode(...): Promise<ChannelMessage[]>`
  - 상세: 스펙 문서(§1.1)는 `renderNode`도 "side-effect free / pure"로 명시하면서 시그니처는 `Promise<...>`로 통일해 왔다(향후 provider가 async 작업이 필요해질 가능성을 열어두는 기존 관례로 보임). 반면 신설된 `escapeControlText`는 `string → string` 순수 동기 시그니처다. 현재 3개 구현 모두 실제로 순수 동기 로직이라 문제는 없으나, 기존 인터페이스의 "pure해도 Promise로 통일" 관례와는 결이 다르다. 향후 provider별 escape 로직이 외부 설정/원격 사전을 필요로 하게 되면 breaking change가 필요해진다.
  - 제안: 현재 요구사항상 문제는 아니므로 강제 수정 불필요. 다만 인터페이스 전체의 시그니처 컨벤션(sync/async 혼용 허용 여부)을 `spec/conventions/chat-channel-adapter.md`에 한 줄 원칙으로 명시해 두면 향후 신규 멤버 추가 시 일관성 판단 기준이 된다.

- **[INFO]** 테스트 더블의 구조적 타입 강제력 불균일 (프로덕션 코드 영향 없음)
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` L762-789
  - 상세: `channel-adapter.registry.spec.ts`의 `FakeAdapter`는 `implements ChatChannelAdapter`로 구조적 타입 검사를 받아 `escapeControlText` 누락 시 컴파일 에러가 나지만(실제로 이번 diff에서 정상 추가됨), `form-mode.spec.ts`의 mock adapter는 `{ ... } as unknown as ChatChannelAdapter`로 강제 캐스팅해 컴파일러의 구조적 검사를 우회한다. 인터페이스에 새 필수 멤버가 추가돼도 이 mock은 조용히 통과한다 — 이 spec이 `escapeControlText`를 호출하는 경로를 테스트하지 않는 한 현재는 무해하지만, 인터페이스 완전성 보장이 테스트 스위트 전반에 균일하게 걸려 있지 않음을 보여준다.
  - 제안: 우선순위 낮음. 여유가 있으면 `as unknown as`를 걷어내고 필요한 필드만 구조적으로 채우는 방식으로 정리하면 향후 인터페이스 변경 시 회귀를 더 잘 잡는다.

- **[INFO]** 죽은 코드 정리가 깔끔함 — 순환/댕글링 참조 없음
  - 위치: `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts`(+`.spec.ts`) 삭제, `LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS` 삭제
  - 상세: 삭제된 심볼들에 대한 잔여 참조를 전수 검색한 결과 코드 어디에도 dangling import/reference가 없다(주석의 역사적 언급 1건 제외). `escapeMarkdownV2`/`escapeSlackMrkdwn`는 기존에 이미 각 renderer 모듈에서 `export`돼 있던 pure 함수를 재사용한 것으로, 이번 PR에서 새로 노출한 것이 아니며 로직 중복도 발생하지 않는다. renderer → adapter 방향의 단방향 의존이라 순환 의존성도 없다.
  - 제안: (없음)

## 요약

이번 변경은 telegram 전용 MarkdownV2 escape 지식이 DTO 검증 레이어에 박혀 있던 레이어 위반(F-5)을 근본적으로 해소하고, 그 책임을 마땅히 소유해야 할 provider adapter로 이관한 올바른 방향의 리팩터링이다. `ChatChannelAdapter.escapeControlText`를 필수 인터페이스 멤버로 설계해 모든 현재/미래 provider가 컴파일 타임에 escape 정책을 명시하도록 강제한 점, HooksService가 escape 규칙을 모른 채 추상화에만 의존하게 만든 점(DIP 준수), 죽은 코드를 잔여 참조 없이 깔끔히 제거한 점은 모두 높이 평가할 만하다. 다만 `renderNode`를 우회하는 4개의 direct-send 호출부 중 하나만 공통 헬퍼(`sendBestEffortNotice`)를 경유하고 나머지 3곳은 각자 inline으로 `escapeControlText`를 호출하는 구조라, F-5가 제공하던 "등록 시점 단일 백스톱"이 사라진 지금은 향후 신규 control-plane 안내 문구 추가 시 escape 누락을 막아줄 구조적 장치가 없다 — 이는 이번 PR이 고친 버그 클래스의 재발 가능성을 완전히 차단하지 못하는 잔여 리스크다.

## 위험도

LOW
