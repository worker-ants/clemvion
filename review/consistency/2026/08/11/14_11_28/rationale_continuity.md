# Rationale 연속성 검토 — docs-guard-walker (spec/conventions)

## 검토 범위

- target: `spec/conventions` (impl-done, diff-base `origin/main`)
- 실제 diff 는 `codebase/frontend/src/lib/docs/__tests__/{tree-walk.ts, tree-walk.test.ts, plan-scan.ts, plan-scan.test.ts, spec-links.ts, spec-links.test.ts, spec-frontmatter-parse.ts, spec-plan-completion.test.ts, impl-anchor-parse.ts}` + `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 2줄 추가 + `plan/complete/docs-guard-walker-dedup.md`(구 in-progress) + `.claude/docs/plan-lifecycle.md` 1줄 + `plan/in-progress/harness-env-value-subpattern-dedup.md` sibling-link 갱신.
- 4개 지정 질문을 코드 diff·commit 이력(`git log`)·plan 문서 원문 대조로 검증했다.

## 발견사항

### 1. `plan-scan.ts` 헤더가 "별 문제" 로 미뤄 뒀던 `spec-links.ts` walker 편입 — 근거 있는 번복, CRITICAL 아님

- target 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 헤더 주석 (diff), `plan/complete/docs-guard-walker-dedup.md` "대상 — walker 3벌 → 실측 6벌" 절
- 과거 결정 출처: `plan-lifecycle-gates` PR(commit `144d0de0a`) 당시 `plan-scan.ts` 헤더가 "`spec-links.ts` 에도 손수 순회하는 walker 가 둘 있지만 그쪽은 spec/codebase 트리를 본다 — 위 '네 벌' 에 애초에 포함되지 않는 **별 문제**" 라고 명시적으로 스코프를 분리했고, 그 판정을 `plan/in-progress/docs-guard-walker-dedup.md`("왜 지금 합치지 않았나… 필터 차이를 실측하지 않은 채 합치는 것이 더 큰 위험이라 판단해 분리했다")가 근거로 못박았다.
- 상세: 이번 PR 은 그 "별 문제" 였던 두 walker(`collectSpecMarkdown`/`collectCodebaseSources`)까지 `walkTree` 로 통합했다. 이것만 보면 "기각/보류된 대안의 재도입" 처럼 보이지만, 실제로는 (a) plan 문서에 새 절 "대상 — walker 3벌 → **실측 6벌** (2026-08-11 정정)" 을 추가해 원래 3벌이라는 전제 자체가 과소집계(spec/codebase 트리를 세는 범위 밖에 뒀다)였음을 밝혔고, (b) "판정 없이 바로 착수 가능" 체크리스트가 요구한 "필터 차이 실측 → 의도/사고 판정 → 통합 여부 결정" 절차를 실제로 수행해 표로 남겼고, (c) `## 완료` 절에 "필터 차이를 표로 실측한 결과 전부 의도였고, 축이 서로 다를 뿐이었다" 는 새 결론과 "조용한 스코프 변경 0 — 집합으로 증명"(통합 전/후 7개 집합 원소·순서 대조, 리뷰어가 `git show <pre>:...` 로 7/7 byte-identical 재현) 절을 새로 작성했다. `plan-scan.ts` 코드 주석에도 "**2026-08-11 후속**: 여기서 '별 문제' 로 미뤄 뒀던 `spec-links.ts` 쪽 walker 둘까지 포함해…" 라고 번복 사실과 사유를 명시했다.
- 제안: 없음 — 원래 Rationale 이 요구한 조건(실측 후 판정)이 그대로 충족됐고 번복 사유가 코드 주석 + plan 문서 양쪽에 남아 있다. `spec-frontmatter-parse.ts` 의 glob 존재 프로브(첫 매치 `return true`)는 통합 대상에서 의도적으로 제외했고 그 경계도 `tree-walk.ts` 헤더에 명문화돼 있어 일관성이 있다.

### 2. `docs-guard-walker-dedup.md` 의 "실측 전 병합 금지" 조건 — 충족 확인

- target 위치: `plan/complete/docs-guard-walker-dedup.md` "## 완료 (2026-08-11, `claude/docs-guard-walker`)" 절
- 과거 결정 출처: 동일 문서 하단 "왜 지금 합치지 않았나. … 필터 차이를 실측하지 않은 채 합치는 것이 더 큰 위험이라 판단해 분리했다" (원문 그대로 보존됨 — 역사 기록 삭제 없음).
- 상세: 이 PR 이 실제로 (1) 6개 walker 의 (제외 디렉터리·확장자·접두 규칙·재귀 여부) 를 표로 실측, (2) 필터 차이가 "전부 의도" 이고 "축이 서로 다를 뿐" 임을 판정, (3) `walkTree(root, bases, {skipDir, includeFile, recurse})` 로 파라미터화, (4) 통합 전/후 집합을 원소·순서 단위로 대조(리뷰어 독립 재현 포함)하는 절차를 완료했다. 조건이 요구한 "실측 → 판정 → 구현" 순서를 정확히 따랐다.
- 제안: 없음. 다만 참고 — 완료 절에 "처음에 '2075→2076' 이라고 적었다가 정정" 이라는 자기수정 기록이 함께 남아 있어(review round 발견), 오히려 "문서에 쓰는 시점에 실제 수량으로" 원칙(사용자 메모의 반복 교훈)을 성실히 따른 사례로 보인다.

### 3. `spec-impl-evidence.md` 의 `## Rationale` (R-1~R-10) — 되살린 기각 대안 없음

- target 위치: `spec/conventions/spec-impl-evidence.md` 는 이번 PR 에서 frontmatter `code:` 에 `tree-walk.ts`/`tree-walk.test.ts` 2줄만 추가됐고 `## Rationale` 본문은 전혀 수정되지 않았다.
- 과거 결정 출처: R-1(글로브 vs 명시 파일) / R-6(spec `code:` vs user-guide `code:` — "통합 안 함, 같은 이름이지만 다른 invariant") / R-9(§4.2 family 분리 근거) 를 특히 대조했다.
- 상세: R-6 의 "통합 안 함" 은 *검증 로직·게이트 도메인*(spec 약속-구현 vs 가이드 참조)의 비병합을 말하는 것이지, 파일 시스템을 순회하는 저수준 DFS 유틸(`walkTree`)의 코드 공유를 금지하는 것이 아니다. 실제로 `impl-anchor-parse.ts`(user-guide 도메인)의 `collectMdxFiles` 도 `walkTree` 를 쓰지만 가이드 `code:` 검증 게이트(`registry.test.ts`) 자체는 손대지 않았다 — 게이트/도메인 분리는 그대로 유지되고 순회 primitive 만 공유됐다. R-9 의 §4.2 family 구분(빌드 게이트 표 배치)도 이번 PR 로 바뀌지 않았다(Gate C `describe` 는 여전히 `spec-plan-completion.test.ts`, 판정 함수만 `plan-scan.ts` 로 이동 — 코드 주석이 "게이트 자체는 그대로 그 파일에 있다" 고 명시).
- 제안: 없음.

### 4. `SpecMdFile` → `@deprecated` 별칭 → 같은 PR 내 삭제 — 근거(실측 0곳) 기록 확인

- target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — commit `75f2e2af9`(walker 통합)에서 `export type SpecMdFile = MdFileRef;` 를 `@deprecated` JSDoc 과 함께 남겼다가, commit `bafa7c007`(리뷰 처분 커밋)에서 완전 삭제.
- 과거 결정 출처: 같은 PR 내부의 두 커밋 — 번복이 spec 문서가 아니라 코드/커밋 이력 안에서 일어났다.
- 상세: 삭제 커밋 diff 의 주석("종전 `SpecMdFile` 은 지웠다… `@deprecated` 별칭으로 남기려던 근거('외부 호출부를 한 번에 못 바꾼다')는 **거짓이었다** — 전수 grep 결과 외부 소비처 0건이고 유일한 사용처가 이 파일 안 한 곳이었다(리뷰어 실측)")와 commit `bafa7c007` 메시지("`@deprecated` 별칭의 근거가 거짓이었다 (maintainability·documentation 수렴)… 게다가 그 파일이 `@deprecated` 를 선언하면서 자기 시그니처에 계속 쓰고 있었다(자기모순). 지웠다.")가 번복 근거(실측 grep 0건 + 자기모순 발견)를 코드 주석과 커밋 메시지 양쪽에 명시적으로 남겼다. 새 Rationale 문서 절을 spec 에 추가하지는 않았지만, 이는 spec 레벨 결정이 아니라 구현 세부(내부 타입 별칭)의 정정이라 `spec/conventions/*.md` `## Rationale` 에 항목을 만들 규모가 아니다 — 기존 R-1~R-10 어디에도 `SpecMdFile`/타입 별칭 정책에 대한 언급이 없어 "기각된 spec 결정의 번복"에 해당하지 않는다.
- 제안: 없음. (참고: 이 사례는 사용자 메모의 "Rationale '기각된 대안'은 실제 이력 필수" 원칙에도 부합 — 지어낸 근거가 아니라 grep 실측으로 검증된 근거다.)

## 요약

이 PR 은 과거 두 spec/plan 문서(`plan-scan.ts` 헤더가 갈라놓은 스코프, `docs-guard-walker-dedup.md` 가 요구한 "실측 선행" 조건)를 표면적으로 번복하는 것처럼 보이지만, 두 경우 모두 원래 Rationale 이 요구한 절차(필터 차이 실측 → 의도/사고 판정 → 집합 불변 증명)를 실제로 수행했고 그 과정과 결론을 코드 주석·plan 문서·commit 메시지 세 곳에 일관되게 남겼다. `spec-impl-evidence.md` 의 `## Rationale`(R-1~R-10) 은 이번 diff 로 전혀 수정되지 않았고, 그 안에 기록된 도메인 분리 원칙(R-6, R-9)도 실제로는 저수준 DFS 유틸 공유와 상위 게이트/도메인 분리를 구분해 위반하지 않았다. `SpecMdFile` 별칭의 도입→삭제 번복도 같은 PR 안에서 grep 실측 근거와 함께 정정됐다. Rationale 연속성 관점에서 CRITICAL 은 없다.

## 위험도

NONE
