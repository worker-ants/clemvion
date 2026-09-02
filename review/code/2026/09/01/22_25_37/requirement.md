# 요구사항(Requirement) 리뷰 — easy-a-harness-hygiene

## 리뷰 범위 요약

이 changeset 은 (1) `plan_guard.py` 체크박스 탐지 정규식이 blockquote 접두를 못 넘던 결함 수정
+ 회귀 테스트, (2) `plan-lifecycle.md` 에 "이동 문서 자신의 outgoing 링크 재계산" 절차 신설,
(3) `plan/**`·`spec/**` 마크다운의 도구 아티팩트 태그(`</content>` 등) 잔재 재발 감지 가드
신설 + 실제 잔재 제거, (4) `spec-links.test.ts` 에 멀티라인 링크 통합-경로 회귀 테스트 추가,
(5) 여러 plan 파일의 체크박스/링크 위생 정리, (6) `spec/conventions/error-codes.md`
§Overview 에 `EngineErrorCode` surface 병기(6라운드 `--spec` consistency-check 산출물 포함)로
구성된다. 실제 코드/스펙 diff 는 6개 파일(`plan-lifecycle.md`, `plan_guard.py`,
`test_plan_guard.py`, `spec-links.test.ts`, `stray-tool-tags.test.ts`(신규),
`error-codes.md`)이고 나머지는 plan 위생 정리 및 `review/consistency/**` 세션 산출물(과거
정책상 보존 대상)이다.

## 검증 수행 내역

- `python3 -m pytest .claude/tests/test_plan_guard.py -q` → 36 passed, 15 subtests passed.
- `npx vitest run spec-links.test.ts stray-tool-tags.test.ts` → 2 files / 33 tests passed.
- `npx vitest run plan-frontmatter.test.ts spec-plan-completion.test.ts` → 1148 tests passed
  (신규 `plan/complete/spec-draft-error-code-two-surfaces.md` 의 frontmatter/`spec_impact`
  Gate C 통과 확인).
- `grep -rn '^\s*</\?\(content|invoke|parameter|function_calls|antml\)\b[^>]*>\s*$' plan spec`
  → 0건 (신규 가드가 통과할 실제 상태 확인, vacuous 아님 — `it.each` 탐지 양성 케이스가 별도로
  regex 발화를 고정).
- `.claude/docs/plan-lifecycle.md` 신설 문구가 인용하는 `findBrokenPlanLinks` JSDoc
  (`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:434-438`)을 직접 대조 — "scope 는
  의도적으로 좁다, `plan/complete/**` 는 시점기록이라 정상 상태" 서술이 실제 JSDoc 과 일치.
  `harness-review-gate-followups.md:929-954` (이 결함을 최초 등재한 트래커)와도 근거·수치
  대조 완료 — regex 확장이 "3건은 실제 열린 작업, 6건 중 불릿 없는 서술 인용은 안 걸림"이라는
  실측 주장과 일치.
- `codebase/backend/src/nodes/core/error-codes.ts` 를 직접 열어 `ErrorCode`(:8)/
  `EngineErrorCode`(:147)/`EXECUTION_TIME_LIMIT_EXCEEDED`(`ErrorCode` 소속, :73) 실측 —
  `spec/conventions/error-codes.md` 신설 문단의 "비대칭 경계" 주장과 일치.

## 발견사항

- **[WARNING]** 완료 처리된 spec draft 가 "적용했다"고 주장하는 문장 조정이 실제 spec diff 에는 반영되지 않음
  - 위치: `plan/complete/spec-draft-error-code-two-surfaces.md:106-107` (주장) vs
    `spec/conventions/error-codes.md:26`(실제 diff 미적용 대상 — unified diff 상 context 줄,
    수정 없음)
  - 상세: `plan/complete/spec-draft-error-code-two-surfaces.md` §변경 제안 말미가
    *"§Overview 도입부의 '대표 surface'(단수) 표현도 병기에 맞춰 복수로 조정한다(1차
    `convention_compliance` INFO #1)"* 라고 명시적으로 "했다"고 적고 있다. 그런데 실제
    `spec/conventions/error-codes.md` diff(리뷰 payload 파일 68)는 §Overview 도입부 문장
    (`...명명이 중앙화된 **대표 surface**)뿐 아니라...`, 현재 파일 26행)을 **전혀 건드리지
    않고** 그 뒤에 새 문단만 추가했다 — 원 문장은 지금도 단수 그대로다. 6라운드
    `--spec` consistency-check 어느 라운드도 이 self-claim vs 실제 diff 불일치를 잡지
    못했다(1차 `convention_compliance` INFO #1 은 "planner 가 반영 시 자연스럽게 처리하면
    문제 없음"이라고 낮은 확신으로 남겼을 뿐, 실제 반영 여부를 재검증한 라운드가 없다).
    기능적 파급은 낮다(새로 추가된 "대표 surface 는 둘이다" 문장이 사실상 같은 정보를
    전달한다) 하지만 **완료 plan 문서가 "실행했다"고 기록한 행위가 실제로는 실행되지
    않았다** — "문서한 보장이 구현보다 넓다" 패턴이며, `spec_impact` Gate C 로 완료
    처리된 문서의 self-claim 신뢰도를 떨어뜨린다.
  - 제안: 둘 중 하나 — (a) `error-codes.md:26` 의 "대표 surface"(단수) 문구를 실제로
    조정(예: "명명이 중앙화된 대표 surface 중 하나")해 plan 의 완료 서술과 일치시키거나,
    (b) plan 문서의 "복수로 조정한다" 서술을 "새 문단으로 병기 사실만 추가, 원 문장은
    그대로 둔다(문제 없음, INFO #1 낮은 확신)"로 정정한다.

- **[WARNING]** 이 fix 가 해소한 결정 항목의 원 트래커 체크박스가 갱신되지 않음
  - 위치: `plan/in-progress/harness-review-gate-followups.md:904`
    (`- [ ] \`_CHECKBOX\` 정규식이 \`>\` 접두를 넘도록 넓힐지 판정한다.`)
  - 상세: 이 changeset 이 구현한 `_CHECKBOX` 정규식 확장(`plan_guard.py:87`) + 회귀
    테스트(`test_plan_guard.py` 3건) + 실측 근거는 바로 이 트래커 항목(902~954행)이
    "(a) 넓힌다"로 판정하며 요구한 것과 문자 그대로 일치한다(같은 실측 수치 "3건 진짜
    열린 항목 / 6건 중 불릿 없는 서술은 통과"를 재인용). 그런데 이 changeset 은
    `plan_guard.py`·`test_plan_guard.py`·`plan-lifecycle.md` 만 건드리고, 정작 이 결정을
    최초로 등재한 트래커의 체크박스(904행)는 여전히 `[ ]` 로 남아 있다. 프로젝트 관례상
    "plan 체크박스 = 실제 상태" 이고, 이 changeset 의 다른 여러 plan 파일(6~13번)은 유사한
    위생 정리를 정확히 수행했다는 점에서 이 항목만 놓친 것으로 보인다.
  - 제안: `harness-review-gate-followups.md:904` 를 `[x]` 로 체크하고 "구현 완료
    (2026-09-01, `plan_guard.py:87` + 회귀 테스트) — (a) 채택" 주석을 남긴다.

- **[INFO]** blockquote 확장이 코드펜스 안의 인용 예시까지 열린 체크박스로 잡을 수 있음(신규 회귀 아님)
  - 위치: `.claude/hooks/_lib/plan_guard.py:87` (`_CHECKBOX` 정의), `_all_checkboxes_done`
    (`plan_guard.py:237-268`)
  - 상세: `_all_checkboxes_done` 은 fenced code block(```` ``` ````) 내부를 별도로 스킵하지
    않고 라인 단위로 정규식만 적용한다. 종전 정규식(`^\s*[-*]\s+\[...\]`)도 이미 코드펜스
    안의 비-인용 예시 줄을 오검출할 수 있었으므로 **이 diff 가 새로 만든 결함은 아니다** —
    다만 `[\s>]*` 확장으로 코드펜스 안의 blockquote 형태 예시(`> - [ ] 예시`)까지 노출
    표면이 소폭 늘었다. 방향은 "거짓 음성(숨은 열린 항목)을 줄이려다 거짓 양성이 늘 수
    있는" 안전한 쪽(최악의 경우 이미 완료된 plan 이 `complete/` 이동 nudge 를 못 받는 정도,
    데이터 유실 방향 아님)이라 이번 fix 의 설계 의도(§주석의 "반대 방향 오탐 안 생긴다"
    실측)와 상충하지 않는다. 조치 불요, 기록만.

## 요약

핵심 code/spec diff(plan_guard.py 정규식 확장, plan-lifecycle.md 절차 신설, 신규
stray-tool-tags 가드, spec-links.test.ts 회귀, error-codes.md 병기)는 모두 실측 가능한
근거(직접 재현·grep·JSDoc 대조·`ErrorCode`/`EngineErrorCode` 소스 확인)로 뒷받침되고, 관련
테스트 스위트(plan_guard 36 tests, 신규 vitest 파일 33 tests, plan-frontmatter/
spec-plan-completion 1148 tests)가 전부 GREEN 이며 TODO/FIXME 류 미완성 표식도 없다. spec
fidelity 관점에서 `error-codes.md` 신설 문단은 코드 실측과 정확히 일치하고, `plan-lifecycle.md`
신설 절차는 `findBrokenPlanLinks` 의 실제 JSDoc 과 정합한다. 다만 완료 처리된 spec draft
(`spec-draft-error-code-two-surfaces.md`)가 "했다"고 기록한 문구 조정 하나가 실제 spec diff에는
반영되지 않았고(WARNING), 이 changeset 이 실제로 구현·해소한 결정 항목의 원 트래커 체크박스가
갱신되지 않은 채 남아 있다(WARNING) — 둘 다 기능 결함이 아니라 문서-실행 간 괴리/plan 위생
누락이며, 6라운드에 걸친 consistency-check 조차 잡지 못한 지점이다.

## 위험도

LOW
