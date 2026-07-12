---
title: Manual Trigger output.parameters 자동완성 enricher (표현식 힌트)
worktree: trigger-param-output-enricher-92985f
started: 2026-07-09
owner: developer
status: in-progress
spec_area: spec/4-nodes/7-trigger/1-manual-trigger.md
---

## 배경 / 동기

실사용자 워크플로("인천 날씨 알림")에서 AI Agent userPrompt 가
`{{$node["Manual Trigger"].config.parameters.region}}` 로 작성돼 **빈값**이
LLM 에 전달됐다. 원인: `config.parameters` 는 **정의 배열**(`Array<{name,...}>`)이라
`.region` 이 `undefined`. 실제 값은 `output.parameters`(이름 keyed 객체
`{region:"인천"}`)에 있다. spec §4/§5.1(line 27-29·110)이 두 shape 의 직교성을
명시(CONVENTIONS Principle 1.1)한다 — 즉 트리거는 **정상 동작**했고, 사용자가
경로를 잘못 쓴 것.

근인: Form·Table·Transform·InfoExtractor 노드는 config 선언 필드명을
`output.<...>` 자동완성으로 projection 하는 enricher
(`node-output-schema-enrichers.ts`)가 있는데, **Manual Trigger 에는 없다**. 그래서
에디터가 `output.parameters.<name>` 을 힌트하지 못해 사용자가 정의가 보이는
`config.parameters.<name>`(배열, 이름접근 불가)으로 유도됐다.

## 목표 (프론트엔드 전용 autocomplete 개선, 런타임/spec 변경 아님)

`enrichManualTriggerOutputSchema` 추가 — `config.parameters[].name` 을
`output.parameters.<name>` (타입은 param 의 `type` 으로 매핑)으로 projection 하여
`$node["Manual Trigger"].output.parameters.<name>` (및 직속 successor 의
`$input.parameters.<name>`) 이 실행 전에도 자동완성되게 한다. 기존 4개 enricher 와
동일 패턴·동일 안전장치. (`$params.<name>` 하위키 자동완성도 직속 successor 한정으로
본 enricher 가 채운 `inputSchema.parameters` 를 재사용한다 — 후속
[`trigger-params-autocomplete.md`](trigger-params-autocomplete.md) 에서 구현.)

## 수정 대상

- [x] `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts`
      — `enrichManualTriggerOutputSchema` + `MANUAL_TRIGGER_TYPE_MAP` 추가.
      `output.properties.parameters.properties.<name>` 에 projection.
- [x] `codebase/frontend/src/components/editor/expression/use-expression-context.ts`
      — 2개 호출부(`$input` fallback ~L192-197, `$node` output ~L248-250)에
      `else if (... === "manual_trigger")` 분기 추가 + import.
- [x] `codebase/frontend/src/components/editor/expression/__tests__/node-output-schema-enrichers.test.ts`
      — `describe("enrichManualTriggerOutputSchema")` 추가 (base 없음/undefined
      config/빈 배열/정상 projection/기존 props 병합/output 부재 fallthrough/
      unsafe name 배제/type 매핑).
- [x] **`spec/5-system/5-expression-language.md` §7.2** (consistency WARNING #1) —
      해당 spec `code:` glob(`.../expression/*.{ts,tsx}`)이 위 두 파일을 소유하므로
      본 변경은 이 spec 에 spec-linked. enricher 표에 `manual_trigger` 행 추가 +
      "4개"→"5개 노드 타입". **decision-free doc sync** (신규 Rationale 불요).

## 테스트

- [x] frontend unit: enricher 신규 describe (vitest) — 40 passed(신규 7)
- [x] (통합) use-expression-context 2 호출부에 manual_trigger 분기 — build 통과로 배선 확인

## 워크플로 체크

- [x] consistency-check --impl-prep spec/4-nodes/7-trigger/ — **BLOCK: NO** (5 checker, Critical 0; convention_compliance 위험도 LOW). "금번 작업은 구현 착수를 막을 컨벤션 이슈 없음" 명시. (SUMMARY·plan_coherence.md 는 FS-write flakiness 로 디스크 미기록 — journal 5 result 확인)
- [x] /ai-review — **RISK LOW / Critical 0 / Warning 5**. W1(문서 과잉주장)·W2(TYPE_MAP 중복)·W5(배선 통합테스트) fix, W3·W4(enricher DRY 리팩터) 후속 백로그. SUMMARY·RESOLUTION 기록(`review/code/2026/07/09/23_15_51/`)
- [x] 리뷰 fix 후 unit 재통과 (enrichers 40 + wiring 2 = 71 passed)
- [x] TEST WORKFLOW 최종 재수행: **lint PASS / unit PASS(48 파일) / build PASS / e2e PASS(247)** (화이트리스트상 `.ts` 포함 → 면제 불가, 전체 e2e 수행 — 백엔드 무변경 무회귀)
- [x] (spec code-glob 매칭) consistency-check --impl-done spec/5-system/ — **BLOCK: NO** (Critical 0). WARNING 1(관련 plan 체크박스 미반영)·INFO 3 전부 해소(§7.2 행 축약, node-output-redesign line 140 부분해소 주석, 후속 체크박스화). `rationale_continuity` 는 FS-write flakiness 로 직접 Agent 재실행 → **위험도 NONE**(닫힌 집합 제약 아님·값 아닌 이름만 투영이라 Principle 1.1 무위반).

## 후속 (비차단)
- [x] (spec, project-planner) `spec/4-nodes/7-trigger/0-common.md §3` 표의 `output: $params`
  축약 표기를 `output.parameters: $params` 로 명확화 (§3.2/§5.1 JSON 예시와 통일).
  사용자가 겪은 `config.parameters` vs `output.parameters` 혼동과 동일 계열의 문서 정밀성 이슈.
  (impl-prep + ai-review 양쪽 지적, pre-existing.) **완료**: §3 표(line 74) + 같은 오류를 공유하던
  §3.2 접근 경로(`$node["X"].output.<paramName>` → `output.parameters.<paramName>`)까지 §5.1 JSON 과 정합화.
- [x] (frontend, 후속) `$params.<name>` root shortcut 하위키 자동완성 — **해소** (2026-07-10,
  [`trigger-params-autocomplete.md`](trigger-params-autocomplete.md)): `ROOT_VARIABLES` 에 `$params` 추가 +
  `$params.` drill 핸들러(소스 = `$input.parameters`). [`node-output-redesign/manual-trigger.md`](node-output-redesign/manual-trigger.md) line 140 도 완전 해소로 갱신.
- [ ] (refactor, 후속) enricher DRY: 공용 `projectFieldsIntoSchema` 헬퍼 + `ENRICHERS`
  디스패치 테이블 (ai-review W3/W4). 기존 4개 enricher 동반 수정이라 별도 PR — 6번째
  enricher 추가 시점 트리거.

## 비고

- 순수 UX 힌트. 런타임 검증·엔진·백엔드 output shape 무변경. 트리거 output.parameters
  계약(§4/§5.1)은 기존 그대로 소비.
- **정정**(consistency WARNING #1): "spec 변경 불필요" 는 trigger 영역 한정 판단이었고,
  실제 소유 spec 은 `spec/5-system/5-expression-language.md §7.2`(enricher 표) — 그
  `code:` glob 이 수정 파일을 소유하므로 본 변경은 spec-linked. §7.2 표에
  `manual_trigger` 행을 본 PR 에서 동기화(위 수정 대상 참조).
- `config.parameters` 는 배열이므로 **일부러 projection 안 함** — 사용자를
  name-keyed `output.parameters` 로 유도하는 것이 목적.
