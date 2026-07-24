---
title: consistency 번들러가 target spec 을 카탈로그 덤프로 치환 (§H)
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: in-progress
priority: P2
---

## Overview

`harness-guard-followups.md` §H 에서 이관.

> 출처: `interaction-type-guard-comment-false-negative` 후속 ④ —
> impl-prep `review/consistency/2026/07/18/12_04_53`,
> impl-done `review/consistency/2026/07/18/12_34_30`,
> ai-review `review/code/2026/07/18/12_31_58` 이 공통 재현.

## 문제

`consistency_orchestrator.py` 가 `spec/conventions/` 를 alphabetical 로 순회하며 target
문서를 번들링하다가, `cafe24-api-catalog/**`(222개 field-level 파일) 대용량 덤프에
컨텍스트 예산이 소진된다. 그 결과 **검토 대상인 target spec 본문이 프롬프트에서 완전히
밀려난다**.

여러 세션에서 "일부 누락" 으로 관측되다가 2026-07-18 에는 **100% 치환**(target 0건)까지
심화 재현됐다.

**왜 지금까지 판정이 틀리지 않았나**: checker 들이 워크트리 파일을 직접 조사해
(`git diff` / `git merge-base` / `Read`) 매번 우회한다. 즉 BLOCK 판정 자체는 유효했다.
그러나 번들러는 미수정이라 재발하고, checker 가 우회를 잊는 순간 조용히 잘못된 판정이 된다.

## 체크리스트

- [ ] `consistency_orchestrator.py` 의 target 선택/컨텍스트 예산 로직에
      `cafe24-api-catalog/**` 서브트리 **파일수·depth 상한(cap)** 도입 —
      target 본문이 항상 예산 우선순위를 갖도록 `CONSISTENCY_MAX_CONTEXT_SIZE` 배분 재설계
- [ ] 회귀 고정: target 본문이 프롬프트에 실제로 들어갔는지 검증 (조립된 prompt 를 파싱해
      target 파일의 특징 문자열 존재 확인 — "번들이 커졌다" 가 아니라 "target 이 살아있다")
- [ ] (부수) `origin/main` 이 fork-point 보다 앞설 때 `git diff origin/main` 의 reverse-diff
      오염 — 기본 diff-base 를 `git merge-base HEAD origin/main` 으로 고정하는 옵션.
      이미 checker 들이 수동 재계산으로 우회 중이나 기본값 개선 여지.

## 관련

- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
- `spec/conventions/cafe24-api-catalog/**` (222 파일 — 예산 소진 원인)
- 부모: [`harness-guard-followups.md`](harness-guard-followups.md) §H

## Rationale

**우선순위가 중간인 이유.** 판정이 실제로 틀린 사례는 아직 없다(checker 들의 직접 조사가
막고 있다). 그러나 그 우회는 **checker 프롬프트 지침에 의존**하므로, 지침이 바뀌거나 새
checker 가 추가되면 곧바로 조용한 오판이 된다 — "지금 안 틀린다" 가 "구조가 맞다" 는 뜻은
아니다.

**왜 카탈로그를 그냥 빼지 않나.** `cafe24-api-catalog/**` 도 정당한 conventions 문서다.
필요한 건 배제가 아니라 **예산 우선순위** — target 본문이 먼저 들어가고 남는 예산을
주변 문서가 나눠 갖는 구조다.
