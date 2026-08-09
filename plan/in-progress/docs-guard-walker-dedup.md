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

- [ ] **gray-matter 캐시 우회 관용구(`matter(raw, {})`)가 4곳에 손 복제** —
      `plan-scan.ts` 2곳 + `spec-plan-completion.test.ts` 2곳. 5번째 파서 호출이 추가될 때
      `{}` 를 빠뜨리면 조용히 되살아난다(그 PR 이 실제로 1곳만 고쳤다가 리뷰에 잡혔다).
      `parseFrontmatterSafe(raw)` 단일 헬퍼로 통합 판정
      > 같은 hazard 가 `spec-frontmatter-parse.ts:113` 에도 남아 있다(옵션 없는 `matter(raw)`).
      > 오늘은 `spec/**` 만 읽어 plan 스캐너와 내용이 안 겹쳐 무해하지만 **그 전제가 코드로
      > 강제되지 않는다.** 헬퍼로 통합하면 이 클래스가 저장소에서 소거된다
- [ ] **Gate C 의 `collectCompletePlans` 와 `collectCompletePlanMarkdown` 의 반환 집합
      동등성이 자동 검증되지 않는다** — "현재 일치" 는 수동 실측일 뿐이다. 통합하거나,
      통합 전까지는 **동등성 계약 테스트 1개**를 두는 편이 낫다(위 §"함께 볼 것" 과 같은 대상)
- [ ] `spec-links.ts` 내부 `collectSpecMarkdown`/`collectCodebaseSources` DFS 중복 —
      위 walker 표의 2·3번이 바로 이것이다. **이 둘은 파일 하나 안의 중복**이라 통합이
      제일 싸다
- [ ] (성능, 별 축) `extractLinks` 가 마크다운 링크가 없는 파일도 전수 라인 스캔한다 —
      실측 2072파일 중 `](` 포함은 35개(1.7%). `text.includes("](")` 사전 필터로 스킵
- [ ] (테스트 갭) `hasValidSpecImpact` 의 `NONE_VALUES` 대소문자/trim/`n-a` 분기가 fixture
      로 검증되지 않는다 — `.trim()`/`.toLowerCase()` 를 지워도 초록일 수 있다.
      `collectCompletePlans` 의 `archive/`·인덱스 제외도 negative-path fixture 가 없다

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
