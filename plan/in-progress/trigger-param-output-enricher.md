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
`$node["Manual Trigger"].output.parameters.<name>` / `$params.<name>` 이 실행 전에도
자동완성되게 한다. 기존 4개 enricher 와 동일 패턴·동일 안전장치.

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
- [x] TEST: lint PASS / unit PASS(40) / build PASS(frontend, 부트스트랩 후). e2e: 프론트 autocomplete 전용·런타임 무변경 → 면제 후보(화이트리스트 확인)
- [ ] /ai-review + SUMMARY/RESOLUTION
- [ ] (spec code-glob 매칭 시) consistency-check --impl-done

## 후속 (spec 문서, 비차단 — project-planner)
- convention_compliance WARNING: `spec/4-nodes/7-trigger/0-common.md §3` 표의 `output: $params`
  축약 표기를 `output.parameters: $params` 로 명확화 (§3.2/§5.1 JSON 예시와 통일).
  사용자가 겪은 `config.parameters` vs `output.parameters` 혼동과 동일 계열의 문서 정밀성 이슈.

## 비고

- 순수 UX 힌트. 런타임 검증·엔진·백엔드 output shape 무변경. 트리거 output.parameters
  계약(§4/§5.1)은 기존 그대로 소비.
- **정정**(consistency WARNING #1): "spec 변경 불필요" 는 trigger 영역 한정 판단이었고,
  실제 소유 spec 은 `spec/5-system/5-expression-language.md §7.2`(enricher 표) — 그
  `code:` glob 이 수정 파일을 소유하므로 본 변경은 spec-linked. §7.2 표에
  `manual_trigger` 행을 본 PR 에서 동기화(위 수정 대상 참조).
- `config.parameters` 는 배열이므로 **일부러 projection 안 함** — 사용자를
  name-keyed `output.parameters` 로 유도하는 것이 목적.
