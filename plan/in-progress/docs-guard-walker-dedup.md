---
title: 문서 가드의 디렉터리 순회 walker 3벌 통합 판정 + `SpecMdFile` 타입명 정리
worktree: (unstarted)
started: 2026-08-10
owner: developer
status: in-progress
priority: P3
spec_impact: none
---

## Overview

`codebase/frontend/src/lib/docs/__tests__/` 의 문서 가드들이 디렉터리 트리를 손으로 순회하는
walker 를 **3벌** 갖고 있다. `plan-lifecycle-gates` PR 의 ai-review 4라운드가 지적했고,
그 PR 범위 밖이라 여기로 분리했다.

> **왜 별 plan 인가**: 처음엔 [`harness-env-value-subpattern-dedup.md`](harness-env-value-subpattern-dedup.md)
> 에 이관했는데, 그 plan 은 **`.claude/hooks/*.py` 의 정규식 상수 중복**을 다룬다 —
> 코드베이스·언어·실패 모드(정규식 drift vs 디렉터리 순회 필터 drift)가 전부 다르고,
> 공통점은 "DRY vs 안전성" 이라는 느슨한 주제 유사성뿐이었다. 그 자리에 두면 "TS 문서 가드
> walker 중복" 을 찾는 사람이 발견하지 못한다(consistency plan-coherence WARNING).

## 대상 — walker 3벌

| 함수 | 파일 | 필터 |
|---|---|---|
| `walkPlanMarkdown` | `plan-scan.ts` | `archive/` 제외 · `0-`/`_` 접두 제외 · `recurse` 옵션 |
| `collectSpecMarkdown` | `spec-links.ts` | 생성형 `*-api-catalog/` 제외 |
| `collectCodebaseSources` | `spec-links.ts` | 확장자 집합(`.ts`/`.tsx`) · build 산출물 제외 |

`plan-lifecycle-gates` 가 합친 것은 **plan 계열 둘**이다 — live/complete 수집기를
`walkPlanMarkdown` 하나에서 파생시켰다. 위 표의 나머지 둘(`spec-links.ts` 쪽)과 Gate C 의
네 번째(`collectCompletePlans`)는 **그대로 남아 있다**.

> 이 문단은 처음에 "네 벌 → 한 벌" 이라고 썼는데 `plan-scan.ts` 헤더 주석은 "그중 둘"
> 이라고 정확히 적고 있었다 — 코드가 맞고 이 요약이 틀렸다(ai-review INFO). 통합 범위를
> 넓게 쓰면 남은 셋을 아무도 안 찾는다.

## 착수 전 필수 — 필터 차이를 표로 실측할 것

세 walker 의 제외 규칙이 서로 다르다. **그 차이가 의도인지 사고인지 가르지 않고 합치면**
이 저장소가 반복해 데인 "조용한 스코프 변경" 을 만든다. 합치는 형태는
`walkTree(root, {skipDir, includeFile})` 파라미터화가 자연스러워 보이나, 그건 실측 **뒤에**
결정한다.

- [ ] 세 walker 의 (제외 디렉터리 · 확장자 · 접두 규칙 · 재귀 여부)를 표로 실측
- [ ] 각 차이가 의도인지 사고인지 판정 — 의도면 파라미터로, 사고면 정정
- [ ] 통합 여부 결정 + (하기로 하면) 구현. **각 가드의 대상 파일 집합이 통합 전후로
      동일한지** 를 테스트로 고정할 것 — 집합이 바뀌면 그게 곧 조용한 스코프 변경이다

## 함께 볼 것 — Gate C 의 4번째 walker

`spec-plan-completion.test.ts` 의 `collectCompletePlans` 도 여전히 독립 구현이다(필터 값은
현재 `walkPlanMarkdown` 과 일치 — 실측 확인). 이름도 `collectCompletePlanMarkdown` 과 한 단어
차이라 혼동 위험이 있다.

- [ ] `collectCompletePlanMarkdown` 재사용으로 전환할지 판정 — 하면 "네 벌 → 한 구현" 이
      완결된다. 전환 시 한쪽 이름이 사라지므로 개명 문제도 함께 해소된다

## 2026-08-10 추가 — `plan-lifecycle-gates` 최종 라운드가 더 얹은 것

> **처음에 이 절의 4건을 전부 "선재 구조" 라고 적었는데 절반이 틀렸다.** rationale checker 가
> 항목별로 실측해 반박했다 — `matter(raw, {})` 4곳은 `plan-scan.ts`(그 PR 신규 파일) 2곳 +
> `spec-plan-completion.test.ts` 2곳인데 후자는 `origin/main` 에 **옵션이 아예 없었고** 그
> PR 이 `{}` 를 넣으면서 관용구를 복제한 것이다. Gate C 동등성 갭도 신규
> `collectCompletePlanMarkdown` 이 기존 구현을 재사용하지 않고 병렬로 만든 데서 나왔다.
> **자기 PR 이 만든 중복은 등재가 아니라 제거가 맞다** — 둘 다 그 PR 에서 해소했다
> (`parseFrontmatterSafe` 단일 진입점 + `collectCompletePlans` 를 공유 구현 위임으로 축소).
> 아래 남은 둘만 실제 선재다(`git diff origin/main` 에서 해당 함수 **0줄** 변경 — 실측).

### 판정 없이 바로 착수 가능

- [ ] **`spec-frontmatter-parse.ts:113` 이 옵션 없는 `matter(raw)` 를 쓴다** —
      `parseFrontmatterSafe` 로 태우면 gray-matter 캐시 오염 클래스가 저장소에서 소거된다.
      오늘은 `spec/**` 만 읽어 plan 스캐너와 내용이 안 겹쳐 무해하지만 **그 전제가 코드로
      강제되지 않는다**
      > 종전에 아래 DFS 항목의 각주로 묻혀 있어 착수 시 빠뜨리기 쉬웠다(plan-coherence INFO).
- [ ] (성능, 별 축) `extractLinks` 가 마크다운 링크가 없는 파일도 전수 라인 스캔한다 —
      실측 2072파일 중 `](` 포함은 35개(1.7%). `text.includes("](")` 사전 필터로 스킵
- [ ] (테스트 갭) `collectCompletePlans` 의 `archive/`·인덱스 제외에 negative-path fixture
      가 없다 — 자매 `collectCompletePlanMarkdown` 은 `plan-scan.test.ts` 가 고정하는데
      이쪽만 실저장소 데이터가 마침 정상이라 통과할 뿐이다
- [ ] **`NONE_VALUES` 정규화가 관측되지 않는다** — `hasValidSpecImpact` 의
      `.trim()`/`.toLowerCase()` 와 `"n/a"`/`"na"` 어휘를 겨냥한 fixture 가 없어,
      **그 값들을 빼거나 정규화를 지워도 스위트가 초록**이다(리뷰어 직접 뮤테이션 확인).
      `hasValidSpecImpact("n/a")`·`("NA")`·`("NONE")`·`("  none  ")` 4줄이면 닫힌다
      > 같은 파일의 다른 판정은 전부 fixture 로 관측되는데 여기만 예외다. 크기가 작아
      > 다음에 이 파일을 손댈 때 함께 처리하는 것이 자연스럽다
- [ ] `danglingSpecImpact` → `findDanglingSpecImpact` 개명 — **이 docs-guard 클러스터의**
      de-facto 패턴이 `find*` = "위반 배열 반환"인데(`findUnparseablePlans`·
      `findNonTerminalCompletedPlans`·`findFrontmatterViolations`·`findBrokenPlanLinks`·
      `findBrokenSpecLinksInSources`·`findRawHrefOffenders` 6개가 예외 없이 따른다)
      이것만 boolean predicate 처럼 읽힌다. 반환 타입이 `unknown[]` 이라 컴파일 타임에
      오용이 막히므로 실위험은 낮고, 신규 호출부가 생길 때가 위험 시점이다
      > **범위 조건 주의** — 이건 **저장소 전역 규약이 아니다**. 같은 폴더의
      > `findGuiFlowSections` 는 위반이 아니라 콘텐츠를 반환하고, backend 의
      > `findService`·`findFirstTriggerNode` 등은 단건 검색이다(naming checker 전수 확인).
      > 개명 근거는 "클러스터 내부 일관성" 이지 "전역 컨벤션 위반" 이 아니다
- [ ] `plan-scan.test.ts` 의 fixture 빌더 `fm`/`frontmatter` 두 벌 통합 — 그 파일 서두가
      "walker 넉 벌 중복" 을 경계하면서 자기 fixture 빌더가 두 벌이다
### 판정이 선행돼야 하는 것 (§"착수 전 필수" 실측 뒤)

- [ ] `spec-links.ts` 내부 `collectSpecMarkdown`/`collectCodebaseSources` DFS 중복 —
      위 walker 표의 2·3번이 바로 이것이다. **이 둘은 파일 하나 안의 중복**이라 통합이
      제일 싸지만, 필터 차이 실측이 선행 조건인 것은 다른 walker 와 같다
- [ ] **Gate C 판정 함수들이 `*.test.ts` 안에 산다** — `isGateCEnforced`·
      `hasMalformedStarted`·`hasValidSpecImpact`·`danglingSpecImpact`·`makeSpecExists`
      (+`GATE_C_CUTOFF`·`NONE_VALUES`)가 `spec-plan-completion.test.ts` 에 있어, 다른
      스크립트(예: pre-commit hook)가 재사용하려면 **테스트 파일을 import** 해야 한다.
      `plan-scan.ts` 로 옮기는 것이 자연스럽다
      > **선재 배치다.** 이 PR 은 그 파일의 판정을 *고쳤을* 뿐 위치를 만들지 않았고,
      > 파일 전체 이동은 Gate C 의 소비처·`code:` 등재·미러 문서를 함께 건드린다.
      > 다만 이 PR 이 `plan-scan.ts` 로 추출하는 원칙을 세웠으므로 그 원칙의 미적용
      > 지점으로 남는다(ai-review WARNING, 3회 관측)

## `SpecMdFile` 타입명 (별 축, 같은 착수 시점이 자연스러움)

- [ ] `SpecMdFile` 이 실제 용도보다 좁은 이름이다 — `collectCodebaseSources(): SpecMdFile[]`
      처럼 spec 이 아닌 파일에도 쓰인다(**선재 상태**, `plan-lifecycle-gates` 가 만든 것이
      아니다). `MdFileRef` 류 도메인 중립 이름으로 분리하고 `SpecMdFile` 은 진짜 spec
      markdown 전용으로 한정할지 판정
      > `plan-scan.ts` 는 이미 `PlanMdFile` 을 따로 두어 이 혼동에서 빠져 있다.

## Rationale

**왜 P3 인가.** 실동작 결함이 아니다 — 세 walker 는 각자 자기 가드에서 정확히 동작하고
있고, 위험은 "앞으로 한쪽만 고치면 조용히 갈린다" 는 잠재적인 것이다. 다만 그 잠재 위험이
실제로 발현한 전례가 있다: `plan-lifecycle-gates` 에서 `collectLivePlanMarkdown` 과
`collectTopLevelPlans` 가 `0-`/`_` 필터에서 어긋나 있었고, 주석은 "같은 스코프" 라고
말하고 있었다.

**왜 지금 합치지 않았나.** 그 PR 은 plan 라이프사이클 게이트가 주제였고, spec/codebase
walker 는 건드릴 이유가 없는 파일이었다. 필터 차이를 실측하지 않은 채 합치는 것이 더 큰
위험이라 판단해 분리했다.
