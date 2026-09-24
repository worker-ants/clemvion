# Plan 정합성 검토 — docs-guard-trigger (impl-prep, scope=spec/conventions)

## 검토 대상

- target: `spec/conventions/spec-impl-evidence.md` (전문, `id: spec-impl-evidence`, `status: implemented`)
- 실제 구현 예정 plan: `plan/in-progress/docs-guard-trigger.md` — `.github/workflows/spec-link-checks.yml` 를
  `plan/**` 도 트리거하도록, 또한 `spec-link-integrity.test.ts` 하나가 아니라 docs 가드
  디렉터리(`codebase/frontend/src/lib/docs/__tests__/`) 전체를 돌리도록 넓히는 작업
- 대조군: `plan/in-progress/**` 전수(65개는 컨텍스트 예산으로 본문 생략 — 관련 후보만 `Read`/`grep`
  으로 직접 확인)

## 발견사항

검토 관점 1(미해결 결정 충돌)·2(선행 plan 미해소)·3(후속 항목 누락) 모두에서 **차단 사유
없음**. 근거를 항목별로 남긴다.

- **원 트래커와의 정합 확인** — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  열린 항목 "docs 가드가 검사하는 데이터가 그 가드를 트리거하지 않는다" (developer, 중간,
  2026-09-24 등재)가 정확히 이 작업의 출처다. 그 항목은 처방 (a)(프론트엔드 전체 스위트를
  plan/spec PR 에도 태움) vs (b)(전용 lightweight 잡 확장)를 놓고 "(b) 를 권한다" 고 명시
  결론을 냈고, `docs-guard-trigger.md` 는 그 (b) 를 그대로 따른다(§B "그래서 이 워크플로를
  넓힌다"). **일방적으로 새 결정을 내리는 것이 아니라 트래커가 이미 합의한 방향을 집행**한다.
- **`#1106` 데드락 우려의 선결 확인** — 트래커 항목은 "required status check 를 늘리는 변경이라
  `#1106` 의 데드락 이력을 먼저 읽을 것" 이라고 경고했다. `docs-guard-trigger.md` §C 는 착수 전
  실측으로 "지금 required status check 는 하나도 없다"(classic branch protection 없음, ruleset
  없음)를 확인했고, 잡 이름(`spec-link-integrity`)도 유지해 신규 required check 를 만들지
  않는다. 이 잡 이름은 `.claude/tests/test_workflow_yaml_structure.py:262` 가
  `("spec-link-checks.yml", "spec-link-integrity")` 로 하드코딩 pin 하고 있음을 직접 확인했다 —
  plan 의 "잡 이름을 바꾸면 그 설계를 깬다" 주장은 근거 있는 전제다.
- **선행 plan 완료 확인** — `spec-link-checks.yml` 자체를 신설한 선행 작업
  (`plan/in-progress/eia-context-schema-followups.md:39` "spec-link 가드의 CI trigger 확대",
  PR #913)과, 그 워크플로의 pathspec 에 거버넌스 문서 스코프를 추가한 후속 작업
  (`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "doc-link 검사기가
  CLAUDE.md·.claude/** 를 안 훑는다" 항목, 2026-08-27 집행)는 **모두 `[x]` 완료**로 표시돼
  있다. `docs-guard-trigger.md` 가 전제하는 "이 워크플로가 이미 (b) 다" 는 선행 plan 미해소가
  아니라 이미 닫힌 두 작업 위에 서 있다.
- **target(spec-impl-evidence.md)과의 충돌 없음** — target 문서에는 "결정 필요" 로 열어 둔
  플레이스홀더가 없고(§Rationale 포함 전수 grep), CI 워크플로 이름·트리거 스코프를 명시적으로
  규정하는 문장도 없다(§4/§4.2 표는 가드 파일명만 SoT 로 규정하고 CI 배선은 위임). 따라서
  `spec-link-checks.yml` 의 트리거 확장은 target 의 서술 범위 밖이며, `spec_impact: none` 선언과
  모순되지 않는다.
- **후속 누락 없음** — `spec-frontmatter.test.ts`·`plan-frontmatter.test.ts` 등 디렉터리 전체를
  같은 잡에서 도는 것으로 넓히는 것이, 다른 plan 이 그 가드 파일들에 대해 걸어 둔 후속 항목과
  충돌하는지 전수 grep(`lib/docs/__tests__`)했다 — 매칭된 `harness-review-gate-followups.md`(완료된
  typecheck-ratchet 항목, 무관) · `harness-env-value-subpattern-dedup.md`(완료된
  docs-guard-walker-dedup 참조, 무관) 외에는 없다. `spec-draft-nullable-notation-followups.md`
  안의 `guide-identifier-*` 신규 가드 항목은 `user-guide-evidence.md` 가족(가이드→코드 방향)이라
  본 작업의 대상(spec/plan→코드 방향) 과 도메인이 다르다.

## 요약

`docs-guard-trigger.md` 는 트래커가 이미 (b) 로 합의해 둔 처방을 그대로 집행하는 작업이고,
그 처방이 전제하는 required-check 부재·잡 이름 고정 제약을 착수 전에 직접 실측·검증해 뒀다.
target(`spec-impl-evidence.md`)은 CI 워크플로 배선을 규정하지 않으므로 이 작업과 충돌할 결정
공간이 없고, `spec-link-checks.yml` 을 만들고 넓힌 두 선행 plan 항목은 모두 완료 상태다. 다른
in-progress plan 중 이 가드 파일군이나 CI 트리거 스코프를 건드리는 항목은 없어 후속 무효화·누락
위험도 확인되지 않았다.

## 위험도

NONE
