---
title: 문서 가드의 디렉터리 순회 walker 3벌 통합 판정 + `SpecMdFile` 타입명 정리
worktree: docs-guard-walker
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

## 대상 — walker 3벌 → **실측 6벌** (2026-08-11 정정)

> **plan 의 이 전제가 틀렸다.** 착수 시점에 `readdirSync`+스택 DFS 를 전수로 세니
> **여섯**이었다 — 아래 표의 셋에 더해 `spec-frontmatter-parse.ts` 의
> `collectApplicableSpecs` 와 glob 존재 프로브, `impl-anchor-parse.ts` 의
> `collectMdxFiles` 가 있었다. 그리고 **plan 이 경계한 형태가 plan 이 세지 않은 자매
> 사이에 이미 실재했다**: `plan-scan.ts` 는 `_` 접두를 *파일명*에, `impl-anchor-parse.ts`
> 는 같은 접두를 *디렉터리명*에 적용한다. 세는 범위를 좁게 잡으면 그 차이가 보이지 않는다.

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

- [x] 세 walker 의 (제외 디렉터리 · 확장자 · 접두 규칙 · 재귀 여부)를 표로 실측
- [x] 각 차이가 의도인지 사고인지 판정 — 의도면 파라미터로, 사고면 정정
- [x] 통합 여부 결정 + (하기로 하면) 구현. **각 가드의 대상 파일 집합이 통합 전후로
      동일한지** 를 테스트로 고정할 것 — 집합이 바뀌면 그게 곧 조용한 스코프 변경이다

## 함께 볼 것 — Gate C 의 4번째 walker

`spec-plan-completion.test.ts` 의 `collectCompletePlans` 도 여전히 독립 구현이다(필터 값은
현재 `walkPlanMarkdown` 과 일치 — 실측 확인). 이름도 `collectCompletePlanMarkdown` 과 한 단어
차이라 혼동 위험이 있다.

- [x] `collectCompletePlanMarkdown` 재사용으로 전환할지 판정 — 하면 "네 벌 → 한 구현" 이
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

- [x] **`spec-frontmatter-parse.ts:113` 이 옵션 없는 `matter(raw)` 를 쓴다** —
      `parseFrontmatterSafe` 로 태우면 gray-matter 캐시 오염 클래스가 저장소에서 소거된다.
      오늘은 `spec/**` 만 읽어 plan 스캐너와 내용이 안 겹쳐 무해하지만 **그 전제가 코드로
      강제되지 않는다**
      > 종전에 아래 DFS 항목의 각주로 묻혀 있어 착수 시 빠뜨리기 쉬웠다(plan-coherence INFO).
- [x] (성능, 별 축) `extractLinks` 가 마크다운 링크가 없는 파일도 전수 라인 스캔한다 —
      실측 2072파일 중 `](` 포함은 35개(1.7%). `text.includes("](")` 사전 필터로 스킵
- [x] (테스트 갭) `collectCompletePlans` 의 `archive/`·인덱스 제외에 negative-path fixture
      가 없다 — 자매 `collectCompletePlanMarkdown` 은 `plan-scan.test.ts` 가 고정하는데
      이쪽만 실저장소 데이터가 마침 정상이라 통과할 뿐이다
- [x] **`NONE_VALUES` 정규화가 관측되지 않는다** — `hasValidSpecImpact` 의
      `.trim()`/`.toLowerCase()` 와 `"n/a"`/`"na"` 어휘를 겨냥한 fixture 가 없어,
      **그 값들을 빼거나 정규화를 지워도 스위트가 초록**이다(리뷰어 직접 뮤테이션 확인).
      `hasValidSpecImpact("n/a")`·`("NA")`·`("NONE")`·`("  none  ")` 4줄이면 닫힌다
      > 같은 파일의 다른 판정은 전부 fixture 로 관측되는데 여기만 예외다. 크기가 작아
      > 다음에 이 파일을 손댈 때 함께 처리하는 것이 자연스럽다
- [x] `danglingSpecImpact` → `findDanglingSpecImpact` 개명 — **이 docs-guard 클러스터의**
      de-facto 패턴이 `find*` = "위반 배열 반환"인데(`findUnparseablePlans`·
      `findNonTerminalCompletedPlans`·`findFrontmatterViolations`·`findBrokenPlanLinks`·
      `findBrokenSpecLinksInSources`·`findRawHrefOffenders` 6개가 예외 없이 따른다)
      이것만 boolean predicate 처럼 읽힌다. 반환 타입이 `unknown[]` 이라 컴파일 타임에
      오용이 막히므로 실위험은 낮고, 신규 호출부가 생길 때가 위험 시점이다
      > **범위 조건 주의** — 이건 **저장소 전역 규약이 아니다**. 같은 폴더의
      > `findGuiFlowSections` 는 위반이 아니라 콘텐츠를 반환하고, backend 의
      > `findService`·`findFirstTriggerNode` 등은 단건 검색이다(naming checker 전수 확인).
      > 개명 근거는 "클러스터 내부 일관성" 이지 "전역 컨벤션 위반" 이 아니다
- [x] `plan-scan.test.ts` 의 fixture 빌더 `fm`/`frontmatter` 두 벌 통합 — 그 파일 서두가
      "walker 넉 벌 중복" 을 경계하면서 자기 fixture 빌더가 두 벌이다
### 판정이 선행돼야 하는 것 (§"착수 전 필수" 실측 뒤)

- [x] `spec-links.ts` 내부 `collectSpecMarkdown`/`collectCodebaseSources` DFS 중복 —
      위 walker 표의 2·3번이 바로 이것이다. **이 둘은 파일 하나 안의 중복**이라 통합이
      제일 싸지만, 필터 차이 실측이 선행 조건인 것은 다른 walker 와 같다
- [x] **Gate C 판정 함수들이 `*.test.ts` 안에 산다** — `isGateCEnforced`·
      `hasMalformedStarted`·`hasValidSpecImpact`·`danglingSpecImpact`·`makeSpecExists`
      (+`GATE_C_CUTOFF`·`NONE_VALUES`)가 `spec-plan-completion.test.ts` 에 있어, 다른
      스크립트(예: pre-commit hook)가 재사용하려면 **테스트 파일을 import** 해야 한다.
      `plan-scan.ts` 로 옮기는 것이 자연스럽다
      > **선재 배치다.** 이 PR 은 그 파일의 판정을 *고쳤을* 뿐 위치를 만들지 않았고,
      > 파일 전체 이동은 Gate C 의 소비처·`code:` 등재·미러 문서를 함께 건드린다.
      > 다만 이 PR 이 `plan-scan.ts` 로 추출하는 원칙을 세웠으므로 그 원칙의 미적용
      > 지점으로 남는다(ai-review WARNING, 3회 관측)

## `SpecMdFile` 타입명 (별 축, 같은 착수 시점이 자연스러움)

- [x] `SpecMdFile` 이 실제 용도보다 좁은 이름이다 — `collectCodebaseSources(): SpecMdFile[]`
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

## 완료 (2026-08-11, `claude/docs-guard-walker`)

13개 항목 전부 처리. 커밋 3개.

### 결정 — 통합했다

필터 차이를 표로 실측한 결과 **전부 의도**였고, 축이 서로 다를 뿐이었다(제외 판정이
디렉터리명 vs 없음, 파일 판정이 파일명 vs 상대경로 vs 확장자). 그래서
`walkTree(root, bases, {skipDir, includeFile, recurse})` 로 정확히 파라미터화된다.

`includeFile` 이 basename 과 relPath 를 **둘 다** 받는 것이 설계의 핵심이다 — 하나만 주면
기존 여섯 중 일부가 표현되지 않는다.

**glob 존재 프로브는 통합하지 않았다** — 첫 매치에 `return true` 하고 `readdirSync` 실패를
삼키는 **수집기가 아닌** 것이라, 전량 수집 후 판정으로 바꾸면 성격이 달라진다.

### 조용한 스코프 변경 0 — 집합으로 증명

통합 전 7개 집합을 파일로 찍고 통합 후와 **원소·순서까지** 대조했다. 유일한 차이는 새로
만든 `tree-walk.ts` 자신이 codebase 수집에 들어온 것뿐(2075 → 2076).

`collectMdxFiles` 는 정렬 기준을 절대경로 `sort()` → 상대경로 `localeCompare` 로 바꿨는데
순서가 동일함도 확인했다(대조에 순서를 포함시킨 이유가 이것이다).

### 발견 — 두 가드가 같은 `spec/` 트리를 다르게 본다 (선재, 보존)

|  | `spec/` 루트 파일 | 카탈로그 최상위 | 카탈로그 중첩 |
|---|---|---|---|
| `collectSpecMarkdown` | 본다 | **안 본다** | 안 본다 |
| `collectApplicableSpecs` | **안 본다** | **본다** | 안 본다 |

근거가 서로 다르다(전자는 `-api-catalog/` 경로 포함이면 통째 제외, 후자는
`INCLUDE_PREFIXES` + 최상위 `<resource>.md` 는 진짜 spec). **"합치는 김에 맞추는" 것이 곧
이 plan 이 금지하는 조용한 스코프 변경**이라 고치지 않고 차이 자체를 테스트로 고정했다.

> 이 발견은 **테스트 기대값을 추측으로 적었다가 둘 다 틀리면서** 나왔다. 틀린 자리가 곧
> 발견이었다.

### plan 이 제안한 최적화 조건이 건전하지 않았다

`extractLinks` 사전 필터로 `text.includes("](")` 를 제안했는데, 스캔이 인라인 코드를 먼저
지우므로 `[a]` + 백틱코드 + `(b)` 는 그 조건 없이 링크가 된다 — 그 파일이 링크 무결성
가드에서 **영영 빠진다**. 필요조건을 둘로 잡아 거짓 음성을 없앴고(통과 11.8%, 여전히 88%
차단) 캐너리로 고정했다. 전제 자체(2077 중 35개 = 1.7%, 114ms → 56ms)는 실측으로 참이었다.

### 이미 닫혀 있던 항목 1건

"`collectCompletePlans` 의 negative fixture 부재" 는 손수 DFS 시절 서술이다 — 그 함수는
`collectCompletePlanMarkdown` 위임 3줄로 축소됐고(#1123) 그쪽은 fixture 로 전부 고정된다.

### 과대 평가였던 유예 근거 1건

"Gate C 판정 함수 이동은 소비처·`code:` 등재·미러 문서를 함께 건드린다" → **외부 소비처
0건**(전수 grep)이고, 옮긴 것은 파일이 아니라 함수라 `code:` 등재와 SoT 표가 가리키는
대상이 안 바뀐다. 실제로 함께 고친 것은 `.claude/docs/plan-lifecycle.md` **한 줄**이다.

### 뮤테이션 (전부 RED)

| 뮤턴트 | 결과 |
|---|---|
| codebase `skipDir` 제거 | 해당 1건 |
| mdx `_` 디렉터리 제외 제거 | 해당 1건 |
| **공용 `walkTree` 의 `skipDir` 무력화** | **8건** (신규 4 + 기존 가드 4) |
| `NONE_VALUES` 정규화 제거 | 1건 |
| `NONE_VALUES` 어휘 축소 | 1건 |
| 사전 필터를 순진한 조건으로 축소 | 1건 |

검증: docs 가드 **2893 passed**(baseline 2879 + 신규 14), 타입 오류 0, lint 신규 0.

