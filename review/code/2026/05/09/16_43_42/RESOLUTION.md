# Code Review 조치 결과

리뷰 일시: 2026-05-09 16:43
대상 커밋: `808c4c35` (Follow-up 1) + `a7fbfd78` (Follow-up 2)
조치 커밋: 본 RESOLUTION 과 함께 단일 refactor 커밋으로 묶음.

## Critical 조치

### C1 — `rendered` HTML 이 1MB cap 외부에서 생성되어 cap 무력화

**원인**: `carousel.handler.ts` / `table.handler.ts` 에서 `renderHtml(items|rows)` 호출이 `truncateArrayForOutput(...)` 보다 먼저 실행되어, items/rows 가 1MB 로 잘려도 `rendered` 는 전체 데이터셋의 HTML 을 그대로 포함했다. 6 × 200KB = 2.2MB 의 outputData 가 그대로 JSONB 에 적재될 수 있었다.

**조치**:
- `carousel.handler.ts` — `truncateArrayForOutput` 을 `renderHtml` 호출 직전에 옮겼고, `renderHtml(cappedItems.value, layout)` 으로 호출. 이 변경에 맞춰 `buttonItemMap` 도 `cappedItems.value` 기준으로 빌드 (잘린 item 에 대한 dangling button → index 매핑 방지).
- `table.handler.ts` — `truncateArrayForOutput` 을 `renderHtml` 호출 직전으로 이동, `renderHtml(resolvedColumns, columns, cappedRows.value)` 로 호출.
- 회귀 검증 테스트 추가 (carousel + table) — 잘린 item / row 의 title / idx 가 `rendered` HTML 에 포함되지 않음을 검증.

## Warning 조치

### W1 — `presentation/integration` 크로스 도메인 import (헬퍼 위치)

**조치**: `truncate-body.util.ts` → `nodes/core/truncate-output.util.ts` 로 `git mv` 로 이동 (history 보존). 이름도 `body` 만이 아닌 array cap 까지 포괄하도록 `truncate-output` 으로 변경. 모든 import 경로 갱신:
- `send-email.handler.ts` / `http-request.handler.ts` → `../../core/truncate-output.util.js`
- `carousel.handler.ts` / `table.handler.ts` → `../../core/truncate-output.util.js`
- `truncate-output.util.spec.ts` 자체 import 경로 정정.

### W2 — `conditions` vs `knowledgeBases` guard 불일치

**조치**: `buildMultiTurnConfigEcho` 에서 두 필드 모두 `Array.isArray(...) && length > 0` guard 로 통일. `conditions: []` / `knowledgeBases: []` 빈 배열은 echo 에서 제외 (initial / resumed waiting tick 의 `~854 / ~1213` 인라인 echo 와 동일 정책). `omits empty knowledgeBases / conditions arrays` 단위 테스트 1건 추가.

### W3 — `Record<string, unknown>` 으로 인한 타입 안전성 소실

**조치**: 두 핸들러에 raw multi-turn config 의 typed interface 추가하여 helper 내부의 unsafe cast 를 helper 진입점 단일 cast 로 축소.
- `ai-agent.handler.ts` — `RawAiAgentMultiTurnConfig` interface (mode/model/systemPrompt/userPrompt/responseFormat/maxTurns/maxToolCalls/knowledgeBases/conditions). `buildMultiTurnConfigEcho` 진입 시 `(rawConfig ?? {}) as RawAiAgentMultiTurnConfig` 1회 cast 후 타입 안전한 접근.
- `information-extractor.handler.ts` — `RawInformationExtractorMultiTurnConfig` interface (mode/model/outputSchema/instructions/examples/inputField/maxTurns/maxCollectionRetries). `multiTurnConfigEcho` 도 동일 패턴.

### W4 — `totalRows` 와 `rowsTotalCount` 이중 저장

**판단**: 의도적 — 의미가 다르므로 둘 다 유지.
- `totalRows` (기존): cap 적용 전 전체 데이터셋 크기 (post pageSize / sort). 이미 존재하던 필드로 다운스트림 호환성 유지.
- `rowsTotalCount` (신규): cap 발생 시에만 surface — `rowsTruncated: true` 와 함께 사용. Carousel 과 비대칭은 인정하지만 (Carousel 은 `itemsTotalCount` 도 cap 시에만 surface), 이는 `totalRows` 가 Table 고유의 기존 API 였기 때문.
- 코드 + spec 에 의도를 명시: `table.handler.ts:142` 주석 + `2-table.md §4` 에 "`rows.length !== totalRows` 만으로도 잘림을 감지할 수 있다" 추가.

### W5 — `truncateArrayForOutput` O(N log N) 직렬화 (binary search)

**조치**: 원소 단위 누적 방식으로 전환 — 각 element 를 1회 직렬화 후 byte 합산, 첫 초과 인덱스에서 break. 시간 복잡도 O(N) (정확히는 직렬화 cost 합), 공간은 element-by-element. cap 트리거 시나리오의 수 MB 단기 힙 할당 + GC 압력 제거. 기존 6개 단위 테스트 모두 통과.

### W6 — `hydrateState` 의 `rawConfig` 복원 미테스트

**조치**: `information-extractor.handler.spec.ts` 의 `processMultiTurnMessage` describe 블록에 `hydrateState round-trip preserves rawConfig` 테스트 추가. DB → engine → handler.processMultiTurnMessage(state) → hydrateState 경로에서 raw template 이 그대로 echo 되는지 검증.

### W7 — `config.model` 의미 silent breaking change

**조치**: spec 에 명시적 breaking change 경고 추가.
- `spec/4-nodes/3-ai/1-ai-agent.md` §7 머리에 `⚠ Breaking change (2026-05-09 Phase 1+follow-up)` 블록 추가 — multi-turn ended / condition-trigger 의 `config.model` 이 raw template 으로 변경됨, evaluated 값이 필요하면 `meta.model` 을 사용하라고 명시.

### W8 — JSDoc 의 `plan/` 경로 하드코딩 → 곧 구식

**조치**: `truncate-output.util.ts` 의 두 JSDoc 에서 `plan/in-progress/...` 경로 참조를 모두 제거 (`engine-raw-config-exposure.md`, `engine-raw-config-followups.md` 둘 다). 대신 cap 값과 결정 요지를 인라인 1줄로 압축. 추가로 CLAUDE.md "no multi-paragraph docstrings" 정책에 맞춰 다단 JSDoc 블록을 한두 줄 라인 코멘트로 축소 (INFO #5 정책 위반 동시 해결).

### W9 — Carousel dynamic 모드의 1MB cap 미검증

**조치**: `carousel.handler.spec.ts` 에 `truncates dynamic-mode items mapped from a runaway input source` 테스트 추가 — `mode: 'dynamic'`, `titleField: 'name'`, `descriptionField: 'body'` 로 200KB × 6 = 1.2MB 입력 시 truncation 동작 검증.

## INFO 조치

- **INFO #1** (AI Agent spec `mode` 누락) — §7 머리 정책 문장의 echo 필드 목록에 `mode` 추가.
- **INFO #5** (멀티라인 주석 정책 위반) — `truncate-output.util.ts` 의 다단 JSDoc 을 한 줄 라인 코멘트로 축소 (W8 와 함께 처리).
- **INFO #8** (`0-common.md` §4 가독성) — 단일 장문 → 5개 bullet 으로 분리.
- **INFO #10** (`userPrompt` / `responseFormat` echo 미테스트) — `ai-agent.handler.spec.ts` 의 multi-turn raw echo 테스트에 두 필드 추가, assertion 보강.
- **INFO #2** (`rawConfig ?? config` 폴백 분산), **INFO #4** (비배열 입력 의미론), **INFO #6** (`defined()` 패턴 불일치), **INFO #7** (rendered 완전성 미검증), **INFO #9** (rawConfig 보안) — INFO 등급. INFO #7 은 W9 회귀 테스트로 자연 커버됨. 나머지는 본 PR 범위에서 보류 (별도 follow-up 또는 의도적 차이).

## 검증

- `npx eslint "src/nodes/**/*.ts"` clean
- `npx jest` — **173 suites, 2924 tests pass** (Follow-up 2 직후 2919 → 본 RESOLUTION 으로 +5)
- `npm run build` clean
