# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep`
대상: `plan/in-progress/web-chat-ai-presentation-render.md`

---

## 발견사항

충돌 항목 없음.

### [INFO] `asEnvelope` — 신규 내부 헬퍼, 기존 식별자와 무충돌

- target 신규 식별자: `asEnvelope(p)` (plan §수정 1항)
- 기존 사용처: `codebase/channel-web-chat/src/lib/presentation.ts` 내 `Envelope` 타입(line 64)과 `asRecord`, `asArray`, `asButtons` 등 내부 헬퍼만 존재. `asEnvelope`라는 이름은 동 파일 및 전체 codebase 어디에도 없음.
- 상세: `asEnvelope`은 `presentation.ts` 파일 모듈 내부에서만 사용될 private 헬퍼 함수로, 기존 export 집합(`classifyPresentation`, `toCarousel`, `toTable`, `toChart`, `toTemplate`, `isSafeUrl`)과 이름이 겹치지 않는다. 기존 `Envelope` 내부 타입과도 식별자가 다르다.
- 제안: 추가 조치 불필요.

### [INFO] `itemButtons` — 기존 carousel 도메인 용어와 동일, 동일 의미로 재사용

- target 신규 식별자: plan §수정 4항의 `itemButtons` (payload-level 공통 액션 버튼)
- 기존 사용처: `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts`, `carousel.handler.ts`, `render-tool-provider.ts`, `resolve-dynamic-ports.ts`, `button-slug.util.ts` 등 backend 전반에서 `config.itemButtons`를 "각 아이템에 공통 적용되는 버튼 배열"로 동일하게 사용 중.
- 상세: plan이 설명하는 `itemButtons` 의미("AI 카루셀의 모든 item 공통 액션 버튼")는 backend carousel 도메인이 이미 동일 의미로 사용하는 `config.itemButtons`와 정확히 일치한다. 의미 충돌이 아니라 동일 개념의 위젯 측 처리 추가다.
- 제안: 추가 조치 불필요.

### [INFO] `PresentationPayload` — 기존 타입 이름 재사용, 동일 의미

- target 신규 식별자: plan이 `PresentationPayload { type, toolCallId, renderedAt, payload }` shape으로 언급
- 기존 사용처: `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts:79`, `codebase/frontend/src/lib/conversation/conversation-utils.ts:96`, `render-tool-provider.ts:16` 등에서 동일 interface로 정의·사용됨.
- 상세: plan은 기존 `PresentationPayload` 타입을 새로 도입하는 것이 아니라, 위젯 코드가 기존 계약(`PresentationPayload`)을 올바르게 처리하지 못한 버그를 수정하는 것이다. 식별자 충돌 없음.
- 제안: 추가 조치 불필요.

### [INFO] `PresentationBlock` — 기존 컴포넌트 이름 재사용

- target 신규 식별자: plan §Root cause에서 "`PresentationBlock` default → 미렌더"로 언급
- 기존 사용처: `codebase/channel-web-chat/src/widget/components/presentations.tsx:45`에 `export function PresentationBlock`으로 이미 정의됨.
- 상세: plan이 `PresentationBlock`을 새로 도입하는 것이 아니라 기존 컴포넌트의 미렌더 버그를 언급한 것이다. 충돌 없음.
- 제안: 추가 조치 불필요.

---

## 요약

`plan/in-progress/web-chat-ai-presentation-render.md`가 도입하는 신규 식별자는 `asEnvelope` 내부 헬퍼 함수 하나뿐이며, 이 이름은 `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-ai-presentation-render-beb2be/codebase/channel-web-chat/src/lib/presentation.ts` 및 전체 codebase 어디에도 존재하지 않는다. 나머지 언급된 이름들(`PresentationPayload`, `PresentationBlock`, `itemButtons`, `classifyPresentation`, `toCarousel`, `toTable`, `toChart`, `toTemplate`)은 모두 기존에 동일 의미로 정의된 식별자를 참조하는 것으로, 충돌이 아니라 일관된 재사용이다. 요구사항 ID, API endpoint, 이벤트/메시지명, 환경변수, 설정키, 파일 경로 등 다른 충돌 관점에서도 본 plan은 신규 식별자를 도입하지 않는다.

---

## 위험도

NONE
