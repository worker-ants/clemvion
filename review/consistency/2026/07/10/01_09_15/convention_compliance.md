# 정식 규약 준수 검토 — trigger-params-autocomplete (실제 diff 기준)

> **중요 정정**: 이 세션에 전달된 orchestrator prompt payload 는 target 문서로 `spec/5-system/1-auth.md`,
> `spec/5-system/10-graph-rag.md` 를 지정했으나, 이는 이번 브랜치의 실제 변경과 무관하다(별도 실수로
> 전달된 target). 실제 변경은 `git diff origin/main..HEAD` 로 확인한 `trigger-params-autocomplete` PR —
> `$params.<name>` 표현식 자동완성 프론트 catch-up — 이며, 본 보고서는 그 실제 diff 만을 대상으로
> 정식 규약(`spec/conventions/**`) 준수 여부를 검토했다. 잘못된 target 기준 이전 산출물(동일 경로에
> 존재하던 auth/graph-rag 대상 보고서)은 본 파일로 대체한다.

## 검토 대상 (실제 diff)

```
CHANGELOG.md
spec/5-system/5-expression-language.md                                          (+1 표 행, §7.1)
codebase/frontend/src/components/editor/expression/expression-constants.ts      (+5)
codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts (+28)
codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts (JSDoc 정정)
codebase/frontend/src/components/editor/expression/__tests__/use-expression-suggestions.test.ts (+82)
codebase/frontend/src/components/editor/expression/__tests__/variable-picker.test.tsx (+19)
plan/in-progress/trigger-params-autocomplete.md                                 (신규)
plan/in-progress/trigger-param-output-enricher.md                               (체크박스 갱신)
plan/in-progress/node-output-redesign/manual-trigger.md                         (체크박스 갱신)
```

성격: 프론트엔드 표현식 자동완성 전용 UX 힌트 추가. `$params` 는 이미
`spec/5-system/5-expression-language.md:171`(§4.1) 과 `spec/4-nodes/7-trigger/1-manual-trigger.md:150`
에 `$input.parameters` 단축으로 규정돼 있었고, 이번 PR 은 그 규정을 에디터 자동완성(`ROOT_VARIABLES`
+ `$params.` drill 핸들러)에 반영하는 구현 catch-up이다. 런타임·엔진·백엔드·API 무변경.

## 발견사항

이번 diff 범위에서 `spec/conventions/**` 직접 위반(CRITICAL) 후보를 찾지 못했다. 아래는 교차검증
결과이며, 위반이 아니라 **규약 일치를 확인한 항목**으로 기록한다(과소·과대 보고 방지 목적).

- **[관찰, 위반 아님] §7.1 표 행 포맷·순서가 규약과 정확히 일치**
  - target 위치: `spec/5-system/5-expression-language.md` §7.1 (`| \`$params.\` 입력 | ... |`)
  - 확인: 신규 행은 기존 형제 행(`\`{{\` 입력`, `\`$input.\` 입력`, `\`$node["\` 입력`, `\`$var.\` 입력`)과
    동일한 `| 트리거 | 동작 |` 2열 포맷·구분선(`|--------|------|`)을 그대로 따른다. 또한 삽입 위치가
    `$input.` 바로 다음인데, 이는 §4.1 내장 참조 변수 목록(`$input` → `$params` → `$node` → `$var`
    → ...)의 순서와 동일해, 문서 내 두 목록의 순서 일관성까지 지켜졌다.
  - 결론: 명명·포맷 규약 위반 없음. 오히려 sibling row 와의 일관성이 모범적으로 지켜짐.

- **[관찰, 위반 아님] frontmatter `code:` glob 이 이미 신규 파일을 커버 — 갱신 불필요**
  - 위반 규약(대조): `spec/conventions/spec-impl-evidence.md` §2 frontmatter 스키마 — spec 이 약속하는
    surface 와 구현 코드 사이 정적 증거(`code:`) 의무.
  - 확인: `spec/5-system/5-expression-language.md` frontmatter 의 `code:` 는 이미
    `codebase/frontend/src/components/editor/expression/*.{ts,tsx}` glob 을 포함하므로, 이번에
    수정된 `expression-constants.ts`/`use-expression-suggestions.ts`/`node-output-schema-enrichers.ts`
    는 모두 기존 glob 범위 안에 있다. `id`/`status`(`implemented`) 도 무변경 대상과 부합. 갱신 누락 아님.

- **[관찰, 위반 아님] CHANGELOG 항목이 저장소 내 확립된 de facto 포맷을 정확히 재현**
  - 확인: `## Unreleased — <제목> (<spec 영역>/<파일 축약> §<n>)` → `### 변경 사항` → 굵게 시작하는
    번호 목록 1개 → 말미 `SoT: <spec 경로 §n>` 구조가, 바로 위 기존 항목(`Manual Trigger 파라미터
    표현식 자동완성 힌트 (5-system/5-expression §7.2)` 등 다수)과 동일 패턴이다. `spec/conventions/**`
    에 CHANGELOG 형식을 명시한 정식 규약 파일은 없으나(따라서 엄밀한 "위반" 판정 대상은 아님),
    기존 반복 패턴과의 정합성은 완전히 지켜졌다.

- **[관찰, 위반 아님] `plan/in-progress/trigger-params-autocomplete.md` frontmatter 가 스키마를 충족**
  - 위반 규약(대조): `.claude/docs/plan-lifecycle.md` §4 — top-level in-progress plan 은 `worktree`/
    `started`/`owner` 필수.
  - 확인: `worktree: trigger-params-autocomplete-30acb1`(실제 워크트리 디렉토리명과 일치) /
    `started: 2026-07-10`(ISO) / `owner: developer` 세 필드 모두 존재. `spec_impact` 는 완료(Gate C)
    시점 의무이며 본 plan 은 아직 `in-progress/`(마지막 워크플로 체크 `[~]` 진행 중)이므로 대상 아님.

- **[INFO] 자매 plan 파일명의 단수/복수 표기 미세 불일치 (규약 위반 아님, 참고용)**
  - target 위치: `plan/in-progress/trigger-params-autocomplete.md` (신규) vs
    `plan/in-progress/trigger-param-output-enricher.md` (기존, 같은 `$params` 클러스터의 선행 plan)
  - 위반 규약: 없음 — `plan-lifecycle.md` 는 파일명 단/복수 표기를 규정하지 않는다.
  - 상세: 두 plan 이 같은 `$params`/trigger-param 계열 작업인데 파일명이 `trigger-param-`(단수)과
    `trigger-params-`(복수)로 갈린다. 기능상 문제 없고 두 파일이 서로 상호 링크(`[trigger-params-
    autocomplete.md](trigger-params-autocomplete.md)`)로 잘 연결돼 있어 탐색성 저하도 미미하다.
  - 제안: 순수 스타일 사안이라 이번 PR 에서 rename 할 필요는 없음. 향후 동일 클러스터 plan 명명 시
    참고 정도로만 남긴다.

## 스코프 밖 확인 (검토 관점 대비, 해당 없음)

- **출력 포맷 규약(API 응답/이벤트 페이로드/에러 코드)**: 이번 diff 는 API·이벤트·에러코드를 전혀
  건드리지 않는다(순수 프론트 자동완성 문자열 매칭 로직 + 표현식 스펙 표 1행). `spec/conventions/
  error-codes.md`·`swagger.md`·API convention 문서 대상 변경 없음 → 해당 없음.
- **API 문서 규약(OpenAPI/Swagger 데코레이터·DTO 명명)**: 백엔드 컨트롤러/DTO 변경 없음 → 해당 없음.
- **금지 항목**: `spec/conventions/**` 전수에서 이번 패턴(프론트 상수 배열에 신규 root 변수 추가 +
  drill 핸들러 분기 추가 + 표 행 동기화)을 명시적으로 금지한 조항을 찾지 못했다.

## 요약

`trigger-params-autocomplete` PR 은 이미 spec(§4.1, manual-trigger §5)에 규정돼 있던 `$params` 를
프론트 자동완성에 뒤늦게 연결하는 순수 catch-up 구현이다. 정식 규약(`spec/conventions/**`) 관점에서
직접 위반(CRITICAL)은 없으며, §7.1 표 행 포맷·순서, CHANGELOG 항목 포맷, plan frontmatter 스키마,
frontmatter `code:` glob 커버리지 등 검토 가능한 모든 축이 기존 확립된 패턴과 정확히 일치한다. 유일하게
기록할 만한 사항은 자매 plan 파일명의 단/복수 표기 미세 불일치(INFO, 기능·탐색성 영향 없음)뿐이다.
별도 code-review(`review/code/2026/07/10/00_52_26/SUMMARY.md`)에서도 이미 Critical 0 / WARNING 3(테스트
커버리지 2건 + DRY 1건, 모두 유지보수성 관점이며 정식 규약과 무관)으로 확인됐고, 이번 정식 규약
검토와 결론이 상충하지 않는다.

## 위험도

NONE — 실제 diff(`trigger-params-autocomplete`)에서 CRITICAL(BLOCK) 등급의 정식 규약 위반은
발견되지 않았다. WARNING 등급 위반도 없다. INFO 1건(plan 파일명 단/복수 표기, 스타일 참고용)만 기록.
