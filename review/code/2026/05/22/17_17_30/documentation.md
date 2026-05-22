# 문서화(Documentation) 코드 리뷰 결과

**대상**: AI Agent `render_*` Presentation Tool Family (파일 1–27)
**검토 일시**: 2026-05-22
**검토 관점**: 독스트링·JSDoc, README/사용자 가이드, API 문서, 주석 정확성, 인라인 주석, 변경 이력, 설정 문서, 예제 코드

---

## 발견사항

### [INFO] `render-tool-provider.ts` — 클래스 수준 독스트링 우수, 단 내부 헬퍼 3개 JSDoc 미작성
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` — `safeJsonParse()` (line 135), `approxByteSize()` (line 146), `applyOneMbCap()` (line 158)
- 상세: 클래스 수준·`overlayDefaults()`·`renderToolName()` 독스트링은 충실하다. `safeJsonParse`와 `approxByteSize`는 단순한 private 유틸이므로 생략이 허용 가능하나, `applyOneMbCap`은 tail-truncation 분기 조건이 복잡하고 `carousel.items`·`table.rows`에만 적용된다는 비직관적 제약을 가진다. JSDoc 한 줄("carousel.items / table.rows 에만 tail-truncate 적용; chart/template은 cap 초과 시 통째 drop")을 추가하면 유지보수성이 높아진다.
- 제안: `applyOneMbCap`에 간단한 JSDoc 주석 추가 (`chart`·`template`의 pass-through 없이 전체 drop 로직이 이 함수 밖에서 처리된다는 맥락).

### [INFO] `render-tool-provider.ts` — `buildTools()`·`execute()` 에 `@param`/`@returns` JSDoc 없음
- 위치: 같은 파일, line 225 (`buildTools`), line 242 (`execute`)
- 상세: `AgentToolProvider` 인터페이스 수준에서 계약이 기술되어 있으므로 구현체에서 중복이 불필요하다는 논리는 성립한다. 그러나 구현체에만 존재하는 비공통 로직 — 특히 `execute`의 hallucination guard (`toolDef not found`), single_turn form rejection, 1MB cap 후 전체 drop 조건 — 은 구현체 독스트링에 언급할 가치가 있다.
- 제안: 구현체 레벨에서 `execute`에 "Handles hallucinated tool calls (not in presentationTools) as schema_violation" 수준의 설명 한 줄 추가.

### [WARNING] `ai-agent.handler.ts` — `render_form` phase 2b placeholder가 문서화 없이 코드에 잔존
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`, line 1724–1735
- 상세: `render_form` blocking 흐름이 "phase 2b"로 미구현 상태로 남아 있고 logger.warn + schema violation fallback으로 처리된다. 이 사실이 코드 내 주석으로만 표시되어 있고, 사용자 가이드(`ai.mdx`, `ai.en.mdx`)의 `render_form` interactive 설명과 일치하지 않는다. 사용자 가이드는 `render_form`이 Multi Turn 모드에서 폼을 표시하고 제출을 대기한다고 설명하지만, 현재 구현에서는 해당 흐름이 실행되지 않고 schema violation으로 강등된다. 이는 문서-코드 불일치이다.
- 제안: 두 가지 중 하나 선택: (a) 사용자 가이드에 "render_form interactive mode는 향후 릴리스에서 지원 예정 — 현재는 single_turn과 동일하게 silent drop" Callout을 추가, 또는 (b) phase 2b를 이번 PR 범위로 완성. 최소한 `ai.mdx`/`ai.en.mdx`의 `render_form` 설명에 현재 구현 상태를 반영해야 한다.

### [INFO] `conversation-utils.ts` (프론트엔드) — `PresentationPayload`·`PresentationType` 인터페이스에 JSDoc 필드 설명 누락
- 위치: `/codebase/frontend/src/lib/conversation/conversation-utils.ts`, line 1474–1493
- 상세: 백엔드 `conversation-thread.types.ts`의 동일 인터페이스는 각 필드에 JSDoc이 작성되어 있다 (`toolCallId`는 join key 설명, `renderedAt`는 ISO 8601 설명, `payload`는 schema 재사용 설명, `truncation`은 적용 조건 설명). 프론트엔드 복사본에는 타입 선언만 있고 필드 주석이 전혀 없어 양쪽의 문서 품질이 비대칭이다.
- 제안: 프론트엔드 `PresentationPayload`에 최소한 `toolCallId`(join key)와 `truncation`(조건부) 필드에 단일 라인 JSDoc 추가.

### [INFO] `execution-store.ts` — re-export 이유 주석이 있으나 `import type` 중복이 명확하지 않음
- 위치: `/codebase/frontend/src/lib/stores/execution-store.ts`, line 1603–1612
- 상세: `export type { ... } from ...`과 `import type { PresentationPayload } from ...`이 같은 파일에서 동시에 이루어진다. 주석("Re-exported from ... so legacy imports resolve here")이 있어 의도는 전달되나, 왜 `ConversationItem` 내부에서 직접 `conversation-utils`를 import하지 않고 이 파일에 re-export를 두었는지 동기가 불명확하다. "legacy imports"의 구체적인 소비자가 무엇인지 명시하면 향후 제거 시 영향 범위를 파악하기 쉽다.
- 제안: 주석에 "legacy imports: execution-store 에서 PresentationPayload 를 직접 import 하는 외부 코드가 있을 경우를 위한 forwarding; 없으면 제거 가능" 수준의 설명 추가.

### [INFO] `assistant-presentations-block.tsx` — `FormSubmittedContent` fallback 주석은 충실하나 phase 2b 미구현 언급이 UI와 불일치
- 위치: `/codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx`, line 1067–1071
- 상세: `render_form` 케이스에서 `FormSubmittedContent` fallback을 사용하고, "phase 2b" 설명 주석이 있다. 이는 핸들러 쪽의 미구현 상태를 UI 레이어에서도 명시하는 일관된 접근이다. 다만 `FormSubmittedContent`는 제출 완료 데이터를 렌더하는 컴포넌트인데, `render_form`이 blocking 되지 않는 현재 구현에서 이 분기에 도달하는 실제 시나리오가 없다. 주석에 "이 분기는 현재 도달 불가 — phase 2b 이후 활성화"를 명시하면 dead code 오해를 방지할 수 있다.
- 제안: 주석을 "Currently unreachable — render_form blocking is pending phase 2b; this fallback becomes active when the handler emits a completed form payload"로 강화.

### [INFO] `ai.mdx`·`ai.en.mdx` 사용자 가이드 — 예제 코드가 정적이며 `defaults` 구조에 대한 설명 부족
- 위치: `/codebase/frontend/src/content/docs/02-nodes/ai.mdx` (line 1289–1297), `ai.en.mdx` (line 1213–1221)
- 상세: 제공된 예제 코드는 `defaults`에 `columns`를 사용하는 table 예시 하나만 있다. `defaults` overlay가 deep-merge이며 defaults 값이 LLM 생성 값보다 우선한다는 핵심 동작이 텍스트로 설명되어 있으나, chart/carousel/form 각각에 대한 `defaults` 실용 예시가 없다.
- 제안: 한 가지 추가 예시(carousel의 `defaults: { layout: 'card' }` 등) 또는 `defaults` 우선순위를 보여주는 예시를 추가하면 사용자 이해에 도움이 된다. 필수는 아니나 권장.

### [INFO] `presentation.mdx`·`presentation.en.mdx` — "AI 도구 모드" 섹션에 예제 코드 없음
- 위치: `/codebase/frontend/src/content/docs/02-nodes/presentation.mdx` (line 1363–1377), `presentation.en.mdx` (line 1327–1339)
- 상세: 해당 섹션은 cross-reference 역할로 간결하게 작성되어 있으며, ai.mdx로의 링크가 있다. 현재 수준으로도 충분하나, `defaults` overlay 규칙의 실제 적용 예시를 한 줄도 포함하지 않는다. 섹션 목적이 "상세는 AI 노드 문서 참조"이므로 현재 구조는 적절하다고 판단.
- 제안: 현행 유지. 개선 필요 없음.

### [INFO] `plan/in-progress/ai-presentation-tools.md` — §4.1 미완료 항목이 문서에 잔존
- 위치: `/plan/in-progress/ai-presentation-tools.md`, §4.1 체크리스트 (line 1739–1749)
- 상세: `spec/conventions/conversation-thread.md §1.2`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/node-output.md §4.5` 갱신이 체크 해제 상태(`[ ]`)로 남아 있다. 이는 현재 PR의 구현이 spec과 부분적으로 미정합 상태임을 나타낸다. plan 자체에 TODO가 명확히 표시되어 있으므로 plan 문서 관점에서는 정직하게 기록된 것이다. 단, code reviewer 관점에서 이 미완료 spec 항목들은 코드의 `presentations` 필드가 `conversation-thread.md §1.2`에 아직 공식화되지 않았음을 의미한다.
- 제안: 미완료 spec 갱신이 현재 PR의 범위인지 다음 PR의 범위인지 plan 문서에 명시하고, 해당 spec이 갱신되기 전에 코드가 병합되면 spec-code drift가 발생함을 주의.

### [INFO] `ai-agent.schema.ts` — `presentationToolDefSchema` 내부 필드에 JSDoc 있으나 `PRESENTATION_TOOL_TYPES` 상수에 단독 주석 없음
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`, line 226–232
- 상세: `PRESENTATION_TOOL_TYPES` 배열 위에 붙은 블록 주석은 클래스 수준 설명으로 읽히며, 상수 자체보다는 그 위 섹션 전체를 설명한다. 타입 정의와 스키마가 동일 블록에 있어 분리가 되어 있지 않다. 현행 주석 품질은 문제 없으나 구조를 분리하면 명확해진다.
- 제안: 현행 유지 허용.

### [INFO] 변경 이력(CHANGELOG) 갱신 필요성 검토
- 위치: 프로젝트 루트
- 상세: 이 프로젝트에서 별도 CHANGELOG 파일의 존재 여부를 확인하지 않았으나, `plan/in-progress/ai-presentation-tools.md`가 변경 이력 역할을 겸하고 있고, 사용자 가이드 MDX가 in-app으로 제공된다. 독립적인 CHANGELOG가 없거나 없어도 되는 프로젝트 구조라면 현행 유지가 적절하다.
- 제안: CHANGELOG가 존재한다면 `presentationTools` 설정 항목 신설을 기재할 것.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 높은 수준이다. 클래스·인터페이스 수준의 블록 주석이 충실하고, 사용자 가이드(MDX)가 KO·EN 동시 갱신되었으며, 예제 코드와 FieldTable이 포함되어 있다. 주요 경고 사항은 하나로, 사용자 가이드에서 `render_form`이 Multi Turn 모드에서 완전히 동작하는 것처럼 설명되어 있으나 실제 구현에서 `render_form` blocking 흐름이 "phase 2b" 미구현 상태로 schema violation으로 강등되므로 문서와 코드 동작 사이에 불일치가 있다. 그 외에는 프론트엔드 `PresentationPayload` 인터페이스에 백엔드 대비 필드 주석이 빈약하고, `applyOneMbCap`의 chart/template 전체 drop 분기에 설명 주석이 없으며, plan 체크리스트의 미완료 spec 갱신 항목들이 spec-code 부분 drift를 내포하고 있다.

---

## 위험도

**LOW**

> 핵심 구현·인터페이스 주석은 충실하고 사용자 가이드도 추가되었다. 유일한 WARNING은 `render_form` phase 2b 미구현에 따른 가이드-코드 불일치이며, 이것이 사용자 혼란을 일으킬 수 있으나 기능 오작동은 아니다. 나머지 발견사항은 모두 INFO 수준 보완 사항이다.
