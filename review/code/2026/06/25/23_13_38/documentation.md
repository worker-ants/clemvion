# 문서화(Documentation) 리뷰

## 발견사항

### `codebase/channel-web-chat/src/lib/presentation.ts`

- **[INFO]** `asEnvelope` 함수 JSDoc 품질 양호
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `asEnvelope` 함수 블록
  - 상세: `asEnvelope`에 두 shape(standalone envelope vs PresentationPayload) 차이, 두 출처의 spec 참조(`spec/7-channel-web-chat/1-widget-app §2`, `AI Agent §7.10`)까지 명시한 JSDoc이 있어 문서화 기준을 충족한다.
  - 제안: 현상 유지.

- **[INFO]** `toTemplate` JSDoc 헤더가 신규 동작(content fallback)과 미미하게 불일치
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `toTemplate` 함수 블록 헤더 주석 (`"output.rendered(string) 를 그대로 반환"`)
  - 상세: JSDoc 헤더는 "output.rendered(string) 를 그대로 반환"이라고만 설명하나, 실제 구현은 `output.rendered` 가 없을 때 `output.content` fallback을 추가했다. 함수 본문 인라인 주석("노드 template 은 `output.rendered`, AI render_template 의 payload 는 `content` 키를 쓴다")은 정확히 설명하지만 JSDoc 헤더는 갱신되지 않았다.
  - 제안: JSDoc 헤더를 `"output.rendered(string) 우선, 없으면 AI payload 의 content fallback."` 정도로 1줄 추가 갱신.

- **[INFO]** 파일 상단 주석이 신규 shape 반영 필요
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — 파일 상단 3줄 블록 주석
  - 상세: 현재 상단 주석은 `"presentations[i] 는 { config, output, meta, port?, status? } flat envelope — 명시 type 필드가 없을 수 있어 shape 으로 추론"` 이라고만 설명한다. PresentationPayload(`{ type, toolCallId, renderedAt, payload }`) shape이 추가된 이후 이 문장은 두 shape 중 하나만 설명하는 부분적으로 오래된 설명이 된다.
  - 제안: 상단 주석에 "또는 AI render_* 도구의 `{ type, toolCallId, payload }` PresentationPayload shape — `asEnvelope` 로 통일 정규화" 한 줄 추가.

- **[INFO]** `PRESENTATION_KINDS` 상수에 역할 주석 없음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `const PRESENTATION_KINDS = new Set<PresentationKind>(...)` 선언부
  - 상세: 이 Set의 역할(PresentationPayload fast-path에서 유효 종류 검증에 사용)이 코드에서는 명확하나, 독립 상수로 분리된 이유를 설명하는 주석이 없다. 미미한 수준.
  - 제안: 필요 시 `// AI PresentationPayload 의 유효 종류 집합 — classifyPresentation fast-path guard` 한 줄 추가.

### `codebase/channel-web-chat/src/lib/presentation.test.ts`

- **[INFO]** 테스트 describe 블록 주석이 픽스처 출처를 명시함
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` — `describe("PresentationPayload (AI 에이전트 render_* 도구)", ...)` 블록 내 주석
  - 상세: `// 실 SSE wire 캡처(execution.ai_message.presentations[0]) 축약 — top-level type + .payload 중첩.` 주석이 테스트 픽스처의 출처와 형태를 충분히 설명한다. 문서화 관점에서 적절하다.
  - 제안: 현상 유지.

- **[INFO]** 단일 it 블록에 두 converter(`toTable`/`toChart`)를 묶어 테스트
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` — `it("toTable/toChart — payload 에서 데이터 추출", ...)` 케이스
  - 상세: 두 converter를 하나의 it에 묶어 실패 시 어느 쪽이 깨졌는지 it-label만으로 구분 어렵다. 테스트가 코드 계약의 살아있는 문서 역할을 할 때 각 케이스를 분리하는 편이 명확하다.
  - 제안: `it("toTable — payload 에서 columns/rows 추출")`, `it("toChart — payload 에서 chartType/points 추출")` 로 분리 고려(강제성 없음, INFO 수준).

### `plan/in-progress/web-chat-ai-presentation-render.md`

- **[INFO]** 플랜 문서 내용·구조 양호
  - 위치: `plan/in-progress/web-chat-ai-presentation-render.md`
  - 상세: root cause·수정 목록·테스트 항목·주의사항이 단계적으로 명확히 기술되어 있으며, frontmatter의 `related_spec` 필드가 구현과 관련된 spec 문서를 올바르게 참조한다. 플랜 문서 관점에서 문서화 기준 충족.
  - 제안: 현상 유지.

- **[INFO]** 플랜의 "테스트" 절 마지막 항목이 조건부("가능 시") 미완수 여부 불명확
  - 위치: `plan/in-progress/web-chat-ai-presentation-render.md` — `# 테스트` 절 마지막 줄
  - 상세: `(가능 시 presentations.test.tsx 에 PresentationBlock(PresentationPayload) 렌더 1건.)` — 실제로 구현·커밋 되었는지 불명확. 플랜이 완료 후 `plan/complete/` 로 이동될 때 이 항목이 완료·미완료 여부를 정리해야 한다.
  - 제안: PR 완료 시점에 이 항목의 완료 여부를 플랜에 명시 후 complete 이동.

### 전반적 관점

- **[INFO]** CHANGELOG 없음 — 이 프로젝트에는 별도 CHANGELOG 파일이 없는 것으로 보이며, 커밋 메시지가 이력 역할을 한다. 커밋 메시지 자체가 root cause·수정 범위·테스트 결과를 모두 포함하여 이력 문서로서 충분하다.
- **[INFO]** README/API 문서 업데이트 불필요 — 이번 변경은 위젯 내부 shape 정규화 버그 수정으로, 공개 API 인터페이스·환경변수·설정 옵션 변경이 없으므로 외부 문서 업데이트는 해당 없다.
- **[INFO]** 새 환경변수·설정 옵션 없음 — 설정 문서 업데이트 불필요.

---

## 요약

문서화 품질은 전반적으로 양호하다. `asEnvelope` 신설 함수는 spec 참조와 두 shape의 차이를 충분히 설명하는 JSDoc을 갖추고 있으며, 인라인 주석도 핵심 분기 로직(PresentationPayload fast-path, content/rendered fallback)을 정확히 설명한다. 다만 `toTemplate` JSDoc 헤더와 파일 상단 모듈 주석이 신규 PresentationPayload shape를 반영하지 않아 미미한 불일치가 있다. 이 두 곳을 1줄씩 보완하면 문서가 구현과 완전히 정렬된다. 테스트 파일은 픽스처 출처 주석·describe 구조 모두 적절하며, 플랜 문서는 의도·근거·주의사항을 빠짐없이 기술하고 있다.

## 위험도

LOW
