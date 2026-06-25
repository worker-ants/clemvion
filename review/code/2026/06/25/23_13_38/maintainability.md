# 유지보수성(Maintainability) 리뷰

## 발견사항

### presentation.ts

- **[INFO]** `asEnvelope`의 dual-output(config=payload, output=payload) 설계가 암묵적 계약
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-ai-presentation-render-beb2be/codebase/channel-web-chat/src/lib/presentation.ts` L110–120
  - 상세: `asEnvelope`가 PresentationPayload 경로에서 `{ config: payload, output: payload }`로 같은 참조를 양쪽에 할당한다. JSDoc에 명시("to* 가 두 곳을 모두 읽으므로 안전")되어 있으나, 동일 객체를 두 역할로 사용한다는 점이 미래 유지보수자에게 혼란을 줄 수 있다. 기존 envelope 패턴(config와 output이 분리)과 대조된다.
  - 제안: 현재 JSDoc이 충분히 설명하고 있어 즉시 수정 필요 수준은 아니다. JSDoc에 "PresentationPayload 경로에서 config === output (same reference)" 임을 추가 명시하면 더 명확해진다.

- **[INFO]** `classifyPresentation` 내 `asRecord(p)` 중복 수행
  - 위치: `presentation.ts` L123–129
  - 상세: `classifyPresentation`은 `const o = asRecord(p)`를 먼저 수행한 뒤 PresentationPayload fast-path 실패 시 `asEnvelope(p)`를 호출한다. `asEnvelope` 내부에서도 `asRecord(p)`를 다시 수행한다. 동일 입력에 대한 경미한 중복이다.
  - 제안: 성능 영향은 미미하나, 가독성 개선을 원한다면 `asEnvelope(p)`를 먼저 호출하고 그 결과에서 `o`를 파생시키도록 리팩터링 가능. 현재 규모에서는 INFO 수준으로 수용 가능.

- **[INFO]** `toTemplate`의 `rendered` 결정 로직 — 삼항 체인 확장 가능성
  - 위치: `presentation.ts` L233–238
  - 상세: `output.rendered → output.content → ""` 순서의 중첩 삼항 체인은 두 소스일 때 적절하다. 미래에 세 번째 key가 추가된다면 중첩 깊이가 증가한다.
  - 제안: 현재 케이스는 두 가지뿐이고 주석("노드 template은 output.rendered, AI render_template의 payload는 content 키")이 이유를 설명하므로 현상 유지 수용 가능. 소스가 셋 이상으로 늘어날 경우 `[output.rendered, output.content].find(v => typeof v === "string") ?? ""` 패턴 고려.

- **[INFO]** `type Envelope` 삭제로 named type 문서화 손실
  - 위치: `presentation.ts` (diff 상 `type Envelope` 삭제)
  - 상세: 기존 `type Envelope = { config?: ...; output?: ... }`는 내부 정규화 shape을 명시적 타입으로 문서화하는 역할을 했다. 삭제 후 `asEnvelope` 반환 타입 인라인이 그 역할을 대신하나, 별도 named type으로 유지하면 호출부에서 타입 힌트가 더 명확해진다.
  - 제안: `type PresentationEnvelope = { config: Record<string, unknown>; output: Record<string, unknown> }` 로 named type 복원 고려. 기능 영향은 없으므로 필수 아님.

### presentation.test.ts

- **[WARNING]** `toTable`과 `toChart` 검증이 단일 `it` 블록에 혼합
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-ai-presentation-render-beb2be/codebase/channel-web-chat/src/lib/presentation.test.ts` L160–167 (`it("toTable/toChart — payload 에서 데이터 추출", ...)`)
  - 상세: 두 변환기(`toTable`, `toChart`)의 PresentationPayload 검증이 하나의 `it` 블록에 묶여 있다. 테스트 실패 시 어느 변환기가 문제인지 test runner 출력에서 즉시 구분하기 어렵다. 기존 `converters` describe 블록은 각 변환기별로 독립 `it`을 사용하는 일관된 패턴이다.
  - 제안: `it("toTable — payload 에서 데이터 추출", ...)` 와 `it("toChart — payload 에서 데이터 추출", ...)` 두 블록으로 분리할 것.

- **[INFO]** 회귀 케이스의 describe 귀속 위치가 분류상 혼선
  - 위치: `presentation.test.ts` L169–172 (`it("회귀 — 기존 {config,output} envelope 는 그대로 동작", ...)`)
  - 상세: 이 케이스는 기존 envelope 동작을 검증하므로 `PresentationPayload (AI 에이전트 render_* 도구)` describe보다 `converters` describe 또는 별도 `describe("regression")` 블록이 더 논리적이다. 현재 위치는 AI 에이전트 전용 describe 내에 있어 분류가 어색하다.
  - 제안: `converters` describe 하위로 이동하거나, 인접한 독립 `describe("회귀 — envelope 하위 호환")` 블록으로 분리 고려. 기능 오류는 아니므로 INFO.

- **[INFO]** 픽스처 `aiCarousel`의 `renderedAt`이 실 캡처 타임스탬프 하드코딩
  - 위치: `presentation.test.ts` L108
  - 상세: `renderedAt: "2026-06-25T13:45:53.305Z"` 는 특정 날짜를 하드코딩해 날짜 종속성처럼 보일 수 있다. 실 wire 캡처임을 설명하는 주석이 이미 있어 맥락은 충분하다.
  - 제안: 현 상태 수용 가능. 향후 픽스처 파일 분리 시 `fixtures/ai-carousel.json` 등으로 이동 고려.

---

## 요약

`presentation.ts`의 변경은 `asEnvelope` 헬퍼를 도입해 두 shape 정규화 책임을 단일 지점에 집중시켰고, 각 `to*` 함수에서 반복되던 3줄 env 추출 보일러플레이트를 제거했다. 함수 길이·중첩 깊이·코드 복잡도 모두 기존 대비 동등하거나 개선됐으며, JSDoc 주석이 의도를 충분히 설명하고 네이밍도 기존 패턴(`asRecord`, `asArray`, `asButtons`, `asEnvelope`)과 일관된다. 테스트 파일에서 `toTable/toChart`가 단일 `it` 블록에 묶인 것은 기존 패턴과 불일치하며 실패 진단을 어렵게 하는 WARNING 수준의 구조적 개선 여지가 있다. 전반적으로 유지보수성 관점에서 안정적인 변경이다.

## 위험도

LOW
