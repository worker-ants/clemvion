# 유지보수성(Maintainability) 리뷰

**검토 대상**: chat-channel template render outbound (CCH-AD-07 / CCH-MP-06)
**검토 일시**: 2026-05-25
**리뷰어**: maintainability sub-agent

---

## 발견사항

### [WARNING] `renderPresentationByType` 함수 중복 — Discord/Slack/Telegram 3개 renderer 에 사실상 동일한 함수가 복사
- 위치: `discord-message.renderer.ts`, `slack-message.renderer.ts`, `telegram-message.renderer.ts` 각각의 `renderPresentationByType` / `renderPresentationPayload` 함수
- 상세: 세 renderer 모두 `renderPresentationByType(type, nodeOutput, config)` 와 `renderPresentationPayload(presentation, config)` 를 거의 동일한 본문으로 정의한다. 차이는 `template` 분기에서 내부 텍스트 렌더링 함수(`chunkText` vs `renderText`)가 다를 뿐이고, `template` 의 두 경로 추출 로직 (`nodeOutput.rendered` / `nodeOutput.payload.rendered`) 은 세 파일이 완전히 동일하다. 현재 3개이지만 향후 Kakao·WhatsApp 등 어댑터가 추가될 경우 동일 코드가 더욱 증식된다. 버그 수정이나 fallback 정책 변경 시 모든 renderer 를 동시에 수정해야 하므로 누락 리스크가 크다.
- 제안: `renderPresentationByType` / `renderPresentationPayload` 의 공통 "payload 추출" 로직을 `chat-channel/shared/presentation-renderer.ts` 같은 shared helper 로 분리한다. 각 renderer 는 텍스트 렌더링 함수(`renderText` / `chunkText` 등)만 콜백·파라미터로 주입받아 공통 로직을 호출하도록 리팩토링한다.

---

### [WARNING] `template` 분기의 이중 경로 추출 로직 — 인라인 삼항 중첩으로 가독성 저하
- 위치: `telegram-message.renderer.ts` 내 `renderPresentationByType` case `'template':` (라인 845–851), `discord-message.renderer.ts` 동일 패턴 (라인 373–376), `slack-message.renderer.ts` 동일 패턴 (라인 497–500)
- 상세: `rendered` 값 추출 로직이 `typeof nodeOutput.rendered === 'string' ? ... : typeof (nodeOutput.payload as ...).rendered === 'string' ? ... : null` 형태의 2단 삼항 연산자로 작성되어 있다. 의도 파악을 위해 주석(`// 1) ... 2) ...`)이 필요하고, TypeScript 캐스팅(`as { rendered?: unknown } | undefined`)까지 중첩되어 한 눈에 이해하기 어렵다.
- 제안: 별도 헬퍼 함수 `extractRenderedText(nodeOutput: Record<string, unknown>): string | null` 로 추출하면 각 분기의 의미가 명확해진다.

---

### [WARNING] `renderAiMessage` 함수 중복 — Discord/Slack/Telegram 3개 renderer 에 동일 패턴 반복
- 위치: `discord-message.renderer.ts`, `slack-message.renderer.ts`, `telegram-message.renderer.ts` 각각의 `renderAiMessage` 함수
- 상세: `renderAiMessage` 의 구조 — "base text 렌더링 후 `presentations` 배열을 순회해 `renderPresentationPayload` 호출" — 가 세 파일 모두 동일하다. Telegram 이 `renderText`, Discord/Slack 이 `chunkText` 를 쓰는 차이만 있다. `renderPresentationByType` 중복과 맞물려 전체 프레임이 복사된 구조다.
- 제안: `renderPresentationByType` shared helper 분리 시 `renderAiMessage` 공통 뼈대도 함께 이동하거나, 함수형 어댑터 패턴(`renderTextFn` 파라미터를 받는 공통 `buildAiMessages`) 으로 통합한다.

---

### [INFO] `_config` 파라미터 언더스코어 prefix — Discord/Slack renderer 에서 사용되지 않음
- 위치: `discord-message.renderer.ts` `renderPresentationByType(_config: ChatChannelConfig)`, `slack-message.renderer.ts` 동일
- 상세: 미사용 파라미터를 `_` prefix 로 표시하는 관행은 코드베이스에서 일관되게 쓰이고 있으며, 이 자체는 문제가 없다. 다만 `renderPresentationByType` 가 공통 헬퍼로 추출될 경우 Telegram renderer 는 `config` 를 실제로 사용(`renderCarouselFallback(nodeOutput, config)`) 하므로, 통합 시 파라미터 정리가 필요하다.
- 제안: shared helper 추출 시 `config` 를 필수 파라미터로 통일한다.

---

### [INFO] `toEiaEvent` 내 `execution.node.completed` 분기의 인라인 타입 캐스팅 집중
- 위치: `chat-channel.dispatcher.ts` `case 'execution.node.completed':` (라인 230–261)
- 상세: `event.payload` 를 인라인 타입 리터럴(`as { nodeId?: unknown; nodeType?: unknown; ... }`)로 한 번, `output` 을 `as Record<string, unknown>` 으로 한 번, `p.meta` 를 `as Record<string, unknown>` 으로 한 번, `nodeType` 을 `as 'carousel' | 'table' | 'chart' | 'template'` 으로 한 번 — 총 4회 연속 캐스팅이 등장한다. 기존 다른 분기들도 비슷한 패턴이므로 코드베이스 스타일과 크게 다르지 않지만, 4회 캐스팅이 한 `case` 블록 안에 집중된 점은 이 분기의 입력 타입이 충분히 좁혀지지 않았음을 시사한다.
- 제안: `ExecutionChannelEvent` 의 `payload` 타입이 discriminated union 으로 정의 가능하다면 `execution.node.completed` variant 에 대한 payload 타입을 별도 인터페이스로 선언해 캐스팅을 줄이는 것을 중기 리팩토링 항목으로 고려한다. 현 시점에서 즉각 변경을 요구하는 수준은 아니다.

---

### [INFO] 테스트 내 `for...of` 루프와 `it.each` 혼용 — 스타일 일관성
- 위치: `chat-channel.dispatcher.spec.ts` 라인 105–119 (`비-presentation 노드` 테스트)
- 상세: 동일 describe 블록에서 복수 노드 타입 검증에 `it.each` (`carousel`/`table`/`chart` 3종, 라인 82–101)와 `for...of` 루프 (라인 105–119)를 혼용하고 있다. `it.each` 를 쓴 경우는 Jest 리포트에 케이스별 이름이 표시되지만, `for...of` 루프는 하나의 `it` 안에서 모든 타입을 순회하므로 실패 시 어떤 `nodeType` 이 문제인지 리포트에서 바로 알기 어렵다.
- 제안: `for...of` 루프 케이스도 `it.each` 패턴으로 통일하면 실패 진단이 용이해진다.

---

### [INFO] JSDoc 주석의 날짜 하드코딩 — 시간이 지나면 오해 소지
- 위치: `discord-message.renderer.ts` `renderAiMessage` JSDoc (`CCH-MP-01 보강 (2026-05-25)`), `slack-message.renderer.ts` 동일, `telegram-message.renderer.ts` `renderAiMessage` / `renderNodeCompleted` JSDoc
- 상세: 함수 JSDoc 에 `(2026-05-25)` 처럼 구현 날짜를 명시하는 패턴은 이 코드베이스에서 여러 곳에서 쓰이고 있으며(`chat-channel.dispatcher.spec.ts` 헤더 주석도 동일), 스타일 자체는 일관된다. 다만 향후 해당 함수가 수정될 때 날짜를 함께 갱신하지 않으면 잘못된 이력 정보를 제공하게 된다. git blame 이 동일한 정보를 보다 정확하게 제공한다.
- 제안: spec ID 참조(`CCH-MP-01`, SoT 링크)는 유지하고 날짜는 제거하는 방향을 팀 컨벤션으로 정립하는 것을 고려한다. 현 시점에서는 기존 패턴과 일관되므로 즉각 변경은 불필요하다.

---

## 요약

이번 변경의 핵심 유지보수성 위험은 `renderPresentationByType` / `renderPresentationPayload` / `renderAiMessage` 세 함수가 Discord · Slack · Telegram 렌더러에 걸쳐 거의 동일한 본문으로 복제된 것이다. 현재는 3개 어댑터이지만 어댑터가 추가될수록 fallback 정책 변경 시 누락 위험이 기하급수적으로 늘어난다. `chat-channel/shared/` 에 presentation 렌더링 공통 헬퍼를 분리하는 리팩토링이 다음 PR 에서 함께 이루어지거나 별도 tech-debt plan 으로 추적되어야 한다. `template` 분기의 2단 삼항 중첩도 가독성을 저해하며 헬퍼 분리 시 함께 해소할 수 있다. 나머지 발견사항들은 코드베이스 내 기존 패턴과 일관되거나 소규모 스타일 개선 사항으로, 기능 동작에는 영향이 없다.

---

## 위험도

MEDIUM
