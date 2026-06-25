# 신규 식별자 충돌 검토 결과

## 발견사항

### INFO — `PresentationPayload` 이름 재사용: 의미 상충 없음 (의도된 일치)

- **target 신규 식별자**: `PresentationPayload` — diff 내 테스트 코드 (`presentation.test.ts`) 에서 describe 블록 제목 `"PresentationPayload (AI 에이전트 render_* 도구)"` 로 언급. `presentation.ts` 본문 주석에도 `PresentationPayload { type, toolCallId, renderedAt, payload }` 구조명으로 사용.
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` line 960: `PresentationPayload` 는 AI Agent `render_*` 의 wire 타입으로 공식 정의 (`type`, `toolCallId`, `renderedAt`, `payload`, `truncation?`).
  - `/Volumes/project/private/clemvion/codebase/frontend/src/lib/conversation/conversation-utils.ts` line 96: 동일 구조의 TypeScript `interface PresentationPayload`.
  - `/Volumes/project/private/clemvion/codebase/backend/src/shared/conversation-thread/conversation-thread.types.d.ts` line 12: 동일 구조.
- **상세**: diff 의 주석·테스트 제목이 참조하는 `PresentationPayload` 는 spec SoT 와 동일 개념(`{ type, toolCallId, renderedAt, payload }`)을 가리킨다. 충돌이 아니라 동일 식별자를 올바른 맥락으로 재사용한 것이다.
- **제안**: 충돌 없음. 현행 유지.

---

### INFO — `asEnvelope` 내부 함수명: 파일 외부 노출 없음

- **target 신규 식별자**: `asEnvelope` — `presentation.ts` 에 file-scoped 비공개 함수로 신규 도입 (`export` 없음).
- **기존 사용처**: `codebase/` 전체에서 `asEnvelope` 라는 이름의 심볼이 다른 모듈에 존재하지 않는다.
- **상세**: 모듈 내부 helper 이므로 외부 API 표면에 영향 없다. 충돌 없음.
- **제안**: 현행 유지.

---

### INFO — `PRESENTATION_KINDS` Set: 파일 외부 노출 없음

- **target 신규 식별자**: `PRESENTATION_KINDS = new Set<PresentationKind>(["carousel", "table", "chart", "template"])` — `presentation.ts` 내부 상수, `export` 없음.
- **기존 사용처**: 코드베이스 전체에 동일 이름의 심볼 없음.
- **상세**: 모듈 스코프 상수이며 `PresentationKind` 타입(`"carousel" | "table" | "chart" | "template"`)은 이미 해당 파일에 정의된 기존 타입이다. 새 Set 은 그 타입의 runtime guard 로만 사용된다. 충돌 없음.
- **제안**: 현행 유지.

---

### INFO — `Envelope` 타입 삭제: 내부 전용이었으므로 충돌 없음

- **삭제 대상 식별자**: `type Envelope` (`presentation.ts` 기존 비공개 타입 — diff 에서 제거됨).
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/lib/presentation.ts` 내부에만 사용 (`env` 변수 5곳). `export` 없어 외부 노출 없음.
- **상세**: 삭제 후 `asEnvelope()` 가 동일 역할을 대체한다. 외부 consumer 없으므로 breaking change 없다.
- **제안**: 현행 유지.

---

### INFO — `itemButtons` 필드: 기존 spec과 동일 의미로 사용

- **target 신규 식별자**: `config.itemButtons` 를 `asButtons(config.itemButtons)` 로 추출해 carousel item 버튼에 병합.
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/1-carousel.md` line 34, `spec/4-nodes/6-presentation/0-common.md` 다수 — `itemButtons` 는 "동적 아이템 공통 버튼" 으로 동일 의미로 기 정의됨.
- **상세**: 필드 의미가 spec SoT 와 일치한다. AI payload 경로에서 `payload.itemButtons` 를 `config.itemButtons` 로 펼치는 `asEnvelope` 처리도 동일 의미를 재사용한다. 충돌 없음.
- **제안**: 현행 유지.

---

## 요약

이번 diff (`codebase/channel-web-chat/src/lib/presentation.ts` + `presentation.test.ts`) 가 도입하는 신규 식별자(`asEnvelope`, `PRESENTATION_KINDS`)는 모두 모듈 내부 비공개 심볼이며, 코드베이스 전체에 동일 이름의 기존 심볼이 없다. 기존 공개 타입 `PresentationPayload` 를 테스트·주석에서 참조하는 방식도 spec SoT (`spec/4-nodes/3-ai/1-ai-agent.md §7.10`) 와 의미가 일치한다. `Envelope` 타입 삭제는 내부 전용이라 breaking change 가 없다. 요구사항 ID·API endpoint·이벤트명·ENV 변수·파일 경로 신규 도입은 없다. 식별자 충돌 관점에서 발견된 문제는 없다.

## 위험도

NONE
