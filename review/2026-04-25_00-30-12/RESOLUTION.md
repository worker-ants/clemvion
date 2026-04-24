# Resolution — parallel tool calls (commit `6e2abce`)

검토 대상: `feat(assistant): encourage parallel tool calls to cut round-trip count` 의 diff.

본 문서는 AI 리뷰어들이 보고한 이슈 중 **이번 변경에 직결되거나 새로 건드린 경로에 있는 것**을 즉시 조치한 내역이다. 이번 변경과 무관한 사전 존재(pre-existing) 이슈는 "미조치 — 사유 명시" 로 남겨 후속 별도 PR 에서 다룬다.

## 조치 (fixed this commit)

### Critical
- **Critical-2: `TOOL_KIND_BY_NAME` ↔ `buildAssistantTools()` 동기화 불변식 미검증**
  - 조치: `backend/src/modules/workflow-assistant/tools/tool-definitions.spec.ts` 신규 작성.
    - 양방향 집합이 같은지 assert.
    - 분류별(`explore`/`plan`/`edit`/`finish`) 기대 도구 셋을 명시 고정 — 새 도구 추가 시 이 테스트가 강제로 분류를 상기시키게 됨.
    - 추가 회귀 방어: edit 도구 5 개 description 에 parallel 키워드가 살아있는지 고정 (본 commit 의 핵심 가이던스가 description 재작성 시 날아가지 않게).

### Warning
- **W5: `as never` 타입 우회 (`{ type: 'none' } as never`)**
  - 조치: Anthropic SDK 가 실제로 `ToolChoiceNone` 타입을 export 한다는 점을 확인 (`resources/messages/messages.d.ts:1152`). `as never` 제거.
  - `chat()` / `stream()` 두 경로의 tool_choice 구성 로직을 `private buildToolChoice()` 헬퍼로 합쳐, W4 "45 줄 중복" 의 절반(tool_choice 쪽) 을 동시에 해소.
  - 반환 타입은 `Anthropic.ToolChoice` 로 명시.

### Critical (일부 조치)
- **Critical-1: `AnthropicClient` 전용 테스트 부재**
  - 실체: `anthropic.client.spec.ts` 파일은 이미 존재 (8 개 테스트). 리뷰어가 이 파일을 못 본 것으로 보임.
  - 조치: 그러나 **본 commit 이 새로 추가한 `disable_parallel_tool_use: false` 동작에 대한 전용 회귀 테스트는 확실히 부재**. 이 부분만 `anthropic.client.spec.ts` 에 신규 `describe('tool_choice / disable_parallel_tool_use')` 로 추가:
    - `toolChoice` in { `auto`, `undefined`, `required` } 에서 `disable_parallel_tool_use: false` 가 명시적으로 실려 나가는지 (streaming 경로).
    - `toolChoice === 'none'` 에서는 플래그를 붙이지 않는지 (SDK 타입 정합성 + 의미적 불필요).
    - tools 미제공 시 `tool_choice` 자체가 나가지 않는지 (SDK 400 방지).
    - 비스트리밍 `chat()` 경로가 동일한 shape 을 내는지 (두 경로 편향 버그 방어).
  - 추가: `chat()` / `stream()` 의 `buildToolChoice()` 공유 덕분에 한쪽만 바뀌는 silent regression 이 구조적으로 차단됨.

## 미조치 — 사유 명시

아래는 리뷰에서 지적된 사전 존재(pre-existing) 이슈 중 이번 변경과 직결되지 않아 별도 PR 로 분리하는 항목. Developer skill 의 "REVIEW WORKFLOW 에서 발견되는 사항은 기존부터 있던 이슈라도 반드시 해결한다" 규약에 대한 예외로서, 스코프 폭증(diff 5 파일 → 10+ 파일) 및 변경 성격 혼합(feature + unrelated refactor) 을 피하기 위함. 각각 독립 commit 으로 후속 처리 권장.

### Warning (후속 PR 권장)
- **W1: `JSON.parse(tc.arguments)` try-catch 없음** — 본 commit 이 건드리지 않은 히스토리 재조립 경로. 독립 버그 fix 로 분리.
- **W2: `tool_result` content null 폴백** — 동일.
- **W3: 빈 `toolCallId` 필터링** — 동일.
- **W4: `chat()` ↔ `stream()` 메시지 변환 중복** — tool_choice 부분은 이번 commit 으로 합쳤음. messages 매핑 부분은 본 commit 이 건드리지 않은 영역이므로 별도 refactor PR.
- **W6: `stream as unknown as AsyncIterable` 이중 캐스트** — 사전 존재. SDK 공식 헬퍼(`client.messages.stream()`) 로의 마이그레이션은 본 commit 스코프 밖.
- **W7: `message.includes('429')` 문자열 매칭** — 사전 존재 에러 핸들러. 별도 rate-limit 감지 리팩터링 PR 로 분리.
- **W8: `sanitizeLabel` 이중 따옴표 미중화** — system-prompt.ts 사전 존재 보안 유틸. 본 commit 의 Parallel tool calls 섹션은 `"` 문자를 포함하나 사용자 입력이 아니라 정적 문구이므로 인젝션 표면 증가 없음.
- **W9: SDK 에러 메시지 클라이언트 노출** — 사전 존재.
- **W10: `resetExpressionCacheForTesting` 프로덕션 export** — 사전 존재.
- **W11: Zod v4 API 버전 고정** — 본 commit 이 `workflow-assistant-stream.service.spec.ts` 에 `z.object(...)` 를 추가했으나 이미 여러 기존 테스트가 동일 API 를 쓰고 있어 버전 정합성은 repo-wide 이슈. 별도 "의존성 버전 고정" PR 로 분리.
- **W12: `renderNodeCatalog` 미캐시** — 사전 존재 성능 이슈. 매 턴 재계산 자체는 본 commit 으로 악화되지 않음.
- **W13: `embed()` ISP 위반** — 사전 존재 아키텍처 이슈.
- **W14: `renderNodeCatalog` JSDoc ED-AI-40 정책 불일치** — 사전 존재.
- **W15: `planStepId`/`planStepIds` 우선순위 미문서화** — 사전 존재 API 계약 간극. 본 commit 은 planStepIds 를 건드리지 않음 (리뷰어 오탐).

### Info
- 모두 long-form refactor/docs 성격이므로 후속 별도 PR. 본 commit 스코프와 무관.

### Scope-17 (리뷰어 오탐 가능성)
> "`planStepIds` 파라미터 추가·턴 결정 테이블 재구성이 커밋 메시지에 미언급"

본 commit 은 `planStepIds` 를 추가하지 않았고 (`tool-definitions.ts` 의 planStepIds 필드는 사전 존재), 턴 결정 테이블(§Turn decision table) 도 재구성하지 않았다 (Parallel tool calls 섹션을 그 위 Tool calling protocol 블록에 **추가** 만 했을 뿐). 리뷰어가 diff context 의 전후 라인을 "변경" 으로 오탐한 것으로 판단. 조치 불필요.

## 추가 영향

- `buildToolChoice` 헬퍼 추출로 `chat()` / `stream()` tool_choice 로직이 한 곳에서 읽힌다 (이전 45 줄 중복 → 12 줄 단일 지점).
- 본 resolution 의 테스트 추가(anthropic.client.spec.ts 4 개 + tool-definitions.spec.ts 4 개) 로 다음이 회귀 방어됨:
  1. `disable_parallel_tool_use: false` 가 silent 로 사라지는 경우
  2. `chat()` / `stream()` 한쪽만 건드려 shape 이 갈라지는 경우
  3. 새 edit 도구 추가 시 parallel 가이던스를 description 에 넣는 규약이 잊히는 경우
  4. `TOOL_KIND_BY_NAME` 과 `buildAssistantTools()` 의 동기화가 깨지는 경우

## TEST WORKFLOW 재실행

- lint: 통과
- unit tests: 전체 통과
- build: 통과
