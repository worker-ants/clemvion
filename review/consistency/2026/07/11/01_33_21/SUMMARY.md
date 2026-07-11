# Consistency Check SUMMARY — `--impl-done` (variables.__* 3계층 강제)

- **일시**: 2026-07-11 01:33:21
- **모드**: `--impl-done` (push 직전 의무)
- **diff**: `origin/main...HEAD`
- **checker**: 5종 직접 Agent fan-out

## BLOCK: NO

Critical 0건. Warning 2건 — **둘 다 fix**. Info 소수(조치 불요).

| checker | Critical | Warning | Info |
| --- | --- | --- | --- |
| cross-spec | 0 | 1 | 1 |
| convention-compliance | 0 | 2 | 2 |
| rationale-continuity | 0 | 0 | 0 |
| plan-coherence | 0 | 0 | 4 |
| naming-collision | 0 | 0 | 0 |

(cross-spec W 와 convention W2 는 동일 근본 원인 — dual-surface 에러 코드)

## checker 가 독립 검증한 정합

- **구현 = spec 3계층 서술 정확 일치**: L0(saveCanvas+importWorkflow, restoreVersion 면제)·L1(validateConfig)·
  L2(handler.execute 해석 후). 시스템 주입 키 4종·`EXPRESSION_EXCLUSIONS` 미등재 전제 코드 확인 (cross-spec).
- **breaking 근거 coherent**: "관찰 가능한 silent(meta.skipped/coercionWarnings)" vs "관찰 불가능한 opaque
  silent(park drop — `execution-engine.service.ts:7554-7562` 로그·meta 전무)" 구분을 코드로 확인 (rationale).
- **"강제 갭"→강제 전환은 결정 번복 아님**: PR #889(`d2b4590a2`)이 "스키마 가드 하드닝은 별도 task" 로 예고 (rationale).
- **7차 갱신 라인-ref 정확**: 전수 대조 일치. 기존 미해결 항목(coercionWarnings·recordValues)은 `[ ]` 유지 (plan).
- **식별자 충돌 0**: 새 코드·util·5 export·2 const 전부 (naming).

## Warning 처리 (둘 다 fix)

### W1 (cross-spec + convention W2) — `RESERVED_VARIABLE_NAME` 은 dual-surface 인데 §1.3 단일 400 행
L0 는 진짜 HTTP 400(`BadRequestException`)이나, L2 는 엔진 런타임 throw 로 `.message` prefix 로만 존재하고
구조화 `error.code`·HTTP 응답이 없다(엔진 node 실패로 기록). §1.3 이 blanket `400` 한 행으로 병합한 것은
같은 문서의 dual-surface 선례(`EXECUTION_TIMEOUT`/`CODE_TIMEOUT` 레이어 분리, `WORKER_HEARTBEAT_TIMEOUT`
"HTTP 무관")와 어긋난다.
→ **fix**: §1.3 행을 "본 행은 저장 시점(L0) surface 만 — 진짜 HTTP 400. `{{ }}` 런타임(L2)은 HTTP 무관,
message-prefix only" 로 정정하고 HTTP 열을 `400 (저장) / — (런타임)` 로. `EXECUTION_TIMEOUT` 선례 명시 참조.

### W2 (convention W1) — util 이 "코드 SoT" 로 인용되나 `code:` frontmatter 미등재
`reserved-variable-name.util.ts` 가 `execution-context.md` 원칙 5 에서 "코드 SoT" 로 명시되고 두 노드 spec 이
강제 지점으로 참조하는데, 세 spec 의 `code:` frontmatter 에 없었다. `variable-modification.md` 는 이미
`_shared/value-masking.util.ts` 를 등재한 로컬 선례가 있다.
→ **fix**: 세 spec(`execution-context.md`·`4-variable-declaration.md`·`5-variable-modification.md`)의 `code:` 에
util 경로 추가. frontmatter guard 4 suites / 681 tests 통과 확인.

## Info (조치 불요)

- **cross-spec I**: §6 "에러 포트를 갖지 않는다" 표현이 `node-common.md` 의 노드-무관 "Route to Error Port" UI 와
  표현상 긴장 — 실질 동작 무영향(두 변수 노드는 실제로 error 포트가 없다).
- **convention I**: `@ApiBadRequestResponse` description 에 예약 이름 조건 미언급 — `swagger.md` 필수 아님(선택).
  새 CHANGELOG "범위 밖" 헤딩은 신규 표현이나 CHANGELOG 포맷 규약 문서 부재라 위반 아님.
- **plan I**: 타 in-progress plan 충돌 없음. task chip PR 이라 별도 plan/in-progress/ 문서 불요(미해결 항목 없음).

## 재검증

frontmatter guard(spec-frontmatter·parse·link-integrity·status-lifecycle) 4 suites / 681 tests 통과.
fix 는 spec 문서·frontmatter 만 — 코드·테스트 로직 무변경.

## 결론

BLOCK: NO. Warning 2건 fix 완료. push 가능.
