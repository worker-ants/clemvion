# Rationale 연속성 검토 결과

## 사전 메모 — payload 결함 및 대체 조사 경로

`prompt_file` 의 "Target 문서" 페이로드는 `spec/conventions/` 를 alphabetic 순회하며 번들링하다가
`cafe24-api-catalog/**` (222개 field-level 파일)의 대용량 덤프에 예산이 소진되어, 실제 이번 작업의
target 인 `spec/conventions/interaction-type-registry.md` 와 변경 대상 코드 파일에 도달하지 못하고
`category/autodisplay.md` 중간에서 truncate 됐다 (`... (truncated due to size limit) ...`, payload
line 1656). 이어지는 "관련 Rationale 발췌" 절도 `spec/2-navigation/*` 등 무관 문서 위주로 채워져 있고
`5-system/1-auth.md`·`data-flow/12-workspace.md`·`data-flow/1-audit.md`·`cafe24-api-metadata.md`
등 실제로 target 이 인용하는 Rationale 소스는 빠져 있다.

이 결함은 신규가 아니라 이미 알려진 harness known failure다 —
`plan/in-progress/interaction-type-guard-comment-false-negative.md` §후속 항목
"[harness, 비차단] impl-done INFO #1·#2 — consistency 번들러가 `cafe24-api-catalog/**` 대용량 덤프에
밀려 target spec 본문을 누락하는 문제" 로 이미 기록·비차단 처리된 사안이다.

이에 따라 checker 자체 우회로, worktree 파일시스템에서 실제 target 을 직접 조사했다:

- `git diff` → 실제 변경분: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`
  (working tree, uncommitted) — JSDoc/주석 3곳 "grep 가드" → "AST 가드" 로 표현 정정.
- 연관 plan: `plan/in-progress/interaction-type-guard-comment-false-negative.md`
  (frontmatter `spec_impact: spec/conventions/interaction-type-registry.md`) — 후속 체크리스트
  `[developer, 선택] lib/conversation/interaction-type-registry.ts 상단 JSDoc · IS_MULTI_TURN_INTERACTION
  위 주석의 "grep 가드" 표현 → "AST 가드" 정정 (/ai-review INFO #1)` 항목과 정확히 일치.
- 실제 SoT spec: `spec/conventions/interaction-type-registry.md` §1.2 rule 3 · §2.1 · §5 —
  2026-07-18 커밋(`22cc48ef3`)으로 이미 "AST 가드"/"AST(코드 리터럴) 스캔" 용어로 전면 정정 완료
  (plan 체크리스트 "[해소 2026-07-18]" 항목, `/consistency-check --spec` BLOCK: NO 확인됨).
- 실제 가드 구현: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
  — `ts.createSourceFile` + `ts.forEachChild` 로 AST 순회하며 `StringLiteral`/
  `NoSubstitutionTemplateLiteral` 노드만 수집(`collectCodeStringLiterals`). 정규식 grep 이 아니라
  실제로 AST 파서를 쓰고 있음을 코드로 확인 — 즉 이번 코멘트 정정은 "사실과 다른 용어를 사실에
  맞는 용어로" 고치는 것이며 사실 자체의 변경은 없다.

## 발견사항

없음.

target diff(`interaction-type-registry.ts` 주석 3곳, "grep 가드"→"AST 가드")는:

1. **기각된 대안의 재도입 아님** — plan `설계 결정` 절이 기각한 대안은 (a) 인용부호 종류만 좁히는
   접근, (b) `=== "value"` / `case "value":` 우선 매칭 방식이다. 이번 diff 는 이 중 어느 것도
   재도입하지 않는다 — 순수 주석 문구 교체이며 가드 로직(코드) 자체는 무변경.
2. **합의된 원칙 위반 아님** — spec §5 Rationale 이 이미 "AST 가드"를 채택 메커니즘으로 확정했고
   (2026-07-18 spec 정정 커밋으로 §1.2/§2.1/§5 전체가 이 용어로 수렴), 이번 diff 는 그 확정된
   용어에 코드 주석을 뒤늦게 맞추는 것 — 원칙과 같은 방향.
3. **결정의 무근거 번복 아님** — 새 결정을 내리는 것이 아니라 기존 spec Rationale 을 그대로
   코드 주석에 반영하는 동기화 작업. 별도 신규 Rationale 이 필요한 종류의 변경이 아니다.
4. **암묵적 가정 충돌 아님** — invariant·계약·매트릭스·enum 목록 어느 것도 건드리지 않는다.

부가로 확인한 사실(발견사항으로 올리지 않는 이유 포함):

- `spec/conventions/interaction-type-registry.md` frontmatter `code:` 목록에
  `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 자체가 없다 (본문 §5 에서는
  이 파일을 SoT 모듈로 명시 인용함에도). 이는 diff 이전부터 존재하던 pre-existing 상태이며 이번
  변경이 유발/악화한 drift 가 아니고, Rationale 연속성(기각 대안 재도입·원칙 위반·무근거 번복·
  invariant 충돌) 범주에도 해당하지 않는다 — spec-impl-evidence coverage 축의 사안이라 본 리뷰
  범위 밖으로 판단, 별도 게이트(spec-coverage)에 위임.

## 요약

전달된 payload 는 alphabetic 번들링 중 `cafe24-api-catalog/**` 대용량 덤프에 밀려 실제 target
(`interaction-type-registry.ts`/`interaction-type-registry.md`)에 도달하지 못한 채 truncate 된
known harness 결함(해당 plan 파일에 이미 비차단으로 기록됨)이 재현된 상태였다. 파일시스템에서 직접
확인한 실제 diff 는 "grep 가드" → "AST 가드" 주석 3곳 wording 정정뿐이며, 이는 spec
`interaction-type-registry.md` §5 Rationale 이 이미 확정한 메커니즘 명칭에 코드 주석을 뒤늦게
맞추는 것이고, 실제 가드 구현(`ts.createSourceFile` AST 순회)과도 일치한다. 기각된 대안 재도입,
합의 원칙 위반, 무근거 결정 번복, invariant 우회 중 어느 것도 해당하지 않는다.

## 위험도

NONE
