# 신규 식별자 충돌 검토 결과

## 검토 범위 확인

`meta.json` / prompt 상 검토 모드는 `--impl-done, scope=spec/5-system/, diff-base=origin/main` 이며,
prompt 가 "구현 대상 spec 영역" 으로 첨부한 파일은 `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`
두 건이다.

실제 브랜치(`expression-enricher-dry-fbb5ce`, merge-base `591cdee72fc`)의 diff 를 워킹트리에서
직접 확인한 결과:

```
git diff --stat $(git merge-base origin/main HEAD) HEAD
 .../__tests__/node-output-schema-enrichers.test.ts |  33 ++
 .../expression/node-output-schema-enrichers.ts     | 518 +++++++++++----------
 .../editor/expression/use-expression-context.ts    |  46 +-
 plan/in-progress/expression-enricher-dry.md        |  55 +++
```

- `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` 는 이 브랜치에서 **전혀 변경되지
  않았다** (diff 0줄). prompt 에 첨부된 두 파일은 orchestrator 의 code-glob 매칭이 잘못 선택한
  대상이다 — 실제로 변경된 코드는 `codebase/frontend/src/components/editor/expression/*.ts` 이며,
  이 glob 은 `spec/5-system/5-expression-language.md` 의 frontmatter `code:` 목록
  (`codebase/frontend/src/components/editor/expression/*.{ts,tsx}`)과 일치한다.
- `plan/in-progress/expression-enricher-dry.md` 의 워크플로 체크 항목에 동일 문제가 이미
  기록되어 있다: "consistency-check --impl-prep spec/5-system/ — BLOCK: NO (Critical 0).
  orchestrator target 오선정(무관 문서 평가) + 3파일 FS-flakiness 있었으나 behavior-preserving
  순수 리팩터라 위반 여지 없음." impl-done 단계에서도 동일한 오선정이 재발한 것으로 보인다.
- 이 PR 은 `spec_area: spec/5-system/5-expression-language.md` 로 선언된 **behavior-preserving
  순수 리팩터**다(plan "비고": "순수 내부 리팩터. spec·런타임·백엔드·사용자 가시 동작 무변경").
  spec 문서 자체에 신규 텍스트가 추가되지 않았으므로, 본 checker 관점("target 문서가 새로
  도입하는 식별자")에서 평가할 신규 spec-level 식별자가 존재하지 않는다.

## 코드 레벨 신규 식별자 부가 확인 (참고, 본 checker 범위 밖)

실제 diff 는 프론트엔드 파일 하나(`node-output-schema-enrichers.ts`) 내부에 다음 신규
심볼을 도입한다: `cloneSchema`, `collectProps`, `getOrCreateObjectChild`, `mergeLeafProps`,
`enrichByProjecting`, `OUTPUT_SCHEMA_ENRICHERS`. 요구사항 ID·엔티티/DTO명·API endpoint·
이벤트명·ENV var·spec 파일 경로 어느 카테고리에도 해당하지 않는 module-internal TS 함수/상수명이다.
`git -C <worktree> grep -n` 으로 codebase 전체를 확인한 결과 위 5개 함수명 + 1개 export 상수명
모두 해당 파일과 그 테스트/소비 파일(`use-expression-context.ts`,
`__tests__/node-output-schema-enrichers.test.ts`) 밖에서는 재사용되지 않아 기존 식별자와의
충돌이 없다.

### 발견사항

- **[INFO]** orchestrator target 오선정 재발 — 본 checker 가 평가할 신규 spec 식별자 없음
  - target 신규 식별자: (해당 없음 — prompt 첨부 `1-auth.md`/`10-graph-rag.md` 는 이 PR 에서
    미변경)
  - 기존 사용처: `plan/in-progress/expression-enricher-dry.md` 워크플로 체크 항목(impl-prep 단계)에
    동일 오선정이 이미 기록됨
  - 상세: 이 PR 의 실제 변경 spec 영역은 `spec/5-system/5-expression-language.md` (code-glob:
    `codebase/frontend/src/components/editor/expression/*.{ts,tsx}`)이나, 신규 식별자 충돌
    checker 에 전달된 target 문서는 `1-auth.md`·`10-graph-rag.md` 로, 이 PR 의 diff 와 무관하다.
    naming-collision 관점에서 실질적 위험은 없다(신규 spec 텍스트 자체가 없음) — 하지만
    orchestrator 의 code-glob 매칭 로직 버그로 인해 이번 리뷰 라운드가 잘못된 문서를 평가하고
    있다는 사실은 별도로 인지되어야 한다.
  - 제안: naming-collision 관점 자체는 통과(BLOCK 아님)로 판단하되, orchestrator 의 스코프
    선정 로직(code-glob → spec 문서 매핑)을 별도 인프라 이슈로 추적할 것을 권고. 이번 PR 의
    workflow 체크리스트("최종 consistency-check --impl-done spec/5-system/")는 이 리포트를
    근거로 "무관 문서 평가, 실질 신규 식별자 없음" 으로 처리 가능.

## 요약

이 PR 은 `spec/5-system/` 하위 어떤 spec 문서도 수정하지 않는 순수 프론트엔드 내부 리팩터이며
(diff 는 `node-output-schema-enrichers.ts`/`use-expression-context.ts`/테스트/plan 파일 4건뿐),
prompt 에 첨부된 target 문서(`1-auth.md`, `10-graph-rag.md`)는 orchestrator 의 code-glob 매칭
오류로 잘못 선택된 것으로 확인된다(plan 파일에 impl-prep 단계에서 이미 동일 문제가 기록됨).
따라서 "target 문서가 도입하는 새 식별자" 자체가 존재하지 않아 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·ENV var·설정키·spec 파일 경로 어느 카테고리에서도 충돌이 발견되지 않았다.
코드 레벨에서 신규 도입된 module-internal 함수/상수명(`cloneSchema`, `collectProps`,
`getOrCreateObjectChild`, `mergeLeafProps`, `enrichByProjecting`, `OUTPUT_SCHEMA_ENRICHERS`) 도
grep 전수 확인 결과 기존 코드베이스의 다른 식별자와 충돌하지 않는다.

## 위험도

NONE
