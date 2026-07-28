---
title: consistency-check `--impl-done` 번들이 정작 대상 spec 파일을 예산 초과로 누락한다 (사전순 정렬 결함)
started: 2026-07-28
owner: developer
status: in-progress
priority: P2
spec_impact: none
---

## Overview

`--impl-done` 이 조립하는 컨텍스트 번들이 **정작 그 PR 의 SoT spec 파일을 통째로 누락**한다.
원인은 파일명 **문자열 사전순 정렬**이다 — `"1" < "2" < "4"` 이므로 두 자리 번호 파일
(`10-*.md`, `11-*.md`)이 한 자리 번호 파일(`4-execution-engine.md`)보다 먼저 실려 컨텍스트
예산을 소진하고, 실제 대상 파일이 뒤로 밀려 잘린다.

## 실측 근거 (2026-07-28)

출처: `review/consistency/2026/07/28/01_26_40` (retry-turn-terminal-guard PR 의 `--impl-done`,
scope `spec/5-system/`). 그 세션 SUMMARY 의 WARNING #6, `naming_collision` checker 보고.

- **5개 checker 전원**이 이 문제를 겪었고, 전원이 **절대경로 직접 Read 로 우회**했다.
- 누락된 파일은 `spec/5-system/4-execution-engine.md` — **CHANGELOG 가 그 PR 의 SoT 로
  지목한 바로 그 파일**이다.
- `target_path` 가 디렉터리 단위(`spec/5-system/`)로 해석되는 것과 결합해 증상이 커진다.

**이번 건은 결론에 영향이 없었다** — checker 들이 실측으로 우회했고 BLOCK 판정도 정상
도출됐다(BLOCK: NO). 하지만 우회는 checker 의 자율 행동에 의존하는 것이라, 우회하지 않는
checker 나 더 큰 영역에서는 **spec 을 안 보고 "위반 없음" 을 반환하는 조용한 거짓 통과**가
된다. 그 실패는 로그에 흔적이 남지 않는다.

## 작업 항목

- [ ] **natural sort 채택** — 파일명 선행 숫자를 정수로 파싱해 정렬. 최소 수정이고 이번
      증상의 직접 원인이다.
- [ ] **code diff 가 매칭하는 spec 을 우선 포함** — frontmatter `code:` 패턴이 이번 diff 의
      파일과 매칭되는 spec 문서를 디렉터리 전체보다 **먼저** 번들에 넣는다. 정렬만 고치면
      영역이 더 커졌을 때 같은 증상이 재발한다. 이쪽이 근본 대응.
- [ ] **누락을 관측 가능하게** — 예산 초과로 잘린 파일 목록을 prompt 에 명시하거나 stderr 로
      경고. 지금은 checker 가 "그 파일이 번들에 없다" 는 사실 자체를 알 수 없다.
      (참고: 조용한 truncation 을 통과로 오독하는 문제는 이 저장소에서 반복 관측됐다.)
- [ ] 부수 점검 — 생략 목록에 비-경로 문자열(`_selectedPort`/`$trigger`/`$env`)이 혼입되는
      경로. 같은 checker 가 함께 지적했다.

## 검증

정렬만 고치면 vacuous 하게 통과할 수 있다 — **`spec/5-system/` 처럼 한 자리·두 자리 번호가
섞인 실제 디렉터리로 번들을 만들어, `4-execution-engine.md` 가 실제로 포함되는지**를 단언할
것. 파일 목록 길이나 정렬 함수의 단위 테스트만으로는 부족하다(헬퍼 테스트 ≠ 호출부 테스트).

## 관련

- 발견 세션: `review/consistency/2026/07/28/01_26_40` (WARNING #6)
- 소비 PR: `plan/in-progress/retry-turn-terminal-guard.md`
- 기존 harness 백로그와는 별건: `harness-review-gate-ci-backstop.md`,
  `harness-consistency-summary-downgrade-rule.md`
