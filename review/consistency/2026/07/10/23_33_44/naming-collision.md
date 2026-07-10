# 신규 식별자 충돌 검토 — naming-collision

대상: `ai-turn-executor.ts`, `information-extractor.handler.spec.ts` (`git diff origin/main...HEAD -- codebase/`)

## 발견사항

0건. 아래 4개 관점 모두 충돌 없음을 확인.

### 1. `LlmCallContext` named import — shadowing / 컴파일 여부

- target 신규 식별자: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:10-13` 의
  `import { LlmService, type LlmCallContext } from '../../../modules/llm/llm.service';`
  및 `ai-turn-executor.ts:2606` 의 `const llmContext: LlmCallContext = { ... }`.
- 기존 정의: `codebase/backend/src/modules/llm/llm.service.ts:41` `export interface LlmCallContext { ... }` —
  이미 같은 인터페이스가 `information-extractor.handler.ts:10`, `text-classifier.handler.ts:200` 에서
  동일 의미(workflowId/executionId/nodeExecutionId attribution)로 import/사용 중.
- shadowing 여부: `git show origin/main:codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 로
  변경 전 파일을 확인한 결과 `LlmCallContext` 라는 심볼(타입/인터페이스/변수/클래스)이 전혀
  존재하지 않았다 (라인 1520 은 주석 언급뿐, 실제 `const llmContext = {...}` 는 명시 타입 없이
  구조적 추론에 의존). 파일 전체 재검색(`grep -n "LlmCallContext" ai-turn-executor.ts`) 결과도
  신규 import 문과 그 사용처 2곳(주석 제외) 뿐 — local scope 내 다른 선언과 충돌하지 않는다.
- 컴파일 확인: `cd codebase/backend && npx tsc --noEmit -p tsconfig.json` 실행 결과,
  `ai-turn-executor.ts(...)` 를 소스로 하는 에러는 0건이었다. 출력에 나타난 에러는 전부
  `ai-turn-executor.spec.ts` (해당 diff 의 변경 대상이 아닌 기존 파일) 의 사전 존재
  `TS2352 Conversion of type 'NodeHandlerOutput' to type 'Record<string, unknown>'` 9건 뿐이며,
  이번 diff 와 무관한 기존 에러이므로 지시대로 무시.
- 결론: 충돌 없음, 컴파일 정상.

### 2. 신규 테스트 제목 중복 여부

- target 신규 식별자: `information-extractor.handler.spec.ts:1027`
  `it('passes the same llmContext attribution to the retried (2nd) chat call', ...)`
- 같은 파일 내 전체 `it(` 제목을 전수 나열(`grep -n "it(\|describe("`)한 결과, 정확히 동일한
  제목이나 실질적으로 동일한 제목의 중복은 없다. 가장 유사한 기존 제목은
  `information-extractor.handler.spec.ts:921`
  `it('resume turn passes row PK nodeExecutionId + workflowId to llmService.chat (not the node definition id)', ...)`
  이나, 이는 **resume turn(재개 진입) 시나리오의 단발 chat 호출**을 검증하는 반면 신규 테스트는
  **collection-retry loop 내 2번째(재시도) chat 호출**의 attribution 을 검증 — 대상 시나리오가
  달라 제목·목적 모두 구분된다.
- 결론: 충돌 없음.

### 3. 신규 fixture id 충돌 여부

- target 신규 식별자: `information-extractor.handler.spec.ts:1045-1048`
  `exec-attr-2` / `wf-attr-2` / `node-def-2` / `nodeexec-row-2`
  (`retryState({ executionId: 'exec-attr-2', workflowId: 'wf-attr-2', nodeId: 'node-def-2', nodeExecutionId: 'nodeexec-row-2' })`)
- 기존 사용처: 같은 파일 `information-extractor.handler.spec.ts:930-933` 의
  `exec-attr-1` / `wf-attr-1` / `node-def-1` / `nodeexec-row-1` (`resume turn passes row PK...` 테스트).
- 상세: `-1` 접미 fixture 와 `-2` 접미 fixture 는 문자열 값 자체가 다르므로 값 충돌은 없다.
  또한 `retryState()` (spec.ts:970) 는 매 호출마다 새 object literal 을 반환하는 순수 헬퍼이고,
  `beforeEach` (spec.ts:95) 가 매 테스트마다 `mockLlmService.chat = jest.fn()...` 를 새로
  생성하므로 `mock.calls[0]`/`mock.calls[1]` 인덱싱이 테스트 간 격리되어 상호 오염 가능성이 없다.
  outer-scope `context: ExecutionContext` (spec.ts:112-113) 의 `executionId: 'exec-1'` 과도
  네이밍이 겹치지 않는다(`exec-1` vs `exec-attr-1/2`).
- 결론: 충돌 없음.

### 4. 신규 `review/` 디렉토리 경로 충돌 여부

- target 신규 경로: `review/consistency/2026/07/10/23_33_44/`
- 확인 결과 이 디렉토리는 동일 세션(consistency-check 실행)의 다른 검토자(sibling reviewer)가
  이미 `cross-spec.md` 를 기록해 둔 **같은 세션 타임스탬프 디렉토리**이며, 본 산출물
  (`naming-collision.md`)은 그 옆에 별도 파일로 추가되는 구조 — `.claude/docs/plan-lifecycle.md` /
  CLAUDE.md 의 "일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"
  컨벤션과 정확히 일치하며 기존 파일을 덮어쓰지 않는다.
- 결론: 충돌 없음.

## 요약

`ai-turn-executor.ts` 의 `LlmCallContext` named import 는 이미 `information-extractor.handler.ts`,
`text-classifier.handler.ts` 에서 동일 의미로 쓰이는 기존 인터페이스(`llm.service.ts:41`)를 그대로
재사용한 것으로, 파일 내 사전 선언과 충돌(shadowing)하지 않으며 `tsc --noEmit` 상 해당 파일 기인
에러도 없다. 신규 테스트 제목·fixture id(`exec-attr-2` 등)는 같은 파일의 기존 항목과 값·목적 모두
구분되어 상호 오염 여지가 없고, 신규 `review/` 산출물 경로도 기존 세션 디렉토리 컨벤션을 그대로
따른다. 4개 관점 전부 신규 식별자 충돌 없음.

## 위험도

NONE

STATUS: DONE
